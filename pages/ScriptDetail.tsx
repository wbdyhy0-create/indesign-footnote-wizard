import React, { useState } from 'react';
import PurchaseModal from '../components/PurchaseModal'; // ייבוא טופס הלידים והרכישה
import TrialModal from '../components/TrialModal';

interface ScriptDetailProps {
  product: any;
  onBack: () => void;
}

const ProductDetail: React.FC<ScriptDetailProps> = ({ product, onBack }) => {
  // סטייט לניהול הפתיחה והסגירה של חלונות הרכישה וגרסת הניסיון
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [isTrialModalOpen, setIsTrialModalOpen] = useState(false);

  // תיקון אוטומטי לקישורי יוטיוב (אם תשים סרטון לספר)
  const formatYouTubeUrl = (url: string) => {
    if (!url) return '';
    if (url.includes('embed')) return url;
    const videoId = url.split('v=')[1]?.split('&')[0] || url.split('/').pop();
    return `https://www.youtube.com/embed/${videoId}`;
  };

  const embedUrl = product.videoUrl ? formatYouTubeUrl(product.videoUrl) : '';
  
  // בדיקה אם קיים קישור הורדה / גרסת ניסיון
  const isPurchaseAvailable = !!product.downloadUrl;
  const hasTrial = !!product.trialDownloadUrl;
  const guideUrl = typeof product.guideUrl === 'string' ? product.guideUrl.trim() : '';
  const hasGuide = guideUrl.length > 0;

  const longDescription = product.fullDesc || product.description || product.shortDesc;
  const introBody =
    (typeof product.description === 'string' && product.description.trim()) ||
    (typeof product.shortDesc === 'string' && product.shortDesc.trim()) ||
    '';
  const features = Array.isArray(product.features) ? product.features : [];
  const hasFeatures = features.length > 0;

  return (
    <div className="animate-fadeIn pb-16 max-w-6xl mx-auto px-4 md:px-6 mt-8">
      
      {/* כפתור חזור */}
      <button 
        onClick={onBack} 
        className="group flex items-center gap-3 text-slate-400 hover:text-amber-500 font-bold mb-8 transition-colors"
      >
        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
          <svg className="w-5 h-5 rtl-flip" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
        </div>
        חזור לרשימת המוצרים
      </button>

      {/* אזור התוכן המרכזי */}
      <div className="bg-[#0b1121] border border-slate-800 rounded-[3rem] p-6 md:p-10 shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-600 via-amber-400 to-amber-600 opacity-50"></div>

        <div className="flex flex-col lg:flex-row gap-10 items-center lg:items-start">
          
          {/* צד ימין - פרטי הסקריפט */}
          <div className="flex-1 space-y-8 text-right">
            <div>
              <div className="inline-block px-4 py-1.5 mb-6 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-black uppercase tracking-widest">
                מידע על המוצר
              </div>
              <h1 className="text-3xl md:text-5xl font-black text-white leading-tight mb-5">
                {product.name}
              </h1>
              {introBody && (
                <p className="text-base md:text-lg text-slate-400 leading-relaxed font-medium text-justify whitespace-pre-line">
                  {introBody}
                </p>
              )}
            </div>
            
            <div className="pt-8 border-t border-slate-800">
              <div className="text-sm text-slate-500 font-bold mb-2">מחיר רכישה:</div>
              <div className="text-4xl md:text-5xl font-black text-amber-500 drop-shadow-[0_0_15px_rgba(245,158,11,0.3)]">
                {product.price}
              </div>
            </div>

            {/* כפתורי הרכישה וגרסת הניסיון */}
            <div className="space-y-3">
              <button 
                onClick={() => setIsPurchaseModalOpen(true)}
                disabled={!isPurchaseAvailable}
                className={`w-full md:w-auto flex items-center justify-center gap-4 px-10 py-5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 text-lg md:text-xl font-black rounded-2xl shadow-[0_15px_40px_rgba(245,158,11,0.3)] transition-all border border-amber-400/50 ${isPurchaseAvailable ? 'hover:scale-105 active:scale-95' : 'opacity-50 cursor-not-allowed'}`}
              >
                לרכישה והורדה מיידית
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              </button>
              {hasTrial && (
                <button
                  onClick={() => setIsTrialModalOpen(true)}
                  className="w-full md:w-auto flex items-center justify-center gap-3 px-10 py-3 rounded-2xl border border-emerald-500/60 text-emerald-400 text-sm font-black bg-transparent hover:bg-emerald-500/10 transition-all"
                >
                  הורד גרסת ניסיון
                </button>
              )}
              {!isPurchaseAvailable && (
                <p className="text-red-400 text-sm mt-1 font-bold">שימו לב: טרם הוזן קישור הורדה למוצר זה במערכת הניהול.</p>
              )}
            </div>
          </div>

          {/* צד שמאל - תמונה / אייקון; כפתור מדריך תמיד מתחת לתמונה */}
          <div className="flex-1 w-full lg:w-auto relative flex flex-col gap-4">
            {product.imageUrl ? (
              <div className="w-full rounded-[2rem] overflow-hidden shadow-2xl border border-slate-800 bg-slate-900 flex justify-center items-center p-4">
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-full h-auto max-h-[500px] object-contain rounded-xl"
                />
              </div>
            ) : (
              <div className="w-full aspect-square rounded-[2rem] overflow-hidden shadow-2xl border border-slate-800 bg-slate-950 flex justify-center items-center">
                <span className="text-9xl z-10 hover:scale-110 transition-transform duration-700">
                  {product.image || '✒️'}
                </span>
              </div>
            )}
            {hasGuide && (
              <a
                href={guideUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-3 px-6 py-3 rounded-2xl border border-sky-500/60 text-sky-300 text-sm font-black bg-transparent hover:bg-sky-500/10 transition-all shrink-0"
              >
                📄 פתח מדריך (גוגל דרייב)
              </a>
            )}
          </div>
        </div>
      </div>

      {/* אזור וידאו מודגש כמו בדף המוצרים הנוספים */}
      {embedUrl && (
        <div className="mt-6 bg-gradient-to-r from-[#020617] via-[#0b1121] to-black border border-red-600/40 rounded-[2.5rem] p-6 md:p-8 shadow-[0_0_60px_rgba(0,0,0,0.7)]">
          <div className="flex flex-col lg:flex-row-reverse items-stretch gap-10">
            <div className="flex-1 text-right space-y-4 min-w-0">
              <h2 className="text-2xl md:text-3xl font-black text-white">סרטון הדרכה מלא</h2>
              <p className="text-slate-300 text-sm md:text-base leading-relaxed text-justify">
                צפה בסרטון שמציג בפירוט את כל היכולות של {product.name} וכיצד להפיק ממנו את המקסימום.
              </p>
              <div
                className="inline-flex items-center gap-2 rounded-2xl bg-red-600 px-6 py-3 text-white font-black text-sm md:text-base shadow-lg shadow-red-700/40 select-none cursor-default outline-none [&_*]:pointer-events-none"
                style={{ pointerEvents: 'none' }}
                tabIndex={-1}
                aria-hidden="true"
              >
                <svg
                  className="h-5 w-5 shrink-0 opacity-95 rotate-90 lg:rotate-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path d="M9 5l7 7-7 7" />
                </svg>
                <span className="pointer-events-none">צפה בסרטון הדרכה</span>
              </div>
            </div>
            <div className="flex-1 w-full min-w-0 flex flex-col self-stretch" id="script-video-section">
              {/* h-0 + pb-[56.25%]: מילוי אמיתי 16:9 בתוך פלקס; scale מכסה letterbox פנימי של יוטיוב */}
              <div className="overflow-hidden rounded-2xl border border-red-500/40 bg-black shadow-2xl leading-none">
                <div className="relative h-0 w-full pb-[56.25%]">
                  <div className="absolute inset-0 overflow-hidden">
                    <iframe
                      src={embedUrl}
                      title={`סרטון הדרכה — ${product.name}`}
                      className="absolute left-1/2 top-1/2 block h-full w-full max-w-none -translate-x-1/2 -translate-y-1/2 origin-center scale-[1.1] border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* תיבות Features / יכולות מרכזיות */}
      {hasFeatures && (
        <section className="mt-10">
          <div className="flex flex-col md:flex-row-reverse md:items-center md:justify-between gap-4 mb-6">
            <div className="text-right">
              <h2 className="text-2xl md:text-3xl font-black text-white mb-2">יכולות מרכזיות / מה הסקריפט יודע לעשות</h2>
              {longDescription && (
                <p className="text-sm md:text-base text-slate-400 leading-relaxed max-w-2xl text-justify whitespace-pre-line">
                  {longDescription}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 justify-end">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-xs font-black tracking-[0.2em] text-emerald-400 uppercase">
                FEATURES
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {features.map((feat: any, index: number) => {
              const isString = typeof feat === 'string';
              const title = isString
                ? `יכולת ${index + 1}`
                : feat.title || `יכולת ${index + 1}`;
              const description = isString
                ? feat
                : feat.description || '';

              return (
                <div
                  key={index}
                  className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 flex flex-col gap-3 hover:border-emerald-400/40 hover:bg-slate-900 transition-all shadow-lg"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className="text-lg font-black text-white">{title}</h3>
                    <span className="text-[10px] px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 font-black">
                      #{index + 1}
                    </span>
                  </div>
                  {description && (
                    <p className="text-sm text-slate-300 leading-relaxed text-justify whitespace-pre-line">
                      {description}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* --- חלון הלידים והרכישה --- */}
      <PurchaseModal 
        script={product} 
        isOpen={isPurchaseModalOpen} 
        onClose={() => setIsPurchaseModalOpen(false)} 
      />
      {/* --- חלון גרסת הניסיון --- */}
      <TrialModal 
        script={product}
        isOpen={isTrialModalOpen}
        onClose={() => setIsTrialModalOpen(false)}
      />

    </div>
  );
};

export default ProductDetail;