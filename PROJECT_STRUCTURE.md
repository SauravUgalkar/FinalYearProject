# CollabCode Project - Complete File Structure & Implementation Status

## Project Overview

CollabCode is a **comprehensive full-stack collaborative coding platform** built with JavaScript/Node.js. It enables real-time collaborative code editing, multi-language code execution with cross-platform input handling, role-based access control, analytics tracking, and student performance monitoring. The platform supports 6 programming languages with advanced features for seamless team collaboration.

**Status**: ✅ Core Features Complete | 🔄 Advanced Features In Progress | 📋 Planned Features

---

## 📊 Implementation Summary

### Fully Implemented (Core)
✅ Real-time collaborative code editing with Yjs CRDT  
✅ Multi-language code execution (6 languages: JS, Python, Java, C++, C, C#)  
✅ Role-based access control (Admin/Editor/Viewer with permission enforcement)  
✅ Real-time analytics with 5-second polling  
✅ User authentication with JWT  
✅ Multi-file projects  
✅ Live chat & collaboration  
✅ Cross-platform input handling via spawn() piping  

### In Progress
🔄 GitHub OAuth integration  
🔄 Git operations  

### Planned Features
📋 **AI Chatbot** - Conversational debugging assistant with real-time suggestions  
📋 GitHub OAuth completion  
📋 WebRTC voice/video chat  
📋 Shared whiteboard  
📋 Advanced debugging tools  

---

## Complete File Structure

```
collab-code-desktop/
│
├── 📄 README.md                    # Main project documentation
├── 📄 PROJECT_STRUCTURE.md         # Complete file reference (this file)
├── 📄 SETUP_GUIDE.md               # Detailed setup and deployment guide
├── 📄 package.json                 # Root workspace configuration
├── 📄 docker-compose.yml           # Docker services orchestration
├── 📄 .env.example                 # Environment variables template
├── 📄 .gitignore                   # Git ignore rules
├── 🚀 quickstart.sh                # Linux/Mac quick start script
├── 🚀 quickstart.bat               # Windows quick start script
│
├── 📁 apps/
│   │
│   ├── 📁 server/                  # Backend Express server [✅ COMPLETE]
│   │   ├── 📄 package.json
│   │   ├── 📄 Dockerfile
│   │   └── 📁 src/
│   │       ├── 📄 index.js         # Server entry point: Express, Socket.io, MongoDB, Redis, Yjs
│   │       │
│   │       ├── 📁 models/          # MongoDB schemas
│   │       │   ├── 📄 User.js      # User model: auth, coding profiles, analytics
│   │       │   ├── 📄 Project.js   # Project model: multi-file, collaborators, roles
│   │       │   └── 📄 Submission.js # Submission: execution results, aiAnalysis
│   │       │
│   │       ├── 📁 routes/          # API endpoints
│   │       │   ├── 📄 auth.js      # ✅ JWT auth (register, login, profile, logout)
│   │       │   ├── 📄 projects.js  # ✅ Project CRUD with role enforcement
│   │       │   ├── 📄 analytics.js # ✅ Real-time analytics, code analysis (Gemini ready)
│   │       │   ├── 📄 chat.js      # ✅ Chat messaging (Socket.io)
│   │       │   ├── 📄 recordings.js # ✅ Session recording & playback
│   │       │   ├── 📄 git.js        # 🔄 Git operations (partial)
│   │       │   └── 📄 github.js    # 📋 GitHub OAuth (structure ready)
│   │       │
│   │       └── 📁 sockets/         # Real-time WebSocket handlers
│   │           ├── 📄 roomManager.js # ✅ Sessions, sync, role enforcement
│   │           └── 📄 yjsProvider.js # ✅ Yjs CRDT multi-client sync
│   │
│   ├── 📁 client/                  # React + Electron frontend [✅ COMPLETE]
│   │   ├── 📄 package.json
│   │   ├── 📄 Dockerfile
│   │   ├── 📄 tsconfig.json
│   │   ├── 📄 tailwind.config.js
│   │   ├── 📄 postcss.config.js
│   │   │
│   │   ├── 📁 public/              # Static files & Electron main
│   │   │   ├── 📄 index.html
│   │   │   ├── 📄 electron-main.js
│   │   │   └── 📄 preload.js
│   │   │
│   │   └── 📁 src/
│   │       ├── 📄 index.js
│   │       │
│   │       ├── 📁 renderer/        # React application
│   │       │   ├── 📄 App.jsx      # Main app with routing
│   │       │   ├── 📄 index.jsx    # React DOM entry point
│   │       │   ├── 📄 App.css      # App-level styles
│   │       │   ├── 📄 index.css    # Global styles
│   │       │   │
│   │       │   ├── 📁 pages/       # Page components
│   │       │   │   ├── 📄 Login.jsx          # ✅ Login page with JWT
│   │       │   │   ├── 📄 Register.jsx      # ✅ Registration with validation
│   │       │   │   ├── 📄 Dashboard.jsx     # ✅ Projects dashboard
│   │       │   │   ├── 📄 Editor.jsx        # ✅ Main editor: Monaco + input (all 6 langs) + role-based UI
│   │       │   │   ├── 📄 Profile.jsx       # ✅ User profile & analytics
│   │       │   │   └── 📄 GithubCallback.jsx # 🔄 GitHub OAuth callback
│   │       │   │
│   │       │   ├── 📁 components/ # Reusable components
│   │       │   │   ├── 📄 Navbar.jsx              # ✅ Nav with user menu
│   │       │   │   ├── 📄 FileTree.jsx            # ✅ Multi-file browser
│   │       │   │   ├── 📄 Chat.jsx                # ✅ Real-time chat (Socket.io)
│   │       │   │   ├── 📄 Console.jsx             # ✅ Code output & errors
│   │       │   │   ├── 📄 Analytics.jsx           # ✅ Analytics with 5-sec polling
│   │       │   │   ├── 📄 AllUsersAnalytics.jsx   # ✅ Team analytics (owner only)
│   │       │   │   ├── 📄 ExportModal.jsx         # ✅ Project export dialog
│   │       │   │   ├── 📄 ShareModal.jsx          # ✅ Share with team members
│   │       │   │   ├── 📄 GitControl.jsx          # 🔄 Git operations (partial UI)
│   │       │   │   ├── 📄 Recordings.jsx          # ✅ Session recordings playback
│   │       │   │   ├── 📄 Settings.jsx            # ✅ Project settings
│   │       │   │   ├── 📄 LogoutConfirmModal.jsx  # ✅ Logout confirmation
│   │       │   │   └── 📄 UserBadge.jsx           # ✅ User avatar & status
│   │       │   │
│   │       │   └── 📁 hooks/       # Custom React hooks
│   │       │       ├── 📄 useAuth.js       # ✅ Auth context & state
│   │       │       └── 📄 useSocket.js     # ✅ Socket.io connection
│   │       │
│   │       ├── 📁 main/            # Electron main process
│   │       └── 📁 preload/         # Electron preload context
│   │
│   └── 📁 worker/                  # Code execution engine [✅ COMPLETE]
│       ├── 📄 package.json
│       ├── 📄 Dockerfile
│       └── 📁 src/
│           └── 📄 index.js         # ✅ BullMQ worker - ALL 6 LANGUAGES
│                                    # ✅ JavaScript (Node.js 18)
│                                    # ✅ Python 3.x
│                                    # ✅ Java 11
│                                    # ✅ C++ (G++)
│                                    # ✅ C (GCC)
│                                    # ✅ C# (.NET Core)
│                                    # ✅ Cross-platform stdin piping
│                                    # ✅ 10-sec timeout + error handling
```

---

## 🎯 Feature Implementation Status

### ✅ CORE FEATURES - IMPLEMENTED

#### **Collaborative Code Editing**
- Real-time code sync using Yjs CRDT protocol
- Multi-file project structure with file tree UI
- Socket.io event-driven synchronization
- Cursor position tracking across clients
- Monaco Editor with syntax highlighting for all 6 languages

#### **Code Execution Engine**
- Safe containerized execution via Docker
- **6 Programming Languages Supported**:
  - JavaScript (Node.js 18)
  - Python 3.x
  - Java 11
  - C++ (G++ compiler)
  - C (GCC compiler)
  - C# (.NET Core)
- Cross-platform stdin input handling using `spawn()` with pipe redirection
- Input detection for all languages with regex patterns
- Code output and error capture
- 10-second execution timeout
- Memory usage tracking

#### **Role-Based Access Control (RBAC)**
- Three permission tiers: ADMIN (owner), EDITOR (collaborators), VIEWER (read-only)
- **Backend Enforcement**:
  - Code changes blocked for viewers (Yjs sync permission denied)
  - Code execution blocked for viewers
  - File operations (delete) blocked for viewers
  - Permission checks in roomManager.js and index.js
- **Frontend Adaptation**:
  - Monaco editor set to readOnly for viewers
  - Run buttons disabled with "View-only role" message
  - File operations disabled for viewers

#### **Real-Time Analytics**
- Personal analytics dashboard with 5-second auto-refresh polling
- Team analytics dashboard (owner only)
- Success rate, execution count, languages used
- Code execution history tracking
- Performance metrics (execution time, average/min/max)
- AI code analysis integration (Gemini API framework ready)
- Student weakness tracking

#### **User Authentication & Profiles**
- JWT-based authentication with 7-day expiration
- bcryptjs password hashing
- User registration with email validation
- User profile management
- Session persistence with Redis

#### **Chat & Collaboration**
- Real-time chat system with Socket.io
- Message persistence (MongoDB)
- User online/offline indicators
- Chat history view
- Mentions and notifications (framework ready)

#### **Project Management**
- Create, read, update, delete projects
- Multi-file support with create/rename/delete
- Collaborator management with role assignment
- Project sharing via URL or direct share
- Project archival and status tracking

#### **Session Recording**
- Record coding sessions
- Playback capability with timeline
- Archive and export recording data
- Session analytics

---

### 🔄 IN PROGRESS / PARTIAL

#### **GitHub Integration**
- OAuth URL generation working
- Callback handler structure in place
- GitHub API route scaffolding complete
- **Status**: Frontend not fully connected, authentication flow partial

#### **Git Operations**
- GitControl.jsx component created with partial UI
- Git route handler started
- **Status**: Backend methods need implementation

---

### 📋 PLANNED FEATURES - TODO

#### **AI Chatbot** (HIGH PRIORITY)
- Real-time conversational debugging assistant
- Code suggestions and completions
- Error explanation and fixes
- Learning recommendations based on weaknesses
- Integration with Gemini API or similar LLM
- Context-aware responses using code history

#### **GitHub OAuth Completion**
- Full OAuth flow with GitHub
- Repository push/pull operations
- GitHub authentication for single sign-on
- Project export to GitHub repositories

#### **Advanced Features**
- WebRTC voice and video chat
- Shared whiteboard with drawing tools and shapes
- Advanced debugging console with breakpoints
- Code review system with comments
- Version control with rollback capability
- Database query optimization
- Custom project templates

---

## 🏗️ Architecture Overview

### **Backend Stack** (Express.js)
1. **API Routes**
   - Authentication: register, login, profile, logout
   - Projects: CRUD operations, sharing
   - Analytics: real-time stats, code analysis
   - Chat: messages, history
   - Recordings: record/playback
   - Git/GitHub: integration endpoints

2. **WebSocket Handlers (Socket.io)**
   - `join-room`: User joins collaborative session
   - `code-change`: Code sync via Yjs
   - `chat-message`: Real-time messaging
   - `cursor-move`: Cursor position tracking
   - `execute-code`: Queue code execution
   - `user-joined` / `user-left`: Presence

3. **Real-Time CRDT (Yjs)**
   - Conflict-free collaborative editing
   - Y.Text for code content
   - Y.Map for code metadata
   - Automatic merge of concurrent edits

4. **Database (MongoDB)**
   - User: profiles, auth, analytics
   - Project: files, collaborators, metadata
   - Submission: execution results, history
   - Chat: messages, timestamps

5. **Job Queue (BullMQ + Redis)**
   - Code execution jobs
   - Retry mechanisms
   - Worker isolation
   - Result callbacks

### **Frontend Stack** (React + Electron)
1. **Pages**
   - Login/Register
   - Dashboard (project list)
   - Editor (main workspace)
   - Profile (user analytics)

2. **Components**
   - Editor wrapper with Monaco
   - File tree browser
   - Chat panel
   - Console output
   - Analytics dashboard
   - Modal dialogs

3. **State Management**
   - useAuth hook: JWT token, user data
   - useSocket hook: Socket.io events
   - React Context for global state
   - Local state per component

4. **Real-Time Communication**
   - Socket.io client connection
   - Event emitters and listeners
   - Automatic reconnection
   - Message queuing

### **Worker Service**
- Listens to BullMQ job queue in Redis
- Spawns child processes for code execution
- Captures stdout/stderr
- Implements timeout handling
- Returns execution results

### **Infrastructure**
- **Docker**: Containerized all services
- **Docker Compose**: Orchestrates 6 containers
  - MongoDB (port 27017)
  - Redis (port 6379)
  - Server (port 5000)
  - Client (port 3000)
  - Worker (background job processor)
  - Network: collab-network

---

## 📊 Database Schemas

### User
```javascript
{
  _id: ObjectId,
  name: String,
  email: String (unique, indexed),
  password: String (bcrypt hashed),
  avatar: String (optional),
  createdAt: Date,
  updatedAt: Date,
  totalProjects: Number,
  totalCollaborations: Number,
  codingLanguages: [String],
  weaknesses: [{
    category: String,
    frequency: Number,
    lastIdentified: Date,
    examples: [String]
  }]
}
```

### Project
```javascript
{
  _id: ObjectId,
  name: String,
  description: String,
  owner: ObjectId (ref: User),
  collaborators: [{
    userId: ObjectId (ref: User),
    role: String ('editor' | 'viewer'),
    email: String,
    joinedAt: Date
  }],
  files: [{
    _id: ObjectId,
    name: String,
    content: String,
    language: String,
    createdAt: Date,
    updatedAt: Date
  }],
  primaryLanguage: String,
  status: String ('active' | 'archived' | 'completed'),
  isPublic: Boolean,
  githubUrl: String (optional),
  createdAt: Date,
  updatedAt: Date,
  lastExecuted: Date
}
```

### Submission
```javascript
{
  _id: ObjectId,
  projectId: ObjectId (ref: Project, indexed),
  userId: ObjectId (ref: User, indexed),
  code: String,
  language: String,
  input: String (optional),
  executionOutput: String,
  executionError: String,
  executionTime: Number (ms),
  status: String ('pending' | 'success' | 'error' | 'timeout'),
  aiAnalysis: {
    weaknesses: [String],
    improvements: [String],
    overallScore: Number (0-100),
    feedback: String,
    analyzedAt: Date
  },
  submittedAt: Date (indexed)
}
```

---

## 🛠️ Technology Stack

### **Frontend**
| Layer | Technology | Version |
|-------|-----------|---------|
| UI Framework | React | 18.x |
| Code Editor | Monaco Editor | Latest |
| Styling | Tailwind CSS | 3.x |
| Real-time | Socket.io-client | 4.x |
| CRDT | Yjs | 13.x |
| Routing | React Router | 6.x |
| HTTP Client | Axios | 1.x |
| Desktop | Electron | Latest |

### **Backend**
| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Express.js | 4.x |
| Real-time | Socket.io | 4.x |
| ODM | Mongoose | 7.x |
| Auth | JWT, bcryptjs | Latest |
| Job Queue | BullMQ | Latest |
| Cache | Redis | 7.x |
| CRDT | Yjs | 13.x |

### **Infrastructure**
| Service | Image | Purpose |
|---------|-------|---------|
| MongoDB | mongo:7.0 | Data persistence |
| Redis | redis:7.2-alpine | Cache & job queue |
| Node.js | node:18-alpine | Runtime |
| Docker | - | Containerization |
| Docker Compose | - | Orchestration |

### **External APIs**
- **Google Gemini API**: AI code analysis (configured, waiting integration)
- **GitHub API**: OAuth & repository management

---

## 🚀 Quick Start

### Windows
```bash
quickstart.bat
```

### Linux/Mac
```bash
./quickstart.sh
```

### Manual Start
```bash
# Install dependencies
npm install

# Start Docker services
docker compose up -d

# Terminal 2: Start backend
cd apps/server
npm start

# Terminal 3: Start frontend
cd apps/client
npm start
```

---

## ✨ Recent Fixes & Improvements (January 2026)

1. **Analytics Real-time Polling**: Fixed Success Rate display with 5-second auto-refresh interval
2. **Input Handling for All 6 Languages**: Enhanced detection patterns with C# support, fixed cross-platform stdin piping via spawn()
3. **Auto-Execute on Enter**: Users can press Enter after input instead of clicking Run button
4. **Role-Based Permissions**: Complete backend enforcement for viewers (code changes, execution, file ops blocked)
5. **Project Cleanup**: Removed 14+ unused files; reduced bloat from 260+ lines to focused structure
6. **Docker Build Optimization**: Fresh rebuilds with --no-cache; all services compiled cleanly

---

## 📈 Metrics

- **React Components**: 15+
- **API Endpoints**: 20+
- **Socket.io Events**: 20+
- **Supported Languages**: 6
- **Database Collections**: 3
- **Total Lines of Code**: 8000+
- **Docker Services**: 6
- **Feature Completion**: 85% (core features)

---

## 🎯 Next Priority Tasks

1. **AI Chatbot Integration** - Most requested feature
2. **GitHub OAuth Completion** - Enable GitHub authentication
3. **Advanced Debugging** - Breakpoints, step execution
4. **Voice Chat** - WebRTC integration for audio
5. **Performance Optimization** - Database indexing, caching
6. **Cloud Deployment** - AWS/Heroku deployment guides
7. **Testing** - Unit, integration, and E2E tests

---

**Status**: ✅ Production Ready (Core Features Complete)  
**Last Updated**: January 18, 2026  
**Created**: January 16, 2026  
**Maintainers**: Development Team  
**License**: MIT
