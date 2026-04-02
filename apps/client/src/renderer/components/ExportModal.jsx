import React, { useState } from 'react';
import { Download, X } from 'lucide-react';
import { API_URL } from '../config/runtime';
import { authStorage } from '../services/authStorage';

export default function ExportModal({ isOpen, onClose, projectId, files, projectName }) {
  const [exportFormat, setExportFormat] = useState('json');
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
          </div>
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
