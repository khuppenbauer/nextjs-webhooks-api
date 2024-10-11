const algolia = require('../../libs/algolia');

export default async function handler(req, res) {
  const { method, query, body } = req;
  if (method === 'POST') {
    const { type } = query;
    const { _id } = body;
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