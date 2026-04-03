import React from 'react';
import DocsLayout, { DocTopic } from '../../components/docs/DocsLayout';

const collaborationTopics = [
  {
    title: 'Yjs Sync',
    what: 'The sync engine that keeps shared edits aligned.',
    how: 'Edit normally and let the system merge changes in the background.',
    points: ['Prevents overwrite issues', 'Keeps everyone on the same version'],
  },
  {
    title: 'Live Cursors',
    what: 'Visible pointers for everyone in the room.',
    how: 'Use them to follow activity and avoid editing the same line at once.',
    points: ['Good for pair programming', 'Helps with teamwork and teaching'],
  },
  {
    title: 'Presence',
    what: 'Who is online and active in the room.',
    how: 'Check presence before asking for help or starting a review.',
    points: ['Useful in classrooms', 'Helps teams coordinate quickly'],
  },
  {
    title: 'Conflict-free Editing',
    what: 'A way to keep edits from breaking each other.',
    how: 'Work at the same time without worrying about destructive merges.',
    points: ['Safer for live collaboration', 'Reduces manual merge work'],
  },
];

export default function DocsCollaborationPage() {
  return (
    <DocsLayout
      title="Collaboration"
      description="Live collaboration keeps everyone editing the same project without stepping on each other."
    >
      <div className="space-y-4">
        {collaborationTopics.map((topic) => (
          <DocTopic key={topic.title} {...topic} />
        ))}
      </div>
    </DocsLayout>
  );
}
