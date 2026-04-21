import React, { useEffect, useMemo, useState } from 'react';

export default function Calendar() {
  const TARGET_URL = 'https://hebrew-calendar-2026.vercel.app/';
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [imgLoading, setImgLoading] = useState(false);
  const [posX, setPosX] = useState(0);
  const [posY, setPosY] = useState(0);
  const subtitlePrefix = useMemo(() => 'למעבר לעמוד לוח שנה', []);
  const subtitleSuffix = useMemo(() => 'או לחץ על התמונה', []);

  const go = () => {
    window.location.href = TARGET_URL;
  };

  useEffect(() => {
    const load = async () => {
      try {
        setImgLoading(true);
        const res = await fetch('/api/update-scripts');
        const data = await res.json().catch(() => ({}));
        const url =
          typeof data?.siteSettings?.calendarPreviewImageUrl === 'string'
            ? String(data.siteSettings.calendarPreviewImageUrl)
            : '';
        setImgUrl(url || null);
        setPosX(typeof data?.siteSettings?.calendarPreviewImagePosXPct === 'number' ? data.siteSettings.calendarPreviewImagePosXPct : 0);
        setPosY(typeof data?.siteSettings?.calendarPreviewImagePosYPct === 'number' ? data.siteSettings.calendarPreviewImagePosYPct : 0);
      } catch {
        setImgUrl(null);
        setPosX(0);
        setPosY(0);
      } finally {
        setImgLoading(false);
      }
    };
    load();
  }, []);

  return (
    <section className="w-full">
      <div className="mb-5 text-center">
        <h2 className="text-2xl font-black text-white">לוח שנה עברי־לועזי</h2>
        <p className="mt-2 text-base sm:text-lg font-black text-slate-100">
          {subtitlePrefix}{' '}
          <button
            type="button"
            onClick={go}
            className="text-sky-400 hover:text-sky-300 underline underline-offset-4"
            title="לחץ למעבר ללוח שנה"
          >
            לחץ כאן
          </button>{' '}
          {subtitleSuffix}
        </p>
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={go}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ' ? go() : null)}
        className="w-full overflow-hidden rounded-3xl border border-slate-700 bg-slate-950/60 shadow-2xl cursor-pointer"
        style={{ aspectRatio: '16 / 7' }}
        title="לחץ למעבר ללוח שנה"
      >
        {imgLoading ? (
          <div className="h-full w-full flex items-center justify-center text-sm text-slate-300">
            טוען תמונה…
          </div>
        ) : imgUrl ? (
          <div
            className="h-full w-full"
            style={{
              backgroundImage: `url(${imgUrl})`,
              backgroundSize: 'cover',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: `${50 + (Number(posX) || 0)}% ${50 + (Number(posY) || 0)}%`,
            }}
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-sm text-slate-300">
            אין תמונה — אפשר להוסיף באדמין
          </div>
        )}
      </div>
    </section>
  );
}

