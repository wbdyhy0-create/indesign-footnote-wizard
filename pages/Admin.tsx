import React, { useState, useEffect } from 'react';
import { SCRIPTS as initialScripts } from '../constants';

const AdminPortal: React.FC = () => {
  // טעינת סקריפטים מהזיכרון המקומי (כדי שלא יימחקו ברענון) או מברירת המחדל
  const [scripts, setScripts] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('yosef_admin_backup');
      if (saved) return JSON.parse(saved);
    }
    return initialScripts;
  });
  
  const [editingScript, setEditingScript] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'scripts' | 'leads' | 'json'>('scripts');

  // שמירה אוטומטית לזיכרון הדפדפן בכל פעם שיש שינוי
  useEffect(() => {
    localStorage.setItem('yosef_admin_backup', JSON.stringify(scripts));
  }, [scripts]);

  // נתונים וירטואליים ללידים (עד שתחבר מסד נתונים)
  const [leads] = useState([
    { id: 1, email: 'user1@example.com', date: '2026-02-23', script: 'אשף הערות שוליים' },
    { id: 2, email: 'user2@gmail.com', date: '2026-02-22', script: 'מעבד העימוד 2026' },
  ]);

  // מנגנון התיקון האוטומטי ליוטיוב
  const formatYouTubeUrl = (url: string) => {
    if (!url) return '';
    if (url.includes('embed')) return url;
    const videoId = url.split('v=')[1]?.split('&')[0] || url.split('/').pop();
    return `https://www.youtube.com/embed/${videoId}`;
  };

  const downloadLeadsCSV = () => {
    const headers = "ID,Email,Date,Script\n";
    const rows = leads.map(l => `${l.id},${l.email},${l.date},${l.script}`).join("\n");
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", "leads_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyCode = () => {
    const prepared = scripts.map(s => ({ ...s, videoUrl: formatYouTubeUrl(s.videoUrl) }));
    navigator.clipboard.writeText(JSON.stringify(prepared, null, 2));
    alert("✅ הקוד הועתק בהצלחה!\n(כל קישורי היוטיוב תוקנו אוטומטית לפורמט הנדרש)");
  };

  return (
    <div className="min-h-screen bg-[#060b14] p-6 md:p-12 text-right text-white font-sans" dir="rtl">
      <div className="max-w-6xl mx-auto">
        
        {/* סרגל עליון בדיוק כמו בתמונות המקוריות */}
        <div className="bg-[#0b1121] border border-slate-800 rounded-3xl p-6 md:p-8 mb-8 flex flex-col md:flex-row-reverse justify-between items-center gap-6 shadow-xl">
          <div className="text-center md:text-right">
            <h1 className="text-3xl font-black text-[#f59e0b] tracking-wide">ניהול המערכת</h1>
            <p className="text-slate-500 text-xs font-bold mt-1">שמירה אוטומטית פעילה. שמירה אחרונה: {new Date().toLocaleTimeString('he-IL')}</p>
          </div>

          <div className="flex flex-wrap justify-center gap-3 items-center">
            <button className="bg-slate-800/50 text-slate-400 px-5 py-2.5 rounded-xl font-bold border border-slate-700/50 text-sm hover:bg-slate-800 transition">התנתק</button>
            <button onClick={() => { setEditingScript(null); setViewMode('leads'); }} className="bg-[#064e3b]/30 text-[#10b981] border border-[#10b981]/20 px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-[#064e3b]/50 transition">👤 לידים ({leads.length})</button>
            <button onClick={() => { setViewMode('scripts'); setEditingScript({ id: Date.now().toString(), name: '', price: '₪250', originalPrice: '₪450', videoUrl: '', downloadUrl: '', trialDownloadUrl: '', description: '', shortDesc: '', color: 'blue', isPublished: true }); }} className="bg-[#f59e0b] hover:bg-[#d97706] text-slate-950 px-6 py-2.5 rounded-xl font-black shadow-lg transition">+ הוסף סקריפט</button>
            <button onClick={handleCopyCode} className="bg-[#5c5cfc] hover:bg-[#4a4af0] text-white px-6 py-2.5 rounded-xl font-black shadow-lg transition flex items-center gap-2">📋 העתק קוד לעדכון קבוע</button>
            <button onClick={() => { setEditingScript(null); setViewMode('json'); }} className="bg-slate-800/50 text-slate-300 px-5 py-2.5 rounded-xl font-bold border border-slate-700 text-sm hover:bg-slate-700 transition">תצוגת JSON</button>
          </div>
        </div>

        {/* --- אזור התוכן המשתנה --- */}

        {editingScript ? (
          // שחזור מדויק של חלונית העריכה (ללא חלון קופץ!) לפי תמונה e36a82
          <div className="bg-[#0b1121] border border-[#f59e0b] rounded-[2.5rem] p-8 md:p-12 shadow-2xl relative animate-in fade-in zoom-in-95 duration-300">
            
            <div className="flex justify-between items-center mb-10 pb-6 border-b border-slate-800">
              <div className="flex gap-4">
                <button onClick={() => setScripts(scripts.filter(i => i.id !== editingScript.id))} className="w-12 h-12 flex items-center justify-center border border-red-500/30 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition">🗑️</button>
                <button onClick={() => setEditingScript(null)} className="bg-[#f59e0b] text-slate-950 px-8 py-2 rounded-xl font-black hover:bg-[#d97706] transition">סגור עריכה</button>
              </div>
              <h2 className="text-3xl font-black text-white">{editingScript.name || 'סקריפט חדש'}</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8 max-h-[50vh] overflow-y-auto px-2 custom-scrollbar">
              {/* טור ימין */}
              <div className="space-y-6">
                <div>
                  <label className="block text-slate-500 text-sm font-bold mb-2">שם הסקריפט</label>
                  <input value={editingScript.name} onChange={(e) => setEditingScript({...editingScript, name: e.target.value})} className="w-full bg-[#060b14] border border-slate-800 p-4 rounded-2xl text-white font-black outline-none focus:border-[#f59e0b] transition" />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[#f59e0b] text-sm font-bold mb-2">מחיר נוכחי</label>
                    <input value={editingScript.price} onChange={(e) => setEditingScript({...editingScript, price: e.target.value})} className="w-full bg-[#060b14] border border-slate-800 p-4 rounded-2xl text-white font-black text-left outline-none focus:border-[#f59e0b]" />
                  </div>
                  <div>
                    <label className="block text-slate-500 text-sm font-bold mb-2">מחיר מקורי (למבצע)</label>
                    <input value={editingScript.originalPrice} onChange={(e) => setEditingScript({...editingScript, originalPrice: e.target.value})} className="w-full bg-[#060b14] border border-slate-800 p-4 rounded-2xl text-slate-400 text-left outline-none focus:border-[#f59e0b]" />
                  </div>
                </div>
                <div>
                  <label className="block text-[#5c5cfc] text-sm font-bold mb-2">לינק הורדה (קובץ מלא)</label>
                  <input value={editingScript.downloadUrl} onChange={(e) => setEditingScript({...editingScript, downloadUrl: e.target.value})} className="w-full bg-[#060b14] border border-slate-800 p-4 rounded-2xl text-slate-300 font-mono text-sm text-left outline-none focus:border-[#5c5cfc]" />
                </div>
                <div>
                  <label className="block text-[#5c5cfc] text-sm font-bold mb-2">לינק הורדה (גרסת ניסיון)</label>
                  <input value={editingScript.trialDownloadUrl} onChange={(e) => setEditingScript({...editingScript, trialDownloadUrl: e.target.value})} className="w-full bg-[#060b14] border border-slate-800 p-4 rounded-2xl text-slate-300 font-mono text-sm text-left outline-none focus:border-[#5c5cfc]" />
                </div>
              </div>

              {/* טור שמאל */}
              <div className="space-y-6">
                <div>
                  <label className="block text-slate-500 text-sm font-bold mb-2">YouTube Video URL</label>
                  <input value={editingScript.videoUrl} onChange={(e) => setEditingScript({...editingScript, videoUrl: e.target.value})} className="w-full bg-[#060b14] border border-slate-800 p-4 rounded-2xl text-slate-300 font-mono text-sm text-left outline-none focus:border-red-500" />
                </div>
                <div>
                  <label className="block text-slate-500 text-sm font-bold mb-2">צבע ערכת נושא (blue / emerald / purple)</label>
                  <input value={editingScript.color} onChange={(e) => setEditingScript({...editingScript, color: e.target.value})} className="w-full bg-[#060b14] border border-slate-800 p-4 rounded-2xl text-white font-bold text-center outline-none focus:border-[#f59e0b]" />
                </div>
                <div>
                  <label className="block text-slate-500 text-sm font-bold mb-2">תיאור קצר (בקטלוג)</label>
                  <textarea value={editingScript.shortDesc} onChange={(e) => setEditingScript({...editingScript, shortDesc: e.target.value})} className="w-full bg-[#060b14] border border-slate-800 p-4 rounded-2xl text-white text-sm h-[6.5rem] outline-none focus:border-[#f59e0b]" />
                </div>
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-slate-500 text-sm font-bold mb-2">תיאור מלא ומפורט (עמוד מוצר)</label>
                <textarea value={editingScript.description} onChange={(e) => setEditingScript({...editingScript, description: e.target.value})} className="w-full bg-[#060b14] border border-slate-800 p-4 rounded-2xl text-white text-sm h-32 outline-none focus:border-[#f59e0b]" />
              </div>
            </div>

            {/* --- הוספתי את כפתור השמירה כאן! --- */}
            <div className="mt-8 pt-6 border-t border-slate-800">
              <button 
                onClick={() => {
                  const exists = scripts.find(i => i.id === editingScript.id);
                  if (exists) {
                    setScripts(scripts.map(i => i.id === editingScript.id ? editingScript : i));
                  } else {
                    setScripts([...scripts, editingScript]);
                  }
                  setEditingScript(null);
                }}
                className="w-full py-5 bg-[#f59e0b] text-slate-950 font-black rounded-2xl text-xl shadow-xl hover:bg-[#d97706] transition-all"
              >
                שמור סקריפט במערכת
              </button>
            </div>

          </div>

        ) : viewMode === 'leads' ? (
          
          // חלונית לידים מופעלת
          <div className="bg-[#0b1121] border border-slate-800 rounded-[2.5rem] p-8 md:p-12 shadow-xl animate-in fade-in duration-300">
            <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-4">
              <h2 className="text-3xl font-black text-emerald-500">פירוט לידים מהאתר</h2>
              <button onClick={downloadLeadsCSV} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold transition shadow-lg flex items-center gap-2">⬇️ הורד קובץ CSV</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-800 text-lg">
                    <th className="pb-4 px-4 font-bold">אימייל</th>
                    <th className="pb-4 px-4 font-bold">תאריך הרשמה</th>
                    <th className="pb-4 px-4 font-bold">התעניינות במוצר</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map(l => (
                    <tr key={l.id} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition">
                      <td className="py-6 px-4 font-mono text-indigo-400 font-bold">{l.email}</td>
                      <td className="py-6 px-4 text-slate-300">{l.date}</td>
                      <td className="py-6 px-4 text-slate-300 font-bold">{l.script}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        ) : viewMode === 'json' ? (
          
          // חלונית JSON
          <div className="bg-[#0b1121] border border-slate-800 rounded-[2.5rem] p-8 shadow-xl animate-in fade-in duration-300">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black text-indigo-400">קוד המערכת המלא (JSON)</h2>
              <button onClick={() => { localStorage.removeItem('yosef_admin_backup'); alert('הזיכרון אופס בהצלחה!'); }} className="text-sm text-red-500 hover:underline">אפס זיכרון דפדפן</button>
            </div>
            <pre className="bg-[#060b14] border border-slate-800 p-6 rounded-2xl overflow-x-auto text-left font-mono text-xs text-emerald-400 h-[60vh] scrollbar-thin">
              {JSON.stringify(scripts, null, 2)}
            </pre>
          </div>

        ) : (

          // תצוגת הרשימה הרגילה (כאשר לא עורכים כלום)
          <div className="grid gap-6 animate-in fade-in duration-300">
            {scripts.map((s) => (
              <div key={s.id} className="bg-[#0b1121] border border-slate-800 p-8 rounded-[2.5rem] flex flex-col md:flex-row justify-between items-center shadow-lg hover:border-slate-700 transition">
                <div className="flex items-center gap-6 mb-4 md:mb-0">
                  <button onClick={() => setScripts(scripts.filter(i => i.id !== s.id))} className="text-red-500 hover:scale-110 transition-transform bg-red-500/10 p-3 rounded-xl">🗑️</button>
                  <h3 className="text-2xl font-black text-white">{s.name}</h3>
                </div>
                <button onClick={() => setEditingScript(s)} className="bg-slate-800 hover:bg-[#f59e0b] hover:text-slate-950 px-10 py-3 rounded-2xl font-black text-[#f59e0b] transition-all border border-slate-700 w-full md:w-auto">ערוך סקריפט</button>
              </div>
            ))}
          </div>
          
        )}
      </div>
    </div>
  );
};

export default AdminPortal;