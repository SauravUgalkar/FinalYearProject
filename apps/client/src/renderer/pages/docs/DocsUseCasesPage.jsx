import React from 'react';
import DocsLayout from '../../components/docs/DocsLayout';

const useCases = [
  {
    title: 'Students',
    description: 'Collaborate on assignments, pair-program with peers, and get live mentor support in one room.',
  },
  {
    title: 'Teachers',
    description: 'Run interactive coding labs with role control, live presence, and progress visibility.',
  },
  {
    title: 'Developers',
    description: 'Build product features with synchronized editing, integrated execution, and GitHub delivery.',
  },
  {
    title: 'Interviews',
    description: 'Host technical interview sessions where candidates can code live with reviewer guidance.',
  },
];

export default function DocsUseCasesPage() {
  return (
    <DocsLayout title="Use Cases" description="See how different audiences apply CollabCode in practical workflows.">
      <div className="grid gap-4 md:grid-cols-2">
        {useCases.map((item) => (
          <article key={item.title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <h2 className="text-lg font-semibold text-white">{item.title}</h2>
            <p className="mt-2 text-sm leading-7 text-slate-300">{item.description}</p>
          </article>
        ))}
      </div>
    </DocsLayout>
  );
}
