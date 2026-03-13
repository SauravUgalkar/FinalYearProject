const express = require('express');
const router = express.Router();
const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const Project = require('../models/Project');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

const execFileAsync = promisify(execFile);
const WORKSPACE_ROOT = '/tmp/workspaces';

// Only allow valid MongoDB ObjectIds as workspace directory names
const isSafeId = (id) => /^[a-f0-9]{24}$/.test(String(id));

// Run git command safely via execFile (prevents shell injection)
const runGit = async (cwd, args) => {
  try {
    const { stdout, stderr } = await execFileAsync('git', args, {
      cwd,
      timeout: 30000,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_ASKPASS: 'echo' }
    });
    return { stdout: (stdout || '').trim(), stderr: (stderr || '').trim(), success: true };
  } catch (err) {
    return {
      stdout: (err.stdout || '').trim(),
      stderr: (err.stderr || err.message || '').trim(),
      success: false
    };
  }
};

const getWorkspacePath = (projectId) => path.join(WORKSPACE_ROOT, String(projectId));

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

// Write project files from DB onto disk
const syncFilesToDisk = async (workspacePath, files) => {
  for (const file of files) {
    if (!file.name || file.name.endsWith('/')) continue;
    // Prevent path traversal
    const safeName = path.normalize(file.name).replace(/^(\.\.(\/|\\|$))+/, '');
    const filePath = path.join(workspacePath, safeName);
    if (!filePath.startsWith(workspacePath + path.sep) && filePath !== workspacePath) continue;
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, file.content || '', 'utf8');
  }
};

// Read all non-.git files from disk back into an array
const readFilesFromDisk = async (workspacePath, defaultLanguage = 'javascript') => {
  const results = [];
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
        const content = await fs.readFile(fullPath, 'utf8').catch(() => '');
        const inferredLanguage = getLanguageFromName(relPath);
        results.push({ name: relPath, content, language: inferredLanguage !== 'plaintext' ? inferredLanguage : defaultLanguage });
      }
    }
  };
  await walk(workspacePath);
  return results;
};

// Embed GitHub token into HTTPS remote URL for credential-less git operations
const buildAuthUrl = (remoteUrl, githubToken) => {
  if (!githubToken || !remoteUrl) return remoteUrl;
  try {
    const url = new URL(remoteUrl.replace(/\.git$/, '') + '.git');
    if (url.hostname !== 'github.com') return remoteUrl;
    url.username = 'oauth2';
    url.password = githubToken;
    return url.toString();
  } catch { return remoteUrl; }
};

const normalizeRemoteUrl = (remoteUrl) => {
  if (!remoteUrl) return '';
  try {
    const url = new URL(String(remoteUrl).trim());
    if (!url.hostname || !/^https?:$/.test(url.protocol)) return '';
    if (!url.pathname.endsWith('.git')) {
      url.pathname = `${url.pathname.replace(/\/$/, '')}.git`;
    }
    return url.toString();
  } catch {
    return '';
  }
};

const setOriginWithAuth = async (workspacePath, remoteUrl, githubToken) => {
  const authUrl = buildAuthUrl(remoteUrl, githubToken);
  const remoteCheck = await runGit(workspacePath, ['remote', 'get-url', 'origin']);
  if (remoteCheck.success) {
    await runGit(workspacePath, ['remote', 'set-url', 'origin', authUrl]);
  } else {
    await runGit(workspacePath, ['remote', 'add', 'origin', authUrl]);
  }
};

const parsePorcelainStatus = (stdout = '') => {
  const staged = new Set();
  const unstaged = new Set();
  const untracked = new Set();

  const lines = String(stdout || '').split('\n').filter(Boolean);
  for (const line of lines) {
    // Ignore branch header line from --branch output
    if (line.startsWith('##')) continue;

    // Untracked format: "?? path"
    if (line.startsWith('?? ')) {
      const file = line.slice(3).trim();
      if (file) untracked.add(file);
      continue;
    }

    if (line.length < 3) continue;
    const x = line[0];
    const y = line[1];
    let file = line.slice(3).trim();

    // Rename format: "old/path -> new/path"
    if (file.includes(' -> ')) {
      file = file.split(' -> ').pop().trim();
    }
    if (!file) continue;

    if (x !== ' ' && x !== '?') staged.add(file);
    if (y !== ' ' && y !== '?') unstaged.add(file);
  }

  return {
    staged: Array.from(staged),
    unstaged: Array.from(unstaged),
    untracked: Array.from(untracked),
  };
};

