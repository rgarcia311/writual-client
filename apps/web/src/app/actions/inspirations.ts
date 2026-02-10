"use server";

import { request, gql } from "graphql-request";
import { revalidatePath } from "next/cache";
import { GRAPHQL_ENDPOINT } from "@/lib/config";

const CREATE_INSPIRATION = gql`
  mutation Createinspiration($input: inspirationInput!) {
    createinspiration(input: $input) {
      _id
    }
  }
`;

const DELETE_INSPIRATION = gql`
  mutation Deleteinspiration($projectId: String!, $inspirationId: String!) {
    deleteinspiration(projectId: $projectId, inspirationId: $inspirationId) {
      _id
    }
  }
`;

export async function addInspiration(input: {
  projectId: string;
  title: string;
  image?: string;
  video?: string;
  note?: string;
  links?: string[];
}) {
  await request(GRAPHQL_ENDPOINT, CREATE_INSPIRATION, { input });
  revalidatePath(`/project/${input.projectId}`);
}

export async function deleteInspiration(projectId: string, inspirationId: string) {
  await request(GRAPHQL_ENDPOINT, DELETE_INSPIRATION, { projectId, inspirationId });
  revalidatePath(`/project/${projectId}`);
}

