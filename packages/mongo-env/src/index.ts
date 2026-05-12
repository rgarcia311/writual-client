export const mongoDevEnvironment: Record<string, { dbString: string }> = {
  development: {
    dbString: 'mongodb://localhost:27017/writual',
  },
};

export function resolveMongoUri(): string {
  const fromEnv =
    process.env.MONGODB_CONNECTION_URI?.trim() ||
    process.env.MONGODB_URI?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('MONGODB_CONNECTION_URI is required in production');
  }

  const env = process.env.NODE_ENV || 'development';
  const entry = mongoDevEnvironment[env];
  if (entry?.dbString) {
    return entry.dbString;
  }

  if (env === 'development') {
    return 'mongodb://localhost:27017/writual';
  }

  throw new Error(
    `No Mongo URI for NODE_ENV=${env}: set MONGODB_CONNECTION_URI or extend mongoDevEnvironment`
  );
}
