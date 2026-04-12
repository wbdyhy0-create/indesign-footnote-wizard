const FONT_NAME_RE = /\.(ttf|otf|woff2?)$/i;

/** בוחר קובץ גופן ראשון מתוך רשימת גרירה */
export function pickFontFileFromList(list: FileList | null): File | null {
  if (!list?.length) return null;
  for (let i = 0; i < list.length; i++) {
    const f = list[i];
    if (FONT_NAME_RE.test(f.name)) return f;
  }
  return null;
}

export function dataTransferHasFiles(dt: DataTransfer | null): boolean {
  if (!dt?.types) return false;
  return Array.from(dt.types).includes("Files");
}
