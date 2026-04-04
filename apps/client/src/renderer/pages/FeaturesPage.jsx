import React from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  Code2,
  Cpu,
  Download,
  FolderTree,
  GitBranch,
  MessageSquare,
  Settings,
  ArrowRight,
} from 'lucide-react';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';

const features = [
  {
    title: 'Real-time collaboration',
    description: 'Edit together with synchronized updates and shared live presence across your team in real-time.',
    icon: Code2,
    details: [
      'Live cursor tracking for all collaborators',
      'Synchronized edits with conflict-free resolution',
      'Real-time presence awareness',
      'Instant notification of changes'
    ]
  },
  {
    title: 'Multi-file projects',
    description: 'Build complete projects with folders and dependency-aware structure for scalable development.',
    icon: FolderTree,
    details: [
      'Hierarchical folder structure',
      'Cross-file navigation',
      'Dependency management support',
      'Project-wide file operations'
    ]
  },
  {
    title: 'Code execution',
    description: 'Run supported languages directly from your collaborative workspace without setup.',
    icon: Cpu,
    details: [
      'Multiple language support (JavaScript, Python, etc)',
      'Real-time code output',
      'Interactive console input',
      'Execution history tracking'
    ]
  },
  {
    title: 'GitHub integration',
    description: 'Connect repository workflows with stage, commit, pull, and push without leaving the editor.',
    icon: GitBranch,
    details: [
      'Import existing repositories',
      'Stage and commit changes',
      'Pull and push operations',
      'Branch management'
    ]
  },
  {
    title: 'Chat system',
    description: 'Discuss implementation details and share code snippets without leaving your coding room.',
    icon: MessageSquare,
    details: [
      'In-room messaging system',
      'Code snippet sharing',
      'User mentions and notifications',
      'Message history'
    ]
  },
  {
    title: 'Analytics dashboard',
    description: 'Track execution and activity insights for teams and classrooms with comprehensive metrics.',
    icon: BarChart3,
    details: [
      'Execution statistics',
      'Activity timeline',
      'User contribution metrics',
      'Performance insights'
    ]
  },
  {
    title: 'Export system',
    description: 'Share and export project assets with a clean handoff workflow for seamless sharing.',
    icon: Download,
    details: [
      'Export projects as ZIP',
      'Share export links',
      'Version snapshots',
      'Clean project artifacts'
    ]
  },
  {
    title: 'Settings customization',
    description: 'Tune editor behavior and workspace preferences to match your personal coding style.',
    icon: Settings,
    details: [
      'Editor theme customization',
      'Keyboard shortcuts',
      'Font and spacing controls',
      'Workspace preferences'
    ]
  },
];

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.16),_transparent_28%),radial-gradient(circle_at_85%_20%,_rgba(251,146,60,0.14),_transparent_24%),linear-gradient(135deg,_#020617_0%,_#0f172a_45%,_#111827_100%)] text-white">
      <Header />

      <main className="mx-auto max-w-7xl px-6 py-12 sm:px-8 lg:px-10">
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 sm:p-8 shadow-[0_18px_80px_rgba(2,6,23,0.34)] backdrop-blur">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Powerful Features</h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-300">
            Everything you need for collaborative coding, from real-time editing to code execution and GitHub integration.
          </p>
        </section>

        <section className="mt-16">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="group rounded-2xl border border-white/10 bg-slate-950/60 p-6 shadow-[0_16px_60px_rgba(2,6,23,0.34)] backdrop-blur transition hover:border-cyan-300/30 hover:bg-slate-950/80"
                >
                  <div className="inline-flex rounded-xl border border-cyan-300/25 bg-cyan-300/10 p-3 text-cyan-100 transition group-hover:bg-cyan-300/20">
                    <Icon size={20} />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm text-slate-300">{feature.description}</p>
                  <ul className="mt-4 space-y-2">
                    {feature.details.map((detail, idx) => (
                      <li key={idx} className="text-xs text-slate-400 flex items-start gap-2">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300/60" />
                        {detail}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-16 rounded-3xl border border-white/10 bg-cyan-300/10 p-6 sm:p-8 text-center shadow-[0_16px_60px_rgba(2,6,23,0.34)] backdrop-blur">
          <h2 className="text-3xl font-semibold tracking-tight">Ready to explore these features?</h2>
          <p className="mx-auto mt-3 max-w-2xl text-slate-200">Start with our detailed documentation or jump straight to building.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/docs" className="inline-flex items-center gap-2 rounded-2xl bg-cyan-300 px-6 py-3 text-sm font-semibold text-slate-900 transition hover:-translate-y-1 hover:bg-cyan-200">
              View Documentation
              <ArrowRight size={15} />
            </Link>
            <Link to="/register" className="rounded-2xl border border-white/20 bg-white/[0.05] px-6 py-3 text-sm font-medium transition hover:-translate-y-1 hover:bg-white/10">
              Get Started
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
