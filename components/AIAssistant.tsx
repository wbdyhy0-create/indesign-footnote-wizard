
import React, { useState, useMemo } from 'react';
import { askAssistant } from '../services/geminiService';
import { ScriptData, FAQItem } from '../types';
import { FAQ as GLOBAL_FAQ } from '../constants';

interface AIAssistantProps {
  scripts: ScriptData[];
}

const AIAssistant: React.FC<AIAssistantProps> = ({ scripts }) => {
  const [query, setQuery] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Combine all local knowledge for fast search
  const localKnowledge = useMemo(() => {
    const items: { question: string, answer: string, source: string }[] = [];
    
    // Global FAQs
    GLOBAL_FAQ.forEach(f => items.push({ ...f, source: 'כללי' }));
    
    // Script Specific FAQs
    scripts.forEach(s => {
      s.faqs?.forEach(f => items.push({ ...f, source: s.name }));
      s.features.forEach(feat => items.push({ 
        question: `מה זה ${feat.title}?`, 
        answer: feat.description, 
        source: s.name 
      }));
    });
    
    return items;
  }, [scripts]);

  // Fuzzy search logic
  const filteredResults = useMemo(() => {
    if (query.length < 2) return [];
    const q = query.toLowerCase();
    return localKnowledge.filter(item => 
      item.question.toLowerCase().includes(q) || 
      item.answer.toLowerCase().includes(q) ||
      item.source.toLowerCase().includes(q)
    ).slice(0, 10); // Show more results now that we have scroll
  }, [query, localKnowledge]);

  const handleAskAI = async () => {
    if (!query.trim() || isLoading) return;
    setIsLoading(true);
    setAiResponse(null);

    const scriptsContext = scripts.map(s => 
      `סקריפט: ${s.name}. תיאור: ${s.shortDesc}. שאלות נפוצות: ${s.faqs?.map(f => f.question).join(', ')}`
    ).join('\n');

    const response = await askAssistant(query, scriptsContext);
    setAiResponse(response || "מצטער, לא מצאתי תשובה מתאימה.");
    setIsLoading(false);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="relative mb-12 group">
        <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-amber-500 to-indigo-500 rounded-3xl blur opacity-30 group-hover:opacity-60 transition duration-1000"></div>
        <div className="relative bg-slate-900 border-2 border-slate-700/50 rounded-3xl p-2 flex items-center shadow-2xl">
          <input
            type="text"
            value={query}
            onChange={(e) => {
                setQuery(e.target.value);
                setAiResponse(null);
            }}
            placeholder="במה נוכל לעזור לך היום?"
            className="flex-1 bg-transparent border-none px-6 py-5 text-xl outline-none text-white text-right placeholder:text-slate-500 font-bold"
            dir="rtl"
          />
          <button 
            onClick={handleAskAI}
            disabled={isLoading}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-10 py-5 rounded-2xl font-black transition-all flex items-center gap-3 disabled:opacity-50 shadow-lg shadow-indigo-600/20"
          >
            {isLoading ? 'מנתח...' : 'שאל AI'}
          </button>
        </div>
      </div>

      <div className="space-y-4 mb-8">
        {filteredResults.length > 0 && !aiResponse && (
          <div className="animate-fadeIn">
            <h3 className="text-sm font-black text-amber-500 uppercase tracking-widest mb-4 mr-4 flex items-center gap-2">
               <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>
               מצאנו {filteredResults.length} פתרונות מיידיים:
            </h3>
            <div className="max-h-[450px] overflow-y-auto pr-4 space-y-4 custom-scrollbar">
                {filteredResults.map((res, i) => (
                <div 
                    key={i} 
                    className="bg-slate-800 border-2 border-slate-700 p-6 rounded-3xl hover:border-indigo-500 hover:bg-slate-800/90 transition-all cursor-default group transform hover:-translate-y-1 shadow-xl"
                    style={{ animationDelay: `${i * 0.05}s` }}
                >
                    <div className="flex justify-between items-start mb-3">
                    <span className="text-[10px] bg-indigo-600 text-white px-3 py-1 rounded-full font-black uppercase tracking-tighter">{res.source}</span>
                    <h4 className="font-black text-white text-lg">{res.question}</h4>
                    </div>
                    <p className="text-base text-slate-100 leading-relaxed text-right font-medium">{res.answer}</p>
                </div>
                ))}
            </div>
          </div>
        )}

        {aiResponse && (
          <div className="animate-fadeIn bg-slate-900 border-2 border-indigo-500/30 p-10 rounded-[3rem] shadow-2xl relative overflow-hidden">
            <h3 className="text-lg font-black text-indigo-400 mb-6 text-right">תשובת המומחה:</h3>
            <div className="text-white text-lg leading-relaxed text-right whitespace-pre-wrap font-bold">
              {aiResponse}
            </div>
            <div className="mt-10 pt-6 border-t border-slate-800 flex justify-between items-center">
               <p className="text-xs text-slate-500 italic">בינה מלאכותית מבוססת Gemini.</p>
               <button onClick={() => setAiResponse(null)} className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs rounded-xl font-black transition-colors">נקה וסגור</button>
            </div>
          </div>
        )}

        {query.length < 2 && !aiResponse && (
          <div className="text-center py-16 animate-fadeIn">
            <div className="text-7xl mb-8 drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]">🔍</div>
            <h2 className="text-3xl font-black text-white mb-4">מרכז המידע של FOOTNOTE WIZARD</h2>
            <p className="text-slate-300 text-lg mb-12 max-w-lg mx-auto leading-relaxed font-bold">
              הקלד שאלה (למשל: "גימטריה" או "24 שעות") כדי לקבל תשובה מיידית מהמדריך המקצועי שלנו.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
               {['גימטריה', '24 שעות', 'סוגריים', 'ניקוי', 'מחיר'].map(tag => (
                 <button 
                    key={tag}
                    onClick={() => setQuery(tag)}
                    className="px-8 py-4 bg-slate-800 border-2 border-slate-700 rounded-2xl text-sm font-black text-white hover:bg-indigo-600 hover:border-indigo-400 transition-all transform hover:-translate-y-1 shadow-lg"
                 >
                   {tag}
                 </button>
               ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIAssistant;
