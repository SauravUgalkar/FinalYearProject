import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useSocket } from '../hooks/useSocket';
import { useAuthContext } from '../hooks/useAuth';
import { Send } from 'lucide-react';

export default function Chat({ roomId, onlineUsers = [] }) {
  const { socket } = useSocket();
  const { user } = useAuthContext();
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  useEffect(() => {
    if (!socket || !roomId) {
      console.warn('Chat: socket or roomId missing', { 
        socket: !!socket, 
        socketId: socket?.id, 
        roomId,
        socketConnected: socket?.connected
      });
      return;
    }

    console.log('Chat: setting up listener for room', roomId, 'with socket', socket.id);

    // Fetch persisted chat history on mount
    const fetchHistory = async () => {
      try {
        const token = sessionStorage.getItem('token');
        const res = await axios.get(`http://localhost:5000/api/chat/project/${roomId}` , {
          headers: { Authorization: `Bearer ${token}` }
        });
        setMessages(res.data.chatHistory || []);
      } catch (err) {
        console.warn('Chat: failed to fetch history', err.message);
      }
    };
    fetchHistory();

    // Listen for new messages
    socket.on('chat-message-received', (message) => {
      console.log('Chat: received message', message);
      setMessages(prev => [...prev, message]);
    });

    // Listen for chat cleared event
    socket.on('chat-cleared', (data) => {
      console.log('Chat: received chat-cleared event', data);
      setMessages([]);
      // Optional: Show notification
      console.log('Chat: All messages cleared by another user');
    });

    return () => {
      socket.off('chat-message-received');
      socket.off('chat-cleared');
    };
  }, [socket, roomId]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!messageText.trim() || !socket || !roomId || !user) {
      console.warn('Chat: cannot send message', {
        text: !!messageText.trim(),
        socket: !!socket,
        roomId,
        user: !!user
      });
      return;
    }

    console.log('Chat: sending message to room', roomId);

    socket.emit('chat-message', {
      roomId,
      userId: user.id,
      userName: user.name,
      message: messageText,
      timestamp: new Date()
    });

    setMessageText('');
  };

  const handleClearAllMessages = async () => {
    if (!confirm('Clear all chat messages permanently? This cannot be undone.')) {
      return;
    }

    console.log('[Chat Client] Starting clear all messages...');
    console.log('[Chat Client] Room ID:', roomId);

    try {
      const token = sessionStorage.getItem('token');
      
      if (!token) {
        alert('Authentication token not found. Please login again.');
        return;
      }

      if (!roomId) {
        alert('Project ID not found. Please refresh the page.');
        return;
      }

      console.log('[Chat Client] Sending DELETE request to:', `http://localhost:5000/api/chat/project/${roomId}`);
      
      const response = await axios.delete(`http://localhost:5000/api/chat/project/${roomId}`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('[Chat Client] Delete response:', response.data);
      setMessages([]);
      alert('Chat cleared successfully!');
      console.log('[Chat Client] All messages cleared permanently');
    } catch (err) {
      console.error('[Chat Client] Failed to clear messages:', err);
      console.error('[Chat Client] Error response:', err.response);
      console.error('[Chat Client] Error message:', err.message);
      
      let errorMessage = 'Failed to clear messages';
      
      if (err.response) {
        // Server responded with error
        errorMessage = err.response.data?.error || `Server error: ${err.response.status}`;
        console.error('[Chat Client] Server error:', err.response.status, err.response.data);
      } else if (err.request) {
        // Request made but no response
        errorMessage = 'No response from server. Is the server running?';
        console.error('[Chat Client] No response received');
      } else {
        // Error in request setup
        errorMessage = err.message;
        console.error('[Chat Client] Request setup error:', err.message);
      }
      
      alert(errorMessage);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-700 flex items-center justify-between">
        <div>
          <h3 className="text-white font-bold mb-2">Chat</h3>
          {onlineUsers.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {onlineUsers.slice(0, 5).map((u, idx) => (
                  <div
                    key={idx}
                    className="w-6 h-6 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 border-2 border-gray-900 flex items-center justify-center text-white text-xs font-bold"
                    title={u.userName}
                  >
                    {u.userName?.[0]?.toUpperCase() || '?'}
                  </div>
                ))}
              </div>
              <span className="text-xs text-gray-400">{onlineUsers.length} online</span>
            </div>
          )}
        </div>
        {messages.length > 0 && (
          <button
            onClick={handleClearAllMessages}
            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition"
            title="Clear all messages permanently"
          >
            Clear All
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-gray-500 text-sm text-center py-4">No messages yet</p>
        )}
        {messages.map((msg, idx) => {
          const messageTime = new Date(msg.timestamp);
          const isToday = messageTime.toDateString() === new Date().toDateString();
          const timeStr = isToday 
            ? messageTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : messageTime.toLocaleDateString() + ' ' + messageTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          
          return (
            <div key={idx} className="bg-gray-800 rounded p-2">
              <div className="flex justify-between items-start">
                <p className="text-blue-400 font-medium text-sm">{msg.userName || 'Anonymous'}</p>
                <p className="text-gray-500 text-xs">{timeStr}</p>
              </div>
              <p className="text-gray-200 text-sm mt-1 break-words">{msg.message}</p>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSendMessage} className="border-t border-gray-700 p-3 flex gap-2">
        <input
          type="text"
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 px-3 py-2 bg-gray-700 text-white rounded text-sm focus:outline-none"
        />
        <button
          type="submit"
          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
