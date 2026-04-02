const express = require('express');
const router = express.Router();
const axios = require('axios');
const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const Project = require('../models/Project');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { getGithubTokenFromUser } = require('../services/githubTokenService');
const { checkProjectMember } = require('../middleware/checkProjectMember');

const execFileAsync = promisify(execFile);
const WORKSPACE_ROOT = '/tmp/workspaces';
const MAX_FILE_MODIFICATIONS = Number(process.env.MAX_FILE_MODIFICATIONS || 1000);
const DEFAULT_GIT_BRANCH = String(process.env.DEFAULT_GIT_BRANCH || 'main').trim() || 'main';

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

const classifyGitErrorMessage = (message = '', fallback = 'Git operation failed') => {
  const text = String(message || '').toLowerCase();

  if (!text) return fallback;
  if (text.includes('not a git repository')) return 'Workspace is not initialized. Run git init first.';
  if (text.includes('could not read username') || text.includes('authentication failed') || text.includes('invalid username or password')) {
    return 'GitHub authentication failed. Reconnect your GitHub account.';
  }
  if (text.includes('repository not found')) return 'Repository not found on GitHub.';
  if (text.includes('permission to') && text.includes('denied')) return 'You do not have permission to access this repository.';
  if (text.includes('nothing to commit')) return 'No file changes to commit.';
  if (text.includes('pathspec')) return 'One or more selected files were not found in the workspace.';
  if (text.includes('branch') && text.includes('already exists')) return 'That branch already exists.';
  if (text.includes('merge conflict') || text.includes('conflict')) return 'Git has merge conflicts. Resolve them before continuing.';
  if (text.includes('non-fast-forward')) return 'Push rejected because the branch has remote changes. Pull first and try again.';
  if (text.includes('unable to access') || text.includes('could not resolve host') || text.includes('network is unreachable')) {
    return 'GitHub is unreachable right now. Check your network connection.';
  }
  return message || fallback;
};

const sendGitError = (res, error, fallbackMessage, status = 500) => {
  const rawMessage = error?.response?.data?.error || error?.stderr || error?.message || '';
  return res.status(status).json({
    error: classifyGitErrorMessage(rawMessage, fallbackMessage),
  });
};

const getWorkspacePath = (projectId) => path.join(WORKSPACE_ROOT, String(projectId));

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

router.use('/:projectId', verifyToken, checkProjectMember());

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
  project.gitStatus.branch = branchResult.success ? (branchResult.stdout || DEFAULT_GIT_BRANCH) : (project.gitStatus.branch || DEFAULT_GIT_BRANCH);
  project.gitStatus.staged = parsed.staged;
  project.gitStatus.unstaged = parsed.unstaged;
  project.gitStatus.untracked = parsed.untracked;
  if (!Array.isArray(project.gitStatus.commits)) project.gitStatus.commits = [];

  return { workspacePath, gitStatus: project.gitStatus };
};

const resolveRemoteDefaultBranch = async (workspacePath) => {
  const remoteHead = await runGit(workspacePath, ['ls-remote', '--symref', 'origin', 'HEAD']);
  if (!remoteHead.success) return DEFAULT_GIT_BRANCH;
  const match = (remoteHead.stdout || '').match(/refs\/heads\/([^\s]+)/);
  return match?.[1] || DEFAULT_GIT_BRANCH;
};

// Ensure the workspace directory has a git repo; init if not
const ensureGitInit = async (workspacePath, userEmail, userName) => {
  try { await fs.access(path.join(workspacePath, '.git')); return; } catch {}
  await fs.mkdir(workspacePath, { recursive: true });
  await runGit(workspacePath, ['init']);
  await runGit(workspacePath, ['symbolic-ref', 'HEAD', `refs/heads/${DEFAULT_GIT_BRANCH}`]);
  await runGit(workspacePath, ['config', 'user.email', userEmail || 'collab@code.io']);
  await runGit(workspacePath, ['config', 'user.name', userName || 'CollabCode']);
};

const getUserGithubToken = (user) => {
  try {
    return getGithubTokenFromUser(user);
  } catch {
    return '';
  }
};

