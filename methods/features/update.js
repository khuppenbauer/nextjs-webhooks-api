const mongoose = require('mongoose');
const db = require('../../database/mongodb');
const Feature = require('../../models/feature');
const Message = require('../../models/message');
const messages = require('../messages');

module.exports = async (event, id) => {
  const { body: feature } = event;
  const { foreignKey, source, type } = feature;

  try {
    await Feature.findByIdAndUpdate(id, feature);
    const messageObject = {
      ...event,
      body: { _id: id },
    };
    const messageData = {
      foreignKey,
      app: 'messageQueue',
      event: `update_${source}_${type}_feature`,
    };
    await messages.create(messageObject, messageData);
  } catch (err) {
    console.log(err);
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
    body: JSON.stringify(feature),
  };
};
