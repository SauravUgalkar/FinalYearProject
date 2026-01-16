import React, { useState, useCallback, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import * as Y from 'yjs';
import { useSocket } from '../hooks/useSocket';
import FileTree from '../components/FileTree';
import Chat from '../components/Chat';
import Console from '../components/Console';
import Analytics from '../components/Analytics';
import ExportModal from '../components/ExportModal';
import GitControl from '../components/GitControl';
import Settings from '../components/Settings';
import Recordings from '../components/Recordings';
import { Play, Share2, Download, FileText, MessageCircle, BarChart3, FileDown, Home, Settings as SettingsIcon, GitBranch, ArrowLeft, Circle, Square, Video } from 'lucide-react';

export default function EditorPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { socket } = useSocket();
  const [files, setFiles] = useState([]);
  const [currentFile, setCurrentFile] = useState(null);
  const [executionOutput, setExecutionOutput] = useState('');
  const [executionInput, setExecutionInput] = useState('');
  const [sidebarTab, setSidebarTab] = useState('files'); // 'files', 'chat', 'analytics', 'export', 'git', 'settings', or 'recordings'
  const [projectName, setProjectName] = useState('Untitled Project');
  const [projectOwnerId, setProjectOwnerId] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStartTime, setRecordingStartTime] = useState(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [analytics, setAnalytics] = useState({
    totalRuns: 0,
    successfulRuns: 0,
    failedRuns: 0,
    totalErrors: 0,
    executionTimes: []
  });
  const [allUsersAnalytics, setAllUsersAnalytics] = useState([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [waitingForInput, setWaitingForInput] = useState(false);
  const [editorInstance, setEditorInstance] = useState(null);
  const [monacoInstance, setMonacoInstance] = useState(null);
  const [blameData, setBlameData] = useState([]);
  const [decorations, setDecorations] = useState([]);
  const modificationTimers = useRef({});
  const [conflicts, setConflicts] = useState([]);
  const [conflictNotification, setConflictNotification] = useState(null);
  
  // Yjs state
  const yDocs = useRef(new Map()); // Map of fileName -> Yjs Doc
  const yTexts = useRef(new Map()); // Map of fileName -> Y.Text
  const isRemoteChange = useRef(false); // Flag to distinguish local vs remote changes

  // Load project files with fallback to localStorage
  useEffect(() => {
    const loadProject = async () => {
      try {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        setCurrentUserId(user.id);
        
        const response = await axios.get(
          `http://localhost:5000/api/projects/${projectId}`,
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );
        console.log('Project loaded from server:', response.data);
        setProjectName(response.data.name || 'Untitled Project');
        setProjectOwnerId(response.data.owner);
        setFiles(response.data.files || []);
        if (response.data.files && response.data.files.length > 0) {
          setCurrentFile(response.data.files[0]);
        }
        // Cache to localStorage
        localStorage.setItem(`project_${projectId}`, JSON.stringify({
          name: response.data.name || 'Untitled Project',
          files: response.data.files || [],
          lastSync: new Date().toISOString()
        }));
      } catch (err) {
        console.error('Error loading project from server:', err);
        // Try to load from localStorage
        const cached = localStorage.getItem(`project_${projectId}`);
        if (cached) {
          try {
            const cachedProject = JSON.parse(cached);
            console.log('Loaded project from cache:', cachedProject);
            setProjectName(cachedProject.name || 'Untitled Project');
            setFiles(cachedProject.files || []);
            if (cachedProject.files && cachedProject.files.length > 0) {
              setCurrentFile(cachedProject.files[0]);
            }
          } catch (parseErr) {
            console.error('Error parsing cached project:', parseErr);
          }
        }
      }
    };

    loadProject();
  }, [projectId]);

  // Sync analytics to server
  const syncAnalytics = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `http://localhost:5000/api/analytics/project/${projectId}/update`,
        analytics,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
    } catch (err) {
      console.error('Error syncing analytics:', err);
    }
  }, [projectId, analytics]);

  // Fetch all users' analytics (owner only)
  const fetchAllAnalytics = useCallback(async () => {
    if (projectOwnerId !== currentUserId) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `http://localhost:5000/api/analytics/project/${projectId}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setAllUsersAnalytics(response.data.analytics || []);
    } catch (err) {
      console.error('Error fetching analytics:', err);
    }
  }, [projectId, projectOwnerId, currentUserId]);

  // Sync analytics periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (analytics.totalRuns > 0) {
        syncAnalytics();
      }
    }, 30000); // Sync every 30 seconds

    return () => clearInterval(interval);
  }, [analytics, syncAnalytics]);

  // Fetch all analytics when viewing analytics tab
  useEffect(() => {
    if (sidebarTab === 'analytics' && projectOwnerId === currentUserId) {
      fetchAllAnalytics();
    }
  }, [sidebarTab, projectOwnerId, currentUserId, fetchAllAnalytics]);

  // Fetch blame data for current file
  const fetchBlameData = useCallback(async (fileName) => {
    if (!fileName) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `http://localhost:5000/api/git/${projectId}/blame/${encodeURIComponent(fileName)}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setBlameData(response.data || []);
    } catch (err) {
      console.error('Error fetching blame data:', err);
      setBlameData([]);
    }
  }, [projectId]);

  // Initialize Yjs for a file
  const initializeYjsFile = useCallback((fileName, initialContent) => {
    if (yDocs.current.has(fileName)) return; // Already initialized

    const ydoc = new Y.Doc();
    const ytext = ydoc.getText('shared-text');
    
    // Initialize with content
    ytext.insert(0, initialContent);
    
    yDocs.current.set(fileName, ydoc);
    yTexts.current.set(fileName, ytext);

    console.log(`[Yjs] Initialized Yjs document for ${fileName}`);
  }, []);

  // Request initial state from server for a file
  const requestYjsState = useCallback((fileName) => {
    if (!socket || !projectId) return;

    console.log(`[Yjs] Requesting state for ${fileName}`);
    socket.emit('yjs-state-request', {
      roomId: projectId,
      fileName
    });
  }, [socket, projectId]);

  // Sync local changes to Yjs and broadcast
  const syncYjsChange = useCallback((fileName, content) => {
    if (!socket || !projectId) return;

    const ytext = yTexts.current.get(fileName);
    if (!ytext) return;

    // Get current Yjs content
    const yjsContent = ytext.toString();
    
    // Only sync if content differs
    if (yjsContent !== content) {
      // Update Yjs document
      isRemoteChange.current = true;
      ytext.delete(0, ytext.length);
      ytext.insert(0, content);
      isRemoteChange.current = false;

      // Get binary update
      const update = Y.encodeStateAsUpdate(yDocs.current.get(fileName));
      
      // Broadcast update
      socket.emit('yjs-sync', {
        roomId: projectId,
        fileName,
        update: Array.from(update)
      });
    }
  }, [socket, projectId]);

  // Track line modification
  const trackLineModification = useCallback(async (fileName, lineNumber, content) => {
    try {
      const token = localStorage.getItem('token');
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      
      await axios.post(
        `http://localhost:5000/api/git/${projectId}/track-modification`,
        {
          fileName,
          lineNumber,
          content,
          userName: user.name
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
    } catch (err) {
      console.error('Error tracking modification:', err);
    }
  }, [projectId]);

  // Update blame decorations when blame data or editor changes
  useEffect(() => {
    if (!editorInstance || !monacoInstance || !blameData.length) {
      if (editorInstance && decorations.length > 0) {
        editorInstance.deltaDecorations(decorations, []);
        setDecorations([]);
      }
      return;
    }

    const newDecorations = blameData.map(blame => {
      const timeAgo = getTimeAgo(new Date(blame.timestamp));
      return {
        range: new monacoInstance.Range(blame.lineNumber, 1, blame.lineNumber, 1),
        options: {
          isWholeLine: false,
          after: {
            content: `  \u00A0\u00A0${blame.userName} • ${timeAgo}`,
            inlineClassName: 'blame-decoration',
            cursorStops: monacoInstance.editor.InjectedTextCursorStops.None
          },
          afterContentClassName: 'blame-decoration-after'
        }
      };
    });

    const newDecorationsIds = editorInstance.deltaDecorations(decorations, newDecorations);
    setDecorations(newDecorationsIds);
  }, [editorInstance, monacoInstance, blameData]);

  // Fetch blame data when file changes
  useEffect(() => {
    if (currentFile) {
      fetchBlameData(currentFile.name);
      
      // Initialize Yjs for current file
      initializeYjsFile(currentFile.name, currentFile.content);
      
      // Request server state for this file
      requestYjsState(currentFile.name);
    }
  }, [currentFile, fetchBlameData, initializeYjsFile, requestYjsState]);

  // Helper function to get time ago string
  const getTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    return `${months}mo ago`;
  };

  // Join room when component mounts or socket reconnects
  useEffect(() => {
    if (socket && projectId) {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      console.log('Joining room:', projectId, 'with socket:', socket.id);
      
      const joinRoom = () => {
        socket.emit('join-room', {
          roomId: projectId,
          userId: user.id,
          userName: user.name
        });
      };

      // Join immediately
      joinRoom();

      // Re-join on reconnect
      socket.on('connect', joinRoom);

      return () => {
        socket.off('connect', joinRoom);
      };
    }
  }, [socket, projectId]);

  const saveProject = async (updatedFiles) => {
    // Always save to localStorage first
    localStorage.setItem(`project_${projectId}`, JSON.stringify({
      files: updatedFiles,
      lastSync: new Date().toISOString()
    }));
    
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `http://localhost:5000/api/projects/${projectId}`,
        { files: updatedFiles },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      console.log('Project saved to server');
    } catch (err) {
      console.error('Error saving project to server:', err);
      console.log('File changes saved locally (will sync when server is available)');
    }
  };

  const handleCreateFile = useCallback((fileName) => {
    // Check for duplicate file names
    if (files.some(f => f.name === fileName)) {
      alert(`File "${fileName}" already exists in this project.`);
      return;
    }

    const newFile = {
      id: Date.now().toString(),
      name: fileName,
      content: getBoilerplate(fileName),
      language: getLanguageFromExt(fileName)
    };
    
    console.log('Creating file:', newFile);
    const updatedFiles = [...files, newFile];
    setFiles(updatedFiles);
    setCurrentFile(newFile);
    
    // Initialize Yjs for the new file
    initializeYjsFile(newFile.name, newFile.content);
    
    // Emit file creation event to collaborators
    if (socket && projectId) {
      socket.emit('code-change', {
        roomId: projectId,
        fileId: newFile.id,
        fileName: newFile.name,
        content: newFile.content,
        language: newFile.language,
        isNewFile: true
      });
    }
    
    // Save project with new file
    saveProject(updatedFiles);
  }, [files, projectId, socket]);

  const handleDeleteFile = useCallback((fileId) => {
    const updatedFiles = files.filter(f => (f.id || f.name) !== fileId);
    setFiles(updatedFiles);
    
    // Clear current file if it was deleted
    if (currentFile && (currentFile.id === fileId || currentFile.name === fileId)) {
      setCurrentFile(updatedFiles.length > 0 ? updatedFiles[0] : null);
    }
    
    // Emit file deletion event to collaborators
    if (socket && projectId) {
      socket.emit('file-deleted', {
        roomId: projectId,
        fileId: fileId,
        deletedBy: JSON.parse(localStorage.getItem('user') || '{}').name
      });
    }
    
    // Save project with deleted file
    saveProject(updatedFiles);
  }, [files, currentFile, projectId, socket]);

  const handleSaveFile = useCallback((file) => {
    // Save the current state of files to server and localStorage
    saveProject(files);
    
    // Show a brief success message (optional)
    console.log(`File "${file.name}" saved successfully`);
  }, [files]);

  const handleCodeChange = useCallback((value) => {
    if (!currentFile || !socket || !projectId) return;

    // Update local state
    const updatedFiles = files.map(f => 
      (f.name === currentFile.name) ? { ...f, content: value } : f
    );
    setFiles(updatedFiles);
    setCurrentFile({ ...currentFile, content: value });
    
    // Sync with Yjs
    syncYjsChange(currentFile.name, value);
  }, [currentFile, socket, projectId, files, syncYjsChange]);

  // Handle: Check if code likely requires input
  const codeRequiresInput = (code, language) => {
    if (!code) return false;
    const lower = code.toLowerCase();
    const inputPatterns = {
      python: ['input(', 'raw_input(', 'sys.stdin'],
      javascript: ['readline', 'process.stdin', 'prompt('],
      java: ['Scanner', 'readLine', 'BufferedReader'],
      cpp: ['cin', 'getline', 'scanf'],
      c: ['scanf', 'getline', 'fgets']
    };
    
    const patterns = inputPatterns[language?.toLowerCase()] || [];
    return patterns.some(pattern => lower.includes(pattern));
  };

  const handleExecuteCode = useCallback(() => {
    if (!currentFile) {
      alert('No file selected');
      return;
    }
    if (!socket) {
      alert('Not connected to server');
      return;
    }
    if (!projectId) {
      alert('No project loaded');
      return;
    }

    // Check if input is required but not provided
    const requiresInput = codeRequiresInput(currentFile.content, currentFile.language);
    
    // If input is required but not provided, wait for user input
    if (requiresInput && !executionInput.trim()) {
      setIsExecuting(false);
      setWaitingForInput(true);
      setExecutionOutput('');
      return;
    }

    // Reset states for new execution
    setIsExecuting(true);
    setWaitingForInput(false);
    setExecutionOutput('');

    console.log('Executing code:', {
      language: currentFile.language,
      codeLength: currentFile.content?.length,
      hasInput: executionInput.length > 0,
      inputRequired: requiresInput
    });

    socket.emit('execute-code', {
      roomId: projectId,
      code: currentFile.content || '',
      language: currentFile.language || 'javascript',
      input: executionInput
    });
  }, [currentFile, socket, projectId, executionInput]);

  // Listen for execution results
  React.useEffect(() => {
    if (!socket) return;
    
    const handleExecutionResult = (data) => {
      console.log('[Execution] Result received:', data);
      
      // Normal success - show output
      const output = `OUTPUT:\n${data.output || '(no output)'}\n\nExecution Time: ${data.executionTime}ms`;
      setExecutionOutput(output);
      setIsExecuting(false);
      setWaitingForInput(false);
      setExecutionInput(''); // Clear input after execution
      setAnalytics(prev => ({
        ...prev,
        totalRuns: prev.totalRuns + 1,
        successfulRuns: prev.successfulRuns + 1,
        executionTimes: [...prev.executionTimes, data.executionTime]
      }));
    };

    const handleExecutionError = (data) => {
      console.log('[Execution] Error received:', data);
      // Show both error and any output that was produced
      let errorMessage = `ERROR:\n${data.error || 'Unknown error occurred'}`;
      if (data.output) {
        errorMessage += `\n\nOutput before error:\n${data.output}`;
      }
      setExecutionOutput(errorMessage);
      setIsExecuting(false);
      setWaitingForInput(false);
      setExecutionInput(''); // Clear input after error
      
      // Track failed run
      setAnalytics(prev => ({
        ...prev,
        totalRuns: prev.totalRuns + 1,
        failedRuns: prev.failedRuns + 1,
        totalErrors: prev.totalErrors + 1
      }));
    };

    socket.on('execution-result', handleExecutionResult);
    socket.on('execution-error', handleExecutionError);

    return () => {
      socket.off('execution-result', handleExecutionResult);
      socket.off('execution-error', handleExecutionError);
    };
  }, [socket]);

  // Listen for real-time code changes from collaborators
  React.useEffect(() => {
    if (!socket || !projectId) return;

    const handleCodeChanged = (data) => {
      console.log('[Real-time] Code changed from collaborator:', {
        fileId: data.fileId,
        modifiedBy: data.modifiedBy,
        isNewFile: data.isNewFile
      });

      setFiles(prevFiles => {
        // Check if this is a new file
        if (data.isNewFile) {
          // Add new file if it doesn't exist
          const fileExists = prevFiles.some(f => f.id === data.fileId);
          if (!fileExists) {
            return [...prevFiles, {
              id: data.fileId,
              name: data.fileName || 'Untitled',
              content: data.content || '',
              language: data.language || 'javascript'
            }];
          }
          return prevFiles;
        } else {
          // Update existing file content
          return prevFiles.map(f => {
            if (f.id === data.fileId || f.name === data.fileId) {
              return {
                ...f,
                content: data.content
              };
            }
            return f;
          });
        }
      });

      // Update current file if it's the one being edited
      setCurrentFile(prev => {
        if (prev && (prev.id === data.fileId || prev.name === data.fileId)) {
          // Only update if we're not the one who made the change
          if (data.modifiedBy !== JSON.parse(localStorage.getItem('user') || '{}').name) {
            return {
              ...prev,
              content: data.content || prev.content
            };
          }
        }
        return prev;
      });
    };

    socket.on('code-changed', handleCodeChanged);

    // Handle Yjs state sync
    const handleYjsState = (data) => {
      console.log('[Yjs] Received state for file:', data.fileName);
      const { fileName, state } = data;
      
      // Initialize Yjs doc with received state
      if (!yDocs.current.has(fileName)) {
        const ydoc = new Y.Doc();
        Y.applyUpdate(ydoc, new Uint8Array(state));
        
        const ytext = ydoc.getText('shared-text');
        yDocs.current.set(fileName, ydoc);
        yTexts.current.set(fileName, ytext);
        
        // Listen for changes from other users
        ytext.observe(event => {
          if (!isRemoteChange.current) {
            // Update file content from remote changes
            const newContent = ytext.toString();
            setFiles(prevFiles =>
              prevFiles.map(f => f.name === fileName ? { ...f, content: newContent } : f)
            );
            if (currentFile?.name === fileName) {
              setCurrentFile(prev => ({ ...prev, content: newContent }));
            }
          }
        });
      }
    };

    // Handle Yjs updates from other users
    const handleYjsSync = (data) => {
      console.log('[Yjs] Received update for file:', data.fileName);
      const { fileName, update } = data;
      
      if (yDocs.current.has(fileName)) {
        isRemoteChange.current = true;
        Y.applyUpdate(yDocs.current.get(fileName), new Uint8Array(update));
        isRemoteChange.current = false;
        
        // Update editor content
        const ytext = yTexts.current.get(fileName);
        const newContent = ytext.toString();
        setFiles(prevFiles =>
          prevFiles.map(f => f.name === fileName ? { ...f, content: newContent } : f)
        );
        if (currentFile?.name === fileName) {
          setCurrentFile(prev => ({ ...prev, content: newContent }));
        }
      }
    };

    socket.on('yjs-state', handleYjsState);
    socket.on('yjs-sync', handleYjsSync);

    const handleConflict = (data) => {
      console.log('[Conflict] Edit conflict detected:', data);
      setConflicts(data.conflicts);
      
      const conflictLines = data.conflicts.map(c => c.lineNumber);
      const editors = data.conflicts.flatMap(c => c.editors.map(e => e.userName));
      const uniqueEditors = [...new Set(editors)];
      
      setConflictNotification({
        message: `Conflict on line${data.conflicts.length > 1 ? 's' : ''} ${conflictLines.join(', ')} - ${uniqueEditors.join(', ')} is editing`,
        lines: conflictLines,
        editors: uniqueEditors,
        timestamp: Date.now()
      });
      
      // Auto-dismiss notification after 5 seconds
      setTimeout(() => {
        setConflictNotification(null);
      }, 5000);
    };

    socket.on('edit-conflict', handleConflict);

    return () => {
      socket.off('code-changed', handleCodeChanged);
      socket.off('edit-conflict', handleConflict);
      socket.off('yjs-state', handleYjsState);
      socket.off('yjs-sync', handleYjsSync);
    };
  }, [socket, currentFile, syncYjsChange]);

  // File deletion handler
  useEffect(() => {
    if (!socket || !projectId) return;

    const handleFileDeleted = (data) => {
      console.log('[Real-time] File deleted from collaborator:', {
        fileId: data.fileId,
        deletedBy: data.deletedBy
      });

      setFiles(prevFiles => prevFiles.filter(f => f.id !== data.fileId));

      // Clear current file if it was deleted
      setCurrentFile(prev => {
        if (prev && prev.id === data.fileId) {
          return null;
        }
        return prev;
      });
    };

    socket.on('file-deleted-remote', handleFileDeleted);

    return () => {
      socket.off('code-changed');
      socket.off('file-deleted-remote');
    };
  }, [socket, projectId]);

  // Auto-save to localStorage every 5 seconds and to server every 30 seconds
  React.useEffect(() => {
    const autoSaveLocal = setInterval(() => {
      localStorage.setItem(`project_${projectId}`, JSON.stringify({
        name: projectName,
        files: files,
        lastSync: new Date().toISOString()
      }));
      console.log('[Auto-save] Saved to localStorage');
    }, 5000); // Every 5 seconds

    const autoSaveServer = setInterval(() => {
      if (files.length > 0) {
        const token = localStorage.getItem('token');
        axios.put(
          `http://localhost:5000/api/projects/${projectId}`,
          { files: files },
          { headers: { Authorization: `Bearer ${token}` } }
        ).then(() => {
          console.log('[Auto-save] Synced to server');
        }).catch(err => {
          console.log('[Auto-save] Server sync failed (will retry):', err.message);
        });
      }
    }, 30000); // Every 30 seconds

    return () => {
      clearInterval(autoSaveLocal);
      clearInterval(autoSaveServer);
    };
  }, [projectId, files, projectName]);

  // Recording timer
  React.useEffect(() => {
    let timer;
    if (isRecording && recordingStartTime) {
      timer = setInterval(() => {
        setRecordingDuration(Math.floor((Date.now() - recordingStartTime) / 1000));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isRecording, recordingStartTime]);

  const handleStartRecording = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `http://localhost:5000/api/recordings/${projectId}/start`,
        { title: `Session Recording - ${new Date().toLocaleString()}` },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setIsRecording(true);
      setRecordingStartTime(Date.now());
      setRecordingDuration(0);
      
      // Store recording ID for later stopping
      localStorage.setItem('currentRecordingId', response.data.id);
      
      // Notify room that recording started
      if (socket) {
        socket.emit('recording-started', { roomId: projectId });
      }
      
      console.log('Recording started:', response.data.id);
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('Failed to start recording: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleStopRecording = async () => {
    try {
      const recordingId = localStorage.getItem('currentRecordingId');
      if (!recordingId) {
        alert('Recording session not found');
        return;
      }
      
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `http://localhost:5000/api/recordings/${projectId}/stop/${recordingId}`,
        { size: recordingDuration * 1024 }, // Estimate: ~1KB per second
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setIsRecording(false);
      const duration = recordingDuration;
      setRecordingStartTime(null);
      setRecordingDuration(0);
      
      localStorage.removeItem('currentRecordingId');
      
      // Notify room that recording stopped
      if (socket) {
        socket.emit('recording-stopped', { roomId: projectId, duration });
      }
      
      console.log('Recording stopped:', response.data);
      alert(`Recording saved! Duration: ${Math.floor(duration / 60)}m ${duration % 60}s`);
    } catch (error) {
      console.error('Failed to stop recording:', error);
      alert('Failed to stop recording: ' + (error.response?.data?.error || error.message));
    }
  };

  const formatRecordingTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100">
      {/* Left Icon Sidebar */}
      <div className="w-16 bg-gray-900 border-r border-gray-800 flex flex-col items-center py-4 gap-4 shadow-lg">
        <button
          onClick={() => navigate('/dashboard')}
          className="p-3 rounded-lg bg-gray-800 hover:bg-blue-600 text-gray-400 hover:text-white transition-all"
          title="Back to Dashboard"
        >
          <ArrowLeft size={24} />
        </button>
        
        <div className="w-full px-2 space-y-2">
          <button
            onClick={() => setSidebarTab('files')}
            className={`w-full flex justify-center p-3 rounded-lg transition-all ${
              sidebarTab === 'files'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
            title="Files"
          >
            <FileText size={20} />
          </button>
          <button
            onClick={() => setSidebarTab('git')}
            className={`w-full flex justify-center p-3 rounded-lg transition-all ${
              sidebarTab === 'git'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
            title="Git Control"
          >
            <GitBranch size={20} />
          </button>
          <button
            onClick={() => setSidebarTab('chat')}
            className={`w-full flex justify-center p-3 rounded-lg transition-all ${
              sidebarTab === 'chat'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
            title="Chat"
          >
            <MessageCircle size={20} />
          </button>
          {projectOwnerId === currentUserId && (
            <button
              onClick={() => setSidebarTab('analytics')}
              className={`w-full flex justify-center p-3 rounded-lg transition-all ${
                sidebarTab === 'analytics'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
              title="Analytics"
            >
              <BarChart3 size={20} />
            </button>
          )}
          <button
            onClick={() => setSidebarTab('export')}
            className={`w-full flex justify-center p-3 rounded-lg transition-all ${
              sidebarTab === 'export'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
            title="Export"
          >
            <FileDown size={20} />
          </button>
        </div>

        <div className="flex-1"></div>
        
        <button 
          onClick={() => setSidebarTab('recordings')}
          className={`p-3 rounded-lg transition-all ${
            sidebarTab === 'recordings'
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
          title="Recordings"
        >
          <Video size={20} />
        </button>
        
        <button 
          onClick={() => setSidebarTab('settings')}
          className={`p-3 rounded-lg transition-all ${
            sidebarTab === 'settings'
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
          title="Settings"
        >
          <SettingsIcon size={20} />
        </button>
      </div>

      {/* Main Content Panel */}
      <div className="flex-1 flex">
        {/* Side Panel with Content */}
        <div className="w-80 bg-gray-900 border-r border-gray-800 flex flex-col shadow-lg">
          {/* Panel Header */}
          <div className="px-6 py-4 border-b border-gray-800">
            <h2 className="text-lg font-bold text-white">
              {sidebarTab === 'files' && 'Project Files'}
              {sidebarTab === 'git' && 'Git Control'}
              {sidebarTab === 'chat' && 'Chat'}
              {sidebarTab === 'analytics' && 'Analytics'}
              {sidebarTab === 'export' && 'Export Project'}
              {sidebarTab === 'settings' && 'Settings'}
              {sidebarTab === 'recordings' && 'Recordings'}
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              {sidebarTab === 'files' && `${files.length} file${files.length !== 1 ? 's' : ''}`}
              {sidebarTab === 'git' && 'Version control'}
              {sidebarTab === 'chat' && 'Real-time collaboration'}
              {sidebarTab === 'analytics' && 'Project insights'}
              {sidebarTab === 'export' && 'Export your work'}
              {sidebarTab === 'settings' && 'Manage users and permissions'}
              {sidebarTab === 'recordings' && 'View and manage recordings'}
            </p>
          </div>

          {/* Panel Content */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {sidebarTab === 'files' && (
              <div className="flex-1 overflow-auto">
                <FileTree
                  files={files}
                  currentFile={currentFile}
                  onSelectFile={setCurrentFile}
                  onCreateFile={handleCreateFile}
                  onDeleteFile={handleDeleteFile}
                  onSaveFile={handleSaveFile}
                />
              </div>
            )}
            {sidebarTab === 'git' && (
              <div className="flex-1 overflow-auto">
                <GitControl projectId={projectId} />
              </div>
            )}
            {sidebarTab === 'chat' && (
              <div className="flex-1 overflow-auto">
                <Chat roomId={projectId} />
              </div>
            )}
            {sidebarTab === 'analytics' && (
              <div className="flex-1 overflow-auto p-4">
                <Analytics data={analytics} allUsersData={allUsersAnalytics} />
              </div>
            )}
            {sidebarTab === 'export' && (
              <div className="flex-1 overflow-auto p-4">
                <ExportModal
                  isOpen={true}
                  onClose={() => setSidebarTab('files')}
                  projectId={projectId}
                  files={files}
                  projectName={projectName}
                />
              </div>
            )}
            {sidebarTab === 'settings' && (
              <div className="flex-1 overflow-auto">
                <Settings 
                  projectId={projectId}
                  onClose={() => setSidebarTab('files')}
                />
              </div>
            )}
            {sidebarTab === 'recordings' && (
              <div className="flex-1 overflow-auto">
                <Recordings projectId={projectId} />
              </div>
            )}
          </div>
        </div>

        {/* Editor Section */}
        <div className="flex-1 flex flex-col bg-gray-950">
          {/* Top Bar with Project Info */}
          <div className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white">{projectName}</h1>
              <p className="text-xs text-gray-400 mt-1">
                {currentFile ? `Editing: ${currentFile.name}` : 'No file selected'}
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Recording Indicator */}
              {isRecording && (
                <div className="flex items-center gap-2 px-4 py-2 bg-red-950 border border-red-800 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Circle size={12} className="text-red-500 fill-red-500 animate-pulse" />
                    <span className="text-red-400 text-sm font-medium">REC</span>
                  </div>
                  <span className="text-white text-sm font-mono">
                    {formatRecordingTime(recordingDuration)}
                  </span>
                </div>
              )}
              
              {/* Record Button */}
              <button
                onClick={isRecording ? handleStopRecording : handleStartRecording}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all shadow-lg hover:shadow-xl ${
                  isRecording
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-purple-600 hover:bg-purple-700 text-white'
                }`}
                title={isRecording ? 'Stop recording' : 'Start recording session'}
              >
                {isRecording ? (
                  <>
                    <Square size={16} /> Stop
                  </>
                ) : (
                  <>
                    <Circle size={16} /> Record
                  </>
                )}
              </button>
              
              {/* Run Button */}
              <button
                onClick={handleExecuteCode}
                className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-lg font-medium transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                <Play size={18} /> Run
              </button>
            </div>

            {/* Conflict Notification */}
            {conflictNotification && (
              <div className="conflict-notification">
                <div className="conflict-notification-title">
                  ⚠️ Edit Conflict Detected
                </div>
                <div className="conflict-notification-details">
                  {conflictNotification.message}
                </div>
              </div>
            )}
          </div>

          {/* Editor Area */}
          <div className="flex-1 p-4 overflow-hidden">
            <div className="h-full rounded-lg border border-gray-800 overflow-hidden shadow-xl">
              {currentFile ? (
                <Editor
                  height="100%"
                  language={currentFile.language}
                  value={currentFile.content}
                  onChange={handleCodeChange}
                  onMount={(editor, monaco) => {
                    setEditorInstance(editor);
                    setMonacoInstance(monaco);
                    
                    // Track changes for blame
                    editor.onDidChangeModelContent((e) => {
                      if (!currentFile) return;
                      
                      e.changes.forEach(change => {
                        const lineNumber = change.range.startLineNumber;
                        const model = editor.getModel();
                        if (model) {
                          const lineContent = model.getLineContent(lineNumber);
                          
                          // Clear existing timer for this line
                          if (modificationTimers.current[lineNumber]) {
                            clearTimeout(modificationTimers.current[lineNumber]);
                          }
                          
                          // Set new timer
                          modificationTimers.current[lineNumber] = setTimeout(() => {
                            trackLineModification(currentFile.name, lineNumber, lineContent);
                            delete modificationTimers.current[lineNumber];
                          }, 2000); // Wait 2 seconds after last change
                        }
                      });
                    });
                  }}
                  theme="vs-dark"
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    fontFamily: 'Fira Code, monospace',
                    scrollBeyondLastLine: false,
                    smoothScrolling: true,
                    glyphMargin: true,
                    lineDecorationsWidth: 10
                  }}
                />
              ) : (
                <div className="flex items-center justify-center h-full bg-gray-900">
                  <div className="text-center">
                    <FileText size={48} className="text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400 text-lg">Select a file to start editing</p>
                    <p className="text-gray-500 text-sm mt-2">Choose a file from the file list on the left</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Console Section */}
          <div className="bg-gray-900 border-t border-gray-800 flex flex-col">
            {/* Console Header */}
            <div className="px-4 py-2 border-b border-gray-800 flex items-center justify-between">
              <h3 className="text-xs font-bold text-white">Terminal</h3>
              {currentFile && codeRequiresInput(currentFile.content, currentFile.language) && !executionInput.trim() && (
                <div className="bg-amber-950 border border-amber-700 text-amber-100 px-2 py-0.5 rounded text-xs flex items-center gap-1">
                  <span>⚠️</span>
                  <span>Input required</span>
                </div>
              )}
            </div>

            {/* Unified Terminal */}
            <div className="flex flex-col h-40 p-3 gap-2">
              {/* Terminal Output */}
              <div className={waitingForInput ? "flex-1 min-h-0" : "flex-1 min-h-0"}>
                <Console output={executionOutput} input={executionInput} isExecuting={isExecuting} />
              </div>

              {/* Terminal Input - Only show when waiting for input */}
              {waitingForInput && (
                <div className="border-t border-gray-800 pt-2">
                  <label className="text-xs font-semibold text-blue-400 block mb-1">stdin (awaiting input):</label>
                  <textarea
                    autoFocus
                    value={executionInput}
                    onChange={(e) => setExecutionInput(e.target.value)}
                    onKeyDown={(e) => {
                      // Allow Ctrl+Enter or Cmd+Enter to submit input
                      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                        handleExecuteCode();
                      }
                    }}
                    placeholder="$ Enter your input here... (Ctrl+Enter to submit)"
                    className="w-full h-12 text-white border rounded px-2 py-1 text-xs font-mono bg-blue-950 border-blue-600 focus:border-blue-400 focus:ring-2 focus:ring-blue-900 focus:outline-none transition-colors resize-none"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper functions
function getLanguageFromExt(fileName) {
  const ext = fileName.split('.').pop().toLowerCase();
  const extensions = {
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'py': 'python',
    'java': 'java',
    'cpp': 'cpp',
    'c': 'c',
    'cs': 'csharp',
    'html': 'html',
    'css': 'css',
    'json': 'json',
    'md': 'markdown'
  };
  return extensions[ext] || 'plaintext';
}

function getBoilerplate(fileName) {
  const language = getLanguageFromExt(fileName);
  const boilerplates = {
    'javascript': `// ${fileName}\nconsole.log("Hello, World!");`,
    'python': `# ${fileName}\nprint("Hello, World!")`,
    'java': `public class ${fileName.split('.')[0]} {\n  public static void main(String[] args) {\n    System.out.println("Hello, World!");\n  }\n}`,
    'cpp': `#include <iostream>\nusing namespace std;\n\nint main() {\n  cout << "Hello, World!" << endl;\n  return 0;\n}`,
    'csharp': `using System;\n\nclass Program {\n  static void Main() {\n    Console.WriteLine("Hello, World!");\n  }\n}`,
    'html': `<!DOCTYPE html>\n<html>\n<head>\n  <title>${fileName}</title>\n</head>\n<body>\n  <h1>Hello, World!</h1>\n</body>\n</html>`,
    'css': `/* ${fileName} */\nbody {\n  font-family: Arial, sans-serif;\n}`,
    'json': `{\n  "name": "example",\n  "version": "1.0.0"\n}`,
  };
  return boilerplates[language] || `// ${fileName}\n`;
}
