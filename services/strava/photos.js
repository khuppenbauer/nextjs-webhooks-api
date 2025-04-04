const dotenv = require('dotenv').config();
const mongoose = require('mongoose');
const db = require('../../database/mongodb');
const Activity = require('../../models/activity');
const activities = require('../../methods/activities');
const messages = require('../../methods/messages');
const stravaLib = require('../../libs/strava');

const processPhotos = async (event, foreignKey, dropboxSync) => {
  const existingActivities = await Activity.find({
    foreignKey,
  });
  let type;
  let activityId;
  if (existingActivities.length === 0) {
    type = 'create';
    activityId = mongoose.Types.ObjectId();
  } else {
    type = 'update';
    activityId = existingActivities[0]._id;
  }
  const photos = await stravaLib.photos(event, activityId, foreignKey, dropboxSync);
  const activity = {
    photos,
    foreignKey,
    _id: activityId,
  };

  if (type === 'create') {
    await activities.create(activity);
  } else {
    await activities.update(activity, activityId);
  }
}

module.exports = async (event, message, dropboxSync) => {
  const { object_id: foreignKey } = event.body;
  await processPhotos(event, foreignKey, dropboxSync);
  await messages.create(event, { foreignKey, app: 'strava', event: message });
};
