"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSceneAddVersionInProject = exports.updateSceneVersionInProject = exports.deleteData = exports.insertData = exports.updateData = exports.getScenes = exports.getData = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
/** Build find query from input; project lookup uses MongoDB _id (supports input.id or input._id). */
function projectQueryFromInput(input) {
    if (!input || typeof input !== 'object')
        return input;
    const query = { ...input };
    if (query.id != null) {
        query._id = mongoose_1.default.Types.ObjectId.isValid(query.id) ? new mongoose_1.default.Types.ObjectId(query.id) : query.id;
        delete query.id;
    }
    else if (query._id != null && typeof query._id === 'string') {
        query._id = mongoose_1.default.Types.ObjectId.isValid(query._id) ? new mongoose_1.default.Types.ObjectId(query._id) : query._id;
    }
    return query;
}
const getData = (model, params = {}) => {
    return new Promise((resolve, reject) => {
        if (Object.keys(params).length && params.input) {
            const query = projectQueryFromInput(params.input);
            model.find(query, (err, data) => {
                if (err)
                    reject(err);
                else {
                    resolve(data);
                }
            });
        }
    });
};
exports.getData = getData;
const getScenes = (model, params = {}) => {
    return new Promise((resolve, reject) => {
        if (Object.keys(params).length && params.input) {
            const query = projectQueryFromInput(params.input);
            model.find(query, (err, data) => {
                if (err)
                    reject(err);
                else if (data.length > 0)
                    resolve(data[0].scenes);
                else
                    resolve([]);
            });
        }
    });
};
exports.getScenes = getScenes;
const updateData = (model, input, id, property = "") => {
    console.log('running updateData with input: ', input, 'id: ', id, 'property: ', property);
    //see  if its bc the first scene has no number or version 
    return new Promise((resolve, reject) => {
        // console.log('propertyAndData: ', JSON.stringify(propertyAndData, null, "\t"))
        let inputKeys = Object.keys(input);
        let dataObj = {};
        dataObj[property] = input[inputKeys[0]];
        const projectFilter = mongoose_1.default.Types.ObjectId.isValid(id)
            ? { _id: new mongoose_1.default.Types.ObjectId(id) }
            : { _id: id };
        if (property === "scenes") {
            model.findOneAndUpdate(projectFilter, dataObj, { new: true }, (err, data) => {
                if (err)
                    reject(err);
                else
                    resolve(data);
            });
        }
        else {
            model.updateOne(projectFilter, dataObj, { new: true }, (err, data) => {
                if (err)
                    reject(err);
                else
                    resolve(data);
            });
        }
    });
};
exports.updateData = updateData;
const insertData = (data) => {
    return new Promise((resolve, reject) => {
        data.save((err) => {
            if (err)
                reject(err);
            else
                resolve(data);
        });
    });
};
exports.insertData = insertData;
const deleteData = (model, id) => {
    return new Promise(async (resolve, reject) => {
        try {
            const filter = mongoose_1.default.Types.ObjectId.isValid(id) ? { _id: new mongoose_1.default.Types.ObjectId(id) } : { _id: id };
            await model.deleteOne(filter);
            resolve(`deleted _id: ${id}`);
        }
        catch (err) {
            console.log(`error deleting ${id}: `, err);
            reject(err);
        }
    });
};
exports.deleteData = deleteData;
/**
 * Update only the active version of an existing scene (in-place). Also sets scene.activeVersion and scene.lockedVersion.
 */
const updateSceneVersionInProject = (model, _id, sceneNumber, activeVersion, act, versionPayload, lockedVersion) => {
    return new Promise((resolve, reject) => {
        try {
            if (!mongoose_1.default.Types.ObjectId.isValid(_id)) {
                reject(new Error(`Invalid project _id: ${_id}`));
                return;
            }
            const objectId = new mongoose_1.default.Types.ObjectId(_id);
            const sn = Number(sceneNumber);
            const av = Number(activeVersion);
            const $set = {
                'scenes.$[elem].activeVersion': av,
                'scenes.$[elem].versions.$[ver].sceneHeading': versionPayload?.sceneHeading ?? '',
                'scenes.$[elem].versions.$[ver].thesis': versionPayload?.thesis ?? '',
                'scenes.$[elem].versions.$[ver].antithesis': versionPayload?.antithesis ?? '',
                'scenes.$[elem].versions.$[ver].synthesis': versionPayload?.synthesis ?? '',
                'scenes.$[elem].versions.$[ver].synopsis': versionPayload?.synopsis ?? '',
                'scenes.$[elem].versions.$[ver].step': versionPayload?.step ?? '',
            };
            if (versionPayload?.act !== undefined && versionPayload?.act !== null) {
                $set['scenes.$[elem].versions.$[ver].act'] = versionPayload.act;
            }
            if (lockedVersion !== undefined && lockedVersion !== null) {
                $set['scenes.$[elem].lockedVersion'] = lockedVersion;
            }
            const update = { $set };
            if (lockedVersion === undefined || lockedVersion === null) {
                update.$unset = { 'scenes.$[elem].lockedVersion': 1 };
            }
            model.findOneAndUpdate({ _id: objectId, 'scenes.number': sn, 'scenes.versions.version': av }, update, {
                arrayFilters: [
                    { 'elem.number': sn },
                    { 'ver.version': av },
                ],
                new: true,
            }, (err, data) => {
                if (err)
                    reject(err);
                else
                    resolve(data);
            });
        }
        catch (err) {
            reject(err);
        }
    });
};
exports.updateSceneVersionInProject = updateSceneVersionInProject;
/**
 * Add a new version to an existing scene and set it as active.
 */
const updateSceneAddVersionInProject = (model, _id, sceneNumber, newVersionPayload, activeVersion) => {
    return new Promise((resolve, reject) => {
        try {
            if (!mongoose_1.default.Types.ObjectId.isValid(_id)) {
                reject(new Error(`Invalid project _id: ${_id}`));
                return;
            }
            const objectId = new mongoose_1.default.Types.ObjectId(_id);
            const sn = Number(sceneNumber);
            model.findOneAndUpdate({ _id: objectId, 'scenes.number': sn }, {
                $push: { 'scenes.$[elem].versions': newVersionPayload },
                $set: { 'scenes.$[elem].activeVersion': activeVersion },
            }, {
                arrayFilters: [{ 'elem.number': sn }],
                new: true,
            }, (err, data) => {
                if (err)
                    reject(err);
                else
                    resolve(data);
            });
        }
        catch (err) {
            reject(err);
        }
    });
};
exports.updateSceneAddVersionInProject = updateSceneAddVersionInProject;
