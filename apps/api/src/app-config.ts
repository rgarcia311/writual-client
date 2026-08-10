import { mongoDevEnvironment } from '@writual/mongo-env';

export const PORT = process.env.PORT || 8080;
export const host = '0.0.0.0';
export const environment = {
    development: {
        ...mongoDevEnvironment.development,
        serverURL: `http://localhost:${PORT}/`,
    },
};