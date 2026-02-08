import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer'
import express from 'express';
import http from 'http';
import cors from 'cors';
import bodyParser from 'body-parser';
//import { resolvers } from '../resolvers';
import { ProjectType } from './typeDefs';
import { PORT, host } from './app-config';
import { schema } from './schemas/schema'

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

    app.use(
        cors(),
        // 50mb is the limit that `startStandaloneServer` uses, but you may configure this to suit your needs
        bodyParser.json({ limit: '50mb' }),
        expressMiddleware(server, {
            context: async ({ req }) => ({ token: req.headers.token }),
        }),
    );

    await new Promise<void>((resolve) => httpServer.listen({ PORT, host }, resolve));
}

console.log(`🚀 ...Starting aerver on http://${host}:${PORT}`);

startServer()
console.log(`🚀 Server ready at Server is running on http://${host}:${PORT}`);
