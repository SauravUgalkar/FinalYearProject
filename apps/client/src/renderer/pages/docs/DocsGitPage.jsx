import React from 'react';
import DocsLayout, { DocTopic } from '../../components/docs/DocsLayout';

const gitTopics = [
  {
    title: 'Repository Connection',
    what: 'The link between your project and GitHub.',
    how: 'Connect the repo once, then keep work synced from the Git panel.',
    points: ['Use it for existing repositories', 'Keeps remote work connected'],
  },
  {
    title: 'Stage, Commit, Push',
    what: 'The main source control flow in CollabCode.',
    how: 'Stage the files you want, write a commit message, then push changes.',
    points: ['Good for saving clean checkpoints', 'Works for daily team updates'],
  },
  {
    title: 'Branch Selection',
    what: 'Choosing the line of work you want to edit.',
    how: 'Switch branches when you need a feature branch or review path.',
    points: ['Useful for collaborative work', 'Helps keep changes organized'],
  },
];

export default function DocsGitPage() {
  return (
    <DocsLayout
      title="Git"
      description="Handle GitHub workflows from inside the app with simple source control steps."
    >
      <div className="space-y-4">
        {gitTopics.map((topic) => (
          <DocTopic key={topic.title} {...topic} />
        ))}
      </div>
    </DocsLayout>
  );
}
