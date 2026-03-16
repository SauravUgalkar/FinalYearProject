import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  GitBranch,
  RefreshCw,
  FolderGit2,
  Plus,
  Check,
  Upload,
  Download,
  Copy,
  Link2,
  Terminal,
  AlertCircle,
} from 'lucide-react';
import { gitService } from '../services/gitService';

function statusColor(state) {
  if (state === 'M') return 'text-yellow-300';
  if (state === 'A' || state === '??') return 'text-green-300';
  if (state === 'D') return 'text-red-300';
  return 'text-gray-300';
}

function statusLabel(state) {
  if (state === 'M') return 'Modified';
  if (state === 'A' || state === '??') return 'New';
  if (state === 'D') return 'Deleted';
  return 'Changed';
}

function classify(entries) {
  const groups = { modified: [], added: [], deleted: [] };
  for (const entry of entries || []) {
    if (entry.state === 'M') groups.modified.push(entry);
    else if (entry.state === 'A' || entry.state === '??') groups.added.push(entry);
    else if (entry.state === 'D') groups.deleted.push(entry);
  }
  return groups;
}

function OutputLine({ line }) {
  const tone = line.type === 'error'
    ? 'text-red-300'
    : line.type === 'success'
      ? 'text-green-300'
      : 'text-gray-300';

  return (
    <div className={`text-xs leading-5 ${tone}`}>
      <span className="text-gray-500">$</span> {line.command}
      {line.output ? <div className="whitespace-pre-wrap pl-4">{line.output}</div> : null}
    </div>
  );
}

