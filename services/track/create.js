const mongoose = require('mongoose');
const path = require('path');
const axios = require('axios');
const dayjs = require('dayjs');
const geolib = require('geolib');
const db = require('../../database/mongodb');
const dropbox = require('../dropbox');
const coordinatesLib = require('../../libs/coordinates');
const files = require('../../methods/files');
const messages = require('../../methods/messages');
const tasks = require('../../methods/tasks');
const Track = require('../../models/track');

const saveGeoJson = async (name, geoJson, event) => {
  const filePath = `/tracks/${name}.json`;
  const source = {
    name: 'messageQueue',
    foreignKey: name,
    type: 'geoJson',
  };
  const metaData = {
    name: `${name}.json`,
    path_display: filePath,
    source,
  };
  await files.create(event, metaData);
  await dropbox.upload(geoJson, filePath);
  return filePath;
};

const getMetaData = async (feature) => {
  const { properties, geometry } = feature;
  const { coordinates } = geometry;
  const { time, coordTimes } = properties;
  const points = {
    points: coordinates,
  };
  const start = coordinates[0];
  const end = coordinates[coordinates.length - 1];
  const bounds = geolib.getBounds(coordinates);
  const distance = geolib.getPathLength(coordinates);
  const elevation = await coordinatesLib.elevation(coordinates);
  const startLocation = await coordinatesLib.location(start[1], start[0]);
  const endLocation = await coordinatesLib.location(end[1], end[0]);
  const { city: startCity, state: startState, country: startCountry } = startLocation;
  const { city: endCity, state: endState, country: endCountry } = endLocation;
  let dateTime = {};
  if (time && coordTimes) {
    dateTime = {
      date: time,
      startTime: coordTimes[0],
      endTime: coordTimes[coordTimes.length - 1],
    };
  }
  return {
    ...dateTime,
    distance,
    ...elevation,
    minCoords: {
      lat: parseFloat(bounds.minLat.toFixed(6)),
      lon: parseFloat(bounds.minLng.toFixed(6)),
    },
    maxCoords: {
      lat: parseFloat(bounds.maxLat.toFixed(6)),
      lon: parseFloat(bounds.maxLng.toFixed(6)),
    },
    startCoords: {
      lat: parseFloat(start[1].toFixed(2)),
      lon: parseFloat(start[0].toFixed(2)),
    },
    endCoords: {
      lat: parseFloat(end[1].toFixed(2)),
      lon: parseFloat(end[0].toFixed(2)),
    },
    startElevation: start[2] ? start[2].toFixed(0) : 0,
    endElevation: end[2] ? end[2].toFixed(0) : 0,
    startCity,
    startCountry,
    startState,
    endCity,
    endCountry,
    endState,
  };
};

const parseFeatures = async (geoJsonFeatures) => {
  const metaData = [];
  const coords = [];
  const features = [];
  await geoJsonFeatures.reduce(async (lastPromise, feature) => {
    const accum = await lastPromise;
    const meta = await getMetaData(feature);
    const { minCoords, maxCoords } = meta;
    coords.push(minCoords);
    coords.push(maxCoords);
    metaData.push(meta);
    feature.properties.distance = meta.distance;
    feature.properties.totalElevationGain = meta.totalElevationGain;
    feature.properties.totalElevationLoss = meta.totalElevationLoss;
    features.push(feature);
    return [...accum, {}];
  }, Promise.resolve([]));
  const mainData = metaData.reduce((prev, current) => {
    return (prev.distance > current.distance) ? prev : current;
  });
  const bounds = geolib.getBounds(coords);
  const data = {
    ...mainData,
    minCoords: {
      lat: parseFloat(bounds.minLat.toFixed(6)),
      lon: parseFloat(bounds.minLng.toFixed(6)),
    },
    maxCoords: {
      lat: parseFloat(bounds.maxLat.toFixed(6)),
      lon: parseFloat(bounds.maxLng.toFixed(6)),
    },
  };
  return {
    features,
    metaData: data,
  };
};

module.exports = async (event, message) => {
  const { body: data } = event;
  const { path_display: pathDisplay, url } = data;
  const { name } = path.parse(pathDisplay);
  const geoJsonData = await coordinatesLib.toGeoJson(await (await axios.get(url)).data, 'track');
  const geoJsonFeatures = geoJsonData.features.filter((feature) => feature.geometry.type === 'LineString');
  const { features, metaData } = await parseFeatures(geoJsonFeatures);
  const geoJson = {
    features,
    type: 'FeatureCollection',
  };
  const geoJsonFile = await saveGeoJson(name, geoJson, event);
  const existingTrack = await Track.find({
    gpxFile: pathDisplay,
  });
  const trackId = (existingTrack.length === 0) ? mongoose.Types.ObjectId() : existingTrack[0]._id;
  const track = {
    name,
    title: features[0].properties.name.trim(),
    slug: name.toLowerCase(),
    gpxFile: pathDisplay,
    gpxFileUrl: url,
    _id: trackId,
    ...metaData,
    geoJsonFile,
  };
  let trackObject;
  if (existingTrack.length === 0) {
    trackObject = await Track.create(track);
  } else {
    trackObject = await Track.findByIdAndUpdate(trackId, track);
  }
  const messageObject = {
    ...event,
    body: {
      ...trackObject._doc,
      name,
      gpxFile: pathDisplay,
      track: trackId,
      url,
    },
  };
  await messages.create(messageObject, {
    foreignKey: trackId,
    app: 'messageQueue',
    event: message,
  });
  await tasks.create(messageObject, {
    foreignKey: trackId,
    app: 'messageQueue',
    event: 'update_track',
    executionTime: dayjs().add(5, 'minute').format(),
  });
  await tasks.create(messageObject, {
    foreignKey: trackId,
    app: 'messageQueue',
    event: 'finish_track',
    executionTime: dayjs().add(7, 'minute').format(),
  });
};
