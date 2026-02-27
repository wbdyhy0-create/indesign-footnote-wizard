import React, { useState, useRef, useEffect } from 'react';
import { ScriptData, ChatMessage, MessageRole } from '../types'; 
import { askAssistant } from '../services/geminiService'; 
import ChatMessageComponent from './ChatMessage'; 

interface LayoutProps {
  children: React.ReactNode;
  activePage: string;
  setActivePage: (page: string) => void;
  scripts: ScriptData[];
  products: any[];
  covers: any[];
}

const Layout: React.FC<LayoutProps> = ({ children, activePage, setActivePage, scripts, products, covers }) => {
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
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

  useEffect(() => {
    setIsMenuOpen(false);
  }, [activePage]);

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

  const navItems = [
    { page: 'home', label: 'דף הבית' },
    { page: 'scripts-catalog', label: 'הסקריפטים שלנו' },
    { page: 'other-products', label: 'מוצרים נוספים' },
    { page: 'torah-covers', label: 'עיצוב כריכות תורניים' },
    { page: 'about', label: 'אודות' },
    { page: 'contact', label: 'צור קשר' },
  ];

  const getActiveNavPage = () => {
    if (navItems.some((item) => item.page === activePage)) return activePage;
    if (scripts.some((s) => s.id === activePage)) return 'scripts-catalog';
    if (products.some((p: any) => p.id === activePage)) return 'other-products';
    if (covers.some((c: any) => c.id === activePage)) return 'torah-covers';
    return activePage;
  };

  const activeNavPage = getActiveNavPage();

  // פונקציית כפתור ניווט ללא Scale שגורם לגלילה
  const navButton = (page: string, label: string) => (
    <button
      key={page}
      onClick={() => setActivePage(page)}
      className={`transition-all duration-300 flex items-center gap-2 px-3 md:px-4 lg:px-5 py-2.5 rounded-2xl text-sm md:text-sm lg:text-base font-black tracking-tight whitespace-nowrap ${
        activeNavPage === page 
        ? 'text-white bg-amber-600 shadow-[0_0_15px_rgba(245,158,11,0.2)] border-2 border-amber-400' 
        : 'text-slate-300 hover:text-white hover:bg-slate-800/80 border-2 border-transparent'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden bg-[#0f172a] text-slate-200 font-sans" dir="rtl">

      {/* סרגל ניווט עליון - גובה עודכן ל-h-28 למניעת דחיסה */}
      <header className="sticky top-0 z-50 relative bg-slate-900/95 backdrop-blur-md border-b border-slate-800 shadow-xl">
      <div className="max-w-6xl mx-auto px-5 md:px-6 h-24 flex items-center justify-between gap-4">


          {/* כפתורי פעולה קבועים - בצד ימין */}
          <div className="relative flex items-center gap-2 shrink-0">
            <button
              type="button"
              aria-label={isMenuOpen ? 'סגור תפריט' : 'פתח תפריט'}
              aria-expanded={isMenuOpen}
              onClick={() => setIsMenuOpen((prev) => !prev)}
              className="block w-12 h-12 rounded-2xl border-2 border-slate-700 bg-slate-800/80 text-slate-200 flex items-center justify-center text-2xl shadow-lg hover:border-amber-500/60 hover:text-amber-400 transition-colors z-[110]"
            >
              {isMenuOpen ? '✕' : '☰'}
            </button>
            <button
              type="button"
              onClick={() => {
                setActivePage('home');
                setIsMenuOpen(false);
              }}
              className="px-4 py-2 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 hover:text-amber-200 text-sm font-bold transition-colors"
            >
              דף הבית
            </button>

            {isMenuOpen && (
              <div className="absolute top-[calc(100%+0.75rem)] right-0 z-[100] w-[min(22rem,90vw)] bg-slate-950 border border-slate-700 rounded-2xl shadow-2xl p-3">
                <nav className="w-full flex flex-col gap-2">
                  {navItems.map((item) => (
                    <button
                      key={item.page}
                      onClick={() => {
                        setActivePage(item.page);
                        setIsMenuOpen(false);
                      }}
                      className={`w-full text-right transition-all duration-300 px-5 py-3 rounded-2xl text-base font-black tracking-tight ${
                        activeNavPage === item.page
                          ? 'text-white bg-amber-600 shadow-[0_0_15px_rgba(245,158,11,0.2)] border-2 border-amber-400'
                          : 'text-slate-300 bg-slate-900/70 hover:text-white hover:bg-slate-800 border-2 border-slate-700/60'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </nav>
              </div>
            )}
          </div>

          {/* ניווט בדסקטופ - במרכז */}
          <div className="hidden md:flex items-center min-w-0 flex-1 justify-center">
            <nav className="flex items-center gap-2 md:gap-3 lg:gap-4 py-2 flex-wrap">
              {navItems.map((item) => navButton(item.page, item.label))}
            </nav>
          </div>

          {/* לוגו בקצה שמאל */}
          <div
            className="flex items-center gap-4 cursor-pointer group shrink-0"
            onClick={() => {
              setActivePage('home');
              setIsMenuOpen(false);
            }}
          >
            <div className="text-left hidden lg:block">
              <h1 className="text-2xl font-black text-amber-500 leading-none uppercase italic tracking-tighter">FOOTNOTE WIZARD</h1>
              <p className="text-xs text-slate-400 font-bold tracking-[0.2em]">INDESIGN AUTOMATION</p>
            </div>
            <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center text-3xl shadow-lg shadow-amber-500/20 group-hover:rotate-6 transition-transform">✒️</div>
          </div>

        </div>
        

      </header>

      {/* אזור התוכן המרכזי */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        <main className="flex-1 w-full max-w-6xl mx-auto p-5 md:p-8 overflow-y-auto custom-scrollbar">
          {children}
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

    </div>
  );
};

export default Layout;