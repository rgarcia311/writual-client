"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFeedback = exports.createScreenplay = exports.createTreatment = exports.createInsporation = exports.updateOutlineFramework = exports.createOutlineFramework = exports.setProjectOutline = exports.createCharacter = exports.deleteScene = exports.createScene = exports.updateProjectSharedWith = exports.updateProject = exports.shareProject = exports.createProject = exports.deleteProject = void 0;
const crypto_1 = require("crypto");
const mongoose_1 = __importDefault(require("mongoose"));
const db_connector_1 = require("../db-connector");
const helpers_1 = require("../helpers");
const resolvers_1 = require("../resolvers");
const deleteProject = (root, { id }) => {
    return (0, helpers_1.deleteData)(db_connector_1.Projects, id);
};
exports.deleteProject = deleteProject;
const createProject = (root, { input }) => {
    //loop  through input keys to make project
    const newProject = new db_connector_1.Projects({
        user: input.user,
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
    });
    return (0, helpers_1.insertData)(newProject);
};
exports.createProject = createProject;
const shareProject = (root, { id, user }) => {
    //create helper for update 
    return (0, helpers_1.updateData)(db_connector_1.Projects, { sharedWith: user }, id); //which project, which key and what value as args
};
exports.shareProject = shareProject;
const updateProject = (root, { project }) => {
    console.log('project to create: ', project);
    return (0, helpers_1.updateData)(db_connector_1.Projects, { project }, project.projectId, "project");
};
exports.updateProject = updateProject;
const updateProjectSharedWith = async (root, { projectId, sharedWith }) => {
    const filter = mongoose_1.default.Types.ObjectId.isValid(projectId)
        ? { _id: new mongoose_1.default.Types.ObjectId(projectId) }
        : { _id: projectId };
    const updated = await db_connector_1.Projects.findOneAndUpdate(filter, { $set: { sharedWith: sharedWith ?? [] } }, { new: true });
    return updated ?? null;
};
exports.updateProjectSharedWith = updateProjectSharedWith;
const createScene = async (root, { input }) => {
    const scene = input;
    const sceneVersion = scene.versions?.[0];
    const sceneNum = scene.number;
    const newVersion = !!scene.newVersion;
    if (!scene.number) {
        const scenes = await (0, resolvers_1.getProjectScenes)({}, { input: { _id: scene._id } });
        const updatedScenes = (0, helpers_1.createNewScene)(scene, scenes);
        return (0, helpers_1.updateData)(db_connector_1.Projects, { updatedScenes }, scene._id, "scenes");
    }
    const sceneNumber = Number(sceneNum);
    const activeVersion = scene.activeVersion ?? 1;
    if (newVersion && sceneVersion) {
        return (0, helpers_1.updateSceneAddVersionInProject)(db_connector_1.Projects, scene._id, sceneNumber, sceneVersion, activeVersion);
    }
    return (0, helpers_1.updateSceneVersionInProject)(db_connector_1.Projects, scene._id, sceneNumber, activeVersion, scene.act, sceneVersion, scene.lockedVersion ?? null);
};
exports.createScene = createScene;
const deleteScene = async (root, { projectId, sceneNumber }) => {
    console.log('deleteScene: ', { projectId, sceneNumber });
    const filter = mongoose_1.default.Types.ObjectId.isValid(projectId)
        ? { _id: new mongoose_1.default.Types.ObjectId(projectId) }
        : { _id: projectId };
    const updatedProject = await db_connector_1.Projects.findOneAndUpdate(filter, { $pull: { scenes: { number: sceneNumber } } }, { new: true }).exec();
    return updatedProject;
};
exports.deleteScene = deleteScene;
const createCharacter = async (root, { character }) => {
    console.log('character: ', JSON.stringify(character, null, 2));
    let characterData = character.details[0];
    const result = await (0, resolvers_1.getProjectData)({}, { input: { id: character.projectId } });
    console.log('results:  ', result);
    let update = result[0].characters;
    if (update.length > 0) {
        let length = update.length;
        if (!character.number) {
            //Characters  exist creating new character
            character.number = length + 1;
            character.details[0].version = 1;
        }
        else {
            let charNum = character.number;
            let charToUpdate = update.find((character) => character.number === charNum);
            let charVersions = charToUpdate.details.length;
            let newVersionNum = charVersions + 1;
            characterData.version = newVersionNum;
            charToUpdate.versions.push(characterData);
            return (0, helpers_1.updateData)(db_connector_1.Projects, { update }, character.projectId, "characters");
        }
        update.push(character);
    }
    else {
        //create first character
        character.number = 1;
        character.details[0].version = 1;
        update.push(character);
    }
    console.log('Character to add:  ', character);
    console.log('Characters:  ', update);
    return (0, helpers_1.updateData)(db_connector_1.Projects, { update }, character.projectId, "characters"); //project id 
};
exports.createCharacter = createCharacter;
/** Sets a project's outline (updates project document). */
const setProjectOutline = (root, { input }) => {
    const newOutline = new db_connector_1.Projects({
        projectId: input.projectId,
        user: input.user,
        format: input.format,
    });
    newOutline.id = input._id;
    return (0, helpers_1.updateData)(db_connector_1.Projects, { newOutline }, input.projectId);
};
exports.setProjectOutline = setProjectOutline;
/** Creates a standalone outline framework (user's saved template). */
const createOutlineFramework = (root, { input }) => {
    const id = input.id || (0, crypto_1.randomUUID)();
    const doc = new db_connector_1.OutlineFrameworks({
        id,
        user: input.user,
        name: input.name,
        imageUrl: input.imageUrl || undefined,
        format: input.format,
    });
    return (0, helpers_1.insertData)(doc);
};
exports.createOutlineFramework = createOutlineFramework;
/** Updates a standalone outline framework by id. */
const updateOutlineFramework = (root, { id, input }) => {
    return db_connector_1.OutlineFrameworks.findOneAndUpdate({ id }, {
        name: input.name,
        imageUrl: input.imageUrl,
        format: input.format,
    }, { new: true }).exec();
};
exports.updateOutlineFramework = updateOutlineFramework;
const createInsporation = (root, { input }) => {
    const newInspo = new db_connector_1.Projects({
        projectId: input.projectId,
        scratch: input.scratch,
    });
    newInspo.id = input._id;
    console.log('creating project: ', newInspo);
    return (0, helpers_1.updateData)(db_connector_1.Projects, { newInspo }, input.projectId);
};
exports.createInsporation = createInsporation;
const createTreatment = (root, { input }) => {
    const newTreatment = new db_connector_1.Projects({
        projectId: input.projectId,
        versions: input.treatmentContent
    });
    newTreatment.id = input._id;
    return (0, helpers_1.updateData)(db_connector_1.Projects, { newTreatment }, input.projec_id);
};
exports.createTreatment = createTreatment;
const createScreenplay = (root, { input }) => {
};
exports.createScreenplay = createScreenplay;
const createFeedback = (root, { input }) => {
};
exports.createFeedback = createFeedback;
