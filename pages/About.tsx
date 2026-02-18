
import React from 'react';

const About: React.FC = () => {
  return (
    <div className="animate-fadeIn max-w-3xl mx-auto">
      <h1 className="text-4xl font-bold mb-8 text-amber-500">אודות המפתח</h1>
      
      <div className="flex flex-col md:flex-row gap-10 items-center mb-12">
        <div className="w-48 h-48 rounded-3xl overflow-hidden bg-slate-800 flex-shrink-0 shadow-2xl border-4 border-slate-700">
           <img src="https://picsum.photos/seed/yosef/200/200" alt="Yosef Ovadia" className="w-full h-full object-cover" />
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-4">יוסף עובדיה</h2>
          <p className="text-slate-400 leading-relaxed mb-4">
            מעמד מקצועי ומפתח סקריפטים לאינדיזיין. 
            התשוקה שלי היא להפוך את תהליך העימוד המורכב לפשוט, מהיר ומדויק יותר באמצעות טכנולוגיה.
          </p>
          <div className="flex gap-4">
             <div className="px-3 py-1 bg-slate-800 rounded-full text-xs font-bold text-slate-300">InDesign SDK</div>
             <div className="px-3 py-1 bg-slate-800 rounded-full text-xs font-bold text-slate-300">JavaScript / ExtendScript</div>
             <div className="px-3 py-1 bg-slate-800 rounded-full text-xs font-bold text-slate-300">Torah Layout Specialist</div>
          </div>
        </div>
      </div>

      <div className="space-y-10">
        <section>
          <h3 className="text-2xl font-bold mb-4">חזון האוטומציה</h3>
          <p className="text-slate-300 leading-relaxed">
            העימוד התורני מציב אתגרים ייחודיים: הערות שוליים מרובות, מספור בגימטריה, תגיות מורכבות וטקסטים רגישים. 
            מטרת הכלים שאני מפתח היא לתת למעמד את השקט הנפשי שהעבודה הטכנית מבוצעת על ידי מכונה, בעוד שהוא יכול להתרכז באסתטיקה וביופי של הדף.
          </p>
        </section>

        <section className="p-8 bg-slate-900 rounded-3xl border border-slate-800">
           <h3 className="text-xl font-bold mb-4 text-amber-500">למה לבחור בכלים שלי?</h3>
           <ul className="space-y-4 text-slate-300">
             <li className="flex items-start gap-3">
               <span className="text-amber-500 font-bold">✓</span>
               <span>פיתוח כחול-לבן עם הבנה עמוקה של צרכי המעמד הישראלי/תורני.</span>
             </li>
             <li className="flex items-start gap-3">
               <span className="text-amber-500 font-bold">✓</span>
               <span>קוד אופטימלי שלא מכביד על אינדיזיין גם במסמכים של מאות עמודים.</span>
             </li>
             <li className="flex items-start gap-3">
               <span className="text-amber-500 font-bold">✓</span>
               <span>מענה אנושי ואישי לכל שאלה או צורך בהתאמה מיוחדת.</span>
             </li>
           </ul>
        </section>
      </div>
    </div>
  );
};

export default About;
