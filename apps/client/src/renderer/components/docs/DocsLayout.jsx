import React from 'react';
import { NavLink } from 'react-router-dom';
import Header from '../layout/Header';
import Footer from '../layout/Footer';
import { docsNavItems } from './docsNav';
import { BookOpen } from 'lucide-react';

export function DocTopic({ title, what, how, points }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5 shadow-[0_10px_40px_rgba(2,6,23,0.18)]">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">What it is</p>
          <p className="mt-2 text-sm leading-7 text-slate-300">{what}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">How to use it</p>
          <p className="mt-2 text-sm leading-7 text-slate-300">{how}</p>
        </div>
      </div>
      {points?.length ? (
        <ul className="mt-4 space-y-2 text-sm leading-7 text-slate-300">
          {points.map((point) => (
            <li key={point} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export default function DocsLayout({ title, description, children }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_10%_10%,_rgba(34,211,238,0.14),_transparent_30%),radial-gradient(circle_at_90%_15%,_rgba(251,146,60,0.12),_transparent_25%),linear-gradient(180deg,_#020617_0%,_#111827_60%,_#0f172a_100%)] text-white">
      <Header />
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:gap-8 sm:px-6 sm:py-10 lg:grid-cols-[280px_1fr] lg:px-10">
        <aside>
          <div className="sticky top-24 rounded-2xl border border-white/10 bg-slate-950/60 p-4 sm:p-6 shadow-[0_16px_60px_rgba(2,6,23,0.34)] backdrop-blur">
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-lg border border-cyan-300/25 bg-cyan-300/10 p-2 text-cyan-200">
                <BookOpen size={18} />
              </div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">Documentation</p>
            </div>
            <nav className="space-y-1.5">
              {docsNavItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/docs'}
                  className={({ isActive }) =>
                    `block rounded-lg px-3.5 py-2.5 text-sm font-medium transition ${
                      isActive
                        ? 'bg-gradient-to-r from-cyan-400 to-cyan-300 text-slate-900 shadow-lg shadow-cyan-500/30'
                        : 'text-slate-300 hover:bg-white/10 hover:text-white'
                    } border ${isActive ? 'border-cyan-300/50' : 'border-transparent'}`
                  }
                >
                  {item.title}
                </NavLink>
              ))}
            </nav>
          </div>
        </aside>

        <main>
          <article className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950/80 to-slate-950/60 p-8 shadow-[0_16px_60px_rgba(2,6,23,0.34)] backdrop-blur sm:p-10">
            <header className="mb-8 border-b border-white/10 pb-8">
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{title}</h1>
              {description && <p className="mt-4 max-w-3xl text-lg text-slate-300 leading-relaxed">{description}</p>}
            </header>
            <div className="prose prose-invert max-w-none space-y-8 text-slate-200">
              {children}
            </div>
          </article>
        </main>
      </div>
      <Footer />
    </div>
  );
}
