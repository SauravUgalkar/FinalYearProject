import React, { useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, X, Mail } from 'lucide-react';
import { API_URL } from '../config/runtime';
import { authStorage } from '../services/authStorage';

const LANDING_BG = 'bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_28%),radial-gradient(circle_at_80%_20%,_rgba(244,114,182,0.2),_transparent_24%),linear-gradient(135deg,_#020617_0%,_#0f172a_45%,_#111827_100%)]';

export default function Login() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Forgot password states
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [otpSentForReset, setOtpSentForReset] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    console.log('Login attempt with:', formData);

    try {
      const response = await axios.post(`${API_URL}/auth/login`, formData, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      });
      console.log('Login success:', response.data);
      
      // Store token and user in sessionStorage (tab-isolated)
      authStorage.setToken(response.data.token);
      authStorage.setUser(response.data.user);
      
      console.log('Navigating to dashboard...');
      // Navigate to dashboard (ProtectedRoute will check sessionStorage)
      navigate('/dashboard', { replace: true });
    } catch (err) {
      console.error('Login error:', err);
      const errorMsg = err.code === 'ECONNABORTED'
        ? 'Login request timed out. Server may be waking up, please try again.'
        : (err.response?.data?.error || err.message || 'Login failed');
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Step 1: Request password reset (send OTP)
  const handleRequestReset = async (e) => {
    e.preventDefault();
    setResetError('');
    setResetMessage('');

    if (!resetEmail.trim()) {
      setResetError('Please enter your email');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(`${API_URL}/auth/forgot-password`, {
        email: resetEmail.trim(),
      });
      setResetToken(response.data.resetToken);
      setOtpSentForReset(true);
      setResetMessage('Verification code sent to your email!');
    } catch (err) {
      setResetError(err.response?.data?.error || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP and set new password
  const handleVerifyResetOtp = async (e) => {
    e.preventDefault();
    setResetError('');
    setResetMessage('');

    if (!resetOtp.trim() || resetOtp.length !== 6) {
      setResetError('Please enter the 6-digit code');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setResetError('Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setResetError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(`${API_URL}/auth/verify-forgot-password`, {
        resetToken,
        otp: resetOtp,
        newPassword,
      });
      authStorage.setToken(response.data.token);
      authStorage.setUser(response.data.user);
      setResetMessage('Password reset successfully!');
      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 1500);
    } catch (err) {
      setResetError(err.response?.data?.error || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  const handleBackFromReset = () => {
    if (otpSentForReset) {
      setOtpSentForReset(false);
      setResetOtp('');
      setNewPassword('');
      setConfirmNewPassword('');
      setResetMessage('');
      setResetError('');
      return;
    }
    setShowForgotPassword(false);
    setResetEmail('');
    setResetToken('');
    setResetOtp('');
    setNewPassword('');
    setConfirmNewPassword('');
    setResetMessage('');
    setResetError('');
    setOtpSentForReset(false);
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/');
  };

  return (
    <div className={`min-h-screen ${LANDING_BG} relative overflow-hidden text-white`}>
      <div className="absolute left-8 top-24 h-48 w-48 rounded-full bg-cyan-400/10 blur-3xl" aria-hidden="true" />
      <div className="absolute right-8 top-16 h-56 w-56 rounded-full bg-fuchsia-400/10 blur-3xl" aria-hidden="true" />

      <button
        onClick={handleBack}
        className="absolute left-6 top-6 z-10 inline-flex items-center gap-2 rounded-full border border-white/15 bg-slate-950/50 px-4 py-2 text-sm text-white backdrop-blur transition hover:bg-white/10"
      >
        <ArrowLeft size={16} />
        Back
      </button>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-2xl items-center px-6 py-16 lg:px-10">
        <section className="mx-auto w-full max-w-md rounded-[2rem] border border-white/10 bg-slate-950/75 p-8 shadow-[0_24px_100px_rgba(15,23,42,0.6)] backdrop-blur sm:p-10">
          <div className="mb-8 flex flex-col items-center gap-3 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100">
              <Shield size={12} />
              Secure access
            </div>
            <img src="/logo.png" alt="CollabCode" className="h-20 w-20 object-contain" />
            <div>
              <h2 className="text-3xl font-semibold text-white">Welcome back</h2>
              <p className="mt-2 text-sm text-slate-300">Sign in and continue where your work left off.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-200">Email</label>
              <div className="relative">
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  autoComplete="email"
                  placeholder="name@company.com"
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 pr-10 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
                  required
                />
                {formData.email && (
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, email: '' }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
                    title="Clear email"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-200">Password</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                autoComplete="current-password"
                placeholder="Enter your password"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-gradient-to-r from-cyan-300 to-sky-300 px-4 py-3 font-semibold text-slate-950 transition hover:-translate-y-0.5 hover:from-cyan-200 hover:to-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Signing in...' : 'Login'}
            </button>

            <div className="flex items-center justify-between gap-4 text-sm">
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-cyan-200 transition hover:text-cyan-100"
              >
                Forgot password?
              </button>
              <Link to="/register" className="text-slate-300 transition hover:text-white">
                Create account
              </Link>
            </div>
          </form>

          <p className="mt-6 text-center text-sm text-slate-400">
            Need a new workspace?{' '}
            <Link to="/register" className="font-medium text-cyan-200 transition hover:text-cyan-100">
              Register here
            </Link>
          </p>
        </section>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className={`fixed inset-0 ${LANDING_BG} z-50 flex items-center justify-center p-4`}>
          <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-slate-950/80 p-6 shadow-[0_24px_100px_rgba(15,23,42,0.6)] backdrop-blur">
            {!otpSentForReset ? (
              <>
                {/* Step 1: Email Request */}
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-white">Reset Password</h2>
                  <button
                    onClick={handleBackFromReset}
                    className="text-gray-400 hover:text-white transition"
                  >
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleRequestReset} className="space-y-4">
                  {resetMessage && (
                    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
                      ✓ {resetMessage}
                    </div>
                  )}
                  {resetError && (
                    <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                      {resetError}
                    </div>
                  )}

                  <div>
                    <label className="block text-gray-300 text-sm font-medium mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
                      required
                    />
                    <p className="text-xs text-gray-400 mt-2">
                      We'll send you a verification code to reset your password
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 rounded-2xl bg-gradient-to-r from-cyan-300 to-sky-300 px-4 py-3 font-semibold text-slate-950 transition hover:from-cyan-200 hover:to-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {loading ? 'Sending...' : 'Send Code'}
                    </button>
                    <button
                      type="button"
                      onClick={handleBackFromReset}
                      className="flex-1 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 font-medium text-white transition hover:bg-white/10"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <>
                {/* Step 2: OTP and New Password */}
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100 mb-2">
                      <Mail size={12} />
                      Verify email
                    </div>
                    <h2 className="text-xl font-bold text-white">Create new password</h2>
                  </div>
                  <button
                    onClick={handleBackFromReset}
                    className="text-gray-400 hover:text-white transition"
                  >
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleVerifyResetOtp} className="space-y-4">
                  {resetMessage && (
                    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
                      ✓ {resetMessage}
                    </div>
                  )}
                  {resetError && (
                    <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                      {resetError}
                    </div>
                  )}

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-200">Verification code</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="\d{6}"
                      maxLength={6}
                      value={resetOtp}
                      onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, ''))}
                      placeholder="000000"
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-center text-2xl tracking-[0.5em] text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
                      required
                      autoFocus
                    />
                    <p className="text-xs text-gray-400 mt-2">
                      Enter the 6-digit code we sent to {resetEmail}
                    </p>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-200">New password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoComplete="new-password"
                      placeholder="Create a password"
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-200">Confirm password</label>
                    <input
                      type="password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      autoComplete="new-password"
                      placeholder="Repeat password"
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
                      required
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="submit"
                      disabled={loading || resetOtp.length !== 6}
                      className="flex-1 rounded-2xl bg-gradient-to-r from-cyan-300 to-sky-300 px-4 py-3 font-semibold text-slate-950 transition hover:from-cyan-200 hover:to-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {loading ? 'Resetting...' : 'Reset Password'}
                    </button>
                    <button
                      type="button"
                      onClick={handleBackFromReset}
                      className="flex-1 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 font-medium text-white transition hover:bg-white/10"
                    >
                      Back
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
