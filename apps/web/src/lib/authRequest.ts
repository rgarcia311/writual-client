'use client';

import { getFirebaseAuth } from '@/lib/firebase';
import { request } from 'graphql-request';
import { GRAPHQL_ENDPOINT } from '@/lib/config';

export async function authRequest<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const auth = getFirebaseAuth();
  // Firebase restores a persisted session asynchronously, so `currentUser` is null for the first
  // moments after a page load. Without this wait, anything that fires on mount (rather than from a
  // user click) would send no Authorization header and come back "Unauthorized".
  await auth.authStateReady();
  const token = await auth.currentUser?.getIdToken();
  return request<T>(
    GRAPHQL_ENDPOINT,
    query,
    variables,
    token ? { Authorization: `Bearer ${token}` } : undefined
  );
}
