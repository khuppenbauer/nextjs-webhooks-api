const axios = require('axios');
const path = require('path');
const featureService = require('../../services/feature');
const coordinatesLib = require('../../libs/coordinates');

const parseData = async (event) => {
  const body = event.body;
  const { url } = body;
  const { name } = path.parse(url);
  const geoJson = await coordinatesLib.toGeoJson(await (await axios.get(url)).data, name);
  await geoJson.features.reduce(async (lastPromise, feature) => {
    const accum = await lastPromise;
    const featureCollection = {
      features: [
        feature,
      ],
      type: 'FeatureCollection',
    };
    await featureService.create(event, featureCollection, name, 'poi');
    return [...accum, {}];
  }, Promise.resolve([]));
};

export default async function handler(req, res) {
  if (req.method === 'POST') {
    await parseData(req);
    res.statusCode = 200;
    res.send('Ok')
  }
  res.statusCode = 405;
  res.send('Method Not Allowed')
};
