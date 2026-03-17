import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Folder, Trash2, Code2, Users, Info, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ShareModal from '../components/ShareModal';
import ProjectInfoModal from '../components/ProjectInfoModal';
import Navbar from '../components/Navbar';
import LogoutConfirmModal from '../components/LogoutConfirmModal';
import JoinRequestNotification from '../components/JoinRequestNotification';
import { disconnectSocket, useSocket } from '../hooks/useSocket';
import { API_URL } from '../config/runtime';
import { authStorage } from '../services/authStorage';

const LANDING_BG = 'bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_28%),radial-gradient(circle_at_80%_20%,_rgba(244,114,182,0.2),_transparent_24%),linear-gradient(135deg,_#020617_0%,_#0f172a_45%,_#111827_100%)]';

export default function Dashboard() {
  const navigate = useNavigate();
  const { socket } = useSocket();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewProject, setShowNewProject] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    language: 'javascript'
  });

  useEffect(() => {
    const user = authStorage.getUser() || {};
    setCurrentUser(user);
  }, []);

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = () => {
    // Disconnect socket before logout
    disconnectSocket();
    
    // Clear all session data
    authStorage.clearToken();
    authStorage.clearUser();
    sessionStorage.removeItem('github_token');
    setShowLogoutModal(false);
    
    // Navigate to landing page with a small delay to ensure session storage is cleared
    setTimeout(() => {
      navigate('/', { replace: true });
    }, 100);
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await axios.get(`${API_URL}/projects`, {
        headers: authStorage.getAuthHeaders()
      });
      setProjects(response.data);
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    const token = authStorage.getToken();
    
    if (!token) {
      console.error('No token found');
      return;
    }

    console.log('Creating project with data:', formData);

    try {
      const response = await axios.post(
        `${API_URL}/projects`,
        formData,
        {
          headers: authStorage.getAuthHeaders({ 'Content-Type': 'application/json' }),
          timeout: 10000
        }
      );
      
      console.log('Project created:', response.data);
      setProjects([...projects, response.data]);
      setFormData({ name: '', description: '', language: 'javascript' });
      setShowNewProject(false);
    } catch (error) {
      console.error('Error creating project:', error);
      console.error('Error response:', error.response?.data);
      alert(`Failed to create project: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleDeleteProject = async (projectId) => {
    try {
      await axios.delete(`${API_URL}/projects/${projectId}`, {
        headers: authStorage.getAuthHeaders()
      });
      setProjects(projects.filter(p => p._id !== projectId));
    } catch (error) {
      console.error('Error deleting project:', error);
    }
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/');
  };

  if (loading) {
    return (
      <div className={`min-h-screen ${LANDING_BG} flex items-center justify-center`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-300">Loading your projects...</p>
        </div>
      </div>
    );
  }

  const totalCollaborators = projects.reduce(
    (sum, p) => sum + (p.collaborators ? p.collaborators.length : 0),
    0
  );

  const getProjectOnlineUsersCount = (project) => {
    const uniqueUsers = new Set(
      (project?.activeUsers || [])
        .map((user) => String(user?.userId || user?._id || user?.userName || ''))
        .filter(Boolean)
    );

    return uniqueUsers.size;
  };

  const languageAlias = {
    javascript: 'js',
    python: 'py',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    csharp: 'c#',
    typescript: 'ts',
    html: 'html',
    css: 'css',
    json: 'json',
    markdown: 'md',
  };

  const inferLanguageFromFileName = (fileName = '') => {
    const extension = String(fileName).split('.').pop()?.toLowerCase();
    const byExt = {
      js: 'javascript',
      jsx: 'javascript',
      ts: 'typescript',
      tsx: 'typescript',
      py: 'python',
      java: 'java',
      c: 'c',
      cpp: 'cpp',
      cc: 'cpp',
      cxx: 'cpp',
      cs: 'csharp',
      html: 'html',
      css: 'css',
      json: 'json',
      md: 'markdown',
    };
    return byExt[extension] || null;
  };

  const getProjectLanguageTags = (project) => {
    const languages = new Set();

    (project?.files || []).forEach((file) => {
      const normalized = String(file?.language || '').trim().toLowerCase();
      const inferred = inferLanguageFromFileName(file?.name || '');
      const lang = normalized || inferred;
      if (lang && lang !== 'plaintext') {
        languages.add(languageAlias[lang] || lang);
      }
    });

    if (languages.size === 0) {
      const fallback = String(project?.language || '').trim().toLowerCase();
      if (fallback) {
        languages.add(languageAlias[fallback] || fallback);
      }
    }

    return Array.from(languages);
  };

  const formatRelativeTime = (timestamp) => {
    if (!timestamp) return 'Unknown';

    const diffMs = Date.now() - new Date(timestamp).getTime();
    if (Number.isNaN(diffMs) || diffMs < 0) return 'Just now';

    const minutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return new Date(timestamp).toLocaleDateString();
  };

  const getProjectRoleLabel = (project) => {
    const currentUserId = String(currentUser?.id || currentUser?._id || '');
    const ownerId = project.owner?._id || project.owner;
    if (String(ownerId || '') === currentUserId) {
      return 'Owner';
    }

    const myCollab = (project.collaborators || []).find(
      (collab) => String(collab.userId || '') === currentUserId
    );

    if (myCollab?.role === 'admin') return 'Admin';
    if (myCollab?.role === 'viewer') return 'Viewer';
    return 'Editor';
  };

  const getProjectFilesCount = (project) => (Array.isArray(project?.files) ? project.files.length : 0);

  return (
    <div className={`min-h-screen ${LANDING_BG} relative overflow-hidden`}>
      <div className="pointer-events-none absolute left-8 top-24 h-48 w-48 rounded-full bg-cyan-400/10 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute right-8 top-16 h-56 w-56 rounded-full bg-fuchsia-400/10 blur-3xl" aria-hidden="true" />

      <Navbar showLogout={true} onLogout={handleLogout} />
      {/* Invite bell + panel (appears when this user has pending invites) */}
      <JoinRequestNotification socket={socket} />
      
      <div className="relative z-10 mx-auto max-w-7xl px-6 py-8">
        
        {/* Header */}
        <div className="mb-8">
          <p className="mb-3 inline-flex items-center rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100">
            Dashboard
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-6 backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-cyan-300/35 hover:shadow-[0_16px_60px_rgba(14,165,233,0.2)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm font-medium">Total Projects</p>
                <p className="text-3xl font-bold text-white mt-2">{projects.length}</p>
              </div>
              <div className="p-3 rounded-lg border border-cyan-300/20 bg-cyan-300/10">
                <Folder className="text-cyan-300" size={24} />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-6 backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-fuchsia-300/35 hover:shadow-[0_16px_60px_rgba(217,70,239,0.2)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm font-medium">Languages</p>
                <p className="text-3xl font-bold text-white mt-2">
                  {new Set(projects.map(p => p.language)).size}
                </p>
              </div>
              <div className="p-3 rounded-lg border border-fuchsia-300/20 bg-fuchsia-300/10">
                <Code2 className="text-fuchsia-300" size={24} />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-6 backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-emerald-300/35 hover:shadow-[0_16px_60px_rgba(16,185,129,0.2)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm font-medium">Collaborations</p>
                <p className="text-3xl font-bold text-white mt-2">
                  {totalCollaborators}
                </p>
              </div>
              <div className="p-3 rounded-lg border border-emerald-300/20 bg-emerald-300/10">
                <Users className="text-emerald-300" size={24} />
              </div>
            </div>
          </div>
        </div>

        {/* New Project Button */}
        <div className="mb-6">
          <button
            onClick={() => setShowNewProject(!showNewProject)}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg font-medium transition shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            <Plus size={20} /> New Project
          </button>
        </div>

        {showNewProject && (
          <div className="mb-8 rounded-2xl border border-white/10 bg-slate-950/70 p-6 shadow-[0_16px_60px_rgba(2,6,23,0.45)] backdrop-blur">
            <h2 className="text-2xl font-bold text-white mb-6">Create New Project</h2>
            <form onSubmit={handleCreateProject} className="space-y-5">
              <div>
                <label className="block text-gray-300 text-sm font-semibold mb-2">Project Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-800 text-white rounded-lg border border-gray-700 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-900 transition"
                  placeholder="My Awesome Project"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-300 text-sm font-semibold mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-800 text-white rounded-lg border border-gray-700 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-900 transition"
                  placeholder="What's this project about?"
                  rows="3"
                />
              </div>

              <div className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-3">
                <p className="text-gray-300 text-sm font-semibold mb-2">You can code in these languages</p>
                <div className="flex flex-wrap gap-2 text-sm">
                  {['JavaScript', 'Python', 'Java', 'C++', 'C#'].map((lang) => (
                    <span
                      key={lang}
                      className="px-3 py-1 rounded-full bg-gray-800 text-gray-200 border border-gray-700"
                    >
                      {lang}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">Default project language is JavaScript; you can switch per file in the editor.</p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-lg font-medium transition shadow-lg"
                >
                  Create Project
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewProject(false)}
                  className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition border border-gray-700"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map(project => (
            <div 
              key={project._id} 
              className="group cursor-pointer rounded-2xl border border-white/10 bg-slate-950/70 p-6 shadow-[0_12px_40px_rgba(2,6,23,0.4)] backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-cyan-300/35 hover:shadow-[0_22px_80px_rgba(14,165,233,0.2)]"
              onClick={() => navigate(`/editor/${project._id}`)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-3 shadow-lg shadow-cyan-900/20">
                  <Folder className="text-cyan-300" size={28} />
                </div>
                <div className="flex gap-2">
                  {/* Info button - visible to all */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedProjectId(project._id);
                      setInfoModalOpen(true);
                    }}
                    className="p-2 text-blue-400 hover:text-blue-300 hover:bg-gray-800 rounded-lg transition"
                    title="Project information"
                  >
                    <Info size={18} />
                  </button>
                  
                  {/* Delete button - admin only */}
                  {String(project.owner?._id || project.owner || '') === String(currentUser?.id || currentUser?._id || '') && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('Delete this project?')) {
                          handleDeleteProject(project._id);
                        }
                      }}
                      className="p-2 text-red-400 hover:text-red-300 hover:bg-gray-800 rounded-lg transition"
                      title="Delete project"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </div>

              <h3 className="text-xl font-bold text-white mb-2 group-hover:text-blue-400 transition">
                {project.name}
              </h3>

              <p className="mb-4 line-clamp-2 text-sm text-slate-300">
                {project.description || 'No description provided'}
              </p>

              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500">Files</p>
                  <p className="text-sm font-semibold text-gray-200">{getProjectFilesCount(project)}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500">Updated</p>
                  <p className="text-sm font-semibold text-gray-200">{formatRelativeTime(project.updatedAt || project.createdAt)}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500">Active</p>
                  <p className="text-sm font-semibold text-gray-200">
                    {getProjectOnlineUsersCount(project)} online
                  </p>
                </div>
                <div className="rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500">Your Role</p>
                  <p className="text-sm font-semibold text-gray-200">{getProjectRoleLabel(project)}</p>
                </div>
              </div>

            </div>
            
          ))}
        </div>

        {projects.length === 0 && !showNewProject && (
          <div className="text-center py-20">
            <div className="max-w-md mx-auto">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-slate-950/70 p-4 backdrop-blur">
                <Folder className="text-gray-600" size={40} />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">No projects yet</h3>
              <p className="text-gray-400 text-lg mb-6">Create your first project to start coding!</p>
              <button
                onClick={() => setShowNewProject(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg font-medium transition shadow-lg"
              >
                <Plus size={20} /> Create Project
              </button>
            </div>
          </div>
        )}

        {/* Project Info Modal */}
        <ProjectInfoModal
          projectId={selectedProjectId}
          isOpen={infoModalOpen}
          currentUser={currentUser}
          onClose={() => {
            setInfoModalOpen(false);
            setSelectedProjectId(null);
          }}
        />

        {/* Share Modal */}
        <ShareModal
          projectId={selectedProjectId}
          isOpen={shareModalOpen}
          onProjectUpdated={fetchProjects}
          onClose={() => {
            setShareModalOpen(false);
            setSelectedProjectId(null);
            fetchProjects(); // Refresh projects
          }}
        />

        {/* Logout Confirmation Modal */}
        <LogoutConfirmModal
          isOpen={showLogoutModal}
          onConfirm={confirmLogout}
          onCancel={() => setShowLogoutModal(false)}
        />
      </div>
    </div>
  );
}
