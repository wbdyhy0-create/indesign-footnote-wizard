import React, { useEffect, useMemo, useState } from 'react';
import { CalendarLeadPopup } from '../components/CalendarLeadPopup';

export default function Calendar() {
  const TARGET_URL = 'https://hebrew-calendar-2026.vercel.app/';
  const EMBED_URL = TARGET_URL;
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [imgLoading, setImgLoading] = useState(false);
  const [posX, setPosX] = useState(0);
  const [posY, setPosY] = useState(0);
  const [openChooser, setOpenChooser] = useState(false);
  const [embedMode, setEmbedMode] = useState(true);
  const [leadPopupOpen, setLeadPopupOpen] = useState(false);
  const subtitlePrefix = useMemo(() => 'למעבר לעמוד לוח שנה', []);
  const subtitleSuffix = useMemo(() => 'או לחץ על התמונה', []);

  const LEAD_POPUP_SNOOZE_KEY = 'fw:calendar:lead-popup:snooze-until:v1';
  const LEAD_POPUP_COMPLETED_KEY = 'fw:calendar:lead-popup:completed:v1';
  const shouldShowLeadPopup = () => {
    try {
      if (window.localStorage.getItem(LEAD_POPUP_COMPLETED_KEY) === '1') return false;
      const until = Number(window.localStorage.getItem(LEAD_POPUP_SNOOZE_KEY) || '0');
      if (!Number.isFinite(until)) return true;
      return Date.now() > until;
    } catch {
      return true;
    }
  };

  const snoozeLeadPopup = (days: number) => {
    try {
      const ms = Math.max(1, days) * 86400000;
      window.localStorage.setItem(LEAD_POPUP_SNOOZE_KEY, String(Date.now() + ms));
    } catch {
      // ignore
    }
  };

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

  useEffect(() => {
    // Only in Footnote Wizard Calendar page.
    if (!shouldShowLeadPopup()) return;
    const t = window.setTimeout(() => setLeadPopupOpen(true), 60_000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="w-full">
      <div className="mb-5 text-center">
        <h2 className="text-2xl font-black text-white">לוח שנה עברי־לועזי</h2>
        <p className="mt-2 text-base sm:text-lg font-black text-slate-100">
          <span className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
            <button
              type="button"
              onClick={() => setEmbedMode(true)}
              className={[
                'rounded-full border px-3 py-1 text-sm font-black transition-colors',
                embedMode
                  ? 'border-sky-400/50 bg-sky-400/15 text-sky-100'
                  : 'border-slate-600 bg-white/5 text-slate-100 hover:bg-white/10',
              ].join(' ')}
              title="הצג מוטמע בתוך האתר"
            >
              הצג כאן באתר
            </button>
            <button
              type="button"
              onClick={() => {
                setEmbedMode(false);
                go();
              }}
              className={[
                'rounded-full border px-3 py-1 text-sm font-black transition-colors',
                !embedMode
                  ? 'border-sky-400/50 bg-sky-400/15 text-sky-100'
                  : 'border-slate-600 bg-white/5 text-slate-100 hover:bg-white/10',
              ].join(' ')}
              title="פתח בחלון חדש"
            >
              פתח בחלון חדש
            </button>
          </span>
        </p>
      </div>

      {embedMode ? (
        <div className="w-full overflow-hidden rounded-3xl border border-slate-700 bg-white shadow-2xl">
          <div
            className="relative w-full"
            style={{
              // Fill most of the viewport while leaving room for the site header/navbar.
              height: 'calc(100vh - 220px)',
              minHeight: 720,
              maxHeight: 1200,
            }}
          >
            <button
              type="button"
              onClick={go}
              className="absolute left-3 top-3 z-20 rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-xs font-black text-slate-800 shadow hover:bg-white"
              title="פתח בחלון חדש"
            >
              פתח בחלון חדש
            </button>
            <iframe
              src={EMBED_URL}
              title="לוח שנה עברי־לועזי (מוטמע)"
              className="h-full w-full bg-white"
              loading="lazy"
              referrerPolicy="no-referrer"
              allow="clipboard-read; clipboard-write"
            />
          </div>
        </div>
      ) : (
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
      )}

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

      <CalendarLeadPopup
        isOpen={leadPopupOpen}
        onClose={() => {
          // Close only after successful submit.
          setLeadPopupOpen(false);
        }}
        onCompleted={() => {
          try {
            window.localStorage.setItem(LEAD_POPUP_COMPLETED_KEY, '1');
            window.localStorage.removeItem(LEAD_POPUP_SNOOZE_KEY);
          } catch {
            // ignore
          }
        }}
        leadSourceName="לוח שנה (Footnote Wizard)"
        title="להמשך שימוש בלוח השנה נא להזין את פרטיך"
        subtitle="מלאו שם ומייל — ואז תוכלו להמשיך להשתמש בלוח השנה."
      />
    </section>
  );
}

