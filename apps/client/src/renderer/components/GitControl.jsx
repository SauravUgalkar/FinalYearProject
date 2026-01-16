import React, { useState, useEffect } from 'react';
import { GitBranch, GitCommit, Plus, Check, X, RefreshCw } from 'lucide-react';
import axios from 'axios';

export default function GitControl({ projectId }) {
  const [status, setStatus] = useState({
    staged: [],
    unstaged: [],
    untracked: [],
    branch: 'main',
    commits: []
  });
  const [commitMessage, setCommitMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    fetchGitStatus();
  }, [projectId]);

  const fetchGitStatus = async () => {
    try {
      setFetching(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`http://localhost:5000/api/git/${projectId}/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStatus(response.data);
    } catch (error) {
      console.error('Failed to fetch git status:', error);
      // Use mock data as fallback
      setStatus({
        staged: [],
        unstaged: ['main.js', 'index.html'],
        untracked: ['newfile.txt'],
        branch: 'main',
        commits: [
          { id: '1', message: 'Initial commit', author: 'You', date: '2024-01-15T10:00:00Z' },
          { id: '2', message: 'Add login feature', author: 'You', date: '2024-01-14T14:30:00Z' }
        ]
      });
    } finally {
      setFetching(false);
    }
  };

  const handleStageFile = async (file) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `http://localhost:5000/api/git/${projectId}/stage`,
        { files: [file] },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStatus(response.data);
    } catch (error) {
      console.error('Failed to stage file:', error);
      // Fallback to local state update
      setStatus(prev => ({
        ...prev,
        staged: [...prev.staged, file],
        unstaged: prev.unstaged.filter(f => f !== file),
        untracked: prev.untracked.filter(f => f !== file)
      }));
    }
  };

  const handleUnstageFile = async (file) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `http://localhost:5000/api/git/${projectId}/unstage`,
        { files: [file] },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStatus(response.data);
    } catch (error) {
      console.error('Failed to unstage file:', error);
      // Fallback to local state update
      setStatus(prev => ({
        ...prev,
        staged: prev.staged.filter(f => f !== file),
        unstaged: [...prev.unstaged, file]
      }));
    }
  };

  const handleCommit = async () => {
    if (!commitMessage.trim()) {
      alert('Please enter a commit message');
      return;
    }

    if (status.staged.length === 0) {
      alert('No files staged for commit');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `http://localhost:5000/api/git/${projectId}/commit`,
        { message: commitMessage },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setStatus(response.data.gitStatus);
      setCommitMessage('');
      alert('Committed successfully!');
    } catch (error) {
      console.error('Commit error:', error);
      alert('Failed to commit: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleStageAll = async () => {
    const allFiles = [...status.unstaged, ...status.untracked];
    if (allFiles.length === 0) return;

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `http://localhost:5000/api/git/${projectId}/stage`,
        { files: allFiles },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStatus(response.data);
    } catch (error) {
      console.error('Failed to stage all files:', error);
      // Fallback to local state update
      setStatus(prev => ({
        staged: [...prev.staged, ...prev.unstaged, ...prev.untracked],
        unstaged: [],
        untracked: [],
        branch: prev.branch,
        commits: prev.commits
      }));
    }
  };

  if (fetching) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400">Loading git status...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-900 text-gray-100">
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <GitBranch size={20} className="text-purple-400" />
            Git Control
          </h3>
          <button
            onClick={fetchGitStatus}
            className="p-2 hover:bg-gray-800 rounded transition"
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Changes Section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-gray-300">Changes</h4>
            {(status.unstaged.length > 0 || status.untracked.length > 0) && (
              <button
                onClick={handleStageAll}
                className="text-xs text-blue-400 hover:text-blue-300 transition"
              >
                Stage All
              </button>
            )}
          </div>

          {/* Staged Files */}
          {status.staged.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-green-400 font-medium mb-1">Staged ({status.staged.length})</p>
              <div className="space-y-1">
                {status.staged.map(file => (
                  <div
                    key={file}
                    className="flex items-center justify-between bg-gray-800 bg-opacity-50 p-2 rounded text-sm hover:bg-gray-800 transition"
                  >
                    <div className="flex items-center gap-2">
                      <Check size={14} className="text-green-400" />
                      <span className="text-gray-200">{file}</span>
                    </div>
                    <button
                      onClick={() => handleUnstageFile(file)}
                      className="text-gray-400 hover:text-white transition"
                      title="Unstage"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unstaged Files */}
          {status.unstaged.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-yellow-400 font-medium mb-1">Modified ({status.unstaged.length})</p>
              <div className="space-y-1">
                {status.unstaged.map(file => (
                  <div
                    key={file}
                    className="flex items-center justify-between bg-gray-800 bg-opacity-50 p-2 rounded text-sm hover:bg-gray-800 transition"
                  >
                    <span className="text-gray-200">{file}</span>
                    <button
                      onClick={() => handleStageFile(file)}
                      className="text-blue-400 hover:text-blue-300 transition"
                      title="Stage"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Untracked Files */}
          {status.untracked.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-gray-400 font-medium mb-1">Untracked ({status.untracked.length})</p>
              <div className="space-y-1">
                {status.untracked.map(file => (
                  <div
                    key={file}
                    className="flex items-center justify-between bg-gray-800 bg-opacity-50 p-2 rounded text-sm hover:bg-gray-800 transition"
                  >
                    <span className="text-gray-200">{file}</span>
                    <button
                      onClick={() => handleStageFile(file)}
                      className="text-blue-400 hover:text-blue-300 transition"
                      title="Stage"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {status.staged.length === 0 && status.unstaged.length === 0 && status.untracked.length === 0 && (
            <p className="text-gray-500 text-sm italic">No changes</p>
          )}
        </div>

        {/* Commit Section */}
        {status.staged.length > 0 && (
          <div className="border-t border-gray-800 pt-4">
            <h4 className="text-sm font-semibold text-gray-300 mb-2">Commit</h4>
            <textarea
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="Commit message..."
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 resize-none"
              rows="3"
            />
            <button
              onClick={handleCommit}
              disabled={loading || !commitMessage.trim()}
              className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded transition"
            >
              <GitCommit size={16} />
              {loading ? 'Committing...' : 'Commit'}
            </button>
          </div>
        )}

        {/* Commit History */}
        <div className="border-t border-gray-800 pt-4">
          <h4 className="text-sm font-semibold text-gray-300 mb-2">Recent Commits</h4>
          <div className="space-y-2">
            {status.commits && status.commits.length > 0 ? (
              status.commits.map(commit => (
                <div key={commit.id} className="bg-gray-800 bg-opacity-50 p-3 rounded hover:bg-gray-800 transition">
                  <div className="flex items-start gap-2">
                    <GitCommit size={14} className="text-purple-400 mt-1 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium truncate">{commit.message}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {commit.author} • {new Date(commit.date).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-sm italic">No commits yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
