import React, { useState, useEffect } from 'react';
import { Download, X, Github, LogIn } from 'lucide-react';

export default function ExportModal({ isOpen, onClose, projectId, files, projectName }) {
  const [exportFormat, setExportFormat] = useState('json');
  const [githubLinked, setGithubLinked] = useState(!!localStorage.getItem('github_token'));
  const [isExporting, setIsExporting] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  // Check for GitHub token on mount
  useEffect(() => {
    const token = localStorage.getItem('github_token');
    setGithubLinked(!!token);
  }, [isOpen]);

  const handleExportJSON = () => {
    const projectData = {
      name: projectName,
      projectId,
      exportedAt: new Date().toISOString(),
      files: files.map(f => ({
        id: f.id,
        name: f.name,
        language: f.language,
        content: f.content
      }))
    };

    const dataStr = JSON.stringify(projectData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${projectName || 'project'}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    onClose();
  };

  const handleExportZip = async () => {
    // Dynamic import of JSZip
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      // Add files to zip
      files.forEach((file) => {
        zip.file(`${file.name}`, file.content);
      });

      // Add metadata
      const metadata = {
        name: projectName,
        projectId,
        exportedAt: new Date().toISOString(),
        filesCount: files.length
      };
      zip.file('README.md', `# ${projectName}\n\nExported: ${metadata.exportedAt}\n\nFiles: ${metadata.filesCount}`);

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${projectName || 'project'}_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      onClose();
    } catch (err) {
      console.error('Error exporting ZIP:', err);
      alert('JSZip not available. Defaulting to JSON export.');
      handleExportJSON();
    }
  };

  const handleExportGitHub = async () => {
    setIsExporting(true);
    try {
      const repoName = projectName
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '') || 'collabcode-project';

      const authToken = sessionStorage.getItem('token');
      if (!authToken) {
        throw new Error('You must be logged in to export to GitHub');
      }

      let response = await fetch(`http://localhost:5000/api/github/export/${projectId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ repositoryName: repoName })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        // If needs GitHub auth, start OAuth flow and retry automatically
        if (error.needsAuth && error.authUrl) {
          await startGithubLoginWithAuth(error.authUrl);
          // Retry export after linking
          response = await fetch(`http://localhost:5000/api/github/export/${projectId}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${authToken}`
            },
            body: JSON.stringify({ repositoryName: repoName })
          });
          if (!response.ok) {
            const retryErr = await response.json().catch(() => ({}));
            throw new Error(retryErr.error || 'GitHub export failed after linking');
          }
        } else {
          throw new Error(error.error || 'GitHub export failed');
        }
      }

      const data = await response.json();
      // Mark as linked client-side as well
      localStorage.setItem('github_token', 'linked');
      alert(`✅ Exported to GitHub: ${data.repositoryUrl}`);
      if (data.repositoryUrl) {
        window.open(data.repositoryUrl, '_blank');
      }
      onClose();
    } catch (err) {
      console.error('[GitHub Export Error]:', err);
      alert(`GitHub export failed:\n\n${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const startGithubLogin = async () => {
    try {
      const appToken = sessionStorage.getItem('token');
      if (appToken) {
        localStorage.setItem('oauth_app_token', appToken);
      }

      setAuthLoading(true);
      const res = await fetch('http://localhost:5000/api/github/auth-url');
      const data = await res.json();
      if (data.authUrl) {
        // Open GitHub OAuth in a popup window
        const width = 600;
        const height = 700;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;
        const popup = window.open(
          data.authUrl,
          'GitHub Login',
          `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
        );

        // Poll for the popup to close and check for token
        const pollTimer = setInterval(() => {
          if (popup.closed) {
            clearInterval(pollTimer);
            setAuthLoading(false);
            // Check if token was saved
            const token = localStorage.getItem('github_token');
            if (token) {
              setGithubLinked(true);
              alert('GitHub connected successfully!');
            }
          }
        }, 500);
      } else {
        alert(data.error || 'GitHub OAuth not configured');
        setAuthLoading(false);
      }
    } catch (err) {
      console.error('GitHub auth init failed:', err);
      alert('Failed to start GitHub login');
      setAuthLoading(false);
    }
  };

  // Start GitHub OAuth with provided authUrl and attach Authorization header for token persistence
  const startGithubLoginWithAuth = async (authUrl) => {
    return new Promise((resolve) => {
      const appToken = sessionStorage.getItem('token');
      if (appToken) {
        localStorage.setItem('oauth_app_token', appToken);
      }

      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      const popup = window.open(
        authUrl,
        'GitHub Login',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
      );

      const pollTimer = setInterval(() => {
        if (popup.closed) {
          clearInterval(pollTimer);
          const token = localStorage.getItem('github_token');
          if (token) {
            setGithubLinked(true);
            resolve(true);
          } else {
            resolve(false);
          }
        }
      }, 500);
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-lg max-w-md w-full p-6 max-h-96 overflow-y-auto">
        <div className="flex justify-between items-center mb-4 sticky top-0 bg-gray-800">
          <h2 className="text-xl font-bold text-white">Export Project</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mb-6">
          <p className="text-gray-300 text-sm mb-4">
            Choose an export format for <span className="font-semibold">{projectName}</span>
          </p>

          <div className="space-y-3">
            <label className="flex items-center p-3 border border-gray-600 rounded cursor-pointer hover:bg-gray-750 transition">
              <input
                type="radio"
                name="format"
                value="json"
                checked={exportFormat === 'json'}
                onChange={(e) => setExportFormat(e.target.value)}
                className="w-4 h-4 mr-3"
              />
              <div>
                <p className="text-white font-semibold">JSON</p>
                <p className="text-gray-400 text-xs">Portable, easy to import</p>
              </div>
            </label>

            <label className="flex items-center p-3 border border-gray-600 rounded cursor-pointer hover:bg-gray-750 transition">
              <input
                type="radio"
                name="format"
                value="zip"
                checked={exportFormat === 'zip'}
                onChange={(e) => setExportFormat(e.target.value)}
                className="w-4 h-4 mr-3"
              />
              <div>
                <p className="text-white font-semibold">ZIP</p>
                <p className="text-gray-400 text-xs">All files in one archive</p>
              </div>
            </label>

            <label className="flex items-center p-3 border border-gray-600 rounded cursor-pointer hover:bg-gray-750 transition">
              <input
                type="radio"
                name="format"
                value="github"
                checked={exportFormat === 'github'}
                onChange={(e) => setExportFormat(e.target.value)}
                className="w-4 h-4 mr-3"
              />
              <div>
                <p className="text-white font-semibold flex items-center gap-1">
                  <Github size={14} /> GitHub
                </p>
                <p className="text-gray-400 text-xs">Push to GitHub repository</p>
              </div>
            </label>
          </div>

          {exportFormat === 'github' && (
            <div className="mt-4 p-3 bg-gray-700 border border-gray-600 rounded space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white text-sm font-semibold">GitHub Access</p>
                  <p className="text-gray-400 text-xs">{githubLinked ? 'Connected' : 'Sign in to push directly'}</p>
                </div>
                {!githubLinked && (
                  <button
                    type="button"
                    onClick={startGithubLogin}
                    disabled={authLoading}
                    className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center gap-1 disabled:opacity-60"
                  >
                    <LogIn size={14} /> {authLoading ? 'Opening...' : 'Sign in'}
                  </button>
                )}
              </div>

              {githubLinked && (
                <div className="text-xs text-green-400 bg-gray-800 border border-gray-700 rounded px-2 py-1">
                  ✓ GitHub connected (token stored server-side)
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isExporting}
            className="flex-1 px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition font-semibold disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (exportFormat === 'json') handleExportJSON();
              else if (exportFormat === 'zip') handleExportZip();
              else handleExportGitHub();
            }}
            disabled={isExporting}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Download size={16} />
            {isExporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </div>
    </div>
  );
}
