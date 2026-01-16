import React, { useState, useEffect } from 'react';
import { Play, Trash2, Download, Clock, Calendar } from 'lucide-react';
import axios from 'axios';

const Recordings = ({ projectId }) => {
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecordings();
  }, [projectId]);

  const fetchRecordings = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`http://localhost:5000/api/recordings/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('Recordings response:', response.data);
      
      // Format recordings for display
      const formattedRecordings = (response.data || []).map(rec => {
        const duration = rec.duration ? formatDuration(rec.duration) : '0:00';
        const size = rec.size ? formatSize(rec.size) : '0 MB';
        const recordingDate = rec.startTime ? new Date(rec.startTime).toLocaleDateString() : 'Unknown';
        return {
          ...rec,
          displayDuration: duration,
          displaySize: size,
          displayDate: recordingDate
        };
      });
      
      console.log('Formatted recordings:', formattedRecordings);
      setRecordings(formattedRecordings);
    } catch (error) {
      console.error('Failed to fetch recordings:', error);
      // Empty state - no recordings
      setRecordings([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${minutes}:${String(secs).padStart(2, '0')}`;
  };

  const formatSize = (bytes) => {
    if (bytes === 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const handlePlay = (recordingId) => {
    console.log('Playing recording:', recordingId);
    // TODO: Implement video playback
  };

  const handleDownload = (recordingId) => {
    console.log('Downloading recording:', recordingId);
    // TODO: Implement download
  };

  const handleDelete = async (recordingId) => {
    if (!confirm('Are you sure you want to delete this recording?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`http://localhost:5000/api/recordings/${projectId}/recordings/${recordingId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Recording deleted:', recordingId);
      setRecordings(recordings.filter(r => r.id !== recordingId));
    } catch (error) {
      console.error('Failed to delete recording:', error);
      console.error('Error details:', error.response?.data);
      alert('Failed to delete recording: ' + (error.response?.data?.error || error.message));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400">Loading recordings...</div>
      </div>
    );
  }

  if (recordings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400">
        <Calendar className="w-16 h-16 mb-4 opacity-50" />
        <p className="text-lg">No recordings yet</p>
        <p className="text-sm mt-2">Start recording sessions to see them here</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-gray-900">
      <div className="p-4 border-b border-gray-700 flex-shrink-0">
        <h3 className="text-lg font-semibold text-white">Session Recordings</h3>
        <p className="text-sm text-gray-400 mt-1">{recordings.length} recordings</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {recordings.map((recording) => (
          <div
            key={recording.id}
            className="bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition-colors border border-gray-700 flex-shrink-0"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h4 className="text-white font-medium mb-2">{recording.title}</h4>
                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400">
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>{recording.displayDuration}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    <span>{recording.displayDate}</span>
                  </div>
                  <span>{recording.displaySize}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handlePlay(recording.id)}
                className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs whitespace-nowrap"
              >
                <Play className="w-3 h-3" />
                Play
              </button>
              <button
                onClick={() => handleDownload(recording.id)}
                className="flex items-center gap-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs whitespace-nowrap"
              >
                <Download className="w-3 h-3" />
                Download
              </button>
              <button
                onClick={() => handleDelete(recording.id)}
                className="flex items-center gap-1 px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs whitespace-nowrap ml-auto"
              >
                <Trash2 className="w-3 h-3" />
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Recordings;
