const dotenv = require('dotenv').config();
const crypto = require("crypto");
const messages = require('../../methods/messages');
const logs = require('../../methods/logs');

export default async function handler(req, res) {
  const { headers, method, url, query, body } = req;
  const event = {
    headers,
    httpMethod: method, 
    path: url,
    queryStringParameters: query,
    body
  };
  const startTime = new Date().getTime();
  if (event.httpMethod === 'GET') {
    await logs.create(event, { startTime, status: 200 });
    res.statusCode = 200;
    res.headers = new Headers({
      'Content-Type': 'text/plain',
      'X-Content-Type-Options': 'nosniff'
    });
    res.send(query.challenge);
  } 
  if (method === 'POST') {    
    const VERIFY_SIGNATURE = process.env.DROPBOX_SIGNATURE;
    const signature = headers['x-dropbox-signature'];
    if (VERIFY_SIGNATURE === signature) {
      const foreignKey = crypto.randomUUID();
      await logs.create(event, { startTime, status: 200 });
      const result = await messages.create(event, { foreignKey, app: 'dropbox', event: 'changes' });
      res.statusCode = result.statusCode;
      res.headers = new Headers(result.headers);
      res.send(result.body);
    }
    res.statusCode = 403;
    res.send('Forbidden');
  }
  res.statusCode = 405;
  res.send('Method Not Allowed')
};
