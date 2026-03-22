import { kv } from '@vercel/kv';

const VISITS_KEY = 'site_visits_total';

const parseCount = (raw: unknown): number => {
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.max(0, Math.floor(raw));
  if (typeof raw === 'string') {
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }
  return 0;
};

async function incrementVisits(): Promise<number> {
  const kvAny = kv as unknown as { incr?: (k: string) => Promise<number> };
  if (typeof kvAny.incr === 'function') {
    try {
      const next = await kvAny.incr(VISITS_KEY);
      if (typeof next === 'number' && Number.isFinite(next)) return Math.max(1, Math.floor(next));
    } catch {
      /* fall through to get/set */
    }
  }

  const current = parseCount(await kv.get(VISITS_KEY));
  const next = current + 1;
  await kv.set(VISITS_KEY, next);
  return next;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  try {
    if (req.method === 'GET') {
      const raw = await kv.get(VISITS_KEY);
      const count = parseCount(raw);
      return res.status(200).json({ success: true, count });
    }

    if (req.method === 'POST') {
      const count = await incrementVisits();
      return res.status(200).json({ success: true, count });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ success: false, error: 'שיטה לא מורשית' });
  } catch (error) {
    console.error('visits API error:', error);
    return res.status(500).json({ success: false, count: 0, error: 'לא ניתן לטעון מונה כניסות' });
  }
}
