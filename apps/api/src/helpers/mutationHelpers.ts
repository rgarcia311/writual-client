import { Scene, Version } from "../interfaces";
import {update} from "lodash";

export const createNewScene = (newScene: Scene, scenes: Array<Scene>) => {
    let numOfScenes: number = scenes.length
    newScene.number = numOfScenes + 1
    newScene.versions = Array.isArray(newScene.versions) && newScene.versions.length > 0 ? newScene.versions : []
    if (!newScene.activeVersion) newScene.activeVersion = 1
    //Update scenes with new scene or modified version
    console.log('created scene: ', JSON.stringify(newScene, null, 2))
    scenes.push(newScene)
    console.log('scenes: ', scenes)
    return scenes
}

export const createNewSceneVersion = (updateData: Scene, sceneToUpdate: any, scenes: Array<{}>, sceneIndex: number) => {
    let numVersions = sceneToUpdate.versions.length
    updateData.versions[0].version = numVersions + 1
    sceneToUpdate.versions.push(updateData.versions[0])
    // Keep scene-level metadata in sync
    sceneToUpdate.activeVersion = updateData.activeVersion ?? (numVersions + 1)
    if (updateData.lockedVersion !== undefined) sceneToUpdate.lockedVersion = updateData.lockedVersion
    scenes[sceneIndex] = sceneToUpdate
    return scenes
}

export const updateExistingScene = (sceneVersion: Version, sceneToUpdate: Scene, scenes: Array<Scene>, versionIndex: number, sceneIndex: number) => {
    console.log('updateExistingScene: ', { sceneVersion, sceneToUpdate, scenes, versionIndex, sceneIndex })
    sceneToUpdate.versions[versionIndex] = sceneVersion
    console.log(`setting ${scenes[sceneIndex]} to: `, sceneToUpdate)
    scenes[sceneIndex] = sceneToUpdate
    return scenes
}

