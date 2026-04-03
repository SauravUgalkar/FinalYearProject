import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, User, Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function Navbar({ showLogout = false, onLogout }) {
  const navigate = useNavigate();
  const user = JSON.parse(sessionStorage.getItem('user') || '{}');
  const { theme, toggleTheme } = useTheme();

  const isLight = theme === 'light';

  return (
    <nav className={`${isLight ? 'bg-white border-slate-200' : 'bg-gray-800 border-gray-700'} border-b p-4 transition-colors duration-200`}>
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <div
          onClick={() => navigate('/dashboard')}
          className="cursor-pointer hover:opacity-80 transition"
        >
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="CollabCode" className="h-12 w-12 object-contain rounded-xl" />
            <div className={`text-2xl font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
              {user.name}'s Workspace
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <button
            onClick={() => navigate('/profile')}
            className={`flex items-center gap-2 transition ${isLight ? 'text-slate-600 hover:text-slate-900' : 'text-gray-300 hover:text-white'}`}
          >
            <User size={20} /> Profile
          </button>

          {/* Light / dark mode toggle */}
          <button
            onClick={toggleTheme}
            aria-label={`Switch to ${isLight ? 'dark' : 'light'} mode`}
            className={`flex items-center justify-center w-9 h-9 rounded-full border transition ${
              isLight
                ? 'border-slate-300 text-slate-600 hover:bg-slate-100'
                : 'border-gray-600 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {isLight ? <Moon size={16} /> : <Sun size={16} />}
          </button>

          {showLogout && onLogout && (
            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition"
            >
              <LogOut size={16} /> Logout
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}

