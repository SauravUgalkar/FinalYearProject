import React, { useRef, useEffect, useState } from 'react';
import { Mic, MicOff, Phone, PhoneOff } from 'lucide-react';
import Peer from 'peerjs';

export default function VoiceChat() {
  const [isActive, setIsActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [peers, setPeers] = useState([]);
  const audioRef = useRef(null);
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);

  useEffect(() => {
    // Initialize PeerJS
    const peer = new Peer();
    peerRef.current = peer;

    peer.on('call', (call) => {
      // Answer incoming call
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          localStreamRef.current = stream;
          call.answer(stream);
          
          call.on('stream', (remoteStream) => {
            if (audioRef.current) {
              audioRef.current.srcObject = remoteStream;
            }
          });
        });
    });

    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      peer.destroy();
    };
  }, []);

  const handleStartCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      setIsActive(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  };

  const handleEndCall = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    setIsActive(false);
    setIsMuted(false);
  };

  const handleToggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  return (
    <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
      <h3 className="text-white font-bold mb-4">Voice Chat</h3>

      <audio ref={audioRef} autoPlay playsInline />

      <div className="flex gap-2">
        {!isActive ? (
          <button
            onClick={handleStartCall}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition flex-1"
          >
            <Phone size={16} /> Start Call
          </button>
        ) : (
          <>
            <button
              onClick={handleToggleMute}
              className={`flex items-center gap-2 px-4 py-2 rounded transition flex-1 ${
                isMuted
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              } text-white`}
            >
              {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
              {isMuted ? 'Unmute' : 'Mute'}
            </button>
            <button
              onClick={handleEndCall}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition flex-1"
            >
              <PhoneOff size={16} /> End Call
            </button>
          </>
        )}
      </div>

      <div className="mt-4 text-sm text-gray-400">
        {isActive ? (
          <p>✓ Call active {isMuted ? '(muted)' : '(unmuted)'}</p>
        ) : (
          <p>Start a call to collaborate with your team</p>
        )}
      </div>
    </div>
  );
}
