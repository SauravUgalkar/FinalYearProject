import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Folder, Trash2, Share2, Clock, Code2, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ShareModal from '../components/ShareModal';
import Navbar from '../components/Navbar';
import LogoutConfirmModal from '../components/LogoutConfirmModal';
import { disconnectSocket } from '../hooks/useSocket';

export default function Dashboard() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewProject, setShowNewProject] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    language: 'javascript'
  });

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = () => {
    // Disconnect socket before logout
    disconnectSocket();
    
    // Clear all session data
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('github_token');
    setShowLogoutModal(false);
    
    // Navigate to login page with a small delay to ensure localStorage is cleared
    setTimeout(() => {
      navigate('/login', { replace: true });
    }, 100);
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/api/projects', {
        headers: { Authorization: `Bearer ${token}` }
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
    const token = localStorage.getItem('token');
    
    if (!token) {
      console.error('No token found');
      return;
    }

    console.log('Creating project with data:', formData);

    try {
      const response = await axios.post(
        'http://localhost:5000/api/projects',
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
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
      const token = localStorage.getItem('token');
      await axios.delete(`http://localhost:5000/api/projects/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProjects(projects.filter(p => p._id !== projectId));
    } catch (error) {
      console.error('Error deleting project:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading your projects...</p>
        </div>
      </div>
    );
  }

  const totalCollaborators = projects.reduce(
    (sum, p) => sum + (p.collaborators ? p.collaborators.length : 0),
    0
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      <Navbar showLogout={true} onLogout={handleLogout} />
      
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-5xl font-bold text-white mb-2">
            Your Workspace
          </h1>
          <p className="text-gray-400 text-lg">Create, collaborate, and ship code faster</p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-blue-600 transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm font-medium">Total Projects</p>
                <p className="text-3xl font-bold text-white mt-2">{projects.length}</p>
              </div>
              <div className="p-3 bg-blue-600 bg-opacity-20 rounded-lg">
                <Folder className="text-blue-400" size={24} />
              </div>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-purple-600 transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm font-medium">Languages</p>
                <p className="text-3xl font-bold text-white mt-2">
                  {new Set(projects.map(p => p.language)).size}
                </p>
              </div>
              <div className="p-3 bg-purple-600 bg-opacity-20 rounded-lg">
                <Code2 className="text-purple-400" size={24} />
              </div>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-green-600 transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm font-medium">Collaborations</p>
                <p className="text-3xl font-bold text-white mt-2">
                  {totalCollaborators}
                </p>
              </div>
              <div className="p-3 bg-green-600 bg-opacity-20 rounded-lg">
                <Users className="text-green-400" size={24} />
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
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl mb-8 shadow-xl">
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

              <div>
                <label className="block text-gray-300 text-sm font-semibold mb-2">Programming Language</label>
                <select
                  value={formData.language}
                  onChange={(e) => setFormData({...formData, language: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-800 text-white rounded-lg border border-gray-700 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-900 transition"
                >
                  <option value="javascript">JavaScript</option>
                  <option value="python">Python</option>
                  <option value="java">Java</option>
                  <option value="cpp">C++</option>
                  <option value="csharp">C#</option>
                </select>
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
              className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-blue-500 hover:shadow-2xl transition-all duration-300 group cursor-pointer transform hover:-translate-y-1"
              onClick={() => navigate(`/editor/${project._id}`)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-blue-600 bg-opacity-20 rounded-lg">
                  <Folder className="text-blue-400" size={28} />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedProjectId(project._id);
                      setShareModalOpen(true);
                    }}
                    className="p-2 text-green-400 hover:text-green-300 hover:bg-gray-800 rounded-lg transition"
                    title="Share project"
                  >
                    <Share2 size={18} />
                  </button>
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
                </div>
              </div>

              <h3 className="text-xl font-bold text-white mb-2 group-hover:text-blue-400 transition">
                {project.name}
              </h3>

              <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                {project.description || 'No description provided'}
              </p>

              <div className="pt-4 border-t border-gray-800 space-y-2">
                {project.collaborators && project.collaborators.length > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {project.collaborators.slice(0, 3).map((collab, idx) => (
                        <div
                          key={idx}
                          className="w-7 h-7 rounded-full bg-gradient-to-r from-green-600 to-blue-600 border-2 border-gray-900 flex items-center justify-center text-white text-xs font-bold"
                          title={collab.email || 'Collaborator'}
                        >
                          {collab.email?.[0]?.toUpperCase() || '?'}
                        </div>
                      ))}
                      {project.collaborators.length > 3 && (
                        <div className="w-7 h-7 rounded-full bg-gray-700 border-2 border-gray-900 flex items-center justify-center text-gray-300 text-xs font-bold">
                          +{project.collaborators.length - 3}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">{project.collaborators.length} collaborator{project.collaborators.length !== 1 ? 's' : ''}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs bg-gradient-to-r from-blue-600 to-purple-600 text-white px-3 py-1.5 rounded-lg font-medium">
                    {project.language}
                  </span>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Clock size={14} />
                    <span>Recent</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {projects.length === 0 && !showNewProject && (
          <div className="text-center py-20">
            <div className="max-w-md mx-auto">
              <div className="p-4 bg-gray-900 border border-gray-800 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
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

        {/* Share Modal */}
        <ShareModal
          projectId={selectedProjectId}
          isOpen={shareModalOpen}
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
