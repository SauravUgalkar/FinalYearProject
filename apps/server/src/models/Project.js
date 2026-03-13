const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  roomId: {
    type: String,
    default: function () {
      return this._id ? this._id.toString() : undefined;
    }
  }, // Unique room identifier
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Admin who created the room
  isInviteOnly: { type: Boolean, default: false }, // Require invitation to join
  invitedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Users invited by admin
  activeUsers: [{ 
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName: String,
    joinedAt: { type: Date, default: Date.now }
  }], // Currently connected users
  collaborators: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      email: String,
      name: String,
      role: { type: String, enum: ['viewer', 'editor', 'admin'], default: 'editor' },
      joinedAt: { type: Date, default: Date.now }
    }
  ],
  shareToken: { type: String, unique: true, sparse: true },
  shareTokenExpiry: Date,
  files: [
    {
      name: String,
      content: String,
      language: String,
      lastModified: { type: Date, default: Date.now },
      modifications: [
        {
          lineNumber: Number,
          userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
          userName: String,
          timestamp: { type: Date, default: Date.now },
          content: String
        }
      ]
    }
  ],
  language: { type: String, enum: ['javascript', 'python', 'java', 'cpp', 'csharp'], required: true },
  status: { type: String, enum: ['active', 'archived', 'completed'], default: 'active' },
  isPublic: { type: Boolean, default: false },
  githubUrl: String,
  submissions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Submission' }],
  gitStatus: {
    staged: [String],
    unstaged: [String],
    untracked: [String],
    branch: { type: String, default: 'main' },
    commits: [
      {
        id: String,
        message: String,
        author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        date: Date,
        files: [String],
        createdAt: { type: Date, default: Date.now }
      }
    ]
  },
  analytics: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      userName: String,
      totalRuns: { type: Number, default: 0 },
      successfulRuns: { type: Number, default: 0 },
      failedRuns: { type: Number, default: 0 },
      totalErrors: { type: Number, default: 0 },
      executionTimes: [Number],
      lastActivity: { type: Date, default: Date.now }
    }
  ],
  chatHistory: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      userName: String,
      message: String,
      timestamp: { type: Date, default: Date.now }
    }
  ],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Enforce uniqueness only for valid string values and ignore null/missing roomId.
projectSchema.index(
  { roomId: 1 },
  {
    unique: true,
    partialFilterExpression: { roomId: { $type: 'string' } }
  }
);

// Ensure roomId is always populated to avoid unique null collisions
projectSchema.pre('save', function(next) {
  if (!this.roomId) {
    this.roomId = this._id.toString();
  }
  next();
});

module.exports = mongoose.model('Project', projectSchema);