const classifyGitRemoteError = (stderr = '') => {
  const msg = String(stderr || '').toLowerCase();
  if (!msg) return null;
  if (msg.includes('authentication failed') || msg.includes('invalid username or password') || msg.includes('could not read username')) {
    return { status: 401, body: { error: 'GitHub token expired. Reconnect GitHub.', code: 'GITHUB_TOKEN_EXPIRED', needsAuth: true } };
  }
  if (msg.includes('repository not found')) {
    return { status: 404, body: { error: 'Repository not found on GitHub.' } };
  }
  if (msg.includes('permission to') && msg.includes('denied')) {
    return { status: 403, body: { error: 'No permission to access this GitHub repository.' } };
  }
  return null;
};

const parseGitHubRepoFromRemote = (remoteUrl = '') => {
  const raw = String(remoteUrl || '').trim();
  if (!raw) return null;

  // HTTPS form: https://github.com/owner/repo(.git)
  try {
    const parsed = new URL(raw);
    if (parsed.hostname.toLowerCase() === 'github.com') {
      const [owner, repoWithMaybeGit] = parsed.pathname.replace(/^\//, '').split('/');
      const repo = (repoWithMaybeGit || '').replace(/\.git$/i, '');
      if (owner && repo) {
        return { owner, repo };
      }
    }
  } catch {
    // Continue to SSH parsing.
  }

  // SSH form: git@github.com:owner/repo.git
  const sshMatch = raw.match(/^git@github\.com:([^/]+)\/([^\s]+?)(\.git)?$/i);
  if (sshMatch) {
    return { owner: sshMatch[1], repo: sshMatch[2] };
  }

  return null;
};

const validateGithubRepositoryAccess = async ({ githubToken, remoteUrl }) => {
  const parsedRepo = parseGitHubRepoFromRemote(remoteUrl);
  if (!parsedRepo) {
    return { ok: false, status: 404, body: { error: 'Repository not found in your GitHub account. Please create it first.' } };
  }

  let me;
  try {
    const meRes = await axios.get('https://api.github.com/user', {
      headers: {
        Authorization: `token ${githubToken}`,
        Accept: 'application/vnd.github+json',
      },
    });
    me = meRes.data;
  } catch (error) {
    if (error.response?.status === 401 || error.response?.status === 403) {
      return { ok: false, status: 401, body: { error: 'GitHub authentication required', needsAuth: true } };
    }
    return { ok: false, status: 500, body: { error: 'Failed to validate GitHub authentication' } };
  }

  try {
    const repoRes = await axios.get(`https://api.github.com/repos/${parsedRepo.owner}/${parsedRepo.repo}`, {
      headers: {
        Authorization: `token ${githubToken}`,
        Accept: 'application/vnd.github+json',
      },
    });

    const ownerLogin = String(repoRes.data?.owner?.login || '').toLowerCase();
    const currentLogin = String(me?.login || '').toLowerCase();

    if (!ownerLogin || !currentLogin || ownerLogin !== currentLogin) {
      return { ok: false, status: 403, body: { error: 'Access denied' } };
    }
  } catch (error) {
    if (error.response?.status === 401 || error.response?.status === 403) {
      return { ok: false, status: 401, body: { error: 'GitHub authentication required', needsAuth: true } };
    }
    if (error.response?.status === 404) {
      return { ok: false, status: 404, body: { error: 'Repository not found in your GitHub account. Please create it first.' } };
    }
    return { ok: false, status: 500, body: { error: 'Failed to validate repository access' } };
  }

  return { ok: true };
};

// Get git status for a project
router.get('/:projectId/status', verifyToken, async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = req.project || await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const user = await User.findById(req.userId).lean();
    await refreshProjectGitStatus(project, user);
    await project.save();

    res.json({
      ...project.gitStatus,
      remoteUrl: project.githubUrl || '',
      remoteConnected: Boolean(project.githubUrl),
    });
  } catch (error) {
    sendGitError(res, error, 'Failed to load git status');
  }
});