const refreshProjectGitStatus = async (project, user) => {
  const projectId = String(project._id);
  const workspacePath = getWorkspacePath(projectId);

  await ensureGitInit(workspacePath, user?.email, user?.name);
  await syncFilesToDisk(workspacePath, project.files || []);

  const branchResult = await runGit(workspacePath, ['rev-parse', '--abbrev-ref', 'HEAD']);
  const statusResult = await runGit(workspacePath, ['status', '--porcelain', '--branch']);
  const parsed = parsePorcelainStatus(statusResult.stdout || '');

  project.gitStatus = project.gitStatus || {};
  project.gitStatus.branch = branchResult.success ? (branchResult.stdout || 'main') : (project.gitStatus.branch || 'main');
  project.gitStatus.staged = parsed.staged;
  project.gitStatus.unstaged = parsed.unstaged;
  project.gitStatus.untracked = parsed.untracked;
  if (!Array.isArray(project.gitStatus.commits)) project.gitStatus.commits = [];

  return { workspacePath, gitStatus: project.gitStatus };
};

const resolveRemoteDefaultBranch = async (workspacePath) => {
  const remoteHead = await runGit(workspacePath, ['ls-remote', '--symref', 'origin', 'HEAD']);
  if (!remoteHead.success) return 'main';
  const match = (remoteHead.stdout || '').match(/refs\/heads\/([^\s]+)/);
  return match?.[1] || 'main';
};

