import React from 'react';
import DocsLayout from '../../components/docs/DocsLayout';

export default function DocsGettingStartedPage() {
  return (
    <DocsLayout
      title="Getting Started"
      description="Set up your account, create a project, and start working in a few minutes."
    >
      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <h2 className="text-lg font-semibold text-white">Quick Start</h2>
        <ul className="mt-3 space-y-2 text-sm leading-7 text-slate-300">
          <li>1. Log in with CollabCode or GitHub.</li>
          <li>2. Create a project from the dashboard.</li>
          <li>3. Invite your team or classmates.</li>
          <li>4. Set roles before editing.</li>
          <li>5. Start coding and run the first file.</li>
        </ul>
      </section>
    </DocsLayout>
  );
}
