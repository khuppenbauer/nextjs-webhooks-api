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
  if (method === 'POST') {
    await logs.create(event, { startTime, status: 200 });

    const messageObject = {
      ...event,
      body: (body.data),
    };
    const messageData = {
      foreignKey: body.foreignKey,
      app: body.app,
      event: body.event,
    };
    const result = await messages.create(messageObject, messageData);
    res.statusCode = result.statusCode;
    res.headers = new Headers(result.headers);
    res.send(result.body);
  }
  res.statusCode = 405;
  res.send('Method Not Allowed')
};
