const dotenv = require('dotenv').config();
const axios = require('axios');
const { GraphQLClient } = require('graphql-request');
const mongoose = require('mongoose');
const fs = require('fs');
const FormData = require('form-data');
const db = require('../../database/mongodb');
const File = require('../../models/file');
const Track = require('../../models/track');
const mongodb = require('../mongodb');
const dropboxLib = require('../dropbox');
const graphcmsMutation = require('./mutation');
const graphcmsQuery = require('./query');
const cloudinary = require('../cloudinary');

const url = process.env.GRAPHCMS_API_URL;
const token = process.env.GRAPHCMS_API_TOKEN;
const cdnUrl = process.env.GRAPHCMS_CDN_URL;
const cdnToken = process.env.GRAPHCMS_CDN_TOKEN;
const assetBaseUrl = process.env.GRAPHCMS_ASSET_BASE_URL
const hasTrails = false;

const graphcms = new GraphQLClient(
  url,
  {
    headers: {
      authorization: `Bearer ${token}`,
    },
  },
);

let cdn;
if (cdnUrl && cdnToken) {
  cdn = new GraphQLClient(
    cdnUrl,
    {
      headers: {
        authorization: `Bearer ${cdnToken}`,
      },
    },
  );
}

const uploadAssetStream = async (record, uploadUrl, uploadToken) => {
  const { foreignKey, name, mimeType } = record;
  const fileName = `/tmp/${name}`;
  const type = mimeType.startsWith('image') ? 'binary' : 'text';
  const data = await dropboxLib.download(foreignKey, type);
  await fs.promises.writeFile(fileName, data);
  const form = new FormData();
  form.append('fileUpload', fs.createReadStream(fileName));
  let res;
  try {
    res = await axios({
      method: 'post',
      url: `${uploadUrl}/upload`,
      headers: {
        Authorization: `Bearer ${uploadToken}`,
        ...form.getHeaders(),
      },
      data: form,
    });
  } catch (error) {
    throw error;
  }
  fs.promises.unlink(fileName);
  return res;
};

