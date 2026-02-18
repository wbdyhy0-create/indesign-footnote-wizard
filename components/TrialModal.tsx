
import React, { useState } from 'react';
import { ScriptData, Lead } from '../types';

interface TrialModalProps {
  script: ScriptData;
  isOpen: boolean;
  onClose: () => void;
}

const TrialModal: React.FC<TrialModalProps> = ({ script, isOpen, onClose }) => {
  const [step, setStep] = useState<'form' | 'processing' | 'success'>('form');
  const [formData, setFormData] = useState({ name: '', email: '' });
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isDisposableEmail = (email: string) => {
    const commonFakeDomains = ['tempmail.com', 'mailinator.com', '10minutemail.com', 'temp-mail.org'];
    return commonFakeDomains.some(domain => email.toLowerCase().includes(domain));
  };

  const handleDownloadRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isDisposableEmail(formData.email)) {
      setError('אנא השתמש בכתובת אימייל פרטית או עסקית תקינה.');
      return;
    }

    setStep('processing');

    try {
      // Save lead to localStorage
      const savedLeads = localStorage.getItem('yosef_leads');
      const leads: Lead[] = savedLeads ? JSON.parse(savedLeads) : [];
      
      const newLead: Lead = {
        id: `lead-${Date.now()}`,
        name: formData.name,
        email: formData.email,
        scriptName: script.name,
        timestamp: new Date().toISOString()
      };
      
      leads.unshift(newLead);
      localStorage.setItem('yosef_leads', JSON.stringify(leads));

      await new Promise(resolve => setTimeout(resolve, 1500));
      setStep('success');

      if (script.trialDownloadUrl) {
        window.open(script.trialDownloadUrl, '_blank');
      }
    } catch (err) {
      setError('חלה שגיאה בעיבוד הבקשה. אנא נסה שוב.');
      setStep('form');
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#0f172a] border border-slate-700 w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent"></div>
        
        <div className="p-8">
          <div className="flex justify-between items-start mb-6">
            <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <div className="text-right">
               <h2 className="text-xl font-bold text-amber-500">קבלת גרסת ניסיון</h2>
            </div>
          </div>

          {step === 'form' && (
            <form onSubmit={handleDownloadRequest} className="space-y-5 text-right" dir="rtl">
              <p className="text-sm text-slate-300 leading-relaxed">
                הזן את פרטיך וקישור להורדת גרסת הניסיון של <span className="text-white font-bold">{script.name}</span> יישלח לתיבת המייל שלך וייפתח להורדה מיידית.
              </p>
              
              {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs animate-shake">{error}</div>}

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2 mr-1">שם מלא</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 text-white focus:ring-2 focus:ring-amber-500 outline-none transition-all" placeholder="ישראל ישראלי" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2 mr-1">אימייל לקבלת הקישור</label>
                <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 text-white focus:ring-2 focus:ring-amber-500 outline-none transition-all" placeholder="name@example.com" />
              </div>

              <div className="pt-4">
                <button type="submit" className="w-full py-4 bg-amber-600 hover:bg-amber-500 text-white font-black rounded-2xl shadow-xl transition-all active:scale-95">
                  הורד עכשיו
                </button>
              </div>
            </form>
          )}

          {step === 'processing' && (
            <div className="py-12 text-center" dir="rtl">
              <div className="w-16 h-16 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin mx-auto mb-6"></div>
              <h3 className="text-xl font-bold text-white mb-2">מפיק קישור הורדה...</h3>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center py-10 animate-fadeIn" dir="rtl">
              <div className="w-20 h-20 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">נשלח בהצלחה!</h3>
              <p className="text-slate-400 leading-relaxed text-sm mb-6">
                קישור להורדה נשלח לכתובת: <span className="text-amber-500 font-bold">{formData.email}</span><br/>
                שימו לב: גרסת הניסיון תקפה ל-24 שעות.
              </p>
              
              <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700 text-right">
                <a href={script.trialDownloadUrl} target="_blank" className="text-amber-500 text-xs font-bold hover:underline flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  לחץ כאן אם ההורדה לא התחילה
                </a>
              </div>

              <button onClick={onClose} className="mt-8 w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-colors font-bold">
                סגור וחזור לאתר
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TrialModal;
