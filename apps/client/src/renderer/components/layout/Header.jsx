import React, { useMemo, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

const navItemBase = 'rounded-full px-3 py-2 text-sm font-medium transition';
const navItemIdle = 'text-slate-300 hover:bg-white/10 hover:text-white';
const navItemActive = 'bg-white text-slate-900';

const isDocsRoute = (pathname) => pathname.startsWith('/docs');

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const links = useMemo(
    () => [
      {
        label: 'Home',
        to: '/',
        active: location.pathname === '/',
      },
      {
        label: 'Docs',
        to: '/docs',
        active: isDocsRoute(location.pathname),
      },
      {
        label: 'Features',
        to: '/features',
        active: location.pathname === '/features',
      },
      {
        label: 'Use Cases',
        to: '/use-cases',
        active: location.pathname === '/use-cases',
      },
    ],
    [location.pathname]
  );

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3 sm:px-8 lg:px-10">
        <Link to="/" className="flex items-center gap-3">
          <img src="/logo.png" alt="CollabCode" className="h-9 w-9 rounded-full border border-white/20 object-cover" />
          <span className="text-sm font-semibold tracking-wide text-white">CollabCode</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <NavLink
              key={link.label}
              to={link.to}
              className={`${navItemBase} ${link.active ? navItemActive : navItemIdle}`}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link to="/login" className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/10">
            Login
          </Link>
          <Link to="/register" className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-cyan-200">
            Register
          </Link>
        </div>

        <button
          onClick={() => setMobileOpen((value) => !value)}
          className="inline-flex rounded-xl border border-white/15 p-2 text-slate-200 md:hidden"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-white/10 bg-slate-950/95 px-6 py-4 md:hidden">
          <div className="flex flex-col gap-2">
            {links.map((link) => (
              <Link
                key={link.label}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className={`rounded-xl px-3 py-2 text-sm font-medium ${link.active ? 'bg-white text-slate-900' : 'text-slate-200 hover:bg-white/10'}`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link to="/login" onClick={() => setMobileOpen(false)} className="rounded-xl border border-white/15 px-3 py-2 text-center text-sm font-medium text-white">
              Login
            </Link>
            <Link to="/register" onClick={() => setMobileOpen(false)} className="rounded-xl bg-cyan-300 px-3 py-2 text-center text-sm font-semibold text-slate-900">
              Register
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
