import React, { useState, useRef, useEffect } from 'react';
import { 
  ChevronDown, 
  ChevronRight, 
  FileText, 
  Folder, 
  FolderOpen,
  Trash2, 
  Pencil,
  FilePlus,
  FolderPlus
} from 'lucide-react';

// Build tree structure from flat file list
function buildFileTree(files) {
  const root = { name: 'root', type: 'folder', children: {}, path: '' };
  
  files.forEach(file => {
    // A trailing slash means this entry is a folder marker (not a real file)
    const isFolderMarker = file.name.endsWith('/');
    const parts = file.name.split('/').filter(p => p !== '');
    if (parts.length === 0) return; // skip degenerate entries
    
    let current = root;
    
    parts.forEach((part, index) => {
      const isLast = index === parts.length - 1;
      // A part is a file only if it's the last segment AND the entry is not a folder marker
      const isFile = isLast && !isFolderMarker;
      
      // Skip .gitkeep files — they are internal folder-existence markers, not real files
      if (isFile && part === '.gitkeep') return;
      
      if (!current.children[part]) {
        current.children[part] = {
          name: part,
          type: isFile ? 'file' : 'folder',
          children: isFile ? null : {},
          path: parts.slice(0, index + 1).join('/'),
          fileData: isFile ? file : null
        };
      }
      
      if (!isFile) {
        current = current.children[part];
      }
    });
  });
  
  return root;
}

