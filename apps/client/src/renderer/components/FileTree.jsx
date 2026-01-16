import React, { useState } from 'react';
import { ChevronDown, ChevronRight, FileText, Folder, Plus, Trash2, Save } from 'lucide-react';

export default function FileTree({ files, currentFile, onSelectFile, onCreateFile, onDeleteFile, onSaveFile }) {
  const [expanded, setExpanded] = useState(new Set(['root']));
  const [newFileName, setNewFileName] = useState('');
  const [showNewFileInput, setShowNewFileInput] = useState(false);

  const toggleExpand = (id) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpanded(newExpanded);
  };

  const handleCreateFile = () => {
    if (newFileName.trim()) {
      if (typeof onCreateFile === 'function') {
        onCreateFile(newFileName.trim());
      } else {
        console.error('onCreateFile is not a function', { onCreateFile });
      }
      setNewFileName('');
      setShowNewFileInput(false);
    }
  };

  const handleDeleteFile = (e, file) => {
    e.stopPropagation();
    if (typeof onDeleteFile === 'function') {
      if (confirm(`Delete ${file.name}?`)) {
        onDeleteFile(file.id || file.name);
      }
    }
  };

  const handleSaveFile = (e, file) => {
    e.stopPropagation();
    if (typeof onSaveFile === 'function') {
      onSaveFile(file);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto flex flex-col">
      {/* Add File Button - At Top */}
      {!showNewFileInput && (
        <button
          onClick={() => setShowNewFileInput(true)}
          className="m-2 p-2 flex items-center justify-center gap-2 text-gray-400 hover:text-blue-400 hover:bg-gray-700 rounded transition text-sm"
        >
          <Plus size={16} /> New File
        </button>
      )}

      {/* New File Input */}
      {showNewFileInput && (
        <div className="m-2">
          <input
            type="text"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleCreateFile()}
            onBlur={() => setShowNewFileInput(false)}
            placeholder="filename.js"
            autoFocus
            className="w-full px-2 py-1 bg-gray-700 text-white text-sm rounded focus:outline-none focus:border-blue-500"
          />
        </div>
      )}

      {files.length === 0 ? (
        <div className="p-4 text-gray-400 text-sm flex-1 flex flex-col">
          <p>No files yet</p>
        </div>
      ) : (
        <div className="space-y-1 p-2 flex-1 overflow-y-auto">
          {files.map(file => (
            <div
              key={file.id || file.name}
              onClick={() => onSelectFile(file)}
              className={`flex items-center gap-2 px-3 py-2 cursor-pointer rounded transition group ${
                currentFile?.id === file.id || currentFile?.name === file.name
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-700'
              }`}
            >
              <FileText size={16} />
              <span className="flex-1 truncate text-sm">{file.name}</span>
              <button
                onClick={(e) => handleSaveFile(e, file)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-green-600 rounded transition"
                title="Save file"
              >
                <Save size={14} />
              </button>
              <button
                onClick={(e) => handleDeleteFile(e, file)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-600 rounded transition"
                title="Delete file"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
