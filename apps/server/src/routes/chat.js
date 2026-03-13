const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const jwt = require('jsonwebtoken');

// Simple auth middleware
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    console.log('[Chat] No token provided');
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_secret_key');
    req.userId = decoded.userId;
    next();
  } catch (error) {
    console.log('[Chat] Invalid token:', error.message);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Get chat history for a project
router.get('/project/:projectId', verifyToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    console.log('[Chat] GET chat history for project:', projectId);
    const project = await Project.findById(projectId).select('chatHistory').lean();
    if (!project) {
      console.log('[Chat] Project not found:', projectId);
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json({ chatHistory: project.chatHistory || [] });
  } catch (err) {
    console.error('[Chat] Get history error:', err.message);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

// Clear all chat messages for a project (Owner/Admin only)
router.delete('/project/:projectId', verifyToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    console.log('[Chat] DELETE request for project:', projectId);
    
    const project = await Project.findById(projectId);
    if (!project) {
      console.log('[Chat] Project not found for deletion:', projectId);
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Check if user is owner
    const isOwner = project.owner.toString() === req.userId;
    if (!isOwner) {
      return res.status(403).json({ error: 'Only project owner can clear chat history' });
    }
    
    // Clear chat history in database
    project.chatHistory = [];
    await project.save();
    
    console.log('[Chat] Chat history cleared successfully for project:', projectId);
    
    // Notify all users in the room via socket
    // Get io instance from app (we'll set this up)
    const io = req.app.get('io');
    if (io) {
      console.log('[Chat] Emitting chat-cleared event to room:', projectId);
      io.to(projectId).emit('chat-cleared', { 
        message: 'Chat history has been cleared',
        clearedBy: req.userId,
        timestamp: new Date()
      });
    }
    
    res.json({ success: true, message: 'Chat history cleared' });
  } catch (err) {
    console.error('[Chat] Clear history error:', err.message);
    res.status(500).json({ error: 'Failed to clear chat history: ' + err.message });
  }
});

module.exports = router;
