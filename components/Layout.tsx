import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ScriptData, ChatMessage, MessageRole } from '../types'; 
import { askAssistant } from '../services/geminiService'; 
import ChatMessageComponent from './ChatMessage'; 

interface LayoutProps {
  children: React.ReactNode;
  activePage: string;
  setActivePage: (page: string) => void;
  scripts: ScriptData[];
}

const Layout: React.FC<LayoutProps> = ({ children, activePage, setActivePage, scripts }) => {
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [showAdminDialog, setShowAdminDialog] = useState(false);
  const [adminCodeInput, setAdminCodeInput] = useState('');
  const [adminError, setAdminError] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    {
      id: 'initial-ai',
      role: MessageRole.MODEL,
      text: 'שלום! איך אוכל לעזור לך היום בשימוש בסקריפטים שלנו?',
      timestamp: new Date(),
    }
  ]);
  const [userInput, setUserInput] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isHelpOpen) scrollToBottom();
  }, [chatHistory, isHelpOpen]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!userInput.trim() || isAiTyping) return;

    const userMessageText = userInput.trim();
    setUserInput('');

    const newUserMessage: ChatMessage = {
      id: Date.now().toString(),
      role: MessageRole.USER,
      text: userMessageText,
      timestamp: new Date(),
    };
    setChatHistory(prev => [...prev, newUserMessage]);
    setIsAiTyping(true);

    const context = scripts.map(s => `${s.name}: ${s.shortDesc}`).join(', ');

    try {
      const aiResponseText = await askAssistant(userMessageText, context, chatHistory);

      const newModelMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: MessageRole.MODEL,
        text: aiResponseText,
        timestamp: new Date(),
      };
      setChatHistory(prev => [...prev, newModelMessage]);
    } catch (error: unknown) {
      console.error('AI Assistant API Error:', error);
      const errorMessage = (error instanceof Error) ? error.message : 'שגיאה לא ידועה.';
      const errorChatMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: MessageRole.INFO,
        text: `אירעה שגיאה: ${errorMessage}. אנא בדוק את החיבור שלך או נסה שוב מאוחר יותר.`,
        timestamp: new Date(),
      };
      setChatHistory(prev => [...prev, errorChatMessage]);
    } finally {
      setIsAiTyping(false);
    }
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminCodeInput === '1967') { 
      setActivePage('admin');
      window.scrollTo(0, 0);
      setShowAdminDialog(false);
      setAdminCodeInput('');
      setAdminError('');
    } else {
      setAdminError('קוד שגוי. נסה שוב.');
    }
  };

  // פונקציית כפתור ניווט ללא Scale שגורם לגלילה
  const navButton = (page: string, label: string) => (
    <button
      key={page}
      onClick={() => setActivePage(page)}
      className={`transition-all duration-300 flex items-center gap-2 px-5 py-2.5 rounded-2xl text-lg font-black tracking-tight whitespace-nowrap ${
        activePage === page 
        ? 'text-white bg-amber-600 shadow-[0_0_15px_rgba(245,158,11,0.2)] border-2 border-amber-400' 
        : 'text-slate-300 hover:text-white hover:bg-slate-800/80 border-2 border-transparent'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#0f172a] text-slate-200 font-sans" dir="rtl">

      {/* סרגל ניווט עליון - גובה עודכן ל-h-28 למניעת דחיסה */}
      <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 shadow-xl">
        <div className="max-w-7xl mx-auto px-6 h-28 flex items-center justify-between flex-row-reverse">

          {/* לוגו בשמאל */}
          <div
            className="flex items-center gap-4 cursor-pointer group shrink-0"
            onClick={() => setActivePage('home')}
          >
            <div className="text-left hidden lg:block">
              <h1 className="text-2xl font-black text-amber-500 leading-none uppercase italic tracking-tighter">FOOTNOTE WIZARD</h1>
              <p className="text-xs text-slate-400 font-bold tracking-[0.2em]">INDESIGN AUTOMATION</p>
            </div>
            <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center text-3xl shadow-lg shadow-amber-500/20 group-hover:rotate-6 transition-transform">✒️</div>
          </div>

          {/* תפריט ניווט בימין - ללא overflow שיוצר פס גלילה */}
          <nav className="flex items-center gap-2 md:gap-4 py-2">
            {navButton('home', 'דף הבית')}
            {navButton('scripts-catalog', 'הסקריפטים שלנו')}
            {navButton('other-products', 'מוצרים נוספים')} {/* הנה הכפתור החדש שהוספנו! */}
            {navButton('about', 'אודות')}
            {navButton('contact', 'צור קשר')}
          </nav>

        </div>
      </header>

      {/* אזור התוכן המרכזי */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        <main className="flex-1 w-full max-w-7xl mx-auto p-6 md:p-12 overflow-y-auto custom-scrollbar">
          {children}

          {activePage === 'home' && (
            <div className="mt-20 pt-10 border-t border-slate-800/50 flex justify-center pb-10">
              <button
                onClick={() => setShowAdminDialog(true)}
                className="flex items-center gap-3 px-6 py-3 rounded-xl text-xs font-bold bg-slate-900/50 text-slate-600 hover:text-amber-500 hover:bg-slate-800 border border-slate-800 transition-all group"
              >
                <span className="opacity-50 group-hover:opacity-100">🔒</span>
                כניסה לממשק ניהול האתר
              </button>
            </div>
          )}
        </main>

        {/* Floating AI */}
        <div className="fixed bottom-8 left-0 right-0 z-50 pointer-events-none">
          <div className="max-w-7xl mx-auto px-6 flex justify-start">
            <div className="flex flex-col items-start pointer-events-auto">
              {isHelpOpen && (
                <div className="mb-6 w-80 md:w-96 bg-slate-900 border border-slate-700 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-fadeIn shadow-amber-500/5">
                  <div className="bg-slate-800 p-5 flex justify-between items-center border-b border-slate-700">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center text-lg">✒️</div>
                      <span className="font-bold text-white text-sm">תמיכת ה-AI</span>
                    </div>
                    <button onClick={() => setIsHelpOpen(false)} className="text-slate-400 hover:text-white">✕</button>
                  </div>
                  <div className="h-80 overflow-y-auto p-5 space-y-4 bg-slate-950/50 flex flex-col">
                    {chatHistory.map((msg) => (
                      <ChatMessageComponent key={msg.id} message={msg} />
                    ))}
                    {isAiTyping && <div className="flex self-start"><div className="bg-slate-800 p-3 rounded-2xl animate-pulse text-xs text-slate-500">מקליד...</div></div>}
                    <div ref={chatEndRef} />
                  </div>
                  <form onSubmit={handleSendMessage} className="p-4 bg-slate-900 border-t border-slate-800 flex gap-2">
                    <input
                      type="text" value={userInput} onChange={e => setUserInput(e.target.value)}
                      placeholder={isAiTyping ? 'ה-AI חושב...' : 'שאל אותי משהו...'}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm outline-none focus:border-amber-500 transition-colors disabled:opacity-50"
                      disabled={isAiTyping}
                    />
                    <button
                      type="submit"
                      className="bg-amber-600 hover:bg-amber-500 text-white p-2 rounded-xl transition-colors shadow-lg disabled:opacity-50"
                      disabled={isAiTyping}
                    >
                      <svg className="w-5 h-5 rtl-flip" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 19l9-7-9-7v14z" /></svg>
                    </button>
                  </form>
                </div>
              )}
              <button
                onClick={() => setIsHelpOpen(!isHelpOpen)}
                className={`w-16 h-16 rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all border-2 border-amber-500/20 text-3xl ${isHelpOpen ? 'bg-slate-800 text-amber-500' : 'bg-amber-600 text-white'}`}
              >
                {isHelpOpen ? '✕' : '✒️'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showAdminDialog && createPortal(
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] animate-fadeIn">
          <div className="bg-slate-900 p-8 rounded-3xl shadow-2xl border border-slate-700 w-96 text-center animate-scaleIn">
            <h2 className="text-2xl font-bold text-amber-500 mb-6">כניסה לממשק ניהול</h2>
            <form onSubmit={handleAdminLogin} className="flex flex-col gap-4">
              <input
                type="password"
                value={adminCodeInput}
                onChange={(e) => { setAdminCodeInput(e.target.value); setAdminError(''); }}
                placeholder="הזן קוד גישה"
                className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
              {adminError && <p className="text-red-500 text-sm">{adminError}</p>}
              <button
                type="submit"
                className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 rounded-xl transition-colors shadow-lg shadow-amber-600/20"
              >
                כניסה
              </button>
              <button
                type="button"
                onClick={() => { setShowAdminDialog(false); setAdminCodeInput(''); setAdminError(''); }}
                className="w-full bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold py-3 rounded-xl transition-colors"
              >
                ביטול
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Layout;