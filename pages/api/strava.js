const Feature = require('../../models/feature');
const strava = require('../../services/strava');
const messages = require('../../methods/messages');

const processSegments = async (event, message, segmentEfforts, parseSegments, saveSegmentsGpx) => {
  await segmentEfforts.reduce(async (lastPromise, segmentEffort) => {
    const accum = await lastPromise;
    const { segment } = segmentEffort;
    const { id: foreignKey } = segment;
    const existing = await Feature.find({ foreignKey });
    if (existing.length === 0) {
      if (parseSegments) {
        await strava.segment(event, segment, saveSegmentsGpx);
      } else {
        const messageData = {
          foreignKey,
          app: 'strava',
          event: message,
        };
        const messageObject = {
          ...event,
          body: JSON.stringify(segment),
        };
        await messages.create(messageObject, messageData);
      }
    }
    return [...accum, {}];
  }, Promise.resolve([]));
};

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const {
      action, includeSegments, parseSegments, saveSegmentsGpx, dropboxSync,
    } = req.query;
    if (action === 'activity') {
      const message = 'save_activity';
      const activityData = await strava.activity(req, message);
      if (includeSegments === 'true') {
        const { segment_efforts: segmentEfforts } = activityData;
        await processSegments(req, 'parse_segments', segmentEfforts, parseSegments, saveSegmentsGpx);
      }
      if (dropboxSync === 'true') {
        await strava.photos(req, 'save_photos', dropboxSync);
      }
    } else if (action === 'photos') {
      await strava.photos(req, 'save_photos', dropboxSync);
    } else if (action === 'create') {
      await strava.create(req, 'create_activity');
    } else if (action === 'segment') {
      const segment = req.body;
      await strava.segment(req, segment, saveSegmentsGpx);
    }
    res.statusCode = 200;
    res.send('Ok')
  }
  res.statusCode = 405;
  res.send('Method Not Allowed')
}
