const track = require('../../services/track');

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
    const { action } = query;
    if (action === 'create') {
      const message = 'create_track';
      await track.create(event, message);
    } else if (action === 'image') {
      const message = 'create_static_image';
      await track.image(event, message);
    } else if (action === 'upload') {
      const message = 'update_track';
      await track.upload(event, message);
    }
    res.statusCode = 200;
    res.send('Ok')
  }
  res.statusCode = 405;
  res.send('Error when converting file')
}
