const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  code: String,
  language: String,
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

module.exports = mongoose.model('Submission', submissionSchema);
