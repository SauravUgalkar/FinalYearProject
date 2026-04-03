import React from 'react';
import DocsLayout from '../../components/docs/DocsLayout';

const faq = [
  {
    q: 'Can multiple users edit the same file simultaneously?',
    a: 'Yes, CollabCode supports real-time collaborative editing with conflict-free synchronization.',
  },
  {
    q: 'Where are execution results stored?',
    a: 'Execution history is persisted in MongoDB for long-term access and analytics views.',
  },
  {
    q: 'Do viewers have execution permission?',
    a: 'No, viewer role is read-only and cannot execute code by design.',
  },
  {
    q: 'Can I use my existing GitHub repository?',
    a: 'Yes, connect your repository in the Git panel and use stage/commit/push workflows directly.',
  },
];

export default function DocsFaqPage() {
  return (
    <DocsLayout title="FAQ" description="Fast answers to common product questions.">
      <div className="space-y-4">
        {faq.map((item) => (
          <article key={item.q} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <h2 className="text-base font-semibold text-white">{item.q}</h2>
            <p className="mt-2 text-sm leading-7 text-slate-300">Answer: {item.a}</p>
          </article>
        ))}
      </div>
    </DocsLayout>
  );
}
