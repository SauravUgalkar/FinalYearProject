import React, { useEffect, useRef } from 'react';

export default function Console({ output, input, isExecuting }) {
  const consoleRef = useRef(null);

  // Auto-scroll to bottom when new output arrives
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [output, input, isExecuting]);

  // Check if output contains an error
  const isError = output && (output.toLowerCase().includes('error') || output.toLowerCase().includes('traceback'));
  
  return (
    <div 
      ref={consoleRef}
      className={`font-mono text-xs w-full h-full overflow-auto bg-gray-950 rounded border border-gray-800 p-2 flex flex-col`}
    >
      {!output && !isExecuting && (
        <p className="text-gray-500">$ Ready to execute code...</p>
      )}
      
      {!output && isExecuting && (
        <p className="text-yellow-400">$ Running...</p>
      )}

      {output && (
        <pre className={`whitespace-pre-wrap m-0 ${
          isError ? 'text-red-400' : 'text-gray-100'
        }`}>
          {output}
        </pre>
      )}

      {isExecuting && output && (
        <div className="text-yellow-400 mt-3">
          <span className="inline-block animate-pulse">▌</span>
        </div>
      )}
    </div>
  );
}
