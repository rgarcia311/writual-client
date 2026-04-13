import 'dotenv/config';
import DataLoader from "dataloader";
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer'
import express from 'express';
import http from 'http';
import cors from 'cors';
import mongoose from 'mongoose';
import { PORT, host } from './app-config';
import { schema } from './schemas/schema';
import { getScenesByProjectIdsBatch } from './services/SceneService';
import { getCharactersByProjectIdsBatch } from './services/CharacterService';
import { Projects, AppUsers, Conversations } from '@writual/db';
import { verifyUser } from './lib/verifyUser';
import { pusher } from './services/pusher';

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

    // JSON body parser must run before all routes so req.body is available
    app.use(express.json({ limit: '50mb' }));
    app.use(cors());

    // Pusher channel authentication (private and presence)
    app.post('/api/pusher/auth', async (req, res) => {
      const uid = await verifyUser((req as any).headers?.authorization);
      if (!uid) { res.status(401).json({ error: 'Unauthorized' }); return; }

      const user = await AppUsers.findOne({ uid }).lean().exec();
      if (!user) { res.status(403).json({ error: 'Forbidden' }); return; }

      const { socket_id, channel_name } = req.body;

      // private-conversation-{conversationId}: verify participant membership
      if (channel_name?.startsWith('private-conversation-')) {
        const conversationId = channel_name.replace('private-conversation-', '');
        if (!mongoose.Types.ObjectId.isValid(conversationId)) {
          res.status(400).json({ error: 'Invalid channel' }); return;
        }
        const conv = await Conversations.findById(conversationId).lean().exec();
        if (!conv || !(conv as any).participants.includes(uid)) {
          res.status(403).json({ error: 'Forbidden' }); return;
        }
        res.json(pusher.authorizeChannel(socket_id, channel_name));
        return;
      }

      // Support both private-project-{id} and presence-project-{id}
      const projectId = channel_name
        ?.replace('presence-project-', '')
        ?.replace('private-project-', '');
      if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
        res.status(400).json({ error: 'Invalid channel' }); return;
      }

      const project = await Projects.findOne({
        _id: new mongoose.Types.ObjectId(projectId),
        $or: [
          { user: uid },
          { sharedWith: uid },
          { collaborators: { $elemMatch: { uid, status: 'active' } } },
        ],
      }).lean().exec();
      if (!project) { res.status(403).json({ error: 'Forbidden' }); return; }

      if (channel_name.startsWith('presence-')) {
        const authResponse = pusher.authorizeChannel(socket_id, channel_name, {
          user_id: uid,  // Firebase UID — matches project.user and sharedWith for client-side presence checks
          user_info: { name: (user as any).name },
        });
        res.json(authResponse);
      } else {
        const authResponse = pusher.authorizeChannel(socket_id, channel_name);
        res.json(authResponse);
      }
    });

    // Apollo GraphQL
    app.use(
        expressMiddleware(server, {
            context: async ({ req }) => {
              const uid = await verifyUser((req as any).headers?.authorization);
              let user: any = null;
              if (uid) {
                user = await AppUsers.findOne({ uid }).lean().exec() ?? null;
                // user may be null if token is valid but MongoDB record not yet created
              }
              return {
                uid,
                user,
                scenesLoader: new DataLoader(getScenesByProjectIdsBatch),
                charactersLoader: new DataLoader(getCharactersByProjectIdsBatch),
              };
            },
        }),
    );

    await new Promise<void>((resolve) => httpServer.listen({ port: Number(PORT), host }, resolve));
}

console.log(`🚀 ...Starting aerver on http://${host}:${PORT}`);

startServer()
console.log(`🚀 Server ready at Server is running on http://${host}:${PORT}`);
