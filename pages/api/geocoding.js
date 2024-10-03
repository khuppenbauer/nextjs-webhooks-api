const mongoose = require('mongoose');
const db = require('../../database/mongodb');
const File = require('../../models/file');
const messages = require('../../methods/messages');
const filesLib = require('../../libs/files');
const coordinatesLib = require('../../libs/coordinates');

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const message = 'update_file';
    const data = req.body
    const record = await File.findById(data._id);
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
          ...req,
          body: JSON.stringify({ _id: id, path_display: pathDisplay }),
        };
        await messages.create(messageObject, { foreignKey: pathDisplay, app: 'messageQueue', event: message });
        await filesLib.feature(req, data, coordinate);
      }
    }
    res.statusCode = 200;
    res.send('Ok')
  }
  res.statusCode = 405;
  res.send('Method Not Allowed')
};
