# Writual Monorepo

Turborepo containing the Writual web app and GraphQL API.

## Structure

- `apps/web` – Next.js 16 frontend (Firebase App Hosting)
- `apps/api` – Express + Apollo GraphQL server (MongoDB)

## Commands

From the monorepo root:

```bash
pnpm install
pnpm dev          # Start both web and api
pnpm dev:web      # Start only web app (port 8000)
pnpm dev:api      # Start only API (port 4000)
pnpm build        # Build all apps
pnpm lint         # Lint all apps
```

## Environment

- Copy `.env.example` and configure as needed.
- For web: copy vars to `apps/web/.env.local`
- For api: copy vars to `apps/api/.env`

## Firebase deploy

Deploy the web app from `apps/web`:

```bash
cd apps/web && firebase deploy
```
