const dotenv = require('dotenv').config();
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
  if (method === 'GET') {
    // Your verify token. Should be a random string.
    const VERIFY_TOKEN = process.env.STRAVA_VERIFY_TOKEN;
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];
    // Checks if a token and mode is in the query string of the request
    if (mode && token) {
      // Verifies that the mode and token sent are valid
      if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        // Responds with the challenge token from the request
        console.log('WEBHOOK_VERIFIED');
        await logs.create(event, { startTime, status: 200 });
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify({ 'hub.challenge': challenge }))
      }
      // Responds with '403 Forbidden' if verify tokens do not match
      res.statusCode = 403;
      res.send('Forbidden')
    }
    // Responds with '403 Forbidden' if verify tokens do not match
    res.statusCode = 403;
    res.send('Forbidden')
  }
  if (method === 'POST') {
    const { object_id: foreignKey, aspect_type: aspectType, object_type: objectType } = body;
    await logs.create(event, { startTime, status: 200 });
    const result = await messages.create(event, { foreignKey, app: 'strava', event: `${aspectType}_${objectType}` });
    res.statusCode = result.statusCode;
    res.headers = new Headers(result.headers);
    res.send(result.body);
  }
  res.statusCode = 405;
  res.send('Method Not Allowed')
};