// POST /:projectId/remote — connect/update a GitHub repository URL for this project
router.post('/:projectId/remote', verifyToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { remote } = req.body || {};
    if (!isSafeId(projectId)) return res.status(400).json({ error: 'Invalid project ID' });

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (project.owner.toString() !== req.userId) return res.status(403).json({ error: 'Only owner can connect repository' });

    const remoteUrl = normalizeRemoteUrl(remote);
    if (!remoteUrl) {
      return res.status(400).json({ error: 'Invalid repository URL' });
    }

    const user = await User.findById(req.userId).lean();
    const githubToken = getUserGithubToken(user);
    if (!githubToken) {
      return res.status(428).json({ error: 'Please connect your GitHub account first', needsAuth: true });
    }

    const validation = await validateGithubRepositoryAccess({ githubToken, remoteUrl });
    if (!validation.ok) {
      return res.status(validation.status).json(validation.body);
    }

    project.githubUrl = remoteUrl;
    await project.save();

    return res.json({
      message: 'Repository connected successfully',
      remoteUrl,
      remoteConnected: true,
    });
  } catch (error) {
    return sendGitError(res, error, 'Failed to connect repository');
  }
});

// DELETE /:projectId/remote — remove the repository association from this project
router.delete('/:projectId/remote', verifyToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    if (!isSafeId(projectId)) return res.status(400).json({ error: 'Invalid project ID' });

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (project.owner.toString() !== req.userId) return res.status(403).json({ error: 'Only owner can remove repository' });

    const workspacePath = getWorkspacePath(projectId);
    try {
      await fs.access(path.join(workspacePath, '.git'));
      await runGit(workspacePath, ['remote', 'remove', 'origin']);
    } catch {
      // No workspace/remote configured yet; ignore.
    }

    project.githubUrl = '';
    await project.save();

    return res.json({
      message: 'Repository removed successfully',
      remoteUrl: '',
      remoteConnected: false,
    });
  } catch (error) {
    return sendGitError(res, error, 'Failed to remove repository');
  }
});

// Stage files
router.post('/:projectId/stage', verifyToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { files } = req.body; // Array of file paths

    const project = req.project || await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const normalizedFiles = Array.isArray(files) ? files.filter(Boolean) : [];
    if (normalizedFiles.length === 0) {
      return res.status(400).json({ error: 'No files provided to stage' });
    }

    const user = await User.findById(req.userId).lean();
    const { workspacePath } = await refreshProjectGitStatus(project, user);

    const stageResult = await runGit(workspacePath, ['add', '--', ...normalizedFiles]);
    if (!stageResult.success) {
      return res.status(400).json({ error: classifyGitErrorMessage(stageResult.stderr, 'Failed to stage files') });
    }

    await refreshProjectGitStatus(project, user);

    await project.save();
    res.json(project.gitStatus);
  } catch (error) {
    sendGitError(res, error, 'Failed to stage files');
  }
});

// Unstage files
router.post('/:projectId/unstage', verifyToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { files } = req.body; // Array of file paths

    const project = req.project || await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
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
      return res.status(400).json({ error: classifyGitErrorMessage(unstageResult.stderr, 'Failed to unstage files') });
    }

    await refreshProjectGitStatus(project, user);

    await project.save();
    res.json(project.gitStatus);
  } catch (error) {
    sendGitError(res, error, 'Failed to unstage files');
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

    const project = req.project || await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const user = await User.findById(req.userId).lean();
    const { workspacePath } = await refreshProjectGitStatus(project, user);

    if (!project.gitStatus?.staged?.length) {
      return res.status(400).json({ error: 'No files staged for commit' });
    }

    const commitResult = await runGit(workspacePath, ['commit', '-m', message.trim()]);
    if (!commitResult.success) {
      return res.status(400).json({ error: classifyGitErrorMessage(commitResult.stderr, 'Commit failed') });
    }

    const hashResult = await runGit(workspacePath, ['rev-parse', '--short', 'HEAD']);
    const stagedFiles = [...project.gitStatus.staged];

    // Create commit object
    const commit = {
      id: hashResult.success ? (hashResult.stdout || Date.now().toString()) : Date.now().toString(),
      message: message.trim(),
      author: req.userId,
      authorName: user?.name || 'Unknown User',
      branch: project.gitStatus?.branch || DEFAULT_GIT_BRANCH,
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
    sendGitError(res, error, 'Failed to create commit');
  }
});

