import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { GoogleGenAI } from '@google/genai';

export default defineConfig(({ mode }) => {
    // טעינת משתני הסביבה (במחשב המקומי הוא יחפש בקובץ .env, ב-Vercel הוא ימשוך מה"כספת")
    const env = loadEnv(mode, '.', '');
    
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        {
          name: 'local-api-routes',
          configureServer(server) {
            const upsertById = (existing: any, incoming: any) => {
              const base = Array.isArray(existing) ? [...existing] : [];
              const next = Array.isArray(incoming) ? incoming : [];

              const indexById = new Map<string, number>();
              base.forEach((item, index) => {
                if (item && typeof item.id === 'string') {
                  indexById.set(item.id, index);
                }
              });

              next.forEach((item) => {
                if (item && typeof item.id === 'string') {
                  const existingIndex = indexById.get(item.id);
                  if (existingIndex === undefined) {
                    indexById.set(item.id, base.length);
                    base.push(item);
                  } else {
                    base[existingIndex] = item;
                  }
                  return;
                }
                base.push(item);
              });

              return base;
            };

            // in-memory store for local dev sync between devices simulation
            let localCloudData: { scripts: any[] | null; products: any[] | null; covers: any[] | null } = {
              scripts: null,
              products: null,
              covers: null,
            };
            let localLeads: any[] = [];

            // local route for admin cloud sync
            server.middlewares.use('/api/update-scripts', (req, res, next) => {
              if (req.method === 'GET') {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.end(JSON.stringify({ success: true, ...localCloudData }));
                return;
              }

              if (req.method === 'POST') {
                let rawBody = '';
                req.on('data', (chunk) => {
                  rawBody += chunk;
                });
                req.on('end', () => {
                  try {
                    const body = rawBody ? JSON.parse(rawBody) : {};
                    const scripts = Array.isArray(body) ? body : body.scripts;
                    const products = Array.isArray(body?.products) ? body.products : localCloudData.products;
                    const covers = Array.isArray(body?.covers) ? body.covers : localCloudData.covers;

                    if (!Array.isArray(scripts)) {
                      res.statusCode = 400;
                      res.setHeader('Content-Type', 'application/json; charset=utf-8');
                      res.end(JSON.stringify({ success: false, error: 'פורמט סקריפטים לא תקין' }));
                      return;
                    }

                    localCloudData = {
                      scripts: upsertById(localCloudData.scripts, scripts),
                      products: products ? upsertById(localCloudData.products, products) : localCloudData.products,
                      covers: covers ? upsertById(localCloudData.covers, covers) : localCloudData.covers,
                    };
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json; charset=utf-8');
                    res.end(JSON.stringify({ success: true, message: 'Local cloud sync updated' }));
                  } catch {
                    res.statusCode = 500;
                    res.setHeader('Content-Type', 'application/json; charset=utf-8');
                    res.end(JSON.stringify({ success: false, error: 'שגיאה בשמירה מקומית' }));
                  }
                });
                return;
              }

              res.statusCode = 405;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ success: false, error: 'שיטה לא מורשית' }));
            });

            // local route for leads collection (dev only)
            server.middlewares.use('/api/leads', (req, res) => {
              if (req.method === 'GET') {
                const sortedLeads = [...localLeads].sort(
                  (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
                );
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.end(JSON.stringify({ success: true, leads: sortedLeads }));
                return;
              }

              if (req.method === 'POST') {
                let rawBody = '';
                req.on('data', (chunk) => {
                  rawBody += chunk;
                });
                req.on('end', () => {
                  try {
                    const body = rawBody ? JSON.parse(rawBody) : {};
                    const name = typeof body?.name === 'string' ? body.name.trim() : '';
                    const email = typeof body?.email === 'string' ? body.email.trim() : '';
                    const scriptName = typeof body?.scriptName === 'string' ? body.scriptName.trim() : '';
                    if (!name || !email || !scriptName) {
                      res.statusCode = 400;
                      res.setHeader('Content-Type', 'application/json; charset=utf-8');
                      res.end(JSON.stringify({ success: false, error: 'חסרים פרטי ליד' }));
                      return;
                    }

                    const nextLead = {
                      id: `lead-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                      name,
                      email,
                      scriptName,
                      timestamp: typeof body?.timestamp === 'string' ? body.timestamp : new Date().toISOString(),
                    };
                    localLeads = [nextLead, ...localLeads];

                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json; charset=utf-8');
                    res.end(JSON.stringify({ success: true, lead: nextLead }));
                  } catch {
                    res.statusCode = 500;
                    res.setHeader('Content-Type', 'application/json; charset=utf-8');
                    res.end(JSON.stringify({ success: false, error: 'שגיאה בשמירת ליד מקומי' }));
                  }
                });
                return;
              }

              res.statusCode = 405;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ success: false, error: 'שיטה לא מורשית' }));
            });

            // local route for cover image upload (Vercel Blob is not available in plain vite dev)
            server.middlewares.use('/api/upload-cover-image', (req, res) => {
              if (req.method !== 'POST') {
                res.statusCode = 405;
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.end(JSON.stringify({ success: false, error: 'שיטה לא מורשית' }));
                return;
              }

              res.statusCode = 501;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(
                JSON.stringify({
                  success: false,
                  error:
                    'העלאה לענן זמינה בפריסת Vercel בלבד. לפיתוח מקומי השתמש ב-vercel dev או הזן URL ציבורי לתמונה.',
                }),
              );
            });

            // local route for AI assistant in dev
            server.middlewares.use('/api/ask-assistant', async (req, res, next) => {
              if (req.method !== 'POST') {
                next();
                return;
              }

              const apiKey = env.GEMINI_API_KEY;
              if (!apiKey) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.end(JSON.stringify({ error: 'Missing GEMINI_API_KEY in .env' }));
                return;
              }

              let rawBody = '';
              req.on('data', (chunk) => {
                rawBody += chunk;
              });

              req.on('end', async () => {
                try {
                  const body = rawBody ? JSON.parse(rawBody) : {};
                  const userMessage = typeof body.userMessage === 'string' ? body.userMessage : '';
                  const context = typeof body.context === 'string' ? body.context : '';
                  const chatHistory = Array.isArray(body.chatHistory) ? body.chatHistory : [];

                  if (!userMessage.trim()) {
                    res.statusCode = 400;
                    res.setHeader('Content-Type', 'application/json; charset=utf-8');
                    res.end(JSON.stringify({ error: 'userMessage is required' }));
                    return;
                  }

                  const safeHistory = chatHistory
                    .filter((item: any) => item && (item.role === 'user' || item.role === 'model'))
                    .map((item: any) => ({
                      role: item.role,
                      parts: Array.isArray(item.parts) ? item.parts : [{ text: String(item?.text || '') }],
                    }));

                  const ai = new GoogleGenAI({ apiKey });
                  const model = env.GEMINI_MODEL || 'gemini-2.5-flash';
                  const result = await ai.models.generateContent({
                    model,
                    contents: [
                      { role: 'user', parts: [{ text: `Context: ${context}` }] },
                      ...safeHistory,
                      { role: 'user', parts: [{ text: userMessage }] },
                    ],
                  });

                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json; charset=utf-8');
                  res.end(JSON.stringify({ text: result?.text || 'לא התקבלה תשובה.' }));
                } catch (error: any) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json; charset=utf-8');
                  res.end(JSON.stringify({ error: error?.message || 'Local API error' }));
                }
              });
            });
          },
        },
      ],
      define: {
        // התיקון המרכזי: הגדרת השם שגוגל סטודיו מחפש
        'process.env.API_KEY': JSON.stringify(env.API_KEY),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});