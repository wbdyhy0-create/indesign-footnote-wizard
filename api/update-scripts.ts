import { kv } from '@vercel/kv';

export default async function handler(req: any, res: any) {
  // אנחנו מוודאים שהבקשה היא מסוג "שמירה" (POST)
  if (req.method === 'POST') {
    try {
      const scripts = req.body;
      
      // שומרים את הנתונים בענן תחת השם 'scripts_data'
      await kv.set('scripts_data', scripts); 
      
      return res.status(200).json({ success: true, message: 'הנתונים נשמרו בענן בהצלחה!' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ success: false, error: 'שגיאה בשמירת הנתונים' });
    }
  } else {
    return res.status(405).json({ error: 'שיטה לא מורשית' });
  }
}