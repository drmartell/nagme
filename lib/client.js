require('dotenv').config();

const
  Client = require('pg').Client,
  DATABASE_URL = process.env.DATABASE_URL,
  client = new Client(DATABASE_URL); // note: you will need to create the database prior to first run!

client.connect()
  .then(() => console.log('connected to db', DATABASE_URL)) // eslint-disable-line no-console
  .catch(err => console.error('connection error', err)); // eslint-disable-line no-console

client.on('error', err => {
  console.error('\n**** DATABASE ERROR ****\n\n', err); // eslint-disable-line no-console
});

// export so other modules (files) can use
module.exports = client;
