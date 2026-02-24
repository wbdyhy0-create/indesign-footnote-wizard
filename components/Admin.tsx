import React, { useState, useEffect } from 'react';
import { SCRIPTS as initialScripts } from '../constants';

const AdminPortal: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [scripts, setScripts] = useState<any[]>(initialScripts);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingScript, setEditingScript] = useState<any>(null);
  const [showJsonView, setShowJsonView] = useState(false);

  const SECRET_PASSWORD = "1967";

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === SECRET_PASSWORD) setIsAuthenticated(true);
    else alert("סיסמה שגויה!");
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setPassword('');
    window.location.reload();
  };

  const clearBrowserCache = () => {
    if (window.confirm("האם לאפס את זיכרון הדפדפן? הממשק יתרענן.")) {
      localStorage.clear();
      window.location.reload();
    }
  };

  const publishToCloud = async () => {
    const confirmPublish = window.confirm("האם אתה בטוח שברצונך לפרסם את השינויים לאתר החי?");
    if (!confirmPublish) return;

    try {
      const res = await fetch('/api/update-scripts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scripts),
      });
      
      if (res.ok) alert("🎉 האתר עודכן בהצלחה בענן!");
      else alert("❌ שגיאה בעדכון (בדוק חיבור KV בורסל).");
    } catch (e) {
      alert("🔌 תקלת תקשורת עם השרת.");
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 text-right" dir="rtl">
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl text-white text-center">
          <h1 className="text-2xl font-black mb-6">כניסת מנהל</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-center text-white outline-none focus:border-amber-500" placeholder="הזן סיסמה" />
            <button type="submit" className="w-full py-4 bg-amber-600 text-white font-black rounded-2xl shadow-xl hover:bg-amber-500 transition-colors">התחבר</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080c1d] p-6 md:p-12 text-right text-white font-sans" dir="rtl">
      <div className="max-w-5xl mx-auto">
        {/* כותרת וניהול עליון */}
        <div className="bg-slate-900/50 border border-slate-800/50 p-8 rounded-[2.5rem] mb-10 flex flex-col md:flex-row justify-between items-center gap-6 shadow-2xl backdrop-blur-sm">
          <div>
            <h1 className="text-4xl font-black text-amber-500 mb-1">ניהול המערכת</h1>
            <p className="text-slate-500 text-sm font-bold">שמירה אוטומטית פעילה. שמירה אחרונה: {new Date().toLocaleTimeString('he-IL')}</p>
          </div>
          
          <div className="flex flex-wrap gap-3 justify-center">
            <button onClick={() => setShowJsonView(true)} className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-3 rounded-2xl font-bold transition-all">
              תצוגת JSON
            </button>
            <button onClick={publishToCloud} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-2xl font-black shadow-lg shadow-emerald-900/20 transition-all flex items-center gap-2">
              🚀 פרסם לאתר
            </button>
            <button onClick={() => { setEditingScript({ name: '', isPublished: true, isDownloadable: true, isTrialDownloadable: true, price: '₪550', id: Date.now().toString() }); setShowAddForm(true); }} className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-6 py-3 rounded-2xl font-black shadow-lg shadow-amber-900/20 transition-all">
              + הוסף סקריפט
            </button>
            <button onClick={handleLogout} className="bg-red-900/20 hover:bg-red-900/40 text-red-400 px-6 py-3 rounded-2xl font-bold transition-all border border-red-900/50">התנתק</button>
          </div>
        </div>

        {/* רשימת כרטיסי סקריפטים */}
        <div className="grid gap-6">
          {scripts.map((s) => (
            <div key={s.id} className="group bg-slate-900/40 border border-slate-800 hover:border-amber-500/30 p-8 rounded-[2rem] flex flex-col md:flex-row justify-between items-center transition-all duration-300 shadow-xl">
              <div className="flex items-center gap-6 mb-4 md:mb-0">
                <button onClick={() => { if(window.confirm('למחוק?')) setScripts(scripts.filter(item => item.id !== s.id)) }} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all">
                    🗑️
                </button>
                <h3 className="text-2xl font-black text-white group-hover:text-amber-500 transition-colors">{s.name}</h3>
              </div>
              <button onClick={() => { setEditingScript(s); setShowAddForm(true); }} className="bg-slate-800/80 hover:bg-amber-500 hover:text-slate-950 px-10 py-3 rounded-2xl font-black text-amber-500 transition-all border border-slate-700">
                ערוך סקריפט
              </button>
            </div>
          ))}
        </div>

        {/* חלונית עריכה / הוספה */}
        {showAddForm && editingScript && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md">
            <div className="bg-[#0f172a] border-2 border-amber-500/20 w-full max-w-2xl rounded-[3rem] p-10 shadow-2xl relative">
              <button onClick={() => setShowAddForm(false)} className="absolute top-8 left-8 text-slate-500 hover:text-white text-2xl">✕</button>
              <h2 className="text-3xl font-black mb-8 text-amber-500 border-b border-slate-800 pb-4">הגדרות סקריפט</h2>
              <div className="space-y-6">
                <input value={editingScript.name} onChange={(e) => setEditingScript({...editingScript, name: e.target.value})} className="w-full bg-slate-950 border border-slate-800 p-5 rounded-2xl text-white font-bold outline-none focus:border-amber-500" placeholder="שם הסקריפט" />
                <input value={editingScript.price} onChange={(e) => setEditingScript({...editingScript, price: e.target.value})} className="w-full bg-slate-950 border border-slate-800 p-5 rounded-2xl text-white font-bold text-left outline-none focus:border-amber-500" placeholder="Price (e.g. ₪550)" />
                
                <div className="flex gap-4">
                  <button onClick={() => {
                    const exists = scripts.find(i => i.id === editingScript.id);
                    if (exists) setScripts(scripts.map(i => i.id === editingScript.id ? editingScript : i));
                    else setScripts([...scripts, editingScript]);
                    setShowAddForm(false);
                  }} className="flex-1 py-5 bg-amber-600 text-white font-black rounded-2xl text-lg hover:bg-amber-500 transition-all">שמור שינויים</button>
                  <button onClick={() => setShowAddForm(false)} className="px-10 py-5 bg-slate-800 text-white font-bold rounded-2xl hover:bg-slate-700 transition-all">ביטול</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* חלונית JSON מתוקנת עם כפתור סגירה */}
        {showJsonView && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md">
            <div className="bg-slate-900 border border-slate-800 w-full max-w-4xl h-[85vh] rounded-[2rem] p-8 flex flex-col shadow-2xl relative">
              
              <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
                <h2 className="text-2xl font-black text-amber-500">תצוגת קוד המערכת (JSON)</h2>
                <div className="flex gap-4">
                   <button onClick={clearBrowserCache} className="bg-slate-800 text-slate-400 px-4 py-2 rounded-xl text-xs font-bold hover:bg-red-900/20 hover:text-red-400 transition-all">
                     אפס זיכרון דפדפן
                   </button>
                   <button onClick={() => setShowJsonView(false)} className="bg-red-500 hover:bg-red-400 text-white px-8 py-2 rounded-xl font-black shadow-lg transition-all">
                     סגור תצוגה ✕
                   </button>
                </div>
              </div>

              <textarea 
                readOnly 
                value={JSON.stringify(scripts, null, 2)} 
                className="flex-1 bg-black/50 border border-slate-800 rounded-xl p-6 text-emerald-400 font-mono text-sm outline-none resize-none shadow-inner"
              />
              
              <p className="text-slate-500 text-xs mt-4 text-center font-bold">
                שים לב: זוהי תצוגת קריאה בלבד. שינויים יש לבצע דרך כפתורי העריכה.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPortal;