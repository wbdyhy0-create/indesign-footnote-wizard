import React, { useEffect, useMemo, useState } from 'react';
import { CalendarLeadPopup } from '../components/CalendarLeadPopup';
import { tryYouTubeEmbedUrl } from '../utils/youtube';

export default function Calendar() {
  const TARGET_URL = 'https://hebrew-calendar-2026.vercel.app/';
  const EMBED_URL = TARGET_URL;
  const [tutorialRawUrl, setTutorialRawUrl] = useState<string>('');
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [openChooser, setOpenChooser] = useState(false);
  const [leadPopupOpen, setLeadPopupOpen] = useState(false);

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

  const tutorialEmbedSrc = useMemo(
    () => (tutorialRawUrl.trim() ? tryYouTubeEmbedUrl(tutorialRawUrl.trim()) : null),
    [tutorialRawUrl],
  );

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
        const res = await fetch('/api/update-scripts');
        const data = await res.json().catch(() => ({}));
        const raw =
          typeof data?.siteSettings?.calendarTutorialVideoUrl === 'string'
            ? String(data.siteSettings.calendarTutorialVideoUrl)
            : '';
        setTutorialRawUrl(raw.trim());
      } catch {
        setTutorialRawUrl('');
      } finally {
        setSettingsLoaded(true);
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
    <section className="w-full px-2 sm:px-3 lg:px-2 pb-4" dir="rtl">
      <div
        className={`flex flex-col gap-5 ${tutorialEmbedSrc ? 'lg:flex-row-reverse lg:gap-4 lg:items-start lg:justify-start' : ''}`}
      >
        <div className={`min-w-0 ${tutorialEmbedSrc ? 'flex-1' : ''}`}>
          <div className="w-full overflow-hidden rounded-3xl border border-slate-700 bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-3 py-2">
              <div className="text-[11px] font-black text-slate-500">לוח שנה</div>
              <button
                type="button"
                onClick={go}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-800 shadow-sm hover:bg-slate-50"
                title="פתח בחלון חדש"
              >
                פתח בחלון חדש
              </button>
            </div>
            <div
              className="relative w-full"
              style={{
                // Fill most of the viewport while leaving room for the site header/navbar.
                height: 'calc(100vh - 220px)',
                minHeight: 720,
                maxHeight: 1200,
              }}
            >
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
        </div>

        {tutorialEmbedSrc ? (
          <aside className="w-full shrink-0 lg:w-[320px]">
            <div className="overflow-hidden rounded-3xl border border-slate-700 bg-slate-950 shadow-xl">
              <div className="aspect-video w-full bg-black">
                <iframe
                  title="סרטון הדרכה — לוח שנה"
                  src={`${tutorialEmbedSrc}${tutorialEmbedSrc.includes('?') ? '&' : '?'}rel=0`}
                  className="h-full w-full"
                  loading={settingsLoaded ? 'lazy' : 'eager'}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
              <div className="border-t border-slate-800 px-4 py-3 text-center text-xs font-bold text-slate-400">
                סרטון הדרכה
              </div>
            </div>
          </aside>
        ) : null}
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
