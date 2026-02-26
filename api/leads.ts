import { kv } from '@vercel/kv';

type LeadRecord = {
  id: string;
  name: string;
  email: string;
  scriptName: string;
  timestamp: string;
};

const LEADS_KEY = 'leads_data';
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

export default async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    try {
      const rawLeads = await kv.get(LEADS_KEY);
      const leads = Array.isArray(rawLeads)
        ? rawLeads.map(normalizeLeadRecord).filter(Boolean)
        : [];

      return res.status(200).json({
        success: true,
        leads: sortByNewest(leads as LeadRecord[]),
      });
    } catch (error) {
      console.error('Failed to load leads:', error);
      return res.status(500).json({ success: false, error: 'שגיאה בטעינת הלידים' });
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

      const existingRaw = await kv.get(LEADS_KEY);
      const existing = Array.isArray(existingRaw)
        ? (existingRaw.map(normalizeLeadRecord).filter(Boolean) as LeadRecord[])
        : [];

      const updated = sortByNewest([nextLead, ...existing]).slice(0, MAX_LEADS);
      await kv.set(LEADS_KEY, updated);

      return res.status(200).json({ success: true, lead: nextLead });
    } catch (error) {
      console.error('Failed to save lead:', error);
      return res.status(500).json({ success: false, error: 'שגיאה בשמירת הליד' });
    }
  }

  return res.status(405).json({ success: false, error: 'שיטה לא מורשית' });
}
