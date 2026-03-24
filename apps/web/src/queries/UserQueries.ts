import { gql } from 'graphql-request';

export const ME_QUERY = gql`
  query Me($displayName: String, $name: String) {
    me(displayName: $displayName, name: $name) {
      uid
      name
      displayName
      tier
      settings { colorMode }
    }
  }
`;
