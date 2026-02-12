import { gql } from 'graphql-request';

export const DELETE_SCENE = gql`
  mutation DeleteScene($_id: String!, $sceneNumber: Int!) {
    deleteScene(_id: $_id, sceneNumber: $sceneNumber) {
      _id
      scenes {
        number
      }
    }
  }
`;

