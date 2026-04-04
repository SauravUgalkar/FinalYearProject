import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Code2, Users } from 'lucide-react';
import DocsLayout from '../../components/docs/DocsLayout';

const cards = [
  {
    title: 'Getting Started',
    description: 'Create your account, open your first project, and invite your team in minutes.',
    to: '/docs/getting-started',
    icon: BookOpen,
  },
  {
    title: 'Editor and Execution',
    description: 'Learn Monaco features, multi-file workflows, and language execution flow.',
    to: '/docs/editor',
    icon: Code2,
  },
  {
    title: 'Collaboration and Roles',
    description: 'Understand real-time sync, role permissions, and team/classroom patterns.',
    to: '/docs/collaboration',
    icon: Users,
  },
];

export default function DocsOverviewPage() {
  return (
    <DocsLayout
      title="CollabCode Documentation"
      description="Quick guides for setup, editing, collaboration, and day-to-day use."
    >
      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-white">What this docs section covers</h2>
        <ul className="mt-3 space-y-2 text-sm leading-7 text-slate-300">
          <li>• How to start a project and invite people</li>
          <li>• How to edit, run, and share code</li>
          <li>• How to use roles, Git, and collaboration tools</li>
        </ul>
      </section>
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map(({ title, description, to, icon: Icon }) => (
          <Link key={title} to={to} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5 transition hover:-translate-y-1 hover:border-cyan-300/30">
            <div className="inline-flex rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-2 text-cyan-100">
              <Icon size={16} />
            </div>
            <h2 className="mt-3 text-lg font-semibold text-white">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">{description}</p>
            <span className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-cyan-200">
              Open guide <ArrowRight size={14} />
            </span>
          </Link>
        ))}
      </div>
    </DocsLayout>
  );
}
