import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function GithubCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('Completing GitHub sign-in...');

  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      if (!code) {
        setStatus('Missing authorization code from GitHub.');
        return;
      }

      try {
        // Include Authorization when available so server can persist token to user
        const authToken = sessionStorage.getItem('token');
        const res = await fetch('http://localhost:5000/api/github/callback', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
          },
          body: JSON.stringify({ code })
        });

        const data = await res.json();
        if (!res.ok || !data.access_token) {
          setStatus(data.error || 'Failed to exchange code for token');
          return;
        }

        // Save token for export flows
        // Mark as linked
        localStorage.setItem('github_token', 'linked');
        setStatus('GitHub connected! You can close this window.');
        
        // If this is a popup, close it after 2 seconds
        if (window.opener) {
          setTimeout(() => {
            window.opener.postMessage({ type: 'GITHUB_TOKEN_SAVED', token: data.access_token }, '*');
            window.close();
          }, 2000);
        } else {
          // If not a popup, redirect to dashboard
          setTimeout(() => navigate('/dashboard'), 1500);
        }
      } catch (err) {
        console.error('GitHub callback error:', err);
        setStatus('GitHub sign-in failed');
      }
    };

    run();
  }, [navigate]);

  return (
    <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
      <div className="bg-gray-800 border border-gray-700 rounded p-6 shadow">
        <p className="text-lg font-semibold">{status}</p>
        <p className="text-sm text-gray-400 mt-2">You can close this window once complete.</p>
      </div>
    </div>
  );
}
