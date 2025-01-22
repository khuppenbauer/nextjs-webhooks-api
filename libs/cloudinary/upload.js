const dotenv = require('dotenv').config();
const path = require('path');
const cloudinary = require('cloudinary').v2;
const mongoose = require('mongoose');
const db = require('../../database/mongodb');
const File = require('../../models/file');
const dropboxLib = require('../dropbox');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

module.exports = async (data) => {
  const {
    _id,
    externalUrl,
    path_display: pathDisplay,
    foreignKey,
    folder, 
    extension,
    source,
  } = data;
  const { dir, name } = path.parse(pathDisplay);
  const publicId = `${dir.replace(/\//, '')}/${name}`;
  let upload;
  if (externalUrl) {
    upload = externalUrl;
  } else {
    const { mimeType } = data;
    const type = 'binary';
    const file = await dropboxLib.download(foreignKey, type);
    const base64Image = Buffer.from(file, 'binary').toString('base64');
    upload = `data:${mimeType};base64,${base64Image}`;
  }
  const res = await cloudinary.uploader.upload(upload,
    {
      public_id: publicId,
    }
  );
  const { secure_url: secureUrl } = res;
  await File.findByIdAndUpdate(_id, { url: secureUrl, status: 'deployed' });
  return {
    ...res,
    folder,
    extension,
    source,
    name,
    url: secureUrl
  };
};
