import { gql } from 'graphql-request';

export const ME_QUERY = gql`
  query Me($displayName: String, $name: String) {
    me(displayName: $displayName, name: $name) {
      uid
      name
      displayName
      tier
      settings { colorMode statTilePreferences }
    }
  }
`;

/** Stat-tile visibility only — refetched after a toggle without re-running the login display-name sync. */
export const STAT_TILE_PREFERENCES_QUERY = gql`
  query StatTilePreferences {
    me {
      uid
      settings { statTilePreferences }
    }
  }
`;
