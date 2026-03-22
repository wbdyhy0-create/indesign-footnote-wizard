/** localStorage: כשמוגדר, עמוד הבית לא שולח POST להעלאת מונה כניסות (למחשב הבעלים) */
export const OWNER_SKIP_VISIT_STORAGE_KEY = 'fw_owner_skip_visit_count';

export function shouldSkipVisitBump(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(OWNER_SKIP_VISIT_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setOwnerSkipVisitBump(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (enabled) localStorage.setItem(OWNER_SKIP_VISIT_STORAGE_KEY, '1');
    else localStorage.removeItem(OWNER_SKIP_VISIT_STORAGE_KEY);
  } catch {
    /* ignore quota / private mode */
  }
}
