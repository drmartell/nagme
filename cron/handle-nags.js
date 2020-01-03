require('dotenv').config();
const client = require('../lib/client');
const moment = require('moment');

const fetch = require('node-fetch');
const superagent = require('superagent');
require('dotenv').config();

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
            push_api_key AS "pushApiKey"
            FROM users JOIN nags
            ON users.id = nags.user_id;
        `,);
    return result.rows;
  }
  catch(err) { console.log(err); } // eslint-disable-line no-console
};

// 1-7 where 1 is Monday and 7 is Sunday
// days are true by default
const isDayOfWeek = nag => {
  [
    nag.mon && 1,
    nag.tue && 2,
    nag.wed && 3,
    nag.thu && 4,
    nag.fri && 5,
    nag.sat && 6,
    nag.sun && 7,
  ]
    .includes(moment().isoWeekday());
};

// https://stackoverflow.com/questions/11038252/how-can-i-calculate-the-difference-between-two-times-that-are-in-24-hour-format
// https://stackoverflow.com/questions/1531093/how-do-i-get-the-current-date-in-javascript
const timeDiff = timeStr => {
  const now = new Date();
  // adjust to Pacific time
  now.setHours(now.getHours() - 1);
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0'); //January is 0
  const yyyy = now.getFullYear();
  const theDate = mm + '/' + dd + '/' + yyyy;

  const startTime = new Date(theDate + ' ' + timeStr);
  return Math.floor((now - startTime) / 60000); //difference in minutes
};

const isTimeForNag = (nag, dayNumsArr = [], snoozed = false) => {
  const minutesSinceStart = timeDiff(nag.startTime);
  const minutesTilEnd = -timeDiff(nag.endTime);
  return (                                                  // return true if:
    !snoozed                                              // nag is not snoozed
    //nowTime.isAfter(nag.startTime) &&                   // and it is after start time
    && minutesSinceStart >= 0                              // and it is after start time
    && moment().minutes() % 5 === 0                        // only allow nags at most every 5 minutes
    //&& (nag.endTime && nowTime.isBefore(nag.endTime))   // and if there is an end time and we haven't exceeded it
    && (nag.endTime ? minutesTilEnd > 0 : true)           // and if there is an end time and we haven't exceeded it
    && (dayNumsArr.length > 0 ? isDayOfWeek(nag) : true)       // and there are days selected and this is one of them
    && (
      minutesSinceStart === 0 ||
      minutesSinceStart % nag.interval === 0 ||         // and this is one of the regularly recurring time intervals of a requested nag
      (nag.minutesAfterTheHour && (moment().minutes() === nag.minutesAfterTheHour))    // or it is one of the number of minutes after the hour
    )
  );
};

const sendNags = async() => {
  // console.log('sendNags');
  const allNags = await getAllNags();
  console.log(moment().hours() + ':' + moment().minutes());
  const nagsToSend = [];
  allNags.forEach(nag => {
    if(!nag.complete
      && nag.pushApiKey
      && nag.pushApiKey.length === 30
      && isTimeForNag(nag))
      nagsToSend.push(nag);
  });
  
  // combine simultaneous nags
  const messagesObj = nagsToSend.reduce((acc, cur) => {
    const html = `${ cur.task }&nbsp;&nbsp;<a href="https://nagmeapp.com/api/complete/${cur.completeId}">☑</a>\n\n`;
    acc[cur.pushApiKey] ? 
      acc[cur.pushApiKey] += html :
      acc[cur.pushApiKey] = html;
    return acc;
  }, {});

  //WILL NEED FURTHER LOGIC ONCE RECEIVING DEVICES CAN BE TARGETED

  Object.entries(messagesObj).forEach(async message => {
    try {
      const url = 'https://api.pushover.net/1/messages.json';
      return await fetchWithError(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: process.env.PUSHOVER_TOKEN,
          html: 1,
          user: message[0],
          message: message[1]
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
  // Is the probability for rain greater than 40%?
  if(rainProbability > .4){
    const umbrellaNags = await rainIds();
    umbrellaNags.forEach(async nag => {
      if(
        nag.push_api_key
        && nag.push_api_key.length === 30) {
        try {
          const url = 'https://api.pushover.net/1/messages.json';
          return await fetchWithError(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              token: process.env.PUSHOVER_TOKEN,
              user: nag.push_api_key,
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
exports.umbrellaCheck = umbrellaCheck;
exports.sendNags = sendNags;
exports.updateRecurNags = updateRecurNags;
