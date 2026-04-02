const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  avatar: { type: String },
  githubId: { type: String },
  githubUsername: { type: String },
  githubTokenCiphertext: { type: String },
  githubTokenIv: { type: String },
  githubTokenTag: { type: String },
  githubTokenUpdatedAt: { type: Date },
  // Legacy fallback; migration path unsets this after secure token storage is populated.
  githubAccessToken: { type: String },
  googleId: { type: String },
  codingLanguages: [String],
  totalProjects: { type: Number, default: 0 },
  totalCollaborations: { type: Number, default: 0 },
  weaknesses: [
    {
      category: String,
      description: String,
      frequency: Number,
      lastIdentified: Date
    }
  ],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
