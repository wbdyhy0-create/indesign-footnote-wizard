export interface CodepointItem {
  codePoint: number;
  label: string;
}

/** אותיות עבריות כולל סופיות (U+05D0–U+05EA) */
export const HEBREW_LETTERS: CodepointItem[] = (() => {
  const out: CodepointItem[] = [];
  for (let cp = 0x05d0; cp <= 0x05ea; cp++) {
    out.push({
      codePoint: cp,
      label: String.fromCodePoint(cp),
    });
  }
  return out;
})();

/** ניקוד וטעמים U+0591 … U+05C7 */
export const NIKKUD_AND_CANTILLATION: CodepointItem[] = (() => {
  const out: CodepointItem[] = [];
  for (let cp = 0x0591; cp <= 0x05c7; cp++) {
    out.push({
      codePoint: cp,
      label: String.fromCodePoint(cp),
    });
  }
  return out;
})();
