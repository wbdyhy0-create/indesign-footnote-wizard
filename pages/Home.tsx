
import React from 'react';

interface HomeProps {
  onNavigateToCatalog: () => void;
}

const Home: React.FC<HomeProps> = ({ onNavigateToCatalog }) => {
  return (
    <div className="animate-fadeIn pb-24">
      <header className="text-center mb-24 pt-12">
        <div className="inline-block px-6 py-2 mb-8 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-black uppercase tracking-[0.4em] animate-pulse">
          Premium Indesign Automation
        </div>
        <h1 className="text-6xl md:text-8xl font-black mb-6 bg-gradient-to-r from-white via-amber-200 to-white bg-clip-text text-transparent leading-[0.9] tracking-tighter uppercase italic">
          FOOTNOTE<br/>WIZARD
        </h1>
        <div className="text-2xl md:text-4xl font-black text-amber-500 mb-12 tracking-tight drop-shadow-[0_0_20px_rgba(245,158,11,0.5)]">
          הדור הבא של העימוד המקצועי
        </div>
        
        <p className="text-slate-400 text-lg md:text-xl max-w-3xl mx-auto leading-relaxed mb-16 font-medium">
          אנחנו לא רק בונים סקריפטים, אנחנו מגדירים מחדש את גבולות האפשר באינדיזיין. 
          דיוק מושלם, מהירות חסרת תקדים ונוחות עבודה שתגרום לך להתאהב במקצוע מחדש.
        </p>
        
        <div className="flex justify-center mb-16">
          <button 
            onClick={onNavigateToCatalog}
            className="group relative px-14 py-7 bg-amber-600 text-white font-black text-2xl rounded-[2rem] shadow-[0_20px_50px_rgba(245,158,11,0.3)] transition-all hover:scale-105 active:scale-95 flex items-center gap-6 border border-amber-400/20 overflow-hidden"
          >
            <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
            לצפייה בקטלוג 2026
            <svg className="w-8 h-8 rtl-flip transition-transform group-hover:translate-x-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </div>
      </header>

      {/* Hero Showcase Section */}
      <section className="relative rounded-[3rem] overflow-hidden border border-amber-500/20 shadow-[0_0_100px_rgba(245,158,11,0.15)] bg-[#050b18] mb-24 p-12 md:p-24 flex flex-col lg:flex-row items-center gap-16">
        <div className="relative z-10 flex-shrink-0">
           <div className="w-64 h-80 md:w-80 md:h-[450px] bg-slate-900 rounded-[3rem] border-8 border-slate-800 shadow-2xl relative flex flex-col items-center justify-center overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-t from-amber-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="text-9xl animate-bounce [animation-duration:4s]">✒️</div>
              <div className="absolute bottom-10 left-0 w-full text-center text-amber-500 font-black text-xs tracking-widest uppercase">System Active</div>
           </div>
           <div className="absolute -inset-20 bg-amber-500/10 blur-[100px] rounded-full animate-pulse pointer-events-none"></div>
        </div>

        <div className="text-right flex-1">
           <span className="px-4 py-1.5 bg-amber-500/20 text-amber-500 text-[10px] font-black uppercase tracking-[0.3em] rounded-full mb-6 inline-block">Established 2026</span>
           <h2 className="text-6xl md:text-8xl font-black text-white mb-8 tracking-tighter leading-none italic uppercase">DESIGN<br/>REVOLUTION</h2>
           <p className="text-slate-300 text-lg md:text-xl leading-relaxed mb-10 max-w-xl font-bold">
             הסקריפטים שלנו נבנו "מהשטח" על ידי מעמדים עבור מעמדים. כל שורת קוד נכתבה כדי לפתור בעיה אמיתית ולחסוך לך זמן יקר.
           </p>
           <div className="flex gap-4">
              <div className="w-3 h-3 rounded-full bg-amber-500"></div>
              <div className="w-3 h-3 rounded-full bg-amber-500/40"></div>
              <div className="w-3 h-3 rounded-full bg-amber-500/10"></div>
           </div>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
        {[
          { icon: '⚡', title: 'מהירות שיא', desc: 'עיבוד מאות עמודים בשניות בודדות.' },
          { icon: '🎯', title: 'דיוק מקסימלי', desc: 'מניעת שגיאות אנוש בתהליכי עימוד מורכבים.' },
          { icon: '💎', title: 'איכות פרימיום', desc: 'תוצאות מקצועיות בסטנדרט הגבוה ביותר.' }
        ].map((feat, i) => (
          <div key={i} className="p-10 bg-slate-900/40 rounded-[2.5rem] border border-slate-800 text-center hover:bg-slate-800/60 transition-all hover:-translate-y-2 group shadow-xl">
            <div className="text-5xl mb-6 group-hover:scale-110 transition-transform duration-500">{feat.icon}</div>
            <h3 className="text-xl font-black mb-3 text-white">{feat.title}</h3>
            <p className="text-sm text-slate-500 font-bold leading-relaxed">{feat.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Home;
