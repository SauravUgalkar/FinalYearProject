import { useState, useCallback } from 'react';

export function useWebRTC() {
  const [peers, setPeers] = useState({});
  const [localStream, setLocalStream] = useState(null);

  const startLocalStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      });
      setLocalStream(stream);
      return stream;
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  }, []);

  const stopLocalStream = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
  }, [localStream]);

  return {
    peers,
    localStream,
    startLocalStream,
    stopLocalStream
  };
}
