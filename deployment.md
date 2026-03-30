# CollabCode Deployment Guide (Render, Atlas, Redis Cloud)

## 1) Recommended Production Architecture

Use 3 services on Render:

1. Server API (Web Service, Node runtime)
2. Code Execution Worker (Background Worker, Docker runtime)
3. Client UI (Static Site)

Why this is the best fit for this repository:

- MongoDB is already external on Atlas
- Redis is already external on Redis Cloud
- Worker needs language runtimes and build tools (python/java/c/c++) that are installed in [apps/worker/Dockerfile](apps/worker/Dockerfile)
- Server and client can run efficiently without Docker on Render

## 2) Repository Paths and Runtime Entry Points

- Server source: [apps/server/src/index.js](apps/server/src/index.js)
- Server package: [apps/server/package.json](apps/server/package.json)
- Worker source: [apps/worker/src/index.js](apps/worker/src/index.js)
- Worker package: [apps/worker/package.json](apps/worker/package.json)
- Worker Docker image definition: [apps/worker/Dockerfile](apps/worker/Dockerfile)
- Client package: [apps/client/package.json](apps/client/package.json)
- Client runtime API config: [apps/client/src/renderer/config/runtime.js](apps/client/src/renderer/config/runtime.js)

## 3) Pre-Deployment Checklist

Complete all of these before creating services:

1. Push the latest code to GitHub
2. Confirm Atlas URI is valid and reachable
3. Confirm Redis URL is valid and reachable
4. Ensure server health endpoint works locally at /api/health
5. Ensure client builds locally with npm run build

Local quick checks:

- Server Redis check command:

```powershell
cd C:\Users\saura\OneDrive\Desktop\collab-code-desktop\apps\server
node -e "require('dotenv').config(); const IORedis=require('ioredis'); const c=new IORedis(process.env.REDIS_URL,{maxRetriesPerRequest:1,connectTimeout:7000,retryStrategy:()=>null}); c.ping().then(r=>{console.log(r); c.disconnect(); process.exit(0);}).catch(e=>{console.error(e.message); process.exit(1);});"
```

Expected output: PONG

## 4) Service Creation Order (Important)

Create in this order:

1. Server (Web Service)
2. Worker (Background Worker)
3. Client (Static Site)
4. Go back and update server CORS and GitHub callback values with final client URL

## 5) Render Service #1: Server (Web Service)

In Render Dashboard:

1. New -> Web Service
2. Connect GitHub repo
3. Fill exactly:

- Name: collab-code-server
- Region: same as Redis/Atlas nearest region (recommended)
- Branch: main (or your deploy branch)
- Root Directory: apps/server
- Runtime: Node
- Build Command: npm install
- Start Command: npm start
- Auto Deploy: Yes
- Health Check Path: /api/health

### Server Environment Variables

Add these in Render -> Environment:

Required:

- NODE_ENV = production
- PORT = 5000
- MONGODB_URI = mongodb+srv://<atlas_user>:<atlas_password>@<cluster>/<db>?retryWrites=true&w=majority
- REDIS_URL = redis://default:<redis_password>@redis-11388.crce281.ap-south-1-3.ec2.cloud.redislabs.com:11388
- JWT_SECRET = <strong_random_secret>
- CORS_ORIGIN = https://<your-client-site>.onrender.com

GitHub integration (required only if GitHub features are used):

- GITHUB_CLIENT_ID = <github_oauth_client_id>
- GITHUB_CLIENT_SECRET = <github_oauth_client_secret>
- GITHUB_REDIRECT_URI = https://<your-client-site>.onrender.com/github/callback

Optional but recommended:

- LOG_LEVEL = info
- RATE_LIMIT_WINDOW_MS = 900000
- RATE_LIMIT_MAX = 5000
- SOCKET_PING_INTERVAL_MS = 25000
- SOCKET_PING_TIMEOUT_MS = 60000
- SOCKET_RECOVERY_WINDOW_MS = 120000
- MAX_PROJECT_FILES = 200
- MAX_FILE_CONTENT_CHARS = 200000
- MAX_FILE_MODIFICATIONS = 1000
- MAX_ANALYTICS_ENTRIES = 200
- MAX_EXECUTION_TIMES = 200
- MAX_CHAT_HISTORY = 1000
- MAX_CHAT_MESSAGE_CHARS = 2000
- GEMINI_API_KEY = <optional_if_analytics_ai_used>
- ERROR_REPORT_WEBHOOK_URL = <optional>
- WORKER_HEALTHCHECK_URL = https://<worker-url>/health
- WORKER_KEEPALIVE_INTERVAL_MS = 240000

### Server Success Criteria

Deployment is correct when:

1. Build succeeds
2. Service becomes Live
3. GET https://<server-url>/api/health returns status 200
4. Logs do not show MONGODB_URI missing, Redis auth errors, or crash loops

## 6) Render Service #2: Worker (Background Worker, Docker)

In Render Dashboard:

1. New -> Background Worker
2. Connect same GitHub repo
3. Fill exactly:

- Name: collab-code-worker
- Region: same as server (recommended)
- Branch: main
- Root Directory: apps/worker
- Runtime / Environment: Docker
- Dockerfile Path: ./Dockerfile (relative to root directory apps/worker)
- Docker Command: leave empty (uses CMD from Dockerfile)
- Auto Deploy: Yes

Why Docker runtime for worker:

- Worker executes user code in multiple languages
- [apps/worker/Dockerfile](apps/worker/Dockerfile) installs required runtimes and compilers

### Worker Environment Variables

Required:

