import { randomUUID } from "crypto";
import mongoose from "mongoose";
import { Projects, Scenes, OutlineFrameworks } from "../db-connector";
import {
    insertData,
    deleteData,
    updateData,
} from "../helpers"
import { getProjectData } from "../resolvers"
import { Character } from "../types/character"

export const deleteProject = (root,  { id }) => {
    return deleteData(Projects, id)
}

export const createProject = (root, { input }) => {
    //loop  through input keys to make project
    const newProject = new Projects({
        user: input.user,
        displayName: input.displayName,
        email: input.email,
        type: input.type,
        title: input.title,
        logline: input.logline,
        genre: input.genre,
        budget: input.budget,
        poster: input.poster,
        similarProjects: input.similarProjects,
        sharedWith: input.sharedWith,
        outlineName: input.outlineName,
        scenes: input.scenes,
        characters: input.characters,
        outline: input.outline
    })


    return insertData(newProject)
}

export const shareProject = (root, { id, user }) => {
    //create helper for update 
    return updateData(Projects, {sharedWith: user}, id) //which project, which key and what value as args
}

export const updateProject = async (root, { project }) => {
  const id = project._id ?? project.projectId;
  if (!id) throw new Error('updateProject requires _id or projectId');
  const filter = mongoose.Types.ObjectId.isValid(id)
    ? { _id: new mongoose.Types.ObjectId(id) }
    : { _id: id };
  const updateFields = { ...project };
  delete updateFields._id;
  delete updateFields.projectId;
  const updated = await Projects.findOneAndUpdate(
    filter,
    { $set: updateFields },
    { new: true }
  ).exec();
  return updated ?? null;
};

export const updateProjectSharedWith = async (root, { projectId, sharedWith }) => {
    const filter = mongoose.Types.ObjectId.isValid(projectId)
        ? { _id: new mongoose.Types.ObjectId(projectId) }
        : { _id: projectId };
    const updated = await Projects.findOneAndUpdate(
        filter,
        { $set: { sharedWith: sharedWith ?? [] } },
        { new: true }
    );
    return updated ?? null;
}

export const createCharacter = async (root, { character } )  =>  {
    console.log('character: ',  JSON.stringify(character, null, 2))
    let characterData = character.details[0]
    const projectId = character._id
    const result: any = await getProjectData({}, { input: {  id: projectId }})
    console.log('results:  ', result)
    let update = result[0].characters ?? []
    if(update.length > 0) {
        let length = update.length

        if(!character.number)  {
            //Characters  exist creating new character
            character.number = length + 1
            character.details[0].version  = 1 
        } else {
            let charNum = character.number
            let charToUpdate = update.find((character) =>   character.number  === charNum)
            let charVersions = charToUpdate.details.length
            let newVersionNum = charVersions + 1
            characterData.version = newVersionNum
            charToUpdate.details.push(characterData)
            return updateData(Projects, {update}, projectId, "characters")
        }
        update.push(character)
    } else {
        //create first character
        character.number = 1
        character.details[0].version = 1
        update.push(character)
    }
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/e25f859c-d7ba-44eb-86e1-bc11ced01386',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'project-mutations.ts:createCharacter:pre-updateData',message:'calling updateData',data:{projectId,projectIdType:typeof projectId,updateLength:update?.length},timestamp:Date.now(),hypothesisId:'H2,H3'})}).catch(()=>{});
    // #endregion
    console.log('Character to add:  ', character)
    console.log('Characters:  ', update)
    return updateData(Projects, {update}, projectId, "characters") 

}

/** Sets a project's outline (updates project document). */
export const setProjectOutline = (root, { input }) => {
  const newOutline = new Projects({
    projectId: input.projectId,
    user: input.user,
    format: input.format,
  });
  newOutline.id = input._id;
  return updateData(Projects, { newOutline }, input.projectId);
};

/** Creates a standalone outline framework (user's saved template). */
export const createOutlineFramework = (root, { input }) => {
  const doc = new OutlineFrameworks({
    user: input.user,
    name: input.name,
    imageUrl: input.imageUrl || undefined,
    format: input.format,
  });
  return insertData(doc);
};

/** Updates a standalone outline framework by id. */
export const updateOutlineFramework = (root, { id, input }) => {
  const filter = mongoose.Types.ObjectId.isValid(id)
    ? { _id: new mongoose.Types.ObjectId(id) }
    : { id };
  return OutlineFrameworks.findOneAndUpdate(
    filter,
    {
      name: input.name,
      imageUrl: input.imageUrl,
      format: input.format,
    },
    { new: true }
  ).exec();
};

/** Deletes a standalone outline framework by MongoDB _id (ObjectId string). */
export const deleteOutlineFramework = async (root, { id }: { id: string }) => {
  return deleteData(OutlineFrameworks, id);
};

export const createinspiration = async (root, { input }) => {
  const filter = mongoose.Types.ObjectId.isValid(input.projectId)
    ? { _id: new mongoose.Types.ObjectId(input.projectId) }
    : { _id: input.projectId };

  const payload = {
    projectId: String(input.projectId),
    title: input.title,
    image: input.image ?? null,
    video: input.video ?? null,
    note: input.note ?? null,
    links: input.links ?? [],
  };

  const updated = await Projects.findOneAndUpdate(
    filter,
    { $push: { inspiration: payload } },
    { new: true }
  ).exec();

  return updated;
};

export const createTreatment = (root, { input })  =>  {
    const newTreatment  = new  Projects({
        projectId: input.projectId,
        versions: input.treatmentContent
    })

    newTreatment.id = input._id
    return  updateData(Projects, {newTreatment}, input.projec_id)
}

export const createScreenplay = (root, { input })  =>  {
    
}

export const createFeedback = (root, { input })  =>  {
    
}

export const deleteinspiration = async (root, { projectId, inspirationId }: { projectId: string; inspirationId: string }) => {
  const filter = mongoose.Types.ObjectId.isValid(projectId)
    ? { _id: new mongoose.Types.ObjectId(projectId) }
    : { _id: projectId };

  const inspoFilter = mongoose.Types.ObjectId.isValid(inspirationId)
    ? { _id: new mongoose.Types.ObjectId(inspirationId) }
    : { _id: inspirationId };

  const updated = await Projects.findOneAndUpdate(
    filter,
    { $pull: { inspiration: inspoFilter } },
    { new: true }
  ).exec();

  return updated;
};