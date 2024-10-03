const track = require('../../services/track');

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { action } = req.query;
    if (action === 'create') {
      const message = 'create_track';
      await track.create(req, message);
    } else if (action === 'image') {
      const message = 'create_static_image';
      await track.image(req, message);
    } else if (action === 'upload') {
      const message = 'update_track';
      await track.upload(req, message);
    }
    res.statusCode = 200;
    res.send('Ok')
  }
  res.statusCode = 405;
  res.send('Error when converting file')
}
