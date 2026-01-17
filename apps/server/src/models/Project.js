const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
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
  recordings: [
    {
      id: String,
      title: String,
      startTime: Date,
      endTime: Date,
      duration: Number,
      size: Number,
      recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      status: { type: String, enum: ['recording', 'completed', 'failed'], default: 'completed' },
      createdAt: { type: Date, default: Date.now }
    }
  ],
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

module.exports = mongoose.model('Project', projectSchema);
