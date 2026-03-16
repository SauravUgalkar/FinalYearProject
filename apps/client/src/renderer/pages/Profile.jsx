import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import LogoutConfirmModal from '../components/LogoutConfirmModal';
import { disconnectSocket } from '../hooks/useSocket';
import { API_URL } from '../config/runtime';
import { authStorage } from '../services/authStorage';

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = () => {
    // Disconnect socket before logout
    disconnectSocket();
    
    // Clear all session data
    authStorage.clearToken();
    authStorage.clearUser();
    localStorage.removeItem('github_token');
    setShowLogoutModal(false);
    
    // Navigate to login page
    navigate('/login', { replace: true });
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await axios.get(`${API_URL}/auth/profile`, {
        headers: authStorage.getAuthHeaders()
      });

      setUser(response.data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-white text-center mt-10">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <Navbar showLogout={true} onLogout={handleLogout} />
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-white mb-8">Profile</h1>

          {user && (
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
              <h2 className="text-2xl font-bold text-white mb-4">Account Information</h2>
              <div className="space-y-4">
                <div>
                  <p className="text-gray-400 text-sm">User ID</p>
                  <p className="text-white text-lg font-medium">{user._id || user.id}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Name</p>
                  <p className="text-white text-lg font-medium">{user.name}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Email</p>
                  <p className="text-white text-lg font-medium">{user.email}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Skill</p>
                  <p className="text-white text-lg font-medium">
                    {Array.isArray(user.codingLanguages) && user.codingLanguages.length > 0
                      ? user.codingLanguages.join(', ')
                      : 'Not set'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      <LogoutConfirmModal
        isOpen={showLogoutModal}
        onConfirm={confirmLogout}
        onCancel={() => setShowLogoutModal(false)}
      />
    </div>
  );
}
