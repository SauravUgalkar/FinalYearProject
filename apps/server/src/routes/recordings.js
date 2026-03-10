const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const jwt = require('jsonwebtoken');

// Middleware to verify JWT
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_secret_key');
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Get all recordings for a project
router.get('/:projectId', verifyToken, async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check access
    const hasAccess = project.owner.toString() === req.userId ||
      project.collaborators.some(c => c.userId?.toString() === req.userId);

    if (!hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this project' });
    }

    res.json(project.recordings || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start a recording session
router.post('/:projectId/start', verifyToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { title } = req.body;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check access
    const hasAccess = project.owner.toString() === req.userId ||
      project.collaborators.some(c => c.userId?.toString() === req.userId);

    if (!hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this project' });
    }

    if (!project.recordings) {
      project.recordings = [];
    }

    const recording = {
      id: Date.now().toString(),
      title: title || 'Session Recording',
      startTime: new Date(),
      endTime: null,
      duration: 0,
      size: 0,
      recordedBy: req.userId,
      status: 'recording'
    };

    project.recordings.push(recording);
    await project.save();

    res.status(201).json(recording);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Stop a recording session
router.post('/:projectId/stop/:recordingId', verifyToken, async (req, res) => {
  try {
    const { projectId, recordingId } = req.params;
    const { size } = req.body;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const recording = project.recordings?.find(r => r.id === recordingId);
    if (!recording) {
      return res.status(404).json({ error: 'Recording not found' });
    }

    recording.endTime = new Date();
    recording.duration = Math.floor((recording.endTime - recording.startTime) / 1000);
    recording.size = size || 0;
    recording.status = 'completed';

    await project.save();

    res.json(recording);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a recording
router.delete('/:projectId/recordings/:recordingId', verifyToken, async (req, res) => {
  try {
    const { projectId, recordingId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check access - only owner can delete
    if (project.owner.toString() !== req.userId) {
      return res.status(403).json({ error: 'Only project owner can delete recordings' });
    }

    project.recordings = project.recordings?.filter(r => r.id !== recordingId) || [];
    await project.save();

    res.json({ message: 'Recording deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
