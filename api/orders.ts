import { kv } from '@vercel/kv';

/** מוטמע כאן בכוונה — ייבוא מ־../utils עלול לא להיכלל בבנדל של Vercel ולגרום ל־FUNCTION_INVOCATION_FAILED. */
function normalizeBitRecipientPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('972')) return digits;
  if (digits.startsWith('0') && digits.length >= 9) return `972${digits.slice(1)}`;
  return digits;
}

function buildBitPayRequestUrl(phone: string, amountNis: number, text: string): string {
  const normalizedPhone = normalizeBitRecipientPhone(phone);
  const encodedText = encodeURIComponent(text);
  const normalizedAmount = Number.isInteger(amountNis) ? String(amountNis) : amountNis.toFixed(2);
  return `https://www.bitpay.co.il/app/pay-request/?phone=${normalizedPhone}&amount=${normalizedAmount}&text=${encodedText}`;
}

const parsePostJsonBody = (req: any): Record<string, unknown> => {
  try {
    const raw =
      typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {});
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      return raw as Record<string, unknown>;
    }
  } catch {
    /* ignore */
  }
  return {};
};

type OrderStatus = 'pending' | 'paid';

type OrderRecord = {
  id: string;
  orderCode: string;
  customerName: string;
  customerEmail: string;
  productId: string;
  productName: string;
  amountNis: number;
  priceLabel: string;
  status: OrderStatus;
  createdAt: string;
  paidAt: string | null;
  downloadUrl: string;
  customerToken?: string;
};

const ORDERS_KEY = 'orders_data';
const MAX_ORDERS = 5000;
const BIT_PHONE = '0522284432';
const BIT_RECIPIENT_NAME = 'יוסף עובדיה';
const ADMIN_CODE = process.env.ADMIN_PORTAL_CODE || '1967';

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const normalizeEmail = (value: unknown) =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

