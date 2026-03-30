
import React from 'react';
import ScriptCard from '../components/ScriptCard';
import { ScriptData } from '../types';

interface ScriptsCatalogProps {
  onSelectScript: (id: string) => void;
  scripts: ScriptData[];
}

const ScriptsCatalog: React.FC<ScriptsCatalogProps> = ({ onSelectScript, scripts }) => {
  const publishedScripts = scripts.filter((s) => s.isPublished !== false);
  return (
    <div className="animate-fadeIn pb-20">
      <a
        href="https://footnote-wizard-2.vercel.app/promotions"
        className="mb-8 block w-full cursor-pointer rounded-3xl border border-amber-400/40 bg-gradient-to-l from-amber-500/20 via-amber-400/10 to-rose-500/10 p-5 shadow-[0_0_35px_rgba(245,158,11,0.2)] transition hover:scale-[1.01] hover:border-amber-300/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70"
        aria-label="מעבר לעמוד המבצעים"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center rounded-full border border-amber-300/40 bg-amber-500/20 px-3 py-1 text-xs font-black text-amber-200">
            מבצע חג הפסח
          </div>
          <div className="text-xs font-bold text-amber-100/90">
            בתוקף עד 01.04.26
          </div>
        </div>
        <h2 className="mt-3 text-2xl md:text-3xl font-black text-white">
          כל סקריפט ב־<span className="text-amber-300">100 ש"ח בלבד</span>
        </h2>
        <p className="mt-2 text-sm text-slate-100">
          הזדמנות חגיגית לזמן מוגבל - בחרו סקריפט וקבלו מחיר מבצע מיוחד.
        </p>
      </a>

      <div className="mb-12">
        <h1 className="text-4xl font-bold text-amber-500 mb-4">הסקריפטים שלנו</h1>
        <p className="text-slate-400">בחר את הכלי המתאים ביותר עבור צרכי העימוד שלך:</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {publishedScripts.map(script => (
          <ScriptCard key={script.id} script={script} onSelect={onSelectScript} />
        ))}
      </div>
    </div>
  );
};

export default ScriptsCatalog;
