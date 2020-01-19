// IMPORT MODULES under test here:
const { getIdString } = require('../node-utils/getIdString.js');

const test = QUnit.test; //eslint-disable-line

test('pseudo random generator should return a string of specified length', assert => {
  const expected = 30;
  const actual = getIdString(30).length;
  assert.equal(actual, expected);
});
