const algolia = require('../../libs/algolia');

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { type } = req.query;
    const data = req.body;
    const { _id } = data;
    if (type === 'feature') {
      await algolia.feature(_id);
    } else if (type === 'track') {
      await algolia.track(_id);
    }
    res.statusCode = 200;
    res.send('Ok')
  }
  res.statusCode = 405;
  res.send('Method Not Allowed')
};