// Get commit history
router.get('/:projectId/commits', verifyToken, async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = req.project || await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const commits = Array.isArray(project.gitStatus?.commits) ? project.gitStatus.commits : [];

    const uniqueAuthorIds = [...new Set(
      commits
        .map((commit) => commit?.author)
        .filter(Boolean)
        .map((id) => String(id))
    )];

    const users = uniqueAuthorIds.length
      ? await User.find({ _id: { $in: uniqueAuthorIds } }).select('name').lean()
      : [];

    const authorNameById = new Map(users.map((user) => [String(user._id), user.name]));
    const projectBranch = project.gitStatus?.branch || DEFAULT_GIT_BRANCH;

    const normalizedCommits = commits.map((commit) => {
      const authorId = commit?.author ? String(commit.author) : null;
      const resolvedAuthorName =
        commit?.authorName ||
        (authorId ? authorNameById.get(authorId) : null) ||
        'Unknown User';

      return {
        ...commit.toObject?.() || commit,
        authorName: resolvedAuthorName,
        branch: commit?.branch || projectBranch,
      };
    });

    normalizedCommits.sort((a, b) => {
      const aTs = new Date(a?.date || 0).getTime();
      const bTs = new Date(b?.date || 0).getTime();
      return bTs - aTs;
    });

    res.json(normalizedCommits);
  } catch (error) {
    sendGitError(res, error, 'Failed to load commit history');
  }
});

// Delete commit metadata entry from project history
router.delete('/:projectId/commits/:commitId', verifyToken, async (req, res) => {
  try {
    const { projectId, commitId } = req.params;

    const project = req.project || await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const commits = Array.isArray(project.gitStatus?.commits) ? project.gitStatus.commits : [];
    const targetCommit = commits.find((c) => String(c?.id || '') === String(commitId));
    if (!targetCommit) {
      return res.status(404).json({ error: 'Commit not found' });
    }

    const isOwner = project.owner.toString() === req.userId;
    const isAuthor = String(targetCommit?.author || '') === String(req.userId);
    if (!isOwner && !isAuthor) {
      return res.status(403).json({ error: 'Access denied' });
    }

    project.gitStatus.commits = commits.filter((c) => String(c?.id || '') !== String(commitId));
    await project.save();

    return res.json({
      message: 'Commit history entry deleted',
      commits: project.gitStatus.commits,
    });
  } catch (error) {
    return sendGitError(res, error, 'Failed to delete commit history entry');
  }
});

