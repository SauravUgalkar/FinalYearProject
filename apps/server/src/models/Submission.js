const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String, default: 'Unknown' },
  executionId: { type: String, index: true },
  code: String,
  language: String,
  files: {
    type: [
      {
        filename: String,
        content: String,
      }
    ],
    default: [],
  },
  output: String,
  error: String,
  logs: String,
  executionOutput: String,
  executionError: String,
  executionTime: Number,
  memoryUsed: Number,
  status: { type: String, enum: ['pending', 'success', 'error', 'timeout'], default: 'pending' },
  aiAnalysis: {
    weaknesses: [String],
    improvements: [String],
    overallScore: Number,
    feedback: String
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

submissionSchema.index({ projectId: 1, createdAt: -1 });
submissionSchema.index({ projectId: 1, userId: 1, createdAt: -1 });
submissionSchema.index({ projectId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('Submission', submissionSchema);
