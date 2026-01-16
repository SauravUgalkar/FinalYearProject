import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [weaknesses, setWeaknesses] = useState([]);
  const [loading, setLoading] = useState(true);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      const userJson = localStorage.getItem('user');
      const userData = JSON.parse(userJson);
      
      const response = await axios.get('http://localhost:5000/api/auth/profile', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setUser(response.data);

      // Fetch weaknesses
      const weaknessResponse = await axios.get(
        `http://localhost:5000/api/analytics/weaknesses/${userData.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setWeaknesses(weaknessResponse.data);
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
              <h2 className="text-2xl font-bold text-white mb-4">Account Information</h2>
              <div className="space-y-4">
                <div>
                  <p className="text-gray-400 text-sm">Name</p>
                  <p className="text-white text-lg font-medium">{user.name}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Email</p>
                  <p className="text-white text-lg font-medium">{user.email}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Total Projects</p>
                  <p className="text-white text-lg font-medium">{user.totalProjects}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Total Collaborations</p>
                  <p className="text-white text-lg font-medium">{user.totalCollaborations}</p>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
              <h2 className="text-2xl font-bold text-white mb-4">Coding Weaknesses</h2>
              {weaknesses.length > 0 ? (
                <div className="space-y-3">
                  {weaknesses.map((weakness, index) => (
                    <div key={index} className="bg-gray-700 p-3 rounded">
                      <p className="text-white font-medium">{weakness.category}</p>
                      <p className="text-gray-300 text-sm">Identified {weakness.frequency} times</p>
                      {weakness.description && (
                        <p className="text-gray-400 text-sm mt-1">{weakness.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400">No weaknesses identified yet. Complete more projects to get AI feedback!</p>
              )}
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
