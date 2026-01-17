const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const jwt = require('jsonwebtoken');

// Simple auth middleware (reuse inline to avoid import cycle)
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_secret_key');
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Get chat history for a project
router.get('/project/:projectId', verifyToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const project = await Project.findById(projectId).select('chatHistory').lean();
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json({ chatHistory: project.chatHistory || [] });
  } catch (err) {
    console.error('[Chat] Get history error:', err.message);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

module.exports = router;