const parseAmountFromPrice = (priceLabel: string) => {
  const matched = priceLabel.replace(',', '.').match(/(\d+(?:\.\d+)?)/);
  if (!matched) return null;
  const amount = Number(matched[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return amount;
};

const createOrderCode = () =>
  `FW-${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

const sortByNewest = (items: OrderRecord[]) =>
  [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

const normalizeOrderRecord = (value: any): OrderRecord | null => {
  if (!value || typeof value !== 'object') return null;
  if (
    !isNonEmptyString(value.id) ||
    !isNonEmptyString(value.orderCode) ||
    !isNonEmptyString(value.customerName) ||
    !isNonEmptyString(value.customerEmail) ||
    !isNonEmptyString(value.productId) ||
    !isNonEmptyString(value.productName) ||
    !isNonEmptyString(value.priceLabel) ||
    !isNonEmptyString(value.createdAt) ||
    !isNonEmptyString(value.downloadUrl)
  ) {
    return null;
  }

  const amountNis = Number(value.amountNis);
  if (!Number.isFinite(amountNis) || amountNis <= 0) return null;

  const status: OrderStatus = value.status === 'paid' ? 'paid' : 'pending';

  return {
    id: String(value.id),
    orderCode: String(value.orderCode),
    customerName: String(value.customerName),
    customerEmail: String(value.customerEmail).toLowerCase(),
    productId: String(value.productId),
    productName: String(value.productName),
    amountNis,
    priceLabel: String(value.priceLabel),
    status,
    createdAt: String(value.createdAt),
    paidAt: value.paidAt ? String(value.paidAt) : null,
    downloadUrl: String(value.downloadUrl),
    customerToken: value.customerToken ? String(value.customerToken) : undefined,
  };
};

const loadOrders = async () => {
  const raw = await kv.get(ORDERS_KEY);
  if (!Array.isArray(raw)) return [] as OrderRecord[];
  return raw.map(normalizeOrderRecord).filter(Boolean) as OrderRecord[];
};

const saveOrders = async (orders: OrderRecord[]) => {
  await kv.set(ORDERS_KEY, sortByNewest(orders).slice(0, MAX_ORDERS));
};

const sendDownloadEmail = async (order: OrderRecord): Promise<{ sent: boolean; error?: string }> => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, error: 'RESEND_API_KEY not configured' };

  const from =
    process.env.RESEND_FROM_EMAIL?.trim() || 'Footnote Wizard <onboarding@resend.dev>';

  const html = `
        <div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#0f172a;color:#e2e8f0;border-radius:16px;">
          <h1 style="color:#f59e0b;font-size:24px;margin-bottom:8px;">תודה על הרכישה!</h1>
          <p style="font-size:16px;line-height:1.7;color:#94a3b8;">
            שלום ${order.customerName},<br/>
            התשלום עבור <strong style="color:#e2e8f0;">${order.productName}</strong> אושר בהצלחה.
          </p>
          <p style="font-size:14px;color:#64748b;margin-bottom:24px;">
            קוד הזמנה: <strong style="color:#818cf8;">${order.orderCode}</strong> &nbsp;|&nbsp; סכום: <strong style="color:#fbbf24;">${order.priceLabel}</strong>
          </p>
          <div style="text-align:center;margin:32px 0;">
            <a href="${order.downloadUrl}" style="display:inline-block;padding:16px 48px;background:#f59e0b;color:#0f172a;font-weight:900;font-size:18px;border-radius:12px;text-decoration:none;">
              הורד את הקובץ
            </a>
          </div>
          <p style="font-size:13px;color:#475569;line-height:1.6;">
            אם הכפתור לא עובד, העתק את הקישור הבא לדפדפן:<br/>
            <a href="${order.downloadUrl}" style="color:#818cf8;word-break:break-all;">${order.downloadUrl}</a>
          </p>
          <div style="background:#1e293b;border-radius:8px;padding:12px 16px;margin:20px 0;">
            <p style="font-size:13px;color:#fbbf24;margin:0;font-weight:bold;">
              לא מוצא את המייל? בדוק בתיקיית הספאם / דואר זבל ולחץ "זה לא ספאם".
            </p>
          </div>
          <hr style="border:none;border-top:1px solid #1e293b;margin:24px 0;"/>
          <p style="font-size:12px;color:#334155;text-align:center;">
            Footnote Wizard – פתרונות אוטומציה למעמדים &nbsp;|&nbsp; יוסף עובדיה
          </p>
        </div>
      `;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [order.customerEmail],
        subject: `הקובץ שלך מוכן להורדה – ${order.productName}`,
        html,
      }),
    });

    const payload = (await r.json().catch(() => ({}))) as {
      message?: string;
      name?: string;
      statusCode?: number;
    };

    if (!r.ok) {
      const msg =
        payload?.message ||
        payload?.name ||
        (Object.keys(payload).length ? JSON.stringify(payload) : null) ||
        `Resend HTTP ${r.status}`;
      console.error('Resend API error:', r.status, payload);
      return { sent: false, error: String(msg) };
    }
    return { sent: true };
  } catch (e: any) {
    console.error('Email send failed:', e);
    return { sent: false, error: e?.message || 'Unknown email error' };
  }
};

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  try {
    if (req.method === 'GET') {
      const adminCode = typeof req.query?.adminCode === 'string' ? req.query.adminCode : '';
      if (adminCode !== ADMIN_CODE) {
        return res.status(401).json({ success: false, error: 'אין הרשאה' });
      }

      const orders = await loadOrders();
      return res.status(200).json({ success: true, orders: sortByNewest(orders) });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'שיטה לא מורשית' });
    }

    const body = parsePostJsonBody(req);
    const action = typeof body.action === 'string' ? body.action : '';

    if (action === 'create') {
      const customerName = typeof body.customerName === 'string' ? body.customerName.trim() : '';
      const customerEmail = normalizeEmail(body.customerEmail);
      const productId = typeof body.productId === 'string' ? body.productId.trim() : '';
      const productName = typeof body.productName === 'string' ? body.productName.trim() : '';
      const priceLabel = typeof body.priceLabel === 'string' ? body.priceLabel.trim() : '';
      const downloadUrl = typeof body.downloadUrl === 'string' ? body.downloadUrl.trim() : '';

      if (!customerName || !customerEmail || !productId || !productName || !priceLabel || !downloadUrl) {
        return res.status(400).json({ success: false, error: 'חסרים נתוני הזמנה' });
      }

      const amountNis = parseAmountFromPrice(priceLabel);
      if (!amountNis) {
        return res.status(400).json({ success: false, error: 'מחיר לא תקין להזמנה' });
      }

      const now = new Date().toISOString();
      const customerToken = Math.random().toString(36).slice(2) + Date.now().toString(36);
      const nextOrder: OrderRecord = {
        id: `order-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        orderCode: createOrderCode(),
        customerName,
        customerEmail,
        productId,
        productName,
        amountNis,
        priceLabel,
        status: 'pending',
        createdAt: now,
        paidAt: null,
        downloadUrl,
        customerToken,
      };

      const existing = await loadOrders();
      await saveOrders([nextOrder, ...existing]);

      const payText = `רכישת ${productName} | הזמנה ${nextOrder.orderCode}`;
      return res.status(200).json({
        success: true,
        order: {
          id: nextOrder.id,
          orderCode: nextOrder.orderCode,
          status: nextOrder.status,
          amountNis: nextOrder.amountNis,
          priceLabel: nextOrder.priceLabel,
          bitRecipientName: BIT_RECIPIENT_NAME,
          bitPhone: BIT_PHONE,
          bitPayUrl: buildBitPayRequestUrl(BIT_PHONE, nextOrder.amountNis, payText),
          createdAt: nextOrder.createdAt,
          customerToken: nextOrder.customerToken,
        },
      });
    }

    if (action === 'mark-paid-customer') {
      const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : '';
      const customerEmail = normalizeEmail(body.customerEmail);
      const customerToken = typeof body.customerToken === 'string' ? body.customerToken.trim() : '';
      // אם customerToken חסר (למשל הזמנות ישנות/מצבים בהם הלקוח לא קיבל את הטוקן),
      // עדיין אפשר לזהות הזמנה בבטחה סבירה לפי orderId + customerEmail.
      if (!orderId || !customerEmail) {
        return res.status(400).json({ success: false, error: 'חסרים פרטי אישור' });
      }

      const orders = await loadOrders();
      const index = orders.findIndex(
        (item) =>
          item.id === orderId &&
          item.customerEmail === customerEmail &&
          (!customerToken || item.customerToken === customerToken)
      );
      if (index === -1) {
        return res.status(404).json({ success: false, error: 'הזמנה לא נמצאה או פרטי אישור לא תואמים' });
      }

      const current = orders[index];
      if (current.status === 'paid') {
        return res.status(200).json({ success: true, order: current, alreadyPaid: true });
      }

      const updated: OrderRecord = {
        ...current,
        status: 'paid',
        paidAt: current.paidAt || new Date().toISOString(),
      };
      const next = [...orders];
      next[index] = updated;
      await saveOrders(next);

      let emailResult: { sent: boolean; error?: string };
      try {
        emailResult = await sendDownloadEmail(updated);
      } catch (emailCrash: any) {
        console.error('sendDownloadEmail threw:', emailCrash);
        emailResult = { sent: false, error: emailCrash?.message || String(emailCrash) };
      }

      return res.status(200).json({
        success: true,
        order: updated,
        emailSent: emailResult.sent,
        emailError: emailResult.error || null,
      });
    }

    if (action === 'status') {
      const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : '';
      const customerEmail = normalizeEmail(body.customerEmail);
      if (!orderId || !customerEmail) {
        return res.status(400).json({ success: false, error: 'חסרים פרטי בדיקה' });
      }

      const orders = await loadOrders();
      const order = orders.find((item) => item.id === orderId && item.customerEmail === customerEmail);
      if (!order) {
        return res.status(404).json({ success: false, error: 'הזמנה לא נמצאה' });
      }

      return res.status(200).json({
        success: true,
        order: {
          id: order.id,
          orderCode: order.orderCode,
          status: order.status,
          productName: order.productName,
          amountNis: order.amountNis,
          priceLabel: order.priceLabel,
          paidAt: order.paidAt,
          createdAt: order.createdAt,
        },
        downloadUrl: order.status === 'paid' ? order.downloadUrl : null,
      });
    }

    if (action === 'mark-paid') {
      const adminCode = typeof body.adminCode === 'string' ? body.adminCode : '';
      const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : '';
      if (adminCode !== ADMIN_CODE) {
        return res.status(401).json({ success: false, error: 'אין הרשאה' });
      }
      if (!orderId) {
        return res.status(400).json({ success: false, error: 'חסר מזהה הזמנה' });
      }

      const orders = await loadOrders();
      const index = orders.findIndex((item) => item.id === orderId);
      if (index === -1) {
        return res.status(404).json({ success: false, error: 'הזמנה לא נמצאה' });
      }

      const current = orders[index];
      const updated: OrderRecord = {
        ...current,
        status: 'paid',
        paidAt: current.paidAt || new Date().toISOString(),
      };
      const next = [...orders];
      next[index] = updated;
      await saveOrders(next);

      let emailResult: { sent: boolean; error?: string };
      try {
        emailResult = await sendDownloadEmail(updated);
      } catch (emailCrash: any) {
        console.error('sendDownloadEmail threw:', emailCrash);
        emailResult = { sent: false, error: emailCrash?.message || String(emailCrash) };
      }

      return res.status(200).json({
        success: true,
        order: updated,
        emailSent: emailResult.sent,
        emailError: emailResult.error || null,
      });
    }

    return res.status(400).json({ success: false, error: 'פעולה לא נתמכת' });
  } catch (error) {
    console.error('Orders API failed:', error);
    return res.status(500).json({ success: false, error: 'שגיאה בשרת ההזמנות' });
  }
}
