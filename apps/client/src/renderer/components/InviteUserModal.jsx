import React, { useState } from 'react';
import axios from 'axios';
import { X, UserPlus, AlertCircle, CheckCircle, Loader } from 'lucide-react';

/**
 * InviteUserModal Component
 * 
 * Admin-only modal to invite users to the room
 * - Validates user exists in database before sending invite
 * - Shows clear error if user not found
 * - Sends real-time notification via Socket.io
 */
export default function InviteUserModal({ isOpen, onClose, roomId, roomName, socket }) {
  const [userIdentifier, setUserIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleInvite = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);

    try {
      const token = sessionStorage.getItem('token');
      const currentUser = JSON.parse(sessionStorage.getItem('user') || '{}');

      // Send invite via API
      const response = await axios.post(
        'http://localhost:5000/api/invites/send',
        {
          roomId,
          userIdentifier: userIdentifier.trim()
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      // Success - send Socket.io notification
      if (socket && response.data.invite) {
        socket.emit('invite-user-to-room', {
          inviteId: response.data.invite.id,
          roomId,
          userId: response.data.invite.userId,
          roomName: roomName || 'Collaborative Room',
          invitedBy: currentUser.name,
          expiresAt: response.data.invite.expiresAt
        });
      }

      setSuccess(true);
      setUserIdentifier('');

      // Auto-close after 2 seconds
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 2000);

    } catch (err) {
      console.error('Invite error:', err);

      if (err.response?.status === 404) {
        setError('❌ User not found in database');
      } else if (err.response?.status === 400) {
        setError(err.response.data.error || 'Invalid request');
      } else {
        setError(err.response?.data?.error || 'Failed to send invite');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <UserPlus size={24} />
            Invite User to Room
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition"
          >
            <X size={24} />
          </button>
        </div>

        <div className="mb-4 p-3 bg-gray-800 rounded-lg">
          <p className="text-sm text-gray-400">Room:</p>
          <p className="text-white font-semibold">{roomName || 'Untitled Room'}</p>
          <p className="text-xs text-gray-500 mt-1">
            Room ID: {roomId}
          </p>
        </div>

        <form onSubmit={handleInvite} className="space-y-4">
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">
              User Email or Username
            </label>
            <input
              type="text"
              value={userIdentifier}
              onChange={(e) => setUserIdentifier(e.target.value)}
              placeholder="Enter email or username"
              className="w-full px-4 py-3 bg-gray-800 text-white rounded-lg border border-gray-700 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-900"
              required
              disabled={loading || success}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-900 bg-opacity-50 border border-red-700 rounded-lg flex items-start gap-2">
              <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={18} />
              <p className="text-red-200 text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-900 bg-opacity-50 border border-green-700 rounded-lg flex items-start gap-2">
              <CheckCircle className="text-green-400 flex-shrink-0 mt-0.5" size={18} />
              <p className="text-green-200 text-sm">Invite sent successfully!</p>
            </div>
          )}

          <div className="bg-blue-900 bg-opacity-30 border border-blue-700 rounded-lg p-3">
            <p className="text-blue-200 text-xs leading-relaxed">
              <strong>Security Note:</strong> Only users registered in the database can be invited. 
              After accepting, they must enter the Room ID to join.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || success || !userIdentifier.trim()}
            className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader className="animate-spin" size={18} />
                Sending Invite...
              </>
            ) : success ? (
              <>
                <CheckCircle size={18} />
                Sent!
              </>
            ) : (
              <>
                <UserPlus size={18} />
                Send Invite
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
