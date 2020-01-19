require('dotenv').config();
const client = require('../lib/client');
const moment = require('moment');

const fetch = require('node-fetch');
const superagent = require('superagent');

const Cryptr = require('cryptr');
const cryptr = new Cryptr(process.env.CRYPTR_KEY);

const fetchWithError = async(url, options) => {
  const response = await fetch(url, options);
  const data = await response.json();
  if(response.ok) return data;
  else throw data.error;
};

const getAllNags = async() => {
  try {
    const result = await client.query(`
            SELECT
            nags.id AS "completeId",
            task,
            notes,
            start_time AS "startTime",
            end_time AS "endTime",
            interval,
            minutes_after_hour AS "minutesAfterHour",
            snoozed,
            period,
            mon,
            tue,
            wed,
            thu,
            fri,
            sat,
            sun,
            recurs,
            complete,
            id_string AS "idString",
            users.id AS "userId",
            push_api_receive AS "pushApiKey",
            push_api_send AS "pushAppKey",
            pushover_device_name AS "deviceName"
            FROM users JOIN nags
            ON users.id = nags.user_id
            ORDER BY nags.id;
        `,);
    return result.rows.map(row =>
      ({ ...row, task: cryptr.decrypt(row.task), notes: cryptr.decrypt(row.notes) }));
  }
  catch(err) { console.log(err); } // eslint-disable-line no-console
};

const isDayOfWeek = nag => {
  const dayNums = [
    nag.mon && 1,
    nag.tue && 2,
    nag.wed && 3,
    nag.thu && 4,
    nag.fri && 5,
    nag.sat && 6,
    nag.sun && 7,
  ];

  return dayNums.every(el => !el) || dayNums.includes(moment().isoWeekday());
};

// https://stackoverflow.com/questions/11038252/how-can-i-calculate-the-difference-between-two-times-that-are-in-24-hour-format
// https://stackoverflow.com/questions/1531093/how-do-i-get-the-current-date-in-javascript
const timeDiff = timeStr => {
  const now = new Date();
  /* adjust to Pacific time */ now.setHours(now.getHours() - 1);
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0'); //January is 0
  const yyyy = now.getFullYear();
  const theDate = mm + '/' + dd + '/' + yyyy;

  const startTime = new Date(theDate + ' ' + timeStr);
  return Math.floor((now - startTime) / 60000); //difference in minutes
};

const isTimeForNag = (nag, snoozed = false) => {
  const minutesSinceStart = timeDiff(nag.startTime);
  const minutesTilEnd = nag.endTime ? -timeDiff(nag.endTime) : 0;

  return (
    !snoozed
    && minutesSinceStart >= 0
    && moment().minutes() % 5 === 0
    && (nag.endTime ? minutesTilEnd > 0 : true)
    && isDayOfWeek(nag)
    && (
      minutesSinceStart === 0 ||
      minutesSinceStart % nag.interval === 0 ||
      Boolean(nag.minutesAfterTheHour && moment().minutes() === nag.minutesAfterTheHour)
    )
  );
};

const sendNags = async() => {
  let allNags;
  try {
    allNags = await getAllNags();
    console.log('allNags', allNags);
  }
  catch(err) { console.log; } // eslint-disable-line no-console

  const nagsToSend = [];
  allNags.forEach(nag => {
    if(!nag.complete
      && nag.pushApiKey
      && nag.pushApiKey.length === 30
      && isTimeForNag(nag)) {
      nagsToSend.push(nag);
    }
  });
  
  const messagesObj = nagsToSend.reduce((acc, cur) => {
    const html = `${cur.task}: ${cur.notes}  <a href="https://nagmeapp.com/api/${cur.recurs ? 'complete' : 'delete'}/${cur.completeId}">☑</a>\n\n`;
    acc[cur.pushApiKey] ?
      acc[cur.pushApiKey][2] += html :
      acc[cur.pushApiKey] = [cur.pushAppKey, cur.deviceName, html];
    return acc;
  }, {});

  
  Object.entries(messagesObj).forEach(async message => {
    try {
      console.log('sending'); //eslint-disable-line no-console
      const url = 'https://api.pushover.net/1/messages.json';
      return await fetchWithError(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: message[0],
          token: message[1][0],
          device: message[1][1],
          message: message[1][2],
          html: 1
        })
      });
    }
    catch(err) { console.log('error ' + err); } // eslint-disable-line no-console
  });
};

const updateRecurNags = async() => {
  try {
    const result = await client.query(`
            UPDATE nags 
            SET complete = FALSE
            WHERE recurs = TRUE
            RETURNING *;
        `,);
    return result.rows;
  }
  catch(err) {
    console.log(err); // eslint-disable-line no-console
  }
};

const rainIds = async() => {
  try {
    const result = await client.query(`
            SELECT *
            FROM users JOIN nags
            ON users.id = nags.user_id
            WHERE nags.task LIKE 'UMBRELLACHECK';
        `);
    return result.rows;
  }
  catch(err) {
    console.log(err); // eslint-disable-line no-console
  }
};

const umbrellaCheck = async() => {
  // Portland lat and long
  const lat = '45.5051';
  const long = '122.6750';
  let rainProbability = 0;
  try {
    const checkWeather = await superagent.get(`https://api.darksky.net/forecast/${process.env.DARKSKY_API_KEY}/${lat},${long}`);
    if(checkWeather){
      rainProbability = parseFloat(checkWeather.body.currently.precipProbability, 10);
    }
  }
  catch(err)
  {
    console.log(err); // eslint-disable-line no-console
  }

  if(rainProbability > .4){
    const umbrellaNags = await rainIds();
    umbrellaNags.forEach(async nag => {
      if(
        nag.push_api_receive
        && nag.push_api_receive.length === 30) {
        try {
          const url = 'https://api.pushover.net/1/messages.json';
          return await fetchWithError(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            //url: `https://nagmeapp.com/api/complete/${nag.user_id}`,
            body: JSON.stringify({
              token: process.env.PUSHOVER_TOKEN,
              user: nag.push_api_receive,
              message: 'Greater Than 40% chance of rain',
              url: `https://nagmeapp.com/api/complete/${nag.user_id}`,
              url_title: 'CLICK HERE MARK COMPLETE'
            })        
          });
        }
        catch(err) { console.log('error ' + err); } // eslint-disable-line no-console
      }
    });
  }
};

module.exports = {
  umbrellaCheck,
  sendNags,
  updateRecurNags
};
