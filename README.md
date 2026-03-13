# CollabCode

CollabCode is a real-time collaborative coding platform with role-based access, live editing, multi-language code execution, chat, analytics, and Git/GitHub workflows.

## What Is Implemented

- Real-time collaboration using Socket.IO + Yjs sync events
- Monaco editor with role-based edit permissions (`admin`, `editor`, `viewer`)
- Multi-file project structure with folders
- Durable file persistence in MongoDB (refresh-safe)
- Live presence, chat, and collaborator management
- Code execution via queue worker (BullMQ + Redis)
- Analytics endpoints and dashboards
- Git status/stage/unstage/commit/push/pull/branch operations
- GitHub integration routes and OAuth callback flow

Note: Recording feature has been removed from both UI and backend routes.

## Architecture

### Client (`apps/client`)
- React app (`react-scripts`)
- Monaco editor + Socket.IO client
- Main pages: login/register/dashboard/editor/profile

### Server (`apps/server`)
- Express + Socket.IO
- MongoDB models for users/projects/invites/submissions
- REST routes: auth, projects, analytics, github, git, chat, invites
- Real-time room management and Yjs provider

### Worker (`apps/worker`)
- BullMQ consumer for code execution jobs
- Executes code in isolated runtime flow and returns results/events

### Infra
- MongoDB
- Redis
- Docker Compose for server + worker + infra

## Repository Structure

```text
collab-code-desktop/
  apps/
    client/
    server/
    worker/
  docker-compose.yml
  .env.example
  package.json
```

## Prerequisites

- Node.js 18+
- npm 9+
- Docker + Docker Compose

## Environment Setup

1. Copy env file:

```bash
cp .env.example .env
```

2. Update values in `.env` as needed.

Example:

```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://admin:password123@localhost:27017/collabcode
REDIS_URL=redis://localhost:6379
JWT_SECRET=your_jwt_secret_key_change_this_in_production
GEMINI_API_KEY=your_google_gemini_api_key
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
```

## Run Locally (Recommended)

From repository root:

1. Install dependencies:

```bash
npm install
```

2. Start infrastructure + backend services:

```bash
docker compose up -d --build server worker
```

3. Start frontend dev server:

```bash
cd apps/client
npm start
```

### Service URLs

- Frontend: http://localhost:3000
- API + Socket.IO: http://localhost:5000
- MongoDB: localhost:27017
- Redis: localhost:6379

## Useful Scripts

At repo root:

- `npm run dev` - server dev + client dev
- `npm run dev:all` - server dev + client dev + worker dev
- `npm run docker:up` / `npm run docker:down`
- `npm run docker:build`

In `apps/client`:

- `npm start`
- `npm run build`

In `apps/server`:

- `npm run dev`
- `npm start`

In `apps/worker`:

- `npm run dev`
- `npm start`

## Git Workflow in App

The Git panel supports:

- Status detection from actual git workspace state
- Stage/unstage file actions
- Commit staged changes
- Push/pull with configured remote
- Branch listing/create/switch

If changed files are not visible immediately, the panel auto-refreshes periodically.

## Key API Groups

- `/api/auth`
- `/api/projects`
- `/api/analytics`
- `/api/github`
- `/api/git`
- `/api/chat`
- `/api/invites`

Health check:

- `GET /api/health`

## Known Development Notes

- If `npm start` asks for another port, port 3000 is already in use.
- After backend code changes in Docker mode, rebuild server/worker:

```bash
docker compose up -d --build server worker
```

- For collaboration issues, confirm both API and Socket.IO are reachable on port 5000.

## License

MIT
