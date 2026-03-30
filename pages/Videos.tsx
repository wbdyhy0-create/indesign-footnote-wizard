import React, { useMemo, useState } from 'react';
import { VideoItem } from '../types';
import { toYouTubeEmbedUrl } from '../utils/youtube';

interface VideosProps {
  videos: VideoItem[];
}

const Videos: React.FC<VideosProps> = ({ videos }) => {
  const [searchText, setSearchText] = useState('');
  const [category, setCategory] = useState<'all' | string>('all');

  const published = useMemo(
    () =>
      videos
        .filter((v) => v && v.isPublished !== false)
        .slice()
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [videos],
  );

  const categories = useMemo(() => {
    return Array.from(
      new Set(
        published
          .map((v) => (v.category || '').trim())
          .filter(Boolean)
          .map((c) => c.toLowerCase()),
      ),
    ).sort();
  }, [published]);

  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    const cat = String(category).trim().toLowerCase();
    return published.filter((v) => {
      const hay = `${v.title || ''}\n${v.shortDesc || ''}\n${v.category || ''}`.toLowerCase();
      const searchOk = !q ? true : hay.includes(q);
      const categoryOk = cat === 'all' ? true : String(v.category || '').trim().toLowerCase() === cat;
      return searchOk && categoryOk;
    });
  }, [published, searchText, category]);

  return (
    <div className="animate-fadeIn pb-20" dir="rtl">
      <div className="mb-10">
        <h1 className="text-4xl md:text-5xl font-black text-amber-500 mb-3 leading-tight">סרטונים</h1>
        <p className="text-slate-100 text-base md:text-lg font-bold">כאן תמצא מדריכים והדגמות מיוטיוב.</p>
      </div>

      {published.length > 0 && (
        <div className="mb-8 rounded-3xl border border-slate-800 bg-slate-900/40 p-4 md:p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <div className="text-[11px] font-black text-slate-400 mb-2">חיפוש</div>
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="חפש לפי כותרת / תיאור / קטגוריה"
                className="w-full bg-[#060b14] border border-slate-800 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <div className="text-[11px] font-black text-slate-400 mb-2">קטגוריה</div>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value || 'all')}
                className="w-full bg-[#060b14] border border-slate-800 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-amber-500"
              >
                <option value="all">כל הקטגוריות</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {published.length === 0 ? (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-8 text-center">
          <p className="text-slate-100 font-bold">כרגע אין סרטונים להצגה.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filtered.map((video) => {
            const embedUrl = toYouTubeEmbedUrl(video.url);
            return (
              <div
                key={video.id}
                className="rounded-3xl border border-slate-800 bg-slate-900/40 p-5 shadow-xl"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <div className="font-black text-white text-xl md:text-2xl leading-snug">
                      {video.title || 'סרטון'}
                    </div>
                    {video.category && (
                      <div className="mt-1 inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[10px] font-black text-amber-200">
                        {video.category}
                      </div>
                    )}
                    {video.shortDesc && (
                      <p className="mt-2 text-slate-100 text-sm md:text-base leading-relaxed">
                        {video.shortDesc}
                      </p>
                    )}
                  </div>
                </div>
                <div className="relative w-full overflow-hidden rounded-2xl border border-slate-800 bg-black aspect-video">
                  <iframe
                    src={embedUrl}
                    title={video.title || 'YouTube video'}
                    className="absolute inset-0 w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                  <a
                    href={video.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-amber-300 hover:text-amber-200 font-bold"
                  >
                    פתח ביוטיוב
                  </a>
                  {video.driveViewUrl?.trim() && (
                    <a
                      href={video.driveViewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sky-300 hover:text-sky-200 font-bold"
                    >
                      צפה בגוגל דרייב
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Videos;

