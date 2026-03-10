import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, User } from 'lucide-react';

export default function Navbar({ showLogout = false, onLogout }) {
  const navigate = useNavigate();
  const user = JSON.parse(sessionStorage.getItem('user') || '{}');

  return (
    <nav className="bg-gray-800 border-b border-gray-700 p-4">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <div
          onClick={() => navigate('/dashboard')}
          className="cursor-pointer hover:opacity-80 transition"
        >
          <div className="text-2xl font-bold text-white">
            CollabCode
          </div>
        </div>

        <div className="flex items-center gap-6">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-gray-300 hover:text-white transition"
          >
            Dashboard
          </button>
          <button
            onClick={() => navigate('/profile')}
            className="flex items-center gap-2 text-gray-300 hover:text-white transition"
          >
            <User size={20} /> {user.name}
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
