import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { ChatMessage } from "@/types";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

export async function askAssistant(
  userMessage: string,
  context: string,
  chatHistory: ChatMessage[]
): Promise<string> {
  const history = chatHistory.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.text }],
  }));

  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        { role: 'user', parts: [{ text: `Context: ${context}` }] },
        ...history,
        { role: 'user', parts: [{ text: userMessage }] },
      ],
    });

    console.log("Gemini API raw result:", result);
    if (result && result.text) {
      return result.text;
    } else {
      console.error("Gemini API returned an empty or invalid response:", result);
      return "אני מצטער, קיבלתי תגובה לא תקינה מה-AI.";
    }
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    return "אני מצטער, אירעה שגיאה בעת התקשורת עם ה-AI. אנא נסה שוב מאוחר יותר.";
  }
}

