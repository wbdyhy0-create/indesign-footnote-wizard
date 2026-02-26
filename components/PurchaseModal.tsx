import React, { useState, useEffect } from 'react';
import { ScriptData } from '../types';

interface PurchaseModalProps {
  script: ScriptData;
  isOpen: boolean;
  onClose: () => void;
}

type ClientOrderInfo = {
  id: string;
  orderCode: string;
  bitPayUrl: string;
  amountNis: number;
  priceLabel: string;
  bitRecipientName: string;
  bitPhone: string;
};

const PurchaseModal: React.FC<PurchaseModalProps> = ({ script, isOpen, onClose }) => {
  const [step, setStep] = useState<'form' | 'payment' | 'success'>('form');
  const [customerInfo, setCustomerInfo] = useState({ name: '', email: '' });
  const [orderInfo, setOrderInfo] = useState<ClientOrderInfo | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);
  const [isAutoChecking, setIsAutoChecking] = useState(false);
  const [readyDownloadUrl, setReadyDownloadUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStep('form');
      setOrderInfo(null);
      setStatusMessage(null);
      setError(null);
      setIsCreatingOrder(false);
      setIsCheckingPayment(false);
      setIsAutoChecking(false);
      setReadyDownloadUrl(null);
    }
  }, [isOpen]);

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatusMessage(null);

    if (!script.downloadUrl) {
      setError('לא ניתן לבצע רכישה: אין קישור הורדה למוצר זה.');
      return;
    }

    try {
      setIsCreatingOrder(true);
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          customerName: customerInfo.name,
          customerEmail: customerInfo.email,
          productId: script.id,
          productName: script.name,
          priceLabel: script.price,
          downloadUrl: script.downloadUrl,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result?.success === false || !result?.order?.id) {
        throw new Error(result?.error || 'יצירת ההזמנה נכשלה');
      }

      setOrderInfo({
        id: String(result.order.id),
        orderCode: String(result.order.orderCode),
        bitPayUrl: String(result.order.bitPayUrl),
        amountNis: Number(result.order.amountNis),
        priceLabel: String(result.order.priceLabel),
        bitRecipientName: String(result.order.bitRecipientName),
        bitPhone: String(result.order.bitPhone),
      });
      setStep('payment');
    } catch (err: any) {
      setError(err?.message || 'שגיאה ביצירת ההזמנה');
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const handleBitPayment = () => {
    if (!orderInfo?.bitPayUrl) return;
    window.open(orderInfo.bitPayUrl, '_blank');
  };

  const checkPaymentStatus = async (manualCheck: boolean) => {
    if (!orderInfo?.id) return;
    if (manualCheck) {
      setError(null);
      setStatusMessage(null);
      setIsCheckingPayment(true);
    } else {
      setIsAutoChecking(true);
    }

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'status',
          orderId: orderInfo.id,
          customerEmail: customerInfo.email,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result?.success === false) {
        throw new Error(result?.error || 'לא הצלחנו לבדוק את סטטוס התשלום');
      }

      if (result?.order?.status === 'paid' && result?.downloadUrl) {
        const nextDownloadUrl = String(result.downloadUrl);
        setReadyDownloadUrl(nextDownloadUrl);
        setStatusMessage('אישור התשלום התקבל. הכפתור הירוק התחלף ל"הורד עכשיו".');
        return;
      }

      if (manualCheck) {
        setStatusMessage('עדיין לא התקבל אישור תשלום. לאחר אישור ידני באדמין ניתן ללחוץ שוב.');
      }
    } catch (err: any) {
      if (manualCheck) {
        setError(err?.message || 'שגיאה בבדיקת סטטוס התשלום');
      }
    } finally {
      if (manualCheck) {
        setIsCheckingPayment(false);
      } else {
        setIsAutoChecking(false);
      }
    }
  };

  const handleCheckPayment = async () => {
    if (readyDownloadUrl) {
      window.open(readyDownloadUrl, '_blank');
      onClose();
      return;
    }
    await checkPaymentStatus(true);
  };

  useEffect(() => {
    if (!isOpen || step !== 'payment' || !orderInfo?.id || readyDownloadUrl) return;

    const timer = window.setInterval(() => {
      checkPaymentStatus(false);
    }, 7000);

    return () => window.clearInterval(timer);
  }, [isOpen, step, orderInfo?.id, customerInfo.email, readyDownloadUrl]);

  if (!isOpen) return null;

  const handleWhatsAppSupport = () => {
    const orderCode = orderInfo?.orderCode || 'ללא קוד הזמנה';
    const adminOrdersUrl = `${window.location.origin}/admin/orders?orderCode=${encodeURIComponent(orderCode)}`;
    const message = encodeURIComponent(
      `שלום יוסף, ביצעתי תשלום בביט עבור "${script.name}".
קוד הזמנה: ${orderCode}
שם לקוח: ${customerInfo.name}
אימייל: ${customerInfo.email}
סכום: ${orderInfo?.priceLabel || script.price}
לאישור מהיר: ${adminOrdersUrl}`
    );
    window.open(`https://wa.me/972522284432?text=${message}`, '_blank');
  };

  return (
    <>
      <div className="fixed inset-0 z-[999] flex min-h-screen items-center justify-center bg-black/75 p-4 overflow-y-auto">
        <div className="relative z-[1001] bg-[#0f172a] border border-slate-700 w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 md:p-10 text-center">
          <button onClick={onClose} className="absolute top-6 right-6 text-slate-400 hover:text-white text-2xl">✕</button>

          {step === 'form' ? (
            <div className="animate-fadeIn">
              <h2 className="text-2xl font-black text-white mb-6">פרטי רכישה</h2>
              <form onSubmit={handleCreateOrder} className="space-y-5 text-right">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2 mr-2">שם מלא</label>
                  <input required type="text" value={customerInfo.name} onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-white outline-none focus:border-amber-500" placeholder="ישראל ישראלי" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2 mr-2 text-right">אימייל למשלוח הקובץ</label>
                  <input required type="email" value={customerInfo.email} onChange={(e) => setCustomerInfo({ ...customerInfo, email: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-white outline-none text-left" placeholder="your@email.com" />
                </div>
                {error && <p className="text-red-400 text-xs font-bold">{error}</p>}
                <button
                  type="submit"
                  disabled={isCreatingOrder}
                  className={`w-full py-5 text-white font-black rounded-2xl shadow-xl mt-4 transition-all text-lg shadow-amber-900/20 ${
                    isCreatingOrder ? 'bg-amber-800 cursor-not-allowed' : 'bg-amber-600 active:scale-95'
                  }`}
                >
                  {isCreatingOrder ? 'יוצר הזמנה...' : 'המשך לתשלום'}
                </button>
              </form>
            </div>
          ) : (
            <div className="animate-fadeIn">
              <div className="mb-8">
                <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl text-blue-500 font-black italic text-2xl border-2 border-slate-200">bit</div>
                <h3 className="text-3xl font-black text-white mb-1">{orderInfo?.priceLabel || script.price}</h3>
                <p className="text-slate-300 text-sm font-bold text-center">בצע תשלום בביט</p>
                <p className="text-amber-400 text-xs font-black mt-3 text-right">קוד הזמנה: {orderInfo?.orderCode || '-'}</p>
              </div>

              <div className="space-y-4">
                <button onClick={handleBitPayment} className="w-full py-5 bg-white text-slate-900 font-black rounded-2xl shadow-xl flex items-center justify-center gap-3 border-2 border-slate-200 active:scale-95 transition-all">
                  פתח אפליקציית ביט
                </button>

                <button onClick={handleWhatsAppSupport} className="w-full py-3 bg-emerald-900/20 text-emerald-400 text-sm font-bold rounded-xl border border-emerald-800/50 flex items-center justify-center gap-2 hover:bg-emerald-900/30 transition-all">
                  <span>💬</span> שלח אישור תשלום בוואטסאפ
                </button>

                <div className="py-6 border-t border-slate-800 mt-6 text-right space-y-3">
                  <p className="text-[11px] font-bold text-slate-300 leading-tight bg-slate-800/30 p-4 rounded-2xl border border-slate-700/50">
                    לאחר ביצוע התשלום, לחץ על הכפתור "שלח אישור תשלום בוואטספ".
                  </p>
                  <p className="text-[11px] text-slate-300 leading-tight bg-slate-900/40 p-3 rounded-xl border border-slate-800">
                    לאחר אישור ההזמנה על ידי המנהל, הכפתור הירוק יתחלף ל"הורד עכשיו".
                    נא להמתין מעט בסבלנות, ולא לסגור חלון זה.
                  </p>
                  <p className="text-[11px] text-slate-300 leading-tight bg-slate-900/40 p-3 rounded-xl border border-slate-800">
                    אם נתקלת בבעיה, נא לשלוח הודעה לוואטספ.
                  </p>
                  {isAutoChecking && (
                    <p className="text-[11px] text-indigo-300 font-bold">בודק אוטומטית אישור תשלום...</p>
                  )}

                  {statusMessage && <p className="text-xs text-amber-300 font-bold">{statusMessage}</p>}
                  {error && <p className="text-xs text-red-400 font-bold">{error}</p>}

                  <button
                    onClick={handleCheckPayment}
                    className={`w-full py-5 font-black rounded-2xl block text-center text-lg transition-all ${
                      isCheckingPayment
                        ? 'bg-emerald-800 text-white cursor-not-allowed'
                        : 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30'
                    }`}
                    disabled={isCheckingPayment}
                  >
                    {isCheckingPayment ? 'בודק סטטוס...' : readyDownloadUrl ? 'הורד עכשיו' : 'בדוק אישור תשלום והורד'}
                  </button>
                  <p className="text-[11px] text-slate-300 leading-tight text-center">
                    הסתבכתם? כתבו הודעה ונחזור אליכם בהקדם.
                  </p>
                  <button
                    onClick={handleWhatsAppSupport}
                    className="w-full py-3 bg-emerald-700/20 text-emerald-300 text-sm font-bold rounded-xl border border-emerald-700/50 flex items-center justify-center gap-2 hover:bg-emerald-700/30 transition-all"
                  >
                    <span>💬</span> פניה בוואטסאפ
                  </button>
                </div>
                <button onClick={() => setStep('form')} className="text-xs text-slate-500 underline">חזור לעדכון פרטים</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default PurchaseModal;