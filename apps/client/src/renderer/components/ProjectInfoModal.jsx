import React, { useState, useEffect } from 'react';
import { X, Users, Crown, Shield, User as UserIcon, Mail, Calendar, Code2, Info } from 'lucide-react';
import axios from 'axios';

/**
 * ProjectInfoModal Component
 * 
 * Displays detailed information about a project including:
 * - Project name and description
 * - Owner information
 * - All members with their roles and emails
 * - Project creation date and language
 */
export default function ProjectInfoModal({ projectId, isOpen, onClose, currentUser }) {
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);

  const currentUserRole = React.useMemo(() => {
    if (!project || !currentUser) return null;
    const ownerId = project.owner?._id || project.owner;
    if (ownerId && ownerId.toString() === currentUser.id) return 'admin';
    const collab = (project.collaborators || []).find(c => {
      return (c.userId && c.userId.toString() === currentUser.id) || c.userId === currentUser.id;
    });
    return collab?.role || 'viewer';
  }, [project, currentUser]);

  useEffect(() => {
    if (isOpen && projectId) {
      fetchProjectDetails();
    }
  }, [isOpen, projectId]);

  const fetchProjectDetails = async () => {
    try {
      setLoading(true);
      const token = sessionStorage.getItem('token');
      const response = await axios.get(
        `http://localhost:5000/api/projects/${projectId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setProject(response.data);
    } catch (error) {
      console.error('Error fetching project details:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'owner': return 'bg-yellow-900 text-yellow-400 border-yellow-700';
      case 'editor': return 'bg-blue-900 text-blue-400 border-blue-700';
      case 'viewer': return 'bg-gray-700 text-gray-400 border-gray-600';
      default: return 'bg-gray-700 text-gray-400 border-gray-600';
    }
  };

  const getRoleIcon = (role) => {
    if (role === 'owner') return <Crown size={14} />;
    if (role === 'editor') return <Shield size={14} />;
    return <UserIcon size={14} />;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between bg-gray-950">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 bg-opacity-20 rounded-lg">
              <Info className="text-blue-400" size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Project Information</h2>
              <p className="text-xs text-gray-400">Detailed view of project members and settings</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition text-gray-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
            </div>
          ) : project ? (
            <div className="p-6 space-y-6">
              {/* Project Details */}
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Code2 size={18} className="text-purple-400" />
                  Project Details
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Project Name</label>
                    <p className="text-white font-semibold text-base">{project.name}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Description</label>
                    <p className="text-gray-300 text-sm">
                      {project.description || 'No description provided'}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Language</label>
                      <span className="inline-block text-xs bg-gradient-to-r from-blue-600 to-purple-600 text-white px-3 py-1.5 rounded-lg font-medium">
                        {project.language}
                      </span>
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Created</label>
                      <div className="flex items-center gap-1 text-sm text-gray-300">
                        <Calendar size={14} />
                        <span>{new Date(project.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  {currentUserRole && (
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Your Role</label>
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border ${getRoleColor(currentUserRole)}`}>
                        {getRoleIcon(currentUserRole)}
                        {(currentUserRole.charAt(0).toUpperCase() + currentUserRole.slice(1))}
                      </span>
                    </div>
                  )}
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Project ID</label>
                    <p className="text-white font-mono text-xs bg-gray-900 px-3 py-2 rounded border border-gray-700 break-all">
                      {project._id}
                    </p>
                  </div>
                </div>
              </div>

              {/* Owner Section */}
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Crown size={18} className="text-yellow-400" />
                  Project Owner
                </h3>
                <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                      {(project.owner?.name || project.owner?.email || 'O')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-white font-semibold">{project.owner?.name || 'Unknown'}</p>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 border ${getRoleColor('owner')}`}>
                          {getRoleIcon('owner')}
                          Owner
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-400 text-sm">
                        <Mail size={14} />
                        <span className="truncate">{project.owner?.email || 'No email'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Collaborators Section */}
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Users size={18} className="text-green-400" />
                  Team Members ({project.collaborators?.length || 0})
                </h3>
                {project.collaborators && project.collaborators.length > 0 ? (
                  <div className="space-y-3">
                    {project.collaborators.map((collab, idx) => (
                      <div
                        key={idx}
                        className="bg-gray-900 border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                            {(collab.name || collab.email || 'U')[0].toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <p className="text-white font-medium">{collab.name || 'Unknown'}</p>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 border ${getRoleColor(collab.role || 'editor')}`}>
                                {getRoleIcon(collab.role || 'editor')}
                                {(collab.role || 'editor').charAt(0).toUpperCase() + (collab.role || 'editor').slice(1)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-gray-400 text-sm">
                              <Mail size={13} />
                              <span className="truncate">{collab.email || 'No email'}</span>
                            </div>
                            {collab.joinedAt && (
                              <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                                <Calendar size={12} />
                                <span>Joined {new Date(collab.joinedAt).toLocaleDateString()}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Users className="text-gray-600 mx-auto mb-3" size={32} />
                    <p className="text-gray-500 text-sm">No collaborators yet</p>
                    <p className="text-gray-600 text-xs mt-1">Invite team members to start collaborating</p>
                  </div>
                )}
              </div>

              {/* Role Permissions Info */}
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
                <h3 className="text-sm font-semibold text-white mb-3">Permission Levels</h3>
                <div className="space-y-2 text-xs text-gray-400">
                  <div className="flex items-start gap-2">
                    <Crown size={14} className="text-yellow-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-white font-medium">Owner</p>
                      <p>Full control - manage users, delete project, and all editor permissions</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Shield size={14} className="text-blue-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-white font-medium">Editor</p>
                      <p>Can edit files, run code, commit changes, and participate in chat</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <UserIcon size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-white font-medium">Viewer</p>
                      <p>Read-only access - view files and chat only</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-400">Failed to load project information</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
