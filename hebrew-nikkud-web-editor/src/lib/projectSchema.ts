import type { MarkInstance } from "../types";

export const PROJECT_FILE_VERSION = 1 as const;

/** סימון כפי שנשמר בקובץ (בלי מזהה פנימי ל־React) */
export interface ProjectFileMark {
  codePoint: number;
  offsetX: number;
  offsetY: number;
}

export interface ProjectFileRule {
  baseCodePoint: number;
  marks: ProjectFileMark[];
}

export interface NikkudProjectFileV1 {
  version: typeof PROJECT_FILE_VERSION;
  /** שם קובץ הגופן שהוזן בממשק (רמז בלבד) */
  sourceFontHint?: string;
  rules: ProjectFileRule[];
}

export interface ProjectRule {
  id: string;
  baseCodePoint: number;
  marks: MarkInstance[];
}
