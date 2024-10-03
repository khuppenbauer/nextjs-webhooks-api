const dotenv = require('dotenv').config();
const mongoose = require('mongoose');
const algoliasearch = require('algoliasearch');
const db = require('../../database/mongodb');
const Track = require('../../models/track');

const applicationID = process.env.ALGOLIA_APPLICATION_ID;
const adminAPIKey = process.env.ALGOLIA_ADMIN_API_KEY;
const indexName = 'tracks';

module.exports = async (id) => {
  const record = await Track.findById(id);
  const {
    name,
    title,
    slug,
    date,
    distance,
    totalElevationGain,
    totalElevationLoss,
    elevLow,
    elevHigh,
    startElevation,
    endElevation,
    startCity,
    startCountry,
    startState,
    endCity,
    endState,
    endCountry,
    previewImageUrl,
    overviewImageUrl,
    geoJson,
    trackCollection: collection,
    difficulty,
    fitness,
    experience,
    private: privateTrack,
  } = record;
  const { geometry } = geoJson.features[0];
  const { coordinates, type: geoJsonType } = geometry;
  const geoLoc = coordinates.map((coordinate) => ({ lat: coordinate[1], lng: coordinate[0] }));
  const client = algoliasearch(applicationID, adminAPIKey);
  const index = client.initIndex(indexName);
  const object = {
    objectID: id,
    name,
    title,
    slug,
    date: new Date(date).getTime() / 1000,
    distance,
    totalElevationGain,
    totalElevationLoss,
    elevLow,
    elevHigh,
    startElevation,
    endElevation,
    startCity,
    startCountry,
    startState,
    endCity,
    endState,
    endCountry,
    previewImageUrl,
    overviewImageUrl,
    _geoloc: geoLoc,
    difficulty,
    fitness,
    experience,
    private: privateTrack,
  };
  let hierarchicalCategories = {};
  if (startCity && startState && startCountry && endCity && endCountry && endState) {
    hierarchicalCategories = {
      'hierarchicalCategories.lvl0': [
        startCountry,
        endCountry,
      ],
      'hierarchicalCategories.lvl1': [
        `${startCountry} > ${startState}`,
        `${endCountry} > ${endState}`,
      ],
      'hierarchicalCategories.lvl2': [
        `${startCountry} > ${startState} > ${startCity}`,
        `${endCountry} > ${endState} > ${endCity}`,
      ],
    };
  }
  let collectionCategories = {};
  const collectionLvl0 = [];
  const collectionLvl1 = [];
  const collectionLvl2 = [];
  if (collection && collection.length > 0) {
    collection.forEach((collectionItem) => {
      const { name, collectionTypes, subCollection } = collectionItem;
      collectionLvl0.push(collectionTypes.name);
      collectionLvl1.push(`${collectionTypes.name} > ${name}`);
      collectionLvl2.push(`${collectionTypes.name} > ${name}`);
      if (subCollection.length > 0) {
        subCollection.forEach((subcollectionItem) => {
          const { name: subCollectionName, collectionTypes: subCollectionType } = subcollectionItem;
            collectionLvl0.push(subCollectionType.name);
            collectionLvl1.push(`${subCollectionType.name} > ${subCollectionName}`);
            collectionLvl2.push(`${subCollectionType.name} > ${subCollectionName} > ${name}`);
        });
      }
    });
    collectionCategories = {
      'collections.lvl0': collectionLvl0,
      'collections.lvl1': collectionLvl1,
      'collections.lvl2': collectionLvl2,
    };
  }
  await index
    .setSettings({
      attributesForFaceting: [
        'searchable(collections)',
        'searchable(collections.lvl0)',
        'searchable(collections.lvl1)',
        'searchable(collections.lvl2)',
        'searchable(date)',
        'searchable(distance)',
        'searchable(totalElevationGain)',
        'searchable(totalElevationLoss)',
        'searchable(hierarchicalCategories)',
        'searchable(hierarchicalCategories.lvl0)',
        'searchable(hierarchicalCategories.lvl1)',
        'searchable(hierarchicalCategories.lvl2)',
        'searchable(difficulty)',
        'searchable(fitness)',
        'searchable(experience)',
      ],
    })
    .catch((err) => {
      console.log([name, err]);
    });
  await index
    .saveObject({
      ...object,
      ...hierarchicalCategories,
      ...collectionCategories,
    })
    .then(({ objectID }) => {
      console.log(objectID);
    })
    .catch((err) => {
      console.log(err);
    });
  return true;
};
