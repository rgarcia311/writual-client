import mongoose from "mongoose";
import { environment } from "./app-config";
import { projectSchema, sceneContent, sceneSchema, outlineFrameworkStandaloneSchema } from "./schemas";

const env = process.env.NODE_ENV || "development";

const connect = async () => {
    console.log(process.env.MONGODB_CONNECTION_URI, process.env.NODE_ENV);
    await mongoose.connect(process.env.NODE_ENV === "production" 
        ? process.env.MONGODB_CONNECTION_URI 
        : environment[env].dbString);
}

connect()

let db = mongoose.connection;
db.on('error', () => {
    console.error("Error while connecting to DB");
});

const AutoIncrement = require('mongoose-sequence')(db);

const Projects = mongoose.model("Projects", projectSchema);
const Scenes = mongoose.model("Scenes", sceneSchema);
const OutlineFrameworks = mongoose.model("OutlineFrameworks", outlineFrameworkStandaloneSchema);
//sceneContent.plugin(AutoIncrement, {inc_field: 'version'})
//sceneSchema.plugin(AutoIncrement, {inc_field: 'number'})
export { Projects, Scenes, OutlineFrameworks };