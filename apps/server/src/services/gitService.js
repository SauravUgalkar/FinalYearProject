const fs = require('fs').promises;
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);
const WORKSPACE_ROOT = '/tmp/workspaces';

const workspacePath = (projectId) => path.join(WORKSPACE_ROOT, String(projectId));

const runGit = async (cwd, args) => {
  try {
    const { stdout, stderr } = await execFileAsync('git', args, {
      cwd,
      timeout: 30000,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_ASKPASS: 'echo' },
    });
    return { success: true, stdout: (stdout || '').trim(), stderr: (stderr || '').trim() };
  } catch (error) {
    return {
      success: false,
      stdout: (error.stdout || '').trim(),
      stderr: (error.stderr || error.message || '').trim(),
    };
  }
};

const ensureWorkspace = async (cwd) => {
  await fs.mkdir(cwd, { recursive: true });
};

const checkGitInstalled = async () => {
  const result = await runGit(process.cwd(), ['--version']);
  return { ok: result.success, output: result.stdout || result.stderr };
};

const checkRepoExists = async (cwd) => {
  try {
    await fs.access(path.join(cwd, '.git'));
    return true;
  } catch {
    return false;
  }
};

const parseStatus = (raw) => {
  const lines = String(raw || '').split('\n').filter(Boolean);
  let branch = 'main';
  const changedFiles = [];

  for (const line of lines) {
    if (line.startsWith('##')) {
      const branchPart = line.replace(/^##\s*/, '').split('...')[0].trim();
      if (branchPart) branch = branchPart;
      continue;
    }

    if (line.length < 3) continue;
    const x = line[0];
    const y = line[1];
    const filePath = line.slice(3).trim();
    const state = x !== ' ' ? x : y;

    changedFiles.push({
      path: filePath,
      state: state === '?' ? '??' : state,
    });
  }

  return { branch, changedFiles };
};

const ensureMainBranch = async (cwd) => {
  const current = await runGit(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']);
  const branch = current.success ? current.stdout : 'main';
  return branch && branch !== 'HEAD' ? branch : 'main';
};

const normalizeRepoUrl = (repoUrl) => {
  const trimmed = String(repoUrl || '').trim();
  if (!trimmed) return '';
  try {
    const url = new URL(trimmed);
    if (!/^https?:$/.test(url.protocol)) return '';
    return trimmed;
  } catch {
    return '';
  }
};

module.exports = {
  workspacePath,
  runGit,
  ensureWorkspace,
  checkGitInstalled,
  checkRepoExists,
  parseStatus,
  ensureMainBranch,
  normalizeRepoUrl,
};