- NODE_ENV = production
- REDIS_URL = redis://default:<redis_password>@redis-11388.crce281.ap-south-1-3.ec2.cloud.redislabs.com:11388

Recommended guardrails:

- EXECUTION_TIMEOUT_MS = 10000
- MAX_CODE_CHARS = 200000
- MAX_INPUT_CHARS = 10000
- MAX_FILES = 50
- MAX_FILE_NAME_CHARS = 255
- MAX_FILE_CONTENT_CHARS = 200000
- MAX_TOTAL_FILE_CHARS = 1000000
- MAX_OUTPUT_CHARS = 200000

### Worker Success Criteria

Deployment is correct when logs show:

1. Redis connected
2. Worker started and waiting for jobs
3. No repeated WRONGPASS, ECONNREFUSED, or crash restart loop

If worker is deployed as Web Service (free-plan workaround), also verify:

4. GET https://<worker-url>/health returns 200

## 7) Render Service #3: Client (Static Site)

In Render Dashboard:

1. New -> Static Site
2. Connect same GitHub repo
3. Fill exactly:

- Name: collab-code-client
- Branch: main
- Root Directory: apps/client
- Build Command: npm install && npm run build
- Publish Directory: build
- Auto Deploy: Yes

### Client Environment Variables

Required at build time:

- REACT_APP_API_URL = https://<server-url>

Why this value:

- [apps/client/src/renderer/config/runtime.js](apps/client/src/renderer/config/runtime.js) builds API_URL from REACT_APP_API_URL + /api
- Do not add /api in REACT_APP_API_URL. Example: use https://collab-code-server.onrender.com (not .../api)

### SPA Routing Rule (Important)

Because client uses React Router, add rewrite on Render Static Site:

- Source: /*
- Destination: /index.html
- Action: Rewrite

Without this, deep-link refresh routes may 404.

### Client Success Criteria

Deployment is correct when:

1. Site opens at Render URL
2. Login/Register pages load
3. Browser network requests target https://<server-url>/api/...
4. No CORS errors in browser console

## 8) Final Configuration Sync (After Client URL Exists)

After client deploys and has final URL:

1. Update server CORS_ORIGIN to exact client URL
2. Update GITHUB_REDIRECT_URI to https://<client-url>/github/callback
3. Trigger server redeploy

If you use both custom domain and default Render domain, include both in CORS_ORIGIN separated by commas:

- CORS_ORIGIN = https://client.example.com,https://collab-code-client.onrender.com

## 9) End-to-End Verification Checklist

Run these in order:

1. Server health check returns 200
2. User can register/login
3. Create project works
4. Open editor and socket connects
5. Run code and get output
6. Worker logs show job processing
7. Chat and collaboration events work
8. Git/GitHub flows work (if configured)

## 10) Common Failure Modes and Fixes

### A) Server fails with MONGODB_URI is not defined

Cause: missing env variable in Render server service.
Fix: add MONGODB_URI in server Environment and redeploy.

### B) Redis WRONGPASS in server or worker

Cause: wrong Redis password/username or malformed URL.
Fix: re-copy Redis Cloud credentials and set:

- REDIS_URL = redis://default:<password>@<host>:<port>

### C) Worker keeps restarting

Cause: deployed as Node runtime without required language toolchain.
Fix: deploy worker as Docker background worker using [apps/worker/Dockerfile](apps/worker/Dockerfile).

### D) Client works but API calls fail with CORS

Cause: CORS_ORIGIN does not match exact client domain.
Fix: set exact client URL in server env and redeploy server.

### E) GitHub OAuth callback mismatch

Cause: GITHUB_REDIRECT_URI differs from GitHub app settings.
Fix: update both Render env and GitHub OAuth app callback URL to exact same value.

## 11) Security and Production Notes

1. Never commit .env files to Git
2. Rotate JWT_SECRET and Redis password if shared publicly
3. Use strong random JWT secret (32+ chars)
4. Restrict MongoDB Atlas network access if possible
5. Set LOG_LEVEL=info (or warn in production)
6. Review rate limit settings based on expected traffic

## 12) Minimal Env Templates

### Server Template

```env
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb+srv://<atlas_user>:<atlas_password>@<cluster>/<db>?retryWrites=true&w=majority
REDIS_URL=redis://default:<redis_password>@redis-11388.crce281.ap-south-1-3.ec2.cloud.redislabs.com:11388
JWT_SECRET=<strong_random_secret>
CORS_ORIGIN=https://<client-url>
GITHUB_CLIENT_ID=<client_id>
GITHUB_CLIENT_SECRET=<client_secret>
GITHUB_REDIRECT_URI=https://<client-url>/github/callback
```

### Worker Template

```env
NODE_ENV=production
REDIS_URL=redis://default:<redis_password>@redis-11388.crce281.ap-south-1-3.ec2.cloud.redislabs.com:11388
EXECUTION_TIMEOUT_MS=10000
MAX_CODE_CHARS=200000
MAX_INPUT_CHARS=10000
MAX_FILES=50
MAX_FILE_NAME_CHARS=255
MAX_FILE_CONTENT_CHARS=200000
MAX_TOTAL_FILE_CHARS=1000000
MAX_OUTPUT_CHARS=200000
```

### Client Template

```env
REACT_APP_API_URL=https://<server-url>
```

## 13) Recommended Deployment Sequence Summary

1. Deploy Server on Render
2. Deploy Worker on Render (Docker)
3. Deploy Client on Render Static Site
4. Update server CORS and GitHub redirect with final client URL
5. Run full verification checklist
