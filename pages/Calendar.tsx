import React, { useMemo, useRef, useState } from 'react';

export default function Calendar() {
  const TARGET_URL = 'https://hebrew-calendar-2026.vercel.app/';
  const STORAGE_KEY = 'footnoteWizard.calendarPreviewImageDataUrl';
  const pickerRef = useRef<HTMLInputElement | null>(null);
  const [imgDataUrl, setImgDataUrl] = useState<string | null>(() => {
    try {
      const v = window.localStorage.getItem(STORAGE_KEY);
      return v && v.startsWith('data:image/') ? v : null;
    } catch {
      return null;
    }
  });

  const canDelete = Boolean(imgDataUrl);
  const subtitle = useMemo(
    () => 'למעבר לעמוד לוח שנה לחץ כאן או לחץ על התמונה',
    [],
  );

  const go = () => {
    window.location.href = TARGET_URL;
  };

  const setImgSafe = (v: string | null) => {
    setImgDataUrl(v);
    try {
      if (v) window.localStorage.setItem(STORAGE_KEY, v);
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore storage/quota errors
    }
  };

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
            onClick={() => pickerRef.current?.click()}
            className="rounded-xl border border-slate-600 bg-slate-900/70 px-3 py-2 text-sm font-bold text-white hover:bg-slate-900"
          >
            {imgDataUrl ? 'החלף תמונה' : 'בחר תמונה'}
          </button>
          <button
            type="button"
            disabled={!canDelete}
            onClick={() => setImgSafe(null)}
            className="rounded-xl border border-slate-600 bg-slate-900/70 px-3 py-2 text-sm font-bold text-white hover:bg-slate-900 disabled:opacity-40"
          >
            מחק
          </button>
          <button
            type="button"
            onClick={go}
            className="rounded-xl border border-amber-400/40 bg-amber-500/15 px-3 py-2 text-sm font-black text-amber-100 hover:bg-amber-500/20"
          >
            מעבר ללוח שנה
          </button>
        </div>
      </div>

      <input
        ref={pickerRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            const v = typeof reader.result === 'string' ? reader.result : null;
            if (v && v.startsWith('data:image/')) setImgSafe(v);
          };
          reader.readAsDataURL(file);
        }}
      />

      <div
        role="button"
        tabIndex={0}
        onClick={go}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ' ? go() : null)}
        className="w-full overflow-hidden rounded-3xl border border-slate-700 bg-slate-950/60 shadow-2xl cursor-pointer"
        style={{ aspectRatio: '16 / 7' }}
        title="לחץ למעבר ללוח שנה"
      >
        {imgDataUrl ? (
          <img
            src={imgDataUrl}
            alt="תצוגת לוח שנה"
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-sm text-slate-300">
            אין תמונה — לחץ על “בחר תמונה”
          </div>
        )}
      </div>
    </section>
  );
}

