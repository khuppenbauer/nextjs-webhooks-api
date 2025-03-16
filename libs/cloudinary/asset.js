const dotenv = require('dotenv').config();
const { GraphQLClient } = require('graphql-request');
const mongoose = require('mongoose');
const db = require('../../database/mongodb');
const File = require('../../models/file');
const Track = require('../../models/track');
const mongodb = require('../mongodb');
const graphcmsMutation = require('../graphcms/mutation');
const update = require('./update');
const upload = require('./upload');

const url = process.env.GRAPHCMS_API_URL;
const token = process.env.GRAPHCMS_API_TOKEN;

const graphcms = new GraphQLClient(
  url,
  {
    headers: {
      authorization: `Bearer ${token}`,
    },
  },
);

const getTracks = async (record) => {
  const { dateTimeOriginal, coords } = record;
  let tracks;
  if (dateTimeOriginal) {
    tracks = await mongodb.trackByDate(dateTimeOriginal);
  } else if (coords) {
    const { lat, lon } = coords;
    const geometry = { type: 'Point', coordinates: [lon, lat] };
    tracks = await mongodb.trackByCoords(geometry);
  }
  return tracks;
}

const addImageToTrack = async (image, record) => {
  const tracks = await getTracks(record);
  if (tracks && tracks.length > 0) {
    await tracks.reduce(async (lastPromise, track) => {
      const accum = await lastPromise;
      const images = track.images || [];
      const { name } = track;
      images.push(image);
      await Track.findOneAndUpdate({ name }, { images });
      const mutation = await graphcmsMutation.UpdateTrackAddImage();
      const mutationVariables = {
        name,
        images
      };
      await graphcms.request(mutation, mutationVariables);
      return [...accum];
    }, Promise.resolve([]));
  }
}

module.exports = async (event, data) => {
  const { _id: file } = data;
  const record = await File.findById(file);
  const {
    name,
    path_display,
    folder,
    extension,
    coords,
    source,
  } = record;
  let assetUrl;
  let image;

  if (coords) {
    image = await update(record);
    assetUrl = image.secure_url;
  } else {
    image = await upload(data);
    assetUrl = image.secure_url;
  }

  await File.findByIdAndUpdate(file, { url: assetUrl, status: 'deployed' });
  if (coords && image) {
    await addImageToTrack(image, record);
  }
  return {
    name,
    path_display,
    url: assetUrl,
    folder,
    extension,
    source,
  };
};
