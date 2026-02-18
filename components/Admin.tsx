import React, { useState } from 'react';
import { SCRIPTS as initialScripts } from '../constants';

const AdminPortal: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [scripts, setScripts] = useState(initialScripts);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // השורה המעודכנת: מעכשיו כל סקריפט חדש נוצר כשהוא "דלוק" (true) בהכל
  const [editingScript, setEditingScript] = useState<any>({ 
    name: '', 
    isPublished: true, 
    isDownloadable: true, 
    isTrialDownloadable: true 
  });

  const SECRET_PASSWORD = "1234"; 

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === SECRET_PASSWORD) setIsAuthenticated(true);
    else alert("סיסמה שגויה!");
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 text-right" dir="rtl">
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl text-white text-center">
          <h1 className="text-2xl font-black mb-6">כניסת מנהל</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-center text-white" placeholder="הזן סיסמה" />
            <button type="submit" className="w-full py-4 bg-amber-600 text-white font-black rounded-2xl shadow-xl">התחבר</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] p-6 md:p-12 text-right text-white" dir="rtl">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-12">
           <button onClick={() => setIsAuthenticated(false)} className="text-slate-500 hover:text-white text-sm">התנתק</button>
           <h1 className="text-3xl font-black text-amber-500 italic">ADMIN PANEL</h1>
           <button 
              onClick={() => { 
                // איפוס לערכי ברירת מחדל "דלוקים" בעת הוספת סקריפט חדש
                setEditingScript({ name: '', isPublished: true, isDownloadable: true, isTrialDownloadable: true, price: '₪550' }); 
                setShowAddForm(true); 
              }}
              className="bg-amber-500 text-slate-900 px-8 py-3 rounded-2xl font-black hover:bg-amber-400 shadow-lg shadow-amber-500/20"
           >
             + הוסף סקריפט חדש
           </button>
        </div>

        {/* רשימת הסקריפטים עם חיווי מצב */}
        <div className="space-y-4 mb-12">
          {scripts.map(s => (
            <div key={s.id} className="bg-slate-900 border border-slate-800 p-6 rounded-3xl flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className={`w-3 h-3 rounded-full ${s.isPublished ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-red-500'}`}></div>
                <h3 className="font-black text-xl">{s.name}</h3>
              </div>
              <button onClick={() => { setEditingScript(s); setShowAddForm(true); }} className="bg-slate-800 border border-slate-700 px-6 py-2 rounded-xl font-bold text-amber-500">ערוך</button>
            </div>
          ))}
        </div>

        {showAddForm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
            <div className="bg-[#0f172a] border-2 border-amber-500/30 w-full max-w-4xl rounded-[2.5rem] p-8 md:p-10 my-10 shadow-2xl relative">
              <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-6">
                <h2 className="text-3xl font-black text-white">הגדרות סקריפט</h2>
                <button onClick={() => setShowAddForm(false)} className="bg-amber-500 text-slate-900 px-6 py-2 rounded-xl font-black">סגור</button>
              </div>

              <div className="space-y-8">
                {/* שלושת כפתורי הסטטוס - דלוקים אוטומטית ביצירה חדשה */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className={`p-5 rounded-3xl border-2 transition-all ${editingScript.isPublished ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-800/50 border-slate-700'}`}>
                    <p className="text-xs font-bold text-slate-500 mb-3 text-center uppercase">פרסום באתר</p>
                    <button onClick={() => setEditingScript({...editingScript, isPublished: !editingScript.isPublished})} className={`w-full py-3 rounded-xl font-black text-sm ${editingScript.isPublished ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
                      {editingScript.isPublished ? '✓ מפורסם' : '🔒 מוסתר'}
                    </button>
                  </div>

                  <div className={`p-5 rounded-3xl border-2 transition-all ${editingScript.isDownloadable ? 'bg-blue-500/10 border-blue-500/30' : 'bg-slate-800/50 border-slate-700'}`}>
                    <p className="text-xs font-bold text-slate-500 mb-3 text-center uppercase">כפתור רכישה</p>
                    <button onClick={() => setEditingScript({...editingScript, isDownloadable: !editingScript.isDownloadable})} className={`w-full py-3 rounded-xl font-black text-sm ${editingScript.isDownloadable ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
                      {editingScript.isDownloadable ? '✓ פעיל' : '🔒 כבוי'}
                    </button>
                  </div>

                  <div className={`p-5 rounded-3xl border-2 transition-all ${editingScript.isTrialDownloadable ? 'bg-purple-500/10 border-purple-500/30' : 'bg-slate-800/50 border-slate-700'}`}>
                    <p className="text-xs font-bold text-slate-500 mb-3 text-center uppercase">גרסת ניסיון</p>
                    <button onClick={() => setEditingScript({...editingScript, isTrialDownloadable: !editingScript.isTrialDownloadable})} className={`w-full py-3 rounded-xl font-black text-sm ${editingScript.isTrialDownloadable ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
                      {editingScript.isTrialDownloadable ? '✓ פעיל' : '🔒 כבוי'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 mr-2 uppercase">שם הסקריפט</label>
                    <input value={editingScript.name} onChange={(e) => setEditingScript({...editingScript, name: e.target.value})} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-white outline-none focus:border-amber-500" placeholder="למשל: אשף השוליים" />
                  </div>
                  <div className="space-y-2 text-left">
                    <label className="text-xs font-bold text-slate-500 mr-2 uppercase">Price (₪)</label>
                    <input value={editingScript.price} onChange={(e) => setEditingScript({...editingScript, price: e.target.value})} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-white text-left" placeholder="₪550" />
                  </div>
                </div>

                <button 
                  onClick={() => {
                    alert("השינויים נשמרו! זכור לעדכן את קובץ constants.tsx לשמירה קבועה.");
                    setShowAddForm(false);
                  }}
                  className="w-full py-6 bg-amber-600 hover:bg-amber-500 text-white font-black rounded-3xl text-xl shadow-2xl transition-all"
                >
                  עדכן ופרסם עכשיו
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPortal;