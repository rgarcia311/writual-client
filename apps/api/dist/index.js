"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const server_1 = require("@apollo/server");
const express4_1 = require("@apollo/server/express4");
const drainHttpServer_1 = require("@apollo/server/plugin/drainHttpServer");
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const cors_1 = __importDefault(require("cors"));
const body_parser_1 = __importDefault(require("body-parser"));
//import { PORT } from '../app-config';
const schema_1 = require("./schemas/schema");
// Required logic for integrating with Express
const app = (0, express_1.default)();
const httpServer = http_1.default.createServer(app);
const server = new server_1.ApolloServer({
    schema: schema_1.schema,
    plugins: [(0, drainHttpServer_1.ApolloServerPluginDrainHttpServer)({ httpServer })],
});
const startServer = async () => {
    await server.start();
    app.use((0, cors_1.default)(), 
    // 50mb is the limit that `startStandaloneServer` uses, but you may configure this to suit your needs
    body_parser_1.default.json({ limit: '50mb' }), (0, express4_1.expressMiddleware)(server, {
        context: async ({ req }) => ({ token: req.headers.token }),
    }));
    await new Promise((resolve) => httpServer.listen({ port: 4000 }, resolve));
};
startServer();
console.log(`🚀 Server ready at http://localhost:4000`);
