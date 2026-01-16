# CollabCode - Collaborative Coding Platform

A desktop-based collaborative coding and student performance tracking platform for final-year projects.

## Features

### Core Features
- ✅ Real-time collaborative code editing with Monaco Editor
- ✅ Multi-language support (JavaScript, Python, Java, C++, C#)
- ✅ Multi-file project management
- ✅ Socket.io real-time synchronization
- ✅ Live chat and collaboration
- ✅ User authentication and project management

### Advanced Features (Phase 2+)
- 🔄 Code execution engine with Docker sandboxing
- 🤖 AI-powered code analysis using Google Gemini API
- 📊 Student performance analytics and weakness tracking
- 🎙️ PeerJS voice chat and screensharing
- 🎨 Shared whiteboard for brainstorming
- 📤 GitHub integration for project export
- 💾 Automatic code backup and version history

## Project Structure

```
collab-code-desktop/
├── apps/
│   ├── client/                  # React + Electron frontend
│   │   ├── public/              # Static files and Electron main process
│   │   └── src/renderer/        # React components and pages
│   ├── server/                  # Express backend
│   │   ├── src/
│   │   │   ├── models/          # MongoDB schemas
│   │   │   ├── routes/          # API endpoints
│   │   │   └── sockets/         # Real-time handlers
│   │   └── package.json
│   └── worker/                  # Code execution service
│       ├── src/index.js         # BullMQ worker
│       ├── Dockerfile           # Docker environment
│       └── package.json
├── docker-compose.yml           # Redis, MongoDB, Worker services
├── .env.example                 # Environment template
└── package.json                 # Root workspace config
```

## Prerequisites

- Node.js 16+
- Docker & Docker Compose
- MongoDB (via Docker)
- Redis (via Docker)

## Quick Start

### 1. Clone and Install

```bash
cd collab-code-desktop
npm install
cp .env.example .env
```

### 2. Configure Environment

Edit `.env` with your settings:
```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://admin:password123@localhost:27017/collabcode
REDIS_URL=redis://localhost:6379
JWT_SECRET=your_jwt_secret_key_change_this
GEMINI_API_KEY=your_google_gemini_api_key
```

### 3. Start Services

```bash
# Start MongoDB and Redis
npm run docker:up

# In another terminal, start the server
npm run start --workspace=apps/server

# In another terminal, start the client
npm start --workspace=apps/client
```

### 4. Access the Application

- **Web**: http://localhost:3000
- **Desktop**: Electron app opens automatically
- **Server API**: http://localhost:5000
- **MongoDB**: localhost:27017
- **Redis**: localhost:6379

## Development

### Running All Services

```bash
# Terminal 1: Docker services
npm run docker:up

# Terminal 2: Backend server
npm run dev --workspace=apps/server

# Terminal 3: Frontend
npm start --workspace=apps/client
```

### Building for Production

```bash
# Build React app
npm run build --workspace=apps/client

# Build Electron package
npm run electron-build --workspace=apps/client

# Build Docker images
docker-compose build
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update profile

### Projects
- `GET /api/projects` - List user projects
- `POST /api/projects` - Create project
- `GET /api/projects/:id` - Get project details
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

### Analytics
- `GET /api/analytics/user/:userId` - Get user analytics
- `POST /api/analytics/analyze` - Analyze code with AI
- `GET /api/analytics/weaknesses/:userId` - Get identified weaknesses

### GitHub
- `GET /api/github/auth-url` - Get GitHub OAuth URL
- `POST /api/github/callback` - Handle OAuth callback
- `POST /api/github/export/:projectId` - Export project to GitHub

## Real-Time Events (Socket.io)

### Client → Server
- `join-room` - Join collaborative session
- `code-change` - Code edited
- `chat-message` - Send chat message
- `cursor-move` - Cursor position update
- `execute-code` - Run code
- `leave-room` - Leave session

### Server → Client
- `user-joined` - User joined room
- `user-left` - User left room
- `code-changed` - Code changed by peer
- `chat-message-received` - New chat message
- `cursor-moved` - Peer cursor moved
- `execution-result` - Code execution result
- `execution-error` - Execution error
- `room-state` - Initial room state

## Database Schemas

### User
```javascript
{
  name: String,
  email: String (unique),
  password: String (hashed),
  avatar: String,
  codingLanguages: [String],
  weaknesses: [{
    category: String,
    frequency: Number,
    lastIdentified: Date
  }]
}
```

### Project
```javascript
{
  name: String,
  description: String,
  owner: ObjectId (User),
  collaborators: [{
    userId: ObjectId,
    joinedAt: Date
  }],
  files: [{
    name: String,
    content: String,
    language: String
  }],
  language: String,
  status: String ('active', 'archived', 'completed'),
  isPublic: Boolean,
  githubUrl: String
}
```

### Submission
```javascript
{
  projectId: ObjectId,
  userId: ObjectId,
  code: String,
  executionOutput: String,
  executionError: String,
  status: String ('pending', 'success', 'error', 'timeout'),
  aiAnalysis: {
    weaknesses: [String],
    improvements: [String],
    overallScore: Number,
    feedback: String
  }
}
```

## Worker Job Processing

The worker service processes code execution jobs from BullMQ:

```javascript
{
  roomId: String,
  userId: String,
  code: String,
  language: String,
  input: String
}
```

Returns:
```javascript
{
  status: 'success' | 'error' | 'timeout',
  output: String,
  error: String,
  executionTime: Number,
  memoryUsed: Number
}
```

## Docker Services

### MongoDB
- Image: `mongo:7.0`
- Port: 27017
- Volume: `mongodb_data`

### Redis
- Image: `redis:7.2-alpine`
- Port: 6379
- Volume: `redis_data`

### Worker
- Listens for code execution jobs
- Supports: JavaScript, Python, Java, C++, C#
- Execution timeout: 10 seconds
- Max output: 1MB

## Security Considerations

1. **Code Sandboxing**: All user code runs in isolated Docker containers
2. **Input Validation**: All inputs validated on server
3. **JWT Authentication**: Tokens expire in 7 days
4. **CORS Protection**: Restricted to localhost during development
5. **Rate Limiting**: Recommended for production deployment

## Deployment

### Heroku/Railway
1. Push to repository
2. Configure environment variables
3. Add buildpack for Node.js
4. Deploy Docker containers for services

### Self-Hosted
1. Set up server with Node.js and Docker
2. Configure reverse proxy (Nginx/Apache)
3. Enable HTTPS with Let's Encrypt
4. Set appropriate environment variables

## Future Enhancements

- [ ] Websocket improvements for better performance
- [ ] Database query optimization
- [ ] Real-time file system sync
- [ ] Advanced debugging features
- [ ] Team management and permissions
- [ ] Code review tools
- [ ] Integrated terminal
- [ ] Custom themes and extensions

## Contributing

1. Create feature branch (`git checkout -b feature/amazing-feature`)
2. Commit changes (`git commit -m 'Add amazing feature'`)
3. Push to branch (`git push origin feature/amazing-feature`)
4. Open Pull Request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- Open an issue on GitHub
- Check documentation in `/docs`
- Contact the development team

## Authors

Your Name - Final Year Project

---

**Happy Coding! 🎉**
