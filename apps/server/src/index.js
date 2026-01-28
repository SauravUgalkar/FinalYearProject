

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const IORedis = require("ioredis");
const { Queue, QueueEvents } = require("bullmq");
const Project = require("./models/Project");

// -----------------------------------------------------------------------------
// ENV VALIDATION (FAIL FAST)
// -----------------------------------------------------------------------------
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;
const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

if (!MONGODB_URI) {
  console.error("❌ MONGODB_URI is not defined in .env");
  process.exit(1);
}

// -----------------------------------------------------------------------------
// APP + SERVER SETUP
// -----------------------------------------------------------------------------
const app = express();
const server = http.createServer(app);

// Parse CORS origins from environment variable
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
  : ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"];

console.log("CORS Origins:", corsOrigins);

const io = new Server(server, {
  cors: {
    origin: corsOrigins,
    credentials: true,
    methods: ["GET", "POST"],
  },
});

// -----------------------------------------------------------------------------
// MIDDLEWARE
// -----------------------------------------------------------------------------
app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Explicitly handle preflight requests
app.options("*", cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// -----------------------------------------------------------------------------
// REDIS (IOREDIS) + BULLMQ
// -----------------------------------------------------------------------------
// BullMQ requires maxRetriesPerRequest to be null to avoid deprecation warnings
const redisClient = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

redisClient.on("connect", () => {
  console.log("Redis connected");
});

redisClient.on("error", (err) => {
  console.error("Redis error:", err);
});

const executionQueue = new Queue("code-execution", {
  connection: redisClient,
});

// Create QueueEvents for cross-process communication
const queueEvents = new QueueEvents("code-execution", {
  connection: redisClient,
});

// Store roomId mapping for jobs
const jobRoomMap = new Map();

// Persist execution analytics per user for the project (room)
const persistAnalyticsForJob = async (jobInfo, status, executionTime = 0) => {
  if (!jobInfo?.roomId || !jobInfo?.userId) return;

  try {
    const project = await Project.findById(jobInfo.roomId);
    if (!project) return;

    if (!Array.isArray(project.analytics)) {
      project.analytics = [];
    }

    let userAnalytics = project.analytics.find(
      (a) => a.userId && a.userId.toString() === String(jobInfo.userId)
    );

    if (!userAnalytics) {
      userAnalytics = {
        userId: jobInfo.userId,
        userName: jobInfo.userName || "Unknown",
        totalRuns: 0,
        successfulRuns: 0,
        failedRuns: 0,
        totalErrors: 0,
        executionTimes: [],
        lastActivity: new Date(),
      };
      project.analytics.push(userAnalytics);
    }

    userAnalytics.totalRuns += 1;
    userAnalytics.lastActivity = new Date();

    if (status === "success") {
      userAnalytics.successfulRuns += 1;
      if (typeof executionTime === "number") {
        userAnalytics.executionTimes.push(executionTime);
      }
    } else {
      userAnalytics.failedRuns += 1;
      userAnalytics.totalErrors += 1;
    }

    await project.save();
  } catch (err) {
    console.error("[Analytics] Failed to persist execution analytics:", err.message);
  }
};

// Listen for job events - use all events to debug
queueEvents.on("progress", (jobId, progress) => {
  console.log(`[Queue] Progress event - Job: ${jobId}, Progress: ${progress}`);
});

queueEvents.on("completed", (job) => {
  console.log(`[Queue] Completed event received`, job);
  console.log(`[Queue] Job object keys:`, Object.keys(job));
  
  const jobId = job?.jobId || job?.id;
  console.log(`[Queue] Extracted jobId: ${jobId}`);
  const returnvalue = job?.returnvalue || job?.result;
  console.log(`[Queue] Extracted returnvalue:`, returnvalue);
  
  if (jobId) {
    const jobInfo = jobRoomMap.get(jobId);
    console.log(`[Queue] Looking up info for job ${jobId}:`, jobInfo);
    
    if (jobInfo) {
      const { roomId, socketId } = jobInfo;
      
      // Check if execution resulted in an error
      if (returnvalue?.status === 'error' || returnvalue?.error) {
        console.log(`[Queue] Execution had error, emitting execution-error to socket ${socketId}`);
        io.to(socketId).emit('execution-error', {
          jobId: jobId,
          error: returnvalue?.error || 'Execution failed',
          output: returnvalue?.output || ''
        });
        
        // Persist analytics as error
        persistAnalyticsForJob(jobInfo, 'error', 0);
      } else {
        console.log(`[Queue] Emitting execution-result to socket ${socketId}`);
        io.to(socketId).emit('execution-result', {
          jobId: jobId,
          output: returnvalue?.output || '',
          executionTime: returnvalue?.executionTime || 0,
          status: 'success'
        });
        
        // Persist analytics as success
        persistAnalyticsForJob(jobInfo, 'success', returnvalue?.executionTime || 0);
      }
      
      // Broadcast to room so owners/collaborators can see others' runs
      io.to(roomId).emit('execution-activity', {
        jobId,
        userId: jobInfo.userId,
        userName: jobInfo.userName,
        output: returnvalue?.output || '',
        executionTime: returnvalue?.executionTime || 0,
        status: returnvalue?.status === 'error' ? 'error' : 'success',
      });

      jobRoomMap.delete(jobId);
    } else {
      console.warn(`[Queue] No job info found for job ${jobId}`);
    }
  }
});

queueEvents.on("failed", (job) => {
  console.error(`[Queue] Failed event:`, job);
  const jobId = job?.jobId || job?.id;
  const failedReason = job?.failedReason || job?.error;
  
  if (jobId) {
    const jobInfo = jobRoomMap.get(jobId);
    if (jobInfo) {
      const { socketId, roomId } = jobInfo;
      console.log(`[Queue] Emitting execution-error to socket ${socketId}`);
      io.to(socketId).emit('execution-error', {
        jobId: jobId,
        error: failedReason || 'Job failed'
      });

      // Broadcast to the room for visibility
      io.to(roomId).emit('execution-activity', {
        jobId,
        userId: jobInfo.userId,
        userName: jobInfo.userName,
        error: failedReason || 'Job failed',
        status: 'error',
      });

      // Persist failed analytics
      persistAnalyticsForJob(jobInfo, 'error', 0);
      jobRoomMap.delete(jobId);
    }
  }
});

queueEvents.on("error", (error) => {
  console.error("[Queue] QueueEvents error:", error);
});

// Expose job room map for roomManager to use
global.jobRoomMap = jobRoomMap;

// -----------------------------------------------------------------------------
// MONGODB CONNECTION
// -----------------------------------------------------------------------------
console.log("Using Mongo URI:", process.env.MONGODB_URI);

const backfillRoomIds = async () => {
  try {
    const result = await Project.updateMany(
      { $or: [{ roomId: null }, { roomId: { $exists: false } }] },
      [
        {
          $set: {
            roomId: { $toString: '$_id' }
          }
        }
      ]
    );
    if (result.modifiedCount) {
      console.log(`Backfilled roomId for ${result.modifiedCount} project(s)`);
    }
  } catch (err) {
    console.error('Failed to backfill roomId:', err.message);
  }
};

mongoose
  .connect(MONGODB_URI)
  .then(async () => {
    console.log("MongoDB connected");
    await backfillRoomIds();
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  });

// -----------------------------------------------------------------------------
// ROUTES
// -----------------------------------------------------------------------------
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/auth", require("./routes/auth"));
app.use("/api/projects", require("./routes/projects"));
app.use("/api/analytics", require("./routes/analytics"));
app.use("/api/github", require("./routes/github"));
app.use("/api/recordings", require("./routes/recordings"));
app.use("/api/git", require("./routes/git"));
app.use("/api/chat", require("./routes/chat"));
app.use("/api/invites", require("./routes/invites"));

// -----------------------------------------------------------------------------
// SOCKET.IO
// -----------------------------------------------------------------------------
const RoomManager = require("./sockets/roomManager");
const yjsProvider = require("./sockets/yjsProvider");
const RoomInvite = require("./models/RoomInvite");
const roomManager = new RoomManager(io, redisClient, executionQueue);

io.on("connection", (socket) => {
  // Extract user identity from socket handshake
  const { token, userId, userName, userEmail } = socket.handshake.auth || {};
  
  // Attach user data directly to this socket connection (tab-isolated)
  socket.data = {
    userId: userId,
    userName: userName || 'Anonymous',
    userEmail: userEmail,
    token: token
  };
  
  console.log(`[Socket] Connected: ${socket.id}, User: ${userName} (${userId})`);

  socket.on("join-room", async (data) => {
    // Use socket.data for user identity instead of data params
    const effectiveUserId = socket.data.userId || data.userId;
    const effectiveUserName = socket.data.userName || data.userName;
    
    console.log(`[Socket] join-room requested for room ${data.roomId} by user ${effectiveUserName} (socket ${socket.id})`);
    
    try {
      // Security check: Verify user is authorized to join this room
      const room = await Project.findById(data.roomId);
      
      if (!room) {
        socket.emit('join-error', { 
          message: 'Room not found' 
        });
        return;
      }

      const isOwner = room.owner.toString() === effectiveUserId;
      const isCollaborator = room.collaborators.some(
        c => c.userId && c.userId.toString() === effectiveUserId
      );
      const isInvited = room.invitedUsers && room.invitedUsers.some(
        id => id.toString() === effectiveUserId
      );

      // Allow join if: owner, collaborator, invited, or public room
      if (!isOwner && !isCollaborator && !isInvited && !room.isPublic) {
        socket.emit('join-error', { 
          message: 'Access denied. You must be invited by the room admin to join this room.',
          requiresInvite: true
        });
        console.log(`[Socket] Access denied for user ${effectiveUserName} to room ${data.roomId}`);
        return;
      }

      // Authorized - proceed with join
      roomManager.joinRoom(socket, data.roomId, effectiveUserId, effectiveUserName);
    } catch (error) {
      console.error('[Socket] Error checking room permissions:', error);
      socket.emit('join-error', { 
        message: 'Failed to join room' 
      });
    }
  });

  socket.on("code-change", async (data) => {
    console.log(`[Socket] code-change from socket ${socket.id}`);
    await roomManager.handleCodeChange(socket, data);
  });

  // Yjs sync protocol for CRDT-based collaborative editing
  socket.on("yjs-sync", async (data) => {
    console.log(`[Socket] yjs-sync from socket ${socket.id}`);
    const { roomId, fileName, update } = data;
    
    if (!roomId || !fileName) return;

    try {
      console.log(`[Yjs] Before apply - docId: ${roomId}:${fileName}, update length: ${update?.length}`);
      
      // Apply the update to the shared document
      yjsProvider.applyUpdate(roomId, fileName, update);
      
      const currentContent = yjsProvider.getContent(roomId, fileName);
      console.log(`[Yjs] After apply - content length: ${currentContent.length}, first 100 chars: ${currentContent.substring(0, 100)}`);

      // Persist latest content to MongoDB for durability
      try {
        const content = yjsProvider.getContent(roomId, fileName);
        await Project.findOneAndUpdate(
          { _id: roomId, "files.name": fileName },
          {
            $set: {
              "files.$.content": content,
              "files.$.lastModified": new Date(),
              updatedAt: new Date(),
            },
          }
        );
      } catch (persistErr) {
        console.error(`[Yjs] Failed to persist content for ${fileName}:`, persistErr.message);
      }
      
      // Broadcast ONLY the update to other clients (not the sender, not the full state)
      // This prevents duplication - sender already has their changes applied locally
      console.log(`[Yjs] Broadcasting update to room ${roomId}, excluding socket ${socket.id}`);
      socket.to(roomId).emit("yjs-sync", {
        fileName,
        update: update  // Send the original update, not the full state
      });
      
      console.log(`[Yjs] Broadcast complete for ${fileName} in room ${roomId}`);
    } catch (error) {
      console.error(`[Yjs] Error processing update:`, error);
    }
  });

  // Request initial state for a file
  socket.on("yjs-state-request", async (data) => {
    const { roomId, fileName } = data;
    
    if (!roomId || !fileName) return;

    try {
      // Ensure doc initialized from persisted content
      try {
        const project = await Project.findById(roomId).lean();
        const file = project?.files?.find((f) => f.name === fileName);
        if (file) {
          yjsProvider.initializeDoc(roomId, fileName, file.content || "");
        }
      } catch (initErr) {
        console.error(`[Yjs] Failed to initialize doc for ${fileName}:`, initErr.message);
      }

      const state = yjsProvider.getState(roomId, fileName);
      socket.emit("yjs-state", {
        fileName,
        state: Array.from(state)
      });
      
      console.log(`[Yjs] Sent state for ${fileName} to socket ${socket.id}`);
    } catch (error) {
      console.error(`[Yjs] Error sending state:`, error);
    }
  });

  socket.on("chat-message", (data) => {
    console.log(`[Socket] chat-message from socket ${socket.id}`);
    roomManager.handleChatMessage(socket, data);
  });

  socket.on("cursor-move", (data) => {
    console.log(`[Socket] cursor-move from socket ${socket.id}`);
    roomManager.handleCursorMove(socket, data);
  });
      const role = roomManager.getUserRole(socket.id);
      if (role === 'viewer') {
        socket.emit('permission-denied', { action: 'edit', message: 'View-only users cannot edit code' });
        return;
      }

  socket.on("execute-code", (data) => {
    console.log(`[Socket] execute-code from socket ${socket.id}`);
    roomManager.handleCodeExecution(socket, data);
  });

  socket.on("file-deleted", (data) => {
    console.log(`[Socket] file-deleted from socket ${socket.id}`);
    roomManager.handleFileDelete(socket, data);
  });

  socket.on("leave-room", (data) => {
    console.log(`[Socket] leave-room from socket ${socket.id}`);
    roomManager.leaveRoom(socket, data.roomId);
  });

  socket.on("disconnect", () => {
    console.log(`[Socket] Disconnected: ${socket.id}`);
    roomManager.handleDisconnect(socket);
  });

  // Invite system events
  socket.on("invite-user-to-room", async (data) => {
    const { roomId, userId, roomName, invitedBy } = data;
    console.log(`[Socket] invite-user-to-room: ${invitedBy} inviting user ${userId} to ${roomName}`);
    
    try {
      // Find all sockets for the invited user
      const allSockets = await io.fetchSockets();
      const targetSockets = allSockets.filter(s => s.data.userId === userId);
      
      if (targetSockets.length > 0) {
        targetSockets.forEach(targetSocket => {
          targetSocket.emit('room-invite-received', {
            inviteId: data.inviteId,
            roomId,
            roomName,
            invitedBy,
            message: `${invitedBy} invited you to join "${roomName}"`,
            expiresAt: data.expiresAt
          });
        });
        console.log(`[Socket] Sent invite notification to ${targetSockets.length} socket(s)`);
      } else {
        console.log(`[Socket] User ${userId} not currently connected`);
      }
    } catch (error) {
      console.error('[Socket] Error sending invite notification:', error);
    }
  });

  socket.on("accept-invite-notification", async (data) => {
    const { inviteId } = data;
    console.log(`[Socket] accept-invite-notification for invite ${inviteId}`);
    
    try {
      const invite = await RoomInvite.findById(inviteId).populate('invitedBy', 'name');
      if (invite) {
        // Notify admin
        const allSockets = await io.fetchSockets();
        const adminSockets = allSockets.filter(s => s.data.userId === invite.invitedBy._id.toString());
        
        adminSockets.forEach(adminSocket => {
          adminSocket.emit('invite-accepted', {
            inviteId,
            userName: socket.data.userName
          });
        });
      }
    } catch (error) {
      console.error('[Socket] Error handling accept notification:', error);
    }
  });

  socket.on("user-joined-room-notification", async (data) => {
    const { roomId, userId, userName } = data;
    console.log(`[Socket] user-joined-room-notification: ${userName} joined room ${roomId}`);
    
    // Broadcast to all users in the room
    socket.to(roomId).emit('user-joined-room', {
      userId,
      userName,
      timestamp: new Date()
    });
  });

  // Log active room map periodically for debugging
  socket.on("debug-rooms", () => {
    console.log(`[Debug] Active rooms: ${roomManager.activeRooms.size}`);
    console.log(`[Debug] User-room map: ${roomManager.userRoomMap.size}`);
    roomManager.userRoomMap.forEach((roomId, socketId) => {
      console.log(`  ${socketId} -> ${roomId}`);
    });
  });
});

// -----------------------------------------------------------------------------
// GLOBAL ERROR HANDLER
// -----------------------------------------------------------------------------
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal Server Error" });
});

// -----------------------------------------------------------------------------
// START SERVER
// -----------------------------------------------------------------------------
server.listen(PORT, () => {
  console.log(`CollabCode Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});

// -----------------------------------------------------------------------------
// GRACEFUL SHUTDOWN
// -----------------------------------------------------------------------------
const shutdown = async () => {
  console.log("\nShutting down gracefully...");

  try {
    await queueEvents.close();
    await redisClient.quit();
    await mongoose.connection.close();
  } catch (err) {
    console.error("Shutdown error:", err);
  } finally {
    process.exit(0);
  }
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

module.exports = { app, io, executionQueue };
