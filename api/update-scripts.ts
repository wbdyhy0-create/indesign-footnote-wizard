import { kv } from '@vercel/kv';

export default async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    try {
      const [scripts, products, covers] = await Promise.all([
        kv.get('scripts_data'),
        kv.get('products_data'),
        kv.get('covers_data'),
      ]);

      return res.status(200).json({
        success: true,
        scripts: Array.isArray(scripts) ? scripts : null,
        products: Array.isArray(products) ? products : null,
        covers: Array.isArray(covers) ? covers : null,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ success: false, error: 'שגיאה בטעינת הנתונים' });
    }
  }

  // שמירה לענן (תומך גם בפורמט הישן וגם בחדש)
  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      const scripts = Array.isArray(body) ? body : body.scripts;
      const products = Array.isArray(body.products) ? body.products : null;
      const covers = Array.isArray(body.covers) ? body.covers : null;

      if (!Array.isArray(scripts)) {
        return res.status(400).json({ success: false, error: 'פורמט סקריפטים לא תקין' });
      }

      const operations: Promise<any>[] = [kv.set('scripts_data', scripts)];
      if (products) operations.push(kv.set('products_data', products));
      if (covers) operations.push(kv.set('covers_data', covers));
      await Promise.all(operations);

      return res.status(200).json({ success: true, message: 'הנתונים נשמרו בענן בהצלחה!' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ success: false, error: 'שגיאה בשמירת הנתונים' });
    }
  } else {
    return res.status(405).json({ error: 'שיטה לא מורשית' });
  }
}