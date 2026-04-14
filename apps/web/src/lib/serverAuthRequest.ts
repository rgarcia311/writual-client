"use server";

import { cookies } from "next/headers";
import { request } from "graphql-request";

const GRAPHQL_ENDPOINT =
  process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || "http://localhost:8080";

export async function serverAuthRequest<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const jar = await cookies();
  const token = jar.get("firebase-token")?.value;
  return request<T>(
    GRAPHQL_ENDPOINT,
    query,
    variables,
    token ? { Authorization: `Bearer ${token}` } : undefined
  );
}
