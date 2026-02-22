import mongoose from "mongoose";
import { environment } from "./app-config";
import { projectSchema, sceneContentSchema, sceneSchema, outlineFrameworkStandaloneSchema } from "./schemas";

const env = process.env.NODE_ENV || "development";

const uri = process.env.MONGODB_CONNECTION_URI || 'localhost:4000';

console.log({ env, mongouri: uri})
if (!uri) throw new Error("MONGODB_CONNECTION_URI is not defined");

const connect = async () => {
    await mongoose.connect(process.env.NODE_ENV === "production" 
        ? process.env.MONGODB_CONNECTION_URI 
        : environment[env].dbString);
}

try {
    connect()
    console.log("Connected to DB")
} catch (e) {
    console.error("Error while connecting to DB", e)
}

const db = mongoose.connection;


type MongooseSequence = (connection: mongoose.Connection) => (schema: mongoose.Schema, options?: { inc_field: string }) => void;
const AutoIncrement = (require('mongoose-sequence') as MongooseSequence)(db);

// Register models only once (Next.js can load this module multiple times via server actions).
if (!mongoose.models.Projects) {
  sceneContentSchema.plugin(AutoIncrement, { inc_field: "version" });
  mongoose.model("Projects", projectSchema);
  mongoose.model("Scenes", sceneSchema);
  mongoose.model("OutlineFrameworks", outlineFrameworkStandaloneSchema);
}
const Projects = mongoose.model("Projects");
const Scenes = mongoose.model("Scenes");
const OutlineFrameworks = mongoose.model("OutlineFrameworks");
export { Projects, Scenes, OutlineFrameworks };