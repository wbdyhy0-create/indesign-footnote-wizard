/**
 * ניקוד בלבד (ללא טעמים U+0591–U+05AF).
 * שמות בעברית לפי המוסכמות הנפוצות בלשון ובדפוס.
 */
export interface NikkudPointItem {
  codePoint: number;
  /** תו לתצוגה */
  char: string;
  /** שם בעברית */
  nameHe: string;
}

export const NIKKUD_POINTS: NikkudPointItem[] = [
  { codePoint: 0x05b0, char: "\u05b0", nameHe: "שווא" },
  { codePoint: 0x05b1, char: "\u05b1", nameHe: "חטף־סגול" },
  { codePoint: 0x05b2, char: "\u05b2", nameHe: "חטף־פתח" },
  { codePoint: 0x05b3, char: "\u05b3", nameHe: "חטף־קמץ" },
  { codePoint: 0x05b4, char: "\u05b4", nameHe: "חיריק" },
  { codePoint: 0x05b5, char: "\u05b5", nameHe: "צרי" },
  { codePoint: 0x05b6, char: "\u05b6", nameHe: "סגול" },
  { codePoint: 0x05b7, char: "\u05b7", nameHe: "פתח" },
  { codePoint: 0x05b8, char: "\u05b8", nameHe: "קמץ" },
  { codePoint: 0x05b9, char: "\u05b9", nameHe: "חולם" },
  { codePoint: 0x05ba, char: "\u05ba", nameHe: "חולם חסר לוו" },
  { codePoint: 0x05bb, char: "\u05bb", nameHe: "קובוץ" },
  { codePoint: 0x05bc, char: "\u05bc", nameHe: "דגש / מפיק" },
  { codePoint: 0x05bd, char: "\u05bd", nameHe: "מטר (מטג)" },
  { codePoint: 0x05bf, char: "\u05bf", nameHe: "רפה" },
  { codePoint: 0x05c1, char: "\u05c1", nameHe: "נקודת שין (ימין)" },
  { codePoint: 0x05c2, char: "\u05c2", nameHe: "נקודת סין (שמאל)" },
  { codePoint: 0x05c7, char: "\u05c7", nameHe: "קמץ קטן" },
];
