import { Projects, Scenes, OutlineFrameworks } from "../db-connector";
import { getData, getScenes, insertData, deleteData } from "../helpers";

//Create one resolve for data that takes filters for stripping specific parts of project data
export const getProjectData = (root, filter) => {
    console.log({ filter })
    return getData(Projects, filter)
}

export const getAllProjectsSharedWithUser = (root, { user }) => {
    return getData(Projects, { sharedWith: user })
}

export const getProjectScenes = (root, filter) => {
  console.log("getProjectScenes filters:", filter);
  return getScenes(Projects, filter);
};

export const getOutlineFrameworks = (root, { user }: { user: string }) => {
  return OutlineFrameworks.find({ user }).exec();
};



