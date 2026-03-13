const Project = require('../models/Project');

class RoomManager {
  constructor(io, redisClient, executionQueue) {
    this.io = io;
    this.redisClient = redisClient;
    this.executionQueue = executionQueue;
    this.activeRooms = new Map();
    this.userRoomMap = new Map();
    this.codeChangeThrottle = new Map();
  }

  sanitizeName(rawName) {
    return String(rawName || '').trim();
  }

  normalizePath(rawPath) {
    return this.sanitizeName(rawPath).replace(/\/+$/, '');
  }

  sanitizeCodeStateFiles(files, fallbackLanguage) {
    return (files || [])
      .map((f) => {
        const name = this.sanitizeName(f?.name);
        if (!name) return null;
        // Strip .gitkeep placeholder files
        if (name === '.gitkeep' || name.endsWith('/.gitkeep')) return null;
        return {
          id: f?.id || f?._id?.toString() || name,
          name,
          content: typeof f?.content === 'string' ? f.content : '',
          language: f?.language || fallbackLanguage || 'javascript',
          lastModifiedBy: f?.lastModifiedBy || 'system',
          lastModifiedAt: f?.lastModifiedAt || f?.lastModified || new Date(),
        };
      })
      .filter(Boolean);
  }

  syncPersistentFiles(roomId, files, fallbackLanguage) {
    const room = this.activeRooms.get(roomId);
    if (!room) return null;

    room.codeState = room.codeState || {};
    room.codeState.files = this.sanitizeCodeStateFiles(files, fallbackLanguage);
    return room.codeState.files;
  }

  getCursorColor(userId) {
    const palette = [
      '#ef4444', '#f97316', '#eab308', '#22c55e', '#10b981',
      '#06b6d4', '#3b82f6', '#6366f1', '#a855f7', '#ec4899'
    ];

    const source = String(userId || 'anonymous');
    let hash = 0;
    for (let i = 0; i < source.length; i += 1) {
      hash = ((hash << 5) - hash) + source.charCodeAt(i);
      hash |= 0;
    }

    return palette[Math.abs(hash) % palette.length];
  }

  getUniqueUsers(usersMap) {
    const uniqueByUser = new Map();
    for (const user of Array.from(usersMap.values())) {
      const key = user?.userId ? String(user.userId) : `socket:${user?.socketId || 'unknown'}`;
      // Last write wins so reconnect/newer socket state is preferred.
      uniqueByUser.set(key, user);
    }
    return Array.from(uniqueByUser.values());
  }

