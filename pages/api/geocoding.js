const mongoose = require('mongoose');
const db = require('../../database/mongodb');
const File = require('../../models/file');
const messages = require('../../methods/messages');
const filesLib = require('../../libs/files');
const coordinatesLib = require('../../libs/coordinates');

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
    const message = 'update_file';
    const record = await File.findById(body._id);
    const {
      dateTimeOriginal,
      path_display: pathDisplay,
      _id: id,
    } = record;
    if (dateTimeOriginal) {
      const coordinate = await coordinatesLib.geocoding(dateTimeOriginal);
      if (coordinate) {
        const coords = {
          lat: coordinate[1],
          lon: coordinate[0],
        };
        await File.findByIdAndUpdate(id, { coords });
        const messageObject = {
          ...event,
          body: { _id: id, path_display: pathDisplay },
        };
        await messages.create(messageObject, { foreignKey: pathDisplay, app: 'messageQueue', event: message });
        await filesLib.feature(event, body, coordinate);
      }
    }
    res.statusCode = 200;
    res.send('Ok')
  }
  res.statusCode = 405;
  res.send('Method Not Allowed')
};
