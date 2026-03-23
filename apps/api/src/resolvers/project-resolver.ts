import { Projects, OutlineFrameworks } from "../db-connector";
import { getData } from "../helpers";

//Create one resolve for data that takes filters for stripping specific parts of project data
export const getProjectData = (root, filter) => {
    return getData(Projects, filter)
}

export const getAllProjectsSharedWithUser = (root, { user }) => {
    return getData(Projects, { sharedWith: user })
}

export const getOutlineFrameworks = (root, { user }: { user: string }) => {
  return OutlineFrameworks.find({ user }).exec();
};



