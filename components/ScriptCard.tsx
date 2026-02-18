
import React from 'react';
import { ScriptData } from '../types';

interface ScriptCardProps {
  script: ScriptData;
  onSelect: (id: string) => void;
}

const ScriptCard: React.FC<ScriptCardProps> = ({ script, onSelect }) => {
  const colorMap: Record<string, string> = {
    blue: 'border-blue-500/30 hover:bg-blue-600/5 group-hover:text-blue-400',
    emerald: 'border-emerald-500/30 hover:bg-emerald-600/5 group-hover:text-emerald-400',
    purple: 'border-purple-500/30 hover:bg-purple-600/5 group-hover:text-purple-400',
  };

  const badgeMap: Record<string, string> = {
    blue: 'bg-blue-500/20 text-blue-400',
    emerald: 'bg-emerald-500/20 text-emerald-400',
    purple: 'bg-purple-500/20 text-purple-400',
  };

  return (
    <div 
      onClick={() => onSelect(script.id)}
      className={`group cursor-pointer p-6 rounded-2xl border bg-slate-900/40 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl ${colorMap[script.color] || colorMap.blue}`}
    >
      <div className="flex justify-between items-start mb-4">
        <div className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider ${badgeMap[script.color] || badgeMap.blue}`}>
          {script.originalPrice ? 'מבצע חם' : 'Pro Script'}
        </div>
        <div className="flex flex-col items-end">
          {script.originalPrice && (
            <span className="text-slate-500 text-xs line-through mb-1 opacity-70">{script.originalPrice}</span>
          )}
          <div className="text-amber-500 font-bold">{script.price}</div>
        </div>
      </div>
      <h3 className="text-xl font-bold mb-3 transition-colors">{script.name}</h3>
      <p className="text-slate-400 text-sm leading-relaxed line-clamp-3">
        {script.shortDesc}
      </p>
      <div className="mt-6 flex items-center text-xs font-bold text-slate-500 group-hover:text-white transition-colors">
        לפרטים נוספים ומדריך הפעלה
        <svg className="w-4 h-4 mr-1 rtl-flip" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
      </div>
    </div>
  );
};

export default ScriptCard;
