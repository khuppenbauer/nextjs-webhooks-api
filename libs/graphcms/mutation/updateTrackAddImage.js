const { gql } = require('graphql-request');

module.exports = async () => {
  return gql`
    mutation UpdateTrack(
      $name: String!,
      $images: [Json!],
    ) {
      updateTrack(
        where: { name: $name }
        data: {
          images: $images
        }
      ) {
        id
        name
        images
      }
    }
  `;
};
