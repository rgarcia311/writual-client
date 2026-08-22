import { gql } from 'graphql-request';

export const SET_STAT_TILE_PREFERENCE = gql`
  mutation SetStatTilePreference($page: String!, $statKeys: [String!]!) {
    setStatTilePreference(page: $page, statKeys: $statKeys)
  }
`;

export const CLEAR_STAT_TILE_PREFERENCE = gql`
  mutation ClearStatTilePreference($page: String!) {
    clearStatTilePreference(page: $page)
  }
`;

export const SET_WALKTHROUGH_DISMISSED = gql`
  mutation SetWalkthroughDismissed($dismissed: Boolean!) {
    setWalkthroughDismissed(dismissed: $dismissed)
  }
`;
