import { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';
import { API_BASE_URL } from '../config/runtime';
import { authStorage } from '../services/authStorage';

let socketInstance = null;
let isInitialized = false;

export function useSocket() {
  const [socket, setSocket] = useState(() => {
    // Initialize socket immediately in state initializer
    if (!socketInstance && !isInitialized) {
      isInitialized = true;
      
      // Get user data from sessionStorage for socket handshake
      const token = authStorage.getToken();
      const user = authStorage.getUser();
      
      socketInstance = io(API_BASE_URL, {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        // Keep trying to reconnect for long-running sessions.
        reconnectionAttempts: Infinity,
        timeout: 20000,
        auth: {
          token: token,
          userId: user?.id || user?._id,
          userName: user?.name,
          userEmail: user?.email
        }
      });

      const refreshSocketAuth = () => {
        const refreshedToken = authStorage.getToken();
        const refreshedUser = authStorage.getUser();
        socketInstance.auth = {
          token: refreshedToken,
          userId: refreshedUser?.id || refreshedUser?._id,
          userName: refreshedUser?.name,
          userEmail: refreshedUser?.email,
        };
      };

      socketInstance.on('reconnect_attempt', refreshSocketAuth);
      socketInstance.on('connect_error', refreshSocketAuth);
      console.log('[useSocket] Socket instance created:', socketInstance.id, 'User:', user?.name);
    }
    return socketInstance;
  });

  useEffect(() => {
    // Ensure socket is set
    if (socketInstance) {
      setSocket(socketInstance);
    }

    // Handle reconnection
    const handleReconnect = () => {
      console.log('[useSocket] Socket reconnected with ID:', socketInstance.id);
      setSocket(socketInstance);
    };

    if (socketInstance) {
      socketInstance.on('connect', handleReconnect);
    }

    return () => {
      if (socketInstance) {
        socketInstance.off('connect', handleReconnect);
      }
    };
  }, []);

  return { socket };
}

// Helper function to disconnect and reset socket (called on logout)
export function disconnectSocket() {
  if (socketInstance) {
    console.log('[useSocket] Disconnecting socket:', socketInstance.id);
    socketInstance.disconnect();
    socketInstance = null;
    isInitialized = false;
  }
}
