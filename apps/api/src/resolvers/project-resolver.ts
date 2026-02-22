import { Projects, OutlineFrameworks } from "../db-connector";
import { getData } from "../helpers";

//Create one resolve for data that takes filters for stripping specific parts of project data
export const getProjectData = (root, filter) => {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/e25f859c-d7ba-44eb-86e1-bc11ced01386',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'project-resolver.ts:getProjectData',message:'getProjectData called',data:{filterKeys:filter?Object.keys(filter):null},timestamp:Date.now(),hypothesisId:'H4'})}).catch(()=>{});
    // #endregion
    console.log({ filter })
    return getData(Projects, filter)
}

export const getAllProjectsSharedWithUser = (root, { user }) => {
    return getData(Projects, { sharedWith: user })
}

export const getOutlineFrameworks = (root, { user }: { user: string }) => {
  return OutlineFrameworks.find({ user }).exec();
};



