const mongoose = require('mongoose');

const PROJECT_LIMITS = {
  MAX_PROJECT_FILES: Number(process.env.MAX_PROJECT_FILES || 200),
  MAX_FILE_CONTENT_CHARS: Number(process.env.MAX_FILE_CONTENT_CHARS || 200000),
  MAX_FILE_MODIFICATIONS: Number(process.env.MAX_FILE_MODIFICATIONS || 1000),
  MAX_ANALYTICS_ENTRIES: Number(process.env.MAX_ANALYTICS_ENTRIES || 200),
  MAX_EXECUTION_TIMES: Number(process.env.MAX_EXECUTION_TIMES || 200),
  MAX_CHAT_HISTORY: Number(process.env.MAX_CHAT_HISTORY || 1000),
  MAX_CHAT_MESSAGE_CHARS: Number(process.env.MAX_CHAT_MESSAGE_CHARS || 2000),
};

const withArrayLimit = (limit, label) => ({
  validator: (arr) => !Array.isArray(arr) || arr.length <= limit,
  message: `${label} cannot exceed ${limit} entries.`,
});

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
  files: {
    type: [
      {
        name: String,
        content: { type: String, maxlength: PROJECT_LIMITS.MAX_FILE_CONTENT_CHARS },
        language: String,
        lastModified: { type: Date, default: Date.now },
        modifications: {
          type: [
            {
              lineNumber: Number,
              userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
              userName: String,
              timestamp: { type: Date, default: Date.now },
              content: String
            }
          ],
          validate: withArrayLimit(PROJECT_LIMITS.MAX_FILE_MODIFICATIONS, 'File modifications')
        }
      }
    ],
    validate: withArrayLimit(PROJECT_LIMITS.MAX_PROJECT_FILES, 'Project files')
  },
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
        authorName: String,
        branch: String,
        date: Date,
        files: [String],
        createdAt: { type: Date, default: Date.now }
      }
    ]
  },
  analytics: {
    type: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        userName: String,
        totalRuns: { type: Number, default: 0 },
        successfulRuns: { type: Number, default: 0 },
        failedRuns: { type: Number, default: 0 },
        totalErrors: { type: Number, default: 0 },
        executionTimes: {
          type: [Number],
          validate: withArrayLimit(PROJECT_LIMITS.MAX_EXECUTION_TIMES, 'Execution time samples')
        },
        lastActivity: { type: Date, default: Date.now }
      }
    ],
    validate: withArrayLimit(PROJECT_LIMITS.MAX_ANALYTICS_ENTRIES, 'Analytics users')
  },
  chatHistory: {
    type: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        userName: String,
        message: { type: String, maxlength: PROJECT_LIMITS.MAX_CHAT_MESSAGE_CHARS },
        timestamp: { type: Date, default: Date.now }
      }
    ],
    validate: withArrayLimit(PROJECT_LIMITS.MAX_CHAT_HISTORY, 'Chat history')
  },
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
  if (Array.isArray(this.files) && this.files.length > PROJECT_LIMITS.MAX_PROJECT_FILES) {
    this.files = this.files.slice(-PROJECT_LIMITS.MAX_PROJECT_FILES);
  }

  if (Array.isArray(this.files)) {
    this.files = this.files.map((file) => {
      const nextFile = file;
      if (Array.isArray(nextFile.modifications) && nextFile.modifications.length > PROJECT_LIMITS.MAX_FILE_MODIFICATIONS) {
        nextFile.modifications = nextFile.modifications.slice(-PROJECT_LIMITS.MAX_FILE_MODIFICATIONS);
      }
      return nextFile;
    });
  }

  if (Array.isArray(this.analytics) && this.analytics.length > PROJECT_LIMITS.MAX_ANALYTICS_ENTRIES) {
    this.analytics = this.analytics.slice(-PROJECT_LIMITS.MAX_ANALYTICS_ENTRIES);
  }

  if (Array.isArray(this.analytics)) {
    this.analytics = this.analytics.map((entry) => {
      const nextEntry = entry;
      if (Array.isArray(nextEntry.executionTimes) && nextEntry.executionTimes.length > PROJECT_LIMITS.MAX_EXECUTION_TIMES) {
        nextEntry.executionTimes = nextEntry.executionTimes.slice(-PROJECT_LIMITS.MAX_EXECUTION_TIMES);
      }
      return nextEntry;
    });
  }

  if (Array.isArray(this.chatHistory) && this.chatHistory.length > PROJECT_LIMITS.MAX_CHAT_HISTORY) {
    this.chatHistory = this.chatHistory.slice(-PROJECT_LIMITS.MAX_CHAT_HISTORY);
  }

  if (!this.roomId) {
    this.roomId = this._id.toString();
  }
  next();
});

module.exports = mongoose.model('Project', projectSchema);
