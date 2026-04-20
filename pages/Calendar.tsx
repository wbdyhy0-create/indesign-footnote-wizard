import React from 'react';

export default function Calendar() {
  return (
    <section className="w-full">
      <div className="mb-4">
        <h2 className="text-2xl font-black text-white">לוח שנה עברי־לועזי</h2>
        <p className="text-sm text-slate-300">
          הלוח נטען מתוך אתר חיצוני. ההגדרות נשמרות אצלך בדפדפן.
        </p>
      </div>

      <div className="w-full overflow-hidden rounded-3xl border border-slate-700 bg-slate-950/60 shadow-2xl">
        <iframe
          src="https://hebrew-calendar-2026.vercel.app/"
          title="לוח שנה עברי־לועזי"
          style={{ width: '100%', height: '80vh', border: '0' }}
        />
      </div>
    </section>
  );
}

