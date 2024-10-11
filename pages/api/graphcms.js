const messages = require('../../methods/messages');
const graphcms = require('../../libs/graphcms');
const Track = require('../../models/track');
const Feature = require('../../models/feature');

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
    const { type, action } = query;
    const data = body;
    let message;
    let result;
    if (type === 'track') {
      message = `${action}_track`;
      result = await graphcms.track(event, data, action);
    } else if (type === 'file') {
      result = await graphcms.asset(event, data);
      const { folder, extension, source, url, name } = result;
      const dir = folder.replace('/', '');
      const { foreignKey } = source;
      const filter = { name: foreignKey };
      if (folder === '/images') {
        const feature = await Feature.findOne({ name });
        if (feature) {
          const { _id, meta: metaData } = feature;
          const meta = {
            ...metaData,
            url,
          };
          await Feature.findByIdAndUpdate(_id, { meta } );
          const messageObject = {
            ...event,
            body: {
              _id,
            },
          };
          await messages.create(messageObject, { foreignKey: data.path_display, app: 'graphcms', event: 'update_image_image_feature' });
        }
      }
      let update;
      if (folder === '/tracks') {
        if (extension === 'gpx') {
          update = { gpxFileUrl: url };
        } else if (extension === 'json') {
          update = { geoJsonFileUrl: url };
        }
      } else if (folder === '/convert/gpx') {
        update = { gpxFileSmallUrl: url };
      }
      await Track.findOneAndUpdate(filter, update);
      message = `upload_${dir}_${extension}_file`;
    } else if (type === 'segment') {
      message = 'add_segment';
      result = await graphcms.trail(event, data);
    } else if (type === 'collection') {
      message = 'update_collection';
      result = await graphcms.collection(event, data);
    }
    if (result) {
      const messageObject = {
        ...event,
        body: result,
      };
      await messages.create(messageObject, { foreignKey: data.path_display, app: 'graphcms', event: message });
    }
    res.statusCode = 200;
    res.send('Ok')
  }
  res.statusCode = 405;
  res.send('Method Not Allowed')
};
