import React from 'react';
import { VideoItem } from '../types';
import { toYouTubeEmbedUrl } from '../utils/youtube';

interface VideosProps {
  videos: VideoItem[];
}

const Videos: React.FC<VideosProps> = ({ videos }) => {
  const published = videos
    .filter((v) => v && v.isPublished !== false)
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  return (
    <div className="animate-fadeIn pb-20" dir="rtl">
      <div className="mb-10">
        <h1 className="text-3xl md:text-4xl font-black text-amber-500 mb-3">סרטונים</h1>
        <p className="text-slate-100 text-sm md:text-base">כאן תמצא מדריכים והדגמות מיוטיוב.</p>
      </div>

      {published.length === 0 ? (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-8 text-center">
          <p className="text-slate-100 font-bold">כרגע אין סרטונים להצגה.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {published.map((video) => {
            const embedUrl = toYouTubeEmbedUrl(video.url);
            return (
              <div
                key={video.id}
                className="rounded-3xl border border-slate-800 bg-slate-900/40 p-5 shadow-xl"
              >
                <div className="font-black text-white mb-3">{video.title || 'סרטון'}</div>
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

