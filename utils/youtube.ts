export function toYouTubeEmbedUrl(input: string): string {
  const url = (input || '').trim();
  if (!url) return '';
  if (url.includes('youtube.com/embed/')) return url;

  // watch?v=ID
  const watchMatch = url.match(/[?&]v=([^&]+)/);
  if (watchMatch?.[1]) return `https://www.youtube.com/embed/${watchMatch[1]}`;

  // youtu.be/ID
  const shortMatch = url.match(/youtu\.be\/([^?&/]+)/);
  if (shortMatch?.[1]) return `https://www.youtube.com/embed/${shortMatch[1]}`;

  // youtube.com/shorts/ID
  const shortsMatch = url.match(/youtube\.com\/shorts\/([^?&/]+)/);
  if (shortsMatch?.[1]) return `https://www.youtube.com/embed/${shortsMatch[1]}`;

  // last segment fallback (very permissive)
  const last = url.split('/').filter(Boolean).pop();
  if (last && /^[a-zA-Z0-9_-]{6,}$/.test(last)) return `https://www.youtube.com/embed/${last}`;

  return url;
}

