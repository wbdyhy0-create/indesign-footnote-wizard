
import { GoogleGenAI } from "@google/genai";

const MODEL_NAME = 'gemini-3-flash-preview';

export async function askAssistant(prompt: string, context: string = "", history: {role: 'user' | 'model', text: string}[] = []) {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const systemInstruction = `
    You are the official AI support agent for FOOTNOTE WIZARD, a professional InDesign Automation solution.
    Context about the project: ${context}
    
    Rules:
    - Answer in professional, helpful Hebrew.
    - If the user asks about InDesign issues, provide professional layout advice.
    - Refer to the software as "FOOTNOTE WIZARD" exclusively.
    - Be concise but thorough.
    - Your goal is to support the user until their issue is resolved.
  `;

  try {
    const chatHistory = history.map(h => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.text }]
    }));

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [
        { role: 'user', parts: [{ text: systemInstruction }] },
        ...chatHistory,
        { role: 'user', parts: [{ text: prompt }] }
      ],
      config: {
        temperature: 0.7,
        topP: 0.95,
      },
    });
    
    return response.text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "מצטער, חלה שגיאה בתקשורת. האם תוכל לנסות לשאול שוב?";
  }
}
