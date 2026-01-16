import React, { useState, useEffect } from 'react';
import { Download, X, Github } from 'lucide-react';

export default function ExportModal({ isOpen, onClose, projectId, files, projectName }) {
  const [exportFormat, setExportFormat] = useState('json');
  const [githubToken, setGithubToken] = useState(localStorage.getItem('github_token') || '');
  const [githubUsername, setGithubUsername] = useState('');
  const [isExporting, setIsExporting] = useState(false);

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
    if (!githubToken.trim()) {
      alert('Please enter your GitHub Personal Access Token (PAT).\n\nCreate one at: https://github.com/settings/tokens\nRequire scopes: repo');
      return;
    }

    if (!githubUsername.trim()) {
      alert('Please enter your GitHub username');
      return;
    }

    setIsExporting(true);
    try {
      const repoName = projectName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const owner = githubUsername;

      // Create repository
      console.log('[GitHub] Creating repository:', repoName);
      const createRepoRes = await fetch('https://api.github.com/user/repos', {
        method: 'POST',
        headers: {
          Authorization: `token ${githubToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: repoName,
          description: `Project: ${projectName} - Exported from CollabCode`,
          private: false,
          auto_init: true
        })
      });

      if (!createRepoRes.ok) {
        const error = await createRepoRes.json();
        throw new Error(error.message || 'Failed to create repository');
      }

      const repo = await createRepoRes.json();
      const repoUrl = repo.clone_url;
      console.log('[GitHub] Repository created:', repo.html_url);

      // Prepare files content
      const filesData = {};
      files.forEach(file => {
        filesData[file.name] = {
          content: file.content
        };
      });

      // Add README
      filesData['README.md'] = {
        content: `# ${projectName}\n\nExported from CollabCode\n\nExported at: ${new Date().toISOString()}\n\n## Files\n${files.map(f => `- ${f.name}`).join('\n')}`
      };

      // Create tree
      console.log('[GitHub] Creating file tree...');
      const treeData = Object.entries(filesData).map(([path, data]) => ({
        path,
        mode: '100644',
        type: 'blob',
        content: data.content
      }));

      const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/trees`, {
        method: 'POST',
        headers: {
          Authorization: `token ${githubToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tree: treeData
        })
      });

      if (!treeRes.ok) {
        throw new Error('Failed to create file tree');
      }

      const tree = await treeRes.json();

      // Get main branch commit
      const branchRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/ref/heads/main`, {
        headers: { Authorization: `token ${githubToken}` }
      });

      if (!branchRes.ok) {
        throw new Error('Failed to get branch reference');
      }

      const branch = await branchRes.json();
      const baseCommitSha = branch.object.sha;

      // Create commit
      console.log('[GitHub] Creating commit...');
      const commitRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/commits`, {
        method: 'POST',
        headers: {
          Authorization: `token ${githubToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: `Initial commit from CollabCode export`,
          tree: tree.sha,
          parents: [baseCommitSha]
        })
      });

      if (!commitRes.ok) {
        throw new Error('Failed to create commit');
      }

      const commit = await commitRes.json();

      // Update branch
      console.log('[GitHub] Updating branch...');
      const updateRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/refs/heads/main`, {
        method: 'PATCH',
        headers: {
          Authorization: `token ${githubToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sha: commit.sha
        })
      });

      if (!updateRes.ok) {
        throw new Error('Failed to update branch');
      }

      // Save token for future use
      localStorage.setItem('github_token', githubToken);
      localStorage.setItem('github_username', githubUsername);

      alert(`✅ Successfully exported to GitHub!\n\nRepository: ${repo.html_url}`);
      window.open(repo.html_url, '_blank');
      onClose();
    } catch (err) {
      console.error('[GitHub Export Error]:', err);
      alert(`GitHub export failed:\n\n${err.message}`);
    } finally {
      setIsExporting(false);
    }
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
              <div>
                <label className="text-white text-xs font-semibold block mb-1">GitHub Username</label>
                <input
                  type="text"
                  value={githubUsername}
                  onChange={(e) => setGithubUsername(e.target.value)}
                  placeholder="your-github-username"
                  className="w-full px-2 py-1 bg-gray-600 text-white rounded text-xs border border-gray-500 focus:outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="text-white text-xs font-semibold block mb-1">
                  GitHub Personal Access Token
                  <a
                    href="https://github.com/settings/tokens"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 ml-1 hover:underline"
                  >
                    (Create)
                  </a>
                </label>
                <input
                  type="password"
                  value={githubToken}
                  onChange={(e) => setGithubToken(e.target.value)}
                  placeholder="ghp_..."
                  className="w-full px-2 py-1 bg-gray-600 text-white rounded text-xs border border-gray-500 focus:outline-none focus:border-blue-400"
                />
                <p className="text-gray-400 text-xs mt-1">✓ Token saved locally for future exports</p>
              </div>
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
