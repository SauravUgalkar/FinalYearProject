import React, { useMemo, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Menu, X, Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

const navItemBase = 'rounded-full px-3 py-2 text-sm font-medium transition';

const isDocsRoute = (pathname) => pathname.startsWith('/docs');

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();

  const isLight = theme === 'light';

  // Theme-aware class strings
  const headerCls = isLight
    ? 'sticky top-0 z-50 border-b border-black/10 bg-white/85 backdrop-blur-xl'
    : 'sticky top-0 z-50 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl';

  const logoCls    = isLight ? 'border-black/15' : 'border-white/20';
  const logoTextCls = isLight ? 'text-slate-900' : 'text-white';

  const navItemIdle   = isLight
    ? 'text-slate-600 hover:bg-black/5 hover:text-slate-900'
    : 'text-slate-300 hover:bg-white/10 hover:text-white';
  const navItemActive = isLight
    ? 'bg-slate-900 text-white'
    : 'bg-white text-slate-900';

  const loginBtnCls = isLight
    ? 'rounded-full border border-black/15 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-black/5'
    : 'rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/10';

  const toggleBtnCls = isLight
    ? 'flex items-center justify-center w-8 h-8 rounded-full border border-black/15 text-slate-600 transition hover:bg-black/5'
    : 'flex items-center justify-center w-8 h-8 rounded-full border border-white/15 text-slate-200 transition hover:bg-white/10';

  const mobileBtnCls = isLight
    ? 'inline-flex rounded-xl border border-black/15 p-2 text-slate-700 md:hidden'
    : 'inline-flex rounded-xl border border-white/15 p-2 text-slate-200 md:hidden';

  const mobileMenuCls = isLight
    ? 'border-t border-black/10 bg-white/98 px-6 py-4 md:hidden'
    : 'border-t border-white/10 bg-slate-950/95 px-6 py-4 md:hidden';

  const mobileLinkIdle   = isLight ? 'text-slate-700 hover:bg-black/5' : 'text-slate-200 hover:bg-white/10';
  const mobileLinkActive = isLight ? 'bg-slate-900 text-white' : 'bg-white text-slate-900';

  const mobileLoginCls = isLight
    ? 'rounded-xl border border-black/15 px-3 py-2 text-center text-sm font-medium text-slate-700'
    : 'rounded-xl border border-white/15 px-3 py-2 text-center text-sm font-medium text-white';

  const links = useMemo(
    () => [
      { label: 'Home',      to: '/',          active: location.pathname === '/' },
      { label: 'Docs',      to: '/docs',       active: isDocsRoute(location.pathname) },
      { label: 'Features',  to: '/features',   active: location.pathname === '/features' },
      { label: 'Use Cases', to: '/use-cases',  active: location.pathname === '/use-cases' },
    ],
    [location.pathname]
  );

  const handleMobileThemeToggle = () => {
    toggleTheme();
    setMobileOpen(false);
  };

  return (
    <header className={headerCls}>
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3 sm:px-8 lg:px-10">
        <Link to="/" className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="CollabCode"
            className={`h-9 w-9 rounded-full border object-cover ${logoCls}`}
          />
          <span className={`text-sm font-semibold tracking-wide ${logoTextCls}`}>CollabCode</span>
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
          {/* Light / dark mode toggle */}
          <button
            onClick={toggleTheme}
            aria-label={`Switch to ${isLight ? 'dark' : 'light'} mode`}
            className={toggleBtnCls}
          >
            {isLight ? <Moon size={15} /> : <Sun size={15} />}
          </button>

          <Link to="/login" className={loginBtnCls}>
            Login
          </Link>
          <Link
            to="/register"
            className={`rounded-full px-4 py-2 text-sm font-semibold text-slate-900 transition ${
              isLight ? 'bg-cyan-500 hover:bg-cyan-400' : 'bg-cyan-300 hover:bg-cyan-200'
            }`}
          >
            Register
          </Link>
        </div>

        <button
          onClick={() => setMobileOpen((value) => !value)}
          className={mobileBtnCls}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {mobileOpen && (
        <div className={mobileMenuCls}>
          <div className="flex flex-col gap-2">
            {links.map((link) => (
              <Link
                key={link.label}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className={`rounded-xl px-3 py-2 text-sm font-medium ${link.active ? mobileLinkActive : mobileLinkIdle}`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link
              to="/login"
              onClick={() => setMobileOpen(false)}
              className={mobileLoginCls}
            >
              Login
            </Link>
            <Link
              to="/register"
              onClick={() => setMobileOpen(false)}
              className={`rounded-xl px-3 py-2 text-center text-sm font-semibold text-slate-900 ${
                isLight ? 'bg-cyan-500 hover:bg-cyan-400' : 'bg-cyan-300 hover:bg-cyan-200'
              }`}
            >
              Register
            </Link>
          </div>

          {/* Mobile theme toggle */}
          <button
            onClick={handleMobileThemeToggle}
            className={`mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium w-full ${
              isLight ? 'text-slate-700 hover:bg-black/5' : 'text-slate-200 hover:bg-white/10'
            }`}
          >
            {isLight ? <Moon size={15} /> : <Sun size={15} />}
            {isLight ? 'Dark mode' : 'Light mode'}
          </button>
        </div>
      )}
    </header>
  );
}

