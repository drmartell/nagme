// make sure .env has been loaded
require('dotenv').config();

const Client = require('pg').Client;

const DATABASE_URL = process.env.DATABASE_URL;

// note: you will need to create the database prior to first run!
const client = new Client(DATABASE_URL);

client.connect()
  .then(() => console.log('connected to db', DATABASE_URL)) // eslint-disable-line no-console
  .catch(err => console.error('connection error', err)); // eslint-disable-line no-console

// listen for errors on the connection and log them
client.on('error', err => {
  console.error('\n**** DATABASE ERROR ****\n\n', err); // eslint-disable-line no-console
});

// export so other modules (files) can use
module.exports = client;
