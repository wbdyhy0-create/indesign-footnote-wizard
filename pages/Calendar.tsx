import React, { useEffect, useMemo, useState } from 'react';

export default function Calendar() {
  const TARGET_URL = 'https://hebrew-calendar-2026.vercel.app/';
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [imgLoading, setImgLoading] = useState(false);
  const subtitle = useMemo(
    () => 'למעבר לעמוד לוח שנה לחץ כאן או לחץ על התמונה',
    [],
  );

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
      } catch {
        setImgUrl(null);
      } finally {
        setImgLoading(false);
      }
    };
    load();
  }, []);

  return (
    <section className="w-full">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-white">לוח שנה עברי־לועזי</h2>
          <p className="text-sm text-slate-300">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={go}
            className="rounded-xl border border-amber-400/40 bg-amber-500/15 px-3 py-2 text-sm font-black text-amber-100 hover:bg-amber-500/20"
          >
            מעבר ללוח שנה
          </button>
        </div>
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
          <img
            src={imgUrl}
            alt="תצוגת לוח שנה"
            className="h-full w-full object-cover"
            draggable={false}
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

