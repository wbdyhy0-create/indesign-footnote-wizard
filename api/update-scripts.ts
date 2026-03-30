import { kv } from '@vercel/kv';

const upsertById = (existing: any, incoming: any) => {
  const base = Array.isArray(existing) ? [...existing] : [];
  const next = Array.isArray(incoming) ? incoming : [];

  const indexById = new Map<string, number>();
  base.forEach((item, index) => {
    if (item && typeof item.id === 'string') {
      indexById.set(item.id, index);
    }
  });

  next.forEach((item) => {
    if (item && typeof item.id === 'string') {
      const existingIndex = indexById.get(item.id);
      if (existingIndex === undefined) {
        indexById.set(item.id, base.length);
        base.push(item);
      } else {
        base[existingIndex] = item;
      }
      return;
    }
    base.push(item);
  });

  return base;
};

export default async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    try {
      const [scripts, products, covers, promotions, videos, siteSettings] = await Promise.all([
        kv.get('scripts_data'),
        kv.get('products_data'),
        kv.get('covers_data'),
        kv.get('promotions_data'),
        kv.get('videos_data'),
        kv.get('site_settings'),
      ]);

      return res.status(200).json({
        success: true,
        scripts: Array.isArray(scripts) ? scripts : null,
        products: Array.isArray(products) ? products : null,
        covers: Array.isArray(covers) ? covers : null,
        promotions: Array.isArray(promotions) ? promotions : null,
        videos: Array.isArray(videos) ? videos : null,
        siteSettings: siteSettings && typeof siteSettings === 'object' ? siteSettings : null,
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
      const promotions = Array.isArray(body.promotions) ? body.promotions : null;
      const videos = Array.isArray(body.videos) ? body.videos : null;
      const siteSettings =
        body.siteSettings && typeof body.siteSettings === 'object' ? body.siteSettings : null;

      if (!Array.isArray(scripts)) {
        return res.status(400).json({ success: false, error: 'פורמט סקריפטים לא תקין' });
      }

      const [existingScripts, existingProducts, existingCovers, existingPromotions, existingVideos] = await Promise.all([
        kv.get('scripts_data'),
        kv.get('products_data'),
        kv.get('covers_data'),
        kv.get('promotions_data'),
        kv.get('videos_data'),
      ]);

      const mergedScripts = upsertById(existingScripts, scripts);
      const operations: Promise<any>[] = [kv.set('scripts_data', mergedScripts)];

      if (products) {
        const mergedProducts = upsertById(existingProducts, products);
        operations.push(kv.set('products_data', mergedProducts));
      }

      if (covers) {
        const mergedCovers = upsertById(existingCovers, covers);
        operations.push(kv.set('covers_data', mergedCovers));
      }

      if (promotions) {
        const mergedPromotions = upsertById(existingPromotions, promotions);
        operations.push(kv.set('promotions_data', mergedPromotions));
      }

      if (videos) {
        const mergedVideos = upsertById(existingVideos, videos);
        operations.push(kv.set('videos_data', mergedVideos));
      }

      if (siteSettings) {
        operations.push(kv.set('site_settings', siteSettings));
      }

      await Promise.all(operations);

      return res.status(200).json({ success: true, message: 'הנתונים עודכנו בענן בהצלחה!' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ success: false, error: 'שגיאה בשמירת הנתונים' });
    }
  } else {
    return res.status(405).json({ error: 'שיטה לא מורשית' });
  }
}