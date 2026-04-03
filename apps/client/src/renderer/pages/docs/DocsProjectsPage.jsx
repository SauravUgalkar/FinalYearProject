import React from 'react';
import DocsLayout, { DocTopic } from '../../components/docs/DocsLayout';

const projectTopics = [
  {
    title: 'File and Folder Structure',
    what: 'The tree that organizes your project files and folders.',
    how: 'Create folders for clear structure, then open files from the tree when you need them.',
    points: ['Good for larger projects', 'Keeps related files together'],
  },
  {
    title: 'Multi-file System',
    what: 'A project model that supports more than one file.',
    how: 'Split code into separate files and edit them from the same room.',
    points: ['Best for real applications', 'Supports shared project work'],
  },
];

export default function DocsProjectsPage() {
  return (
    <DocsLayout
      title="Projects"
      description="Organize full codebases with folders, files, and shared project structure."
    >
      <div className="space-y-4">
        {projectTopics.map((topic) => (
          <DocTopic key={topic.title} {...topic} />
        ))}
      </div>
    </DocsLayout>
  );
}
