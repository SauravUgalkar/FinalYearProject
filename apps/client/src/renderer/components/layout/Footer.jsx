import React from 'react';
import { Link } from 'react-router-dom';
import { Github, Mail } from 'lucide-react';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-20 border-t border-white/10 bg-slate-950/80">
      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-10 sm:px-8 lg:grid-cols-2 lg:px-10">
        <div>
          <Link to="/" className="inline-flex items-center gap-3">
            <img src="/logo.png" alt="CollabCode" className="h-10 w-10 rounded-full border border-white/20 object-cover" />
            <span className="text-lg font-semibold text-white">CollabCode</span>
          </Link>
          <p className="mt-4 max-w-md text-sm leading-7 text-slate-300">
            A modern collaborative workspace for students, teachers, and developers to code, review, learn and communicate together.
          </p>
        </div>

        <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
          <Link to="/docs" className="transition hover:text-white">Docs</Link>
          <a href="/#features" className="transition hover:text-white">Features</a>
          <a href="https://github.com" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 transition hover:text-white">
            <Github size={14} /> GitHub
          </a>
          <a href="mailto:support@collabcode.app" className="inline-flex items-center gap-2 transition hover:text-white">
            <Mail size={14} /> Contact
          </a>
        </div>
      </div>
      <div className="border-t border-white/10 px-6 py-4 text-center text-xs text-slate-400 sm:px-8 lg:px-10">
        Copyright {year} CollabCode. All rights reserved.
      </div>
    </footer>
  );
}
