import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Trash2, Copy, Check } from 'lucide-react';

export default function ShareModal({ projectId, isOpen, onClose }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('editor');
  const [collaborators, setCollaborators] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchCollaborators();
    }
  }, [isOpen, projectId]);

  const fetchCollaborators = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `http://localhost:5000/api/projects/${projectId}/collaborators`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setCollaborators(response.data.collaborators);
    } catch (err) {
      console.error('Error fetching collaborators:', err);
      setError('Failed to load collaborators');
    }
  };

  const handleShare = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (!email.trim()) {
      setError('Please enter an email address');
      setLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `http://localhost:5000/api/projects/${projectId}/share`,
        { email: email.toLowerCase().trim(), role },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setCollaborators(response.data.collaborators);
      setEmail('');
      setRole('editor');
      setSuccess(`Project shared with ${email}`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error sharing project:', err);
      setError(err.response?.data?.error || 'Failed to share project');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (collaboratorId) => {
    if (!window.confirm('Remove this collaborator?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await axios.delete(
        `http://localhost:5000/api/projects/${projectId}/collaborators/${collaboratorId}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setCollaborators(response.data.collaborators);
      setSuccess('Collaborator removed');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error removing collaborator:', err);
      setError(err.response?.data?.error || 'Failed to remove collaborator');
    }
  };

  const copyShareLink = () => {
    const link = `${window.location.origin}/editor/${projectId}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-700">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">Share Project</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="bg-red-900 text-red-200 p-3 rounded mb-4 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-900 text-green-200 p-3 rounded mb-4 text-sm">
            {success}
          </div>
        )}

        {/* Share Link */}
        <div className="mb-4">
          <label className="block text-gray-300 text-sm font-medium mb-2">
            Share Link
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={`${window.location.origin}/editor/${projectId}`}
              readOnly
              className="flex-1 px-3 py-2 bg-gray-700 text-gray-300 rounded text-sm"
            />
            <button
              onClick={copyShareLink}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition flex items-center gap-2"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
        </div>

        {/* Share by Email */}
        <form onSubmit={handleShare} className="mb-4">
          <label className="block text-gray-300 text-sm font-medium mb-2">
            Share by Email
          </label>
          <div className="flex gap-2 mb-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="flex-1 px-3 py-2 bg-gray-700 text-white rounded text-sm focus:outline-none focus:border-blue-500"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="px-3 py-2 bg-gray-700 text-white rounded text-sm focus:outline-none"
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition disabled:opacity-50"
          >
            {loading ? 'Sharing...' : 'Share'}
          </button>
        </form>

        {/* Collaborators List */}
        <div>
          <h3 className="text-white font-bold text-sm mb-2">Collaborators</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {collaborators.length === 0 ? (
              <p className="text-gray-400 text-sm">No collaborators yet</p>
            ) : (
              collaborators.map((collab, idx) => (
                <div
                  key={collab._id || idx}
                  className="flex items-center justify-between bg-gray-700 p-2 rounded text-sm"
                >
                  <div>
                    <p className="text-white font-medium">{collab.name}</p>
                    <p className="text-gray-400 text-xs">{collab.email}</p>
                    <p className="text-blue-400 text-xs">
                      {collab.role === 'admin' ? '👑 Admin' : collab.role === 'editor' ? '✏️ Editor' : '👁️ Viewer'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemove(collab._id)}
                    className="text-red-400 hover:text-red-300 transition"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
