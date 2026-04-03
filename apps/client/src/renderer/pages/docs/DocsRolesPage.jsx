import React from 'react';
import DocsLayout, { DocTopic } from '../../components/docs/DocsLayout';

const roleTopics = [
  {
    title: 'Admin',
    what: 'Full control of the room and its settings.',
    how: 'Use this role for owners, teachers, or project leads.',
    points: ['Can manage settings', 'Best for room control'],
  },
  {
    title: 'Editor',
    what: 'A user who can type and contribute code.',
    how: 'Give this role to teammates or students who should edit the project.',
    points: ['Can work inside the editor', 'Cannot manage everything'],
  },
  {
    title: 'Viewer',
    what: 'Read-only access to the room.',
    how: 'Use it for demos, reviews, or people who only need to watch.',
    points: ['No editing access', 'Good for observation and teaching'],
  },
  {
    title: 'Classroom vs Team Usage',
    what: 'Two common ways to organize a room.',
    how: 'Use stricter control for classrooms and looser control for team work.',
    points: ['Classroom: guided access', 'Team: flexible collaboration'],
  },
];

export default function DocsRolesPage() {
  return (
    <DocsLayout
      title="Roles"
      description="Use simple roles to control who can watch, edit, or manage a room."
    >
      <div className="space-y-4">
        {roleTopics.map((topic) => (
          <DocTopic key={topic.title} {...topic} />
        ))}
      </div>
    </DocsLayout>
  );
}
