import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  GraduationCap,
  LayoutDashboard,
  Code2,
  Sparkles,
  Shield,
} from 'lucide-react';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';

const audienceCards = [
  {
    title: 'For Students',
    icon: GraduationCap,
    points: [
      'Real-Time Help: Share your project link with a mentor or peer to get instant feedback directly inside your code editor.',
      'Multi-Language Support: Practice different languages including JavaScript, Python, and more using our built-in execution engine.',
      'Safe Environment: Your work is automatically saved to our cloud database, so you never lose progress if your browser refreshes.',
      'Built-in Chat: Discuss logic and debug errors with your classmates without leaving the app.',
    ],
  },
  {
    title: 'For Teachers',
    icon: LayoutDashboard,
    points: [
      'Role-Based Access: Set users as Viewers (can only watch), Editors (can type), or Admins (full control) to manage classroom participation.',
      'Live Presence: See exactly where your students are looking with live cursor tracking.',
      'Analytics Dashboard: Monitor student activity and project progress through a professional analytics interface.',
      'Code Execution: Run student code instantly to verify logic and provide immediate grading or feedback.',
    ],
  },
  {
    title: 'For Developers',
    icon: Code2,
    points: [
      'Git and GitHub Integration: Stage, commit, push, and pull directly from the platform. You can even import existing repositories to start working immediately.',
      'Monaco Editor: Enjoy a professional-grade editing experience powered by the same engine as VS Code.',
      'Project Management: Organize your work with a multi-file structure and folder system.',
      'Live Collaboration: Use the Yjs-powered sync engine for conflict-free editing, ensuring that multiple developers can type in the same file at the same time.',
    ],
  },
];

const workflowSteps = [
  { title: 'Create Project', icon: Sparkles },
  { title: 'Add Files', icon: Code2 },
  { title: 'Collaborate', icon: Code2 },
  { title: 'Run Code', icon: Code2 },
  { title: 'Push to GitHub', icon: Code2 },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.16),_transparent_28%),radial-gradient(circle_at_85%_20%,_rgba(251,146,60,0.14),_transparent_24%),linear-gradient(135deg,_#020617_0%,_#0f172a_45%,_#111827_100%)] text-white">
      <Header />

      <main className="mx-auto max-w-7xl px-6 py-10 sm:px-8 lg:px-10">
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 sm:p-8 shadow-[0_18px_80px_rgba(2,6,23,0.34)] backdrop-blur">
          <p className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100">
            <Sparkles size={12} />
            Modern Collaborative SaaS
          </p>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-6xl">
            Collaborate. Code. Build - Together in Real Time.
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
            CollabCode gives teams, classrooms, and developers one focused workspace for real-time coding,
            execution, and communication. See our powerful features and real-world use cases.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/register" className="inline-flex items-center gap-2 rounded-2xl bg-cyan-300 px-6 py-3 text-sm font-semibold text-slate-900 transition hover:-translate-y-1 hover:bg-cyan-200">
              Get Started
              <ArrowRight size={15} />
            </Link>
            <Link to="/docs" className="rounded-2xl border border-white/20 bg-white/[0.05] px-6 py-3 text-sm font-medium transition hover:-translate-y-1 hover:bg-white/10">
              View Docs
            </Link>
          </div>
        </section>

        <section className="mt-14">
          <h2 className="text-3xl font-semibold tracking-tight">Built for Every Audience</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {audienceCards.map(({ title, icon: Icon, points }) => (
              <article key={title} className="rounded-3xl border border-white/10 bg-slate-950/60 p-6 shadow-[0_16px_60px_rgba(2,6,23,0.34)] backdrop-blur">
                <div className="inline-flex rounded-2xl border border-cyan-300/25 bg-cyan-300/10 p-3 text-cyan-100">
                  <Icon size={18} />
                </div>
                <h3 className="mt-4 text-xl font-semibold">{title}</h3>
                <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-300">
                  {points.map((point) => (
                    <li key={point} className="flex gap-2">
                      <Shield size={14} className="mt-1 shrink-0 text-cyan-300" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-14 rounded-3xl border border-white/10 bg-white/[0.04] p-6 sm:p-8 shadow-[0_16px_60px_rgba(2,6,23,0.34)] backdrop-blur">
          <h2 className="text-3xl font-semibold tracking-tight">How It Works</h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-5">
            {workflowSteps.map(({ title, icon: Icon }, index) => (
              <li key={title} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 transition hover:-translate-y-1 hover:border-cyan-300/25">
                <div className="flex items-center justify-between">
                  <div className="inline-flex rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-2 text-cyan-100">
                    <Icon size={16} />
                  </div>
                  <span className="text-xs font-semibold tracking-[0.18em] text-slate-400">0{index + 1}</span>
                </div>
                <p className="mt-4 text-sm font-semibold text-white">{title}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-14 rounded-3xl border border-white/10 bg-cyan-300/10 p-6 sm:p-8 text-center shadow-[0_16px_60px_rgba(2,6,23,0.34)] backdrop-blur">
          <h2 className="text-3xl font-semibold tracking-tight">Start Building Now</h2>
          <p className="mx-auto mt-3 max-w-2xl text-slate-200">Move from onboarding to active collaboration in minutes.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/register" className="rounded-2xl bg-cyan-300 px-6 py-3 text-sm font-semibold text-slate-900 transition hover:-translate-y-1 hover:bg-cyan-200">
              Create Account
            </Link>
            <Link to="/login" className="rounded-2xl border border-white/20 bg-white/[0.06] px-6 py-3 text-sm font-medium transition hover:-translate-y-1 hover:bg-white/10">
              Login
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}