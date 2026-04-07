
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
