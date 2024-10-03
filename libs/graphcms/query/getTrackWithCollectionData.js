const { gql } = require('graphql-request');

module.exports = async () => {
  return gql`
    query gettrackwithcollectiondata($id: ID!) {
      track(where: { id: $id }) {
        collection {
          id
          name
          geoJson
          maxCoords {
            latitude
            longitude
          }
          minCoords {
            latitude
            longitude
          }
          subCollection {
            name
            collectionTypes {
              name
            }
          }
          collectionTypes {
            name
          }
          tracks {
            name
          }
        }
        date
        difficulty
        distance
        elevHigh
        elevLow
        endCity
        endCountry
        endElevation
        endState
        experience
        fitness
        foreignKey
        name
        title
        overviewImageUrl
        previewImageUrl
        private
        slug
        startCity
        startCountry
        startElevation
        startState
        subtitle
        totalElevationGain
        totalElevationLoss
        endCoords {
          latitude
          longitude
        }
        startCoords {
          latitude
          longitude
        }
      }
    }
  `;
};
