
import React, { useState, useEffect } from 'react';
import { SCRIPTS } from '../constants';
import { ScriptData, FAQItem, ScriptFeature, Lead } from '../types';

interface AdminProps {
  onDataUpdate?: (scripts: ScriptData[]) => void;
}

const Admin: React.FC<AdminProps> = ({ onDataUpdate }) => {
  const [scripts, setScripts] = useState<ScriptData[]>(() => {
    const saved = localStorage.getItem('yosef_scripts_data');
    return saved ? JSON.parse(saved) : SCRIPTS;
  });
  
  const [leads, setLeads] = useState<Lead[]>(() => {
    const savedLeads = localStorage.getItem('yosef_leads');
    return savedLeads ? JSON.parse(savedLeads) : [];
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [showLeads, setShowLeads] = useState(false);
  const [lastSaved, setLastSaved] = useState<string>('');
  const [leadSearch, setLeadSearch] = useState('');

  useEffect(() => {
    localStorage.setItem('yosef_scripts_data', JSON.stringify(scripts));
    if (onDataUpdate) onDataUpdate(scripts);
    const now = new Date();
    setLastSaved(now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  }, [scripts, onDataUpdate]);

  const filteredLeads = leads.filter(lead => 
    lead.name.toLowerCase().includes(leadSearch.toLowerCase()) ||
    lead.email.toLowerCase().includes(leadSearch.toLowerCase()) ||
    lead.scriptName.toLowerCase().includes(leadSearch.toLowerCase())
  );

  const clearLeads = () => {
    if (window.confirm('האם אתה בטוח שברצונך למחוק את כל הלידים?')) {
      setLeads([]);
      localStorage.setItem('yosef_leads', JSON.stringify([]));
    }
  };

  const exportLeadsToCSV = () => {
    if (leads.length === 0) return;
    const headers = ['תאריך', 'שם', 'אימייל', 'סקריפט'];
    const rows = leads.map(l => [
      new Date(l.timestamp).toLocaleString('he-IL'),
      l.name,
      l.email,
      l.scriptName
    ]);
    const csvContent = "\ufeff" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `leads_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyConstantsToClipboard = () => {
    const code = `import { ScriptData, FAQItem } from './types';

export const SCRIPTS: ScriptData[] = ${JSON.stringify(scripts, null, 2)};

export const FAQ: FAQItem[] = [
  { question: 'לכמה זמן פתוחה גרסת הניסיון?', answer: 'גרסת הניסיון פתוחה לשימוש מלא למשך 24 שעות מרגע ההפעלה הראשונה במחשב.' }
];`;
    navigator.clipboard.writeText(code);
    alert('הקוד המלא עבור קובץ ה-constants.tsx הועתק! שלח אותו ליועץ ה-AI שלך כדי לעדכן את האתר לצמיתות.');
  };

  const manualSave = () => {
    localStorage.setItem('yosef_scripts_data', JSON.stringify(scripts));
    alert('השינויים נשמרו בהצלחה בדפדפן!');
  };

  const addScript = () => {
    const newId = `script-${Date.now()}`;
    const newScript: ScriptData = {
      id: newId,
      name: "סקריפט חדש",
      shortDesc: "תיאור קצר המופיע בכרטיס",
      fullDesc: "תיאור מפורט לעמוד המוצר",
      features: [{ title: "יכולת חדשה", description: "תיאור יכולת" }],
      steps: ["שלב 1 בהתקנה"],
      videoUrl: "",
      price: "₪0",
      color: "blue",
      faqs: [],
      downloadUrl: "",
      trialDownloadUrl: ""
    };
    setScripts([...scripts, newScript]);
    setEditingId(newId);
  };

  const updateScriptField = (id: string, field: keyof ScriptData, value: any) => {
    setScripts(scripts.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const deleteScript = (id: string) => {
    setScripts(scripts.filter(s => s.id !== id));
    setConfirmDeleteId(null);
  };

  return (
    <div className="animate-fadeIn pb-24 max-w-5xl mx-auto text-right" dir="rtl">
      {/* HEADER CONTROL BAR */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-10 bg-slate-900/90 p-8 rounded-[2rem] border border-slate-800 shadow-2xl gap-6 sticky top-4 z-[60] backdrop-blur-md">
        <div>
           <h1 className="text-3xl font-black text-amber-500 mb-1">ניהול המערכת</h1>
           <p className="text-xs text-slate-500 italic">שמירה אוטומטית פעילה. שמירה אחרונה: {lastSaved}</p>
        </div>
        
        <div className="flex flex-wrap gap-3">
           <button onClick={() => setShowLeads(!showLeads)} className={`px-5 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 text-sm ${showLeads ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-emerald-500 border border-emerald-500/20'}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197" /></svg>
              {showLeads ? 'חזור לעריכה' : `לידים (${leads.length})`}
           </button>
           {!showLeads && (
             <>
               <button onClick={addScript} className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold shadow-lg text-sm flex items-center gap-2">
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                 הוסף סקריפט
               </button>
               <button onClick={copyConstantsToClipboard} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-sm shadow-lg flex items-center gap-2">
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                 העתק קוד לעדכון קבוע
               </button>
               <button onClick={() => setShowCode(!showCode)} className="px-5 py-2.5 bg-slate-800 text-slate-300 rounded-xl font-bold text-sm border border-slate-700">
                 {showCode ? 'חזור לעריכה' : 'תצוגת JSON'}
               </button>
             </>
           )}
        </div>
      </div>

      {showLeads ? (
        <div className="animate-fadeIn space-y-6">
           <div className="flex justify-between items-center bg-slate-900/50 p-6 rounded-3xl border border-slate-800">
              <h2 className="text-2xl font-bold text-white">רשימת לידים והורדות ניסיון</h2>
              <div className="flex gap-2">
                 <button onClick={exportLeadsToCSV} className="text-xs bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold">ייצא ל-Excel</button>
                 <button onClick={clearLeads} className="text-xs bg-red-600/10 text-red-500 px-4 py-2 rounded-lg font-bold">מחק הכל</button>
              </div>
           </div>
           
           <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden">
              <div className="p-4 border-b border-slate-800">
                 <input 
                  type="text" 
                  value={leadSearch} 
                  onChange={e => setLeadSearch(e.target.value)}
                  placeholder="חפש לפי שם, מייל או מוצר..."
                  className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-white outline-none focus:border-amber-500"
                 />
              </div>
              <table className="w-full text-right text-sm">
                 <thead className="bg-slate-950 text-slate-500 font-bold">
                    <tr>
                       <th className="p-4">תאריך</th>
                       <th className="p-4">שם הלקוח</th>
                       <th className="p-4">כתובת אימייל</th>
                       <th className="p-4">המוצר שהורד</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-800">
                    {filteredLeads.map(l => (
                      <tr key={l.id} className="hover:bg-slate-800/30">
                        <td className="p-4 text-slate-500 font-mono text-xs">{new Date(l.timestamp).toLocaleString('he-IL')}</td>
                        <td className="p-4 text-white font-bold">{l.name}</td>
                        <td className="p-4 text-amber-500">{l.email}</td>
                        <td className="p-4 text-slate-400">{l.scriptName}</td>
                      </tr>
                    ))}
                    {filteredLeads.length === 0 && (
                      <tr><td colSpan={4} className="p-10 text-center text-slate-600 italic">לא נמצאו לידים התואמים לחיפוש.</td></tr>
                    )}
                 </tbody>
              </table>
           </div>
        </div>
      ) : showCode ? (
        <div className="animate-fadeIn">
           <textarea readOnly className="w-full h-[600px] bg-black text-emerald-400 font-mono text-[11px] p-8 rounded-3xl border border-slate-800 focus:outline-none" value={JSON.stringify(scripts, null, 2)} />
        </div>
      ) : (
        <div className="space-y-10">
          {scripts.map(script => (
            <div key={script.id} className={`bg-slate-900/40 border-2 rounded-[3rem] transition-all overflow-hidden ${editingId === script.id ? 'border-amber-500 shadow-2xl bg-slate-900' : 'border-slate-800'}`}>
              <div className="p-8 flex justify-between items-center bg-slate-900/20">
                <h2 className="text-2xl font-black text-white">{script.name}</h2>
                <div className="flex gap-3">
                   <button onClick={() => setEditingId(editingId === script.id ? null : script.id)} className={`px-6 py-3 rounded-2xl font-bold transition-all border ${editingId === script.id ? 'bg-amber-500 text-slate-900 border-amber-400' : 'bg-slate-800 text-amber-500 border-slate-700 hover:bg-slate-700'}`}>
                     {editingId === script.id ? 'סגור עריכה' : 'ערוך סקריפט'}
                   </button>
                   <button onClick={() => setConfirmDeleteId(script.id)} className="p-3 text-red-500 hover:bg-red-500 hover:text-white rounded-2xl transition-all border border-red-500/20">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                   </button>
                </div>
              </div>

              {editingId === script.id && (
                <div className="p-10 space-y-8 animate-fadeIn">
                  {/* Basic Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div className="space-y-6">
                        <label className="block">
                           <span className="text-xs font-bold text-slate-500 mb-2 block mr-1 uppercase tracking-widest">שם הסקריפט</span>
                           <input type="text" value={script.name} onChange={e => updateScriptField(script.id, 'name', e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-white font-bold text-lg" />
                        </label>
                        <div className="grid grid-cols-2 gap-4">
                           <label className="block">
                              <span className="text-xs font-bold text-amber-500 mb-2 block mr-1">מחיר נוכחי</span>
                              <input type="text" value={script.price} onChange={e => updateScriptField(script.id, 'price', e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-amber-500 font-black" />
                           </label>
                           <label className="block">
                              <span className="text-xs font-bold text-slate-500 mb-2 block mr-1">מחיר מקורי (למבצע)</span>
                              <input type="text" value={script.originalPrice || ''} onChange={e => updateScriptField(script.id, 'originalPrice', e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-slate-400" placeholder="₪000" />
                           </label>
                        </div>
                        <label className="block">
                           <span className="text-xs font-bold text-indigo-400 mb-2 block mr-1">לינק הורדה (קובץ מלא)</span>
                           <input type="text" value={script.downloadUrl || ''} onChange={e => updateScriptField(script.id, 'downloadUrl', e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-indigo-300 font-mono text-xs" dir="ltr" placeholder="Dropbox/Drive Link" />
                        </label>
                        <label className="block">
                           <span className="text-xs font-bold text-indigo-400 mb-2 block mr-1">לינק הורדה (גרסת ניסיון)</span>
                           <input type="text" value={script.trialDownloadUrl || ''} onChange={e => updateScriptField(script.id, 'trialDownloadUrl', e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-indigo-300 font-mono text-xs" dir="ltr" placeholder="Trial Link" />
                        </label>
                     </div>
                     
                     <div className="space-y-6">
                        <label className="block">
                           <span className="text-xs font-bold text-slate-500 mb-2 block mr-1">YouTube Video URL</span>
                           <input type="text" value={script.videoUrl || ''} onChange={e => updateScriptField(script.id, 'videoUrl', e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-white font-mono" placeholder="https://www.youtube.com/watch?v=xxxx" />
                        </label>
                        <label className="block">
                           <span className="text-xs font-bold text-slate-500 mb-2 block mr-1 italic">צבע ערכת נושא (blue / emerald / purple)</span>
                           <input type="text" value={script.color} onChange={e => updateScriptField(script.id, 'color', e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-white font-bold" />
                        </label>
                        <label className="block">
                           <span className="text-xs font-bold text-slate-500 mb-2 block mr-1">תיאור קצר (בקטלוג)</span>
                           <textarea value={script.shortDesc} onChange={e => updateScriptField(script.id, 'shortDesc', e.target.value)} className="w-full h-32 bg-slate-950 border border-slate-800 p-4 rounded-2xl text-white text-sm" />
                        </label>
                     </div>
                  </div>

                  {/* Detailed Description */}
                  <label className="block">
                     <span className="text-xs font-bold text-slate-500 mb-2 block mr-1">תיאור מלא ומפורט (עמוד מוצר)</span>
                     <textarea value={script.fullDesc} onChange={e => updateScriptField(script.id, 'fullDesc', e.target.value)} className="w-full h-48 bg-slate-950 border border-slate-800 p-6 rounded-3xl text-white leading-relaxed" />
                  </label>

                  {/* Features & FAQs Section Toggle (simplified) */}
                  <div className="border-t border-slate-800 pt-8 mt-8">
                     <h3 className="text-lg font-bold text-white mb-6">ניהול שאלות ותשובות (FAQs)</h3>
                     <div className="space-y-4">
                        {(script.faqs || []).map((faq, idx) => (
                          <div key={idx} className="bg-slate-950 p-6 rounded-3xl border border-slate-800 group relative">
                             <button onClick={() => updateScriptField(script.id, 'faqs', script.faqs?.filter((_, i) => i !== idx))} className="absolute top-4 left-4 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity font-bold text-xs">מחק שאלה</button>
                             <input value={faq.question} onChange={e => {
                               const newFaqs = [...(script.faqs || [])];
                               newFaqs[idx].question = e.target.value;
                               updateScriptField(script.id, 'faqs', newFaqs);
                             }} className="w-full bg-transparent font-bold text-white mb-3 outline-none border-b border-slate-900 pb-2" placeholder="שאלה..." />
                             <textarea value={faq.answer} onChange={e => {
                               const newFaqs = [...(script.faqs || [])];
                               newFaqs[idx].answer = e.target.value;
                               updateScriptField(script.id, 'faqs', newFaqs);
                             }} className="w-full bg-transparent text-sm text-slate-400 outline-none h-20" placeholder="תשובה..." />
                          </div>
                        ))}
                        <button onClick={() => updateScriptField(script.id, 'faqs', [...(script.faqs || []), { question: '', answer: '' }])} className="w-full py-4 border-2 border-dashed border-slate-800 rounded-2xl text-slate-500 font-bold hover:border-amber-500/50 hover:text-amber-500 transition-all">
                           + הוסף שאלה חדשה לסקריפט
                        </button>
                     </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
           <div className="bg-slate-900 border border-red-500/30 p-10 rounded-[2.5rem] max-w-sm text-center shadow-2xl">
              <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                 <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">מחיקת סקריפט</h3>
              <p className="text-slate-400 mb-8">פעולה זו תמחק לצמיתות את הסקריפט מהמערכת. בטוח?</p>
              <div className="flex gap-4">
                 <button onClick={() => deleteScript(confirmDeleteId)} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl shadow-lg">מחק כעת</button>
                 <button onClick={() => setConfirmDeleteId(null)} className="flex-1 py-3 bg-slate-800 text-white font-bold rounded-xl">ביטול</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
