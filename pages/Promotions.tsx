import React from 'react';
import { PromotionBundleData } from '../types';

interface PromotionsProps {
  onSelectPromotion: (id: string) => void;
  promotions: PromotionBundleData[];
}

const Promotions: React.FC<PromotionsProps> = ({ onSelectPromotion, promotions }) => {
  const publishedPromotions = promotions.filter((item) => item.isPublished !== false);

  return (
    <div className="animate-fadeIn pb-20">
      <button
        type="button"
        onClick={() => window.location.assign('https://footnote-wizard-2.vercel.app/scripts-catalog')}
        className="mb-8 w-full text-right rounded-3xl border border-amber-400/40 bg-gradient-to-l from-amber-500/20 via-amber-400/10 to-rose-500/10 p-5 shadow-[0_0_35px_rgba(245,158,11,0.2)] transition hover:scale-[1.01] hover:border-amber-300/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70"
        aria-label="מעבר לעמוד הסקריפטים שלנו"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center rounded-full border border-amber-300/40 bg-amber-500/20 px-3 py-1 text-xs font-black text-amber-200">
            מבצע חג הפסח
          </div>
          <div className="text-xs font-bold text-amber-100/90">בתוקף עד 01.04.26</div>
        </div>
        <h2 className="mt-3 text-xl md:text-2xl font-black text-white leading-snug">
          מבצע לכבוד חג הפסח, רכישת כל סקריפט בודד מתוך החנות בסך הכל{' '}
          <span className="text-amber-300">100 ש&quot;ח</span>.
        </h2>
      </button>

      <div className="mb-12">
        <h1 className="text-4xl font-bold text-amber-500 mb-4">מבצעים</h1>
        <p className="text-slate-100">חבילות סקריפטים מיוחדות במחיר משתלם במיוחד.</p>
      </div>

      {publishedPromotions.length === 0 ? (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-8 text-center">
          <p className="text-slate-100 font-bold">כרגע אין מבצעים פעילים.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {publishedPromotions.map((promo) => (
            <button
              key={promo.id}
              type="button"
              onClick={() => onSelectPromotion(promo.id)}
              className="text-right group p-6 rounded-2xl border border-amber-500/30 bg-slate-900/40 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:bg-amber-600/5"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300">
                  חבילת מבצע
                </div>
                <div className="flex flex-col items-end">
                  {promo.originalPrice && (
                    <span className="text-white/90 text-xs line-through mb-1">{promo.originalPrice}</span>
                  )}
                  <div className="text-amber-500 font-bold">{promo.price}</div>
                </div>
              </div>

              <h3 className="text-xl font-bold mb-3 text-white">{promo.name}</h3>
              <p className="text-slate-100 text-sm leading-relaxed line-clamp-3 text-justify">{promo.shortDesc}</p>

              <div className="mt-6 flex items-center text-xs font-bold text-slate-300 group-hover:text-white transition-colors">
                לפרטים וקישורי החבילה
                <svg className="w-4 h-4 mr-1 rtl-flip" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default Promotions;
