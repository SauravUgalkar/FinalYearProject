# CollabCode Setup & Deployment Guide

## Table of Contents
1. [Initial Setup](#initial-setup)
2. [Local Development](#local-development)
3. [Production Deployment](#production-deployment)
4. [Troubleshooting](#troubleshooting)
5. [Advanced Configuration](#advanced-configuration)

---

## Initial Setup

### Step 1: Install Dependencies

```bash
# Navigate to project root
cd collab-code-desktop

# Install all workspace dependencies
npm install
```

### Step 2: Environment Configuration

```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your settings
# Important: Change JWT_SECRET and add your API keys
```

**Required Environment Variables:**
```env
# Server
NODE_ENV=development
PORT=5000

# Database
MONGODB_URI=mongodb://admin:password123@localhost:27017/collabcode

# Cache
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your_super_secret_jwt_key_change_in_production

# Optional APIs
GEMINI_API_KEY=your_google_gemini_api_key
GITHUB_CLIENT_ID=your_github_oauth_client_id
GITHUB_CLIENT_SECRET=your_github_oauth_secret
```

### Step 3: Start Docker Services

```bash
# Start MongoDB and Redis containers
docker compose up -d mongodb redis

# Verify services are running
docker ps
```

---

## Local Development

### Starting the Application

#### Option 1: Separate Terminals (Recommended)

```bash
# Terminal 1: Start backend server
cd apps/server
npm run dev

# Terminal 2: Start frontend
cd apps/client
npm start
```

#### Option 2: Using npm workspaces

```bash
# Start both server and client
npm run dev
```

### Access Points

| Service | URL |
|---------|-----|
| Web Application | http://localhost:3000 |
| Backend API | http://localhost:5000 |
| MongoDB | localhost:27017 |
| Redis | localhost:6379 |

### Testing the Setup

1. **Create Account:**
   - Navigate to http://localhost:3000/register
   - Fill in credentials
   - Click Register

2. **Create Project:**
   - Go to Dashboard
   - Click "New Project"
   - Select language and create

3. **Test Real-time:**
   - Open same project in two tabs
   - Type in one tab, see changes in other

4. **Test Code Execution:**
   - Write simple code (e.g., print statement)
   - Click "Run Code"
   - Check console output

### Development Workflows

#### Working on Backend
```bash
# Server automatically restarts on changes (nodemon)
npm run dev --workspace=apps/server

# Test API endpoints
curl http://localhost:5000/api/health
```

#### Working on Frontend
```bash
# React dev server with hot reload
npm start --workspace=apps/client

# Build for testing
npm run build --workspace=apps/client
```

#### Working on Worker
```bash
# Start worker (listens for jobs)
npm run dev --workspace=apps/worker
```

---

## Production Deployment

### Building for Production

#### 1. Build React Application
```bash
npm run build --workspace=apps/client
```

#### 2. Build Electron App
```bash
npm run electron-build --workspace=apps/client
```

#### 3. Build Docker Images
```bash
docker-compose build
```

### Deployment to Heroku

```bash
# Install Heroku CLI
# https://devcenter.heroku.com/articles/heroku-cli

# Create app
heroku create your-app-name

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=$(openssl rand -base64 32)
heroku config:set MONGODB_URI=your_production_mongodb_uri
heroku config:set REDIS_URL=your_production_redis_url

# Deploy
git push heroku main
```

### Self-Hosted Deployment

#### Using PM2
```bash
npm install -g pm2

# Start services
pm2 start apps/server/src/index.js --name "collabcode-server"
pm2 start apps/worker/src/index.js --name "collabcode-worker"

# Create startup hook
pm2 startup
pm2 save
```

#### Using Docker Compose
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

#### Nginx Reverse Proxy
```nginx
upstream api {
  server localhost:5000;
}

upstream frontend {
  server localhost:3000;
}

server {
  listen 80;
  server_name your-domain.com;

  # Redirect HTTP to HTTPS
  return 301 https://$server_name$request_uri;
}

server {
  listen 443 ssl http2;
  server_name your-domain.com;

  ssl_certificate /path/to/cert.pem;
  ssl_certificate_key /path/to/key.pem;

  # Frontend
  location / {
    proxy_pass http://frontend;
    proxy_http_version 1.1;
  }

  # API
  location /api {
    proxy_pass http://api;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
  }

  # WebSocket
  location /socket.io {
    proxy_pass http://api/socket.io;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";
  }
}
```

---

## Troubleshooting

### Common Issues

#### MongoDB Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:27017
```

**Solution:**
```bash
# Check if Docker container is running
docker ps | grep mongodb

# Start MongoDB
npm run docker:up

# Verify connection
docker exec collab-code-mongodb mongosh
```

#### Redis Connection Error
```
Error: Redis client error
```

**Solution:**
```bash
# Check Redis container
docker ps | grep redis

# Restart Redis
docker-compose restart redis

# Verify connection
redis-cli ping
```

#### Port Already in Use
```
Error: Port 5000 already in use
```

**Solution:**
```bash
# Linux/Mac: Kill process on port 5000
lsof -ti:5000 | xargs kill -9

# Windows (PowerShell)
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

#### Node Modules Issues
```bash
# Clear and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### WebSocket Connection Issues
```
Error: WebSocket connection failed
```

**Solution:**
- Check firewall settings
- Verify CORS configuration in server
- Check browser console for specific errors

#### Code Execution Timeout
```
Job timeout exceeded
```

**Solution:**
```javascript
// apps/worker/src/index.js
// Increase timeout (default 10s)
const { stdout, stderr } = await execAsync(executeCommand, {
  timeout: 30000, // 30 seconds
  maxBuffer: 1024 * 1024
});
```

---

## Advanced Configuration

### Database Scaling

#### MongoDB Atlas (Cloud)
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/collabcode?retryWrites=true&w=majority
```

#### MongoDB Replica Set
```env
MONGODB_URI=mongodb://admin:password@mongo1:27017,mongo2:27017,mongo3:27017/collabcode?replicaSet=rs0
```

### Redis Caching Strategy

```javascript
// Implement cache layer
const cache = new Map();

const getCachedData = async (key) => {
  if (cache.has(key)) return cache.get(key);
  
  const data = await fetchFromDB(key);
  cache.set(key, data);
  return data;
};
```

### Performance Optimization

#### 1. Database Indexing
```javascript
// models/Project.js
projectSchema.index({ owner: 1, createdAt: -1 });
projectSchema.index({ 'collaborators.userId': 1 });
```

#### 2. Caching Layer
```javascript
// Use Redis for frequently accessed data
redisClient.setEx(`project:${id}`, 3600, JSON.stringify(project));
```

#### 3. CDN for Static Assets
```javascript
// Serve client build from CDN
const CDN_URL = 'https://cdn.example.com/';
// Update build references
```

#### 4. Database Query Optimization
```javascript
// Use lean() for read-only queries
Project.find({ owner: userId }).lean();

// Use select() to limit fields
User.findById(id).select('name email avatar');
```

### Security Hardening

#### HTTPS/SSL
```bash
# Generate self-signed certificate
openssl req -x509 -newkey rsa:4096 -nodes -out cert.pem -keyout key.pem -days 365
```

#### Rate Limiting
```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});

app.use('/api/', limiter);
```

#### CORS Configuration
```javascript
const cors = require('cors');

app.use(cors({
  origin: ['http://localhost:3000', 'https://yourdomain.com'],
  credentials: true
}));
```

#### Input Validation
```javascript
const { body, validationResult } = require('express-validator');

router.post('/projects', [
  body('name').trim().isLength({ min: 1, max: 100 }),
  body('language').isIn(['javascript', 'python', 'java', 'cpp', 'csharp']),
  body('description').optional().trim().isLength({ max: 500 })
], handler);
```

### Monitoring & Logging

#### Winston Logger
```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'collabcode-server' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

logger.info('Server started on port 5000');
```

#### Error Tracking (Sentry)
```javascript
const Sentry = require("@sentry/node");

Sentry.init({
  dsn: "your_sentry_dsn",
  tracesSampleRate: 1.0
});

app.use(Sentry.Handlers.errorHandler());
```

---

## Maintenance

### Database Backup
```bash
# MongoDB backup
mongodump --uri="mongodb://admin:password@localhost:27017/collabcode" --out=/backup/mongo

# MongoDB restore
mongorestore --uri="mongodb://admin:password@localhost:27017/collabcode" /backup/mongo/collabcode
```

### Cleanup Tasks
```bash
# Remove old rooms (older than 7 days)
db.rooms.deleteMany({ createdAt: { $lt: new Date(Date.now() - 7*24*60*60*1000) } })
```

### Regular Updates
```bash
# Check for dependency updates
npm outdated

# Update packages
npm update

# Update major versions (with testing)
npm install package@latest
```

---

## Support & Resources

- **Documentation**: See README.md
- **API Reference**: `/docs/api.md`
- **Troubleshooting**: `/docs/troubleshooting.md`
- **Contributing**: `/CONTRIBUTING.md`

---

**Last Updated**: January 2026
