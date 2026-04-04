import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Code2, User, LogOut } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export default function MobileBottomNav({ onLogout }) {
  const location = useLocation();
  const { theme } = useTheme();
  const isLight = theme === 'light';

  // Only show on protected routes
  const protectedRoutes = ['/dashboard', '/editor', '/profile'];
  const isProtectedRoute = protectedRoutes.some(route => location.pathname.startsWith(route));

  if (!isProtectedRoute) {
    return null;
  }

  const navItems = [
    { 
      label: 'Dashboard', 
      to: '/dashboard', 
      icon: LayoutDashboard,
      active: location.pathname.startsWith('/dashboard')
    },
    { 
      label: 'Editor', 
      to: '/editor', 
      icon: Code2,
      // Note: editor routes are /editor/:projectId
      active: location.pathname.startsWith('/editor') && !location.pathname.startsWith('/dashboard')
    },
    { 
      label: 'Profile', 
      to: '/profile', 
      icon: User,
      active: location.pathname === '/profile'
    },
  ];

  const containerCls = isLight
    ? 'fixed bottom-0 left-0 right-0 border-t border-black/10 bg-white/95 backdrop-blur-lg md:hidden'
    : 'fixed bottom-0 left-0 right-0 border-t border-white/10 bg-slate-950/95 backdrop-blur-lg md:hidden';

  const navItemBaseCls = isLight
    ? 'flex flex-col items-center justify-center py-3 px-4 text-xs font-medium transition'
    : 'flex flex-col items-center justify-center py-3 px-4 text-xs font-medium transition';

  const navItemInactive = isLight
    ? 'text-slate-500 hover:text-slate-700'
    : 'text-slate-400 hover:text-slate-200';

  const navItemActive = isLight
    ? 'text-slate-900'
    : 'text-white';

  return (
    <nav className={containerCls} style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.label}
              to={item.to}
              className={`${navItemBaseCls} ${item.active ? navItemActive : navItemInactive}`}
            >
              <Icon size={20} className="mb-1" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
        <button
          onClick={onLogout}
          className={`${navItemBaseCls} ${navItemInactive}`}
          title="Logout"
        >
          <LogOut size={20} className="mb-1" />
          <span>Logout</span>
        </button>
      </div>
    </nav>
  );
}
