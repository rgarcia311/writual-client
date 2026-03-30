'use client';

import { auth } from '@/lib/firebase';
import { request } from 'graphql-request';
import { GRAPHQL_ENDPOINT } from '@/lib/config';

export async function authRequest<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  return request<T>(
    GRAPHQL_ENDPOINT,
    query,
    variables,
    token ? { Authorization: `Bearer ${token}` } : undefined
  );
}
