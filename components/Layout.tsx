import React, { useState, useRef, useEffect } from 'react';
import { ScriptData } from '../types';
import { askAssistant } from '../services/geminiService';

interface LayoutProps {
  children: React.ReactNode;
  activePage: string;
  setActivePage: (page: string) => void;
  scripts: ScriptData[];
}

interface Message {
  role: 'user' | 'model';
  text: string;
}

const Layout: React.FC<LayoutProps> = ({ children, activePage, setActivePage, scripts }) => {
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState<Message[]>([
    { role: 'model', text: 'שלום! איך אוכל לעזור לך היום בשימוש בסקריפטים שלנו?' }
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

    const userMessage = userInput.trim();
    setUserInput('');
    setChatHistory(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsAiTyping(true);

    const context = scripts.map(s => `${s.name}: ${s.shortDesc}`).join(', ');
    const aiResponse = await askAssistant(userMessage, context, chatHistory);

    setChatHistory(prev => [...prev, { role: 'model', text: aiResponse }]);
    setIsAiTyping(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0f172a] text-slate-200 font-sans" dir="rtl">
      
      {/* סרגל ניווט עליון - נקי ללא כפתור ניהול */}
      <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 shadow-xl">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          
          <div 
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => setActivePage('home')}
          >
            <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-2xl shadow-lg shadow-amber-500/20">✒️</div>
            <div>
              <h1 className="text-xl font-black text-amber-500 leading-none uppercase italic tracking-tighter">FOOTNOTE WIZARD</h1>
              <p className="text-[10px] text-slate-400 font-bold tracking-[0.2em]">INDESIGN AUTOMATION</p>
            </div>
          </div>

          <nav className="flex items-center gap-8">
            <button 
              onClick={() => setActivePage('home')}
              className={`font-bold transition-colors flex items-center gap-2 px-3 py-2 rounded-xl ${activePage === 'home' ? 'text-amber-500 bg-amber-500/10 border border-amber-500/20' : 'text-slate-400 hover:text-white'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
              דף הבית
            </button>

            <div className="relative group">
              <button className={`font-bold flex items-center gap-2 transition-colors px-3 py-2 rounded-xl ${activePage !== 'home' && activePage !== 'admin' ? 'text-amber-500 bg-amber-500/10' : 'text-slate-400 hover:text-white'}`}>
                הסקריפטים שלנו
                <svg className="w-4 h-4 transition-transform group-hover:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
              </button>
              
              <div className="absolute top-full right-0 mt-2 w-64 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden">
                <button 
                  onClick={() => setActivePage('scripts-catalog')}
                  className="w-full text-right px-6 py-4 text-amber-500 font-black hover:bg-slate-700 border-b border-slate-700 text-sm"
                >
                  ← כל הקטלוג
                </button>
                {scripts.map(s => (
                  <button 
                    key={s.id}
                    onClick={() => setActivePage(s.id)}
                    className="w-full text-right px-6 py-4 text-sm font-bold text-slate-300 hover:bg-slate-700 hover:text-white transition-colors border-b border-slate-700/50"
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          </nav>
          
          {/* מרווח בצד שמאל לאיזון הוויזואלי */}
          <div className="w-20 hidden md:block"></div>
        </div>
      </header>

      {/* אזור התוכן המרכזי */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        <main className="flex-1 w-full max-w-7xl mx-auto p-6 md:p-12 overflow-y-auto custom-scrollbar">
          {children}
          
          {/* כפתור ניהול בתחתית עמוד הבית בלבד */}
          {activePage === 'home' && (
            <div className="mt-20 pt-10 border-t border-slate-800/50 flex justify-center pb-10">
              <button 
                onClick={() => { setActivePage('admin'); window.scrollTo(0, 0); }}
                className="flex items-center gap-3 px-6 py-3 rounded-xl text-xs font-bold bg-slate-900/50 text-slate-600 hover:text-amber-500 hover:bg-slate-800 border border-slate-800 transition-all group"
              >
                <span className="opacity-50 group-hover:opacity-100">🔒</span>
                כניסה לממשק ניהול האתר
              </button>
            </div>
          )}
        </main>

        {/* Floating AI - מיושר עם התוכן המרכזי */}
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
                  <div className="h-80 overflow-y-auto p-5 space-y-4 bg-slate-950/50">
                    {chatHistory.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                        <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20' : 'bg-slate-800 text-slate-300 border border-slate-700'}`}>
                          {msg.text}
                        </div>
                      </div>
                    ))}
                    {isAiTyping && <div className="flex justify-end"><div className="bg-slate-800 p-3 rounded-2xl animate-pulse text-xs text-slate-500">מקליד...</div></div>}
                    <div ref={chatEndRef} />
                  </div>
                  <form onSubmit={handleSendMessage} className="p-4 bg-slate-900 border-t border-slate-800 flex gap-2">
                    <input 
                      type="text" value={userInput} onChange={e => setUserInput(e.target.value)}
                      placeholder="שאל אותי משהו..." className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm outline-none focus:border-amber-500 transition-colors"
                    />
                    <button type="submit" className="bg-amber-600 hover:bg-amber-500 text-white p-2 rounded-xl transition-colors shadow-lg">
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