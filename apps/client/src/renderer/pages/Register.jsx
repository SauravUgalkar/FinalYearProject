import React, { useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Mail } from 'lucide-react';
import { API_URL } from '../config/runtime';
import { authStorage } from '../services/authStorage';

const LANDING_BG = 'bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_28%),radial-gradient(circle_at_80%_20%,_rgba(244,114,182,0.2),_transparent_24%),linear-gradient(135deg,_#020617_0%,_#0f172a_45%,_#111827_100%)]';

export default function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ name: '', email: '', password: '', confirmPassword: '', skill: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // OTP step state
  const [otpToken, setOtpToken] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Step 1: send OTP
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(`${API_URL}/auth/register`, {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        codingLanguages: formData.skill ? [formData.skill] : []
      });
      setOtpToken(response.data.otpToken);
      setOtpSent(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: verify OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post(`${API_URL}/auth/verify-otp`, { otpToken, otp });
      authStorage.setToken(response.data.token);
      authStorage.setUser(response.data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (otpSent) {
      setOtpSent(false);
      setOtp('');
      setOtpToken('');
      setError('');
      return;
    }
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

          {!otpSent ? (
            <>
              <div className="mb-8 flex flex-col items-center gap-3 text-center">
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100">
                  <Shield size={12} />
                  Build together
                </div>
                <img src="/logo.png" alt="CollabCode" className="h-20 w-20 object-contain" />
                <div>
                  <h2 className="text-3xl font-semibold text-white">Create account</h2>
                  <p className="mt-2 text-sm text-slate-300">Set up your workspace and start building right away.</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {error && <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-200">Full Name</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Your full name"
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-200">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="name@company.com"
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-200">Primary Skill</label>
                  <input
                    type="text"
                    name="skill"
                    value={formData.skill}
                    onChange={handleChange}
                    placeholder="e.g., JavaScript"
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-200">Password</label>
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      autoComplete="new-password"
                      placeholder="Create a password"
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-200">Confirm</label>
                    <input
                      type="password"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      autoComplete="new-password"
                      placeholder="Repeat password"
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-2xl bg-gradient-to-r from-cyan-300 to-sky-300 px-4 py-3 font-semibold text-slate-950 transition hover:-translate-y-0.5 hover:from-cyan-200 hover:to-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? 'Sending code…' : 'Continue'}
                </button>

                <p className="text-center text-sm text-slate-400">
                  Already have an account?{' '}
                  <Link to="/login" className="font-medium text-cyan-200 transition hover:text-cyan-100">
                    Login
                  </Link>
                </p>
              </form>
            </>
          ) : (
            <>
              <div className="mb-8 flex flex-col items-center gap-3 text-center">
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100">
                  <Mail size={12} />
                  Verify email
                </div>
                <img src="/logo.png" alt="CollabCode" className="h-20 w-20 object-contain" />
                <div>
                  <h2 className="text-3xl font-semibold text-white">Check your inbox</h2>
                  <p className="mt-2 text-sm text-slate-300">
                    We sent a 6-digit code to <span className="font-medium text-cyan-200">{formData.email}</span>.
                    It expires in 10&nbsp;minutes.
                  </p>
                </div>
              </div>

              <form onSubmit={handleVerifyOtp} className="space-y-4">
                {error && <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-200">Verification code</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="\d{6}"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-center text-2xl tracking-[0.5em] text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
                    required
                    autoFocus
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  className="w-full rounded-2xl bg-gradient-to-r from-cyan-300 to-sky-300 px-4 py-3 font-semibold text-slate-950 transition hover:-translate-y-0.5 hover:from-cyan-200 hover:to-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? 'Verifying…' : 'Verify & create account'}
                </button>
              </form>
            </>
          )}

        </section>
      </div>
    </div>
  );
}
