import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BookOpenText,
  CheckCircle2,
  Code2,
  Cpu,
  GitBranch,
  GraduationCap,
  Laptop,
  LayoutDashboard,
  Monitor,
  Shield,
  Users,
} from 'lucide-react';

const audienceSections = [
  {
    title: 'For Students: Learn by Doing',
    icon: GraduationCap,
    points: [
      'Real-Time Help: Share your project link with a mentor or peer to get instant feedback directly inside your code editor.',
      'Multi-Language Support: Practice different languages including JavaScript, Python, and more using our built-in execution engine.',
      'Safe Environment: Your work is automatically saved to our cloud database, so you never lose progress if your browser refreshes.',
      'Built-in Chat: Discuss logic and debug errors with your classmates without leaving the app.',
    ],
  },
  {
    title: 'For Teachers: Interactive Classrooms',
    icon: LayoutDashboard,
    points: [
      'Role-Based Access: Set users as Viewers (can only watch), Editors (can type), or Admins (full control) to manage classroom participation.',
      'Live Presence: See exactly where your students are looking with live cursor tracking.',
      'Analytics Dashboard: Monitor student activity and project progress through a professional analytics interface.',
      'Code Execution: Run student code instantly to verify logic and provide immediate grading or feedback.',
    ],
  },
  {
    title: 'For Developers: Professional Workflows',
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
  {
    title: 'Create a Project',
    description: 'From your Dashboard, start a new project or import one from GitHub.',
    icon: BookOpenText,
  },
  {
    title: 'Invite Collaborators',
    description: 'Use the Invite modal to add team members by their username or email.',
    icon: Users,
  },
  {
    title: 'Set Permissions',
    description: 'Choose if your guests can edit the code or simply watch your progress.',
    icon: Shield,
  },
  {
    title: 'Write and Run',
    description: 'Type your code in the Monaco editor and hit the Execute button to see output in the integrated console.',
    icon: Cpu,
  },
  {
    title: 'Save and Sync',
    description: 'Changes sync across all users instantly. Use the Git panel to push your changes to GitHub.',
    icon: GitBranch,
  },
];

const guidelines = [
  "Respect Permissions: Do not delete or overwrite a collaborator's work without discussion.",
  'Resource Limits: To ensure high performance for everyone, we enforce limits on file sizes and code execution times.',
  'Privacy: Be careful when sharing project IDs. Only invite people you trust to your private rooms.',
  'Collaboration: Use the chat feature to communicate your changes before making major architectural edits.',
];

const systemRequirements = [
  {
    label: 'Browser',
    value: 'Modern versions of Chrome, Firefox, or Edge.',
    icon: Monitor,
  },
  {
    label: 'Account',
    value: 'A registered CollabCode account or a GitHub account for OAuth login.',
    icon: Laptop,
  },
];

function SectionCard({ title, icon: Icon, points }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-slate-950/50 p-6 shadow-[0_16px_60px_rgba(2,6,23,0.34)] backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-cyan-300/30">
      <div className="mb-4 inline-flex rounded-2xl border border-cyan-300/25 bg-cyan-300/10 p-3 text-cyan-100">
        <Icon size={20} />
      </div>
      <h2 className="text-2xl font-semibold tracking-tight text-white">{title}</h2>
      <ul className="mt-5 space-y-4">
        {points.map((point) => (
          <li key={point} className="flex gap-3 text-sm leading-7 text-slate-300">
            <CheckCircle2 className="mt-1 shrink-0 text-cyan-300" size={16} />
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_15%_12%,_rgba(34,211,238,0.16),_transparent_28%),radial-gradient(circle_at_85%_20%,_rgba(251,146,60,0.16),_transparent_24%),linear-gradient(160deg,_#020617_0%,_#111827_50%,_#1e1b4b_100%)] text-white">
      <div className="mx-auto max-w-7xl px-6 py-10 sm:px-8 lg:px-10">
        <Link to="/" className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:-translate-y-0.5 hover:bg-white/10 hover:text-white">
          <ArrowLeft size={16} />
          Back to Home
        </Link>

        <section className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.05] p-8 shadow-[0_18px_80px_rgba(2,6,23,0.34)] backdrop-blur sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-200/80">Documentation</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">How to Use CollabCode</h1>
          <p className="mt-5 max-w-4xl text-lg leading-8 text-slate-300">
            Welcome to CollabCode, the real-time collaborative coding platform designed for teams, classrooms, and individual developers. Whether you are learning your first language or building a complex project, this guide helps you get the most out of the platform.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Realtime</p>
              <p className="mt-2 text-lg font-semibold">Live collaboration</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Editor</p>
              <p className="mt-2 text-lg font-semibold">Monaco powered</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Projects</p>
              <p className="mt-2 text-lg font-semibold">Multi-file support</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Delivery</p>
              <p className="mt-2 text-lg font-semibold">Git and GitHub flow</p>
            </div>
          </div>
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-3">
          {audienceSections.map((section) => (
            <SectionCard key={section.title} {...section} />
          ))}
        </section>

        <section className="mt-10 rounded-3xl border border-white/10 bg-slate-950/50 p-8 shadow-[0_16px_60px_rgba(2,6,23,0.34)] backdrop-blur">
          <h2 className="text-3xl font-semibold tracking-tight text-white">How It Works (Step-by-Step)</h2>
          <p className="mt-3 max-w-3xl text-slate-300">
            Follow this workflow to move from idea to collaborative delivery smoothly.
          </p>

          <ol className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {workflowSteps.map(({ title, description, icon: Icon }, index) => (
              <li key={title} className="group rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition duration-300 hover:-translate-y-1 hover:border-cyan-300/25">
                <div className="mb-4 flex items-center justify-between">
                  <div className="inline-flex rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-2 text-cyan-100">
                    <Icon size={18} />
                  </div>
                  <span className="text-xs font-semibold tracking-[0.18em] text-slate-400">STEP {index + 1}</span>
                </div>
                <h3 className="text-base font-semibold text-white">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-300">{description}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-10 grid gap-6 xl:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-8 shadow-[0_16px_60px_rgba(2,6,23,0.34)] backdrop-blur">
            <h2 className="text-2xl font-semibold tracking-tight text-white">Community Rules and Guidelines</h2>
            <ul className="mt-6 space-y-4">
              {guidelines.map((rule) => (
                <li key={rule} className="flex gap-3 text-sm leading-7 text-slate-300">
                  <CheckCircle2 className="mt-1 shrink-0 text-emerald-300" size={16} />
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-8 shadow-[0_16px_60px_rgba(2,6,23,0.34)] backdrop-blur">
            <h2 className="text-2xl font-semibold tracking-tight text-white">System Requirements</h2>
            <div className="mt-6 space-y-4">
              {systemRequirements.map(({ label, value, icon: Icon }) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                  <div className="mb-3 inline-flex rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-2 text-cyan-100">
                    <Icon size={17} />
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</p>
                  <p className="mt-2 text-sm leading-7 text-slate-300">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mb-2 mt-10 rounded-3xl border border-white/10 bg-white/[0.05] p-8 shadow-[0_16px_60px_rgba(2,6,23,0.34)] backdrop-blur">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-white">Start collaborating now</h2>
              <p className="mt-2 text-sm leading-7 text-slate-300">
                Move from documentation to action with your existing CollabCode login and workflow.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to="/login" className="inline-flex items-center gap-2 rounded-2xl bg-cyan-300 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:-translate-y-1 hover:bg-cyan-200">
                Go to Login
                <ArrowRight size={15} />
              </Link>
              <Link to="/register" className="rounded-2xl border border-white/15 px-6 py-3 text-sm font-medium text-white transition hover:-translate-y-1 hover:bg-white/10">
                Create Account
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
