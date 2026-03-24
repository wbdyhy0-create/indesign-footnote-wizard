/**
 * Bit (Israel / Bank Hapoalim) pay-request links.
 * Mobile browsers often drop query params when opening the Bit app from window.open(_blank);
 * use same-window navigation on mobile.
 */

/** Israeli mobile → digits only, prefer 972… for pay-request URLs. */
export function normalizeBitRecipientPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('972')) return digits;
  if (digits.startsWith('0') && digits.length >= 9) return `972${digits.slice(1)}`;
  return digits;
}

export function buildBitPayRequestUrl(phone: string, amountNis: number, text: string): string {
  const normalizedPhone = normalizeBitRecipientPhone(phone);
  const encodedText = encodeURIComponent(text);
  const normalizedAmount = Number.isInteger(amountNis) ? String(amountNis) : amountNis.toFixed(2);
  return `https://www.bitpay.co.il/app/pay-request/?phone=${normalizedPhone}&amount=${normalizedAmount}&text=${encodedText}`;
}

export function openBitPayUrl(url: string): void {
  if (typeof window === 'undefined') return;
  const ua = navigator.userAgent;
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobi|Silk/i.test(ua);
  if (isMobile) {
    window.location.assign(url);
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
