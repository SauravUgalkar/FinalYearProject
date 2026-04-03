import React from 'react';

export default function FeatureCard({ title, description, icon: Icon }) {
  return (
    <article className="group rounded-3xl border border-white/10 bg-white/[0.05] p-6 shadow-[0_16px_60px_rgba(2,6,23,0.34)] backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-cyan-300/30">
      <div className="mb-4 inline-flex rounded-2xl border border-cyan-300/25 bg-cyan-300/10 p-3 text-cyan-100 transition group-hover:scale-105">
        <Icon size={20} />
      </div>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-slate-300">{description}</p>
    </article>
  );
}