// Tree Node Component
function TreeNode({ 
  node, 
  level = 0, 
  currentFile, 
  onSelectFile, 
  onDeleteFile, 
  onRenameFile,
  expanded,
  toggleExpand,
  onNewFileInFolder,
  onNewFolderInFolder
}) {
  if (node.type === 'file') {
    const isSelected = currentFile?.id === node.fileData?.id || currentFile?.name === node.fileData?.name;
    
    return (
      <div
        onClick={() => onSelectFile(node.fileData)}
        className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer rounded transition group ${
          isSelected ? 'file-tree-row-selected text-white' : 'file-tree-row text-gray-300'
        }`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
      >
        <FileText size={16} className="flex-shrink-0 text-current" />
        <span className="flex-1 truncate text-sm">{node.name}</span>
        
        <div className="flex items-center gap-1 opacity-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              const currentName = node.name;
              const newName = prompt('Rename file:', currentName);
              if (!newName || newName.trim() === '' || newName.trim() === currentName) return;

              const parts = node.path.split('/');
              parts[parts.length - 1] = newName.trim();
              const newPath = parts.join('/');
              onRenameFile(node.path, newPath);
            }}
            className="p-1 hover:bg-blue-500 rounded transition"
            title="Rename file"
          >
            <Pencil size={12} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Delete ${node.name}?`)) {
                onDeleteFile(node.path);
              }
            }}
            className="p-1 hover:bg-red-600 rounded transition"
            title="Delete file"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    );
  }

  // Folder node
  const isExpanded = expanded.has(node.path);
  const childrenArray = Object.values(node.children).sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === 'folder' ? -1 : 1;
  });

  return (
    <div>
      <div
        className="file-tree-row flex items-center gap-2 px-2 py-1.5 cursor-pointer rounded transition text-gray-300 group"
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => toggleExpand(node.path)}
      >
        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        {isExpanded ? <FolderOpen size={16} className="text-blue-400" /> : <Folder size={16} className="text-blue-400" />}
        <span className="flex-1 truncate text-sm font-medium">{node.name}</span>
        
        <div className="flex items-center gap-1 opacity-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              const currentName = node.name;
              const newName = prompt('Rename folder:', currentName);
              if (!newName || newName.trim() === '' || newName.trim() === currentName) return;

              const parts = node.path.split('/');
              parts[parts.length - 1] = newName.trim();
              const newPath = parts.join('/');
              onRenameFile(node.path, newPath);
            }}
            className="p-1 hover:bg-blue-500 rounded transition"
            title="Rename folder"
          >
            <Pencil size={12} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNewFileInFolder(node.path);
            }}
            className="p-1 hover:bg-blue-500 rounded transition"
            title="New File in folder"
          >
            <FilePlus size={12} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNewFolderInFolder(node.path);
            }}
            className="p-1 hover:bg-blue-500 rounded transition"
            title="New Folder in folder"
          >
            <FolderPlus size={12} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Delete folder ${node.name} and all contents?`)) {
                onDeleteFile(node.path);
              }
            }}
            className="p-1 hover:bg-red-600 rounded transition"
            title="Delete folder"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
      
      {isExpanded && childrenArray.map(child => (
        <TreeNode
          key={child.path}
          node={child}
          level={level + 1}
          currentFile={currentFile}
          onSelectFile={onSelectFile}
          onDeleteFile={onDeleteFile}
          onRenameFile={onRenameFile}
          expanded={expanded}
          toggleExpand={toggleExpand}
          onNewFileInFolder={onNewFileInFolder}
          onNewFolderInFolder={onNewFolderInFolder}
        />
      ))}
    </div>
  );
}

// Main FileTree Component
export default function FileTree({ files, currentFile, onSelectFile, onCreateFile, onCreateFolder, onDeleteFile, onRenameFile }) {
  const [expanded, setExpanded] = useState(new Set(['root', '']));
  const [showInput, setShowInput] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [inputType, setInputType] = useState('file'); // 'file' or 'folder'
  const [creatingInFolder, setCreatingInFolder] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (showInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showInput]);

  const toggleExpand = (path) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpanded(newExpanded);
  };

  const handleNewFileInFolder = (folderPath) => {
    setCreatingInFolder(folderPath);
    setInputType('file');
    setShowInput(true);
    // Expand folder
    const newExpanded = new Set(expanded);
    newExpanded.add(folderPath);
    setExpanded(newExpanded);
  };

  const handleNewFolderInFolder = (folderPath) => {
    setCreatingInFolder(folderPath);
    setInputType('folder');
    setShowInput(true);
    // Expand folder
    const newExpanded = new Set(expanded);
    newExpanded.add(folderPath);
    setExpanded(newExpanded);
  };

  const handleCreate = () => {
    if (inputValue.trim()) {
      if (inputType === 'file') {
        const fullPath = creatingInFolder 
          ? `${creatingInFolder}/${inputValue.trim()}` 
          : inputValue.trim();
        if (typeof onCreateFile === 'function') {
          onCreateFile(fullPath);
        }
      } else {
        // For folders, use the dedicated onCreateFolder handler
        const folderName = inputValue.trim();
        const fullPath = creatingInFolder 
          ? `${creatingInFolder}/${folderName}` 
          : folderName;
        if (typeof onCreateFolder === 'function') {
          onCreateFolder(fullPath);
        } else if (typeof onCreateFile === 'function') {
          // Fallback for hosts that don't provide onCreateFolder
          onCreateFile(`${fullPath}/.gitkeep`);
        }
      }
      setInputValue('');
      setShowInput(false);
      setCreatingInFolder('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleCreate();
    } else if (e.key === 'Escape') {
      setShowInput(false);
      setInputValue('');
      setCreatingInFolder('');
    }
  };

  const fileTree = buildFileTree(files);
  const rootChildren = Object.values(fileTree.children).sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === 'folder' ? -1 : 1;
  });

  return (
    <div className="flex-1 overflow-y-auto flex flex-col bg-gray-900">
      {/* Header - Only title */}
      <div className="px-3 py-2 border-b border-gray-800">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide">Explorer</h3>
      </div>

      {/* Project Files Header with Root Creation Buttons */}
      <div className="px-3 py-2 bg-gray-900 flex items-center justify-between group">
        <div className="flex items-center gap-2 text-gray-300">
          <ChevronDown size={14} />
          <span className="text-xs font-semibold uppercase tracking-wide">Project Files</span>
          <span className="text-xs text-gray-500">({files.length})</span>
        </div>
        
        {/* Root level creation buttons */}
        <div className="flex items-center gap-1 opacity-100">
          <button
            onClick={() => {
              setCreatingInFolder('');
              setInputType('file');
              setShowInput(true);
            }}
            className="p-1 hover:bg-blue-500 rounded transition"
            title="New File in root"
          >
            <FilePlus size={12} />
          </button>
          <button
            onClick={() => {
              setCreatingInFolder('');
              setInputType('folder');
              setShowInput(true);
            }}
            className="p-1 hover:bg-blue-500 rounded transition"
            title="New Folder in root"
          >
            <FolderPlus size={12} />
          </button>
        </div>
      </div>

      {/* Creation Input */}
      {showInput && (
        <div className="mx-2 mb-2 mt-1">
          <div className="flex items-center gap-2 bg-gray-800 px-2 py-1.5 rounded">
            {inputType === 'file' ? <FileText size={14} className="text-blue-400" /> : <Folder size={14} className="text-blue-400" />}
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => {
                if (!inputValue.trim()) {
                  setShowInput(false);
                  setCreatingInFolder('');
                }
              }}
              placeholder={inputType === 'file' ? "filename.ext" : "foldername"}
              className="flex-1 bg-transparent text-white text-sm focus:outline-none"
            />
          </div>
          {creatingInFolder && (
            <p className="text-xs text-blue-400 mt-1 px-2">Creating in: {creatingInFolder}</p>
          )}
          {!creatingInFolder && (
            <p className="text-xs text-blue-400 mt-1 px-2">Creating in: Root</p>
          )}
        </div>
      )}

      {/* File Tree */}
      {files.length === 0 ? (
        <div className="p-4 text-center text-gray-500">
          <Folder size={48} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">No files yet</p>
          <p className="text-xs mt-1">Hover over folders to create files</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto py-1">
          {rootChildren.map(node => (
            <TreeNode
              key={node.path}
              node={node}
              level={0}
              currentFile={currentFile}
              onSelectFile={onSelectFile}
              onDeleteFile={onDeleteFile}
              onRenameFile={onRenameFile}
              expanded={expanded}
              toggleExpand={toggleExpand}
              onNewFileInFolder={handleNewFileInFolder}
              onNewFolderInFolder={handleNewFolderInFolder}
            />
          ))}
        </div>
      )}
    </div>
  );
}
