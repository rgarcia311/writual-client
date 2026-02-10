"use server";

import { request } from "graphql-request";
import { revalidatePath } from "next/cache";
import { GRAPHQL_ENDPOINT } from "@/lib/config";
import { DELETE_OUTLINE_FRAMEWORK } from "mutations/OutlineMutations";

/**
 * Deletes a user's outline framework by MongoDB `_id` (ObjectId string).
 * Returns the API's success message.
 */
export async function deleteOutlineFrameworkById(id: string): Promise<string> {
  if (!id || typeof id !== "string") {
    throw new Error("Outline framework id is required.");
  }

  const result = (await request(GRAPHQL_ENDPOINT, DELETE_OUTLINE_FRAMEWORK, { id })) as {
    deleteOutlineFramework?: string;
  };

  // Refresh any server-rendered consumers of this data.
  revalidatePath("/outlines");

  return result?.deleteOutlineFramework ?? "";
}

