import React from 'react';

export default function UserBadge({ user }) {
  if (!user) return null;

  const name = user.name || user.email || 'User';
  const initial = (name[0] || '?').toUpperCase();

  return (
    <div className="flex items-center gap-2 px-3 py-1 bg-gray-800 border border-gray-700 rounded-lg">
      <div
        className="w-7 h-7 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 border-2 border-gray-900 flex items-center justify-center text-white text-xs font-bold"
        title={name}
      >
        {initial}
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span className="text-gray-300 font-medium">{name}</span>
        <span className="px-1.5 py-0.5 rounded bg-blue-900 text-blue-200 border border-blue-700">You</span>
      </div>
    </div>
  );
}