// Get file blame (modification history per line)
router.get('/:projectId/blame/:fileName', verifyToken, async (req, res) => {
  try {
    const { projectId, fileName } = req.params;

    const project = req.project || await Project.findById(projectId).populate('owner', 'name email');
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
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

    const normalizedFileName = decodeURIComponent(String(fileName || '').trim());
    const normalizedLineNumber = Number(lineNumber);
    const normalizedUserName = String(userName || 'Unknown').slice(0, 120);
    const normalizedContent = String(content || '').slice(0, 5000);

    // This endpoint is best-effort metadata. Do not fail hard for invalid payloads.
    if (!normalizedFileName || !Number.isFinite(normalizedLineNumber) || normalizedLineNumber < 1) {
      return res.json({ success: false, skipped: true, reason: 'Invalid fileName/lineNumber' });
    }

    const project = req.project || await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Find the file
    const file = project.files.find(f => f.name === normalizedFileName);
    if (!file) {
      // File may have been renamed/deleted while typing; do not surface as client error.
      return res.json({ success: false, skipped: true, reason: 'File not found' });
    }

    // Initialize modifications array if not exists
    if (!file.modifications) {
      file.modifications = [];
    }

    // Update or add modification for this line
    const existingModIndex = file.modifications.findIndex(m => Number(m.lineNumber) === normalizedLineNumber);
    if (existingModIndex >= 0) {
      file.modifications[existingModIndex] = {
        lineNumber: normalizedLineNumber,
        userId: req.userId,
        userName: normalizedUserName,
        timestamp: new Date(),
        content: normalizedContent
      };
    } else {
      file.modifications.push({
        lineNumber: normalizedLineNumber,
        userId: req.userId,
        userName: normalizedUserName,
        timestamp: new Date(),
        content: normalizedContent
      });

      // Keep bounded to avoid validation failures on large/high-frequency edits.
      if (file.modifications.length > MAX_FILE_MODIFICATIONS) {
        file.modifications = file.modifications
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
          .slice(file.modifications.length - MAX_FILE_MODIFICATIONS);
      }
    }

    // Save as best-effort metadata; avoid 500 spam under concurrent writes.
    try {
      await project.save();
    } catch (saveError) {
      const msg = String(saveError?.message || '');
      const transient = msg.includes('VersionError') || msg.includes('No matching document found');
      if (transient) {
        return res.json({ success: false, skipped: true, reason: 'Concurrent update conflict' });
      }
      throw saveError;
    }

    res.json({ success: true, modifications: file.modifications });
  } catch (error) {
    console.error('[Git] track-modification failed:', error.message);
    // Non-critical feature: return success:false to prevent client-side runtime noise.
    res.json({ success: false, skipped: true, reason: error.message });
  }
});

// ─── REAL GIT OPERATIONS (child_process) ─────────────────────────────────────

// POST /:projectId/init — git init workspace + write project files to disk
router.post('/:projectId/init', verifyToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { remote } = req.body || {};
    if (!isSafeId(projectId)) return res.status(400).json({ error: 'Invalid project ID' });
    const project = req.project || await Project.findById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (project.owner.toString() !== req.userId) return res.status(403).json({ error: 'Only owner can initialize git' });

    const user = await User.findById(req.userId).lean();
    const githubToken = getUserGithubToken(user);
    if (!githubToken) {
      return res.status(428).json({ error: 'Please connect your GitHub account first', needsAuth: true });
    }

    const remoteUrl = normalizeRemoteUrl(remote || project.githubUrl);
    if (!remoteUrl) {
      return res.status(404).json({ error: 'Repository not found in your GitHub account. Please create it first.' });
    }

    const validation = await validateGithubRepositoryAccess({ githubToken, remoteUrl });
    if (!validation.ok) {
      return res.status(validation.status).json(validation.body);
    }

    project.githubUrl = remoteUrl;

    const workspacePath = getWorkspacePath(projectId);
    await ensureGitInit(workspacePath, user?.email, user?.name);
    await runGit(workspacePath, ['checkout', '-B', project.gitStatus?.branch || DEFAULT_GIT_BRANCH]);
    await syncFilesToDisk(workspacePath, project.files || []);
    await setOriginWithAuth(workspacePath, remoteUrl, githubToken);
    await runGit(workspacePath, ['add', '.']);
    if ((project.files || []).length > 0) {
      await runGit(workspacePath, ['commit', '-m', 'Initial commit', '--allow-empty']);
    }

    project.gitStatus = project.gitStatus || {};
    project.gitStatus.branch = project.gitStatus.branch || DEFAULT_GIT_BRANCH;
    project.gitStatus.staged = [];
    project.gitStatus.unstaged = (project.files || []).map(f => f.name).filter(n => !n.endsWith('/'));
    project.gitStatus.untracked = [];
    await project.save();

    res.json({ message: 'Git repository initialized', branch: project.gitStatus.branch });
  } catch (error) {
    console.error('[Git] init error:', error.message);
    sendGitError(res, error, 'Failed to initialize git workspace');
  }
});

