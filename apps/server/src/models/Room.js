const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  roomId: { type: String, unique: true, required: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  activeUsers: [
    {
      userId: String,
      userName: String,
      socketId: String,
      cursorPosition: { line: Number, column: Number },
      joinedAt: Date
    }
  ],
  codeState: {
    files: [
      {
        name: String,
        content: String,
        lastModifiedBy: String,
        lastModifiedAt: Date
      }
    ],
    currentFile: String
  },
  chatHistory: [
    {
      userId: String,
      userName: String,
      message: String,
      timestamp: Date
    }
  ],
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) }
});

// TTL index to auto-delete expired rooms
roomSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Room', roomSchema);
