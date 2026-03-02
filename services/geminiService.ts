import { ChatMessage } from "@/types";

export async function askAssistant(
  userMessage: string,
  context: string,
  chatHistory: ChatMessage[]
): Promise<string> {
  try {
    const res = await fetch('/api/ask-assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userMessage,
        context,
        chatHistory: chatHistory.map((m) => ({ role: m.role === 'user' ? 'user' : 'model', text: m.text })),
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = data?.error || `שגיאה ${res.status}`;
      return `אני מצטער, אירעה שגיאה: ${msg}. אנא נסה שוב מאוחר יותר.`;
    }

    return data?.text || "מצטער, לא התקבלה תשובה.";
  } catch (error) {
    console.error("Error calling AI assistant:", error);
    return "אני מצטער, אירעה שגיאה בעת התקשורת עם ה-AI. אנא נסה שוב מאוחר יותר.";
  }
}

