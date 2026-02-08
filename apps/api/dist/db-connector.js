"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutlineFrameworks = exports.Scenes = exports.Projects = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const app_config_1 = require("./app-config");
const schemas_1 = require("./schemas");
const env = process.env.NODE_ENV || "development";
const connect = async () => {
    await mongoose_1.default.connect(process.env.NODE_ENV === "production" ? process.env.MONGODB_CONNECTION_URI : app_config_1.environment[env].dbString);
};
connect();
let db = mongoose_1.default.connection;
db.on('error', () => {
    console.error("Error while connecting to DB");
});
const AutoIncrement = require('mongoose-sequence')(db);
const Projects = mongoose_1.default.model("Projects", schemas_1.projectSchema);
exports.Projects = Projects;
const Scenes = mongoose_1.default.model("Scenes", schemas_1.sceneSchema);
exports.Scenes = Scenes;
const OutlineFrameworks = mongoose_1.default.model("OutlineFrameworks", schemas_1.outlineFrameworkStandaloneSchema);
exports.OutlineFrameworks = OutlineFrameworks;
