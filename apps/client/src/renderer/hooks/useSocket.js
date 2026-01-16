import { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';

let socketInstance = null;
let isInitialized = false;

export function useSocket() {
  const [socket, setSocket] = useState(() => {
    // Initialize socket immediately in state initializer
    if (!socketInstance && !isInitialized) {
      isInitialized = true;
      socketInstance = io('http://localhost:5000', {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5
      });
      console.log('[useSocket] Socket instance created:', socketInstance.id);
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
