import React, { useState } from 'react';
import PurchaseModal from '../components/PurchaseModal';

interface ProductDetailProps {
  product: any;
  onBack: () => void;
}

const ProductDetail: React.FC<ProductDetailProps> = ({ product, onBack }) => {
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);

  // תיקון אוטומטי לקישורי יוטיוב
  const formatYouTubeUrl = (url: string) => {
    if (!url) return '';
    if (url.includes('embed')) return url;
    const videoId = url.split('v=')[1]?.split('&')[0] || url.split('/').pop();
    return `https://www.youtube.com/embed/${videoId}`;
  };

  const embedUrl = product.videoUrl ? formatYouTubeUrl(product.videoUrl) : '';
  const isPurchaseAvailable = !!product.downloadUrl;

  const longDescription = product.fullDesc || product.description || product.shortDesc;
  const features = Array.isArray(product.features) ? product.features : [];
  const hasFeatures = features.length > 0;

  return (
    <div className="animate-fadeIn pb-24 max-w-7xl mx-auto px-4 md:px-8 mt-12">
      
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
      <div className="bg-[#0b1121] border border-slate-800 rounded-[3rem] p-8 md:p-16 shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-600 via-amber-400 to-amber-600 opacity-50"></div>
        
        <div className="flex flex-col lg:flex-row gap-16 items-center lg:items-start">
          
          {/* צד ימין - פרטי הספר/המוצר */}
          <div className="flex-1 space-y-10 text-right">
            <div>
              <div className="inline-block px-4 py-1.5 mb-6 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-black uppercase tracking-widest">
                מידע על המוצר
              </div>
              <h1 className="text-4xl md:text-6xl font-black text-white leading-tight mb-6">
                {product.name}
              </h1>
              <p className="text-lg md:text-xl text-slate-400 leading-relaxed font-medium">
                {product.description}
              </p>
            </div>
            
            <div className="pt-8 border-t border-slate-800">
              <div className="text-sm text-slate-500 font-bold mb-2">מחיר רכישה:</div>
              <div className="text-5xl font-black text-amber-500 drop-shadow-[0_0_15px_rgba(245,158,11,0.3)]">
                {product.price}
              </div>
            </div>

            {/* כפתור הרכישה שפותח את הפופ-אפ עכשיו */}
            <div>
              <button 
                onClick={() => setIsPurchaseModalOpen(true)}
                disabled={!isPurchaseAvailable}
                className={`w-full md:w-auto flex items-center justify-center gap-4 px-12 py-6 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 text-xl font-black rounded-2xl shadow-[0_15px_40px_rgba(245,158,11,0.3)] transition-all border border-amber-400/50 ${isPurchaseAvailable ? 'hover:scale-105 active:scale-95' : 'opacity-50 cursor-not-allowed'}`}
              >
                לרכישה והורדה מיידית
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              </button>
              {!isPurchaseAvailable && (
                <p className="text-red-400 text-sm mt-3 font-bold">שימו לב: טרם הוזן קישור הורדה למוצר זה במערכת הניהול.</p>
              )}
            </div>
          </div>

          {/* צד שמאל - תמונה / אייקון בלבד (הוידאו מופיע באזור הוידאו למטה) */}
          <div className="flex-1 w-full lg:w-auto relative">
            {product.imageUrl ? (
              <div className="w-full rounded-[2rem] overflow-hidden shadow-2xl border border-slate-800 bg-slate-900 flex justify-center items-center p-4">
                <img src={product.imageUrl} alt={product.name} className="w-full h-auto max-h-[500px] object-contain rounded-xl" />
              </div>
            ) : (
              <div className="w-full aspect-square rounded-[2rem] overflow-hidden shadow-2xl border border-slate-800 bg-slate-950 flex justify-center items-center">
                 <span className="text-9xl z-10 hover:scale-110 transition-transform duration-700">
                  {product.image || '📘'}
                 </span>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* אזור וידאו מודגש כמו בדף המוצרים הנוספים */}
      {embedUrl && (
        <div className="mt-12 bg-gradient-to-r from-[#020617] via-[#0b1121] to-black border border-red-600/40 rounded-[2.5rem] p-6 md:p-10 shadow-[0_0_60px_rgba(0,0,0,0.7)]">
          <div className="flex flex-col lg:flex-row-reverse items-center gap-10">
            <div className="flex-1 text-right space-y-4">
              <h2 className="text-2xl md:text-3xl font-black text-white">סרטון הדגמה מלא</h2>
              <p className="text-slate-300 text-sm md:text-base leading-relaxed">
                צפה בסרטון שמציג כיצד להשתמש ב-{product.name} שלב-אחר-שלב, עם כל הטיפים החשובים לעבודה חלקה.
              </p>
              <button
                onClick={() => {
                  const iframe = document.getElementById('product-video-section');
                  if (iframe && 'scrollIntoView' in iframe) {
                    (iframe as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }
                }}
                className="inline-flex items-center justify-center px-10 py-3 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-black text-sm md:text-base shadow-lg shadow-red-700/40 transition-transform hover:scale-105 active:scale-95"
              >
                ▶️ צפה עכשיו בסרטון
              </button>
            </div>
            <div className="flex-1 w-full" id="product-video-section">
              <div className="aspect-video w-full rounded-2xl overflow-hidden border border-red-500/40 bg-black shadow-2xl">
                <iframe src={embedUrl} className="w-full h-full" allowFullScreen></iframe>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* תיבות Features / יכולות מרכזיות */}
      {hasFeatures && (
        <section className="mt-12">
          <div className="flex flex-col md:flex-row-reverse md:items-center md:justify-between gap-4 mb-6">
            <div className="text-right">
              <h2 className="text-2xl md:text-3xl font-black text-white mb-2">יכולות מרכזיות / מה תקבל בפנים</h2>
              {longDescription && (
                <p className="text-sm md:text-base text-slate-400 leading-relaxed max-w-2xl">
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
                    <p className="text-sm text-slate-300 leading-relaxed text-right">
                      {description}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <PurchaseModal 
        script={product} 
        isOpen={isPurchaseModalOpen} 
        onClose={() => setIsPurchaseModalOpen(false)} 
      />

    </div>
  );
};

export default ProductDetail;