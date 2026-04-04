import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  Code2,
  Edit3,
  FolderGit2,
  Mail,
  Moon,
  Plus,
  Save,
  Sun,
  Timer,
  Trash2,
  Trophy,
  Upload,
  UserCircle2,
  X,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import LogoutConfirmModal from '../components/LogoutConfirmModal';
import { disconnectSocket } from '../hooks/useSocket';
import { API_URL } from '../config/runtime';
import { authStorage } from '../services/authStorage';
import { useTheme } from '../context/ThemeContext';

const DEFAULT_PROFILE = {
  role: 'Full Stack Developer',
  bio: 'Building reliable developer tools and collaborative experiences.',
  skills: ['JavaScript', 'React', 'Node.js', 'MongoDB'],
  avatar: '',
  avgExecutionTime: '420 ms',
  projects: [
    {
      id: 'default-1',
      title: 'Collab Editor Core',
      description: 'Real-time editor with Socket + CRDT sync for collaborative coding.',
      techStack: ['React', 'Socket.IO', 'Yjs'],
    },
    {
      id: 'default-2',
      title: 'Execution Engine',
      description: 'Queue-driven multi-language execution pipeline with observability.',
      techStack: ['Node.js', 'BullMQ', 'Redis'],
    },
  ],
};

const mapProjectFromServer = (project, index) => ({
  id: `project-${index}-${Date.now()}`,
  title: String(project?.title || ''),
  description: String(project?.description || ''),
  techStack: Array.isArray(project?.techStack) ? project.techStack.map((tech) => String(tech || '')).filter(Boolean) : [],
});

