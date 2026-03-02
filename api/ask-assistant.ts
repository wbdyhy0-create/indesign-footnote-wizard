import { GoogleGenAI } from '@google/genai';

export const config = {
  maxDuration: 30,
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'GEMINI_API_KEY not configured. Add it in Vercel → Settings → Environment Variables.',
    });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const userMessage = typeof body.userMessage === 'string' ? body.userMessage.trim() : '';
    const context = typeof body.context === 'string' ? body.context : '';
    const chatHistory = Array.isArray(body.chatHistory) ? body.chatHistory : [];

    if (!userMessage) {
      return res.status(400).json({ error: 'userMessage is required' });
    }

    const safeHistory = chatHistory
      .filter((item: any) => item && (item.role === 'user' || item.role === 'model'))
      .map((item: any) => ({
        role: item.role as 'user' | 'model',
        parts: [{ text: String(item?.text || '') }],
      }));

    const ai = new GoogleGenAI({ apiKey });
    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { role: 'user', parts: [{ text: `Context: ${context}` }] },
        ...safeHistory,
        { role: 'user', parts: [{ text: userMessage }] },
      ],
    });

    const text = result?.text || 'לא התקבלה תשובה.';
    return res.status(200).json({ text });
  } catch (error: any) {
    console.error('ask-assistant error:', error);
    return res.status(500).json({
      error: error?.message || 'שגיאה בתקשורת עם ה-AI',
    });
  }
}
