import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Braces, FolderTree, GitBranch, MessageSquare, Play, Sparkles } from 'lucide-react';

const features = [
  {
    title: 'Real-time collaboration',
    description: 'Work in the same codebase with shared presence, synchronized edits, and instant feedback.',
    icon: Sparkles,
  },
  {
    title: 'Live chat',
    description: 'Keep decisions close to the code with room-based discussion built into the workspace.',
    icon: MessageSquare,
  },
  {
    title: 'Multi-file projects',
    description: 'Organize complete projects with multiple files, folders, and structured team workflows.',
    icon: FolderTree,
  },
  {
    title: 'Code execution',
    description: 'Run supported languages directly from the collaborative editor with guarded execution.',
    icon: Play,
  },
  {
    title: 'Git and GitHub integration',
    description: 'Connect repositories, track changes, and move code from collaboration to delivery faster.',
    icon: GitBranch,
  },
];

function CollabCodeLogo() {
  return (
    <div className="flex items-center border border-white rounded-full">
      <img src="/logo.png" alt="CollabCode" className="h-20 w-20 object-contain" />
    </div>
  );
}

function FeatureCard({ title, description, icon: Icon }) {
  return (
    <div className="group rounded-3xl border border-white/10 bg-white/[0.05] p-6 shadow-[0_18px_80px_rgba(2,6,23,0.34)] backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-cyan-300/30 hover:bg-white/[0.08]">
      <div className="mb-4 inline-flex rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-3 text-cyan-200 transition duration-300 group-hover:scale-105 group-hover:text-white">
        <Icon size={22} />
      </div>
      <h3 className="mb-2 text-lg font-semibold text-white">{title}</h3>
      <p className="text-sm leading-6 text-slate-300">{description}</p>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_28%),radial-gradient(circle_at_80%_20%,_rgba(244,114,182,0.2),_transparent_24%),linear-gradient(135deg,_#020617_0%,_#0f172a_45%,_#111827_100%)] text-white">
      <div className="relative mx-auto max-w-7xl px-6 py-8 sm:px-8 lg:px-10">
        <div className="absolute left-8 top-24 h-48 w-48 rounded-full bg-cyan-400/10 blur-3xl" aria-hidden="true" />
        <div className="absolute right-8 top-16 h-56 w-56 rounded-full bg-fuchsia-400/10 blur-3xl" aria-hidden="true" />

        <header className="relative z-10 mb-16 flex flex-col gap-6 rounded-full border border-white/10 bg-white/[0.04] px-5 py-4 shadow-[0_8px_40px_rgba(2,6,23,0.28)] backdrop-blur md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <CollabCodeLogo />
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/80">
                Collaborative space
              </div>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">CollabCode</h1>
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-3">
            <Link to="/login" className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-medium text-slate-200 transition hover:border-cyan-300/40 hover:bg-white/10 hover:text-white">
              Login
            </Link>
            <Link to="/register" className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:-translate-y-0.5 hover:bg-cyan-200">
              Register
            </Link>     
          </nav>
        </header>

        <main className="relative z-10">
          <section className="grid items-center gap-14 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="max-w-2xl">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100/90">
                <Sparkles size={14} />
                Learn Together. Code Together. Teach Together.
              </div>

              <h2 className="text-5xl font-semibold leading-[1.05] tracking-tight text-white sm:text-6xl">
               One workspace for modern developers and learners.
              </h2>

              <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
                A real-time coding platform where teams, students, and developers collaborate, communicate, and build projects together in one place.
              </p>

              <div className="mt-10 flex flex-wrap gap-4">
                <Link to="/register" className="inline-flex items-center gap-2 rounded-2xl bg-cyan-300 px-6 py-3.5 text-sm font-semibold text-slate-950 shadow-[0_14px_40px_rgba(34,211,238,0.22)] transition hover:-translate-y-1 hover:bg-cyan-200">
                  Start Building
                  <ArrowRight size={16} />
                </Link>
                <Link to="/docs" className="rounded-2xl border border-fuchsia-300/20 bg-fuchsia-300/10 px-6 py-3.5 text-sm font-medium text-fuchsia-100 transition hover:-translate-y-1 hover:bg-fuchsia-300/15">
                  Explore Documentation
                </Link>
              </div>
            </div>

            <div className="relative">
              <div className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 shadow-[0_24px_100px_rgba(15,23,42,0.6)] backdrop-blur">
                <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-4">
                  <div>
                    <p className="text-sm font-medium text-white">Workspace Overview</p>
                    <p className="mt-1 text-sm text-slate-400">Built for high-velocity collaborative development</p>
                  </div>
                  <div className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-medium text-emerald-200">
                    Live Session
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Collaboration</p>
                    <p className="mt-3 text-3xl font-semibold text-white">Multi-user</p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">See teammates editing, discussing, and iterating in one shared room.</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Execution</p>
                    <p className="mt-3 text-3xl font-semibold text-white">Fast runs</p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">Validate ideas quickly with integrated code execution inside the project flow.</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:col-span-2">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Delivery workflow</p>
                    <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-200">
                      <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5">Edit together</span>
                      <span className="text-slate-500">→</span>
                      <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5">Discuss in chat</span>
                      <span className="text-slate-500">→</span>
                      <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5">Run code</span>
                      <span className="text-slate-500">→</span>
                      <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5">Push to GitHub</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="relative z-10 mt-24">
            <div className="mb-10 max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-200/80">Platform highlights</p>
    
            </div>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {features.map((feature) => (
                <FeatureCard key={feature.title} {...feature} />
              ))}
            </div>
          </section>

          <section className="mt-24 rounded-[2rem] border border-white/10 bg-white/[0.04] px-6 py-10 shadow-[0_18px_80px_rgba(2,6,23,0.34)] backdrop-blur sm:px-10">
            <div className="mb-10 max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-200/80">Built for real-world workflows</p>
              <h3 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Interview, pair-program, and teach in one shared coding space.
              </h3>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <article className="group rounded-3xl border border-cyan-300/20 bg-cyan-300/5 p-6 transition duration-300 hover:-translate-y-1 hover:border-cyan-300/40 hover:bg-cyan-300/10">
                <div className="mb-4 inline-flex rounded-2xl border border-cyan-300/25 bg-cyan-300/10 p-3 text-cyan-100">
                  <MessageSquare size={20} />
                </div>
                <h4 className="text-xl font-semibold text-white">Live Technical Interviews and Hiring Rounds</h4>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  Recruiters and HR teams can create private projects and invite candidates to solve tasks in real time. Review live presence, synchronized typing, and use integrated chat to provide hints and guidance during coding rounds.
                </p>
              </article>

              <article className="group rounded-3xl border border-fuchsia-300/20 bg-fuchsia-300/5 p-6 transition duration-300 hover:-translate-y-1 hover:border-fuchsia-300/40 hover:bg-fuchsia-300/10">
                <div className="mb-4 inline-flex rounded-2xl border border-fuchsia-300/25 bg-fuchsia-300/10 p-3 text-fuchsia-100">
                  <Sparkles size={20} />
                </div>
                <h4 className="text-xl font-semibold text-white">Real-Time Collaborative Development</h4>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  Think of it as Google Docs for Code. Yjs sync events provide conflict-free, instant merging so multiple developers can type at once without losing changes, making it ideal for pair programming and distributed teamwork.
                </p>
              </article>

              <article className="group rounded-3xl border border-emerald-300/20 bg-emerald-300/5 p-6 transition duration-300 hover:-translate-y-1 hover:border-emerald-300/40 hover:bg-emerald-300/10">
                <div className="mb-4 inline-flex rounded-2xl border border-emerald-300/25 bg-emerald-300/10 p-3 text-emerald-100">
                  <FolderTree size={20} />
                </div>
                <h4 className="text-xl font-semibold text-white">Classroom Programming and Lab Assignments</h4>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  Teachers can distribute coding tasks and manage participation through RBAC. Use Admin for full control and lecture flow, Editor for active student coding, and Viewer for observation-focused sessions.
                </p>
              </article>
            </div>
          </section>

          <section className="mt-24 rounded-[2rem] border border-white/10 bg-white/[0.04] px-6 py-10 shadow-[0_18px_80px_rgba(2,6,23,0.34)] backdrop-blur sm:px-10">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-fuchsia-200/80">Documentation</p>
                <h4 className="mt-3 text-3xl font-semibold tracking-tight text-white">Need product or workflow details?</h4>
                <p className="mt-4 text-base leading-7 text-slate-300">
                  Review the documentation placeholder to prepare onboarding content, usage guides, and platform references without touching existing backend flows.
                </p>
              </div>

              <div className="flex flex-wrap gap-4">
                <Link to="/docs" className="inline-flex items-center gap-2 rounded-2xl bg-fuchsia-300 px-6 py-3.5 text-sm font-semibold text-slate-950 transition hover:-translate-y-1 hover:bg-fuchsia-200">
                  Open Documentation
                  <BookOpen size={16} />
                </Link>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}