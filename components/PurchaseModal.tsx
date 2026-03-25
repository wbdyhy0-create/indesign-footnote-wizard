import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ScriptData } from '../types';
import { buildBitPayRequestUrl, openBitPayUrl } from '../utils/bitPay';

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
  customerToken?: string;
};

const BIT_PHONE = '0522284432';
const BIT_RECIPIENT_NAME = 'יוסף עובדיה';

const parseAmountFromPrice = (priceLabel: string): number | null => {
  const matched = priceLabel.replace(',', '.').match(/(\d+(?:\.\d+)?)/);
  if (!matched) return null;
  const amount = Number(matched[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return amount;
};

const buildClientFallbackOrder = (script: ScriptData): ClientOrderInfo => {
  const amountNis = parseAmountFromPrice(script.price);
  if (!amountNis) {
    throw new Error('מחיר לא תקין להזמנה');
  }

  const orderCode = `LOCAL-${Date.now().toString().slice(-6)}`;
  const payText = `רכישת ${script.name} | הזמנה ${orderCode}`;

  return {
    id: `local-${Date.now()}`,
    orderCode,
    bitPayUrl: buildBitPayRequestUrl(BIT_PHONE, amountNis, payText),
    amountNis,
    priceLabel: script.price,
    bitRecipientName: BIT_RECIPIENT_NAME,
    bitPhone: BIT_PHONE,
  };
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

    setIsCreatingOrder(true);

    try {
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
        throw new Error(result?.error || '');
      }

      setOrderInfo({
        id: String(result.order.id),
        orderCode: String(result.order.orderCode),
        bitPayUrl: String(result.order.bitPayUrl),
        amountNis: Number(result.order.amountNis),
        priceLabel: String(result.order.priceLabel),
        bitRecipientName: String(result.order.bitRecipientName),
        bitPhone: String(result.order.bitPhone),
        customerToken: result.order.customerToken ? String(result.order.customerToken) : undefined,
      });
      setStep('payment');
    } catch (err: any) {
      // אם השרת נכשל (למשל בעיית KV), ננסה לעבור למסלול תשלום ישיר בביט ללא שמירת הזמנה בשרת
      // כדי שהלקוח עדיין יוכל לשלם ולקבל קובץ.
      console.error('Order creation via /api/orders failed, falling back to direct Bit link:', err);
      try {
        const fallbackOrder = buildClientFallbackOrder(script);
        setOrderInfo(fallbackOrder);
        setStep('payment');
      } catch (fallbackError: any) {
        setError(fallbackError?.message || 'יצירת ההזמנה נכשלה');
      }
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const isLikelyDesktop = () => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent;
    const hasMobileHint = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobi|Silk/i.test(ua);
    const hasDesktopOS = /Windows NT|Macintosh|Linux|X11|CrOS/i.test(ua);
    return hasDesktopOS && !hasMobileHint;
  };

  const handleBitPayment = () => {
    if (!orderInfo?.bitPayUrl) return;
    if (isLikelyDesktop()) {
      alert('תשלום בביט מתבצע מהאפליקציה בנייד.\nפתח את אפליקציית Bit בסלולר כדי להשלים את התשלום.');
      window.open(orderInfo.bitPayUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    // בנייד: ניווט באותו חלון — כך בדרך כלל נשמרים פרמטרי בקשת התשלום בפתיחת האפליקציה
    openBitPayUrl(orderInfo.bitPayUrl);
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
        setStatusMessage('אישור התשלום התקבל! קישור ההורדה נשלח גם למייל שלך (בדוק בספאם אם לא מופיע).');
        return;
      }

      if (manualCheck) {
        setStatusMessage('עדיין האימות לא אושר על ידי מנהל. ברגע שיאושר הכפתור ישתנה ל"הורד עכשיו", אין צורך ללחוץ שוב ושוב.');
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
      alert('הקובץ נשלח לכתובת המייל שהזנת.\nחפש בתיקיית הספאם / דואר זבל.');
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

  const handleWhatsAppApproval = async () => {
    const orderCode = orderInfo?.orderCode || '';
    const productName = script.name;
    const priceLabel = orderInfo?.priceLabel || script.price;
    const email = customerInfo.email;

    const messageLines = [
      'שלום יוסף,',
      `ביצעתי עכשיו תשלום בביט עבור "${productName}" בסכום ${priceLabel}.`,
      orderCode ? `קוד הזמנה: ${orderCode}` : '',
      email ? `האימייל להזמנה: ${email}` : '',
      'אשמח שתאשר את ההזמנה ותאפשר לי להוריד את הקובץ. תודה!'
    ].filter(Boolean);

    const message = encodeURIComponent(messageLines.join('\n'));
    window.open(`https://wa.me/972522284432?text=${message}`, '_blank');

    // לא פותחים הורדה ולא שולחים מייל מהצד של הלקוח.
    // המייל נשלח רק אחרי שהאדמין מאשר (action: mark-paid), וההורדה נפתחת רק כשהסטטוס בשרת הוא `paid`.
    setStatusMessage('הודעת אישור נשלחה. ממתינים לאישור מנהל...');
  };

  const handleWhatsAppSupport = () => {
    const orderCode = orderInfo?.orderCode || '';
    const message = encodeURIComponent(
      `שלום, נתקלתי בבעיה ואשמח לעזרה.${orderCode ? `\nקוד הזמנה: ${orderCode}` : ''}`
    );
    window.open(`https://wa.me/972522284432?text=${message}`, '_blank');
  };

  const modalContent = (
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
                <p className="text-slate-100 text-sm font-bold text-center">בצע תשלום בביט</p>
                <p className="text-amber-400 text-xs font-black mt-3 text-right">קוד הזמנה: {orderInfo?.orderCode || '-'}</p>
              </div>

              <div className="space-y-4">
                <button onClick={handleBitPayment} className="w-full py-5 bg-white text-slate-900 font-black rounded-2xl shadow-xl flex items-center justify-center gap-3 border-2 border-slate-200 active:scale-95 transition-all">
                  לחץ לתשלום בביט
                </button>
                <p className="text-[11px] text-slate-100 text-center leading-relaxed px-1">
                  אם בביט לא נפתחת בקשת תשלום עם הסכום — העתיקו את מספר הטלפון שלי, הדביקו בביט בשדה הנמען, והזינו את סכום הרכישה ידנית:{' '}
                  <a
                    href={`tel:${BIT_PHONE}`}
                    className="text-amber-400 font-black tabular-nums select-all underline underline-offset-2 hover:text-amber-300"
                  >
                    {BIT_PHONE}
                  </a>
                  . לאחר מכן חזרו לעמוד התשלום ולחצו על הכפתור הירוק &quot;שלח אישור תשלום בוואטסאפ&quot;. לאחר שתשלח אישור תשלום בוואטסאפ, הכפתור הירוק יתחלף ל־&quot;הורד עכשיו&quot;.
                </p>

                <button onClick={handleWhatsAppApproval} className="w-full py-3 bg-emerald-900/20 text-emerald-400 text-sm font-bold rounded-xl border border-emerald-800/50 flex items-center justify-center gap-2 hover:bg-emerald-900/30 transition-all">
                  <span>💬</span> שלח אישור תשלום בוואטסאפ
                </button>

                <div className="py-6 border-t border-slate-800 mt-6 text-right space-y-3">
                  {isAutoChecking && (
                    <p className="text-[11px] text-indigo-300 font-bold">בודק אוטומטית אישור תשלום...</p>
                  )}

                  {statusMessage && <p className="text-xs text-slate-100 font-bold text-center">{statusMessage}</p>}
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
                  <p className="text-[11px] text-slate-100 leading-tight text-center">
                    לכל שאלה או בעיה, כתבו לנו ונחזור אליכם בהקדם.
                  </p>
                  <button
                    onClick={handleWhatsAppSupport}
                    className="w-full py-3 bg-emerald-700/20 text-emerald-300 text-sm font-bold rounded-xl border border-emerald-700/50 flex items-center justify-center gap-2 hover:bg-emerald-700/30 transition-all"
                  >
                    <span>💬</span> פניה בוואטסאפ
                  </button>
                </div>
                <button onClick={() => setStep('form')} className="text-xs text-slate-200 underline hover:text-white">חזור לעדכון פרטים</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};

export default PurchaseModal;