import { kv } from '@vercel/kv';

type LeadRecord = {
  id: string;
  name: string;
  email: string;
  scriptName: string;
  timestamp: string;
};

const LEADS_KEY = 'leads_data';
const LEADS_LIST_KEY = 'leads_data_list_v1';
const MAX_LEADS = 5000;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const normalizeLeadRecord = (value: any): LeadRecord | null => {
  if (!value || typeof value !== 'object') return null;
  if (
    !isNonEmptyString(value.id) ||
    !isNonEmptyString(value.name) ||
    !isNonEmptyString(value.email) ||
    !isNonEmptyString(value.scriptName) ||
    !isNonEmptyString(value.timestamp)
  ) {
    return null;
  }

  return {
    id: String(value.id),
    name: String(value.name),
    email: String(value.email),
    scriptName: String(value.scriptName),
    timestamp: String(value.timestamp),
  };
};

const sortByNewest = (items: LeadRecord[]) =>
  [...items].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

const kvListApi = kv as unknown as {
  lrange?: (key: string, start: number, stop: number) => Promise<unknown>;
  lpush?: (key: string, ...values: (string | number | Buffer)[]) => Promise<unknown>;
  ltrim?: (key: string, start: number, stop: number) => Promise<unknown>;
};

const loadLeads = async (): Promise<LeadRecord[]> => {
  // Prefer list-based storage (more robust for concurrent writes).
  if (typeof kvListApi.lrange === 'function') {
    try {
      const raw = await kvListApi.lrange(LEADS_LIST_KEY, 0, MAX_LEADS - 1);
      if (Array.isArray(raw)) {
        const parsed = raw
          .map((item) => {
            try {
              if (typeof item === 'string') return JSON.parse(item);
              return item;
            } catch {
              return null;
            }
          })
          .map(normalizeLeadRecord)
          .filter(Boolean) as LeadRecord[];
        if (parsed.length > 0) return sortByNewest(parsed);
      }
    } catch {
      // fall back to legacy key
    }
  }

  const rawLeads = await kv.get(LEADS_KEY);
  const leads = Array.isArray(rawLeads) ? rawLeads.map(normalizeLeadRecord).filter(Boolean) : [];
  return sortByNewest(leads as LeadRecord[]);
};

const saveLead = async (lead: LeadRecord): Promise<void> => {
  // Prefer list-based write.
  if (typeof kvListApi.lpush === 'function' && typeof kvListApi.ltrim === 'function') {
    const payload = JSON.stringify(lead);
    try {
      await kvListApi.lpush(LEADS_LIST_KEY, payload);
    } catch (error: any) {
      const msg = error?.message ? String(error.message) : String(error);
      throw new Error(`kv.lpush failed: ${msg}`);
    }
    // keep only newest MAX_LEADS items
    try {
      await kvListApi.ltrim(LEADS_LIST_KEY, 0, MAX_LEADS - 1);
    } catch (error: any) {
      const msg = error?.message ? String(error.message) : String(error);
      throw new Error(`kv.ltrim failed: ${msg}`);
    }
    return;
  }

  // Legacy fallback: read-modify-write array
  const existingRaw = await kv.get(LEADS_KEY);
  const existing = Array.isArray(existingRaw)
    ? (existingRaw.map(normalizeLeadRecord).filter(Boolean) as LeadRecord[])
    : [];

  const updated = sortByNewest([lead, ...existing]).slice(0, MAX_LEADS);
  try {
    await kv.set(LEADS_KEY, updated);
  } catch (error: any) {
    const msg = error?.message ? String(error.message) : String(error);
    throw new Error(`kv.set failed: ${msg}`);
  }
};

export default async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    try {
      return res.status(200).json({
        success: true,
        leads: await loadLeads(),
      });
    } catch (error) {
      console.error('Failed to load leads:', error);
      const details = (error as any)?.message ? String((error as any).message) : null;
      return res.status(500).json({ success: false, error: 'שגיאה בטעינת הלידים', details });
    }
  }

  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const email = typeof body.email === 'string' ? body.email.trim() : '';
      const scriptName = typeof body.scriptName === 'string' ? body.scriptName.trim() : '';

      if (!name || !email || !scriptName) {
        return res.status(400).json({ success: false, error: 'חסרים פרטי ליד' });
      }

      const now = new Date().toISOString();
      const nextLead: LeadRecord = {
        id: `lead-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        name,
        email,
        scriptName,
        timestamp: isNonEmptyString(body.timestamp) ? body.timestamp : now,
      };

      await saveLead(nextLead);

      return res.status(200).json({ success: true, lead: nextLead });
    } catch (error) {
      console.error('Failed to save lead:', error);
      const details = (error as any)?.message ? String((error as any).message) : null;
      return res.status(500).json({ success: false, error: 'שגיאה בשמירת הליד', details });
    }
  }

  return res.status(405).json({ success: false, error: 'שיטה לא מורשית' });
}