export default function Profile() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const [user, setUser] = useState(null);
  const [draftProfile, setDraftProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isEmailEditable, setIsEmailEditable] = useState(false);
  const [skillInput, setSkillInput] = useState('');
  const [newProject, setNewProject] = useState({ title: '', description: '', techStack: '' });
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const isDark = theme === 'dark';

  useEffect(() => {
    void fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await axios.get(`${API_URL}/auth/profile`, {
        headers: authStorage.getAuthHeaders(),
      });
      const profile = response.data || {};

      const profileProjects = Array.isArray(profile.profileProjects) && profile.profileProjects.length > 0
        ? profile.profileProjects.map(mapProjectFromServer)
        : DEFAULT_PROFILE.projects;

      setUser({
        ...profile,
        role: profile.role || DEFAULT_PROFILE.role,
        bio: profile.bio || DEFAULT_PROFILE.bio,
        codingLanguages: Array.isArray(profile.codingLanguages) && profile.codingLanguages.length > 0
          ? profile.codingLanguages
          : DEFAULT_PROFILE.skills,
        avatar: profile.avatar || '',
        avgExecutionTime: profile.avgExecutionTime || DEFAULT_PROFILE.avgExecutionTime,
        profileProjects,
      });
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error?.response?.data?.error || 'Failed to load profile data.');
    } finally {
      setLoading(false);
    }
  };

  const totalRuns = useMemo(() => {
    if (typeof user?.analytics?.totalRuns === 'number') {
      return user.analytics.totalRuns;
    }
    return 36;
  }, [user]);

  const successRate = useMemo(() => {
    if (typeof user?.analytics?.successRate === 'number') {
      return `${user.analytics.successRate}%`;
    }
    return '75%';
  }, [user]);

  const activeProfile = isEditing && draftProfile
    ? draftProfile
    : {
        name: user?.name || '',
        role: user?.role || DEFAULT_PROFILE.role,
        bio: user?.bio || DEFAULT_PROFILE.bio,
        email: user?.email || '',
        skills: user?.codingLanguages || DEFAULT_PROFILE.skills,
        avatar: user?.avatar || '',
        avgExecutionTime: user?.avgExecutionTime || DEFAULT_PROFILE.avgExecutionTime,
        projects: user?.profileProjects || DEFAULT_PROFILE.projects,
      };

  const beginEdit = () => {
    setDraftProfile({
      name: activeProfile.name,
      role: activeProfile.role,
      bio: activeProfile.bio,
      email: activeProfile.email,
      skills: [...activeProfile.skills],
      avatar: activeProfile.avatar,
      avgExecutionTime: activeProfile.avgExecutionTime,
      projects: [...activeProfile.projects],
    });
    setIsEditing(true);
    setIsEmailEditable(false);
    setMessage('');
    setErrorMessage('');
  };

  const cancelEdit = () => {
    setDraftProfile(null);
    setIsEditing(false);
    setIsEmailEditable(false);
    setSkillInput('');
    setNewProject({ title: '', description: '', techStack: '' });
    setMessage('Changes discarded.');
  };

  const saveProfile = async () => {
    if (!draftProfile) return;

    try {
      const payload = {
        name: draftProfile.name.trim(),
        email: draftProfile.email.trim(),
        role: draftProfile.role.trim(),
        bio: draftProfile.bio.trim(),
        codingLanguages: draftProfile.skills,
        avatar: draftProfile.avatar,
        avgExecutionTime: draftProfile.avgExecutionTime.trim(),
        profileProjects: draftProfile.projects.map((project) => ({
          title: project.title,
          description: project.description,
          techStack: Array.isArray(project.techStack) ? project.techStack : [],
        })),
      };

      const response = await axios.put(`${API_URL}/auth/profile`, payload, {
        headers: authStorage.getAuthHeaders(),
      });

      const profile = response.data || {};
      setUser({
        ...profile,
        profileProjects: Array.isArray(profile.profileProjects)
          ? profile.profileProjects.map(mapProjectFromServer)
          : draftProfile.projects,
      });

      setDraftProfile(null);
      setIsEditing(false);
      setIsEmailEditable(false);
      setSkillInput('');
      setNewProject({ title: '', description: '', techStack: '' });
      setMessage('Profile saved successfully.');
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error?.response?.data?.error || 'Could not save profile.');
      setMessage('');
    }
  };

  const handleImageUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const preview = String(reader.result || '');
      if (!isEditing || !draftProfile) {
        setUser((prev) => ({ ...(prev || {}), avatar: preview }));
        return;
      }
      setDraftProfile((prev) => ({ ...prev, avatar: preview }));
    };
    reader.readAsDataURL(file);
  };

  const addSkill = () => {
    if (!isEditing || !draftProfile) return;
    const nextSkill = skillInput.trim();
    if (!nextSkill) return;

    if (draftProfile.skills.some((skill) => skill.toLowerCase() === nextSkill.toLowerCase())) {
      setSkillInput('');
      return;
    }

    setDraftProfile((prev) => ({
      ...prev,
      skills: [...prev.skills, nextSkill],
    }));
    setSkillInput('');
  };

  const removeSkill = (skillToRemove) => {
    if (!isEditing || !draftProfile) return;
    setDraftProfile((prev) => ({
      ...prev,
      skills: prev.skills.filter((skill) => skill !== skillToRemove),
    }));
  };

  const addProject = () => {
    if (!isEditing || !draftProfile) return;

    const title = newProject.title.trim();
    const description = newProject.description.trim();
    if (!title || !description) return;

    const techStack = newProject.techStack
      .split(',')
      .map((tech) => tech.trim())
      .filter(Boolean);

    setDraftProfile((prev) => ({
      ...prev,
      projects: [
        {
          id: `project-${Date.now()}`,
          title,
          description,
          techStack,
        },
        ...prev.projects,
      ],
    }));

    setNewProject({ title: '', description: '', techStack: '' });
  };

  const removeProject = (projectId) => {
    if (!isEditing || !draftProfile) return;
    setDraftProfile((prev) => ({
      ...prev,
      projects: prev.projects.filter((project) => project.id !== projectId),
    }));
  };

  const handleLogout = () => setShowLogoutModal(true);

  const confirmLogout = async () => {
    disconnectSocket();

    const token = authStorage.getToken();
    if (token) {
      try {
        await axios.post(`${API_URL}/auth/logout`, {}, { headers: authStorage.getAuthHeaders() });
      } catch (error) {
        console.warn('Server logout failed, continuing local logout:', error?.response?.data?.error || error.message);
      }
    }

    authStorage.clearToken();
    authStorage.clearUser();
    setShowLogoutModal(false);
    navigate('/login', { replace: true });
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/dashboard');
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'}`}>
        Loading profile...
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'}`}>
      <Navbar showLogout={true} onLogout={handleLogout} />

      <div className="px-4 py-6 sm:px-6 sm:py-8 pb-24 md:pb-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={handleBack}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition ${isDark ? 'border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white' : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900'}`}
            >
              <ArrowLeft size={16} />
              Back
            </button>

            <button
              onClick={toggleTheme}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${isDark ? 'bg-slate-900 text-amber-300 hover:bg-slate-800' : 'bg-white text-indigo-700 hover:bg-slate-50 border border-slate-300'}`}
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
              {isDark ? 'Light Mode' : 'Dark Mode'}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <aside className="lg:col-span-4">
              <div className={`rounded-3xl border p-6 shadow-xl transition-all duration-300 hover:-translate-y-0.5 ${isDark ? 'border-slate-800 bg-slate-900/70 shadow-slate-950/50' : 'border-slate-200 bg-white shadow-slate-300/40'}`}>
                <div className="flex flex-col items-center text-center">
                  {activeProfile.avatar ? (
                    <img
                      src={activeProfile.avatar}
                      alt="Profile"
                      className="h-28 w-28 rounded-full object-cover ring-4 ring-cyan-400/40"
                    />
                  ) : (
                    <div className={`flex h-28 w-28 items-center justify-center rounded-full ring-4 ring-cyan-400/30 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                      <UserCircle2 size={72} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
                    </div>
                  )}

                  <label className={`mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${isDark ? 'bg-slate-800 text-slate-100 hover:bg-slate-700' : 'bg-slate-100 text-slate-800 hover:bg-slate-200'}`}>
                    <Upload size={14} />
                    Change Photo
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  </label>

                  <div className="mt-5 w-full">
                    {isEditing ? (
                      <input
                        value={draftProfile?.name || ''}
                        onChange={(event) => setDraftProfile((prev) => ({ ...prev, name: event.target.value }))}
                        className={`w-full rounded-xl border px-3 py-2 text-center text-xl font-semibold outline-none transition ${isDark ? 'border-slate-700 bg-slate-950 text-white focus:border-cyan-400' : 'border-slate-300 bg-white text-slate-900 focus:border-indigo-500'}`}
                      />
                    ) : (
                      <h1 className="text-2xl font-bold">{activeProfile.name || 'Developer Name'}</h1>
                    )}

                    {isEditing ? (
                      <input
                        value={draftProfile?.role || ''}
                        onChange={(event) => setDraftProfile((prev) => ({ ...prev, role: event.target.value }))}
                        className={`mt-2 w-full rounded-xl border px-3 py-2 text-center outline-none transition ${isDark ? 'border-slate-700 bg-slate-950 text-slate-200 focus:border-cyan-400' : 'border-slate-300 bg-white text-slate-700 focus:border-indigo-500'}`}
                      />
                    ) : (
                      <p className={`mt-2 text-sm ${isDark ? 'text-cyan-300' : 'text-indigo-700'}`}>{activeProfile.role}</p>
                    )}
                  </div>

                  <div className="mt-5 w-full space-y-3 text-left">
                    <div>
                      <p className={`mb-1 text-xs uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Bio</p>
                      {isEditing ? (
                        <textarea
                          rows={4}
                          value={draftProfile?.bio || ''}
                          onChange={(event) => setDraftProfile((prev) => ({ ...prev, bio: event.target.value }))}
                          className={`w-full resize-none rounded-xl border px-3 py-2 text-sm outline-none transition ${isDark ? 'border-slate-700 bg-slate-950 text-slate-200 focus:border-cyan-400' : 'border-slate-300 bg-white text-slate-700 focus:border-indigo-500'}`}
                        />
                      ) : (
                        <p className={`text-sm leading-6 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{activeProfile.bio}</p>
                      )}
                    </div>

                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <p className={`text-xs uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Email</p>
                        {isEditing && (
                          <button
                            onClick={() => setIsEmailEditable((prev) => !prev)}
                            className={`text-xs font-medium ${isDark ? 'text-cyan-300' : 'text-indigo-600'}`}
                          >
                            {isEmailEditable ? 'Read-only' : 'Editable'}
                          </button>
                        )}
                      </div>
                      <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${isDark ? 'border-slate-700 bg-slate-950' : 'border-slate-300 bg-white'}`}>
                        <Mail size={14} className={isDark ? 'text-slate-400' : 'text-slate-500'} />
                        <input
                          value={isEditing ? (draftProfile?.email || '') : (activeProfile.email || '')}
                          onChange={(event) => setDraftProfile((prev) => ({ ...prev, email: event.target.value }))}
                          readOnly={!isEditing || !isEmailEditable}
                          className={`w-full bg-transparent text-sm outline-none ${isDark ? 'text-slate-200' : 'text-slate-700'} ${(!isEditing || !isEmailEditable) ? 'cursor-not-allowed opacity-80' : ''}`}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex w-full gap-2">
                    {!isEditing ? (
                      <button
                        onClick={beginEdit}
                        className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2 font-medium transition ${isDark ? 'bg-cyan-500 text-slate-950 hover:bg-cyan-400' : 'bg-indigo-600 text-white hover:bg-indigo-500'}`}
                      >
                        <Edit3 size={16} />
                        Edit Profile
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={saveProfile}
                          className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2 font-medium transition ${isDark ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400' : 'bg-emerald-600 text-white hover:bg-emerald-500'}`}
                        >
                          <Save size={16} />
                          Save
                        </button>
                        <button
                          onClick={cancelEdit}
                          className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2 font-medium transition ${isDark ? 'bg-slate-800 text-slate-200 hover:bg-slate-700' : 'bg-slate-200 text-slate-800 hover:bg-slate-300'}`}
                        >
                          <X size={16} />
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {(message || errorMessage) && (
                  <div className="mt-4 space-y-2">
                    {message && (
                      <p className={`rounded-lg px-3 py-2 text-sm ${isDark ? 'bg-emerald-900/40 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}`}>
                        {message}
                      </p>
                    )}
                    {errorMessage && (
                      <p className={`rounded-lg px-3 py-2 text-sm ${isDark ? 'bg-rose-900/40 text-rose-300' : 'bg-rose-100 text-rose-700'}`}>
                        {errorMessage}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </aside>

            <main className="space-y-6 lg:col-span-8">
              <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className={`rounded-2xl border p-4 transition hover:-translate-y-0.5 ${isDark ? 'border-slate-800 bg-slate-900/70' : 'border-slate-200 bg-white'}`}>
                  <div className="mb-3 flex items-center justify-between">
                    <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Total Runs</p>
                    <Code2 size={18} className={isDark ? 'text-cyan-300' : 'text-indigo-600'} />
                  </div>
                  <p className="text-2xl font-bold">{totalRuns}</p>
                </div>

                <div className={`rounded-2xl border p-4 transition hover:-translate-y-0.5 ${isDark ? 'border-slate-800 bg-slate-900/70' : 'border-slate-200 bg-white'}`}>
                  <div className="mb-3 flex items-center justify-between">
                    <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Success Rate</p>
                    <Trophy size={18} className={isDark ? 'text-emerald-300' : 'text-emerald-600'} />
                  </div>
                  <p className="text-2xl font-bold">{successRate}</p>
                </div>

                <div className={`rounded-2xl border p-4 transition hover:-translate-y-0.5 ${isDark ? 'border-slate-800 bg-slate-900/70' : 'border-slate-200 bg-white'}`}>
                  <div className="mb-3 flex items-center justify-between">
                    <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Avg Exec Time</p>
                    <Timer size={18} className={isDark ? 'text-amber-300' : 'text-amber-600'} />
                  </div>
                  <p className="text-2xl font-bold">{activeProfile.avgExecutionTime}</p>
                </div>
              </section>

              <section className={`rounded-3xl border p-5 sm:p-6 ${isDark ? 'border-slate-800 bg-slate-900/70' : 'border-slate-200 bg-white'}`}>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-xl font-bold">Skills</h2>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                    {activeProfile.skills.length} skills
                  </span>
                </div>

                <div className="mb-4 flex flex-wrap gap-2">
                  {activeProfile.skills.map((skill) => (
                    <span
                      key={skill}
                      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium transition ${isDark ? 'bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-400/30' : 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200'}`}
                    >
                      {skill}
                      {isEditing && (
                        <button
                          onClick={() => removeSkill(skill)}
                          className="rounded-full p-0.5 hover:bg-black/20"
                          aria-label={`Remove ${skill}`}
                        >
                          <X size={12} />
                        </button>
                      )}
                    </span>
                  ))}
                </div>

                {isEditing && (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      value={skillInput}
                      onChange={(event) => setSkillInput(event.target.value)}
                      placeholder="Add a skill (e.g. TypeScript)"
                      className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${isDark ? 'border-slate-700 bg-slate-950 text-slate-100 focus:border-cyan-400' : 'border-slate-300 bg-white text-slate-800 focus:border-indigo-500'}`}
                    />
                    <button
                      onClick={addSkill}
                      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${isDark ? 'bg-cyan-500 text-slate-950 hover:bg-cyan-400' : 'bg-indigo-600 text-white hover:bg-indigo-500'}`}
                    >
                      <Plus size={14} />
                      Add
                    </button>
                  </div>
                )}
              </section>

              <section className={`rounded-3xl border p-5 sm:p-6 ${isDark ? 'border-slate-800 bg-slate-900/70' : 'border-slate-200 bg-white'}`}>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <FolderGit2 size={18} className={isDark ? 'text-cyan-300' : 'text-indigo-600'} />
                    <h2 className="text-xl font-bold">Projects</h2>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                    {activeProfile.projects.length} projects
                  </span>
                </div>

                {isEditing && (
                  <div className={`mb-5 rounded-2xl border p-3 ${isDark ? 'border-slate-700 bg-slate-950' : 'border-slate-200 bg-slate-50'}`}>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                      <input
                        value={newProject.title}
                        onChange={(event) => setNewProject((prev) => ({ ...prev, title: event.target.value }))}
                        placeholder="Project title"
                        className={`rounded-lg border px-3 py-2 text-sm outline-none ${isDark ? 'border-slate-700 bg-slate-900 text-slate-100' : 'border-slate-300 bg-white text-slate-800'}`}
                      />
                      <input
                        value={newProject.description}
                        onChange={(event) => setNewProject((prev) => ({ ...prev, description: event.target.value }))}
                        placeholder="Short description"
                        className={`rounded-lg border px-3 py-2 text-sm outline-none ${isDark ? 'border-slate-700 bg-slate-900 text-slate-100' : 'border-slate-300 bg-white text-slate-800'}`}
                      />
                      <div className="flex gap-2">
                        <input
                          value={newProject.techStack}
                          onChange={(event) => setNewProject((prev) => ({ ...prev, techStack: event.target.value }))}
                          placeholder="React, Node, MongoDB"
                          className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${isDark ? 'border-slate-700 bg-slate-900 text-slate-100' : 'border-slate-300 bg-white text-slate-800'}`}
                        />
                        <button
                          onClick={addProject}
                          className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium ${isDark ? 'bg-cyan-500 text-slate-950 hover:bg-cyan-400' : 'bg-indigo-600 text-white hover:bg-indigo-500'}`}
                        >
                          <Plus size={14} />
                          Add
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {activeProfile.projects.map((project) => (
                    <article
                      key={project.id}
                      className={`rounded-2xl border p-4 transition hover:-translate-y-0.5 ${isDark ? 'border-slate-800 bg-slate-950/70' : 'border-slate-200 bg-slate-50'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold">{project.title}</h3>
                          <p className={`mt-1 text-sm leading-6 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                            {project.description}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {(project.techStack || []).map((tech) => (
                              <span
                                key={`${project.id}-${tech}`}
                                className={`rounded-full px-2.5 py-1 text-xs font-medium ${isDark ? 'bg-slate-800 text-slate-200' : 'bg-white text-slate-700 border border-slate-200'}`}
                              >
                                {tech}
                              </span>
                            ))}
                          </div>
                        </div>
                        {isEditing && (
                          <button
                            onClick={() => removeProject(project.id)}
                            className={`rounded-lg p-2 transition ${isDark ? 'text-rose-300 hover:bg-rose-900/30' : 'text-rose-600 hover:bg-rose-100'}`}
                            aria-label="Remove project"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </main>
          </div>

          <div className="mt-6 text-center">
            <p className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ${isDark ? 'bg-slate-900 text-slate-400' : 'bg-white text-slate-500 border border-slate-200'}`}>
              <Check size={12} />
              Profile updates now save to MongoDB, including image preview data.
            </p>
          </div>
        </div>
      </div>

      <LogoutConfirmModal
        isOpen={showLogoutModal}
        onConfirm={confirmLogout}
        onCancel={() => setShowLogoutModal(false)}
      />
    </div>
  );
}
