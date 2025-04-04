const mongoose = require('mongoose');
const db = require('../../database/mongodb');
const Feature = require('../../models/feature');

const filteredResult = async (event) => {
  let result;
  try {
    result = await Feature.find(event.body);
  } catch (err) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: err.message,
      }),
    };
  }
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(result),
  };
};

module.exports = async (event) => {
  return filteredResult(event);
};
