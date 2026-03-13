const express = require('express');
const router = express.Router();
const axios = require('axios');
const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const jwt = require('jsonwebtoken');
const Project = require('../models/Project');
const User = require('../models/User');

const execFileAsync = promisify(execFile);
const IMPORT_TMP = '/tmp/github-imports';

const getLanguageFromName = (fileName) => {
  const ext = String(fileName || '').split('.').pop().toLowerCase();
  const extensions = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    cs: 'csharp',
    html: 'html',
    css: 'css',
    json: 'json',
    md: 'markdown'
  };
  return extensions[ext] || 'plaintext';
};

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
// GET /repos — list the authenticated user's GitHub repositories
router.get('/repos', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).lean();
    if (!user?.githubAccessToken) {
      return res.status(428).json({ error: 'GitHub not linked', needsAuth: true });
    }

    const response = await axios.get('https://api.github.com/user/repos', {
      headers: { Authorization: `token ${user.githubAccessToken}` },
      params: { per_page: 100, sort: 'updated', affiliation: 'owner,collaborator' }
    });

    const repos = response.data.map(r => ({
      id: r.id,
      name: r.name,
      fullName: r.full_name,
      description: r.description || '',
      private: r.private,
      url: r.html_url,
      cloneUrl: r.clone_url,
      defaultBranch: r.default_branch,
      updatedAt: r.updated_at,
      language: r.language,
      stars: r.stargazers_count
    }));

    res.json({ repos });
  } catch (error) {
    if (error.response?.status === 401) {
      return res.status(401).json({ error: 'GitHub token expired. Reconnect GitHub.' });
    }
    res.status(500).json({ error: error.message });
  }
});

// POST /import — clone a GitHub repo and create a new project from its files
router.post('/import', verifyToken, async (req, res) => {
  const tmpDir = path.join(IMPORT_TMP, `${req.userId}-${Date.now()}`);
  try {
    const { cloneUrl, repoName, language } = req.body;
    if (!cloneUrl || !/^https:\/\/github\.com\//i.test(cloneUrl)) {
      return res.status(400).json({ error: 'Invalid GitHub clone URL' });
    }

    const user = await User.findById(req.userId).lean();
    if (!user?.githubAccessToken) {
      return res.status(428).json({ error: 'GitHub not linked', needsAuth: true });
    }

    // Embed token for private repo access
    const authUrl = (() => {
      try {
        const url = new URL(cloneUrl.replace(/\.git$/, '') + '.git');
        url.username = 'oauth2';
        url.password = user.githubAccessToken;
        return url.toString();
      } catch { return cloneUrl; }
    })();

    await fs.mkdir(tmpDir, { recursive: true });

    // Clone with depth 1 (fast, no full history)
    const cloneResult = await execFileAsync('git', ['clone', '--depth', '1', authUrl, tmpDir], {
      timeout: 60000,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_ASKPASS: 'echo' }
    }).catch(err => ({ error: err.stderr || err.message }));

    if (cloneResult?.error) {
      return res.status(500).json({ error: `Clone failed: ${cloneResult.error}` });
    }

    // Read files from the cloned directory
    const files = [];
    const walk = async (dir, base = '') => {
      let entries;
      try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
      for (const entry of entries) {
        if (entry.name === '.git') continue;
        const relPath = base ? `${base}/${entry.name}` : entry.name;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath, relPath);
        } else {
          // Skip binary files over 512KB
          const stat = await fs.stat(fullPath).catch(() => null);
          if (stat && stat.size > 512 * 1024) continue;
          const content = await fs.readFile(fullPath, 'utf8').catch(() => null);
          if (content === null) continue; // binary — skip
          const inferredLanguage = getLanguageFromName(relPath);
          files.push({ name: relPath, content, language: inferredLanguage !== 'plaintext' ? inferredLanguage : (language || 'javascript'), lastModified: new Date() });
        }
      }
    };
    await walk(tmpDir);

    if (files.length === 0) {
      return res.status(400).json({ error: 'Repository appears to be empty or contains only binary files.' });
    }

    // Create a new Project in MongoDB with those files
    const projectName = repoName || path.basename(cloneUrl, '.git');
    const project = new Project({
      name: projectName,
      description: `Imported from GitHub: ${cloneUrl.replace(/\.git$/, '')}`,
      owner: req.userId,
      createdBy: req.userId,
      language: language || 'javascript',
      isInviteOnly: true,
      files,
      githubUrl: cloneUrl,
      gitStatus: {
        staged: [],
        unstaged: files.map(f => f.name),
        untracked: [],
        branch: 'main',
        commits: []
      }
    });
    project.roomId = project._id.toString();
    await project.save();

    // Update user stats
    await User.findByIdAndUpdate(req.userId, { $inc: { totalProjects: 1 } });

    res.status(201).json({
      message: 'Repository imported successfully',
      projectId: project._id,
      projectName: project.name,
      fileCount: files.length
    });
  } catch (error) {
    console.error('[GitHub Import] Error:', error.message);
    res.status(500).json({ error: error.message });
  } finally {
    // Clean up temp clone directory
    fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
});
module.exports = router;
