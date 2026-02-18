import React, { useState, useEffect } from 'react';
import { ScriptData } from '../types';

interface PurchaseModalProps {
  script: ScriptData;
  isOpen: boolean;
  onClose: () => void;
}

const PurchaseModal: React.FC<PurchaseModalProps> = ({ script, isOpen, onClose }) => {
  const [step, setStep] = useState(1);
  const [customerInfo, setCustomerInfo] = useState({ name: '', email: '' });
  const [hasPaid, setHasPaid] = useState(false);
  const myPhoneNumber = "0522284432";

  // מנגנון שגורם למסך לקפוץ ללמעלה ברגע שהחלונית נפתחת
  useEffect(() => {
    if (isOpen) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setStep(1); // תמיד להתחיל משלב 1 כשפותחים מחדש
      setHasPaid(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBitPayment = (e: React.MouseEvent) => {
    e.preventDefault();
    const amount = script.price.replace('₪', '').trim();
    const bitUrl = `bit://transfer?phone=${myPhoneNumber}&amount=${amount}&description=רכישת ${script.name}`;
    window.location.href = bitUrl;
  };

  return (
    // שימוש ב-fixed ו-inset-0 מבטיח שהרקע האפור יכסה הכל והמודאל יהיה במרכז העין
    <div className="fixed inset-0 z-[999] flex items-start md:items-center justify-center p-4 bg-black/90 backdrop-blur-md overflow-y-auto pt-10 md:pt-4">
      <div className="bg-[#0f172a] border border-slate-700 w-full max-w-md rounded-[2.5rem] shadow-2xl relative p-8 md:p-10 text-center mb-10">
        <button onClick={onClose} className="absolute top-6 right-6 text-slate-400 hover:text-white text-2xl">✕</button>

        {step === 1 ? (
          <div className="animate-fadeIn">
            <h2 className="text-2xl font-black text-white mb-6">פרטי רכישה</h2>
            <form onSubmit={(e) => { e.preventDefault(); setStep(2); }} className="space-y-5 text-right">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2 mr-2">שם מלא</label>
                <input required type="text" value={customerInfo.name} onChange={(e) => setCustomerInfo({...customerInfo, name: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-white outline-none focus:border-amber-500" placeholder="ישראל ישראלי" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2 mr-2 text-right">אימייל למשלוח הקובץ</label>
                <input required type="email" value={customerInfo.email} onChange={(e) => setCustomerInfo({...customerInfo, email: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-white outline-none text-left" placeholder="your@email.com" />
              </div>
              <button type="submit" className="w-full py-5 bg-amber-600 text-white font-black rounded-2xl shadow-xl mt-4 active:scale-95 transition-all text-lg shadow-amber-900/20">המשך לתשלום</button>
            </form>
          </div>
        ) : (
          <div className="animate-fadeIn">
            <div className="mb-8">
              <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl text-blue-500 font-black italic text-2xl border-2 border-slate-200">bit</div>
              <h3 className="text-3xl font-black text-white mb-1">{script.price}</h3>
              <p className="text-slate-400 text-sm font-bold">העברה עבור יוסף עובדיה</p>
            </div>

            <div className="space-y-4">
              <button onClick={handleBitPayment} className="w-full py-5 bg-white text-slate-900 font-black rounded-2xl shadow-xl flex items-center justify-center gap-3 border-2 border-slate-200 active:scale-95 transition-all">
                 פתח אפליקציית ביט
              </button>

              <div className="py-6 border-t border-slate-800 mt-6 text-right">
                 <label className="flex items-start gap-4 cursor-pointer mb-8 group bg-slate-800/30 p-4 rounded-2xl border border-slate-700/50">
                    <input type="checkbox" checked={hasPaid} onChange={(e) => setHasPaid(e.target.checked)} className="w-6 h-6 mt-1 rounded-lg text-amber-500 bg-slate-950" />
                    <span className="text-[11px] font-bold text-slate-300 leading-tight">אני מאשר שביצעתי את ההעברה בביט כנדרש. ההורדה מנוטרת ומאומתת.</span>
                 </label>
                 
                 <a href={hasPaid ? script.downloadUrl : '#'} onClick={(e) => !hasPaid && e.preventDefault()} className={`w-full py-5 font-black rounded-2xl block text-center text-lg transition-all ${hasPaid ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30' : 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700'}`}>
                   {hasPaid ? 'הורד את הסקריפט עכשיו' : 'נא לאשר תשלום להורדה'}
                 </a>
              </div>
              <button onClick={() => setStep(1)} className="text-xs text-slate-500 underline">חזור לעדכון פרטים</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PurchaseModal;