// POST /:projectId/push — write files to workspace + git add/commit/push to GitHub
router.post('/:projectId/push', verifyToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { message, remote, branch: requestedBranch } = req.body;
    if (!isSafeId(projectId)) return res.status(400).json({ error: 'Invalid project ID' });

    const project = req.project || await Project.findById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (project.owner.toString() !== req.userId) return res.status(403).json({ error: 'Only owner can push' });

    const user = await User.findById(req.userId).lean();
    const githubToken = getUserGithubToken(user);
    if (!githubToken) {
      return res.status(428).json({ error: 'Please connect your GitHub account first', needsAuth: true });
    }

    const remoteUrl = normalizeRemoteUrl(remote || project.githubUrl);
    if (!remoteUrl) {
      return res.status(404).json({ error: 'Repository not found in your GitHub account. Please create it first.' });
    }

    const validation = await validateGithubRepositoryAccess({ githubToken, remoteUrl });
    if (!validation.ok) {
      return res.status(validation.status).json(validation.body);
    }
    project.githubUrl = remoteUrl;

    const workspacePath = getWorkspacePath(projectId);
    await ensureGitInit(workspacePath, user.email, user.name);
    await syncFilesToDisk(workspacePath, project.files || []);

    await setOriginWithAuth(workspacePath, remoteUrl, githubToken);
    await runGit(workspacePath, ['fetch', 'origin']);

    await runGit(workspacePath, ['add', '.']);
    const commitMsg = (message || '').trim() || 'Update from CollabCode';
    await runGit(workspacePath, ['commit', '-m', commitMsg, '--allow-empty']);

    let branch = String(requestedBranch || '').trim();
    if (branch && !/^[a-zA-Z0-9/_.-]+$/.test(branch)) {
      return res.status(400).json({ error: 'Invalid branch name' });
    }
    if (!branch) {
      branch = project.gitStatus?.branch || await resolveRemoteDefaultBranch(workspacePath);
    }
    await runGit(workspacePath, ['checkout', '-B', branch]);
    let pushResult = await runGit(workspacePath, ['push', '-u', 'origin', branch, '--force-with-lease']);
    if (!pushResult.success) {
      // New branch or diverged — try without force-with-lease
      pushResult = await runGit(workspacePath, ['push', '-u', 'origin', branch]);
    }
    if (!pushResult.success && pushResult.stderr) {
      const classified = classifyGitRemoteError(pushResult.stderr);
      if (classified) return res.status(classified.status).json(classified.body);
      return res.status(500).json({ error: pushResult.stderr });
    }

    // Record commit in MongoDB
    const commit = {
      id: Date.now().toString(),
      message: commitMsg,
      author: req.userId,
      authorName: user?.name || 'Unknown User',
      branch,
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
    sendGitError(res, error, 'Failed to push to GitHub');
  }
});

// POST /:projectId/pull — git pull from GitHub, sync files back to DB
router.post('/:projectId/pull', verifyToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { remote, branch: requestedBranch } = req.body;
    if (!isSafeId(projectId)) return res.status(400).json({ error: 'Invalid project ID' });

    const project = req.project || await Project.findById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (project.owner.toString() !== req.userId) return res.status(403).json({ error: 'Only owner can pull' });

    const user = await User.findById(req.userId).lean();
    const githubToken = getUserGithubToken(user);
    if (!githubToken) {
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

    await setOriginWithAuth(workspacePath, remoteUrl, githubToken);

    await runGit(workspacePath, ['fetch', 'origin']);
    let branch = String(requestedBranch || '').trim();
    if (branch && !/^[a-zA-Z0-9/_.-]+$/.test(branch)) {
      return res.status(400).json({ error: 'Invalid branch name' });
    }
    if (!branch) {
      branch = project.gitStatus?.branch || await resolveRemoteDefaultBranch(workspacePath);
    }
    const checkoutResult = await runGit(workspacePath, ['checkout', branch]);
    if (!checkoutResult.success) {
      await runGit(workspacePath, ['checkout', '-B', branch, `origin/${branch}`]);
    }
    const pullResult = await runGit(workspacePath, ['pull', 'origin', branch, '--no-rebase']);

    if (!pullResult.success && !pullResult.stdout.includes('Already up to date')) {
      const classified = classifyGitRemoteError(pullResult.stderr);
      if (classified) return res.status(classified.status).json(classified.body);
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
    sendGitError(res, error, 'Failed to pull from GitHub');
  }
});

