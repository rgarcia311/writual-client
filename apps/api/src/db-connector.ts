import mongoose from "mongoose";
import { environment } from "./app-config";
import { projectSchema, sceneContent, sceneSchema, outlineFrameworkStandaloneSchema } from "./schemas";

const env = process.env.NODE_ENV || "development";

const uri = process.env.MONGODB_CONNECTION_URI;
if (!uri) throw new Error("MONGODB_CONNECTION_URI is not defined");

const connect = async () => {
    await mongoose.connect(process.env.NODE_ENV === "production" 
        ? process.env.MONGODB_CONNECTION_URI 
        : environment[env].dbString);
}

connect()

const db = mongoose.connection;
(db as unknown as NodeJS.EventEmitter).on('error', () => {
    console.error("Error while connecting to DB");
});

type MongooseSequence = (connection: mongoose.Connection) => (schema: mongoose.Schema, options?: { inc_field: string }) => void;
const AutoIncrement = (require('mongoose-sequence') as MongooseSequence)(db);

const Projects = mongoose.model("Projects", projectSchema);
const Scenes = mongoose.model("Scenes", sceneSchema);
const OutlineFrameworks = mongoose.model("OutlineFrameworks", outlineFrameworkStandaloneSchema);
//sceneContent.plugin(AutoIncrement, {inc_field: 'version'})
//sceneSchema.plugin(AutoIncrement, {inc_field: 'number'})
export { Projects, Scenes, OutlineFrameworks };