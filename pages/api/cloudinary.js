const Track = require('../../models/track');
const Feature = require('../../models/feature');
const messages = require('../../methods/messages');
const features = require('../../methods/features');
const cloudinary = require('../../libs/cloudinary');

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
    const message = 'upload_cloudinary_image';
    const { folder, source } = body;
    const { foreignKey } = source;
    const result = await cloudinary.upload(body);
    const { secure_url: url } = result;
    const filter = { name: foreignKey };
    const track = await Track.findOne(filter);
    const { _id: trackId } = track;
    let update;
    if (folder === '/preview') {
      update = { previewImageUrl: url };
    } else if (folder === '/overview') {
      update = { overviewImageUrl: url };
    }
    if (update) {
      await Track.findByIdAndUpdate(trackId, update);
      const feature = await Feature.findOne({ foreignKey: trackId });
      const { _id, meta: metaData } = feature;
      const meta = {
        ...metaData,
        ...update,
      };
      const featureObject = {
        ...event,
        body: { ...feature._doc, meta },
      };
      await features.update(featureObject, _id);
    }
    if (result) {
      const messageObject = {
        ...event,
        body: result,
      };
      await messages.create(messageObject, { foreignKey, app: 'messageQueue', event: message });
    }
    res.statusCode = 200;
    res.send('Ok')
  }
  res.statusCode = 405;
  res.send('Method Not Allowed')
};
