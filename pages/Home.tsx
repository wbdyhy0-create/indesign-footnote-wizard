import React from 'react';

interface HomeProps {
  onNavigateToCatalog: () => void;
}

const Home: React.FC<HomeProps> = ({ onNavigateToCatalog }) => {
  return (
    <div className="animate-fadeIn pb-16">
      {/* Hero קומפקטי עם ויזואל מרכזי אחד */}
      <section className="mb-20 mt-6 rounded-[3rem] border border-amber-500/20 bg-[#050b18] shadow-[0_0_80px_rgba(15,23,42,0.9)] overflow-hidden px-6 py-10 md:px-10 md:py-12 lg:px-14 lg:py-14 flex flex-col lg:flex-row items-center gap-10 lg:gap-14">
        {/* תוכן טקסטואלי */}
        <header className="flex-1 text-center lg:text-right">
          <div className="inline-block px-4 py-2 mb-4 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-black uppercase tracking-[0.35em]">
            Premium Indesign Automation
          </div>
          <h1 className="text-4xl md:text-5xl font-black mb-4 bg-gradient-to-r from-white via-amber-200 to-white bg-clip-text text-transparent leading-tight tracking-tighter uppercase italic">
            FOOTNOTE WIZARD
          </h1>
          <div className="text-lg md:text-2xl font-black text-amber-500 mb-5 tracking-tight">
            הדור הבא של העימוד המקצועי
          </div>
          
          <p className="text-slate-400 text-sm md:text-base lg:text-lg max-w-xl mx-auto lg:mx-0 leading-relaxed mb-6 font-medium">
            אנחנו לא רק בונים סקריפטים, אנחנו מגדירים מחדש את גבולות האפשר באינדיזיין.
            דיוק מושלם, מהירות חסרת תקדים ונוחות עבודה שתגרום לך להתאהב במקצוע מחדש.
          </p>
          
          <div className="flex justify-center lg:justify-start">
            <button 
              onClick={onNavigateToCatalog}
              className="group relative px-8 md:px-10 py-4 md:py-5 bg-amber-600 text-white font-black text-lg md:text-xl rounded-[1.75rem] shadow-[0_14px_35px_rgba(245,158,11,0.28)] transition-all hover:scale-105 active:scale-95 flex items-center gap-3 md:gap-4 border border-amber-400/30 overflow-hidden"
            >
              <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-900"></div>
              לצפייה בקטלוג 2026
              <svg className="w-6 h-6 md:w-7 md:h-7 rtl-flip transition-transform group-hover:translate-x-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>
        </header>

        {/* ויזואל מרכזי אחד */}
        <div className="flex-1 flex justify-center lg:justify-end">
          <div className="w-64 h-80 md:w-80 md:h-[420px] lg:w-80 lg:h-[440px] rounded-[2.75rem] border-[7px] md:border-8 border-amber-500 shadow-2xl shadow-amber-500/25 relative overflow-hidden bg-slate-900/60">
            <img
              src="https://lh3.googleusercontent.com/pw/AP1GczMBJoe-Opaz1bDlFffVupO4BnWcIJrvigMM5yV8Kr0-l8IhJ-kBNySUjyluoqg9OiIYlCBSFo3XBAxZrm0HwKVRsdHYAV1cpbhHXFq_bElDZSVEl1A-0zKhFBW7MVjWNpkUQWC8GP3hOotltnX5ObVt=w213-h226-s-no-gm?authuser=0"
              alt="סרגל אשף ההערות בפעולה בתוך אינדיזיין"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover rounded-[2.2rem]"
            />
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