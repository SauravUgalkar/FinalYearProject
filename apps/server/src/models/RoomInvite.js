const mongoose = require('mongoose');

const roomInviteSchema = new mongoose.Schema({
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true
  },
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  invitedUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  role: {
    type: String,
    enum: ['viewer', 'editor'],
    default: 'editor'
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'expired'],
    default: 'pending',
    index: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true,
    // Default TTL of 10 minutes from creation
    default: () => new Date(Date.now() + 10 * 60 * 1000)
  }
}, {
  timestamps: true
});

// Compound index for faster queries
roomInviteSchema.index({ roomId: 1, invitedUser: 1, status: 1 });

// TTL index - MongoDB will auto-delete expired documents
roomInviteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Instance method to check if invite is still valid
roomInviteSchema.methods.isValid = function() {
  return this.status === 'pending' && this.expiresAt > new Date();
};

// Static method to expire old invites
roomInviteSchema.statics.expireOldInvites = async function() {
  const now = new Date();
  await this.updateMany(
    { status: 'pending', expiresAt: { $lt: now } },
    { status: 'expired' }
  );
};

module.exports = mongoose.model('RoomInvite', roomInviteSchema);
