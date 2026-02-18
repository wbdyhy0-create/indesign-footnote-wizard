
import React from 'react';
import ScriptCard from '../components/ScriptCard';
import { ScriptData } from '../types';

interface ScriptsCatalogProps {
  onSelectScript: (id: string) => void;
  scripts: ScriptData[];
}

const ScriptsCatalog: React.FC<ScriptsCatalogProps> = ({ onSelectScript, scripts }) => {
  return (
    <div className="animate-fadeIn pb-20">
      <div className="mb-12">
        <h1 className="text-4xl font-bold text-amber-500 mb-4">הסקריפטים שלנו</h1>
        <p className="text-slate-400">בחר את הכלי המתאים ביותר עבור צרכי העימוד שלך:</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {scripts.map(script => (
          <ScriptCard key={script.id} script={script} onSelect={onSelectScript} />
        ))}
      </div>
      
      <div className="mt-16 p-8 bg-amber-500/5 rounded-3xl border border-amber-500/10">
        <h3 className="text-xl font-bold mb-4 text-amber-200">גרסאות ניסיון</h3>
        <p className="text-slate-400 text-sm mb-0">
          ניתן להוריד גרסת ניסיון מלאה ל-24 שעות לכל אחד מהסקריפטים שלנו בדפי הפירוט הייעודיים.
        </p>
      </div>
    </div>
  );
};

export default ScriptsCatalog;
