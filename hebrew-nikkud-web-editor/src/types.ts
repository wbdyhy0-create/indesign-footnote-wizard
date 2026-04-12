/** אזור מיקום גס לסימון — משמש סידור שכבות והתנגשויות */
export type MarkZone = "center" | "upper" | "lower" | "meteg";

export interface MarkInstance {
  id: string;
  codePoint: number;
  /** היסט אופקי ביחידות עיצוב פונט (כמו UPM, יחס 1:1 ל-em בגודל נתון) */
  offsetX: number;
  /** היסט אנכי ביחידות עיצוב פונט */
  offsetY: number;
}

export interface EditorModel {
  baseCodePoint: number;
  marks: MarkInstance[];
}
