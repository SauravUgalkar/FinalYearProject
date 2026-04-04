import React from 'react';
import { Link } from 'react-router-dom';
import {
  GraduationCap,
  Users,
  Code2,
  Briefcase,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';

const useCases = [
  {
    title: 'Student Learning & Mentorship',
    icon: GraduationCap,
    color: 'from-blue-500/20 to-blue-600/10',
    borderColor: 'border-blue-500/30',
    highlights: [
      'Get real-time help from mentors by sharing project links',
      'Practice multiple programming languages in one workspace',
      'Never lose progress with cloud auto-save',
      'Collaborate with classmates on assignments',
      'Learn from peer code reviews'
    ],
    description: 'Perfect for students who want to learn faster with real-time feedback from mentors and peers.'
  },
  {
    title: 'Classroom Instruction',
    icon: Users,
    color: 'from-purple-500/20 to-purple-600/10',
    borderColor: 'border-purple-500/30',
    highlights: [
      'Track student progress with analytics dashboard',
      'Control classroom participation with role-based access',
      'See exactly where students are looking in real-time',
      'Run and verify student code instantly',
      'Provide immediate feedback during lessons',
      'Manage multiple student groups efficiently'
    ],
    description: 'Designed for educators who need to manage classrooms with live collaboration and progress tracking.'
  },
  {
    title: 'Developer Pair Programming',
    icon: Code2,
    color: 'from-emerald-500/20 to-emerald-600/10',
    borderColor: 'border-emerald-500/30',
    highlights: [
      'Sync with GitHub repositories seamlessly',
      'Use VS Code-grade Monaco Editor',
      'Organize work with multi-file structure',
      'Conflict-free simultaneous editing',
      'Brainstorm and code together in real-time',
      'Share execution outputs instantly'
    ],
    description: 'Built for developers who want professional-grade pair programming and collaboration tools.'
  },
  {
    title: 'Technical Interviews',
    icon: Briefcase,
    color: 'from-orange-500/20 to-orange-600/10',
    borderColor: 'border-orange-500/30',
    highlights: [
      'Conduct interviews with live code execution',
      'See candidate solutions in real-time',
      'Test code instantly without setup',
      'Evaluate problem-solving approach interactively',
      'Record session for later review',
      'Use multi-language support for any stack'
    ],
    description: 'Perfect for technical interviews where you need immediate code execution and evaluation.'
  },
];

export default function UseCasesPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.16),_transparent_28%),radial-gradient(circle_at_85%_20%,_rgba(251,146,60,0.14),_transparent_24%),linear-gradient(135deg,_#020617_0%,_#0f172a_45%,_#111827_100%)] text-white">
      <Header />

      <main className="mx-auto max-w-6xl px-6 py-12 sm:px-8 lg:px-10">
        <section className="text-center">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Use Cases</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-300">
            CollabCode works for students, teachers, developers, and interviewers. See how it fits your workflow.
          </p>
        </section>

        <section className="mt-16 space-y-8">
          {useCases.map((useCase) => {
            const Icon = useCase.icon;
            return (
              <div
                key={useCase.title}
                className={`rounded-3xl border ${useCase.borderColor} bg-gradient-to-br ${useCase.color} p-6 sm:p-8 shadow-[0_16px_60px_rgba(2,6,23,0.34)] backdrop-blur`}
              >
                <div className="grid gap-8 md:grid-cols-[auto_1fr]">
                  <div className="flex h-fit flex-col gap-4">
                    <div className="rounded-2xl border border-white/20 bg-white/[0.08] p-4 backdrop-blur">
                      <Icon size={32} className="text-cyan-200" />
                    </div>
                  </div>

                  <div>
                    <h2 className="text-2xl font-semibold sm:text-3xl">{useCase.title}</h2>
                    <p className="mt-2 text-base text-slate-300">{useCase.description}</p>

                    <div className="mt-6 grid gap-3 sm:grid-cols-2">
                      {useCase.highlights.map((highlight, idx) => (
                        <div key={idx} className="flex gap-3">
                          <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-cyan-300" />
                          <span className="text-sm leading-6 text-slate-200">{highlight}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        <section className="mt-16 rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center shadow-[0_16px_60px_rgba(2,6,23,0.34)] backdrop-blur">
          <h2 className="text-3xl font-semibold tracking-tight">See if your use case fits</h2>
          <p className="mx-auto mt-3 max-w-2xl text-slate-300">Every use case is supported with dedicated features and optimal workflows.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/register" className="inline-flex items-center gap-2 rounded-2xl bg-cyan-300 px-6 py-3 text-sm font-semibold text-slate-900 transition hover:-translate-y-1 hover:bg-cyan-200">
              Start For Free
              <ArrowRight size={15} />
            </Link>
            <Link to="/docs" className="rounded-2xl border border-white/20 bg-white/[0.05] px-6 py-3 text-sm font-medium transition hover:-translate-y-1 hover:bg-white/10">
              View Docs
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
