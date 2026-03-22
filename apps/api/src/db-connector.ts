import mongoose from "mongoose";
import { environment } from "./app-config";
import { projectSchema, sceneContentSchema, sceneSchema, characterSchema, outlineFrameworkStandaloneSchema } from "./schemas";

const env = process.env.NODE_ENV || "development";

const uri =
  process.env.NODE_ENV === "production"
    ? process.env.MONGODB_CONNECTION_URI!
    : (environment as Record<string, { dbString: string }>)[env]?.dbString ?? "mongodb://localhost:27017/writual";

if (!uri) throw new Error("MONGODB_CONNECTION_URI is not defined");

// Global cache prevents redundant connections across module reloads
// (Next.js server actions and hot-reload can re-execute this module).
declare global {
  // eslint-disable-next-line no-var
  var _mongooseCache:
    | { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null }
    | undefined;
}

const cache = global._mongooseCache ?? (global._mongooseCache = { conn: null, promise: null });

const connectionOptions: mongoose.ConnectOptions = {
  maxPoolSize: 10,          // Conservative cap for Atlas Flex tier connection limits
  minPoolSize: 1,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
};

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;

  if (!cache.promise) {
    cache.promise = mongoose
      .connect(uri, connectionOptions)
      .then((m) => {
        console.log("Connected to DB");
        return m;
      });
  }

  try {
    cache.conn = await cache.promise;
  } catch (e) {
    // Reset so the next call retries rather than hanging on a failed promise.
    cache.promise = null;
    console.error("Error while connecting to DB", e);
    throw e;
  }

  return cache.conn;
}

// Eagerly connect on module load so models are ready before the first request.
connectToDatabase().catch((e) => console.error("Initial DB connection failed", e));

const db = mongoose.connection;

type MongooseSequence = (connection: mongoose.Connection) => (schema: mongoose.Schema, options?: { inc_field: string }) => void;
const AutoIncrement = (require('mongoose-sequence') as MongooseSequence)(db);

// Register models only once each (Next.js can load this module multiple times via server actions).
if (!mongoose.models.Projects) {
  sceneContentSchema.plugin(AutoIncrement, { inc_field: "version" });
  mongoose.model("Projects", projectSchema);
}
if (!mongoose.models.Scenes) {
  mongoose.model("Scenes", sceneSchema);
}
if (!mongoose.models.Characters) {
  mongoose.model("Characters", characterSchema);
}
if (!mongoose.models.OutlineFrameworks) {
  mongoose.model("OutlineFrameworks", outlineFrameworkStandaloneSchema);
}

const Projects = mongoose.model("Projects");
const Scenes = mongoose.model("Scenes");
const Characters = mongoose.model("Characters");
const OutlineFrameworks = mongoose.model("OutlineFrameworks");
export { Projects, Scenes, Characters, OutlineFrameworks };
