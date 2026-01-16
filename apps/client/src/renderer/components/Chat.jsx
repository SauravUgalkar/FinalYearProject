import React, { useState, useRef, useEffect } from 'react';
import { useSocket } from '../hooks/useSocket';
import { useAuthContext } from '../hooks/useAuth';
import { Send } from 'lucide-react';

export default function Chat({ roomId }) {
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
      <h3 className="text-white font-bold p-3 border-b border-gray-700">Chat</h3>

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
