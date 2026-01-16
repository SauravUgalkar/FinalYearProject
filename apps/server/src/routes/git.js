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

// Get git status for a project
router.get('/:projectId/status', verifyToken, async (req, res) => {
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

    // Initialize git status if not exists
    if (!project.gitStatus) {
      project.gitStatus = {
        staged: [],
        unstaged: [],
        untracked: [],
        branch: 'main',
        commits: []
      };
    }

    res.json(project.gitStatus);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Stage files
router.post('/:projectId/stage', verifyToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { files } = req.body; // Array of file paths

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Initialize git status if not exists
    if (!project.gitStatus) {
      project.gitStatus = {
        staged: [],
        unstaged: [],
        untracked: [],
        branch: 'main',
        commits: []
      };
    }

    files.forEach(file => {
      // Remove from unstaged and untracked
      project.gitStatus.unstaged = project.gitStatus.unstaged.filter(f => f !== file);
      project.gitStatus.untracked = project.gitStatus.untracked.filter(f => f !== file);
      
      // Add to staged if not already there
      if (!project.gitStatus.staged.includes(file)) {
        project.gitStatus.staged.push(file);
      }
    });

    await project.save();
    res.json(project.gitStatus);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Unstage files
router.post('/:projectId/unstage', verifyToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { files } = req.body; // Array of file paths

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Initialize git status if not exists
    if (!project.gitStatus) {
      project.gitStatus = {
        staged: [],
        unstaged: [],
        untracked: [],
        branch: 'main',
        commits: []
      };
    }

    files.forEach(file => {
      project.gitStatus.staged = project.gitStatus.staged.filter(f => f !== file);
      
      // Add to unstaged if not already there
      if (!project.gitStatus.unstaged.includes(file)) {
        project.gitStatus.unstaged.push(file);
      }
    });

    await project.save();
    res.json(project.gitStatus);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Commit changes
router.post('/:projectId/commit', verifyToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { message } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({ error: 'Commit message is required' });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Initialize git status if not exists
    if (!project.gitStatus) {
      project.gitStatus = {
        staged: [],
        unstaged: [],
        untracked: [],
        branch: 'main',
        commits: []
      };
    }

    if (project.gitStatus.staged.length === 0) {
      return res.status(400).json({ error: 'No files staged for commit' });
    }

    // Create commit object
    const commit = {
      id: Date.now().toString(),
      message: message,
      author: req.userId,
      date: new Date(),
      files: [...project.gitStatus.staged]
    };

    // Add to commits
    if (!project.gitStatus.commits) {
      project.gitStatus.commits = [];
    }
    project.gitStatus.commits.unshift(commit);

    // Clear staged files
    project.gitStatus.staged = [];

    await project.save();

    res.json({
      message: 'Commit successful',
      commit: commit,
      gitStatus: project.gitStatus
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get commit history
router.get('/:projectId/commits', verifyToken, async (req, res) => {
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

    res.json(project.gitStatus?.commits || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get file blame (modification history per line)
router.get('/:projectId/blame/:fileName', verifyToken, async (req, res) => {
  try {
    const { projectId, fileName } = req.params;

    const project = await Project.findById(projectId).populate('owner', 'name email');
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check access
    const hasAccess = project.owner._id.toString() === req.userId ||
      project.collaborators.some(c => c.userId?.toString() === req.userId);

    if (!hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this project' });
    }

    // Find the file
    const file = project.files.find(f => f.name === decodeURIComponent(fileName));
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Return modifications with line numbers
    const blameData = file.modifications || [];
    res.json(blameData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update file modification tracking
router.post('/:projectId/track-modification', verifyToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { fileName, lineNumber, content, userName } = req.body;

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

    // Find the file
    const file = project.files.find(f => f.name === fileName);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Initialize modifications array if not exists
    if (!file.modifications) {
      file.modifications = [];
    }

    // Update or add modification for this line
    const existingModIndex = file.modifications.findIndex(m => m.lineNumber === lineNumber);
    if (existingModIndex >= 0) {
      file.modifications[existingModIndex] = {
        lineNumber,
        userId: req.userId,
        userName,
        timestamp: new Date(),
        content
      };
    } else {
      file.modifications.push({
        lineNumber,
        userId: req.userId,
        userName,
        timestamp: new Date(),
        content
      });
    }

    await project.save();
    res.json({ success: true, modifications: file.modifications });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
