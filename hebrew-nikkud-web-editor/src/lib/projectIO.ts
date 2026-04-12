import type { MarkInstance } from "../types";
import {
  PROJECT_FILE_VERSION,
  type NikkudProjectFileV1,
  type ProjectFileMark,
  type ProjectFileRule,
  type ProjectRule,
} from "./projectSchema";

function newRuleId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `r-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function newMarkId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `m-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function marksToFileMarks(marks: MarkInstance[]): ProjectFileMark[] {
  return marks.map((m) => ({
    codePoint: m.codePoint,
    offsetX: m.offsetX,
    offsetY: m.offsetY,
  }));
}

export function fileMarksToMarks(fm: ProjectFileMark[]): MarkInstance[] {
  return fm.map((m) => ({
    id: newMarkId(),
    codePoint: m.codePoint,
    offsetX: m.offsetX,
    offsetY: m.offsetY,
  }));
}

export function buildProjectFile(
  rules: ProjectRule[],
  sourceFontHint?: string,
): NikkudProjectFileV1 {
  return {
    version: PROJECT_FILE_VERSION,
    sourceFontHint,
    rules: rules.map((r) => ({
      baseCodePoint: r.baseCodePoint,
      marks: marksToFileMarks(r.marks),
    })),
  };
}

export function parseProjectFileJson(text: string): NikkudProjectFileV1 {
  const raw = JSON.parse(text) as unknown;
  if (!raw || typeof raw !== "object") {
    throw new Error("קובץ לא תקין");
  }
  const o = raw as Record<string, unknown>;
  if (o.version !== PROJECT_FILE_VERSION) {
    throw new Error(`גרסת פרויקט לא נתמכת: ${String(o.version)}`);
  }
  if (!Array.isArray(o.rules)) {
    throw new Error("חסר מערך rules");
  }
  const rules: ProjectFileRule[] = [];
  for (const item of o.rules as unknown[]) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const baseCodePoint = Number(r.baseCodePoint);
    if (!Number.isFinite(baseCodePoint)) continue;
    const marksRaw = r.marks;
    const marks: ProjectFileMark[] = [];
    if (Array.isArray(marksRaw)) {
      for (const m of marksRaw) {
        if (!m || typeof m !== "object") continue;
        const mm = m as Record<string, unknown>;
        marks.push({
          codePoint: Number(mm.codePoint),
          offsetX: Number(mm.offsetX) || 0,
          offsetY: Number(mm.offsetY) || 0,
        });
      }
    }
    rules.push({ baseCodePoint, marks });
  }
  return {
    version: PROJECT_FILE_VERSION,
    sourceFontHint: typeof o.sourceFontHint === "string" ? o.sourceFontHint : undefined,
    rules,
  };
}

export function fileToUiRules(file: NikkudProjectFileV1): ProjectRule[] {
  return file.rules.map((r) => ({
    id: newRuleId(),
    baseCodePoint: r.baseCodePoint,
    marks: fileMarksToMarks(r.marks),
  }));
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
