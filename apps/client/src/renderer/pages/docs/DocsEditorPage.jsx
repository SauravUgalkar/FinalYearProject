import React from 'react';
import DocsLayout, { DocTopic } from '../../components/docs/DocsLayout';

const editorTopics = [
  {
    title: 'Monaco Editor',
    what: 'The main code editor inside CollabCode.',
    how: 'Type directly in the editor and use syntax highlighting to read code faster.',
    points: ['Best for writing and reviewing code', 'Feels similar to VS Code'],
  },
  {
    title: 'Themes',
    what: 'Color styles for the editor area.',
    how: 'Open settings and choose a theme that is easier to read on your screen.',
    points: ['Use dark or light styles', 'Pick the one that reduces eye strain'],
  },
  {
    title: 'Multi-cursor',
    what: 'Live cursor positions from collaborators.',
    how: 'Watch where others are editing so you can avoid typing in the same spot.',
    points: ['Useful for pair programming', 'Helps prevent edit conflicts'],
  },
  {
    title: 'Editor Settings',
    what: 'Basic preferences for how the editor behaves.',
    how: 'Adjust font size, shortcuts, and layout to match your working style.',
    points: ['Keep it simple and readable', 'Tune it for your team or class'],
  },
];

export default function DocsEditorPage() {
  return (
    <DocsLayout
      title="Editor"
      description="The editor is where you write code, follow changes, and tune your workspace."
    >
      <div className="space-y-4">
        {editorTopics.map((topic) => (
          <DocTopic key={topic.title} {...topic} />
        ))}
      </div>
    </DocsLayout>
  );
}
