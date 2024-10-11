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
          body: segment,
        };
        await messages.create(messageObject, messageData);
      }
    }
    return [...accum, {}];
  }, Promise.resolve([]));
};

export default async function handler(req, res) {
  const { headers, method, url, query, body } = req;
  const event = {
    headers,
    httpMethod: method, 
    path: url,
    queryStringParameters: query,
    body
  };
  if (method === 'POST') {
    const {
      action, includeSegments, parseSegments, saveSegmentsGpx, dropboxSync,
    } = query;
    if (action === 'activity') {
      const message = 'save_activity';
      const activityData = await strava.activity(event, message);
      if (includeSegments === 'true') {
        const { segment_efforts: segmentEfforts } = activityData;
        await processSegments(event, 'parse_segments', segmentEfforts, parseSegments, saveSegmentsGpx);
      }
      if (dropboxSync === 'true') {
        await strava.photos(event, 'save_photos', dropboxSync);
      }
    } else if (action === 'photos') {
      await strava.photos(event, 'save_photos', dropboxSync);
    } else if (action === 'create') {
      await strava.create(event, 'create_activity');
    } else if (action === 'segment') {
      const segment = body;
      await strava.segment(event, segment, saveSegmentsGpx);
    }
    res.statusCode = 200;
    res.send('Ok')
  }
  res.statusCode = 405;
  res.send('Method Not Allowed')
}
