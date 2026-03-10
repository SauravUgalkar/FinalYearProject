import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    console.log('Login attempt with:', formData);

    try {
      const response = await axios.post('http://localhost:5000/api/auth/login', formData, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });
      console.log('Login success:', response.data);
      
      // Store token and user in sessionStorage (tab-isolated)
      sessionStorage.setItem('token', response.data.token);
      sessionStorage.setItem('user', JSON.stringify(response.data.user));
      
      console.log('Navigating to dashboard...');
      // Navigate to dashboard (ProtectedRoute will check sessionStorage)
      navigate('/dashboard', { replace: true });
    } catch (err) {
      console.error('Login error:', err);
      const errorMsg = err.response?.data?.error || err.message || 'Login failed';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setResetError('');
    setResetMessage('');

    if (!resetEmail.trim()) {
      setResetError('Please enter your email');
      return;
    }

    try {
      // Simulate password reset - in real app, this would call API
      setResetMessage('Password reset instructions sent to your email!');
      setTimeout(() => {
        setShowForgotPassword(false);
        setResetEmail('');
        setResetMessage('');
      }, 3000);
    } catch (err) {
      setResetError('Failed to send reset email');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-full max-w-md">
        <h1 className="text-3xl font-bold text-white mb-6 text-center">CollabCode</h1>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="text-red-400 text-sm bg-red-900 p-3 rounded">{error}</div>}
          
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">Email</label>
            <div className="relative">
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                autoComplete="email"
                className="w-full px-4 py-2 pr-10 bg-gray-700 text-white rounded border border-gray-600 focus:outline-none focus:border-blue-500"
                required
              />
              {formData.email && (
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, email: '' }))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-white rounded-full hover:bg-gray-600 transition"
                  title="Clear email"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">Password</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              autoComplete="current-password"
              className="w-full px-4 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => setShowForgotPassword(true)}
              className="text-sm text-blue-400 hover:text-blue-300 transition"
            >
              Forgot Password?
            </button>
          </div>
        </form>

        <p className="text-gray-400 text-sm text-center mt-4">
          Don't have an account?{' '}
          <a href="/register" className="text-blue-400 hover:text-blue-300">Register</a>
        </p>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">Reset Password</h2>
              <button
                onClick={() => {
                  setShowForgotPassword(false);
                  setResetEmail('');
                  setResetError('');
                  setResetMessage('');
                }}
                className="text-gray-400 hover:text-white transition"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleForgotPassword} className="space-y-4">
              {resetMessage && (
                <div className="text-green-400 text-sm bg-green-900 p-3 rounded">
                  ✓ {resetMessage}
                </div>
              )}
              {resetError && (
                <div className="text-red-400 text-sm bg-red-900 p-3 rounded">
                  {resetError}
                </div>
              )}

              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-4 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:outline-none focus:border-blue-500"
                  required
                />
                <p className="text-xs text-gray-400 mt-2">
                  We'll send you instructions to reset your password
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition"
                >
                  Send Reset Link
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(false);
                    setResetEmail('');
                    setResetError('');
                    setResetMessage('');
                  }}
                  className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded font-medium transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