// Ensure the workspace directory has a git repo; init if not
const ensureGitInit = async (workspacePath, userEmail, userName) => {
  try { await fs.access(path.join(workspacePath, '.git')); return; } catch {}
  await fs.mkdir(workspacePath, { recursive: true });
  await runGit(workspacePath, ['init']);
  await runGit(workspacePath, ['config', 'user.email', userEmail || 'collab@code.io']);
  await runGit(workspacePath, ['config', 'user.name', userName || 'CollabCode']);
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

    const user = await User.findById(req.userId).lean();
    await refreshProjectGitStatus(project, user);
    await project.save();

    res.json({
      ...project.gitStatus,
      remoteUrl: project.githubUrl || ''
    });
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

    const hasAccess = project.owner.toString() === req.userId ||
      project.collaborators.some(c => c.userId?.toString() === req.userId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this project' });
    }

    const normalizedFiles = Array.isArray(files) ? files.filter(Boolean) : [];
    if (normalizedFiles.length === 0) {
      return res.status(400).json({ error: 'No files provided to stage' });
    }

    const user = await User.findById(req.userId).lean();
    const { workspacePath } = await refreshProjectGitStatus(project, user);

    const stageResult = await runGit(workspacePath, ['add', '--', ...normalizedFiles]);
    if (!stageResult.success) {
      return res.status(400).json({ error: stageResult.stderr || 'Failed to stage files' });
    }

    await refreshProjectGitStatus(project, user);

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

    const hasAccess = project.owner.toString() === req.userId ||
      project.collaborators.some(c => c.userId?.toString() === req.userId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this project' });
    }

    const normalizedFiles = Array.isArray(files) ? files.filter(Boolean) : [];
    if (normalizedFiles.length === 0) {
      return res.status(400).json({ error: 'No files provided to unstage' });
    }

    const user = await User.findById(req.userId).lean();
    const { workspacePath } = await refreshProjectGitStatus(project, user);

    // Try modern unstage command first; fallback for older git versions.
    let unstageResult = await runGit(workspacePath, ['restore', '--staged', '--', ...normalizedFiles]);
    if (!unstageResult.success) {
      unstageResult = await runGit(workspacePath, ['reset', 'HEAD', '--', ...normalizedFiles]);
    }
    if (!unstageResult.success) {
      // Last fallback when HEAD doesn't exist yet.
      unstageResult = await runGit(workspacePath, ['rm', '--cached', '-r', '--', ...normalizedFiles]);
    }
    if (!unstageResult.success) {
      return res.status(400).json({ error: unstageResult.stderr || 'Failed to unstage files' });
    }

    await refreshProjectGitStatus(project, user);

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

    const hasAccess = project.owner.toString() === req.userId ||
      project.collaborators.some(c => c.userId?.toString() === req.userId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this project' });
    }

    const user = await User.findById(req.userId).lean();
    const { workspacePath } = await refreshProjectGitStatus(project, user);

    if (!project.gitStatus?.staged?.length) {
      return res.status(400).json({ error: 'No files staged for commit' });
    }

    const commitResult = await runGit(workspacePath, ['commit', '-m', message.trim()]);
    if (!commitResult.success) {
      return res.status(400).json({ error: commitResult.stderr || 'Commit failed' });
    }

    const hashResult = await runGit(workspacePath, ['rev-parse', '--short', 'HEAD']);
    const stagedFiles = [...project.gitStatus.staged];

    // Create commit object
    const commit = {
      id: hashResult.success ? (hashResult.stdout || Date.now().toString()) : Date.now().toString(),
      message: message.trim(),
      author: req.userId,
      date: new Date(),
      files: stagedFiles
    };

    // Add to commits
    if (!project.gitStatus.commits) {
      project.gitStatus.commits = [];
    }
    project.gitStatus.commits.unshift(commit);

    await refreshProjectGitStatus(project, user);

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

// ─── REAL GIT OPERATIONS (child_process) ─────────────────────────────────────

// POST /:projectId/init — git init workspace + write project files to disk
router.post('/:projectId/init', verifyToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    if (!isSafeId(projectId)) return res.status(400).json({ error: 'Invalid project ID' });
    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (project.owner.toString() !== req.userId) return res.status(403).json({ error: 'Only owner can initialize git' });

    const user = await User.findById(req.userId).lean();
    const workspacePath = getWorkspacePath(projectId);
    await ensureGitInit(workspacePath, user?.email, user?.name);
    await syncFilesToDisk(workspacePath, project.files || []);
    await runGit(workspacePath, ['add', '.']);
    if ((project.files || []).length > 0) {
      await runGit(workspacePath, ['commit', '-m', 'Initial commit', '--allow-empty']);
    }

    project.gitStatus = project.gitStatus || {};
    project.gitStatus.branch = project.gitStatus.branch || 'main';
    project.gitStatus.staged = [];
    project.gitStatus.unstaged = (project.files || []).map(f => f.name).filter(n => !n.endsWith('/'));
    project.gitStatus.untracked = [];
    await project.save();

    res.json({ message: 'Git repository initialized', branch: project.gitStatus.branch });
  } catch (error) {
    console.error('[Git] init error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /:projectId/push — write files to workspace + git add/commit/push to GitHub
router.post('/:projectId/push', verifyToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { message, remote } = req.body;
    if (!isSafeId(projectId)) return res.status(400).json({ error: 'Invalid project ID' });

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (project.owner.toString() !== req.userId) return res.status(403).json({ error: 'Only owner can push' });

    const user = await User.findById(req.userId).lean();
    if (!user?.githubAccessToken) {
      return res.status(428).json({ error: 'GitHub not linked. Connect GitHub first.', needsAuth: true });
    }

    const remoteUrl = normalizeRemoteUrl(remote || project.githubUrl);
    if (!remoteUrl) {
      return res.status(400).json({ error: 'No remote URL set. Export project to GitHub first to create the remote repo.' });
    }
    project.githubUrl = remoteUrl;

    const workspacePath = getWorkspacePath(projectId);
    await ensureGitInit(workspacePath, user.email, user.name);
    await syncFilesToDisk(workspacePath, project.files || []);

    await setOriginWithAuth(workspacePath, remoteUrl, user.githubAccessToken);
    await runGit(workspacePath, ['fetch', 'origin']);

    await runGit(workspacePath, ['add', '.']);
    const commitMsg = (message || '').trim() || 'Update from CollabCode';
    await runGit(workspacePath, ['commit', '-m', commitMsg, '--allow-empty']);

    const branch = project.gitStatus?.branch || await resolveRemoteDefaultBranch(workspacePath);
    await runGit(workspacePath, ['checkout', '-B', branch]);
    let pushResult = await runGit(workspacePath, ['push', '-u', 'origin', branch, '--force-with-lease']);
    if (!pushResult.success) {
      // New branch or diverged — try without force-with-lease
      pushResult = await runGit(workspacePath, ['push', '-u', 'origin', branch]);
    }
    if (!pushResult.success && pushResult.stderr) {
      return res.status(500).json({ error: pushResult.stderr });
    }

    // Record commit in MongoDB
    const commit = {
      id: Date.now().toString(),
      message: commitMsg,
      author: req.userId,
      date: new Date(),
      files: (project.files || []).filter(f => !f.name.endsWith('/')).map(f => f.name)
    };
    project.gitStatus = project.gitStatus || {};
    if (!project.gitStatus.commits) project.gitStatus.commits = [];
    project.gitStatus.commits.unshift(commit);
    project.gitStatus.branch = branch;
    project.gitStatus.staged = [];
    await project.save();

    res.json({
      message: 'Push successful',
      commit,
      remoteUrl: remoteUrl.replace(/(:\/\/)[^@]*@/, '$1***@')
    });
  } catch (error) {
    console.error('[Git] push error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /:projectId/pull — git pull from GitHub, sync files back to DB
router.post('/:projectId/pull', verifyToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { remote } = req.body;
    if (!isSafeId(projectId)) return res.status(400).json({ error: 'Invalid project ID' });

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (project.owner.toString() !== req.userId) return res.status(403).json({ error: 'Only owner can pull' });

    const user = await User.findById(req.userId).lean();
    if (!user?.githubAccessToken) {
      return res.status(428).json({ error: 'GitHub not linked. Connect GitHub first.', needsAuth: true });
    }

    const remoteUrl = normalizeRemoteUrl(remote || project.githubUrl);
    if (!remoteUrl) return res.status(400).json({ error: 'No remote URL configured.' });
    project.githubUrl = remoteUrl;

    const workspacePath = getWorkspacePath(projectId);
    await ensureGitInit(workspacePath, user.email, user.name);
    await syncFilesToDisk(workspacePath, project.files || []);
    await runGit(workspacePath, ['add', '.']);
    await runGit(workspacePath, ['commit', '-m', 'Local snapshot before pull', '--allow-empty']);

    await setOriginWithAuth(workspacePath, remoteUrl, user.githubAccessToken);

    await runGit(workspacePath, ['fetch', 'origin']);
    const branch = project.gitStatus?.branch || await resolveRemoteDefaultBranch(workspacePath);
    const checkoutResult = await runGit(workspacePath, ['checkout', branch]);
    if (!checkoutResult.success) {
      await runGit(workspacePath, ['checkout', '-B', branch, `origin/${branch}`]);
    }
    const pullResult = await runGit(workspacePath, ['pull', 'origin', branch, '--no-rebase']);

    if (!pullResult.success && !pullResult.stdout.includes('Already up to date')) {
      return res.status(500).json({ error: pullResult.stderr || 'Pull failed' });
    }

    // Read files back from disk and sync to MongoDB
    const diskFiles = await readFilesFromDisk(workspacePath, project.language);
    project.files = diskFiles.map(f => ({
      name: f.name,
      content: f.content,
      language: f.language || project.language,
      lastModified: new Date()
    }));
    project.gitStatus = project.gitStatus || {};
    project.gitStatus.branch = branch;
    project.gitStatus.staged = [];
    project.gitStatus.unstaged = [];
    project.gitStatus.untracked = [];
    await project.save();

    res.json({
      message: pullResult.stdout || 'Already up to date',
      files: project.files
    });
  } catch (error) {
    console.error('[Git] pull error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /:projectId/branches — list branches from workspace
router.get('/:projectId/branches', verifyToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    if (!isSafeId(projectId)) return res.status(400).json({ error: 'Invalid project ID' });
    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const hasAccess = project.owner.toString() === req.userId ||
      project.collaborators.some(c => c.userId?.toString() === req.userId);
    if (!hasAccess) return res.status(403).json({ error: 'Access denied' });

    const workspacePath = getWorkspacePath(projectId);
    try { await fs.access(path.join(workspacePath, '.git')); } catch {
      const branch = project.gitStatus?.branch || 'main';
      return res.json({ branches: [branch], current: branch });
    }

    const result = await runGit(workspacePath, ['branch', '-a']);
    const lines = (result.stdout || '').split('\n').filter(Boolean);
    const branches = [...new Set(
      lines.map(l => l.replace(/^\*?\s+/, '').replace(/^remotes\/origin\//, '').trim()).filter(Boolean)
    )];
    const current = (lines.find(l => l.startsWith('*')) || '').replace(/^\*\s+/, '').trim() || project.gitStatus?.branch || 'main';

    res.json({ branches, current });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /:projectId/branch — create or switch branch
router.post('/:projectId/branch', verifyToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { name, action } = req.body; // action: 'create' | 'switch'
    if (!isSafeId(projectId)) return res.status(400).json({ error: 'Invalid project ID' });
    if (!name?.trim() || !/^[a-zA-Z0-9/_.-]+$/.test(name.trim())) {
      return res.status(400).json({ error: 'Invalid branch name' });
    }
    const safeName = name.trim();
    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (project.owner.toString() !== req.userId) return res.status(403).json({ error: 'Only owner can manage branches' });

    const user = await User.findById(req.userId).lean();
    const workspacePath = getWorkspacePath(projectId);
    await ensureGitInit(workspacePath, user?.email, user?.name);
    await syncFilesToDisk(workspacePath, project.files || []);
    await runGit(workspacePath, ['add', '.']);
    await runGit(workspacePath, ['commit', '-m', `Checkpoint before switching to ${safeName}`, '--allow-empty']);

    const result = action === 'switch'
      ? await runGit(workspacePath, ['checkout', safeName])
      : await runGit(workspacePath, ['checkout', '-b', safeName]);

    if (!result.success && result.stderr && !result.stderr.includes('Switched')) {
      return res.status(400).json({ error: result.stderr });
    }

    if (project.githubUrl && user?.githubAccessToken) {
      await setOriginWithAuth(workspacePath, project.githubUrl, user.githubAccessToken);
      await runGit(workspacePath, ['push', '-u', 'origin', safeName]);
    }

    project.gitStatus = project.gitStatus || {};
    project.gitStatus.branch = safeName;
    await project.save();

    res.json({ message: `Switched to branch "${safeName}"`, branch: safeName });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /:projectId/diff — get unified diff (all files or one file)
router.get('/:projectId/diff', verifyToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { file } = req.query;
    if (!isSafeId(projectId)) return res.status(400).json({ error: 'Invalid project ID' });

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const hasAccess = project.owner.toString() === req.userId ||
      project.collaborators.some(c => c.userId?.toString() === req.userId);
    if (!hasAccess) return res.status(403).json({ error: 'Access denied' });

    const workspacePath = getWorkspacePath(projectId);
    try { await fs.access(workspacePath); } catch {
      return res.json({ diff: '', message: 'Workspace not initialized. Click "Init & Push" first.' });
    }

    // Sync current files to disk so diff reflects latest editor content
    await syncFilesToDisk(workspacePath, project.files || []);
    await runGit(workspacePath, ['add', '.']);

    // Try staged diff first; fall back to unstaged
    const stagedArgs = file ? ['diff', '--cached', '--', file] : ['diff', '--cached'];
    let result = await runGit(workspacePath, stagedArgs);
    if (!result.stdout) {
      const unstagedArgs = file ? ['diff', '--', file] : ['diff'];
      result = await runGit(workspacePath, unstagedArgs);
    }

    res.json({ diff: result.stdout || '', message: result.stdout ? undefined : 'No changes detected' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
