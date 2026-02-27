import { kv } from '@vercel/kv';

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

const getBitUrl = (phone: string, amountNis: number, text: string) => {
  const encodedText = encodeURIComponent(text);
  const normalizedAmount = Number.isInteger(amountNis) ? String(amountNis) : amountNis.toFixed(2);
  return `https://www.bitpay.co.il/app/pay-request/?phone=${phone}&amount=${normalizedAmount}&text=${encodedText}`;
};

export default async function handler(req: any, res: any) {
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

    const body = req.body || {};
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
          bitPayUrl: getBitUrl(BIT_PHONE, nextOrder.amountNis, payText),
          createdAt: nextOrder.createdAt,
        },
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

      return res.status(200).json({ success: true, order: updated });
    }

    return res.status(400).json({ success: false, error: 'פעולה לא נתמכת' });
  } catch (error) {
    console.error('Orders API failed:', error);
    return res.status(500).json({ success: false, error: 'שגיאה בשרת ההזמנות' });
  }
}
