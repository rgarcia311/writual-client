import { gql } from 'graphql-request';

export const CREATE_OUTLINE_FRAMEWORK = gql`
  mutation CreateOutlineFramework($input: OutlineFrameworkInput!) {
    createOutlineFramework(input: $input) {
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

export const UPDATE_OUTLINE_FRAMEWORK = gql`
  mutation UpdateOutlineFramework($id: String!, $input: OutlineFrameworkInput!) {
    updateOutlineFramework(id: $id, input: $input) {
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

export const DELETE_OUTLINE_FRAMEWORK = gql`
  mutation DeleteOutlineFramework($id: String!) {
    deleteOutlineFramework(id: $id)
  }
`;
