import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import { ThemeProvider } from './context/ThemeContext';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Editor from './pages/Editor';
import Profile from './pages/Profile';
import GithubCallback from './pages/GithubCallback';
import LandingPage from './pages/LandingPage';
import FeaturesPage from './pages/FeaturesPage';
import UseCasesPage from './pages/UseCasesPage';
import DocsPage from './pages/DocsPage';
import DocsGettingStartedPage from './pages/docs/DocsGettingStartedPage';
import DocsEditorPage from './pages/docs/DocsEditorPage';
import DocsCollaborationPage from './pages/docs/DocsCollaborationPage';
import DocsProjectsPage from './pages/docs/DocsProjectsPage';
import DocsExecutionPage from './pages/docs/DocsExecutionPage';
import DocsChatPage from './pages/docs/DocsChatPage';
import DocsGitPage from './pages/docs/DocsGitPage';
import DocsRolesPage from './pages/docs/DocsRolesPage';
import DocsTroubleshootingPage from './pages/docs/DocsTroubleshootingPage';
import DocsFaqPage from './pages/docs/DocsFaqPage';

// Layout Components
import MobileBottomNav from './components/layout/MobileBottomNav';

// Utils
import { useAuthContext } from './hooks/useAuth';
import { authStorage } from './services/authStorage';
import axios from 'axios';
import { API_URL } from './config/runtime';
import { disconnectSocket } from './hooks/useSocket';

// Suppress ResizeObserver errors from Monaco Editor (non-critical)
const originalError = console.error;
console.error = function(...args) {
  if (
    args[0]?.message?.includes?.('ResizeObserver loop completed') ||
    args[0]?.includes?.('ResizeObserver loop completed') ||
    (typeof args[0] === 'string' && args[0].includes('ResizeObserver'))
  ) {
    return; // Silently ignore ResizeObserver errors
  }
  originalError.apply(console, args);
};

// Also suppress in window error handler
const originalWindowError = window.onerror;
window.onerror = function(msg, url, lineNo, columnNo, error) {
  if (msg?.includes('ResizeObserver')) {
    return true; // Suppress
  }
  if (originalWindowError) {
    return originalWindowError(msg, url, lineNo, columnNo, error);
  }
};

// Suppress unhandled promise rejections for ResizeObserver
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason?.message?.includes('ResizeObserver')) {
    event.preventDefault(); // Suppress
  }
});

function ProtectedRoute({ element, user }) {
  // Check localStorage as fallback if user state hasn't updated yet
  const storedUser = sessionStorage.getItem('user');
  const hasAuth = user || storedUser;
  
  if (!hasAuth) {
    return <Navigate to="/login" />;
  }
  return element;
}

function App() {
  const { user, loading } = useAuthContext();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = async () => {
    // Disconnect socket before logout
    disconnectSocket();

    const token = authStorage.getToken();
    if (token) {
      try {
        await axios.post(`${API_URL}/auth/logout`, {}, { 
          headers: authStorage.getAuthHeaders() 
        });
      } catch (error) {
        console.error('Logout error:', error);
      }
    }

    // Clear storage
    authStorage.removeToken();
    authStorage.removeUser();

    // Reload to clear state and redirect to home
    window.location.href = '/';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-white text-2xl">Loading...</div>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <Router>
        <div className="flex flex-col min-h-screen">
          <main className="flex-1">
            <Routes>
              <Route
                path="/"
                element={<div className="page-transition"><LandingPage /></div>}
              />
              <Route
                path="/login"
                element={<div className="page-transition"><Login /></div>}
              />
              <Route
                path="/register"
                element={user ? <Navigate to="/dashboard" /> : <div className="page-transition"><Register /></div>}
              />
              <Route
                path="/features"
                element={<div className="page-transition"><FeaturesPage /></div>}
              />
              <Route
                path="/use-cases"
                element={<div className="page-transition"><UseCasesPage /></div>}
              />
              <Route
                path="/docs"
                element={<div className="page-transition"><DocsPage /></div>}
              />
              <Route path="/docs/getting-started" element={<div className="page-transition"><DocsGettingStartedPage /></div>} />
              <Route path="/docs/editor" element={<div className="page-transition"><DocsEditorPage /></div>} />
              <Route path="/docs/collaboration" element={<div className="page-transition"><DocsCollaborationPage /></div>} />
              <Route path="/docs/projects" element={<div className="page-transition"><DocsProjectsPage /></div>} />
              <Route path="/docs/execution" element={<div className="page-transition"><DocsExecutionPage /></div>} />
              <Route path="/docs/chat" element={<div className="page-transition"><DocsChatPage /></div>} />
              <Route path="/docs/git" element={<div className="page-transition"><DocsGitPage /></div>} />
              <Route path="/docs/roles" element={<div className="page-transition"><DocsRolesPage /></div>} />
              <Route path="/docs/troubleshooting" element={<div className="page-transition"><DocsTroubleshootingPage /></div>} />
              <Route path="/docs/faq" element={<div className="page-transition"><DocsFaqPage /></div>} />
              <Route
                path="/dashboard"
                element={<ProtectedRoute element={<div className="page-transition"><Dashboard /></div>} user={user} />}
              />
              <Route
                path="/editor/:projectId"
                element={<ProtectedRoute element={<div className="page-transition"><Editor /></div>} user={user} />}
              />
              <Route path="/github/callback" element={<GithubCallback />} />
              <Route
                path="/profile"
                element={<ProtectedRoute element={<div className="page-transition"><Profile /></div>} user={user} />}
              />
            </Routes>
          </main>
          <MobileBottomNav onLogout={handleLogout} />
        </div>
      </Router>
    </ThemeProvider>
  );
}

export default App;
