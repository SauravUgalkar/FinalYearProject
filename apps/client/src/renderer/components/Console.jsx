import React, { useEffect, useRef } from 'react';

export default function Console({ output, compileError, runtimeError, input, isExecuting }) {
  const consoleRef = useRef(null);

  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [output, compileError, runtimeError, input, isExecuting]);

  const hasContent = output || compileError || runtimeError;

  return (
    <div
      ref={consoleRef}
      className="font-mono text-xs w-full h-full overflow-auto bg-gray-950 rounded border border-gray-800 p-2 flex flex-col gap-2"
    >
      {/* Idle / running placeholders */}
      {!hasContent && !isExecuting && (
        <p className="text-gray-500">$ Ready to execute code...</p>
      )}
      {!hasContent && isExecuting && (
        <p className="text-yellow-400">$ Running...</p>
      )}

      {/* Compilation errors — red */}
      {compileError && (
        <div>
          <p className="text-red-500 font-semibold mb-1 uppercase tracking-wide">
            ✗ Compile Error
          </p>
          <pre className="whitespace-pre-wrap text-red-400 m-0">{compileError}</pre>
        </div>
      )}

      {/* Runtime errors — orange */}
      {runtimeError && (
        <div>
          <p className="text-orange-400 font-semibold mb-1 uppercase tracking-wide">
            ✗ Runtime Error
          </p>
          <pre className="whitespace-pre-wrap text-orange-300 m-0">{runtimeError}</pre>
        </div>
      )}

      {/* Standard output — white/green */}
      {output && (
        <div>
          {(compileError || runtimeError) && (
            <p className="text-green-500 font-semibold mb-1 uppercase tracking-wide">
              ✓ Output
            </p>
          )}
          <pre className="whitespace-pre-wrap text-gray-100 m-0">{output}</pre>
        </div>
      )}

      {/* Executing cursor */}
      {isExecuting && hasContent && (
        <div className="text-yellow-400 mt-1">
          <span className="inline-block animate-pulse">▌</span>
        </div>
      )}
    </div>
  );
}

