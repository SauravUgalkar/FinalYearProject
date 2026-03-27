const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { checkProjectMember } = require('../middleware/checkProjectMember');

// Simple auth middleware
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  console.log('[Chat Auth] Authorization header:', authHeader ? 'present' : 'missing');
  
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    console.log('[Chat Auth] No token provided in header');
    return res.status(401).json({ error: 'No token provided' });
  }
  
  console.log('[Chat Auth] Token provided, length:', token.length);
  
  try {
    const secret = process.env.JWT_SECRET || 'your_secret_key';
    console.log('[Chat Auth] Using JWT secret:', secret.substring(0, 5) + '...');
    
    const decoded = jwt.verify(token, secret);
    console.log('[Chat Auth] Token verified successfully');
    console.log('[Chat Auth] Decoded userId:', decoded.userId);
    
    req.userId = decoded.userId;
    next();
  } catch (error) {
    console.log('[Chat Auth] Token verification failed:', error.message);
    return res.status(401).json({ error: 'Invalid token', details: error.message });
  }
};

// Get chat history for a project
router.get('/project/:projectId', verifyToken, checkProjectMember(), async (req, res) => {
  try {
    const { projectId } = req.params;
    console.log('[Chat] GET chat history for project:', projectId);
    const project = req.project;
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
router.delete('/project/:projectId', verifyToken, checkProjectMember(), async (req, res) => {
  try {
    const { projectId } = req.params;
    console.log('[Chat] DELETE request for project:', projectId);
    console.log('[Chat] User ID from token:', req.userId);
    console.log('[Chat] User ID type:', typeof req.userId);
    
    const project = req.project;
    if (!project) {
      console.log('[Chat] Project not found for deletion:', projectId);
      return res.status(404).json({ error: 'Project not found' });
    }
    
    console.log('[Chat] Project owner:', project.owner);
    console.log('[Chat] Project owner type:', typeof project.owner);
    console.log('[Chat] Project owner string:', project.owner.toString());
    
    // Check if user is owner - compare as strings
    const ownerString = project.owner ? project.owner.toString() : null;
    const userIdString = req.userId ? String(req.userId) : null;
    const isOwner = ownerString === userIdString;
    
    console.log('[Chat] Owner comparison:', { ownerString, userIdString, isOwner });
    
    if (!isOwner) {
      console.log('[Chat] User is not owner - access denied');
      return res.status(403).json({ 
        error: 'Only project owner can clear chat history',
        debug: { ownerString, userIdString, isOwner }
      });
    }
    
    // Clear chat history in database
    project.chatHistory = [];
    await project.save();
    
    console.log('[Chat] Chat history cleared successfully for project:', projectId);
    
    // Notify all users in the room via socket
    const io = req.app.get('io');
    if (io) {
      console.log('[Chat] Emitting chat-cleared event to room:', projectId);
      io.to(projectId).emit('chat-cleared', { 
        roomId: projectId,
        message: 'Chat history has been cleared',
        clearedBy: req.userId,
        timestamp: new Date()
      });
    }
    
    res.json({ success: true, message: 'Chat history cleared' });
  } catch (err) {
    console.error('[Chat] Clear history error:', err.message);
    console.error('[Chat] Clear history stack:', err.stack);
    res.status(500).json({ error: 'Failed to clear chat history: ' + err.message });
  }
});

module.exports = router;
