const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const RoomInvite = require('../models/RoomInvite');
const Project = require('../models/Project');
const User = require('../models/User');

/**
 * POST /api/invites/send
 * Admin sends invite to user
 * Requires: Authentication
 * Body: { roomId, userIdentifier, role } - userIdentifier can be email or username
 * role defaults to 'editor' if not provided (can be 'viewer', 'editor')
 */
router.post('/send', auth, async (req, res) => {
  try {
    const { roomId, userIdentifier, role = 'editor' } = req.body;
    const adminId = req.user.userId;
    
    // Validate role
    if (!['viewer', 'editor'].includes(role)) {
      return res.status(400).json({ 
        error: 'Invalid role. Must be "viewer" or "editor"' 
      });
    }

    console.log('[Invite] Incoming send request', {
      roomId,
      userIdentifier,
      adminId
    });

    // Validate room exists and user is admin
    const room = await Project.findById(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (room.owner.toString() !== adminId) {
      return res.status(403).json({ error: 'Only room admin can send invites' });
    }

    // Check if user exists in database (by email or name), case-insensitive
    const trimmedIdentifier = (userIdentifier || '').trim();
    const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const user = await User.findOne({
      $or: [
        { email: { $regex: new RegExp(`^${escapeRegExp(trimmedIdentifier)}$`, 'i') } },
        { name: { $regex: new RegExp(`^${escapeRegExp(trimmedIdentifier)}$`, 'i') } }
      ]
    }).collation({ locale: 'en', strength: 2 });

    console.log(`[Invite] Looking for user: "${trimmedIdentifier}", Found:`, user ? `${user.name} (${user.email})` : 'null');

    if (!user) {
      return res.status(404).json({ 
        error: 'User not found in database',
        message: `No user found with email or username: "${userIdentifier}". They must register first.` 
      });
    }

    // Prevent inviting yourself
    if (user._id.toString() === adminId) {
      return res.status(400).json({ error: 'Cannot invite yourself' });
    }

    // Check for existing pending invite
    const existingInvite = await RoomInvite.findOne({
      roomId,
      invitedUser: user._id,
      status: 'pending',
      expiresAt: { $gt: new Date() }
    });

    if (existingInvite) {
      return res.status(400).json({ error: 'User already has a pending invite' });
    }

    // Create invite with role
    const invite = new RoomInvite({
      roomId,
      invitedBy: adminId,
      invitedUser: user._id,
      role
    });

    await invite.save();

    // Add user to invitedUsers array in Project
    if (!room.invitedUsers.includes(user._id)) {
      room.invitedUsers.push(user._id);
      await room.save();
    }

    res.status(201).json({
      message: 'Invite sent successfully',
      invite: {
        id: invite._id,
        userId: user._id.toString(),
        userName: user.name,
        userEmail: user.email,
        role: invite.role,
        expiresAt: invite.expiresAt
      }
    });
  } catch (error) {
    console.error('Send invite error:', error);
    res.status(500).json({ error: 'Failed to send invite' });
  }
});

/**
 * GET /api/invites/pending
 * Get all pending invites for current user
 * Requires: Authentication
 */
router.get('/pending', auth, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Expire old invites first
    await RoomInvite.expireOldInvites();

    // Get pending invites
    const invites = await RoomInvite.find({
      invitedUser: userId,
      status: 'pending',
      expiresAt: { $gt: new Date() }
    })
      .populate('roomId', 'name description')
      .populate('invitedBy', 'name email')
      .sort({ createdAt: -1 });

    res.json({ invites });
  } catch (error) {
    console.error('Get pending invites error:', error);
    res.status(500).json({ error: 'Failed to fetch invites' });
  }
});

/**
 * POST /api/invites/:id/accept
 * User accepts an invite (but doesn't join yet - needs room ID)
 * Requires: Authentication
 */
router.post('/:id/accept', auth, async (req, res) => {
  try {
    const inviteId = req.params.id;
    const userId = req.user.userId;

    const invite = await RoomInvite.findById(inviteId);

    if (!invite) {
      return res.status(404).json({ error: 'Invite not found' });
    }

    if (invite.invitedUser.toString() !== userId) {
      return res.status(403).json({ error: 'This invite is not for you' });
    }

    if (!invite.isValid()) {
      return res.status(400).json({ error: 'Invite has expired' });
    }

    // Update status to accepted
    invite.status = 'accepted';
    await invite.save();

    res.json({
      message: 'Invite accepted. Please enter the Room ID to join.',
      invite: {
        id: invite._id,
        roomId: invite.roomId
      }
    });
  } catch (error) {
    console.error('Accept invite error:', error);
    res.status(500).json({ error: 'Failed to accept invite' });
  }
});

/**
 * POST /api/invites/:id/reject
 * User rejects an invite
 * Requires: Authentication
 */
router.post('/:id/reject', auth, async (req, res) => {
  try {
    const inviteId = req.params.id;
    const userId = req.user.userId;

    const invite = await RoomInvite.findById(inviteId);

    if (!invite) {
      return res.status(404).json({ error: 'Invite not found' });
    }

    if (invite.invitedUser.toString() !== userId) {
      return res.status(403).json({ error: 'This invite is not for you' });
    }

    // Update status to rejected
    invite.status = 'rejected';
    await invite.save();

    res.json({ message: 'Invite rejected' });
  } catch (error) {
    console.error('Reject invite error:', error);
    res.status(500).json({ error: 'Failed to reject invite' });
  }
});

/**
 * POST /api/invites/validate-room-id
 * User validates room ID and joins
 * Requires: Authentication
 * Body: { roomId, inviteId }
 */
router.post('/validate-room-id', auth, async (req, res) => {
  try {
    const { roomId, inviteId } = req.body;
    const userId = req.user.userId;

    // Find the invite
    const invite = await RoomInvite.findById(inviteId);

    if (!invite) {
      return res.status(404).json({ error: 'Invite not found' });
    }

    if (invite.invitedUser.toString() !== userId) {
      return res.status(403).json({ error: 'Invalid invite' });
    }

    if (invite.status !== 'accepted') {
      return res.status(400).json({ error: 'Invite must be accepted first' });
    }

    // Find the room/project
    const room = await Project.findById(invite.roomId);

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Validate room ID matches
    if (room._id.toString() !== roomId.trim() && room.roomId !== roomId.trim()) {
      return res.status(400).json({ 
        error: 'Invalid Room ID',
        message: 'The Room ID you entered does not match this invitation.'
      });
    }

    // Check if user is in invitedUsers
    if (!room.invitedUsers.some(id => id.toString() === userId)) {
      return res.status(403).json({ error: 'You were not invited to this room' });
    }

    // Add user to collaborators if not already there
    const isCollaborator = room.collaborators.some(
      c => c.userId && c.userId.toString() === userId
    );

    if (!isCollaborator) {
      const user = await User.findById(userId);
      room.collaborators.push({
        userId: userId,
        email: user.email,
        name: user.name,
        role: invite.role, // Use role from invite
        joinedAt: new Date()
      });
      await room.save();
    }

    res.json({
      message: 'Successfully joined room',
      project: {
        id: room._id,
        name: room.name,
        roomId: room.roomId || room._id
      }
    });
  } catch (error) {
    console.error('Validate room ID error:', error);
    res.status(500).json({ error: 'Failed to validate room ID' });
  }
});

module.exports = router;
