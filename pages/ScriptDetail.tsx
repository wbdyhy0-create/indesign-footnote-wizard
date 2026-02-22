
import React, { useState } from 'react';
import { ScriptData } from '../types';
import PurchaseModal from '../components/PurchaseModal';
import TrialModal from '../components/TrialModal';

interface ScriptDetailProps {
  script: ScriptData;
}

const ScriptDetail: React.FC<ScriptDetailProps> = ({ script }) => {
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [isTrialModalOpen, setIsTrialModalOpen] = useState(false);

  const getOriginalUrl = (embedUrl: string) => {
    if (embedUrl.includes('/embed/')) {
      const videoId = embedUrl.split('/embed/')[1]?.split('?')[0];
      return `https://www.youtube.com/watch?v=${videoId}`;
    }
    return embedUrl;
  };

  const scrollToVideo = () => {
    const videoSection = document.getElementById('video-demo');
    if (videoSection) {
      videoSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const externalVideoUrl = getOriginalUrl(script.videoUrl);

  const isTrialAvailable = script.trialDownloadUrl && script.isTrialDownloadable;
  const isPurchaseAvailable = script.downloadUrl && script.isDownloadable;

  return (
    <div className="animate-fadeIn">
      <nav className="mb-10">
          <button onClick={() => window.history.back()} className="text-slate-400 hover:text-white flex items-center gap-2 text-sm font-bold transition-colors">
            <svg className="w-4 h-4 rtl-flip" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            חזרה לכל הסקריפטים
          </button>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div className="lg:col-span-2">
          <h1 className="text-4xl md:text-5xl font-bold mb-6 text-amber-500">{script.name}</h1>
          <p className="text-lg text-slate-300 mb-8 leading-relaxed">
            {script.fullDesc}
          </p>

          <div className="mb-20 space-y-6">

           <button 
             onClick={() => setIsTrialModalOpen(true)}
             disabled={!isTrialAvailable}
             className={`w-full flex items-center justify-center gap-3 px-6 py-5 bg-slate-800 text-slate-200 font-bold rounded-2xl transition-all border border-slate-700 shadow-xl group active:scale-95 ${isTrialAvailable ? 'hover:bg-slate-700' : 'opacity-50 cursor-not-allowed'}`}
           >
             <svg className="w-6 h-6 text-amber-500 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
             </svg>
             הורד גרסת ניסיון חינם
           </button>
           {!isTrialAvailable && (
             <p className="text-xs text-red-400 text-center -mt-4">
               גרסת ניסיון אינה זמינה כרגע עבור סקריפט זה.
             </p>
           )}

           <div className="bg-gradient-to-br from-amber-600 to-amber-700 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden text-right">
              <div className="flex flex-col items-end mb-8 relative z-10">
                 {script.originalPrice && (
                   <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 bg-white text-amber-700 text-[10px] font-black rounded-full animate-bounce">מבצע!</span>
                      <span className="text-sm font-bold opacity-60 line-through">{script.originalPrice}</span>
                   </div>
                 )}
                 <div className="text-sm font-bold opacity-80 mb-1 uppercase tracking-widest">מחיר רכישה</div>
                 <div className="text-5xl font-black drop-shadow-lg">{script.price}</div>
              </div>

              <ul className="space-y-4 mb-8 text-sm opacity-90 relative z-10">
                <li className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-amber-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                  רישיון לכל החיים (ללא מנוי)
                </li>
                <li className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-amber-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                  תמיכה אישית
                </li>
              </ul>
              <button 
                onClick={() => setIsPurchaseModalOpen(true)}
                disabled={!isPurchaseAvailable}
                className={`w-full py-4 bg-white text-amber-700 font-black rounded-2xl shadow-xl active:scale-95 text-lg relative z-10 ${isPurchaseAvailable ? 'hover:bg-slate-50' : 'opacity-50 cursor-not-allowed'}`}
              >
                רכישה מאובטחת עכשיו
              </button>
              {!isPurchaseAvailable && (
                <p className="text-xs text-red-100 text-center mt-2">
                  רכישה אינה זמינה כרגע עבור סקריפט זה.
                </p>
              )}
           </div>
          </div>

           <section id="video-demo" className="mb-12 scroll-mt-20 mt-20">
            <h2 className="text-2xl font-bold mb-6 flex items-center">
              <span className="w-8 h-8 rounded-lg bg-red-500/20 text-red-500 flex items-center justify-center ml-3">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg>
              </span>
              מדריך וידאו והפעלה
            </h2>

            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-[2.5rem] p-8 md:p-12 border border-slate-700 shadow-2xl text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500/50 to-transparent"></div>
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-20 h-20 bg-red-600/10 rounded-full flex items-center justify-center mb-6 border border-red-500/20 shadow-inner">
                   <svg className="w-10 h-10 text-red-500 animate-pulse" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                </div>
                <h3 className="text-xl font-bold mb-3 text-white">איך להפיק את המקסימום מ{script.name}?</h3>
                <p className="text-slate-400 text-sm max-w-md mx-auto mb-8 leading-relaxed">
                  הכנו עבורכם מדריך מפורט ב-YouTube שמסביר שלב אחר שלב איך להתקין ולהפעיל את הסקריפט בצורה הטובה ביותר.
                </p>
                <a 
                  href={externalVideoUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-4 px-10 py-5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-2xl shadow-2xl shadow-red-900/30 transition-all hover:scale-105 active:scale-95 text-lg"
                >
                  לצפייה ישירה במדריך
                </a>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-6 flex items-center">
              <span className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-500 flex items-center justify-center ml-3">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
              </span>
              יכולות מרכזיות
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {script.features.map((feature, i) => (
                <div key={i} className="p-5 bg-slate-900/50 rounded-2xl border border-slate-800 hover:border-emerald-500/30 transition-colors text-right">
                  <h3 className="font-bold text-emerald-400 mb-2">{feature.title}</h3>
                  <p className="text-sm text-slate-400">{feature.description}</p>
                </div>
              ))}
            </div>
          </section>
        </div>


      </div>

      <PurchaseModal 
        script={script} 
        isOpen={isPurchaseModalOpen} 
        onClose={() => setIsPurchaseModalOpen(false)} 
      />
      <TrialModal 
        script={script} 
        isOpen={isTrialModalOpen} 
        onClose={() => setIsTrialModalOpen(false)} 
      />
    </div>
  );
};

export default ScriptDetail;