const uploadAsset = async (record) => {
  const { externalUrl, sha1, folder } = record;
  const query = await graphcmsQuery.getAsset();
  const queryVariables = {
    sha1,
  };
  let uploadUrl;
  let uploadToken;
  let queryRes;
  let res;
  if (folder !== '/images' && cdn) {
    uploadUrl = cdnUrl;
    uploadToken = cdnToken;
    queryRes = await cdn.request(query, queryVariables);
  } else {
    uploadUrl = url;
    uploadToken = token;
    queryRes = await graphcms.request(query, queryVariables);
  }
  const { asset: assetObj } = queryRes;
  if (!assetObj) {
    if (externalUrl) {
      try {
        res = await axios({
          method: 'post',
          url: `${uploadUrl}/upload`,
          headers: {
            Authorization: `Bearer ${uploadToken}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          data: `url=${encodeURIComponent(externalUrl)}`,
        });
      } catch (error) {
        throw error;
      }
    } else {
      res = await uploadAssetStream(record, uploadUrl, uploadToken);
    }
    return res.data;
  }
  return assetObj;
};

const updateAsset = async (asset, record) => {
  const { coords, folder, name } = record;
  const mutation = await graphcmsMutation.updateAsset();

  let mutationVariables = {
    ...record._doc,
    fileName: name,
    id: asset,
  };
  if (coords) {
    mutationVariables = {
      ...mutationVariables,
      location: {
        latitude: coords.lat,
        longitude: coords.lon,
      },
    };
  }
  if (folder !== '/images' && cdn) {
    return cdn.request(mutation, mutationVariables);
  }
  return graphcms.request(mutation, mutationVariables);
};

const publishAsset = async (asset, record) => {
  const { folder } = record;
  const mutation = await graphcmsMutation.publishAsset();
  const mutationVariables = {
    id: asset,
  };
  if (folder !== '/images' && cdn) {
    return cdn.request(mutation, mutationVariables);
  }
  return graphcms.request(mutation, mutationVariables);
};

const getTracks = async (record) => {
  const { dateTimeOriginal, coords } = record;
  let tracks;
  if (dateTimeOriginal) {
    tracks = await mongodb.trackByDate(dateTimeOriginal);
  } else if (coords) {
    const { lat, lon } = coords;
    const geometry = { type: 'Point', coordinates: [lon, lat] };
    tracks = await mongodb.trackByCoords(geometry);
  }
  return tracks;
}

const addImageToTrack = async (image, record) => {
  const tracks = await getTracks(record);
  if (tracks && tracks.length > 0) {
    await tracks.reduce(async (lastPromise, track) => {
      const accum = await lastPromise;
      const images = track.images || [];
      const { name } = track;
      images.push(image);
      await Track.findOneAndUpdate({ name }, { images });
      const mutation = await graphcmsMutation.UpdateTrackAddImage();
      const mutationVariables = {
        name,
        images
      };
      await graphcms.request(mutation, mutationVariables);
      return [...accum];
    }, Promise.resolve([]));
  }
}

const updateTrack = async (asset, record, mutation, variable) => {
  const { source } = record;
  if (source) {
    const { foreignKey } = source;
    if (foreignKey) {
      const mutationVariables = {
        ...variable,
        name: foreignKey,
      };
      await graphcms.request(mutation, mutationVariables);
    }
  }
  const tracks = getTracks(record);
  if (tracks && tracks.length > 0) {
    await tracks.reduce(async (lastPromise, track) => {
      const accum = await lastPromise;
      const { name } = track;
      const mutationVariables = {
        id: asset,
        name,
      };
      await graphcms.request(mutation, mutationVariables);
      return [...accum];
    }, Promise.resolve([]));
  }
};

const updateTrail = async (sha1, coords) => {
  const { lat, lon } = coords;
  const geometry = { type: 'Point', coordinates: [lon, lat] };
  const features = await mongodb.featureByCoords(geometry, 'segment');
  if (features.length > 0) {
    const mutation = await graphcmsMutation.updateTrailConnectAssets();
    await features.reduce(async (lastPromise, feature) => {
      const accum = await lastPromise;
      const { foreignKey } = feature;
      const mutationVariables = {
        sha1,
        foreignKey,
      };
      await graphcms.request(mutation, mutationVariables);
      return [...accum];
    }, Promise.resolve([]));
  }
};

module.exports = async (event, data) => {
  const { _id: file } = data;
  const record = await File.findById(file);
  const {
    name,
    path_display,
    folder,
    extension,
    coords,
    sha1,
    source,
  } = record;
  const asset = await uploadAsset(record);
  const { id: assetId, handle } = asset;
  let assetUrl = asset.url;
  let image;
  let mutation;
  let mutationVariables;

  if (coords) {
    image = await cloudinary.update(record);
    assetUrl = image.secure_url;
  } else {
    image = await cloudinary.upload(data);
    assetUrl = image.secure_url;
  }

  let fileUrl;
  if (assetUrl) {
    fileUrl = assetUrl;
  } else {
    fileUrl = `${assetBaseUrl}/${handle}`;
  }
  await File.findByIdAndUpdate(file, { url: fileUrl, status: 'deployed' });
  if (coords && image) {
    await addImageToTrack(image, record);
  }
  if (assetId) {
    const { updateAsset: res } = await updateAsset(assetId, record);
    if (folder === '/images') {
      if (coords) {
        if (hasTrails) {
          await updateTrail(sha1, coords);
        }
        mutation = await graphcmsMutation.upsertTrackConnectAssets('photos');
        mutationVariables = {
          id: assetId,
        };
      }
    } else {
      let property;
      if (folder === '/tracks') {
        if (extension === 'gpx') {
          property = 'gpxFile';
        } else if (extension === 'json') {
          property = 'geoJsonFile';
        }
      } else if (folder === '/convert/gpx') {
        property = 'gpxFileSmall';
      }
      if (!cdn) {
        mutation = await graphcmsMutation.upsertTrackConnectAsset(property);
        mutationVariables = {
          id: assetId,
        };
      }
    }
    if (mutation) {
      await updateTrack(assetId, record, mutation, mutationVariables);
    }
    await publishAsset(assetId, record);
    return {
      ...res,
      name,
      path_display,
      url: fileUrl,
      folder,
      extension,
      source,
    };
  }
};
