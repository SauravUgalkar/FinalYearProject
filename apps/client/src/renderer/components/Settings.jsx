import React, { useState, useEffect } from 'react';
import { X, UserPlus, Shield, Trash2, Crown, User as UserIcon, Mail } from 'lucide-react';
import axios from 'axios';

export default function Settings({ projectId, onClose }) {
  const [activeTab, setActiveTab] = useState('users'); // 'users' or 'general'
  const [projectUsers, setProjectUsers] = useState([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setCurrentUser(user);
    fetchProjectUsers();
  }, [projectId]);

  const fetchProjectUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `http://localhost:5000/api/projects/${projectId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Combine owner and collaborators
      const users = [
        { 
          ...response.data.owner, 
          role: 'owner',
          isOwner: true
        },
        ...(response.data.collaborators || []).map(collab => ({
          ...collab,
          role: collab.role || 'editor',
          isOwner: false
        }))
      ];
      
      setProjectUsers(users);
    } catch (error) {
      console.error('Error fetching project users:', error);
    }
  };

  const handleInviteUser = async () => {
    if (!inviteEmail.trim()) {
      alert('Please enter an email address');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `http://localhost:5000/api/projects/${projectId}/invite`,
        { email: inviteEmail, role: inviteRole },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setInviteEmail('');
      fetchProjectUsers();
      alert('User invited successfully!');
    } catch (error) {
      console.error('Error inviting user:', error);
      alert(error.response?.data?.error || 'Failed to invite user');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeRole = async (userId, newRole) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `http://localhost:5000/api/projects/${projectId}/users/${userId}/role`,
        { role: newRole },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      fetchProjectUsers();
    } catch (error) {
      console.error('Error changing role:', error);
      alert('Failed to change user role');
    }
  };

  const handleRemoveUser = async (userId) => {
    if (!confirm('Remove this user from the project?')) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(
        `http://localhost:5000/api/projects/${projectId}/users/${userId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      fetchProjectUsers();
    } catch (error) {
      console.error('Error removing user:', error);
      alert('Failed to remove user');
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'owner': return 'text-yellow-400 bg-yellow-900';
      case 'editor': return 'text-blue-400 bg-blue-900';
      case 'viewer': return 'text-gray-400 bg-gray-700';
      default: return 'text-gray-400 bg-gray-700';
    }
  };

  const getRoleIcon = (role) => {
    if (role === 'owner') return <Crown size={14} />;
    if (role === 'editor') return <Shield size={14} />;
    return <UserIcon size={14} />;
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 text-gray-100">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Project Settings</h2>
          <p className="text-xs text-gray-400 mt-1">Manage users and permissions</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-800 rounded-lg transition"
        >
          <X size={20} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-6 py-3 font-medium transition ${
            activeTab === 'users'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Users & Permissions
        </button>
        <button
          onClick={() => setActiveTab('general')}
          className={`px-6 py-3 font-medium transition ${
            activeTab === 'general'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          General
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'users' && (
          <div className="space-y-6">
            {/* Invite User Section */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <UserPlus size={16} className="text-blue-400" />
                Invite User
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Email Address</label>
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                      <input
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="user@example.com"
                        className="w-full pl-10 pr-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Permission Level</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="viewer">Viewer - Can view only</option>
                    <option value="editor">Editor - Can edit files</option>
                  </select>
                </div>
                <button
                  onClick={handleInviteUser}
                  disabled={loading}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded text-sm font-medium transition"
                >
                  {loading ? 'Inviting...' : 'Send Invitation'}
                </button>
              </div>
            </div>

            {/* Current Users */}
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">
                Project Members ({projectUsers.length})
              </h3>
              <div className="space-y-2">
                {projectUsers.map(user => (
                  <div
                    key={user._id || user.id}
                    className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex items-center justify-between hover:border-gray-600 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                        {(user.name || user.email || 'U')[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-white font-medium text-sm">
                          {user.name || 'Unknown User'}
                          {user._id === currentUser?.id && (
                            <span className="text-xs text-gray-500 ml-2">(You)</span>
                          )}
                        </p>
                        <p className="text-gray-400 text-xs">{user.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {user.isOwner ? (
                        <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getRoleColor('owner')}`}>
                          {getRoleIcon('owner')}
                          Owner
                        </span>
                      ) : (
                        <>
                          <select
                            value={user.role}
                            onChange={(e) => handleChangeRole(user._id || user.id, e.target.value)}
                            className="px-3 py-1 bg-gray-900 border border-gray-700 rounded text-xs text-white focus:outline-none focus:border-blue-500"
                            disabled={user._id === currentUser?.id}
                          >
                            <option value="viewer">Viewer</option>
                            <option value="editor">Editor</option>
                          </select>
                          <button
                            onClick={() => handleRemoveUser(user._id || user.id)}
                            className="p-2 text-red-400 hover:text-red-300 hover:bg-gray-700 rounded transition"
                            title="Remove user"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Permission Levels Info */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Permission Levels</h3>
              <div className="space-y-2 text-xs text-gray-400">
                <div className="flex items-start gap-2">
                  <Crown size={14} className="text-yellow-400 mt-0.5" />
                  <div>
                    <p className="text-white font-medium">Owner</p>
                    <p>Full access - can manage users, delete project</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Shield size={14} className="text-blue-400 mt-0.5" />
                  <div>
                    <p className="text-white font-medium">Editor</p>
                    <p>Can edit files, run code, and commit changes</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <UserIcon size={14} className="text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-white font-medium">Viewer</p>
                    <p>Read-only access - can view files and chat</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'general' && (
          <div className="space-y-4">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Project Information</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Project ID</label>
                  <p className="text-white font-mono text-xs bg-gray-900 px-3 py-2 rounded border border-gray-700">
                    {projectId}
                  </p>
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Created</label>
                  <p className="text-white">Recently</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
