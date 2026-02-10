import { gql } from 'graphql-request';

export const OUTLINE_FRAMEWORKS_QUERY = gql`
  query GetOutlineFrameworks($user: String!) {
    getOutlineFrameworks(user: $user) {
      _id
      id
      user
      name
      imageUrl
      format {
        format_id
        name
        steps {
          step_id
          name
          number
          act
          instructions
        }
      }
    }
  }
`;
