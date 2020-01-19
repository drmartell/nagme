// Load Environment Variables from the .env file
require('dotenv').config();

// address Phusion settings re: multiple listen statements
// https://www.phusionpassenger.com/library/indepth/nodejs/reverse_port_binding.html
if(typeof(PhusionPassenger) !== 'undefined')
    PhusionPassenger.configure({ autoInstall: false }); // eslint-disable-line

// Application Dependencies
const
  express = require('express'),
  cors = require('cors'),
  morgan = require('morgan'),
  client = require('./lib/client'),
  Cron = require('cron').CronJob,
  handleNag = require('./cron/handle-nags'),
  sendNags = handleNag.sendNags,
  updateRecurNags = handleNag.updateRecurNags,
  umbrellaCheck = handleNag.umbrellaCheck,
  { getIdString } = require('./node-utils/getIdString'),
  Cryptr = require('cryptr'),
  cryptr = new Cryptr(process.env.CRYPTR_KEY);

// Auth
const
  ensureAuth = require('./lib/auth/ensure-auth'),
  createAuthRoutes = require('./lib/auth/create-auth-routes'),
  authRoutes = createAuthRoutes({
    selectUser(email) {
      return client.query(`
            SELECT id, push_api_send, email, password_hash, display_name as "displayName" 
            FROM users
            WHERE email = $1;
        `,
      [email]
      ).then(result => result.rows[0]);
    },
    insertUser(user, hash) {
      return client.query(`
            INSERT into users (push_api_receive, push_api_send, email, password_hash, display_name)
            VALUES ($1, $2, $3, $4)
            RETURNING id, push_api_receive as "pushApiKey", push_app_send as "pushAppKey", email, display_name as "displayName";
        `,
      [user.pushApiKey, user.pushAppKey, user.email, hash, user.displayName]
      ).then(result => result.rows[0]);
    }
  });

// Application Setup
const app = express();
const PORT = process.env.PORT;
app.use(morgan('dev')); // http logging
app.use(cors()); // enable CORS request
app.use(express.static('public')); // server files from /public folder
app.use(express.json()); // enable reading incoming json data

// setup authentication routes
app.use('/api/auth', authRoutes);

// everything that starts with "/api" below here requires an auth token!
app.use('/api', ensureAuth);

// API Routes
const logError = (res, err) => {
  console.log(err); // eslint-disable-line no-console
  res.status(500).json({ error: err.message || err });
};

// *** NAGS ***
app.post('/api/nags', async(req, res) => {
  const nag = req.body;
  try {
    const result = await client.query(`
        INSERT INTO nags (
            task,
            notes,
            start_time,
            end_time,
            interval,
            minutes_after_hour,
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
            user_id,
            id_string
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        RETURNING *;
    `,
    [cryptr.encrypt(nag.task),
      cryptr.encrypt(nag.notes),
      nag.startTime ? nag.startTime : '00:00:00',
      nag.endTime === '' ? null : nag.endTime,
      nag.interval ? nag.interval : 5,
      nag.minutesAfterHour === '' ? -1 : nag.minutesAfterHour,
      nag.snoozed,
      nag.period,
      nag.mon, nag.tue, nag.wed, nag.thu, nag.fri, nag.sat, nag.sun,
      nag.recurs, false,
      req.userId, getIdString(30)]);
    res.json({ ...result.rows[0], task: nag.task, notes: nag.notes });
  }
  catch(err) {
    logError(res, err);
  }
});

app.get('/api/nags', async(req, res) => {
  try {
    const result = await client.query(`
            SELECT
            id,
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
            id_string AS "idString"
            FROM nags
            WHERE user_id = $1;
            `,
    [req.userId]);
    const decryptedRows = result.rows.map(row =>
      ({ ...row, task: cryptr.decrypt(row.task), notes: cryptr.decrypt(row.notes) }));
    res.json(decryptedRows);
  }
  catch(err) {
    logError(res, err);
  }
});


app.get('/api/nags/:id', async(req, res) => {
  const id = req.params.id;
  try {
    const result = await client.query(`
            SELECT * FROM nags
            WHERE id = $1;
        `, [id]);
     
    //res.json(result.rows);
    res.json({ ...result.rows[0], task: cryptr.decrypt(result.rows[0].task), notes: cryptr.decrypt(result.rows[0].notes) });
  }
  catch(err) {
    logError(res, err);
  }
});

app.delete('/api/nags/:id', async(req, res) => {
  const id = req.params.id;
  try {
    const result = await client.query(`
            DELETE FROM nags
            WHERE id = $1
            RETURNING *;
        `, [id]);
        
    res.json(result.rows[0]);
  }
  catch(err) {
    logError(res, err);
  }
});

// Allow delete via GET for users to quickly remove
// completed tasks by following a link
app.get('/api/delete/:id', async(req, res) => {
  const id = req.params.id;
  try {
    const result = await client.query(`
            DELETE FROM nags
            WHERE id = $1
            RETURNING *;
        `, [id]);
        
    res.json(result.rows[0]);
  }
  catch(err) {
    logError(res, err);
  }
});

app.get('/api/complete/:id', async(req, res) => {
  const id = req.params.id;
  try {
    const result = await client.query(`
            UPDATE nags
            SET complete = TRUE
            WHERE id = $1
            RETURNING *;
        `, [id]);
        
    res.json(result.rows[0]);
    res.send('Marked Complete');
  }
  catch(err) {
    logError(res, err);
  }
});

// Cron to find and send nags every minute
sendNags();
new Cron('* * * * *', sendNags, null, true, 'America/Los_Angeles');
// Cron to reset recurring nags at midnight
new Cron('0 0 0 * * *', updateRecurNags, null, true, 'America/Los_Angeles');
// Cron for general nag to take your umbrella for your commute at 7:45am
new Cron('0 45 7 * * *', umbrellaCheck, null, true, 'America/Los_Angeles');
//new Cron('0 45 20 * * *', umbrellaCheck, null, true, 'America/Los_Angeles');

// address Phusion settings re: multiple listen statements
// this is specific to deployment on linux/cPanel/Phusion host
// https://www.phusionpassenger.com/library/indepth/nodejs/reverse_port_binding.html
// start UI server
if(typeof(PhusionPassenger) !== 'undefined')
  app.listen('passenger');
else
  app.listen(PORT, () => console.log('server running on PORT', PORT)); // eslint-disable-line no-console
