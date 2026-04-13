export const mongoDevEnvironment: Record<string, { dbString: string }> = {
  development: {
    dbString: 'mongodb://localhost:27017/writual',
  },
};

export function resolveMongoUri(): string {
  if (process.env.NODE_ENV === 'production') {
    const uri = process.env.MONGODB_CONNECTION_URI;
    if (!uri) {
      throw new Error('MONGODB_CONNECTION_URI is required in production');
    }
    return uri;
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
