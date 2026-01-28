import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Bell, X, Check, XCircle, Clock, Loader } from 'lucide-react';

/**
 * JoinRequestNotification Component
 * 
 * Shows pending room invites to users
 * - Displays invite details (room name, inviter, expiration)
 * - Allows accept/reject
 * - Shows Room ID input modal after acceptance
 * - Real-time updates via Socket.io
 */
export default function JoinRequestNotification({ socket }) {
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRoomIdInput, setShowRoomIdInput] = useState(false);
  const [selectedInvite, setSelectedInvite] = useState(null);
  const [roomId, setRoomId] = useState('');
  const [validationError, setValidationError] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [hasToken, setHasToken] = useState(false);

  // Fetch pending invites on mount
  useEffect(() => {
    const token = sessionStorage.getItem('token');
    setHasToken(!!token);
    if (token) {
      fetchPendingInvites();
    } else {
      setLoading(false);
    }
  }, []);

  // Listen for real-time invite notifications
  useEffect(() => {
    if (!socket) return;

    socket.on('room-invite-received', (data) => {
      console.log('[Invite] Received notification:', data);
      
      // Add new invite to the list
      setInvites(prev => [{
        _id: data.inviteId,
        roomId: { _id: data.roomId, name: data.roomName },
        invitedBy: { name: data.invitedBy },
        expiresAt: data.expiresAt,
        status: 'pending'
      }, ...prev]);

      // Auto-show panel
      setShowPanel(true);

      // Browser notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('New Room Invite', {
          body: data.message,
          icon: '/favicon.ico'
        });
      }
    });

    return () => {
      socket.off('room-invite-received');
    };
  }, [socket]);

  const togglePanel = () => {
    // Lazy-refresh invites whenever the panel is opened
    if (!showPanel && hasToken) {
      fetchPendingInvites();
    }
    setShowPanel(prev => !prev);
  };

  const fetchPendingInvites = async () => {
    try {
      const token = sessionStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await axios.get(
        'http://localhost:5000/api/invites/pending',
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setInvites(response.data.invites || []);
      if (response.data.invites && response.data.invites.length > 0) {
        setShowPanel(true);
      }
    } catch (error) {
      console.error('Error fetching invites:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (invite) => {
    try {
      const token = sessionStorage.getItem('token');

      // Accept the invite
      await axios.post(
        `http://localhost:5000/api/invites/${invite._id}/accept`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      // Notify admin via Socket.io
      if (socket) {
        socket.emit('accept-invite-notification', {
          inviteId: invite._id
        });
      }

      // Show room ID input form
      setSelectedInvite(invite);
      setShowRoomIdInput(true);

      // Remove from pending list
      setInvites(prev => prev.filter(inv => inv._id !== invite._id));

    } catch (error) {
      console.error('Error accepting invite:', error);
      alert(error.response?.data?.error || 'Failed to accept invite');
    }
  };

  const handleReject = async (inviteId) => {
    try {
      const token = sessionStorage.getItem('token');

      await axios.post(
        `http://localhost:5000/api/invites/${inviteId}/reject`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      // Remove from list
      setInvites(prev => prev.filter(inv => inv._id !== inviteId));

    } catch (error) {
      console.error('Error rejecting invite:', error);
      alert('Failed to reject invite');
    }
  };

  const handleRoomIdSubmit = async (e) => {
    e.preventDefault();
    setValidationError('');
    setIsValidating(true);

    try {
      const token = sessionStorage.getItem('token');

      // Validate room ID and join
      await axios.post(
        'http://localhost:5000/api/invites/validate-room-id',
        {
          roomId: roomId.trim(),
          inviteId: selectedInvite._id
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      // Success - notify room and redirect
      if (socket) {
        const user = JSON.parse(sessionStorage.getItem('user') || '{}');
        socket.emit('user-joined-room-notification', {
          roomId: roomId.trim(),
          userId: user.id || user._id,
          userName: user.name
        });
      }

      // Redirect to editor
      window.location.href = `/editor/${roomId.trim()}`;

    } catch (error) {
      console.error('Room ID validation error:', error);

      if (error.response?.status === 400) {
        setValidationError('❌ Invalid Room ID - Please check and try again');
      } else {
        setValidationError(error.response?.data?.error || 'Failed to join room');
      }
    } finally {
      setIsValidating(false);
    }
  };

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Room ID input modal
  if (showRoomIdInput && selectedInvite) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-full max-w-md shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Enter Room ID</h2>
            <button
              onClick={() => {
                setShowRoomIdInput(false);
                setRoomId('');
                setValidationError('');
              }}
              className="text-gray-400 hover:text-white"
            >
              <X size={24} />
            </button>
          </div>

          <div className="mb-4 p-3 bg-gray-800 rounded-lg">
            <p className="text-sm text-gray-400">Joining room:</p>
            <p className="text-white font-semibold">{selectedInvite.roomId?.name || 'Room'}</p>
          </div>

          <form onSubmit={handleRoomIdSubmit} className="space-y-4">
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">
                Room ID
              </label>
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="Enter the Room ID provided by admin"
                className="w-full px-4 py-3 bg-gray-800 text-white rounded-lg border border-gray-700 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-900"
                required
                disabled={isValidating}
              />
            </div>

            {validationError && (
              <div className="p-3 bg-red-900 bg-opacity-50 border border-red-700 rounded-lg">
                <p className="text-red-200 text-sm">{validationError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isValidating || !roomId.trim()}
              className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isValidating ? (
                <>
                  <Loader className="animate-spin" size={18} />
                  Validating...
                </>
              ) : (
                'Join Room'
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Don't show anything if no invites and not loading
  return (
    <>
      {hasToken && (
        <button
          onClick={togglePanel}
          className="fixed bottom-4 right-4 h-12 w-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg flex items-center justify-center z-40"
          title={invites.length > 0 ? `You have ${invites.length} room invite(s)` : 'Room invites'}
        >
          <div className="relative">
            <Bell size={22} />
            {invites.length > 0 && (
              <span className="absolute -top-2 -right-3 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {invites.length}
              </span>
            )}
          </div>
        </button>
      )}

      {showPanel && (
        <div className="fixed top-4 right-4 w-96 max-h-96 overflow-auto bg-gray-900 border border-gray-800 rounded-xl shadow-2xl z-40">
          <div className="p-4 border-b border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="text-blue-500" size={20} />
              <h3 className="text-white font-bold">Room Invitations ({invites.length})</h3>
            </div>
            <button
              onClick={() => setShowPanel(false)}
              className="text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-4 space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader className="animate-spin text-blue-500" size={24} />
              </div>
            ) : invites.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">No pending invitations</p>
            ) : (
              invites.map((invite) => (
                <div
                  key={invite._id}
                  className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-2"
                >
                  <div>
                    <p className="text-white font-semibold">{invite.roomId?.name || 'Room'}</p>
                    <p className="text-sm text-gray-400">
                      Invited by: {invite.invitedBy?.name || 'Admin'}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Clock size={14} />
                    <span>Expires: {new Date(invite.expiresAt).toLocaleString()}</span>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => handleAccept(invite)}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition"
                    >
                      <Check size={16} /> Accept
                    </button>
                    <button
                      onClick={() => handleReject(invite._id)}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition"
                    >
                      <XCircle size={16} /> Reject
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {invites.length > 0 && (
            <div className="p-3 border-t border-gray-800 bg-gray-950">
              <p className="text-xs text-gray-500 text-center">
                Click <strong>Accept</strong> then enter the Room ID to join
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
