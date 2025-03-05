const dotenv = require('dotenv').config();
const path = require('path');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

module.exports = async (data) => {
  const {
    path_display: pathDisplay,
    coords,
  } = data;
  const { dir, name } = path.parse(pathDisplay);
  const publicId = `${dir.replace(/\//, '')}/${name}`;
  const { lat, lon } = coords;
  const res = await cloudinary.api.update(publicId,
    {
      context: `lat=${lat}|lon=${lon}`
    }
  );
  return res;
};
