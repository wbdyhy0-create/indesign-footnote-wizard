import React from 'react';
import { TORAH_COVER_DESIGNS } from '../constants';

interface TorahCoversProps {
  onNavigate: (page: string) => void;
}

const TorahCovers: React.FC<TorahCoversProps> = ({ onNavigate }) => {
  const savedCovers =
    typeof window !== 'undefined' ? localStorage.getItem('yosef_admin_covers_backup') : null;
  const coversList = savedCovers ? JSON.parse(savedCovers) : TORAH_COVER_DESIGNS;
  const publishedCovers = coversList.filter((c: any) => c.isPublished);
  const [brokenImages, setBrokenImages] = React.useState<Record<string, boolean>>({});

  return (
    <div className="animate-fadeIn pb-24 max-w-7xl mx-auto px-4" dir="rtl">
      <header className="text-center mb-16 pt-12">
        <h1 className="text-5xl md:text-7xl font-black mb-6 bg-gradient-to-r from-white via-amber-200 to-white bg-clip-text text-transparent tracking-tighter uppercase italic">
          עיצוב כריכות תורניים
        </h1>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
        {publishedCovers.map((cover: any) => {
          const imageUrl = typeof cover.imageUrl === 'string' ? cover.imageUrl.trim() : '';
          const shouldShowImage = Boolean(imageUrl) && !brokenImages[cover.id];
          return (
          <div
            key={cover.id}
            className="group bg-slate-900/40 rounded-[2.5rem] border border-slate-800 overflow-hidden hover:bg-slate-800/60 transition-all duration-500 hover:-translate-y-2 shadow-xl flex flex-col"
          >
            <div className="h-64 bg-slate-950 flex items-center justify-center relative">
              {shouldShowImage ? (
                <img
                  src={imageUrl}
                  alt={cover.name}
                  className="w-full h-full object-contain p-6"
                  loading="lazy"
                  onError={() =>
                    setBrokenImages((prev) => ({
                      ...prev,
                      [cover.id]: true,
                    }))
                  }
                />
              ) : (
                <span className="text-8xl">{cover.image || '📘'}</span>
              )}
            </div>

            <div className="p-8 flex flex-col flex-grow text-right">
              <h3 className="text-2xl font-black text-white mb-4 group-hover:text-amber-400 transition-colors">
                {cover.name}
              </h3>
              <p className="text-slate-400 text-sm mb-8 flex-grow">{cover.description}</p>

              <div className="flex items-center justify-between mt-auto pt-6 border-t border-slate-800/50">
                <span className="text-2xl font-black text-amber-500">{cover.price}</span>
                <button
                  onClick={() => onNavigate(cover.id)}
                  className="px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white text-sm font-black rounded-xl transition-all shadow-lg"
                >
                  לפרטים ורכישה
                </button>
              </div>
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
};

export default TorahCovers;
