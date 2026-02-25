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
            // in-memory store for local dev sync between devices simulation
            let localCloudData: { scripts: any[] | null; products: any[] | null; covers: any[] | null } = {
              scripts: null,
              products: null,
              covers: null,
            };

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

                    localCloudData = { scripts, products: products || null, covers: covers || null };
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