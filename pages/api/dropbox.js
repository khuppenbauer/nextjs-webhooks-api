const axios = require('axios');
const File = require('../../models/file');
const Feature = require('../../models/feature');
const dropbox = require('../../services/dropbox');

const processEntries = async (event, message, entries) => {
  await Object.values(entries).reduce(async (lastPromise, entry) => {
    const accum = await lastPromise;
    const { tag } = entry;
    if (tag === 'file') {
      const messageObject = {
        ...event,
        body: entry,
      };
      await dropbox.sync(messageObject, message);
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
    const syncMessage = 'create_file';
    const entries = await dropbox.list(event);
    const entriesObject = JSON.parse(JSON.stringify(entries[0]).replace(/\.tag/gi, 'tag'));
    await processEntries(event, syncMessage, entriesObject);
    res.statusCode = 200;
    res.send('Ok')
  }
  res.statusCode = 405;
  res.send('Method Not Allowed')
};
