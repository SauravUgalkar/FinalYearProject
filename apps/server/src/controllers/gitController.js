const Project = require('../models/Project');
const {
  workspacePath,
  runGit,
  ensureWorkspace,
  checkGitInstalled,
  checkRepoExists,
  parseStatus,
  ensureMainBranch,
  normalizeRepoUrl,
} = require('../services/gitService');

const canAccess = (project, userId) => {
  if (!project) return false;
  if (project.owner?.toString() === userId) return true;
  return (project.collaborators || []).some((c) => c.userId?.toString() === userId);
};

const loadProject = async (projectId, userId) => {
  const project = await Project.findById(projectId);
  if (!project) {
    const err = new Error('Project not found');
    err.status = 404;
    throw err;
  }
  if (!canAccess(project, userId)) {
    const err = new Error('Access denied');
    err.status = 403;
    throw err;
  }
  return project;
};

const execute = async (res, cwd, command, args) => {
  const result = await runGit(cwd, args);
  if (!result.success) {
    return res.status(400).json({
      command,
      output: result.stdout,
      error: result.stderr || 'Git command failed',
    });
  }
  return res.json({
    command,
    output: result.stdout || result.stderr || 'OK',
  });
};

const getSimpleStatus = async (req, res) => {
  try {
    const { projectId } = req.params;
    await loadProject(projectId, req.userId);

    const cwd = workspacePath(projectId);
    const git = await checkGitInstalled();
    await ensureWorkspace(cwd);
    const repositoryExists = await checkRepoExists(cwd);

    let branch = 'main';
    let changedFiles = [];
    if (git.ok && repositoryExists) {
      const statusResult = await runGit(cwd, ['status', '--porcelain', '-b']);
      if (statusResult.success) {
        const parsed = parseStatus(statusResult.stdout);
        branch = parsed.branch;
        changedFiles = parsed.changedFiles;
      }
    }

    return res.json({
      gitInstalled: git.ok,
      repositoryExists,
      branch,
      changedFiles,
    });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message });
  }
};

const initRepository = async (req, res) => {
  try {
    const { projectId } = req.params;
    await loadProject(projectId, req.userId);
    const cwd = workspacePath(projectId);
    await ensureWorkspace(cwd);

    return execute(res, cwd, 'git init', ['init']);
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message });
  }
};

const stageAllChanges = async (req, res) => {
  try {
    const { projectId } = req.params;
    await loadProject(projectId, req.userId);
    const cwd = workspacePath(projectId);
    await ensureWorkspace(cwd);

    return execute(res, cwd, 'git add .', ['add', '.']);
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message });
  }
};

const commitChanges = async (req, res) => {
  try {
    const { projectId } = req.params;
    const message = String(req.body?.message || '').trim();
    if (!message) return res.status(400).json({ error: 'Commit message is required' });

    await loadProject(projectId, req.userId);
    const cwd = workspacePath(projectId);
    await ensureWorkspace(cwd);

    return execute(res, cwd, `git commit -m "${message}"`, ['commit', '-m', message]);
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message });
  }
};

const pushChanges = async (req, res) => {
  try {
    const { projectId } = req.params;
    await loadProject(projectId, req.userId);
    const cwd = workspacePath(projectId);
    await ensureWorkspace(cwd);

    const branch = await ensureMainBranch(cwd);
    return execute(res, cwd, `git push origin ${branch}`, ['push', 'origin', branch]);
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message });
  }
};

const pullChanges = async (req, res) => {
  try {
    const { projectId } = req.params;
    await loadProject(projectId, req.userId);
    const cwd = workspacePath(projectId);
    await ensureWorkspace(cwd);

    const branch = await ensureMainBranch(cwd);
    return execute(res, cwd, `git pull origin ${branch}`, ['pull', 'origin', branch]);
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message });
  }
};

const connectRemote = async (req, res) => {
  try {
    const { projectId } = req.params;
    const repoUrl = normalizeRepoUrl(req.body?.repoUrl);
    if (!repoUrl) return res.status(400).json({ error: 'Valid repository URL is required' });

    const project = await loadProject(projectId, req.userId);
    const cwd = workspacePath(projectId);
    await ensureWorkspace(cwd);

    const remoteCheck = await runGit(cwd, ['remote', 'get-url', 'origin']);
    const args = remoteCheck.success
      ? ['remote', 'set-url', 'origin', repoUrl]
      : ['remote', 'add', 'origin', repoUrl];

    const result = await runGit(cwd, args);
    if (!result.success) {
      return res.status(400).json({
        command: `git ${args.join(' ')}`,
        output: result.stdout,
        error: result.stderr || 'Failed to connect remote',
      });
    }

    project.githubUrl = repoUrl;
    await project.save();

    return res.json({
      command: `git ${args.join(' ')}`,
      output: result.stdout || result.stderr || 'Remote configured',
    });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message });
  }
};

const cloneRepository = async (req, res) => {
  try {
    const { projectId } = req.params;
    const repoUrl = normalizeRepoUrl(req.body?.repoUrl);
    if (!repoUrl) return res.status(400).json({ error: 'Valid repository URL is required' });

    const project = await loadProject(projectId, req.userId);
    const cwd = workspacePath(projectId);
    await ensureWorkspace(cwd);

    const result = await runGit(cwd, ['clone', repoUrl, '.']);
    if (!result.success) {
      return res.status(400).json({
        command: `git clone ${repoUrl}`,
        output: result.stdout,
        error: result.stderr || 'Clone failed',
      });
    }

    project.githubUrl = repoUrl;
    await project.save();

    return res.json({
      command: `git clone ${repoUrl}`,
      output: result.stdout || result.stderr || 'Repository cloned',
    });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message });
  }
};

module.exports = {
  getSimpleStatus,
  initRepository,
  stageAllChanges,
  commitChanges,
  pushChanges,
  pullChanges,
  connectRemote,
  cloneRepository,
};
