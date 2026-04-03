import React from 'react';
import DocsLayout from '../../components/docs/DocsLayout';

const issues = [
  {
    issue: 'Execution timed out',
    fix: 'Check worker health and retry with a smaller input or optimized code path.',
  },
  {
    issue: 'Cannot push to GitHub',
    fix: 'Reconnect GitHub account and confirm repository ownership and branch permissions.',
  },
  {
    issue: 'Missing collaborator updates',
    fix: 'Verify room connection and refresh project state to recover latest synchronized edits.',
  },
  {
    issue: 'Authentication failures',
    fix: 'Sign in again and ensure your token/session has not expired.',
  },
];

export default function DocsTroubleshootingPage() {
  return (
    <DocsLayout title="Troubleshooting" description="Short fixes for common workflow issues.">
      <div className="space-y-4">
        {issues.map((item) => (
          <article key={item.issue} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <h2 className="text-base font-semibold text-white">{item.issue}</h2>
            <p className="mt-2 text-sm leading-7 text-slate-300">Fix: {item.fix}</p>
          </article>
        ))}
      </div>
    </DocsLayout>
  );
}