// GET /:projectId/branches — list branches from workspace
router.get('/:projectId/branches', verifyToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    if (!isSafeId(projectId)) return res.status(400).json({ error: 'Invalid project ID' });
    const project = req.project || await Project.findById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const workspacePath = getWorkspacePath(projectId);
    const user = await User.findById(req.userId).lean();
    const githubToken = getUserGithubToken(user);
    const remoteUrl = normalizeRemoteUrl(project.githubUrl || '');

    await ensureGitInit(workspacePath, user?.email, user?.name);

    if (remoteUrl && githubToken) {
      await setOriginWithAuth(workspacePath, remoteUrl, githubToken);
      await runGit(workspacePath, ['fetch', '--prune', 'origin']);
    }

    const localResult = await runGit(workspacePath, ['for-each-ref', '--format=%(refname:short)', 'refs/heads']);
    const localBranches = (localResult.stdout || '').split('\n').map((b) => b.trim()).filter(Boolean);

    const remoteResult = await runGit(workspacePath, ['ls-remote', '--heads', 'origin']);
    const remoteBranches = (remoteResult.stdout || '')
      .split('\n')
      .map((line) => {
        const match = line.match(/refs\/heads\/([^\s]+)$/);
        return match ? match[1] : '';
      })
      .filter(Boolean);

    const currentResult = await runGit(workspacePath, ['rev-parse', '--abbrev-ref', 'HEAD']);
    const current = currentResult.success
      ? (currentResult.stdout || project.gitStatus?.branch || DEFAULT_GIT_BRANCH)
      : (project.gitStatus?.branch || DEFAULT_GIT_BRANCH);

    const branches = [...new Set([...localBranches, ...remoteBranches])]
      .filter((name) => name && name !== 'HEAD')
      .sort((a, b) => a.localeCompare(b));

    if (!branches.includes(current)) {
      branches.unshift(current);
    }

    res.json({ branches, current });
  } catch (error) {
    sendGitError(res, error, 'Failed to list branches');
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
    const project = req.project || await Project.findById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (project.owner.toString() !== req.userId) return res.status(403).json({ error: 'Only owner can manage branches' });

    const user = await User.findById(req.userId).lean();
    const workspacePath = getWorkspacePath(projectId);
    await ensureGitInit(workspacePath, user?.email, user?.name);
    await syncFilesToDisk(workspacePath, project.files || []);
    await runGit(workspacePath, ['add', '.']);
    await runGit(workspacePath, ['commit', '-m', `Checkpoint before switching to ${safeName}`, '--allow-empty']);

    let result;
    if (action === 'switch') {
      result = await runGit(workspacePath, ['checkout', safeName]);
      if (!result.success) {
        // Support switching to remote-only branches without requiring manual local branch creation.
        result = await runGit(workspacePath, ['checkout', '-B', safeName, `origin/${safeName}`]);
      }
    } else {
      result = await runGit(workspacePath, ['checkout', '-b', safeName]);
    }

    if (!result.success && result.stderr && !result.stderr.includes('Switched')) {
      return res.status(400).json({ error: classifyGitErrorMessage(result.stderr, 'Branch switch failed') });
    }

    const githubToken = getUserGithubToken(user);
    if (project.githubUrl && githubToken) {
      await setOriginWithAuth(workspacePath, project.githubUrl, githubToken);
      await runGit(workspacePath, ['push', '-u', 'origin', safeName]);
    }

    project.gitStatus = project.gitStatus || {};
    project.gitStatus.branch = safeName;
    await project.save();

    res.json({ message: `Switched to branch "${safeName}"`, branch: safeName });
  } catch (error) {
    sendGitError(res, error, 'Failed to update branch');
  }
});

// GET /:projectId/diff — get unified diff (all files or one file)
router.get('/:projectId/diff', verifyToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { file } = req.query;
    if (!isSafeId(projectId)) return res.status(400).json({ error: 'Invalid project ID' });

    const project = req.project || await Project.findById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

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
    sendGitError(res, error, 'Failed to generate diff');
  }
});

module.exports = router;
