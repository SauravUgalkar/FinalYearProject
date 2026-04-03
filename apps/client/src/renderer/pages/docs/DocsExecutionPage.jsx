import React from 'react';
import DocsLayout, { DocTopic } from '../../components/docs/DocsLayout';

const executionTopics = [
  {
    title: 'Supported Languages',
    what: 'The languages you can run inside CollabCode.',
    how: 'Choose a supported file type and run it from the execution panel.',
    points: ['JavaScript, Python, Java, C, C++, and C#', 'Works best with the project entry file'],
  },
  {
    title: 'Output Console',
    what: 'The panel that shows run output and errors.',
    how: 'Read the output after each run to confirm results or spot problems.',
    points: ['Shows logs, compile messages, and runtime errors', 'Use it to debug quickly'],
  },
  {
    title: 'Input Handling',
    what: 'A way to send input to programs that ask for it.',
    how: 'Paste stdin-style input before running interactive code.',
    points: ['Useful for algorithm exercises', 'Works for programs that read from input'],
  },
];

export default function DocsExecutionPage() {
  return (
    <DocsLayout
      title="Execution"
      description="Run code in the room and check results without leaving the workspace."
    >
      <div className="space-y-4">
        {executionTopics.map((topic) => (
          <DocTopic key={topic.title} {...topic} />
        ))}
      </div>
    </DocsLayout>
  );
}
