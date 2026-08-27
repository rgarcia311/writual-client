import { gql } from 'graphql-request';

export const REGISTER_PUSH_SUBSCRIPTION = gql`
  mutation RegisterPushSubscription($endpoint: String!, $p256dh: String!, $auth: String!, $userAgent: String) {
    registerPushSubscription(endpoint: $endpoint, p256dh: $p256dh, auth: $auth, userAgent: $userAgent)
  }
`;

export const UNREGISTER_PUSH_SUBSCRIPTION = gql`
  mutation UnregisterPushSubscription($endpoint: String!) {
    unregisterPushSubscription(endpoint: $endpoint)
  }
`;
