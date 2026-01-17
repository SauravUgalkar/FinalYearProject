import React from 'react';
import { LogOut, X } from 'lucide-react';

export default function LogoutConfirmModal({ isOpen, onConfirm, onCancel }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-2xl max-w-md w-full p-6 animate-fadeIn">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-600 bg-opacity-20 rounded-lg">
              <LogOut className="text-red-400" size={24} />
            </div>
            <h2 className="text-xl font-bold text-white">Confirm Logout</h2>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-white transition"
          >
            <X size={20} />
          </button>
        </div>

        <p className="text-gray-300 mb-6">
          Are you sure you want to logout? You will need to sign in again to access your projects.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition flex items-center justify-center gap-2"
          >
            <LogOut size={16} /> Logout
          </button>
        </div>
      </div>
    </div>
  );
}
