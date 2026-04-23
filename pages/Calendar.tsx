import React, { useEffect, useMemo, useState } from 'react';

export default function Calendar() {
  const TARGET_URL = 'https://hebrew-calendar-2026.vercel.app/';
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [imgLoading, setImgLoading] = useState(false);
  const [posX, setPosX] = useState(0);
  const [posY, setPosY] = useState(0);
  const [openChooser, setOpenChooser] = useState(false);
  const subtitlePrefix = useMemo(() => 'למעבר לעמוד לוח שנה', []);
  const subtitleSuffix = useMemo(() => 'או לחץ על התמונה', []);

  const openInDefaultBrowser = () => {
    window.open(TARGET_URL, '_blank', 'noopener,noreferrer');
  };

  const openInEdge = () => {
    // Windows Edge protocol handler. Browsers may show a confirmation prompt.
    window.open(`microsoft-edge:${TARGET_URL}`, '_blank', 'noopener,noreferrer');
  };

  const go = () => setOpenChooser(true);

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

      {openChooser ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="בחר דפדפן לפתיחה"
          onClick={() => setOpenChooser(false)}
        >
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-950/90 p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-lg font-black text-white">איך לפתוח את הלוח?</div>
            <div className="mt-1 text-sm text-slate-200">
              המלצה: <span className="font-black text-sky-200">Edge</span> (עובד אצלך חלק יותר עם סליידרים).
            </div>

            <div className="mt-4 grid gap-2">
              <button
                type="button"
                className="w-full rounded-xl border border-sky-500/40 bg-sky-500/15 px-4 py-3 text-right text-sm font-black text-sky-100 hover:bg-sky-500/25"
                onClick={() => {
                  setOpenChooser(false);
                  openInEdge();
                }}
              >
                פתח באדג׳ (מומלץ)
              </button>

              <button
                type="button"
                className="w-full rounded-xl border border-slate-600 bg-white/5 px-4 py-3 text-right text-sm font-black text-slate-100 hover:bg-white/10"
                onClick={() => {
                  setOpenChooser(false);
                  openInDefaultBrowser();
                }}
              >
                פתח בדפדפן ברירת‑מחדל (כרום אם הוא ברירת‑המחדל)
              </button>

              <button
                type="button"
                className="w-full rounded-xl border border-slate-700 bg-transparent px-4 py-2 text-right text-sm font-black text-slate-200 hover:bg-white/5"
                onClick={() => setOpenChooser(false)}
              >
                ביטול
              </button>
            </div>

            <div className="mt-3 text-xs text-slate-300 leading-relaxed">
              שים לב: אתר לא יכול “לכפות” כרום/אדג׳ בלי הסכמה. בכפתור אדג׳ ייתכן שהדפדפן יבקש אישור לפתיחה.
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

