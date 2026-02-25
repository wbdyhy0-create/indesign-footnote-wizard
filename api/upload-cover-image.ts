import { put } from '@vercel/blob';

const DATA_URL_IMAGE_REGEX = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/;

const sanitizeFileName = (name: string) => {
  const base = (name || 'cover-image')
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return base || 'cover-image';
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'שיטה לא מורשית' });
  }

  try {
    const { fileName, contentType, dataUrl } = req.body || {};

    if (typeof dataUrl !== 'string' || !dataUrl.trim()) {
      return res.status(400).json({ success: false, error: 'חסר שדה dataUrl' });
    }

    const match = dataUrl.match(DATA_URL_IMAGE_REGEX);
    if (!match) {
      return res.status(400).json({ success: false, error: 'פורמט תמונה לא תקין' });
    }

    const mimeType = (typeof contentType === 'string' && contentType) || match[1] || 'image/png';
    if (!mimeType.startsWith('image/')) {
      return res.status(400).json({ success: false, error: 'ניתן להעלות רק קבצי תמונה' });
    }

    const base64Payload = match[2];
    const imageBuffer = Buffer.from(base64Payload, 'base64');
    const extension = mimeType.split('/')[1] || 'png';
    const safeName = sanitizeFileName(typeof fileName === 'string' ? fileName : 'cover-image');
    const blobPath = `covers/${Date.now()}-${safeName}.${extension}`;

    const blob = await put(blobPath, imageBuffer, {
      access: 'public',
      contentType: mimeType,
      addRandomSuffix: true,
    });

    return res.status(200).json({
      success: true,
      url: blob.url,
      pathname: blob.pathname,
    });
  } catch (error: any) {
    console.error('Cover upload failed:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'שגיאה בהעלאת התמונה לשרת',
    });
  }
}
