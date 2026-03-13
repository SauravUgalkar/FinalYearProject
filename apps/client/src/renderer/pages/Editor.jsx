import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
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
import UserBadge from '../components/UserBadge';
import InviteUserModal from '../components/InviteUserModal';
import ImportRepoModal from '../components/ImportRepoModal';
import { Play, Share2, Download, FileText, MessageCircle, BarChart3, FileDown, Home, Settings as SettingsIcon, GitBranch, ArrowLeft } from 'lucide-react';

export default function EditorPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { socket } = useSocket();
  const [files, setFiles] = useState([]);
  const [currentFile, setCurrentFile] = useState(null);
  const [executionOutput, setExecutionOutput] = useState('');
  const [compileError, setCompileError] = useState('');
  const [runtimeError, setRuntimeError] = useState('');
  const [executionInput, setExecutionInput] = useState('');
  const [sidebarTab, setSidebarTab] = useState('files'); // 'files', 'chat', 'analytics', 'export', 'git', or 'settings'
  const [projectName, setProjectName] = useState('Untitled Project');
  const [projectOwnerId, setProjectOwnerId] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState('viewer');
  const [analytics, setAnalytics] = useState({
    totalRuns: 0,
    successfulRuns: 0,
    failedRuns: 0,
    totalErrors: 0,
    executionTimes: []
  });
  const [allUsersAnalytics, setAllUsersAnalytics] = useState([]);
  const [activityFeed, setActivityFeed] = useState([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [waitingForInput, setWaitingForInput] = useState(false);
  const [editorInstance, setEditorInstance] = useState(null);
  const [monacoInstance, setMonacoInstance] = useState(null);
  const [blameData, setBlameData] = useState([]);
  const [decorations, setDecorations] = useState([]);
  const modificationTimers = useRef({});
  const [conflicts, setConflicts] = useState([]);
  const [conflictNotification, setConflictNotification] = useState(null);
  const [yjsSyncActive, setYjsSyncActive] = useState(false);
  const [yjsSyncMessage, setYjsSyncMessage] = useState('Syncing...');
  const yjsSyncTimer = useRef(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [collaborators, setCollaborators] = useState([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editorTheme, setEditorTheme] = useState('vs-dark'); // 'vs-dark' or 'light'
  
  // Yjs state
  const yDocs = useRef(new Map()); // Map of fileName -> Yjs Doc
  const yTexts = useRef(new Map()); // Map of fileName -> Y.Text
  const isRemoteChange = useRef(false); // Flag to distinguish local vs remote changes
  const yjsSyncTimeout = useRef(null); // Debounce timer for Yjs sync
  const editorValueRef = useRef(''); // Track editor value to prevent unnecessary updates
  const isTyping = useRef(false); // Track if user is actively typing
  const typingTimeout = useRef(null); // Timer to detect when typing stops
  const pendingRemoteUpdate = useRef(null); // Queue remote updates during typing
  const monacoEditorRef = useRef(null); // Store Monaco editor instance
  const isApplyingRemoteChange = useRef(false); // Prevent onChange during remote updates
  const isInitialLoad = useRef(true); // Prevent emitting/applying duplicate content during first hydration
  const filesRef = useRef([]); // Always-current files for timers/closures that cannot use stale state
  const saveDebounceRef = useRef(null); // Timer for 2-second debounced HTTP save on keystroke
  const remoteCursorsRef = useRef(new Map()); // Map of socketId -> cursor payload
  const remoteCursorDecorationIdsRef = useRef([]);
  const remoteCursorStyleKeysRef = useRef(new Set());
  const cursorBroadcastRef = useRef({ lastSentAt: 0, timeoutId: null, pendingPayload: null });
  const fallbackSyncRef = useRef({ timeoutId: null, pendingPayload: null });
  const roomStateHydratedRef = useRef(false); // Avoid first stale room-state wiping API-loaded files
  const apiFilesHydratedRef = useRef(false);

  const sanitizeName = useCallback((rawPath) => String(rawPath || '').trim(), []);
  const normalizePath = useCallback((rawPath) => String(rawPath || '').trim().replace(/\/+$/, ''), []);

  // Keep filesRef in sync with files state so timers/closures never hold stale data
  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  // File content map: file path -> file content.
  // This keeps each file's code isolated and lets the editor load only the active file content.
  const fileContentMap = useMemo(() => {
    return files.reduce((acc, file) => {
      if (!String(file?.name || '').endsWith('/')) {
        acc[file.name] = typeof file.content === 'string' ? file.content : '';
      }
      return acc;
    }, {});
  }, [files]);

  const sanitizeProjectFiles = useCallback((projectFiles = []) => {
    return (projectFiles || [])
      .map((f) => {
        const rawName = sanitizeName(f?.name);
        if (!rawName) return null;
        // Strip .gitkeep files (they are internal folder-marker placeholders)
        if (rawName === '.gitkeep' || rawName.endsWith('/.gitkeep')) return null;
        const inferredLanguage = getLanguageFromExt(rawName);
        return {
          ...f,
          id: f?.id || f?._id || rawName,
          name: rawName,
          content: typeof f?.content === 'string' ? f.content : '',
          language: inferredLanguage !== 'plaintext' ? inferredLanguage : (f?.language || 'plaintext'),
        };
      })
      .filter(Boolean);
  }, [sanitizeName]);

  const mergeFilesPreservingSavedContent = useCallback((incomingFiles = [], existingFiles = []) => {
    const existingByPath = new Map(
      (existingFiles || []).map((file) => [normalizePath(file.name), file])
    );

    return (incomingFiles || []).map((file) => {
      const existing = existingByPath.get(normalizePath(file.name));
      if (!existing) return file;

      const incomingContent = typeof file.content === 'string' ? file.content : '';
      const existingContent = typeof existing.content === 'string' ? existing.content : '';

      if (existingContent && !incomingContent) {
        return { ...file, content: existingContent };
      }

      return file;
    });
  }, [normalizePath]);

  useEffect(() => {
    isInitialLoad.current = true;
  }, [currentFile?.name]);

  useEffect(() => {
    roomStateHydratedRef.current = false;
    apiFilesHydratedRef.current = false;
  }, [projectId]);

  // Load project files from server only; server is the source of truth.
  useEffect(() => {
    const loadProject = async () => {
      try {
        const token = sessionStorage.getItem('token');
        const user = JSON.parse(sessionStorage.getItem('user') || '{}');
        setCurrentUserId(user.id);
        setCurrentUser(user);
        
        const response = await axios.get(
          `http://localhost:5000/api/projects/${projectId}`,
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );
        console.log('Project loaded from server:', response.data);
        const normalizedFiles = sanitizeProjectFiles(response.data.files || []);
        setProjectName(response.data.name || 'Untitled Project');
        setProjectOwnerId(response.data.owner?._id || response.data.owner);
        setCollaborators(response.data.collaborators || []);
        
        // Determine current user's role (admin if owner)
        // Handle both populated owner object and owner ID string
        let role = 'viewer';
        const ownerId = response.data.owner?._id || response.data.owner;
        if (ownerId && ownerId.toString() === user.id) {
          role = 'admin';
        } else {
          const collab = (response.data.collaborators || []).find(c => {
            return (c.userId && c.userId.toString() === user.id) || c.userId === user.id;
          });
          role = collab?.role || 'viewer';
        }
        console.log(`[Editor] User ${user.name} role: ${role} (owner: ${ownerId})`);
        setUserRole(role);
        setFiles(normalizedFiles);
        setCurrentFile(normalizedFiles.find((f) => !f.name.endsWith('/')) || null);
        apiFilesHydratedRef.current = true;
        isInitialLoad.current = true;
      } catch (err) {
        console.error('Error loading project from server:', err);
        setFiles([]);
        setCurrentFile(null);
      }
    };

    loadProject();
  }, [projectId, sanitizeProjectFiles]);

  // Sync pulled files back into the editor (called by GitControl after a git pull)
  const handleFilesFromPull = useCallback((pulledFiles) => {
    const normalized = sanitizeProjectFiles(pulledFiles || []);
    setFiles(normalized);
    setCurrentFile(prev => {
      const match = normalized.find(f => prev && f.name === prev.name);
      return match || normalized.find(f => !f.name.endsWith('/')) || null;
    });
  }, [sanitizeProjectFiles]);

  // Sync analytics to server
  const syncAnalytics = useCallback(async () => {
    try {
      const token = sessionStorage.getItem('token');
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
      const token = sessionStorage.getItem('token');
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

  // Fetch all analytics when viewing analytics tab and set up polling
  useEffect(() => {
    if (sidebarTab === 'analytics' && projectOwnerId === currentUserId) {
      // Fetch immediately when tab is opened
      fetchAllAnalytics();
      
      // Set up polling every 5 seconds while on analytics tab
      const interval = setInterval(() => {
        fetchAllAnalytics();
      }, 5000);
      
      return () => clearInterval(interval);
    }
  }, [sidebarTab, projectOwnerId, currentUserId, fetchAllAnalytics]);

  // Fetch blame data for current file
  const fetchBlameData = useCallback(async (fileName) => {
    if (!fileName) return;
    
    try {
      const token = sessionStorage.getItem('token');
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
    let ydoc = yDocs.current.get(fileName);
    let ytext = yTexts.current.get(fileName);

    if (!ydoc || !ytext) {
      ydoc = new Y.Doc();
      ytext = ydoc.getText('shared-text');
      yDocs.current.set(fileName, ydoc);
      yTexts.current.set(fileName, ytext);
    }

    const startingContent = typeof initialContent === 'string' ? initialContent : '';
    if (!ytext.toString() && startingContent) {
      ytext.insert(0, startingContent);
    }

    console.log(`[Yjs] Initialized Yjs document for ${fileName}`);
  }, []);

  const persistProjectFiles = useCallback(async (updatedFiles, options = {}) => {
    const token = sessionStorage.getItem('token');
    if (!token) return;

    if (options.keepalive) {
      await fetch(`http://localhost:5000/api/projects/${projectId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ files: updatedFiles }),
        keepalive: true,
      });
      return;
    }

    await axios.put(
      `http://localhost:5000/api/projects/${projectId}`,
      { files: updatedFiles },
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
  }, [projectId]);

  // Show Yjs sync notification
  const showYjsSyncNotification = useCallback((message = 'Syncing...') => {
    setYjsSyncMessage(message);
    setYjsSyncActive(true);
    
    // Clear existing timer
    if (yjsSyncTimer.current) clearTimeout(yjsSyncTimer.current);
    
    // Auto-hide after 2 seconds
    yjsSyncTimer.current = setTimeout(() => {
      setYjsSyncActive(false);
    }, 2000);
  }, []);

  // Request initial state from server for a file
  const requestYjsState = useCallback((fileName) => {
    if (!socket || !projectId) return;

    console.log(`[Yjs] Requesting state for ${fileName}`);
    socket.emit('yjs-state-request', {
      roomId: projectId,
      fileName
    });
  }, [socket, projectId, normalizePath]);

  // Sync local changes to Yjs and broadcast (debounced)
  const syncYjsChange = useCallback((fileName, content) => {
    if (!socket || !projectId) return;

    // Clear existing timeout
    if (yjsSyncTimeout.current) {
      clearTimeout(yjsSyncTimeout.current);
    }

    // Debounce: sync after 300ms of no typing
    yjsSyncTimeout.current = setTimeout(() => {
      const ytext = yTexts.current.get(fileName);
      const ydoc = yDocs.current.get(fileName);
      if (!ytext || !ydoc) return;

      // Get current Yjs content
      const yjsContent = ytext.toString();
      
      // Only sync if content differs
      if (yjsContent !== content) {
        console.log(`[Client] Content differs - Yjs: ${yjsContent.length} chars, Local: ${content.length} chars`);
        
        // Calculate diff and apply only the differences (not replace all)
        let deleteLength = 0;
        let insertStart = 0;
        let insertText = '';
        
        // Find first difference
        let i = 0;
        while (i < yjsContent.length && i < content.length && yjsContent[i] === content[i]) {
          i++;
        }
        insertStart = i;
        deleteLength = yjsContent.length - i;
        insertText = content.substring(i);
        
        console.log(`[Client] Diff: delete ${deleteLength} chars at ${insertStart}, insert "${insertText}"`);
        
        // Mark as local change so remote update handling knows not to re-sync
        isRemoteChange.current = true;
        
        // Apply only the delta
        ytext.delete(insertStart, deleteLength);
        ytext.insert(insertStart, insertText);
        
        isRemoteChange.current = false;

        // Get binary update from the delta only
        const update = Y.encodeStateAsUpdate(ydoc);
        
        console.log(`[Client] Encoded update size: ${update.length} bytes`);
        
        // Show sync notification
        showYjsSyncNotification('📤 Syncing edits...');
        
        // Broadcast update
        socket.emit('yjs-sync', {
          roomId: projectId,
          fileName,
          update: Array.from(update)
        });
      }
    }, 300);
  }, [socket, projectId, showYjsSyncNotification]);

  // Track line modification
  const trackLineModification = useCallback(async (fileName, lineNumber, content) => {
    try {
      const token = sessionStorage.getItem('token');
      const user = JSON.parse(sessionStorage.getItem('user') || '{}');
      
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

  // Fetch blame/Yjs state only when switching files (name changes),
  // not on every keystroke/content update.
  useEffect(() => {
    const fileName = currentFile?.name;
    if (!fileName) return;

    fetchBlameData(fileName);

    // Initialize Yjs for the active file once per file switch.
    initializeYjsFile(fileName, currentFile?.content || '');

    // Request authoritative server state for this file once per switch.
    requestYjsState(fileName);
  }, [currentFile?.name, fetchBlameData, initializeYjsFile, requestYjsState]);

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

  const getStableCursorColor = useCallback((userId = 'anonymous') => {
    const palette = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#a855f7', '#ec4899'];
    const source = String(userId);
    let hash = 0;
    for (let i = 0; i < source.length; i += 1) {
      hash = ((hash << 5) - hash) + source.charCodeAt(i);
      hash |= 0;
    }
    return palette[Math.abs(hash) % palette.length];
  }, []);

  const ensureRemoteCursorStyles = useCallback((styleKey, color, initial, userName) => {
    if (remoteCursorStyleKeysRef.current.has(styleKey)) {
      return;
    }

    const safeInitial = String(initial || 'U').replace(/[^A-Za-z0-9]/g, '').slice(0, 1).toUpperCase() || 'U';
    const safeUserName = String(userName || 'User').replace(/['\\]/g, '');

    const styleElement = document.createElement('style');
    styleElement.id = `remote-cursor-style-${styleKey}`;
    styleElement.textContent = `
      .monaco-editor .remote-cursor-marker-${styleKey} {
        border-left: 2px solid ${color};
        margin-left: -1px;
      }
      .monaco-editor .remote-cursor-label-${styleKey} {
        position: relative;
        display: inline-block;
        width: 0;
        line-height: 0;
        overflow: visible;
        pointer-events: none;
        z-index: 20;
      }
      .monaco-editor .remote-cursor-label-${styleKey}::after {
        content: '${safeUserName}';
        position: absolute;
        left: 4px;
        top: -1.5em;
        display: inline-flex;
        align-items: center;
        background: ${color};
        color: #ffffff;
        border-radius: 4px;
        padding: 2px 6px;
        font-size: 10px;
        line-height: 1;
        font-weight: 600;
        white-space: nowrap;
        opacity: 0.72;
        transition: transform 90ms linear, opacity 120ms ease;
        pointer-events: none;
      }
      .monaco-editor .glyph-margin .remote-cursor-glyph-${styleKey} {
        position: relative;
      }
      .monaco-editor .glyph-margin .remote-cursor-glyph-${styleKey}::before {
        content: '${safeInitial}';
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 14px;
        height: 14px;
        border-radius: 999px;
        background: ${color};
        color: #ffffff;
        font-size: 9px;
        font-weight: 700;
        margin-left: 1px;
        margin-top: 2px;
        box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.95);
      }
    `;

    document.head.appendChild(styleElement);
    remoteCursorStyleKeysRef.current.add(styleKey);
  }, []);

  const renderRemoteCursors = useCallback(() => {
    const editor = monacoEditorRef.current;
    if (!editor || !monacoInstance || !currentFile?.name) {
      if (editor) {
        remoteCursorDecorationIdsRef.current = editor.deltaDecorations(remoteCursorDecorationIdsRef.current, []);
      }
      return;
    }

    const model = editor.getModel();
    if (!model) return;

    const cursorDecorations = [];
    for (const cursorData of remoteCursorsRef.current.values()) {
      if (!cursorData?.position || cursorData.position.fileName !== currentFile.name) {
        continue;
      }

      const safeKey = String(cursorData.socketId || cursorData.userId || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
      const color = cursorData.cursorColor || getStableCursorColor(cursorData.userId);
      const initial = (cursorData.userName || 'U').trim().slice(0, 1).toUpperCase();
      ensureRemoteCursorStyles(safeKey, color, initial, cursorData.userName || 'User');

      const maxLine = model.getLineCount();
      const lineNumber = Math.min(Math.max(1, Number(cursorData.position.lineNumber || 1)), maxLine);
      const maxColumn = model.getLineMaxColumn(lineNumber);
      const column = Math.min(Math.max(1, Number(cursorData.position.column || 1)), maxColumn);
      const endColumn = column < maxColumn ? column + 1 : column;

      cursorDecorations.push({
        range: new monacoInstance.Range(lineNumber, column, lineNumber, endColumn),
        options: {
          className: `remote-cursor-marker-${safeKey}`,
          glyphMarginClassName: `remote-cursor-glyph-${safeKey}`,
          before: {
            content: '\u200b',
            inlineClassName: `remote-cursor-label-${safeKey}`,
            cursorStops: monacoInstance.editor.InjectedTextCursorStops.None,
          },
          stickiness: monacoInstance.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      });
    }

    remoteCursorDecorationIdsRef.current = editor.deltaDecorations(remoteCursorDecorationIdsRef.current, cursorDecorations);
  }, [currentFile, ensureRemoteCursorStyles, getStableCursorColor, monacoInstance]);

  const emitCursorPosition = useCallback((position) => {
    if (!socket || !projectId || !currentFile?.name || !position) return;

    const payload = {
      roomId: projectId,
      fileName: currentFile.name,
      position: {
        lineNumber: Math.max(1, Number(position.lineNumber || 1)),
        column: Math.max(1, Number(position.column || 1)),
      },
    };

    const now = Date.now();
    const minInterval = 35;
    const elapsed = now - cursorBroadcastRef.current.lastSentAt;

    if (elapsed >= minInterval) {
      socket.emit('cursor-move', payload);
      cursorBroadcastRef.current.lastSentAt = now;
      return;
    }

    cursorBroadcastRef.current.pendingPayload = payload;
    if (cursorBroadcastRef.current.timeoutId) return;

    cursorBroadcastRef.current.timeoutId = setTimeout(() => {
      if (cursorBroadcastRef.current.pendingPayload) {
        socket.emit('cursor-move', cursorBroadcastRef.current.pendingPayload);
        cursorBroadcastRef.current.lastSentAt = Date.now();
      }
      cursorBroadcastRef.current.pendingPayload = null;
      cursorBroadcastRef.current.timeoutId = null;
    }, minInterval - elapsed);
  }, [socket, projectId, currentFile]);

  useEffect(() => {
    renderRemoteCursors();
  }, [renderRemoteCursors]);

  useEffect(() => {
    const editor = monacoEditorRef.current;
    if (!editor || !currentFile?.name) return;

    const currentPosition = editor.getPosition();
    if (currentPosition) {
      emitCursorPosition(currentPosition);
    }
  }, [currentFile, emitCursorPosition]);

  useEffect(() => {
    return () => {
      if (cursorBroadcastRef.current.timeoutId) {
        clearTimeout(cursorBroadcastRef.current.timeoutId);
      }
    };
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleRemoteCursorMoved = (data) => {
      if (!data || !data.socketId || data.socketId === socket.id) return;
      remoteCursorsRef.current.set(data.socketId, data);
      renderRemoteCursors();
    };

    const handleRemoteCursorRemoved = (data) => {
      if (!data?.socketId) return;
      remoteCursorsRef.current.delete(data.socketId);
      renderRemoteCursors();
    };

    socket.on('cursor-moved', handleRemoteCursorMoved);
    socket.on('cursor-removed', handleRemoteCursorRemoved);

    return () => {
      socket.off('cursor-moved', handleRemoteCursorMoved);
      socket.off('cursor-removed', handleRemoteCursorRemoved);
    };
  }, [socket, renderRemoteCursors]);

  // Join room when component mounts or socket reconnects
  useEffect(() => {
    if (socket && projectId) {
      const user = JSON.parse(sessionStorage.getItem('user') || '{}');
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

      // Listen for room users updates
      const handleRoomUsers = (users) => {
        const dedupedUsers = Array.from(
          new Map(
            (users || []).map((u) => [String(u?.userId || `socket:${u?.socketId || ''}`), u])
          ).values()
        );

        console.log('Room users updated:', dedupedUsers);
        setOnlineUsers(dedupedUsers);

        const activeSocketIds = new Set((dedupedUsers || []).map((u) => u.socketId).filter(Boolean));
        let changed = false;
        for (const key of Array.from(remoteCursorsRef.current.keys())) {
          if (!activeSocketIds.has(key)) {
            remoteCursorsRef.current.delete(key);
            changed = true;
          }
        }
        if (changed) {
          renderRemoteCursors();
        }
      };

      const handleRoomState = (payload) => {
        const incomingRoomFiles = sanitizeProjectFiles(payload?.codeState?.files || []);

        // Guard against an early empty room-state replacing freshly loaded API state.
        const isFirstRoomState = !roomStateHydratedRef.current;
        roomStateHydratedRef.current = true;
        if (isFirstRoomState && incomingRoomFiles.length === 0 && filesRef.current.length > 0) {
          console.warn('[RoomState] Ignoring first empty room-state to preserve API-loaded files');
          return;
        }

        const roomFiles = isFirstRoomState && apiFilesHydratedRef.current
          ? mergeFilesPreservingSavedContent(incomingRoomFiles, filesRef.current)
          : incomingRoomFiles;

        setFiles(roomFiles);
        setCurrentFile((prev) => {
          if (prev) {
            const stillExists = roomFiles.find((f) => f.name === prev.name || f.id === prev.id);
            if (stillExists) return stillExists;
          }
          return roomFiles.find((f) => !f.name.endsWith('/')) || null;
        });
      };

      socket.on('room-users', handleRoomUsers);
      socket.on('room-state', handleRoomState);

      // Listen for join errors (access denied)
      socket.on('join-error', (data) => {
        console.error('Join error:', data);
        alert(data.message || 'Failed to join room');
        if (data.requiresInvite) {
          navigate('/dashboard');
        }
      });

      return () => {
        socket.off('connect', joinRoom);
        socket.off('room-users', handleRoomUsers);
        socket.off('room-state', handleRoomState);
        socket.off('join-error');
      };
    }
  }, [socket, projectId, navigate, renderRemoteCursors, sanitizeProjectFiles, mergeFilesPreservingSavedContent]);

  const saveProject = async (updatedFiles) => {
    try {
      await persistProjectFiles(updatedFiles);
      console.log('[Save] Project saved to server');
    } catch (err) {
      console.error('[Save] Error saving project:', err?.response?.status, err?.message);
    }
  };

  // Flush the pending debounced save immediately — called on file-switch and page hide
  const flushPendingSave = useCallback(() => {
    if (saveDebounceRef.current) {
      clearTimeout(saveDebounceRef.current);
      saveDebounceRef.current = null;
    }
    if (filesRef.current.length) {
      saveProject(filesRef.current);
    }
  }, []);

  const handleCreateFile = useCallback((fileName) => {
    const normalizedFileName = normalizePath(fileName);
    if (!normalizedFileName) {
      alert('File name cannot be empty.');
      return;
    }
    if (normalizedFileName === '.gitkeep') {
      alert('The file name .gitkeep is not allowed.');
      return;
    }

    // Check for duplicate file names
    if (files.some(f => f.name === normalizedFileName)) {
      alert(`File "${normalizedFileName}" already exists in this project.`);
      return;
    }

    const newFile = {
      id: Date.now().toString(),
      name: normalizedFileName,
      content: '',
      language: getLanguageFromExt(normalizedFileName)
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
  }, [files, projectId, socket, normalizePath]);

  const handleSelectFile = useCallback((selectedFile) => {
    if (!selectedFile) return;

    const latestFile = filesRef.current.find(
      (file) => file.name === selectedFile.name || file.id === selectedFile.id
    ) || selectedFile;

    const resolvedContent = fileContentMap[latestFile.name];
    setCurrentFile({
      ...latestFile,
      content: typeof resolvedContent === 'string' ? resolvedContent : (latestFile.content || ''),
    });
  }, [fileContentMap]);

  const handleDeleteFile = useCallback(async (targetPath) => {
    const folderPath = normalizePath(targetPath);
    if (!folderPath) {
      alert('Delete path cannot be empty.');
      return;
    }
    const folderPrefix = `${folderPath}/`;
    const isFolderDelete = files.some(
      (f) => f.name === folderPrefix || f.name.startsWith(folderPrefix)
    );

    const previousFiles = files;
    const updatedFiles = isFolderDelete
      ? files.filter(
          (f) =>
            f.name !== folderPrefix &&
            !f.name.startsWith(folderPrefix)
        )
      : files.filter(f => normalizePath(f.name) !== folderPath && (f.id || f.name) !== folderPath);

    // Optimistic UI update, rollback if server delete fails.
    setFiles(updatedFiles);
    
    // Clear current file if it was deleted
    if (
      currentFile &&
      (
        normalizePath(currentFile.name) === folderPath ||
        (isFolderDelete && currentFile.name.startsWith(folderPrefix))
      )
    ) {
      const nextEditableFile = updatedFiles.find((f) => !f.name.endsWith('/')) || null;
      setCurrentFile(nextEditableFile);
    }
    
    try {
      const token = sessionStorage.getItem('token');
      const endpoint = isFolderDelete
        ? `http://localhost:5000/api/projects/${projectId}/folders`
        : `http://localhost:5000/api/projects/${projectId}/files`;
      const response = await axios.delete(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
        params: { path: folderPath },
      });

      // Server is authoritative; use persisted file list returned by API.
      const persistedFiles = sanitizeProjectFiles(response?.data?.files || []);
      setFiles(persistedFiles);
      setCurrentFile((prev) => {
        if (!prev) return persistedFiles.find((f) => !f.name.endsWith('/')) || null;
        const stillExists = persistedFiles.find((f) => f.name === prev.name || f.id === prev.id);
        return stillExists || persistedFiles.find((f) => !f.name.endsWith('/')) || null;
      });

      // Emit deletion event to collaborators only after server confirmed persistence.
      if (socket && projectId) {
        socket.emit(isFolderDelete ? 'deleteFolder' : 'deleteFile', {
          roomId: projectId,
          path: folderPath,
          deletedBy: JSON.parse(sessionStorage.getItem('user') || '{}').name
        });
      }
    } catch (err) {
      console.error('Failed to permanently delete path:', err);

      // Compatibility fallback: if dedicated delete routes are unavailable,
      // persist deletion through the general project save endpoint.
      const status = err?.response?.status;
      if (status === 404 || status === 405) {
        try {
          await saveProject(updatedFiles);

          if (socket && projectId) {
            socket.emit(isFolderDelete ? 'deleteFolder' : 'deleteFile', {
              roomId: projectId,
              path: folderPath,
              deletedBy: JSON.parse(sessionStorage.getItem('user') || '{}').name
            });
          }

          console.warn('[Delete] Fallback persistence used via PUT /api/projects/:id');
          return;
        } catch (fallbackErr) {
          console.error('[Delete] Fallback persistence failed:', fallbackErr);
        }
      }

      // Rollback optimistic update only when all persistence paths fail.
      setFiles(previousFiles);
      setCurrentFile((prev) => {
        if (prev) return prev;
        return previousFiles.find((f) => !f.name.endsWith('/')) || null;
      });
      alert(err?.response?.data?.error || 'Delete failed on server.');
    }
  }, [files, currentFile, projectId, socket, normalizePath, sanitizeProjectFiles]);

  const handleSaveFile = useCallback((file) => {
    // Save the current state of files to server and localStorage
    saveProject(files);
    
    // Show a brief success message (optional)
    console.log(`File "${file.name}" saved successfully`);
  }, [files]);

  const handleCreateFolder = useCallback((folderPath) => {
    const normalizedFolder = normalizePath(folderPath);
    if (!normalizedFolder) {
      alert('Folder name cannot be empty.');
      return;
    }
    if (normalizedFolder === '.gitkeep') {
      alert('The folder name .gitkeep is not allowed.');
      return;
    }
    const folderMarker = `${normalizedFolder}/`;

    if (
      files.some(
        (f) => f.name === folderMarker || f.name.startsWith(folderMarker)
      )
    ) {
      alert(`Folder "${normalizedFolder}" already exists.`);
      return;
    }

    const folderEntry = {
      id: Date.now().toString(),
      name: folderMarker,
      content: '',
      language: 'plaintext'
    };

    const updatedFiles = [...files, folderEntry];
    setFiles(updatedFiles);

    if (socket && projectId) {
      socket.emit('code-change', {
        roomId: projectId,
        fileId: folderEntry.id,
        fileName: folderEntry.name,
        content: '',
        language: folderEntry.language,
        isNewFile: true
      });
    }

    saveProject(updatedFiles);
  }, [files, projectId, socket, normalizePath]);

  const handleRenameFile = useCallback((oldPath, newPath) => {
    // Check if new path already exists
    if (files.some(f => f.name === newPath)) {
      alert(`File or folder "${newPath}" already exists.`);
      return;
    }

    // Update all files that start with oldPath (to handle folder renames)
    const updatedFiles = files.map(file => {
      if (file.name === oldPath) {
        // Direct file rename
        return { ...file, name: newPath, language: getLanguageFromExt(newPath) };
      } else if (file.name === `${oldPath}/`) {
        // Folder marker rename
        return { ...file, name: `${newPath}/`, content: '', language: 'plaintext' };
      } else if (file.name.startsWith(oldPath + '/')) {
        // File inside renamed folder
        const newName = newPath + file.name.substring(oldPath.length);
        return { ...file, name: newName };
      }
      return file;
    });

    setFiles(updatedFiles);

    // Update current file if it was renamed
    if (currentFile && (currentFile.name === oldPath || currentFile.name.startsWith(oldPath + '/'))) {
      const renamedFile = updatedFiles.find(f => 
        f.id === currentFile.id || f.name === (currentFile.name === oldPath ? newPath : newPath + currentFile.name.substring(oldPath.length))
      );
      if (renamedFile) {
        setCurrentFile(renamedFile);
      }
    }

    // Save project
    saveProject(updatedFiles);

    console.log(`Renamed "${oldPath}" to "${newPath}"`);
  }, [files, currentFile, projectId, socket]);

  // Apply remote updates directly to Monaco editor without triggering onChange
  const applyRemoteUpdate = useCallback((newContent) => {
    if (monacoEditorRef.current && currentFile) {
      const editor = monacoEditorRef.current;
      const model = editor.getModel();
      
      if (model) {
        const currentContent = model.getValue();
        if (currentContent === newContent) {
          return; // No change needed
        }

        // Only apply if user is not actively typing
        if (isTyping.current) {
          console.log('[Apply] User typing, skipping remote update for now');
          return;
        }

        // Set flag to prevent onChange from processing this change
        isApplyingRemoteChange.current = true;
        
        // Update Monaco model directly
        model.setValue(newContent);
        
        // Update state without triggering sync
        setCurrentFile(prev => ({ ...prev, content: newContent }));
        setFiles(prevFiles => 
          prevFiles.map(f => f.name === currentFile.name ? { ...f, content: newContent } : f)
        );
        
        // Reset flag immediately since we're not in a remote handler context
        isApplyingRemoteChange.current = false;
      }
    } else {
      // Fallback if editor not available
      setCurrentFile(prev => ({ ...prev, content: newContent }));
      setFiles(prevFiles => 
        prevFiles.map(f => f.name === currentFile?.name ? { ...f, content: newContent } : f)
      );
    }
  }, [currentFile]);

  const handleCodeChange = useCallback((value, changedLines = []) => {
    if (userRole === 'viewer') return;
    if (!currentFile) return;
    if (typeof value !== 'string') return;
    
    // Ignore if this change is from a remote update
    if (isApplyingRemoteChange.current) {
      return;
    }

    if (isInitialLoad.current) {
      return;
    }

    // Mark user as actively typing
    isTyping.current = true;
    
    // Clear and reset typing timeout
    if (typingTimeout.current) {
      clearTimeout(typingTimeout.current);
    }
    
    // Mark typing as stopped after 500ms of no changes
    typingTimeout.current = setTimeout(() => {
      isTyping.current = false;
      
      // Apply any pending remote updates
      if (pendingRemoteUpdate.current && pendingRemoteUpdate.current.fileName === currentFile.name) {
        const { content } = pendingRemoteUpdate.current;
        applyRemoteUpdate(content);
        pendingRemoteUpdate.current = null;
      }
    }, 500);

    // Store in ref immediately for smooth typing
    editorValueRef.current = value;

    // Update local state
    setCurrentFile(prev => ({ ...prev, content: value }));
    setFiles(prevFiles => 
      prevFiles.map(f => (f.name === currentFile.name) ? { ...f, content: value } : f)
    );
    
    // Sync with Yjs (debounced)
    // Debounced direct HTTP save — socket-independent, guarantees persistence.
    // 2 seconds after the last keystroke the full file list is written to DB.
    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    saveDebounceRef.current = setTimeout(() => {
      // Build the up-to-date list using filesRef so no stale content is used
      const latestFiles = filesRef.current.map(f =>
        f.name === currentFile.name ? { ...f, content: value } : f
      );
      saveProject(latestFiles);
      saveDebounceRef.current = null;
    }, 2000);

    if (socket && projectId) {
      syncYjsChange(currentFile.name, value);

      // Periodically emit content snapshot so insert/delete/replace operations
      // stay synchronized across collaborators.
      fallbackSyncRef.current.pendingPayload = {
        roomId: projectId,
        fileId: currentFile.id || currentFile.name,
        fileName: currentFile.name,
        content: value,
        language: currentFile.language || 'javascript',
        changedLines,
        isFallbackSync: false,
      };

      if (!fallbackSyncRef.current.timeoutId) {
        fallbackSyncRef.current.timeoutId = setTimeout(() => {
          if (fallbackSyncRef.current.pendingPayload) {
            socket.emit('code-change', fallbackSyncRef.current.pendingPayload);
          }
          fallbackSyncRef.current.pendingPayload = null;
          fallbackSyncRef.current.timeoutId = null;
        }, 180);
      }
    }
  }, [currentFile, socket, projectId, syncYjsChange, userRole]);

  useEffect(() => {
    return () => {
      if (fallbackSyncRef.current.timeoutId) {
        clearTimeout(fallbackSyncRef.current.timeoutId);
      }
    };
  }, []);

  // Handle: Check if code likely requires input
  const codeRequiresInput = (code, language) => {
    if (!code) return false;
    const lower = code.toLowerCase();
    const inputPatterns = {
      python: ['input(', 'raw_input(', 'sys.stdin', 'input'],
      javascript: ['readline', 'process.stdin', 'prompt(', 'require("readline")'],
      java: ['scanner', 'readline', 'bufferedreader', 'system.in'],
      cpp: ['cin', 'getline', 'scanf', 'std::cin'],
      c: ['scanf', 'getline', 'fgets', 'gets'],
      csharp: ['console.readline', 'readkey', 'readinput', 'system.io']
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
    if (userRole === 'viewer') {
      setExecutionOutput('View-only role cannot execute code.');
      setCompileError('');
      setRuntimeError('');
      return;
    }

    // Check if input is required but not provided
    const requiresInput = codeRequiresInput(currentFile.content, currentFile.language);
    
    // If input is required but not provided, wait for user input
    if (requiresInput && !executionInput.trim()) {
      setIsExecuting(false);
      setWaitingForInput(true);
      setExecutionOutput('');
      setCompileError('');
      setRuntimeError('');
      return;
    }

    // Reset states for new execution
    setIsExecuting(true);
    setWaitingForInput(false);
    setExecutionOutput('');
    setCompileError('');
    setRuntimeError('');

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
      input: executionInput,
      activeFileName: currentFile.name,
      entryFileName: currentFile.name,
      files: files
        .filter((file) => file && !String(file.name || '').endsWith('/'))
        .map((file) => ({
          name: file.name,
          content: file.content || '',
          language: file.language || getLanguageFromExt(file.name),
        }))
    });
  }, [currentFile, socket, projectId, executionInput, userRole, files]);

  // Listen for execution results
  React.useEffect(() => {
    if (!socket) return;
    
    const handleExecutionResult = (data) => {
      console.log('[Execution] Result received:', data);
      setExecutionOutput(data.output || '');
      setCompileError(data.compileError || '');
      setRuntimeError(data.runtimeError || '');
      setIsExecuting(false);
      setWaitingForInput(false);
      setExecutionInput('');
      setAnalytics(prev => ({
        ...prev,
        totalRuns: prev.totalRuns + 1,
        successfulRuns: prev.successfulRuns + 1,
        executionTimes: [...prev.executionTimes, data.executionTime]
      }));
    };

    const handleExecutionError = (data) => {
      console.log('[Execution] Error received:', data);
      setExecutionOutput(data.output || '');
      setCompileError(data.compileError || '');
      setRuntimeError(data.runtimeError || data.error || '');
      setIsExecuting(false);
      setWaitingForInput(false);
      setExecutionInput('');
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

  // Listen for team execution activity to keep owner analytics fresh
  useEffect(() => {
    if (!socket) return;

    const handleExecutionActivity = (data) => {
      setActivityFeed((prev) => [
        { ...data, timestamp: new Date().toISOString() },
        ...prev
      ].slice(0, 30));

      // If current user is the owner, refresh analytics so they can see collaborator runs
      if (projectOwnerId === currentUserId) {
        fetchAllAnalytics();
      }
    };

    socket.on('execution-activity', handleExecutionActivity);
    return () => socket.off('execution-activity', handleExecutionActivity);
  }, [socket, projectOwnerId, currentUserId, fetchAllAnalytics]);

  // Listen for real-time code changes from collaborators
  React.useEffect(() => {
    if (!socket || !projectId) return;

    // Handle new file creation from other users
    const handleCodeChanged = (data) => {
      if (isInitialLoad.current) {
        return;
      }

      if (!data.isNewFile) {
        const incomingName = data.fileName || data.fileId;
        if (!incomingName) return;

        if (typeof data.content !== 'string') return;

        if (currentFile?.name === incomingName) {
          // Don't apply remote update if user is actively typing on this file
          if (isTyping.current) {
            console.log('[Socket] User is typing, queueing code-changed update');
            pendingRemoteUpdate.current = { fileName: incomingName, content: data.content };
            return;
          }

          if (currentFile.content !== data.content) {
            applyRemoteUpdate(data.content);
          }
        } else {
          setFiles(prevFiles =>
            prevFiles.map(f =>
              (f.name === incomingName || f.id === data.fileId)
                ? { ...f, content: data.content }
                : f
            )
          );
        }
        return;
      }

      // Handle new file creation - ensure no duplicates
      if (data.isNewFile) {
        console.log('[Real-time] New file created:', {
          fileId: data.fileId,
          fileName: data.fileName,
          creator: data.modifiedBy
        });
        
        setFiles(prevFiles => {
          // Check for existing file by both ID and name
          const fileExists = prevFiles.some(f => 
            (f.id && f.id === data.fileId) || 
            (f.name === data.fileName)
          );
          
          if (!fileExists) {
            const newFile = {
              id: data.fileId,
              name: data.fileName || 'Untitled',
              content: typeof data.content === 'string' ? data.content : '',
              language: data.language || 'javascript'
            };
            
            console.log('[Real-time] Adding new file to state:', newFile.name);
            
            if (!newFile.name.endsWith('/')) {
              // Initialize Yjs for the new file
              initializeYjsFile(newFile.name, newFile.content);
              requestYjsState(newFile.name);
            }
            
            return [...prevFiles, newFile];
          } else {
            console.log('[Real-time] File already exists, skipping duplicate:', data.fileName);
            return prevFiles;
          }
        });
      }
    };

    socket.on('code-changed', handleCodeChanged);

    // Handle Yjs state sync
    const handleYjsState = (data) => {
      console.log('[Yjs] Received state for file:', data.fileName);
      const { fileName, state } = data;

      const ydoc = new Y.Doc();
      Y.applyUpdate(ydoc, new Uint8Array(state));

      const ytext = ydoc.getText('shared-text');
      yDocs.current.set(fileName, ydoc);
      yTexts.current.set(fileName, ytext);

      const syncedText = ytext.toString();
      setFiles((prevFiles) =>
        prevFiles.map((f) => (f.name === fileName ? { ...f, content: syncedText } : f))
      );
      if (currentFile?.name === fileName) {
        applyRemoteUpdate(syncedText);
      }
    };

    // Handle Yjs updates from other users
    const handleYjsSync = (data) => {
      console.log('[Yjs] Received update for file:', data.fileName);
      const { fileName, update } = data;
      
      // Show incoming sync notification
      showYjsSyncNotification('📥 Received changes...');
      
      if (yDocs.current.has(fileName)) {
        // Mark as remote change to avoid triggering observer
        isRemoteChange.current = true;
        Y.applyUpdate(yDocs.current.get(fileName), new Uint8Array(update));
        isRemoteChange.current = false;
        
        // Get updated content from Yjs
        const ytext = yTexts.current.get(fileName);
        const newContent = ytext.toString();
        console.log('[Yjs] Applying remote update - new content length:', newContent.length);
        
        // If user is typing on this file, queue the update instead
        if (isTyping.current && currentFile?.name === fileName) {
          console.log('[Yjs] User is typing, queuing remote update');
          pendingRemoteUpdate.current = { fileName, content: newContent };
          return;
        }
        
        // Apply remote update using Monaco API if this is the current file
        if (currentFile?.name === fileName) {
          applyRemoteUpdate(newContent);
        } else {
          // Update files state for non-active files
          setFiles(prevFiles =>
            prevFiles.map(f => f.name === fileName ? { ...f, content: newContent } : f)
          );
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
  }, [socket, currentFile, syncYjsChange, initializeYjsFile, requestYjsState, applyRemoteUpdate, showYjsSyncNotification]);

  // File deletion handler
  useEffect(() => {
    if (!socket || !projectId) return;

    const handleFileDeleted = (data) => {
      const deletedPath = normalizePath(data.path || data.fileId);
      if (!deletedPath) return;
      const deleteType = data.type === 'folder' ? 'folder' : 'file';

      console.log('[Real-time] File deleted from collaborator:', {
        fileId: deletedPath,
        type: deleteType,
        deletedBy: data.deletedBy,
        timestamp: data.timestamp
      });

      setFiles(prevFiles => {
        const folderPath = deletedPath;
        const folderPrefix = `${folderPath}/`;
        
        // Filter out deleted file and any files within deleted folder
        const updated = prevFiles.filter(f => {
          const normalizedName = normalizePath(f.name);
          if (normalizedName === folderPath || f.id === folderPath) return false;
          if (deleteType === 'folder' && normalizedName.startsWith(folderPrefix)) return false;
          return true;
        });
        
        console.log(`[Real-time] Files after deletion: ${updated.length} files remain`);
        return updated;
      });

      // Clear current file if it was deleted
      setCurrentFile(prev => {
        if (!prev) return null;
        
        const folderPath = deletedPath;
        const folderPrefix = `${folderPath}/`;
        
        const normalizedCurrent = normalizePath(prev.name);
        if (normalizedCurrent === folderPath ||
            (deleteType === 'folder' && normalizedCurrent.startsWith(folderPrefix))) {
          console.log('[Real-time] Current file was deleted, clearing selection');
          return null;
        }
        return prev;
      });
    };

    socket.on('file-deleted-remote', handleFileDeleted);

    return () => {
      socket.off('file-deleted-remote', handleFileDeleted);
    };
  }, [socket, projectId]);

  // Auto-save safety-net every 10 seconds.
  // IMPORTANT: depends only on projectId so the interval is NEVER restarted by keystrokes.
  // Uses filesRef (always current) instead of the files closure value.
  React.useEffect(() => {
    const autoSaveServer = setInterval(() => {
      if (!filesRef.current.length) return;
      persistProjectFiles(filesRef.current).then(() => {
        console.log('[Auto-save] Synced to server');
      }).catch(err => {
        console.log('[Auto-save] Server sync failed (will retry):', err.message);
      });
    }, 10000); // Every 10 seconds — stable, never restarted by typing

    return () => clearInterval(autoSaveServer);
  }, [persistProjectFiles]); // intentionally excludes files — uses filesRef instead

  // Save immediately when the user switches to a different file
  const prevFileNameRef = useRef(null);
  useEffect(() => {
    const prev = prevFileNameRef.current;
    const current = currentFile?.name || null;
    if (prev && prev !== current) {
      // User just switched away from a file — flush any pending save immediately
      flushPendingSave();
    }
    prevFileNameRef.current = current;
  }, [currentFile?.name, flushPendingSave]);

  // Save when the browser tab loses visibility (user refreshes, switches tabs, closes)
  useEffect(() => {
    const handleHide = () => {
      if (document.visibilityState === 'hidden' && filesRef.current.length) {
        if (saveDebounceRef.current) {
          clearTimeout(saveDebounceRef.current);
          saveDebounceRef.current = null;
        }
        persistProjectFiles(filesRef.current, { keepalive: true }).catch((err) => {
          console.error('[Save] Keepalive visibility save failed:', err?.message || err);
        });
      }
    };
    document.addEventListener('visibilitychange', handleHide);
    return () => document.removeEventListener('visibilitychange', handleHide);
  }, [persistProjectFiles]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!filesRef.current.length) return;

      if (saveDebounceRef.current) {
        clearTimeout(saveDebounceRef.current);
        saveDebounceRef.current = null;
      }

      persistProjectFiles(filesRef.current, { keepalive: true }).catch(() => {});
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [persistProjectFiles]);

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
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              {sidebarTab === 'files' && `${files.length} file${files.length !== 1 ? 's' : ''}`}
              {sidebarTab === 'git' && 'Version control'}
              {sidebarTab === 'chat' && 'Real-time collaboration'}
              {sidebarTab === 'analytics' && 'Project insights'}
              {sidebarTab === 'export' && 'Export your work'}
              {sidebarTab === 'settings' && 'Manage users and permissions'}
            </p>
          </div>

          {/* Panel Content */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {sidebarTab === 'files' && (
              <div className="flex-1 overflow-auto">
                <FileTree
                  files={files}
                  currentFile={currentFile}
                  onSelectFile={handleSelectFile}
                  onCreateFile={handleCreateFile}
                  onDeleteFile={handleDeleteFile}
                  onSaveFile={handleSaveFile}
                  onCreateFolder={handleCreateFolder}
                  onRenameFile={handleRenameFile}
                />
              </div>
            )}
            {sidebarTab === 'git' && (
              <div className="flex-1 overflow-auto flex flex-col">
                {userRole === 'admin' && (
                  <div className="px-3 pt-3 pb-1">
                    <button
                      onClick={() => setShowImportModal(true)}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xs rounded border border-gray-700 transition"
                    >
                      <GitBranch size={13} />
                      Import from GitHub
                    </button>
                  </div>
                )}
                <GitControl projectId={projectId} onFilesChanged={handleFilesFromPull} />
              </div>
            )}
            {sidebarTab === 'chat' && (
              <div className="flex-1 overflow-auto">
                <Chat roomId={projectId} onlineUsers={onlineUsers} />
              </div>
            )}
            {sidebarTab === 'analytics' && (
              <div className="flex-1 overflow-auto p-4">
                <Analytics data={analytics} allUsersData={allUsersAnalytics} activityFeed={activityFeed} />
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
          </div>
        </div>

        {/* Editor Section */}
        <div className="flex-1 flex flex-col bg-gray-950">
          {/* Top Bar with Project Info */}
          <div className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-xl font-bold text-white">{projectName}</h1>
                <p className="text-xs text-gray-400 mt-1">
                  {currentFile ? `Editing: ${currentFile.name}` : 'No file selected'}
                </p>
              </div>
              {/* Current User Badge */}
              <UserBadge user={currentUser} />
            </div>
            
            {/* Online Collaborators */}
            {onlineUsers.length > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg">
                <div className="flex -space-x-2">
                  {onlineUsers.slice(0, 4).map((u, idx) => (
                    <div
                      key={idx}
                      className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 border-2 border-gray-900 flex items-center justify-center text-white text-xs font-bold"
                      title={u.userName}
                    >
                      {u.userName?.[0]?.toUpperCase() || '?'}
                    </div>
                  ))}
                  {onlineUsers.length > 4 && (
                    <div className="w-8 h-8 rounded-full bg-gray-700 border-2 border-gray-900 flex items-center justify-center text-gray-300 text-xs font-bold">
                      +{onlineUsers.length - 4}
                    </div>
                  )}
                </div>
                <span className="text-xs text-gray-400">{onlineUsers.length} online</span>
              </div>
            )}
            
            <div className="flex items-center gap-3">
              {/* Invite Users Button - Admin Only */}
              {userRole === 'admin' && (
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all shadow-lg hover:shadow-xl"
                  title="Invite users to this room"
                >
                  <Share2 size={16} /> Invite
                </button>
              )}
              
              {/* Run Button */}
              <button
                onClick={handleExecuteCode}
                disabled={userRole === 'viewer' || isExecuting}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-all shadow-lg transform ${
                  userRole === 'viewer'
                    ? 'bg-gray-700 text-gray-300 cursor-not-allowed'
                    : 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white hover:shadow-xl hover:scale-105'
                }`}
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

            {/* Yjs Sync Notification */}
            {yjsSyncActive && (
              <div className="fixed top-4 right-4 z-50 animate-pulse">
                <div className="bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 border border-blue-500">
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-2 h-2 bg-white rounded-full animate-bounce"></span>
                    <span className="inline-block w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                    <span className="inline-block w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                  </div>
                  <span className="font-medium">{yjsSyncMessage}</span>
                </div>
              </div>
            )}
          </div>

          {/* Editor Area */}
          <div className="flex-1 p-4 overflow-hidden flex flex-col">
            {/* Theme Toggle Button */}
            <div className="flex justify-end mb-2">
              <button
                onClick={() => setEditorTheme(prev => prev === 'vs-dark' ? 'light' : 'vs-dark')}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm flex items-center gap-2 transition"
                title="Toggle Theme"
              >
                {editorTheme === 'vs-dark' ? '🌞 Light' : '🌙 Dark'}
              </button>
            </div>
            
            <div className="flex-1 rounded-lg border border-gray-800 overflow-hidden shadow-xl">
              {currentFile ? (
                <Editor
                  key={currentFile.name}
                  height="100%"
                  language={currentFile.language}
                  defaultValue={currentFile.content}
                  onMount={(editor, monaco) => {
                    setEditorInstance(editor);
                    setMonacoInstance(monaco);
                    monacoEditorRef.current = editor; // Store editor ref for remote updates

                    editor.setValue(currentFile?.content || '');
                    editorValueRef.current = currentFile?.content || '';

                    // Reset initial load flag immediately so first keystroke is not blocked
                    isInitialLoad.current = false;

                    // Share local cursor movement with collaborators.
                    editor.onDidChangeCursorPosition((event) => {
                      emitCursorPosition(event.position);
                    });

                    const initialPosition = editor.getPosition();
                    if (initialPosition) {
                      emitCursorPosition(initialPosition);
                    }
                    
                    // Track changes for blame
                    editor.onDidChangeModelContent((e) => {
                      if (!currentFile) return;

                      const changedLineNumbers = Array.from(new Set(
                        e.changes.flatMap((change) => {
                          const insertedLineCount = String(change.text || '').split('\n').length - 1;
                          const endLineNumber = Math.max(
                            change.range.endLineNumber,
                            change.range.startLineNumber + insertedLineCount
                          );

                          return Array.from(
                            { length: (endLineNumber - change.range.startLineNumber) + 1 },
                            (_, index) => change.range.startLineNumber + index
                          );
                        })
                      ));

                      handleCodeChange(editor.getValue(), changedLineNumbers);

                      const currentPosition = editor.getPosition();
                      if (currentPosition) {
                        emitCursorPosition(currentPosition);
                      }
                      
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
                  theme={editorTheme}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    fontFamily: 'Fira Code, monospace',
                    scrollBeyondLastLine: false,
                    smoothScrolling: true,
                    glyphMargin: true,
                    lineDecorationsWidth: 10,
                    readOnly: userRole === 'viewer',
                    // Ensure editing is always allowed for non-viewers
                    domReadOnly: false,
                    // Prevent cursor jumping on selection updates
                    selectionClipboard: true,
                    // Allow paste without restrictions
                    pasteAsPlaintext: false,
                    // Smooth undo/redo
                    wordBasedSuggestions: true
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
                <Console output={executionOutput} compileError={compileError} runtimeError={runtimeError} input={executionInput} isExecuting={isExecuting} />
              </div>

              {/* Terminal Input - Only show when waiting for input */}
              {waitingForInput && (
                <div className="border-t border-gray-800 pt-2">
                  <label className="text-xs font-semibold text-blue-400 block mb-1">stdin (awaiting input):</label>
                  <div className="flex gap-2">
                    <textarea
                      autoFocus
                      value={executionInput}
                      onChange={(e) => setExecutionInput(e.target.value)}
                      onKeyDown={(e) => {
                        // Auto-submit on Enter key or Ctrl+Enter
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleExecuteCode();
                        } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                          e.preventDefault();
                          handleExecuteCode();
                        }
                      }}
                      placeholder="$ Enter your input here... (Press Enter to execute)"
                      className="flex-1 h-12 text-white border rounded px-2 py-1 text-xs font-mono bg-blue-950 border-blue-600 focus:border-blue-400 focus:ring-2 focus:ring-blue-900 focus:outline-none transition-colors resize-none"
                    />
                    <button
                      onClick={handleExecuteCode}
                      disabled={isExecuting || userRole === 'viewer'}
                      className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                        userRole === 'viewer'
                          ? 'bg-gray-700 text-gray-300 cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 text-white'
                      }`}
                      title="Execute with input (or press Enter)"
                    >
                      ▶ Run
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Invite Modal - Admin Only */}
      {showInviteModal && userRole === 'admin' && (
        <InviteUserModal
          isOpen={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          roomId={projectId}
          roomName={projectName}
          socket={socket}
        />
      )}

      {/* Import from GitHub Modal */}
      {showImportModal && (
        <ImportRepoModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          onImported={({ projectId: newPid }) => navigate(`/editor/${newPid}`)}
        />
      )}
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
