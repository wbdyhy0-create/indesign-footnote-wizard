import React from 'react';

interface HomeProps {
  onNavigateToCatalog: () => void;
}

const Home: React.FC<HomeProps> = ({ onNavigateToCatalog }) => {
  return (
    <div className="animate-fadeIn pb-16">
      <header className="text-center mb-12 pt-6">
        <div className="inline-block px-5 py-2 mb-6 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-black uppercase tracking-[0.35em] animate-pulse">
          Premium Indesign Automation
        </div>
        <h1 className="text-4xl md:text-6xl font-black mb-4 bg-gradient-to-r from-white via-amber-200 to-white bg-clip-text text-transparent leading-[0.95] tracking-tighter uppercase italic">
          FOOTNOTE<br/>WIZARD
        </h1>
        <div className="text-lg md:text-2xl font-black text-amber-500 mb-6 tracking-tight drop-shadow-[0_0_20px_rgba(245,158,11,0.5)]">
          הדור הבא של העימוד המקצועי
        </div>
        
        <p className="text-slate-400 text-sm md:text-base max-w-3xl mx-auto leading-relaxed mb-8 font-medium">
          אנחנו לא רק בונים סקריפטים, אנחנו מגדירים מחדש את גבולות האפשר באינדיזיין. 
          דיוק מושלם, מהירות חסרת תקדים ונוחות עבודה שתגרום לך להתאהב במקצוע מחדש.
        </p>
        
        <div className="flex justify-center mb-10">
          <button 
            onClick={onNavigateToCatalog}
            className="group relative px-8 md:px-10 py-4 md:py-5 bg-amber-600 text-white font-black text-lg md:text-xl rounded-[1.5rem] shadow-[0_20px_50px_rgba(245,158,11,0.3)] transition-all hover:scale-105 active:scale-95 flex items-center gap-3 md:gap-4 border border-amber-400/20 overflow-hidden"
          >
            <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
            לצפייה בקטלוג 2026
            <svg className="w-6 h-6 md:w-7 md:h-7 rtl-flip transition-transform group-hover:translate-x-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </div>
      </header>


      {/* Hero Showcase Section */}
      <section className="relative rounded-[2rem] overflow-hidden border border-amber-500/20 shadow-[0_0_100px_rgba(245,158,11,0.15)] bg-[#050b18] mb-14 p-6 md:p-10 flex flex-col lg:flex-row items-center justify-center gap-8 md:gap-10">
        {/* Image Column */}
        <div className="relative z-10 flex-shrink-0 flex flex-col items-center gap-7">
           {/* First Image */}
           <div className="w-56 h-72 md:w-64 md:h-[360px] rounded-[2rem] border-4 border-amber-500 shadow-2xl relative overflow-hidden">
             <img
               src="https://lh3.googleusercontent.com/pw/AP1GczMBJoe-Opaz1bDlFffVupO4BnWcIJrvigMM5yV8Kr0-l8IhJ-kBNySUjyluoqg9OiIYlCBSFo3XBAxZrm0HwKVRsdHYAV1cpbhHXFq_bElDZSVEl1A-0zKhFBW7MVjWNpkUQWC8GP3hOotltnX5ObVt=w213-h226-s-no-gm?authuser=0"
               alt="סרגל חבילת אשף ההערות"
               referrerPolicy="no-referrer"
               className="w-full h-full object-cover rounded-[1.5rem]"
             />
           </div>
           {/* Second Image */}
           <div className="w-full rounded-[2rem] border-4 border-amber-500 shadow-2xl relative overflow-hidden p-3">
             <img
               src="https://lh3.googleusercontent.com/pw/AP1GczPImG_1_J-rvMqGc4-orw41UUA0uwVp8leVwQ3Q9NHd7_0aMGj0vYfYE2CzblNg_GQH4q2l4BpjVb7ok7K-H_jehW4jdwhWQQrqQyTlA0T0Mm06MaqFBwQJg7RO-yJ7cjVh4MSY0KIuvMf0jU19a2Ng=w503-h202-s-no-gm?authuser=0"
               alt="תמונה נוספת"
               referrerPolicy="no-referrer"
               className="w-full h-auto object-cover rounded-[1.5rem]"
             />
           </div>
        </div>


      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { icon: '⚡', title: 'מהירות שיא', desc: 'עיבוד מאות עמודים בשניות בודדות.' },
          { icon: '🎯', title: 'דיוק מקסימלי', desc: 'מניעת שגיאות אנוש בתהליכי עימוד מורכבים.' },
          { icon: '💎', title: 'איכות פרימיום', desc: 'תוצאות מקצועיות בסטנדרט הגבוה ביותר.' }
        ].map((feat, i) => (
          <div key={i} className="p-7 bg-slate-900/40 rounded-[2rem] border border-slate-800 text-center hover:bg-slate-800/60 transition-all hover:-translate-y-2 group shadow-xl">
            <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-500">{feat.icon}</div>
            <h3 className="text-lg font-black mb-2 text-white">{feat.title}</h3>
            <p className="text-sm text-slate-500 font-bold leading-relaxed">{feat.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Home;