  async joinRoom(socket, roomId, userId, userName) {
    try {
      if (!this.activeRooms.has(roomId)) {
        const project = await Project.findById(roomId).lean();
        const filesFromDb = this.sanitizeCodeStateFiles(project?.files || [], project?.language);
        this.activeRooms.set(roomId, {
          users: new Map(),
          codeState: {
            files: filesFromDb,
          },
          operations: [],
        });
      }

      const room = this.activeRooms.get(roomId);
      const project = await Project.findById(roomId).lean();

      // Always reconcile active room files from MongoDB on join so refreshes do not
      // rehydrate stale in-memory state after a delete.
      if (room && project) {
        room.codeState.files = this.sanitizeCodeStateFiles(project.files || [], project.language);
      }

      let role = 'viewer';
      if (project) {
        if (project.owner?.toString() === userId) {
          role = 'admin';
        } else {
          const collaborator = (project.collaborators || []).find((c) => c.userId?.toString() === userId);
          role = collaborator?.role || 'viewer';
        }
      }
      
      console.log(`[RoomManager] User ${userName} assigned role: ${role} in room ${roomId}`);
      
      // Add user to socket room
      socket.join(roomId);
      room.users.set(socket.id, {
        socketId: socket.id,
        userId,
        userName,
        role,
        cursorColor: this.getCursorColor(userId),
        cursorPosition: { lineNumber: 1, column: 1, fileName: null }
      });
      this.userRoomMap.set(socket.id, roomId);

      if (!room.lineEdits) {
        room.lineEdits = {};
      }

      socket.to(roomId).emit('user-joined', {
        userId,
        userName,
        role,
        socketId: socket.id,
        activeUsers: this.getUniqueUsers(room.users)
      });

      socket.emit('room-state', {
        roomId,
        codeState: room.codeState,
        activeUsers: this.getUniqueUsers(room.users)
      });

      this.io.to(roomId).emit('room-users', this.getUniqueUsers(room.users));
      await this.saveRoomState(roomId, room);
      console.log(`User ${userName} joined room ${roomId}`);
    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  }

  async handleCodeChange(socket, data) {
    const roomId = this.userRoomMap.get(socket.id);
    if (!roomId) return;

    const room = this.activeRooms.get(roomId);
    if (!room) return;

    const { fileId, content, language, changedLines } = data;
    const normalizedFileName = this.normalizePath(data.fileName || fileId);
    const user = room.users.get(socket.id);

    if (user?.role === 'viewer') {
      socket.emit('permission-denied', { action: 'edit', message: 'View-only users cannot edit code' });
      return;
    }

    // Initialize line edits tracking
    if (!room.lineEdits) {
      room.lineEdits = {};
    }
    if (!room.lineEdits[fileId]) {
      room.lineEdits[fileId] = {};
    }

    // Detect conflicts for changed lines
    const conflicts = [];
    if (changedLines && Array.isArray(changedLines)) {
      changedLines.forEach(lineNumber => {
        if (!room.lineEdits[fileId][lineNumber]) {
          room.lineEdits[fileId][lineNumber] = [];
        }

        // Check if another user is editing this line
        const otherEditors = room.lineEdits[fileId][lineNumber].filter(
          edit => edit.socketId !== socket.id && Date.now() - edit.timestamp < 5000 // 5 second window
        );

        if (otherEditors.length > 0) {
          conflicts.push({
            lineNumber,
            editors: otherEditors.map(e => ({ userId: e.userId, userName: e.userName }))
          });
        }

        // Update edit tracking for this line
        room.lineEdits[fileId][lineNumber] = room.lineEdits[fileId][lineNumber].filter(
          edit => edit.socketId !== socket.id && Date.now() - edit.timestamp < 5000
        );
        room.lineEdits[fileId][lineNumber].push({
          userId: user.userId,
          socketId: socket.id,
          userName: user.userName,
          timestamp: Date.now()
        });
      });
    }

    // If conflicts detected, notify all users about the conflict
    if (conflicts.length > 0) {
      console.log(`[RoomManager] Conflict detected in room ${roomId} on lines:`, conflicts);
      this.io.to(roomId).emit('edit-conflict', {
        fileId,
        conflicts,
        currentUser: { userId: user.userId, userName: user.userName, socketId: socket.id },
        timestamp: new Date()
      });
    }

    // Update code state
    if (!room.codeState.files) room.codeState.files = [];
    
    // Support matching by id OR name, since clients may send either
    const fileIndex = room.codeState.files.findIndex((f) => {
      const normalizedName = this.normalizePath(f.name);
      return f.id === fileId || normalizedName === normalizedFileName;
    });
    let isNewFile = false;
    
    if (fileIndex >= 0) {
      const existingContent = room.codeState.files[fileIndex].content || '';
      if (existingContent === content && !data.isNewFile) {
        return;
      }
      room.codeState.files[fileIndex].content = content;
      room.codeState.files[fileIndex].lastModifiedBy = user.userName;
      room.codeState.files[fileIndex].lastModifiedAt = new Date();
    } else {
      isNewFile = data.isNewFile === true;
      if (!normalizedFileName) {
        socket.emit('error', { message: 'File name cannot be empty' });
        return;
      }

      room.codeState.files.push({
        id: fileId || normalizedFileName,
        name: normalizedFileName,
        content,
        language: language || 'javascript',
        lastModifiedBy: user.userName,
        lastModifiedAt: new Date()
      });
    }

    // Persist file changes to MongoDB for durability across sessions
    try {
      await Project.findByIdAndUpdate(
        roomId,
        {
          $set: {
            files: room.codeState.files.map((f) => ({
              name: this.sanitizeName(f.name),
              content: f.content,
              language: f.language,
              lastModified: f.lastModifiedAt || new Date(),
              lastModifiedBy: f.lastModifiedBy || 'system'
            })),
            updatedAt: new Date(),
          },
        },
        { new: false }
      );
      console.log(`[RoomManager] Persisted ${room.codeState.files.length} files to MongoDB for room ${roomId}`);
    } catch (err) {
      console.error('[RoomManager] Failed to persist file change to MongoDB:', err.message);
    }

    // Broadcast all content updates so insert/delete/replace remain in sync.
    if (isNewFile || typeof content === 'string') {
      const broadcastData = {
        fileId: fileId || normalizedFileName,
        fileName: normalizedFileName,
        content,
        language: data.language,
        modifiedBy: user.userName,
        isNewFile,
        isFallbackSync: Boolean(data.isFallbackSync),
        timestamp: new Date(),
        hasConflicts: conflicts.length > 0
      };

      // For new files, broadcast to ALL users including the creator for state consistency
      if (isNewFile) {
        this.io.to(roomId).emit('code-changed', broadcastData);
      } else {
        // For code changes, broadcast to others only to avoid duplicate processing
        socket.to(roomId).emit('code-changed', broadcastData);
      }
    }

    // Store operation for undo/redo
    room.operations.push({
      type: 'code-change',
      userId: user.userId,
      userName: user.userName,
      fileId,
      content,
      timestamp: new Date()
    });

    // Cache in Redis for quick recovery
    try {
      await this.redisClient.setex(`room:${roomId}:code`, 3600, JSON.stringify(room.codeState));
    } catch (err) {
      console.warn('Warning: Could not cache to Redis:', err.message);
    }
  }

  // Helper to detect which lines changed
  getChangedLines(oldContent, newContent) {
    const oldLines = (oldContent || '').split('\n');
    const newLines = (newContent || '').split('\n');
    const changedLines = [];
    const maxLength = Math.max(oldLines.length, newLines.length);

    for (let i = 0; i < maxLength; i++) {
      if ((oldLines[i] || '') !== (newLines[i] || '')) {
        changedLines.push(i + 1); // 1-indexed line numbers
      }
    }

    return changedLines;
  }

  handleChatMessage(socket, data) {
    const roomId = this.userRoomMap.get(socket.id);
    if (!roomId) {
      console.error(`[RoomManager] Chat error: Socket ${socket.id} not in any room. Active rooms: ${this.userRoomMap.size}, Known sockets: ${Array.from(this.userRoomMap.keys()).join(', ')}`);
      socket.emit('error', { message: 'Not in a room. Please refresh and rejoin.' });
      return;
    }

    const room = this.activeRooms.get(roomId);
    if (!room) {
      console.error(`[RoomManager] Chat error: Room ${roomId} not found in activeRooms`);
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    const user = room.users.get(socket.id);
    if (!user) {
      console.error(`[RoomManager] Chat error: Socket ${socket.id} not found in room ${roomId}. Room has ${room.users.size} users`);
      socket.emit('error', { message: 'User not found in room' });
      return;
    }

    const message = {
      userId: user.userId,
      userName: user.userName,
      message: data.message || data.text,
      timestamp: new Date()
    };

    console.log(`[RoomManager] Chat message from ${user.userName} in room ${roomId}: ${data.message}`);

    if (!room.chatHistory) room.chatHistory = [];
    room.chatHistory.push(message);

    // Keep only last 100 messages
    if (room.chatHistory.length > 100) {
      room.chatHistory = room.chatHistory.slice(-100);
    }

    // Persist chat message to Project for durability across sessions
    try {
      Project.findByIdAndUpdate(
        roomId,
        {
          $push: { chatHistory: message },
          $set: { updatedAt: new Date() }
        },
        { new: false }
      ).catch(err => console.error('[RoomManager] Failed to persist chat message:', err.message));
    } catch (err) {
      console.error('[RoomManager] Chat persistence error:', err.message);
    }

    // Broadcast to all in room (including sender)
    this.io.to(roomId).emit('chat-message-received', message);
  }

  handleCursorMove(socket, data) {
    const roomId = this.userRoomMap.get(socket.id);
    if (!roomId) return;

    const room = this.activeRooms.get(roomId);
    if (!room) return;

    const user = room.users.get(socket.id);
    if (!user) return;

    const position = data?.position || {};
    const normalizedPosition = {
      lineNumber: Math.max(1, Number(position.lineNumber || position.line || 1)),
      column: Math.max(1, Number(position.column || 1)),
      fileName: data?.fileName || position.fileName || null,
    };

    user.cursorPosition = normalizedPosition;

    // Broadcast cursor position
    socket.to(roomId).emit('cursor-moved', {
      socketId: socket.id,
      userId: user.userId,
      userName: user.userName,
      cursorColor: user.cursorColor,
      position: normalizedPosition
    });
  }

  async handleCodeExecution(socket, data) {
    const roomId = this.userRoomMap.get(socket.id);
    if (!roomId) {
      socket.emit('execution-error', { compileError: null, runtimeError: 'Room not found', output: '' });
      return;
    }

    const room = this.activeRooms.get(roomId);
    if (!room) {
      socket.emit('execution-error', { compileError: null, runtimeError: 'Active room not found', output: '' });
      return;
    }
    
    const user = room.users.get(socket.id);
    
    if (!user) {
      socket.emit('execution-error', { compileError: null, runtimeError: 'User not found in room', output: '' });
      return;
    }

    console.log(`[RoomManager] User ${user.userName} (role: ${user.role}) attempting code execution in room ${roomId}`);

    if (user.role === 'viewer') {
      socket.emit('execution-error', { compileError: null, runtimeError: 'View-only users cannot execute code', output: '' });
      return;
    }

    try {
      console.log(`[RoomManager] Code execution approved for ${user.userName} (role: ${user.role})`);
      
      // Add job to execution queue
      const job = await this.executionQueue.add('execute', {
        roomId,
        userId: user.userId,
        userName: user.userName,
        code: data.code,
        language: data.language,
        input: data.input || '',
        entryFileName: data.activeFileName || data.entryFileName || null,
        files: Array.isArray(data.files) ? data.files : []
      });

      console.log(`[RoomManager] Job added with ID: ${job.id}`);
      
      // Store the job-room-socket mapping for later result delivery (user-specific)
      if (global.jobRoomMap) {
        global.jobRoomMap.set(job.id, {
          roomId,
          socketId: socket.id,
          userId: user.userId,
          userName: user.userName,
          code: data.code,
          language: data.language,
        });
        console.log(`[RoomManager] Stored mapping: job ${job.id} -> room ${roomId}, socket ${socket.id}, user ${user.userName}`);
      }
      
      socket.emit('execution-started', { jobId: job.id });

      // Emit to room that code is executing (optional - other users can see someone is running code)
      this.io.to(roomId).emit('code-executing', {
        userId: user.userId,
        userName: user.userName,
        language: data.language,
        timestamp: new Date()
      });

    } catch (error) {
      console.error('[RoomManager] Code execution error:', error.message);
      socket.emit('execution-error', { 
        compileError: null,
        runtimeError: 'Failed to queue code execution: ' + error.message,
        output: ''
      });
    }
  }

  async handleFileDelete(socket, data) {
    const roomId = this.userRoomMap.get(socket.id);
    if (!roomId) return;

    const room = this.activeRooms.get(roomId);
    if (!room) return;

    const rawTargetPath = data.path || data.fileId;
    const fileId = this.normalizePath(rawTargetPath);
    const deleteType = data.type === 'folder' ? 'folder' : 'file';
    const user = room.users.get(socket.id);

    if (user?.role === 'viewer') {
      socket.emit('error', { message: 'View-only users cannot delete files' });
      return;
    }

    if (!fileId) {
      socket.emit('error', { message: 'Delete path cannot be empty' });
      return;
    }

    // Remove file from code state and handle folder deletions
    if (room.codeState.files) {
      const folderPath = fileId;
      const folderPrefix = `${folderPath}/`;

      room.codeState.files = room.codeState.files.filter(
        (f) => {
          const normalizedName = this.normalizePath(f.name);
          if (normalizedName === folderPath || f.id === fileId) return false;
          if (deleteType === 'folder' && normalizedName.startsWith(folderPrefix)) return false;
          return true;
        }
      );
    }

    // Persist deletion to MongoDB
    try {
      await Project.findByIdAndUpdate(roomId, {
        $set: {
          files: room.codeState.files.map((f) => ({
            name: this.sanitizeName(f.name),
            content: f.content,
            language: f.language,
            lastModified: f.lastModifiedAt || new Date(),
            lastModifiedBy: f.lastModifiedBy || 'system'
          })),
          updatedAt: new Date(),
        },
      });
      console.log(`[RoomManager] Persisted deletion - ${room.codeState.files.length} files remain in room ${roomId}`);
    } catch (err) {
      console.error('[RoomManager] Failed to persist file deletion:', err.message);
    }

    // Broadcast to collaborators only; deleter already updated local UI.
    socket.broadcast.to(roomId).emit('file-deleted-remote', {
      fileId,
      type: deleteType,
      deletedBy: user.userName,
      timestamp: new Date()
    });

    console.log(`[RoomManager] File deleted from room ${roomId} by ${user.userName}: ${fileId}`);

    // Store operation for undo/redo
    room.operations.push({
      type: 'file-delete',
      userId: user.userId,
      userName: user.userName,
      fileId,
      timestamp: new Date()
    });
  }

  leaveRoom(socket, roomId) {
    const room = this.activeRooms.get(roomId);
    if (!room) return;

    const user = room.users.get(socket.id);
    if (user) {
      room.users.delete(socket.id);
      this.userRoomMap.delete(socket.id);

      socket.to(roomId).emit('cursor-removed', {
        socketId: socket.id,
        userId: user.userId,
      });

      socket.to(roomId).emit('user-left', {
        userId: user.userId,
        userName: user.userName,
        activeUsers: this.getUniqueUsers(room.users)
      });

      // Broadcast updated user list to entire room
      this.io.to(roomId).emit('room-users', this.getUniqueUsers(room.users));

      // Clean up empty rooms
      if (room.users.size === 0) {
        this.activeRooms.delete(roomId);
      }
    }

    socket.leave(roomId);
  }

  handleDisconnect(socket) {
    const roomId = this.userRoomMap.get(socket.id);
    if (roomId) {
      this.leaveRoom(socket, roomId);
    }
  }

  async saveRoomState(roomId, room) {
    try {
      await this.redisClient.setex(
        `room:${roomId}`,
        3600,
        JSON.stringify({
          users: Array.from(room.users.entries()),
          codeState: room.codeState,
          chatHistory: room.chatHistory || []
        })
      );
    } catch (error) {
      console.warn('Warning: Could not save room state to Redis:', error.message);
    }
  }

  getUserRole(socketId) {
    const roomId = this.userRoomMap.get(socketId);
    if (!roomId) return null;
    const room = this.activeRooms.get(roomId);
    if (!room) return null;
    const user = room.users.get(socketId);
    return user?.role || null;
  }
}

module.exports = RoomManager;
