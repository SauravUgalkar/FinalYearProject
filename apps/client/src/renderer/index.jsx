import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Suppress ResizeObserver errors from Monaco Editor (non-critical)
const originalError = console.error;
console.error = function(...args) {
  if (
    args[0]?.message?.includes?.('ResizeObserver loop completed') ||
    args[0]?.includes?.('ResizeObserver loop completed') ||
    (typeof args[0] === 'string' && args[0].includes('ResizeObserver'))
  ) {
    return; // Silently ignore ResizeObserver errors
  }
  originalError.apply(console, args);
};

// Also suppress in window error handler
if (typeof window !== 'undefined') {
  const originalWindowError = window.onerror;
  window.onerror = function(msg, url, lineNo, columnNo, error) {
    if (msg?.includes?.('ResizeObserver')) {
      return true; // Suppress
    }
    if (originalWindowError) {
      return originalWindowError(msg, url, lineNo, columnNo, error);
    }
  };

  // Suppress unhandled promise rejections for ResizeObserver
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason?.message?.includes('ResizeObserver')) {
      event.preventDefault(); // Suppress
    }
  });
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
