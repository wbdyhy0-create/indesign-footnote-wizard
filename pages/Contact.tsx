
import React from 'react';
import { FAQ } from '../constants';

const Contact: React.FC = () => {
  return (
    <div className="animate-fadeIn">
      <h1 className="text-4xl font-bold mb-10 text-amber-500 text-center">צור קשר</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-20">
        <div>
          <h2 className="text-2xl font-bold mb-6">דברו איתנו</h2>
          <p className="text-slate-400 mb-8 leading-relaxed">
            מעוניינים לרכוש סקריפט? צריכים עזרה טכנית? או אולי סקריפט מותאם אישית? 
            דרכי יצירת קשר ישירה יתווספו לכאן בקרוב. בינתיים, ניתן להיעזר במרכז המידע או בעוזר ה-AI שלנו.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-6">שאלות נפוצות</h2>
          <div className="space-y-4">
            {FAQ.map((item, i) => (
              <details key={i} className="group bg-slate-900/50 rounded-2xl border border-slate-800 p-4 transition-all">
                <summary className="list-none cursor-pointer flex justify-between items-center font-bold text-slate-200">
                  {item.question}
                  <svg className="w-5 h-5 text-amber-500 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </summary>
                <div className="mt-4 text-sm text-slate-400 leading-relaxed border-t border-slate-800 pt-4">
                  {item.answer}
                </div>
              </details>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contact;
