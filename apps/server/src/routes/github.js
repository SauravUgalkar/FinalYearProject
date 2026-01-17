const express = require('express');
const router = express.Router();
const axios = require('axios');
const jwt = require('jsonwebtoken');
const Project = require('../models/Project');
const User = require('../models/User');

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

// Get GitHub authorization URL
router.get('/auth-url', (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const redirectUri = process.env.GITHUB_REDIRECT_URI || 'http://localhost:3000/github/callback';
  if (!clientId) {
    return res.status(400).json({ error: 'GitHub OAuth not configured' });
  }

  const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=repo,user`;
  res.json({ authUrl });
});

// Exchange code for token
router.post('/callback', async (req, res) => {
  try {
    const { code } = req.body;

    const tokenResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code
      },
      { headers: { Accept: 'application/json' } }
    );

    const { access_token } = tokenResponse.data || {};

    // If caller is authenticated, persist token to their user record
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && access_token) {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_secret_key');
        const userId = decoded.userId;
        await User.findByIdAndUpdate(userId, {
          $set: { githubAccessToken: access_token, updatedAt: new Date() }
        });
      }
    } catch (persistErr) {
      console.warn('[GitHub] Could not persist access token to user:', persistErr.message);
    }

    res.json(tokenResponse.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export project to GitHub
router.post('/export/:projectId', verifyToken, async (req, res) => {
  try {
    const { repositoryName } = req.body;
    const project = await Project.findById(req.params.projectId);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.owner.toString() !== req.userId) {
      return res.status(403).json({ error: 'Not authorized to export this project' });
    }

    // Resolve user's GitHub token server-side
    const user = await User.findById(req.userId).lean();
    const githubToken = user?.githubAccessToken;
    if (!githubToken) {
      const clientId = process.env.GITHUB_CLIENT_ID;
      const redirectUri = process.env.GITHUB_REDIRECT_URI || 'http://localhost:3000/github/callback';
      const authUrl = clientId
        ? `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=repo,user`
        : null;
      return res.status(428).json({
        error: 'GitHub not linked',
        needsAuth: true,
        authUrl
      });
    }

    // Create repository
    const repoResponse = await axios.post(
      'https://api.github.com/user/repos',
      {
        name: repositoryName || project.name,
        description: project.description,
        private: !project.isPublic
      },
      { headers: { Authorization: `token ${githubToken}` } }
    );

    const repoUrl = repoResponse.data.clone_url;

    // Prepare files for upload
    const files = {};
    project.files.forEach(file => {
      files[file.name] = {
        content: file.content
      };
    });

    // Create files in repository
    for (const [fileName, fileData] of Object.entries(files)) {
      await axios.put(
        `https://api.github.com/repos/${repoResponse.data.full_name}/contents/${fileName}`,
        {
          message: `Initial commit: ${fileName}`,
          content: Buffer.from(fileData.content).toString('base64')
        },
        { headers: { Authorization: `token ${githubToken}` } }
      );
    }

    // Update project with GitHub URL
    project.githubUrl = repoUrl;
    await project.save();

    res.json({
      message: 'Project exported to GitHub',
      repositoryUrl: repoUrl,
      repositoryName: repoResponse.data.name
    });
  } catch (error) {
    console.error('Error exporting to GitHub:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
