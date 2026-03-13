import React, { useState, useEffect, useCallback } from 'react';
import {
  GitBranch, GitCommit, Plus, Check, X, RefreshCw, Upload, Download,
  Link2, AlertCircle, CheckCircle2, GitMerge, ChevronDown, ChevronRight,
  Terminal, Clock, Wifi, WifiOff, FolderGit2, ArrowUpFromLine, ArrowDownToLine
} from 'lucide-react';
import axios from 'axios';

const API = 'http://localhost:5000/api';
const token = () => sessionStorage.getItem('token');
const headers = () => ({ Authorization: `Bearer ${token()}` });

// ── tiny helpers ────────────────────────────────────────────────
function Badge({ children, color = 'gray' }) {
  const colors = {
    gray:   'bg-gray-800 text-gray-300 border-gray-700',
    blue:   'bg-blue-950 text-blue-300 border-blue-800',
    green:  'bg-green-950 text-green-300 border-green-800',
    yellow: 'bg-yellow-950 text-yellow-300 border-yellow-800',
    purple: 'bg-purple-950 text-purple-300 border-purple-800',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${colors[color]}`}>
      {children}
    </span>
  );
}

function SectionHeader({ number, title, icon: Icon, color = 'blue', open, onToggle, badge }) {
  const accent = {
    blue:   'text-blue-400',
    green:  'text-green-400',
    purple: 'text-purple-400',
    orange: 'text-orange-400',
    teal:   'text-teal-400',
  };
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-white/5 transition-colors rounded-lg"
    >
      <div className="flex items-center gap-2.5">
        <span className={`flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-bold border ${accent[color]} border-current`}>
          {number}
        </span>
        <Icon size={14} className={accent[color]} />
        <span className="text-sm font-semibold text-white">{title}</span>
        {badge !== undefined && badge !== null && (
          <Badge color={badge > 0 ? 'yellow' : 'gray'}>{badge}</Badge>
        )}
      </div>
      {open ? <ChevronDown size={14} className="text-gray-500" /> : <ChevronRight size={14} className="text-gray-500" />}
    </button>
  );
}

function Divider() {
  return <div className="h-px bg-gray-800 mx-3" />;
}

// ── main component ───────────────────────────────────────────────
export default function GitControl({ projectId, onFilesChanged }) {
  const [status, setStatus] = useState({ staged: [], unstaged: [], untracked: [], branch: 'main', commits: [] });
  const [fetching, setFetching] = useState(true);

  const [commitMessage, setCommitMessage]   = useState('');
  const [pushMessage,   setPushMessage]     = useState('');
  const [remoteUrl,     setRemoteUrl]       = useState('');

  const [commitLoading, setCommitLoading] = useState(false);
  const [pushLoading,   setPushLoading]   = useState(false);
  const [pullLoading,   setPullLoading]   = useState(false);
  const [initLoading,   setInitLoading]   = useState(false);
  const [branchLoading, setBranchLoading] = useState(false);

  const [branches,      setBranches]      = useState([]);
  const [newBranchName, setNewBranchName] = useState('');

  const [githubLinked, setGithubLinked] = useState(!!localStorage.getItem('github_token'));

  // toast  { type: 'success'|'error'|'info', text }
  const [toast, setToast] = useState(null);

  // collapsed sections: by default all open
  const [open, setOpen] = useState({ connect: true, stage: true, sync: true, branches: true, history: false });
  const toggle = (key) => setOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  const showToast = (type, text) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 5000);
  };

  // ── data fetching ────────────────────────────────────────────
  const fetchGitStatus = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setFetching(true);
      const res = await axios.get(`${API}/git/${projectId}/status`, { headers: headers() });
      setStatus(res.data);
      if (res.data?.remoteUrl) setRemoteUrl(res.data.remoteUrl);
    } catch {
      if (!silent) {
        setStatus({ staged: [], unstaged: [], untracked: [], branch: 'main', commits: [] });
      }
    } finally {
      if (!silent) setFetching(false);
    }
  }, [projectId]);

  const fetchBranches = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/git/${projectId}/branches`, { headers: headers() });
      setBranches(res.data.branches || []);
      if (res.data.current) setStatus((p) => ({ ...p, branch: res.data.current }));
    } catch {
      setBranches([]);
    }
  }, [projectId]);

  useEffect(() => { fetchGitStatus(); }, [fetchGitStatus]);
  useEffect(() => { fetchBranches(); },  [fetchBranches]);

  // Keep status fresh so Stage & Commit detects new/edited files quickly.
  useEffect(() => {
    const timer = setInterval(() => {
      fetchGitStatus({ silent: true });
    }, 4000);
    return () => clearInterval(timer);
  }, [fetchGitStatus]);

  // ── staging ───────────────────────────────────────────────────
  const stage = async (files) => {
    try {
      const res = await axios.post(`${API}/git/${projectId}/stage`, { files }, { headers: headers() });
      setStatus(res.data);
    } catch { fetchGitStatus(); }
  };

  const unstage = async (file) => {
    try {
      const res = await axios.post(`${API}/git/${projectId}/unstage`, { files: [file] }, { headers: headers() });
      setStatus(res.data);
    } catch { fetchGitStatus(); }
  };

  const stageAll = () => {
    const all = [...status.unstaged, ...status.untracked];
    if (all.length) stage(all);
  };

  const unstageAll = () => {
    if (status.staged.length) {
      // unstage one by one sequentially via reduce-chain
      status.staged.reduce((p, f) => p.then(() => unstage(f)), Promise.resolve());
    }
  };

  // ── commit ────────────────────────────────────────────────────
  const handleCommit = async () => {
    if (!commitMessage.trim()) return showToast('error', 'Enter a commit message.');
    if (!status.staged.length)  return showToast('error', 'Stage at least one file first.');
    setCommitLoading(true);
    try {
      const res = await axios.post(`${API}/git/${projectId}/commit`, { message: commitMessage }, { headers: headers() });
      setStatus(res.data.gitStatus);
      setCommitMessage('');
      showToast('success', 'Committed successfully.');
    } catch (err) {
      showToast('error', err.response?.data?.error || 'Commit failed.');
    } finally { setCommitLoading(false); }
  };

  // ── github connect ────────────────────────────────────────────
  const connectGitHub = async () => {
    try {
      const appToken = sessionStorage.getItem('token');
      if (appToken) localStorage.setItem('oauth_app_token', appToken);

      const res  = await fetch(`${API}/github/auth-url`);
      const data = await res.json();
      if (!data.authUrl) return showToast('error', data.error || 'GitHub OAuth not configured.');

      const w = 600, h = 700;
      const popup = window.open(
        data.authUrl, 'GitHub',
        `width=${w},height=${h},left=${(window.screen.width - w) / 2},top=${(window.screen.height - h) / 2}`
      );
      const poll = setInterval(() => {
        if (popup && popup.closed) {
          clearInterval(poll);
          if (localStorage.getItem('github_token')) {
            setGithubLinked(true);
            showToast('success', 'GitHub connected successfully.');
          }
        }
      }, 500);
    } catch { showToast('error', 'Could not start GitHub login.'); }
  };

  // ── init ──────────────────────────────────────────────────────
  const handleInit = async () => {
    setInitLoading(true);
    try {
      const res = await axios.post(`${API}/git/${projectId}/init`, {}, { headers: headers() });
      showToast('success', res.data.message || 'Workspace initialised.');
      fetchGitStatus();
    } catch (err) {
      showToast('error', err.response?.data?.error || 'Init failed.');
    } finally { setInitLoading(false); }
  };

  // ── pull ──────────────────────────────────────────────────────
  const handlePull = async () => {
    if (!githubLinked) return connectGitHub();
    setPullLoading(true);
    try {
      const res = await axios.post(`${API}/git/${projectId}/pull`, { remote: remoteUrl || undefined }, { headers: headers() });
      showToast('success', res.data.message || 'Pull successful.');
      fetchGitStatus();
      if (onFilesChanged && res.data.files) onFilesChanged(res.data.files);
    } catch (err) {
      if (err.response?.data?.needsAuth) connectGitHub();
      else showToast('error', err.response?.data?.error || 'Pull failed.');
    } finally { setPullLoading(false); }
  };

  // ── push ──────────────────────────────────────────────────────
  const handlePush = async () => {
    if (!githubLinked) return connectGitHub();
    setPushLoading(true);
    try {
      const res = await axios.post(
        `${API}/git/${projectId}/push`,
        { message: pushMessage || 'Update from CollabCode', remote: remoteUrl || undefined },
        { headers: headers() }
      );
      showToast('success', res.data.message || 'Push successful.');
      fetchGitStatus();
    } catch (err) {
      if (err.response?.data?.needsAuth) connectGitHub();
      else showToast('error', err.response?.data?.error || 'Push failed.');
    } finally { setPushLoading(false); }
  };

  // ── branches ─────────────────────────────────────────────────
  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) return showToast('error', 'Enter a branch name.');
    setBranchLoading(true);
    try {
      const res = await axios.post(`${API}/git/${projectId}/branch`, { name: newBranchName.trim(), action: 'create' }, { headers: headers() });
      setNewBranchName('');
      showToast('success', res.data.message || 'Branch created.');
      fetchGitStatus(); fetchBranches();
    } catch (err) {
      showToast('error', err.response?.data?.error || 'Branch creation failed.');
    } finally { setBranchLoading(false); }
  };

  const handleSwitchBranch = async (branchName) => {
    if (!branchName || branchName === status.branch) return;
    setBranchLoading(true);
    try {
      const res = await axios.post(`${API}/git/${projectId}/branch`, { name: branchName, action: 'switch' }, { headers: headers() });
      showToast('success', res.data.message || `Switched to ${branchName}.`);
      fetchGitStatus(); fetchBranches();
    } catch (err) {
      showToast('error', err.response?.data?.error || 'Branch switch failed.');
    } finally { setBranchLoading(false); }
  };

  // ── derived state ─────────────────────────────────────────────
  const changedFiles  = [...(status.unstaged || []), ...(status.untracked || [])];
  const totalChanged  = changedFiles.length;
  const totalStaged   = status.staged?.length || 0;
  const remoteShort   = remoteUrl ? remoteUrl.replace('https://github.com/', '') : null;

  // ── loading skeleton ─────────────────────────────────────────
  if (fetching) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-500">
        <RefreshCw size={20} className="animate-spin text-blue-500" />
        <p className="text-xs">Loading repository status…</p>
      </div>
    );
  }

  // ── render ────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col bg-[#0d1117] text-gray-100 text-sm select-none">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800 bg-[#161b22]">
        <div className="flex items-center gap-2">
          <FolderGit2 size={16} className="text-blue-400" />
          <span className="font-semibold text-white tracking-tight">Source Control</span>
        </div>
        <div className="flex items-center gap-2">
          {githubLinked
            ? <Wifi size={13} className="text-green-400" title="GitHub connected" />
            : <WifiOff size={13} className="text-gray-500" title="Not connected" />
          }
          <button
            onClick={() => { fetchGitStatus(); fetchBranches(); }}
            className="p-1.5 rounded-md hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
            title="Refresh"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* ── Status bar ── */}
      <div className="flex items-center gap-2 px-4 py-2 bg-[#161b22] border-b border-gray-800 flex-wrap">
        <Badge color="blue">
          <GitBranch size={10} /> {status.branch || 'main'}
        </Badge>
        {remoteShort && (
          <Badge color="gray">
            <Link2 size={10} /> {remoteShort}
          </Badge>
        )}
        {totalChanged > 0 && (
          <Badge color="yellow">
            {totalChanged} changed
          </Badge>
        )}
        {totalStaged > 0 && (
          <Badge color="green">
            {totalStaged} staged
          </Badge>
        )}
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div className={`mx-3 mt-3 px-3 py-2.5 rounded-lg text-xs flex items-start gap-2 border
          ${toast.type === 'success'
            ? 'bg-green-950 border-green-800 text-green-300'
            : 'bg-red-950 border-red-800 text-red-300'}`}
        >
          {toast.type === 'success'
            ? <CheckCircle2 size={13} className="mt-0.5 flex-shrink-0" />
            : <AlertCircle  size={13} className="mt-0.5 flex-shrink-0" />
          }
          <span className="leading-relaxed">{toast.text}</span>
          <button onClick={() => setToast(null)} className="ml-auto text-current opacity-60 hover:opacity-100">
            <X size={12} />
          </button>
        </div>
      )}

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto pb-6">

        {/* ═══════════════════════════════════════════════
            SECTION 1 — Connect & Setup
        ═══════════════════════════════════════════════ */}
        <div className="mt-3 mx-2 rounded-xl border border-gray-800 overflow-hidden bg-[#161b22]">
          <SectionHeader
            number="1" icon={Link2} color="blue"
            title="Connect & Setup"
            open={open.connect} onToggle={() => toggle('connect')}
          />
          {open.connect && (
            <div className="px-3 pb-3 space-y-3">
              <Divider />

              {/* GitHub connect button */}
              <button
                onClick={connectGitHub}
                className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                  ${githubLinked
                    ? 'bg-green-900/40 hover:bg-green-900/60 text-green-300 border border-green-800'
                    : 'bg-blue-600 hover:bg-blue-500 text-white border border-blue-500'}`}
              >
                {githubLinked
                  ? <><CheckCircle2 size={15} /> GitHub Connected · Click to reconnect</>
                  : <><Link2 size={15} /> Connect GitHub Account</>
                }
              </button>

              {/* Remote URL */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                  Repository URL
                </label>
                <input
                  value={remoteUrl}
                  onChange={(e) => setRemoteUrl(e.target.value)}
                  placeholder="https://github.com/username/repo.git"
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition"
                />
                <p className="text-[11px] text-gray-600">Set once — saved automatically after first push.</p>
              </div>

              {/* Init */}
              <button
                onClick={handleInit}
                disabled={initLoading}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-200 text-sm border border-gray-700 transition"
              >
                <Terminal size={13} />
                {initLoading ? 'Initialising…' : 'Initialise Workspace'}
              </button>
              <p className="text-[11px] text-gray-600 -mt-1 text-center">Run once for a brand-new project.</p>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════
            SECTION 2 — Stage & Commit
        ═══════════════════════════════════════════════ */}
        <div className="mt-2 mx-2 rounded-xl border border-gray-800 overflow-hidden bg-[#161b22]">
          <SectionHeader
            number="2" icon={GitCommit} color="orange"
            title="Stage & Commit"
            open={open.stage} onToggle={() => toggle('stage')}
            badge={totalChanged + totalStaged}
          />
          {open.stage && (
            <div className="px-3 pb-3 space-y-3">
              <Divider />

              {/* Stage controls */}
              {(totalChanged > 0 || totalStaged > 0) ? (
                <div className="flex gap-2">
                  {totalChanged > 0 && (
                    <button
                      onClick={stageAll}
                      className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition"
                    >
                      <Plus size={12} /> Stage All ({totalChanged})
                    </button>
                  )}
                  {totalStaged > 0 && (
                    <button
                      onClick={unstageAll}
                      className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs border border-gray-700 transition"
                    >
                      <X size={12} /> Unstage All
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-600 text-center py-2">No changed files detected.</p>
              )}

              {totalChanged > 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-yellow-800/60 bg-yellow-950/30 px-2.5 py-2">
                  <AlertCircle size={13} className="text-yellow-400 flex-shrink-0" />
                  <p className="text-xs text-yellow-200">New changes are detected. Stage and commit them.</p>
                </div>
              )}

              {/* Staged files */}
              {totalStaged > 0 && (
                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-green-400 uppercase tracking-wider">Staged ({totalStaged})</p>
                  {status.staged.map((file) => (
                    <div key={file} className="flex items-center justify-between bg-green-950/20 border border-green-900/40 px-2.5 py-1.5 rounded-lg group">
                      <span className="flex items-center gap-1.5 text-xs text-green-300 min-w-0">
                        <Check size={11} className="flex-shrink-0" />
                        <span className="truncate">{file}</span>
                      </span>
                      <button
                        onClick={() => unstage(file)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-gray-400 hover:text-red-400 transition"
                        title="Unstage"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Changed / untracked files */}
              {totalChanged > 0 && (
                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-yellow-400 uppercase tracking-wider">Changed ({totalChanged})</p>
                  {changedFiles.map((file) => (
                    <div key={file} className="flex items-center justify-between bg-gray-900 border border-gray-800 px-2.5 py-1.5 rounded-lg group hover:border-gray-700 transition">
                      <span className="text-xs text-gray-300 truncate">{file}</span>
                      <button
                        onClick={() => stage([file])}
                        className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-600/80 hover:bg-blue-500 text-white text-[11px] transition"
                        title="Stage file"
                      >
                        <Plus size={10} /> Stage
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Commit message + button */}
              <div className="space-y-2 pt-1">
                <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                  Commit Message
                </label>
                <textarea
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleCommit(); }}
                  placeholder="Describe your changes…"
                  rows={2}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 resize-none transition"
                />
                <button
                  onClick={handleCommit}
                  disabled={commitLoading || !commitMessage.trim() || totalStaged === 0}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-800 disabled:text-gray-600 disabled:border-gray-700 text-white text-sm font-medium border border-transparent disabled:border-gray-700 transition"
                >
                  <GitCommit size={14} />
                  {commitLoading ? 'Committing…' : 'Commit Changes'}
                </button>
                <p className="text-[11px] text-gray-600">Tip: Ctrl+Enter to commit quickly.</p>
              </div>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════
            SECTION 3 — Push & Pull
        ═══════════════════════════════════════════════ */}
        <div className="mt-2 mx-2 rounded-xl border border-gray-800 overflow-hidden bg-[#161b22]">
          <SectionHeader
            number="3" icon={ArrowUpFromLine} color="green"
            title="Push & Pull"
            open={open.sync} onToggle={() => toggle('sync')}
          />
          {open.sync && (
            <div className="px-3 pb-3 space-y-3">
              <Divider />

              {/* Optional push commit message */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                  Push Message <span className="normal-case text-gray-600">(optional — auto-commit + push)</span>
                </label>
                <input
                  value={pushMessage}
                  onChange={(e) => setPushMessage(e.target.value)}
                  placeholder="e.g. Deploy latest changes"
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition"
                />
              </div>

              {/* Pull */}
              <button
                onClick={handlePull}
                disabled={pullLoading}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-blue-700 hover:bg-blue-600 disabled:bg-gray-800 disabled:text-gray-600 text-white text-sm font-medium border border-blue-600 disabled:border-gray-700 transition"
              >
                <ArrowDownToLine size={14} />
                {pullLoading ? 'Pulling…' : 'Pull from GitHub'}
              </button>

              {/* Push */}
              <button
                onClick={handlePush}
                disabled={pushLoading}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-green-700 hover:bg-green-600 disabled:bg-gray-800 disabled:text-gray-600 text-white text-sm font-medium border border-green-600 disabled:border-gray-700 transition"
              >
                <ArrowUpFromLine size={14} />
                {pushLoading ? 'Pushing…' : 'Push to GitHub'}
              </button>

              {/* Workflow tip */}
              <div className="bg-black-900/60 border border-black-800 rounded-lg px-3 py-2.5 space-y-1">
                <p className="text-[11px] font-semibold text-black-400 uppercase tracking-wider">Recommended Workflow</p>
                <ol className="text-[11px] text-black-500 space-y-0.5 list-decimal list-inside">
                  <li>Pull latest changes from GitHub</li>
                  <li>Make edits in the editor</li>
                  <li>Stage &amp; Commit (Section 2)</li>
                  <li>Push to GitHub</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════
            SECTION 4 — Branches
        ═══════════════════════════════════════════════ */}
        <div className="mt-2 mx-2 rounded-xl border border-gray-800 overflow-hidden bg-[#161b22]">
          <SectionHeader
            number="4" icon={GitBranch} color="purple"
            title="Branches"
            open={open.branches} onToggle={() => toggle('branches')}
            badge={branches.length || null}
          />
          {open.branches && (
            <div className="px-3 pb-3 space-y-3">
              <Divider />

              {/* Create branch */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                  New Branch
                </label>
                <div className="flex gap-2">
                  <input
                    value={newBranchName}
                    onChange={(e) => setNewBranchName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreateBranch(); }}
                    placeholder="feature/my-feature"
                    className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 transition"
                  />
                  <button
                    onClick={handleCreateBranch}
                    disabled={branchLoading || !newBranchName.trim()}
                    className="px-3.5 py-2 rounded-lg bg-purple-700 hover:bg-purple-600 disabled:bg-gray-800 disabled:text-gray-600 text-white text-sm font-medium border border-purple-600 disabled:border-gray-700 transition"
                  >
                    {branchLoading ? <RefreshCw size={13} className="animate-spin" /> : <Plus size={14} />}
                  </button>
                </div>
              </div>

              {/* Branch list */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                  All Branches
                </p>
                {branches.length > 0 ? (
                  <div className="space-y-1">
                    {branches.map((b) => {
                      const isCurrent = b === status.branch;
                      return (
                        <button
                          key={b}
                          onClick={() => handleSwitchBranch(b)}
                          disabled={branchLoading || isCurrent}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition
                            ${isCurrent
                              ? 'bg-purple-950/40 border-purple-800 text-purple-300 cursor-default'
                              : 'bg-gray-900 border-gray-800 text-gray-300 hover:bg-gray-800 hover:border-gray-700'
                            } disabled:opacity-70`}
                        >
                          <span className="flex items-center gap-2">
                            <GitMerge size={12} className={isCurrent ? 'text-purple-400' : 'text-gray-500'} />
                            <span className="font-mono text-xs">{b}</span>
                          </span>
                          {isCurrent
                            ? <Badge color="purple">current</Badge>
                            : <span className="text-[11px] text-gray-500">Switch →</span>
                          }
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-gray-600 py-2 text-center">
                    No branches yet. Initialise the workspace first.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════
            SECTION 5 — Commit History
        ═══════════════════════════════════════════════ */}
        {status.commits?.length > 0 && (
          <div className="mt-2 mx-2 rounded-xl border border-gray-800 overflow-hidden bg-[#161b22]">
            <SectionHeader
              number="5" icon={Clock} color="teal"
              title="Commit History"
              open={open.history} onToggle={() => toggle('history')}
              badge={status.commits.length}
            />
            {open.history && (
              <div className="px-3 pb-3 space-y-2">
                <Divider />
                {status.commits.slice(0, 8).map((c, idx) => (
                  <div key={c.id || idx} className="flex gap-3 px-2 py-2 rounded-lg hover:bg-gray-900/60 transition group">
                    <div className="flex flex-col items-center pt-1">
                      <div className="w-2 h-2 rounded-full bg-teal-500 flex-shrink-0" />
                      {idx < Math.min(status.commits.length - 1, 7) && (
                        <div className="w-px flex-1 bg-gray-800 mt-1" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 pb-1">
                      <p className="text-xs text-white truncate font-medium">{c.message}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1">
                        <Clock size={9} />
                        {new Date(c.date).toLocaleString()}
                        {c.id && (
                          <span className="font-mono text-gray-600 ml-1">· {c.id.slice(0, 7)}</span>
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
