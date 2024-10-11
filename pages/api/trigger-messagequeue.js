const mongoose = require('mongoose');
const axios = require('axios');
const db = require('../../database/mongodb');
const Subscription = require('../../models/subscription');
const Message = require('../../models/message');
const messages = require('../../methods/messages');
const request = require('../../services/request');

const executeSubscriptions = async (event, subscription, data) => {
  let status;
  const message = data.message !== undefined ? data.message : [];
  const startTime = new Date().getTime();
  try {
    const body = {
      ...data.body,
      message: data._id,
    };
    const { url } = subscription;
    const res = await axios.post(url, body);
    await request.log(res, startTime);
    console.log(['trigger', url, res.status]);
    status = 'success';
    message.push({
      subscription,
      status: res.status,
      res: res.data,
    });
  } catch (error) {
    status = 'error';
    const messageObject = {
      ...event,
      body: { status, statusText: error.message },
    };
    console.log(['trigger-error', subscription, error]);
    await request.log(error.response, startTime);
    await messages.update(messageObject, data._id);
    throw error;
  }
  const messageObject = {
    ...event,
    body: { status, message },
  };
  await messages.update(messageObject, data._id);
};

const executeMessage = async (event, data) => {
  const subscriptionQuery = {
    active: true,
    app: data.app,
    event: data.event,
  };
  const subscriptions = await Subscription.find(subscriptionQuery);
  if (subscriptions.length === 0) {
    const messageObject = {
      ...event,
      body: { status: 'success' },
    };
    await messages.update(messageObject, data._id);
  }
  await subscriptions.reduce(async (lastPromise, subscription) => {
    const accum = await lastPromise;
    await executeSubscriptions(event, subscription, data);
    return [...accum, {}];
  }, Promise.resolve([]));
};

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { fullDocument } = req.body;
    const data = JSON.parse(fullDocument);
    await executeMessage(req, data);
    res.statusCode = 200;
    res.send('Ok')
  }
  res.statusCode = 405;
  res.send('Method Not Allowed')
};
