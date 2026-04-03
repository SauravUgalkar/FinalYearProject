import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  BarChart3,
  Download,
  Filter,
  PlayCircle,
  Search,
  X,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { API_URL } from '../config/runtime';
import { authStorage } from '../services/authStorage';
import { Trash2 } from 'lucide-react';

const STATUS_COLORS = {
  success: 'text-emerald-300 bg-emerald-900/40 border-emerald-500/40',
  error: 'text-rose-300 bg-rose-900/40 border-rose-500/40',
  timeout: 'text-rose-300 bg-rose-900/40 border-rose-500/40',
  running: 'text-amber-300 bg-amber-900/40 border-amber-500/40',
};

const STATUS_LABELS = {
  success: 'Success',
  error: 'Error',
  timeout: 'Timeout',
  running: 'Running',
};

const CHART_COLORS = ['#10b981', '#ef4444'];

const toKey = (entry) => entry.executionId || entry.id || `${entry.username}-${entry.createdAt}`;

const toMinuteBucket = (isoDate) => {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  date.setSeconds(0, 0);
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
};

const formatDuration = (ms) => {
  const value = Number(ms || 0);
  return `${value} ms`;
};

export default function Analytics({
  projectId,
  socket,
  data,
  allUsersData,
  activityFeed = [],
  projectName = 'Project',
  projectDescription = '',
  projectLanguage = 'javascript',
  collaborators = [],
  blameData = [],
}) {
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedExecution, setSelectedExecution] = useState(null);
  const [outputLoading, setOutputLoading] = useState(false);
  const [deletingExecutionId, setDeletingExecutionId] = useState('');
  const [clearingHistory, setClearingHistory] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [filters, setFilters] = useState({
    user: '',
    language: '',
    status: '',
    search: '',
  });

  /** Export all analytics data to a formatted PDF document. */
  const exportToPdf = async () => {
    setExportingPdf(true);
    try {
      // Dynamically import jsPDF and autoTable to keep the initial bundle lean.
      const { jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const now = new Date();
      // Human-readable date/time: "April 3, 2026 at 7:39 PM"
      const humanDate = now.toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
      }) + ' at ' + now.toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit', hour12: true,
      });

      // ── COVER / TITLE BLOCK ─────────────────────────────────────────────
      doc.setFillColor(2, 6, 23);          // slate-950
      doc.rect(0, 0, pageWidth, 46, 'F');

      doc.setTextColor(34, 211, 238);      // cyan-400
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text(projectName, 14, 14);

      doc.setTextColor(148, 163, 184);     // slate-400
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Analytics Report  •  Generated: ${humanDate}`, 14, 22);

      doc.setDrawColor(34, 211, 238);
      doc.setLineWidth(0.5);
      doc.line(14, 26, pageWidth - 14, 26);

      let y = 52;

      // ── PROJECT INFORMATION ──────────────────────────────────────────────
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Project Information', 14, y);
      y += 6;

      // Collect unique languages from executions (or fall back to projectLanguage)
      const languagesUsed = Array.from(
        new Set(executions.map((e) => e.language).filter(Boolean))
      );
      const techStack = languagesUsed.length > 0
        ? languagesUsed.join(', ')
        : (projectLanguage || 'javascript');

      autoTable(doc, {
        startY: y,
        head: [['Field', 'Value']],
        body: [
          ['Project Name', projectName],
          ['Description', projectDescription || '—'],
          ['Tech Stack / Languages', techStack],
          ['Total Collaborators', String(collaborators.length)],
        ],
        headStyles: { fillColor: [2, 132, 199], textColor: 255, fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 9, textColor: [15, 23, 42] },
        alternateRowStyles: { fillColor: [241, 245, 249] },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55 } },
        margin: { left: 14, right: 14 },
      });
      y = doc.lastAutoTable.finalY + 10;

      // ── EXECUTION STATISTICS ────────────────────────────────────────────
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Execution Statistics', 14, y);
      y += 6;

      autoTable(doc, {
        startY: y,
        head: [['Metric', 'Value']],
        body: [
          ['Total Runs', String(stats.totalRuns)],
          ['Successful Runs', String(stats.successfulRuns)],
          ['Failed Runs', String(stats.failedRuns)],
          ['Currently Running', String(stats.runningRuns)],
          ['Success Rate', `${stats.successRate}%`],
          ['Failure Rate', `${stats.failureRate}%`],
        ],
        headStyles: { fillColor: [2, 132, 199], textColor: 255, fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 9, textColor: [15, 23, 42] },
        alternateRowStyles: { fillColor: [241, 245, 249] },
        columnStyles: { 0: { fontStyle: 'bold' } },
        margin: { left: 14, right: 14 },
      });
      y = doc.lastAutoTable.finalY + 10;

      // ── USERS AND THEIR ROLES ────────────────────────────────────────────
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('Users & Roles', 14, y);
      y += 6;

      const memberRows = collaborators.map((c) => [
        c.name || c.email || 'Unknown',
        c.email || '—',
        (c.role || 'viewer').charAt(0).toUpperCase() + (c.role || 'viewer').slice(1),
        c.joinedAt ? new Date(c.joinedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—',
      ]);

      if (memberRows.length === 0) {
        memberRows.push(['No collaborators found', '', '', '']);
      }

      autoTable(doc, {
        startY: y,
        head: [['Name', 'Email', 'Role', 'Joined']],
        body: memberRows,
        headStyles: { fillColor: [2, 132, 199], textColor: 255, fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 9, textColor: [15, 23, 42] },
        alternateRowStyles: { fillColor: [241, 245, 249] },
        margin: { left: 14, right: 14 },
      });
      y = doc.lastAutoTable.finalY + 10;

      // ── ALL-USERS ANALYTICS ─────────────────────────────────────────────
      if (allUsersData && allUsersData.length > 0) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text('Collaborator Execution Summary', 14, y);
        y += 6;

        autoTable(doc, {
          startY: y,
          head: [['User', 'Total Runs', 'Successful', 'Failed', 'Success Rate']],
          body: allUsersData.map((u) => {
            const rate = u.totalRuns > 0
              ? Math.round((u.successfulRuns / u.totalRuns) * 100)
              : 0;
            return [
              u.userName || 'Unknown',
              String(u.totalRuns || 0),
              String(u.successfulRuns || 0),
              String(u.failedRuns || 0),
              `${rate}%`,
            ];
          }),
          headStyles: { fillColor: [2, 132, 199], textColor: 255, fontStyle: 'bold', fontSize: 9 },
          bodyStyles: { fontSize: 9, textColor: [15, 23, 42] },
          alternateRowStyles: { fillColor: [241, 245, 249] },
          margin: { left: 14, right: 14 },
        });
        y = doc.lastAutoTable.finalY + 10;
      }

      // ── EXECUTION HISTORY — SUCCESS ──────────────────────────────────────
      const successRows = executions
        .filter((e) => e.status === 'success')
        .slice(0, 100)
        .map((item) => [
          item.username || 'Unknown',
          item.language || '—',
          item.executionTime != null ? `${item.executionTime} ms` : '—',
          item.createdAt
            ? new Date(item.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
            : '—',
        ]);

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('Execution History — Successful', 14, y);
      y += 6;

      if (successRows.length === 0) successRows.push(['No successful executions', '', '', '']);

      autoTable(doc, {
        startY: y,
        head: [['User', 'Language', 'Exec Time', 'Date & Time']],
        body: successRows,
        headStyles: { fillColor: [5, 150, 105], textColor: 255, fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 9, textColor: [15, 23, 42] },
        alternateRowStyles: { fillColor: [236, 253, 245] },
        margin: { left: 14, right: 14 },
      });
      y = doc.lastAutoTable.finalY + 10;

      // ── EXECUTION HISTORY — ERRORS ───────────────────────────────────────
      const errorRows = executions
        .filter((e) => e.status === 'error' || e.status === 'timeout')
        .slice(0, 100)
        .map((item) => [
          item.username || 'Unknown',
          item.language || '—',
          STATUS_LABELS[item.status] || item.status || '—',
          item.createdAt
            ? new Date(item.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
            : '—',
        ]);

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('Execution History — Errors & Timeouts', 14, y);
      y += 6;

      if (errorRows.length === 0) errorRows.push(['No errors recorded', '', '', '']);

      autoTable(doc, {
        startY: y,
        head: [['User', 'Language', 'Status', 'Date & Time']],
        body: errorRows,
        headStyles: { fillColor: [220, 38, 38], textColor: 255, fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 9, textColor: [15, 23, 42] },
        alternateRowStyles: { fillColor: [254, 242, 242] },
        margin: { left: 14, right: 14 },
      });
      y = doc.lastAutoTable.finalY + 10;

      // ── GIT BLAME ────────────────────────────────────────────────────────
      if (blameData && blameData.length > 0) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text('Git Blame Information', 14, y);
        y += 6;

        autoTable(doc, {
          startY: y,
          head: [['Line #', 'Author', 'Last Modified']],
          body: blameData.slice(0, 200).map((b) => [
            String(b.lineNumber || '—'),
            b.userName || b.author || 'Unknown',
            b.timestamp
              ? new Date(b.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
              : '—',
          ]),
          headStyles: { fillColor: [2, 132, 199], textColor: 255, fontStyle: 'bold', fontSize: 9 },
          bodyStyles: { fontSize: 9, textColor: [15, 23, 42] },
          alternateRowStyles: { fillColor: [241, 245, 249] },
          margin: { left: 14, right: 14 },
        });
      }

      // ── FOOTER ───────────────────────────────────────────────────────────
      const totalPages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.setFont('helvetica', 'normal');
        doc.text(
          `CollabCode Analytics  •  Page ${i} of ${totalPages}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 8,
          { align: 'center' }
        );
      }

      const safeProjectName = projectName.replace(/[^a-z0-9_-]/gi, '_').substring(0, 40);
      const dateTag = now.toISOString().slice(0, 10);
      doc.save(`${safeProjectName}_analytics_${dateTag}.pdf`);
    } catch (pdfError) {
      console.error('PDF export failed:', pdfError);
    } finally {
      setExportingPdf(false);
    }
  };

  const fetchExecutions = useCallback(async () => {
    if (!projectId) return;

    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/executions`, {
        params: {
          projectId,
          userId: filters.user || undefined,
          language: filters.language || undefined,
          status: filters.status || undefined,
          search: filters.search || undefined,
          limit: 150,
        },
        headers: authStorage.getAuthHeaders(),
      });

      setExecutions(response.data?.items || []);
      setError('');
    } catch (fetchError) {
      setError(fetchError?.response?.data?.error || 'Failed to fetch execution history');
    } finally {
      setLoading(false);
    }
  }, [filters.language, filters.search, filters.status, filters.user, projectId]);

  useEffect(() => {
    fetchExecutions();
  }, [fetchExecutions]);

  useEffect(() => {
    if (!socket) return;

    const onRunning = (event) => {
      setExecutions((prev) => {
        const runningEntry = {
          id: `running-${Date.now()}`,
          executionId: `running-${Date.now()}`,
          username: event?.userName || 'Unknown',
          language: event?.language || 'javascript',
          status: 'running',
          executionTime: 0,
          createdAt: event?.timestamp || new Date().toISOString(),
          output: '',
          error: '',
          logs: '',
        };

        return [runningEntry, ...prev].slice(0, 200);
      });
    };

    const onRecordCreated = (entry) => {
      if (!entry) return;

      setExecutions((prev) => {
        const next = prev.filter((item) => {
          if (item.status !== 'running') return true;
          const sameUser = String(item.username || '') === String(entry.username || '');
          const sameLang = String(item.language || '') === String(entry.language || '');
          return !(sameUser && sameLang);
        });

        return [entry, ...next].slice(0, 200);
      });
    };

    socket.on('code-executing', onRunning);
    socket.on('execution-record-created', onRecordCreated);

    return () => {
      socket.off('code-executing', onRunning);
      socket.off('execution-record-created', onRecordCreated);
    };
  }, [socket]);

  const stats = useMemo(() => {
    const completed = executions.filter((item) => item.status !== 'running');
    const totalRuns = completed.length;
    const successfulRuns = completed.filter((item) => item.status === 'success').length;
    const failedRuns = completed.filter((item) => item.status === 'error' || item.status === 'timeout').length;
    const runningRuns = executions.filter((item) => item.status === 'running').length;
    const successRate = totalRuns ? Math.round((successfulRuns / totalRuns) * 100) : 0;
    const failureRate = totalRuns ? Math.round((failedRuns / totalRuns) * 100) : 0;

    return {
      totalRuns,
      successfulRuns,
      failedRuns,
      runningRuns,
      successRate,
      failureRate,
    };
  }, [executions]);

  const userOptions = useMemo(() => {
    const users = new Set();
    (allUsersData || []).forEach((item) => users.add(item.userId));
    executions.forEach((item) => {
      if (item.userId) users.add(item.userId);
    });

    return Array.from(users)
      .map((userId) => {
        const fromTeam = (allUsersData || []).find((item) => String(item.userId || '') === String(userId));
        const fromExecution = executions.find((item) => String(item.userId || '') === String(userId));
        return {
          id: userId,
          name: fromTeam?.userName || fromExecution?.username || 'Unknown',
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allUsersData, executions]);

  const languageOptions = useMemo(() => {
    const set = new Set();
    executions.forEach((item) => {
      if (item.language) set.add(item.language);
    });
    return Array.from(set).sort();
  }, [executions]);

  const pieData = useMemo(
    () => [
      { name: 'Success', value: stats.successfulRuns },
      { name: 'Failure', value: stats.failedRuns },
    ],
    [stats.failedRuns, stats.successfulRuns]
  );

  const lineData = useMemo(() => {
    const buckets = new Map();
    executions
      .filter((item) => item.status !== 'running')
      .forEach((item) => {
        const timestamp = new Date(item.createdAt).getTime();
        if (Number.isNaN(timestamp)) return;
        const bucketMs = 5 * 60 * 1000;
        const bucketStart = Math.floor(timestamp / bucketMs) * bucketMs;
        buckets.set(bucketStart, (buckets.get(bucketStart) || 0) + 1);
      });

    return Array.from(buckets.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([ts, count]) => ({
        ts,
        time: new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        count,
      }))
      .slice(-18);
  }, [executions]);

  const openOutput = async (entry) => {
    const entryId = entry.executionId || entry.id;
    if (!entryId) return;

    try {
      setOutputLoading(true);
      const response = await axios.get(`${API_URL}/executions/${entryId}`, {
        headers: authStorage.getAuthHeaders(),
      });
      setSelectedExecution(response.data?.execution || null);
    } catch (detailError) {
      setError(detailError?.response?.data?.error || 'Failed to load execution output');
    } finally {
      setOutputLoading(false);
    }
  };

  const deleteExecution = async (entry) => {
    const entryId = entry.executionId || entry.id;
    if (!entryId) return;
    if (!window.confirm('Delete this execution record?')) return;

    try {
      setDeletingExecutionId(String(entryId));
      await axios.delete(`${API_URL}/executions/${entryId}`, {
        headers: authStorage.getAuthHeaders(),
      });

      setExecutions((prev) => prev.filter((item) => String(item.executionId || item.id) !== String(entryId)));
      if (String(selectedExecution?.executionId || selectedExecution?.id) === String(entryId)) {
        setSelectedExecution(null);
      }
    } catch (deleteError) {
      setError(deleteError?.response?.data?.error || 'Failed to delete execution record');
    } finally {
      setDeletingExecutionId('');
    }
  };

  const clearExecutionHistory = async () => {
    if (!projectId) return;
    if (!window.confirm('Clear execution history for this project?')) return;

    try {
      setClearingHistory(true);
      await axios.delete(`${API_URL}/executions`, {
        params: { projectId },
        headers: authStorage.getAuthHeaders(),
      });
      setExecutions([]);
      setSelectedExecution(null);
    } catch (clearError) {
      setError(clearError?.response?.data?.error || 'Failed to clear execution history');
    } finally {
      setClearingHistory(false);
    }
  };

  const isSuccessfulExecution = String(selectedExecution?.status || '').toLowerCase() === 'success';
  const displayStdout = isSuccessfulExecution
    ? (selectedExecution?.output || '[empty]')
    : 'Code have error';
  const displayStderr = isSuccessfulExecution
    ? 'No error'
    : (selectedExecution?.error || selectedExecution?.output || '[empty]');

  return (
    <div className="space-y-4 text-slate-100">
      {/* Header row with title and Export PDF button */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-100">Analytics</p>
        <button
          onClick={exportToPdf}
          disabled={exportingPdf}
          title="Export full analytics report as PDF"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-cyan-600/50 bg-cyan-900/30 text-cyan-300 hover:bg-cyan-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Download size={13} />
          {exportingPdf ? 'Exporting…' : 'Export PDF'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatsCard label="Total Runs" value={stats.totalRuns} accent="text-cyan-300" icon={<PlayCircle size={16} />} />
        <StatsCard label="Success Rate" value={`${stats.successRate}%`} accent="text-emerald-300" icon={<BarChart3 size={16} />} />
        <StatsCard label="Failure Rate" value={`${stats.failureRate}%`} accent="text-rose-300" icon={<BarChart3 size={16} />} />
        <StatsCard label="Running" value={stats.runningRuns} accent="text-amber-300" icon={<PlayCircle size={16} />} />
      </div>

      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
        <p className="text-xs text-slate-300 mb-2">Recent Team Activity</p>
        {!!activityFeed.length && (
          <div className="space-y-1.5 max-h-32 overflow-auto pr-1">
            {activityFeed.slice(0, 6).map((item, index) => (
              <div key={`${item.userName}-${item.timestamp}-${index}`} className="flex justify-between items-center text-xs">
                <span className="text-slate-300">{item.userName || 'Unknown'} ran {item.language || 'code'}</span>
                <span className={item.status === 'success' ? 'text-emerald-300' : 'text-rose-300'}>
                  {STATUS_LABELS[item.status] || item.status}
                </span>
              </div>
            ))}
          </div>
        )}
        {!activityFeed.length && (
          <p className="text-xs text-slate-500">No recent activity yet. Run code to see live events here.</p>
        )}
      </div>

      <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-3">
        <div className="flex items-center gap-2 text-sm text-slate-300 mb-3">
          <Filter size={14} />
          Filters & Search
        </div>
        <div className="grid grid-cols-1 gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={filters.search}
              onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
              placeholder="Search execution ID or username"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <select
            value={filters.user}
            onChange={(event) => setFilters((prev) => ({ ...prev, user: event.target.value }))}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
          >
            <option value="">All Users</option>
            {userOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-2">
            <select
              value={filters.language}
              onChange={(event) => setFilters((prev) => ({ ...prev, language: event.target.value }))}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
            >
              <option value="">All Languages</option>
              {languageOptions.map((language) => (
                <option key={language} value={language}>
                  {language}
                </option>
              ))}
            </select>

            <select
              value={filters.status}
              onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
            >
              <option value="">All Statuses</option>
              <option value="success">Success</option>
              <option value="error">Error</option>
              <option value="timeout">Timeout</option>
              <option value="running">Running</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-4">
          <p className="text-xs text-slate-300 mb-4 font-semibold">Success vs Failure</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie 
                data={pieData} 
                dataKey="value" 
                cx="50%" 
                cy="50%" 
                outerRadius={70}
                innerRadius={0}
                label={({ name, value }) => `${name}: ${value}`}
                labelLine={false}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`${entry.name}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #22d3ee', borderRadius: 8, color: '#f8fafc', padding: '8px 12px' }}
                labelStyle={{ color: '#f8fafc', fontSize: 12, fontWeight: 500 }}
                itemStyle={{ color: '#f8fafc', fontSize: 12 }}
                formatter={(value) => [value, 'Count']}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-3">
          <p className="text-xs text-slate-300 mb-2">Execution Count Over Time</p>
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart data={lineData} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="executionCountGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#22d3ee" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="time" stroke="#94a3b8" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} allowDecimals={false} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 10, color: '#f8fafc' }}
                labelStyle={{ color: '#f8fafc' }}
                itemStyle={{ color: '#f8fafc' }}
              />
              <Area type="monotone" dataKey="count" stroke="#22d3ee" strokeWidth={2.4} fill="url(#executionCountGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-3">
        <div className="flex items-center justify-between gap-3 mb-2">
          <p className="text-sm text-slate-100 font-semibold">Execution History</p>
          <button
            onClick={clearExecutionHistory}
            disabled={clearingHistory || loading || executions.length === 0}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-md border border-rose-600/50 bg-rose-900/30 text-rose-200 hover:bg-rose-900/50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 size={13} />
            {clearingHistory ? 'Clearing...' : 'Clear All'}
          </button>
        </div>
        {loading && <p className="text-xs text-slate-400">Loading execution history...</p>}
        {error && <p className="text-xs text-rose-300">{error}</p>}

        {!loading && !error && (
          <div className="space-y-2 max-h-96 overflow-auto pr-1">
            {executions.map((item) => (
              <div key={toKey(item)} className="group bg-slate-900/40 border border-slate-700/50 hover:border-slate-600 rounded-lg p-3 transition-all duration-200 hover:bg-slate-900/60">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-100 font-semibold truncate">{item.username}</p>
                    <p className="text-xs text-slate-500 mt-1">{item.language} • {new Date(item.createdAt).toLocaleTimeString()}</p>
                  </div>
                  <span className={`text-[10px] px-2.5 py-1.5 rounded-full border font-medium whitespace-nowrap ${STATUS_COLORS[item.status] || STATUS_COLORS.error}`}>
                    {STATUS_LABELS[item.status] || item.status}
                  </span>
                </div>

                <div className="mt-2 flex items-center gap-4 text-xs text-slate-400 border-t border-slate-700/50 pt-2.5">
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500">Exec Time:</span>
                    <span className="text-slate-200 font-mono">{formatDuration(item.executionTime)}</span>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <button
                    onClick={() => openOutput(item)}
                    disabled={item.status === 'running' || outputLoading}
                    className="flex-1 px-3 py-1.5 text-xs rounded-md bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-colors"
                  >
                    View Output
                  </button>
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      onClick={() => deleteExecution(item)}
                      disabled={deletingExecutionId === String(item.executionId || item.id) || item.status === 'running'}
                      title={deletingExecutionId === String(item.executionId || item.id) ? 'Deleting...' : 'Delete execution'}
                      className="p-2 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-900/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {!executions.length && <p className="text-xs text-slate-500">No executions found for current filters.</p>}
          </div>
        )}
      </div>

      {selectedExecution && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-slate-950 border border-slate-700 rounded-xl overflow-hidden shadow-2xl">
            <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400">Execution #{selectedExecution.executionId || selectedExecution.id}</p>
                <p className="text-sm font-semibold text-slate-100">
                  {selectedExecution.username} • {selectedExecution.language}
                </p>
              </div>
              <button onClick={() => setSelectedExecution(null)} className="text-slate-400 hover:text-slate-100">
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-4 max-h-[75vh] overflow-auto">
              <div className="grid grid-cols-1 gap-3">
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                  <p className="text-[11px] uppercase tracking-widest text-slate-500 mb-1">Files Used</p>
                  <div className="flex flex-wrap gap-2">
                    {(selectedExecution.files || []).length > 0 ? (
                      selectedExecution.files.map((file) => (
                        <span
                          key={file.filename}
                          className="inline-flex items-center rounded-full border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-200"
                        >
                          {file.filename}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500">No execution files recorded</span>
                    )}
                  </div>
                </div>
              </div>

              <TerminalBlock title="Standard Output (stdout)" value={displayStdout} tone="text-emerald-200" />
              <TerminalBlock title="Error Output (stderr)" value={displayStderr} tone="text-rose-200" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatsCard({ label, value, accent, icon }) {
  return (
    <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-3">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>{label}</span>
        <span>{icon}</span>
      </div>
      <p className={`mt-2 text-xl font-bold ${accent}`}>{value}</p>
    </div>
  );
}

function TerminalBlock({ title, value, tone }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-widest text-slate-400 mb-2">{title}</p>
      <pre className={`bg-black border border-slate-800 rounded-lg p-3 text-xs font-mono whitespace-pre-wrap break-words min-h-20 ${tone}`}>
        {value || '[empty]'}
      </pre>
    </div>
  );
}