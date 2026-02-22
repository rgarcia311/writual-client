import { gql } from "graphql-request";

export const PROJECT_CHARACTERS_QUERY = gql`
query GetProjectCharacters($input: ProjectFilters!) {
  getProjectData(input: $input) {
    _id
    characters {
      _id
      projectId
      name
      imageUrl
      details {
        version
        name
        gender
        age
        bio
        need
        want
      }
    }
  }
}
`;

