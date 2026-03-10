import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Editor from './pages/Editor';
import Profile from './pages/Profile';
import GithubCallback from './pages/GithubCallback';

// Components

// Utils
import { useAuthContext } from './hooks/useAuth';

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-white text-2xl">Loading...</div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route
          path="/login"
          element={<Login />}
        />
        <Route
          path="/register"
          element={user ? <Navigate to="/dashboard" /> : <Register />}
        />
        <Route
          path="/dashboard"
          element={<ProtectedRoute element={<Dashboard />} user={user} />}
        />
        <Route
          path="/editor/:projectId"
          element={<ProtectedRoute element={<Editor />} user={user} />}
        />
        <Route path="/github/callback" element={<GithubCallback />} />
        <Route
          path="/profile"
          element={<ProtectedRoute element={<Profile />} user={user} />}
        />
        <Route path="/" element={<Navigate to="/dashboard" />} />
      </Routes>
    </Router>
  );
}

export default App;