export default function GitPanel({ projectId }) {
  const [status, setStatus] = useState({
    gitInstalled: false,
    repositoryExists: false,
    branch: 'main',
    changedFiles: [],
  });
  const [loading, setLoading] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [output, setOutput] = useState([]);

  const groups = useMemo(() => classify(status.changedFiles), [status.changedFiles]);

  const appendOutput = useCallback((type, command, outputText) => {
    const next = {
      id: Date.now() + Math.random(),
      type,
      command,
      output: String(outputText || '').trim(),
    };
    setOutput((prev) => [next, ...prev].slice(0, 30));
  }, []);

  const runAction = useCallback(async (command, action) => {
    setLoading(true);
    try {
      const data = await action();
      if (data?.command || data?.output || data?.error) {
        appendOutput(data?.error ? 'error' : 'success', data.command || command, data.error || data.output || 'Done');
      } else {
        appendOutput('success', command, 'Done');
      }
      const nextStatus = await gitService.getStatus(projectId);
      setStatus(nextStatus);
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || 'Command failed';
      appendOutput('error', command, message);
    } finally {
      setLoading(false);
    }
  }, [appendOutput, projectId]);

  const refreshStatus = useCallback(async () => {
    setLoading(true);
    try {
      const data = await gitService.getStatus(projectId);
      setStatus(data);
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || 'Failed to load git status';
      appendOutput('error', 'git status', message);
    } finally {
      setLoading(false);
    }
  }, [appendOutput, projectId]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  return (
    <div className="h-full bg-[#0d1117] text-gray-100 flex flex-col">
      <div className="px-4 py-3 border-b border-gray-800 bg-[#161b22] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderGit2 size={16} className="text-blue-400" />
          <h3 className="text-sm font-semibold">Source Control</h3>
        </div>
        <button
          type="button"
          onClick={refreshStatus}
          className="p-1.5 rounded hover:bg-gray-800 text-gray-300"
          title="Refresh status"
          disabled={loading}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <section className="rounded-lg border border-gray-800 bg-[#161b22] p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <GitBranch size={14} className="text-blue-400" />
              Repository Status
            </div>
            <span className="text-xs text-gray-400">Branch: {status.branch || 'main'}</span>
          </div>
          <div className="text-xs text-gray-300">
            Git installed: <span className={status.gitInstalled ? 'text-green-300' : 'text-red-300'}>{status.gitInstalled ? 'Yes' : 'No'}</span>
          </div>
          <div className="text-xs text-gray-300">
            Repository: <span className={status.repositoryExists ? 'text-green-300' : 'text-yellow-300'}>{status.repositoryExists ? 'Initialized' : 'Not initialized'}</span>
          </div>
          {!status.repositoryExists && (
            <button
              type="button"
              onClick={() => runAction('git init', () => gitService.initRepo(projectId))}
              disabled={loading || !status.gitInstalled}
              className="w-full px-3 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-medium"
            >
              Initialize Repository
            </button>
          )}
        </section>

        <section className="rounded-lg border border-gray-800 bg-[#161b22] p-3">
          <div className="text-sm font-medium mb-3">Changed Files</div>
          {!status.changedFiles?.length && (
            <div className="text-xs text-gray-400">No local changes</div>
          )}
          {!!status.changedFiles?.length && (
            <div className="space-y-3">
              {[
                ['Modified', groups.modified],
                ['New', groups.added],
                ['Deleted', groups.deleted],
              ].map(([title, items]) => (
                <div key={title}>
                  <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">{title}</div>
                  {!items.length && <div className="text-xs text-gray-600">None</div>}
                  {!!items.length && (
                    <ul className="space-y-1">
                      {items.map((entry) => (
                        <li key={`${entry.path}-${entry.state}`} className="flex items-center justify-between text-xs">
                          <span className="text-gray-200 truncate pr-3">{entry.path}</span>
                          <span className={statusColor(entry.state)}>{statusLabel(entry.state)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-gray-800 bg-[#161b22] p-3 space-y-3">
          <div className="text-sm font-medium">Commit Message</div>
          <input
            type="text"
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            placeholder="Write commit message..."
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm placeholder:text-gray-500 focus:outline-none focus:border-blue-500"
          />
        </section>

        <section className="rounded-lg border border-gray-800 bg-[#161b22] p-3 space-y-2">
          <div className="text-sm font-medium mb-2">Git Actions</div>
          <div className="grid grid-cols-1 gap-2">
            <button type="button" disabled={loading} onClick={() => runAction('git init', () => gitService.initRepo(projectId))} className="flex items-center gap-2 px-3 py-2 rounded bg-gray-800 hover:bg-gray-700 text-sm disabled:opacity-50">
              <Plus size={14} /> Initialize Repo
            </button>
            <button type="button" disabled={loading} onClick={() => runAction('git add .', () => gitService.stageAll(projectId))} className="flex items-center gap-2 px-3 py-2 rounded bg-gray-800 hover:bg-gray-700 text-sm disabled:opacity-50">
              <Check size={14} /> Stage All Changes
            </button>
            <button
              type="button"
              disabled={loading || !commitMessage.trim()}
              onClick={() => runAction(`git commit -m "${commitMessage.trim()}"`, () => gitService.commit(projectId, commitMessage.trim()))}
              className="flex items-center gap-2 px-3 py-2 rounded bg-gray-800 hover:bg-gray-700 text-sm disabled:opacity-50"
            >
              <Copy size={14} /> Commit Changes
            </button>
            <button type="button" disabled={loading} onClick={() => runAction('git push origin main', () => gitService.push(projectId))} className="flex items-center gap-2 px-3 py-2 rounded bg-gray-800 hover:bg-gray-700 text-sm disabled:opacity-50">
              <Upload size={14} /> Push to GitHub
            </button>
            <button type="button" disabled={loading} onClick={() => runAction('git pull origin main', () => gitService.pull(projectId))} className="flex items-center gap-2 px-3 py-2 rounded bg-gray-800 hover:bg-gray-700 text-sm disabled:opacity-50">
              <Download size={14} /> Pull Latest Changes
            </button>
          </div>
        </section>

        <section className="rounded-lg border border-gray-800 bg-[#161b22] p-3 space-y-3">
          <div className="text-sm font-medium">GitHub Connection</div>
          <input
            type="text"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/user/repo.git"
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm placeholder:text-gray-500 focus:outline-none focus:border-blue-500"
          />
          <div className="grid grid-cols-1 gap-2">
            <button
              type="button"
              disabled={loading || !repoUrl.trim()}
              onClick={() => runAction(`git remote add origin ${repoUrl.trim()}`, () => gitService.connectRemote(projectId, repoUrl.trim()))}
              className="flex items-center gap-2 px-3 py-2 rounded bg-blue-600 hover:bg-blue-500 text-sm disabled:opacity-50"
            >
              <Link2 size={14} /> Connect to GitHub Repository
            </button>
            <button
              type="button"
              disabled={loading || !repoUrl.trim()}
              onClick={() => runAction(`git clone ${repoUrl.trim()}`, () => gitService.clone(projectId, repoUrl.trim()))}
              className="flex items-center gap-2 px-3 py-2 rounded bg-gray-800 hover:bg-gray-700 text-sm disabled:opacity-50"
            >
              <Download size={14} /> Clone Repository
            </button>
          </div>
        </section>
      </div>

      <div className="border-t border-gray-800 bg-[#0b0f14] p-3">
        <div className="flex items-center gap-2 text-xs font-medium text-gray-300 mb-2">
          <Terminal size={13} /> Output
        </div>
        <div className="max-h-36 overflow-y-auto space-y-2 rounded border border-gray-800 bg-black/30 p-2">
          {!output.length && (
            <div className="text-xs text-gray-500 flex items-center gap-2">
              <AlertCircle size={12} /> No commands executed yet.
            </div>
          )}
          {output.map((line) => (
            <OutputLine key={line.id} line={line} />
          ))}
        </div>
      </div>
    </div>
  );
}
