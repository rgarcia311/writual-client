import { Projects, OutlineFrameworks } from "../db-connector";
import { getData } from "../helpers";

//Create one resolve for data that takes filters for stripping specific parts of project data
export const getProjectData = (root, args) => {
    const { user: uid, ...rest } = args?.input ?? {};
    if (!uid) {
        return getData(Projects, args);
    }

    const sharedQuery = {
        $or: [
            { user: uid },
            { sharedWith: uid },
            { collaborators: { $elemMatch: { uid: uid, status: 'active' } } },
        ]
    };

    const hasExtraFilters = Object.keys(rest).length > 0;
    const query = hasExtraFilters
        ? { $and: [sharedQuery, rest] }
        : sharedQuery;

    return getData(Projects, { input: query });
}

export const getAllProjectsSharedWithUser = (root: unknown, { user }: { user: string }) => {
    return getData(Projects, {
        input: {
            $or: [
                { sharedWith: user },
                { collaborators: { $elemMatch: { uid: user, status: 'active' } } },
            ]
        }
    });
}

export const getOutlineFrameworks = (root, { user }: { user: string }) => {
  return OutlineFrameworks.find({ user }).exec();
};



