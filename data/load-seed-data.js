const client = require('../lib/client');
const users = require('./seed-users');
const nags = require('./seed-nags');

run();

async function run() {
  try {
    await Promise.all(
      users.map(async user => {
        const result = await client.query(`
                    INSERT INTO users (
                        email, 
                        display_name, 
                        password_hash) 
                    VALUES ($1, $2, $3)
                    RETURNING *;
                `, 
        [user.email, user.displayName, user.passwordHash]);

        return result.rows[0];
      })
    );

    await Promise.all(
      nags.map(nag => {
        return client.query(`
                    INSERT INTO nags (
                        task,
                        notes,
                        start_time,
                        interval,
                        period,
                        user_id
                    )
                    VALUES ($1, $2, $3, $4, $5, $6);
                `,
        [nag.task, nag.notes, nag.startTime, nag.interval, nag.period, nag.userId]);   
      })
    );

    console.log('seed data load complete'); // eslint-disable-line
  }
  catch(err) { console.log(err); } // eslint-disable-line
  finally { client.end(); }
}
