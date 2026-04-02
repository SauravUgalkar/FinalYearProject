import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function GithubCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('Completing GitHub authorization...');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const linked = params.get('githubLinked') === '1' || params.get('linked') === '1';
    const error = params.get('githubError') || params.get('error');

    if (linked) {
      setStatus('GitHub connected successfully ✅');
      setTimeout(() => navigate('/dashboard'), 1200);
      return;
    }

    setStatus(error ? 'GitHub authentication failed ❌' : 'GitHub authentication failed ❌');
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
