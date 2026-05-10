import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Lead } from '../types';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  leadSourceName?: string;
  title?: string;
  subtitle?: string;
};

const isDisposableEmail = (email: string) => {
  const commonFakeDomains = ['tempmail.com', 'mailinator.com', '10minutemail.com', 'temp-mail.org'];
  return commonFakeDomains.some((domain) => email.toLowerCase().includes(domain));
};

export function CalendarLeadPopup({
  isOpen,
  onClose,
  leadSourceName,
  title,
  subtitle,
}: Props) {
  const sourceName = useMemo(() => leadSourceName || 'לוח שנה (Footnote Wizard)', [leadSourceName]);
  const headerTitle = useMemo(() => title || 'רוצים שאשלח לכם עדכונים?', [title]);
  const headerSubtitle = useMemo(
    () => subtitle || 'מלאו שם ומייל — ואעדכן אתכם כשיש חידושים ושיפורים.',
    [subtitle],
  );

  const [step, setStep] = useState<'form' | 'processing' | 'success'>('form');
  const [formData, setFormData] = useState({ name: '', email: '' });
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const name = formData.name.trim();
    const email = formData.email.trim();
    if (!name || !email) {
      setError('נא למלא שם ומייל.');
      return;
    }
    if (isDisposableEmail(email)) {
      setError('אנא השתמש בכתובת אימייל פרטית או עסקית תקינה.');
      return;
    }

    setStep('processing');

    try {
      const newLead: Lead = {
        id: `lead-${Date.now()}`,
        name,
        email,
        scriptName: sourceName,
        timestamp: new Date().toISOString(),
      };

      const r = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          name: newLead.name,
          email: newLead.email,
          scriptName: newLead.scriptName,
          timestamp: newLead.timestamp,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j?.success === false) {
        throw new Error(j?.error || 'שמירת הליד נכשלה');
      }

      setStep('success');
    } catch (err: any) {
      setError(err?.message || 'חלה שגיאה. נסה שוב.');
      setStep('form');
    }
  };

  const content = (
    <div
      className="fixed inset-0 z-[120] overflow-y-auto bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="טופס פרטים"
      onMouseDown={() => onClose()}
    >
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="w-full max-w-md rounded-[2.25rem] border border-slate-700 bg-[#0f172a] shadow-2xl overflow-hidden"
          onMouseDown={(e) => e.stopPropagation()}
          dir="rtl"
        >
          <div className="p-6 md:p-7">
            <div className="flex items-start justify-between gap-4">
              <div className="text-right">
                <div className="text-lg md:text-xl font-black text-white">{headerTitle}</div>
                <div className="mt-1 text-xs md:text-sm text-slate-300 leading-relaxed">
                  {headerSubtitle}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 rounded-xl border border-slate-700 bg-slate-900/60 px-2.5 py-2 text-slate-200 hover:bg-slate-900"
                aria-label="סגור"
                title="סגור"
              >
                ✕
              </button>
            </div>

            {step === 'form' ? (
              <form onSubmit={submit} className="mt-5 space-y-4">
                {error ? (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-200">
                    {error}
                  </div>
                ) : null}

                <label className="block">
                  <div className="text-xs font-black text-slate-400 mb-2 mr-1">שם מלא</div>
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData((s) => ({ ...s, name: e.target.value }))}
                    className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="ישראל ישראלי"
                  />
                </label>

                <label className="block">
                  <div className="text-xs font-black text-slate-400 mb-2 mr-1">אימייל</div>
                  <input
                    required
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData((s) => ({ ...s, email: e.target.value }))}
                    className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="name@example.com"
                    dir="ltr"
                  />
                </label>

                <button
                  type="submit"
                  className="w-full rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-black py-3.5 shadow-xl active:scale-[0.99] transition"
                >
                  שלח
                </button>

                <button
                  type="button"
                  className="w-full rounded-2xl border border-slate-700 bg-transparent text-slate-200 font-black py-3 hover:bg-white/5 transition"
                  onClick={onClose}
                >
                  לא עכשיו
                </button>
              </form>
            ) : step === 'processing' ? (
              <div className="py-10 text-center">
                <div className="w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin mx-auto mb-5" />
                <div className="text-sm font-black text-white">שולח…</div>
              </div>
            ) : (
              <div className="py-10 text-center">
                <div className="mx-auto mb-5 h-14 w-14 rounded-full bg-emerald-500/15 text-emerald-300 flex items-center justify-center text-2xl">
                  ✓
                </div>
                <div className="text-lg font-black text-white">תודה! הפרטים נקלטו.</div>
                <div className="mt-2 text-sm text-slate-300">אפשר להמשיך לעבוד.</div>
                <button
                  type="button"
                  className="mt-6 w-full rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-black py-3 transition"
                  onClick={onClose}
                >
                  סגור
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
}

