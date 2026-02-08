"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOutlineFrameworks = exports.getProjectScenes = exports.getAllProjectsSharedWithUser = exports.getProjectData = void 0;
const db_connector_1 = require("../db-connector");
const helpers_1 = require("../helpers");
//Create one resolve for data that takes filters for stripping specific parts of project data
const getProjectData = (root, filter) => {
    return (0, helpers_1.getData)(db_connector_1.Projects, filter);
};
exports.getProjectData = getProjectData;
const getAllProjectsSharedWithUser = (root, { user }) => {
    return (0, helpers_1.getData)(db_connector_1.Projects, { sharedWith: user });
};
exports.getAllProjectsSharedWithUser = getAllProjectsSharedWithUser;
const getProjectScenes = (root, filter) => {
    console.log("getProjectScenes filters:", filter);
    return (0, helpers_1.getScenes)(db_connector_1.Projects, filter);
};
exports.getProjectScenes = getProjectScenes;
const getOutlineFrameworks = (root, { user }) => {
    return db_connector_1.OutlineFrameworks.find({ user }).exec();
};
exports.getOutlineFrameworks = getOutlineFrameworks;
