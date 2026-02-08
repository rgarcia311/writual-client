"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateExistingScene = exports.createNewSceneVersion = exports.createNewScene = void 0;
const createNewScene = (newScene, scenes) => {
    console.log('newScene: ', newScene);
    let numOfScenes = scenes.length;
    console.log('numOfScenes: ', numOfScenes);
    newScene.number = numOfScenes + 1;
    console.log(`newScene.number ${newScene.number}`);
    newScene.versions = [];
    // Ensure base metadata exists for new scenes
    if (!newScene.activeVersion)
        newScene.activeVersion = 1;
    //Update scenes with new scene or modified version
    console.log('created scene: ', JSON.stringify(newScene, null, 2));
    scenes.push(newScene);
    console.log('scenes: ', scenes);
    return scenes;
};
exports.createNewScene = createNewScene;
const createNewSceneVersion = (updateData, sceneToUpdate, scenes, sceneIndex) => {
    let numVersions = sceneToUpdate.versions.length;
    updateData.versions[0].version = numVersions + 1;
    sceneToUpdate.versions.push(updateData.versions[0]);
    // Keep scene-level metadata in sync
    sceneToUpdate.activeVersion = updateData.activeVersion ?? (numVersions + 1);
    if (updateData.lockedVersion !== undefined)
        sceneToUpdate.lockedVersion = updateData.lockedVersion;
    scenes[sceneIndex] = sceneToUpdate;
    return scenes;
};
exports.createNewSceneVersion = createNewSceneVersion;
const updateExistingScene = (sceneVersion, sceneToUpdate, scenes, versionIndex, sceneIndex) => {
    console.log('updateExistingScene: ', { sceneVersion, sceneToUpdate, scenes, versionIndex, sceneIndex });
    sceneToUpdate.versions[versionIndex] = sceneVersion;
    console.log(`setting ${scenes[sceneIndex]} to: `, sceneToUpdate);
    scenes[sceneIndex] = sceneToUpdate;
    return scenes;
};
exports.updateExistingScene = updateExistingScene;
