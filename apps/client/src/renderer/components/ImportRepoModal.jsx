import React, { useState, useEffect } from 'react';
import { Github, X, Search, Lock, Unlock, Star, RefreshCw, Download, AlertCircle } from 'lucide-react';

const API = 'http://localhost:5000/api';
const token = () => sessionStorage.getItem('token');
const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` });

export default function ImportRepoModal({ isOpen, onClose, onImported }) {
  const [repos, setRepos] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(null); // repoFullName being imported
  const [error, setError] = useState('');
  const [needsAuth, setNeedsAuth] = useState(false);

  const fetchRepos = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/github/repos`, { headers: headers() });
      const data = await res.json();
      if (!res.ok) {
        if (data.needsAuth) { setNeedsAuth(true); return; }
        throw new Error(data.error || 'Failed to load repos');
      }
      setRepos(data.repos || []);
      setFiltered(data.repos || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setError('');
      setNeedsAuth(false);
      fetchRepos();
    }
  }, [isOpen]);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(repos.filter(r => r.fullName.toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q)));
  }, [search, repos]);

  const connectGitHub = async () => {
    try {
      const appToken = sessionStorage.getItem('token');
      if (appToken) {
        localStorage.setItem('oauth_app_token', appToken);
      }

      const res = await fetch(`${API}/github/auth-url`);
      const data = await res.json();
      if (!data.authUrl) return setError(data.error || 'GitHub OAuth not configured');
      const w = 600, h = 700;
      const popup = window.open(data.authUrl, 'GitHub', `width=${w},height=${h},left=${(screen.width - w) / 2},top=${(screen.height - h) / 2}`);
      const poll = setInterval(() => {
        if (popup.closed) {
          clearInterval(poll);
          if (localStorage.getItem('github_token')) {
            setNeedsAuth(false);
            fetchRepos();
          }
        }
      }, 500);
    } catch {
      setError('Failed to start GitHub login');
    }
  };

  const importRepo = async (repo) => {
    setImporting(repo.fullName);
    setError('');
    try {
      const res = await fetch(`${API}/github/import`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          cloneUrl: repo.cloneUrl,
          repoName: repo.name,
          language: mapLang(repo.language)
        })
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.needsAuth) { setNeedsAuth(true); return; }
        throw new Error(data.error || 'Import failed');
      }
      onImported?.({ projectId: data.projectId, projectName: data.projectName, fileCount: data.fileCount });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Github size={20} className="text-white" />
            <h2 className="text-white font-semibold text-lg">Import from GitHub</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition"><X size={20} /></button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {needsAuth ? (
            <div className="text-center py-8 space-y-4">
              <Github size={40} className="mx-auto text-gray-500" />
              <p className="text-gray-300">Connect your GitHub account to browse repositories.</p>
              <button
                onClick={connectGitHub}
                className="px-6 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white rounded-lg flex items-center gap-2 mx-auto transition"
              >
                <Github size={16} /> Connect GitHub
              </button>
            </div>
          ) : (
            <>
              {/* Search */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search repositories..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 bg-red-900 bg-opacity-40 border border-red-700 rounded px-3 py-2 text-sm text-red-300">
                  <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <RefreshCw size={20} className="text-gray-400 animate-spin" />
                </div>
              ) : (
                <div className="space-y-2">
                  {filtered.length === 0 && <p className="text-gray-500 text-sm text-center py-6">No repositories found.</p>}
                  {filtered.map(repo => (
                    <div
                      key={repo.id}
                      className="flex items-start justify-between bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 hover:border-gray-600 transition"
                    >
                      <div className="flex-1 min-w-0 mr-3">
                        <div className="flex items-center gap-2">
                          {repo.private
                            ? <Lock size={12} className="text-yellow-400 flex-shrink-0" />
                            : <Unlock size={12} className="text-green-400 flex-shrink-0" />
                          }
                          <span className="text-white font-medium truncate">{repo.fullName}</span>
                        </div>
                        {repo.description && (
                          <p className="text-gray-400 text-xs mt-1 truncate">{repo.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                          {repo.language && <span>{repo.language}</span>}
                          {repo.stars > 0 && (
                            <span className="flex items-center gap-1"><Star size={10} />{repo.stars}</span>
                          )}
                          <span>{new Date(repo.updatedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => importRepo(repo)}
                        disabled={!!importing}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg text-xs transition flex-shrink-0"
                      >
                        {importing === repo.fullName ? (
                          <><RefreshCw size={12} className="animate-spin" /> Cloning...</>
                        ) : (
                          <><Download size={12} /> Import</>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-800 text-xs text-gray-500">
          Importing creates a new project with the repository's files loaded in the editor.
        </div>
      </div>
    </div>
  );
}

function mapLang(githubLang) {
  if (!githubLang) return 'javascript';
  const map = { JavaScript: 'javascript', TypeScript: 'javascript', Python: 'python', Java: 'java', 'C++': 'cpp', 'C#': 'csharp', C: 'cpp' };
  return map[githubLang] || 'javascript';
}
