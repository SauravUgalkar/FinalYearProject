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

    socket.on('chat-message-received', (message) => {
      console.log('Chat: received message', message);
      setMessages(prev => [...prev, message]);
    });

    return () => {
      socket.off('chat-message-received');
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

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-700">
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

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 && (
          <p className="text-gray-500 text-sm text-center py-4">No messages yet</p>
        )}
        {messages.map((msg, idx) => (
          <div key={idx} className="text-sm">
            <p className="text-blue-400 font-medium">{msg.userName || 'Anonymous'}</p>
            <p className="text-gray-300">{msg.message}</p>
            <p className="text-gray-500 text-xs mt-1">
              {new Date(msg.timestamp).toLocaleTimeString()}
            </p>
          </div>
        ))}
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
