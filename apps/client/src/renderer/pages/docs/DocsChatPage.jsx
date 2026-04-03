import React from 'react';
import DocsLayout, { DocTopic } from '../../components/docs/DocsLayout';

const chatTopics = [
  {
    title: 'Room Chat',
    what: 'The chat tied to one project room.',
    how: 'Use it to keep decisions, reminders, and feedback near the code.',
    points: ['Keeps context in one place', 'Useful for team notes and class discussions'],
  },
  {
    title: 'Mentions',
    what: 'A simple way to call someone’s attention.',
    how: 'Tag a user when you need a quick response or review.',
    points: ['Good for action items', 'Helps messages reach the right person'],
  },
  {
    title: 'Code Sharing',
    what: 'Sharing snippets and run results inside chat.',
    how: 'Paste short code examples or explain an issue without switching tools.',
    points: ['Keeps debugging discussion fast', 'Helpful during reviews'],
  },
];

export default function DocsChatPage() {
  return (
    <DocsLayout
      title="Chat"
      description="Chat stays inside the room so discussion does not leave the project flow."
    >
      <div className="space-y-4">
        {chatTopics.map((topic) => (
          <DocTopic key={topic.title} {...topic} />
        ))}
      </div>
    </DocsLayout>
  );
}
