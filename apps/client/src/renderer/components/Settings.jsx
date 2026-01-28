import React, { useState, useEffect } from 'react';
import { X, Shield, Trash2, Crown, User as UserIcon } from 'lucide-react';
import axios from 'axios';

export default function Settings({ projectId, onClose }) {
  const [activeTab, setActiveTab] = useState('users'); // 'users' or 'general'
  const [projectUsers, setProjectUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const user = JSON.parse(sessionStorage.getItem('user') || '{}');
    setCurrentUser(user);
    fetchProjectUsers();
  }, [projectId]);

  const fetchProjectUsers = async () => {
    try {
      const token = sessionStorage.getItem('token');
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

  const handleChangeRole = async (userId, newRole) => {
    try {
      const token = sessionStorage.getItem('token');
      const response = await axios.post(
        `http://localhost:5000/api/projects/${projectId}/share`,
        { 
          email: projectUsers.find(u => (u._id || u.id) === userId)?.email,
          role: newRole 
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      fetchProjectUsers();
      alert('User role updated successfully!');
    } catch (error) {
      console.error('Error changing role:', error);
      alert(error.response?.data?.error || 'Failed to change user role');
    }
  };

  const handleRemoveUser = async (userId) => {
    if (!confirm('Remove this user from the project?')) return;

    try {
      const token = sessionStorage.getItem('token');
      await axios.delete(
        `http://localhost:5000/api/projects/${projectId}/collaborators/${userId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      fetchProjectUsers();
      alert('User removed successfully!');
    } catch (error) {
      console.error('Error removing user:', error);
      alert(error.response?.data?.error || 'Failed to remove user');
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
      <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between bg-gray-950">
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
      <div className="flex border-b border-gray-800 bg-gray-950">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-6 py-3 font-medium transition ${
            activeTab === 'users'
              ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-900'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
        >
          Users & Permissions
        </button>
        <button
          onClick={() => setActiveTab('general')}
          className={`px-6 py-3 font-medium transition ${
            activeTab === 'general'
              ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-900'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
        >
          General
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'users' && (
          <div className="space-y-6">
            {/* Current Users */}
            <div>
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <UserIcon size={16} className="text-purple-400" />
                Project Members ({projectUsers.length})
              </h3>
              <div className="space-y-3">
                {projectUsers.map(user => (
                  <div
                    key={user._id || user.id}
                    className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex items-center justify-between hover:border-gray-600 transition"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                        {(user.name || user.email || 'U')[0].toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-white font-medium text-sm truncate">
                          {user.name || 'Unknown User'}
                          {user._id === currentUser?.id && (
                            <span className="text-xs text-blue-400 ml-2">(You)</span>
                          )}
                        </p>
                        <p className="text-gray-400 text-xs truncate">{user.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {user.isOwner ? (
                        <span className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 ${getRoleColor('owner')}`}>
                          {getRoleIcon('owner')}
                          Owner
                        </span>
                      ) : (
                        <>
                          <select
                            value={user.role}
                            onChange={(e) => handleChangeRole(user._id || user.id, e.target.value)}
                            className="px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-xs text-white focus:outline-none focus:border-blue-500 min-w-[100px]"
                            disabled={user._id === currentUser?.id}
                          >
                            <option value="viewer">Viewer</option>
                            <option value="editor">Editor</option>
                          </select>
                          <button
                            onClick={() => handleRemoveUser(user._id || user.id)}
                            className="p-2 text-red-400 hover:text-red-300 hover:bg-gray-700 rounded transition"
                            title="Remove user"
                            disabled={user._id === currentUser?.id}
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
