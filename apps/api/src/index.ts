import DataLoader from "dataloader";
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer'
import express from 'express';
import http from 'http';
import cors from 'cors';
import { PORT, host } from './app-config';
import { schema } from './schemas/schema';
import { getScenesByProjectIdsBatch } from './services/SceneService';
import { getCharactersByProjectIdsBatch } from './services/CharacterService';

// Required logic for integrating with Express
const app = express();
const httpServer = http.createServer(app)
const server = new ApolloServer(
    {
        schema,
        plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],


    }
);

const startServer = async () => {
    await server.start()

    // JSON body parser must run before Apollo so req.body is set for GraphQL requests
    app.use(express.json({ limit: '50mb' }));
    app.use(
        cors(),
        expressMiddleware(server, {
            context: async ({ req }) => ({
                token: (req as { headers?: { token?: string } }).headers?.token,
                scenesLoader: new DataLoader(getScenesByProjectIdsBatch),
                charactersLoader: new DataLoader(getCharactersByProjectIdsBatch),
            }),
        }),
    );

    await new Promise<void>((resolve) => httpServer.listen({ port: Number(PORT), host }, resolve));
}

console.log(`🚀 ...Starting aerver on http://${host}:${PORT}`);

startServer()
console.log(`🚀 Server ready at Server is running on http://${host}:${PORT}`);
