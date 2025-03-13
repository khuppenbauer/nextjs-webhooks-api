const dotenv = require('dotenv').config();
const { GarminConnect } = require('garmin-connect');
const fs = require('fs').promises;
const axios = require('axios');

const username = process.env.GARMIN_CONNECT_USERNAME;
const password = process.env.GARMIN_CONNECT_PASSWORD;

export default async function handler(req, res) {
  const { body: { id, extension, url } } = req;

  const GCClient = new GarminConnect({
    username,
    password
  });
  await GCClient.login();

  const { data } = await axios.get(url);
  const tmpFile = `/tmp/${id}.${extension}`;
  await fs.writeFile(tmpFile, data, 'utf-8');
  await GCClient.uploadActivity(tmpFile, extension);
  await fs.unlink(tmpFile);
  res.statusCode = 200;
  res.send('Ok');
};
