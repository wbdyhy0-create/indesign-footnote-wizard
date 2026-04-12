import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorCanvas } from "./components/EditorCanvas";
import { HEBREW_LETTERS } from "./data/codepoints";
import { NikkudPicker } from "./components/NikkudPicker";
import { useFontLoader } from "./hooks/useFontLoader";
import type { MarkInstance } from "./types";
import { nudgeOutOfCenterOverlap } from "./lib/collision";
import type { BBox } from "./lib/collision";
import type { ProjectRule } from "./lib/projectSchema";
import {
  buildProjectFile,
  downloadJson,
  fileToUiRules,
  parseProjectFileJson,
} from "./lib/projectIO";
import { dataTransferHasFiles, pickFontFileFromList } from "./lib/pickFontFile";

/** ברירת מחדל 0,0 — ההיסטים נשמרים כדלתא לעוגן ה-Mark בפונט (ראו scripts/apply_nikkud_project.py) */
function defaultOffsetsForMark(): { offsetX: number; offsetY: number } {
  return { offsetX: 0, offsetY: 0 };
}

function newMarkId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `m-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function newRuleId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `r-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function App() {
  const { font, fileName, error, loadFromFile, clearFont } = useFontLoader();
  const [baseCodePoint, setBaseCodePoint] = useState(0x05d0);
  const [marks, setMarks] = useState<MarkInstance[]>([]);
  const [selectedMarkId, setSelectedMarkId] = useState<string | null>(null);
  const [markToAdd, setMarkToAdd] = useState(0x05b8);
  const [showGrid, setShowGrid] = useState(true);
  const [gridMinorPx, setGridMinorPx] = useState(10);
  const [showAnchorGuides, setShowAnchorGuides] = useState(true);
  const [rules, setRules] = useState<ProjectRule[]>([]);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const markBoxesRef = useRef<Map<string, BBox>>(new Map());
  const projectFileInputRef = useRef<HTMLInputElement>(null);
  const fontDragDepthRef = useRef(0);
  const [fontDropActive, setFontDropActive] = useState(false);

  const gridMajorPx = gridMinorPx * 5;

  const projectFile = useMemo(
    () => buildProjectFile(rules, fileName || undefined),
    [rules, fileName],
  );

  const handleBoxesMeasured = useCallback((boxes: Map<string, BBox>) => {
    markBoxesRef.current = boxes;
  }, []);

  const selectedMark = useMemo(
    () => marks.find((m) => m.id === selectedMarkId) ?? null,
    [marks, selectedMarkId],
  );

  const updateSelectedOffset = useCallback(
    (dx: number, dy: number) => {
      if (!selectedMarkId) return;
      setMarks((prev) =>
        prev.map((m) =>
          m.id === selectedMarkId
            ? { ...m, offsetX: m.offsetX + dx, offsetY: m.offsetY + dy }
            : m,
        ),
      );
    },
    [selectedMarkId],
  );

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (!selectedMarkId) return;
      const fine = ev.shiftKey ? 25 : 5;
      switch (ev.key) {
        case "ArrowRight":
          ev.preventDefault();
          updateSelectedOffset(fine, 0);
          break;
        case "ArrowLeft":
          ev.preventDefault();
          updateSelectedOffset(-fine, 0);
          break;
        case "ArrowUp":
          ev.preventDefault();
          updateSelectedOffset(0, -fine);
          break;
        case "ArrowDown":
          ev.preventDefault();
          updateSelectedOffset(0, fine);
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedMarkId, updateSelectedOffset]);

  const addMark = () => {
    const { offsetX, offsetY } = defaultOffsetsForMark();
    const id = newMarkId();
    setMarks((prev) => [...prev, { id, codePoint: markToAdd, offsetX, offsetY }]);
    setSelectedMarkId(id);
  };

  const removeSelectedMark = () => {
    if (!selectedMarkId) return;
    setMarks((prev) => prev.filter((m) => m.id !== selectedMarkId));
    setSelectedMarkId(null);
  };

  const nudgeAwayFromDagesh = () => {
    setMarks((prev) => nudgeOutOfCenterOverlap(prev, markBoxesRef.current, 12));
  };

  const bump = (dx: number, dy: number) => updateSelectedOffset(dx, dy);

  const saveCurrentToProject = () => {
    if (!marks.length) return;
    setRules((prev) => {
      const idx = prev.findIndex((r) => r.baseCodePoint === baseCodePoint);
      const cloned = marks.map((m) => ({ ...m, id: newMarkId() }));
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], marks: cloned };
        return next;
      }
      return [...prev, { id: newRuleId(), baseCodePoint, marks: cloned }];
    });
  };

  const loadRuleIntoEditor = (rule: ProjectRule) => {
    setBaseCodePoint(rule.baseCodePoint);
    setMarks(rule.marks.map((m) => ({ ...m, id: newMarkId() })));
    setSelectedMarkId(null);
    setSelectedRuleId(rule.id);
  };

  const deleteRule = (ruleId: string) => {
    setRules((prev) => prev.filter((r) => r.id !== ruleId));
    if (selectedRuleId === ruleId) setSelectedRuleId(null);
  };

  const onDownloadProject = () => {
    downloadJson("nikkud-project.json", projectFile);
  };

  const onPickProjectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? "");
        const parsed = parseProjectFileJson(text);
        const ui = fileToUiRules(parsed);
        setRules(ui);
        if (ui.length) loadRuleIntoEditor(ui[0]);
        else {
          setMarks([]);
          setSelectedMarkId(null);
        }
      } catch (err) {
        alert(err instanceof Error ? err.message : "טעינת פרויקט נכשלה");
      }
    };
    reader.readAsText(f, "UTF-8");
    e.target.value = "";
  };

  const onFontDragEnter = useCallback((e: React.DragEvent) => {
    if (!dataTransferHasFiles(e.dataTransfer)) return;
    e.preventDefault();
    fontDragDepthRef.current += 1;
    if (fontDragDepthRef.current === 1) setFontDropActive(true);
  }, []);

  const onFontDragLeave = useCallback((e: React.DragEvent) => {
    if (!dataTransferHasFiles(e.dataTransfer)) return;
    e.preventDefault();
    fontDragDepthRef.current -= 1;
    if (fontDragDepthRef.current <= 0) {
      fontDragDepthRef.current = 0;
      setFontDropActive(false);
    }
  }, []);

  const onFontDragOver = useCallback((e: React.DragEvent) => {
    if (!dataTransferHasFiles(e.dataTransfer)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const onFontDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      fontDragDepthRef.current = 0;
      setFontDropActive(false);
      const file = pickFontFileFromList(e.dataTransfer.files);
      if (file) loadFromFile(file);
    },
    [loadFromFile],
  );

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>עורך עוגני ניקוד — שלד Frontend</h1>
        <p className="app-sub">
          טעינת גופן עם opentype.js, פרויקט JSON לכל האותיות, ובניית גופן דרך סקריפט Python
        </p>
      </header>

      <section className="panel">
        <label className="file-label">
          <span>טעינת גופן (או גרירה לאזור הקנבס)</span>
          <input
            type="file"
            accept=".ttf,.otf,.woff,.woff2"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) loadFromFile(f);
            }}
          />
        </label>
        {fileName ? (
          <span className="file-meta">
            {fileName}
            <button type="button" className="linkish" onClick={clearFont}>
              נקה
            </button>
          </span>
        ) : null}
        {error ? <p className="error">{error}</p> : null}
      </section>

      <div className="layout">
        <div
          className={`canvas-wrap${fontDropActive ? " canvas-wrap--drop-target" : ""}`}
          onDragEnter={onFontDragEnter}
          onDragLeave={onFontDragLeave}
          onDragOver={onFontDragOver}
          onDrop={onFontDrop}
        >
          {fontDropActive ? (
            <div className="canvas-drop-hint" aria-hidden>
              שחררו כאן לטעינת הגופן
            </div>
          ) : null}
          <EditorCanvas
            font={font}
            baseCodePoint={baseCodePoint}
            marks={marks}
            selectedMarkId={selectedMarkId}
            onSelectMark={setSelectedMarkId}
            onBoxesMeasured={handleBoxesMeasured}
            showGrid={showGrid}
            gridMinorPx={gridMinorPx}
            gridMajorPx={gridMajorPx}
            showAnchorGuides={showAnchorGuides}
          />
          <div className="canvas-tools">
            <label className="check">
              <input
                type="checkbox"
                checked={showGrid}
                onChange={(e) => setShowGrid(e.target.checked)}
              />
              רשת פיקסלים
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={showAnchorGuides}
                onChange={(e) => setShowAnchorGuides(e.target.checked)}
              />
              קווי עוגן (מרכז אופקי + עליון האות)
            </label>
            <label className="grid-step">
              צעד רשת
              <select
                value={gridMinorPx}
                onChange={(e) => setGridMinorPx(Number(e.target.value))}
                disabled={!showGrid}
              >
                <option value={5}>5 פיקסלים</option>
                <option value={10}>10 פיקסלים</option>
                <option value={20}>20 פיקסלים</option>
              </select>
            </label>
          </div>
        </div>

        <aside className="side">
          <div className="field project-block">
            <label>פרויקט (כל האותיות)</label>
            <p className="hint project-hint">
              שמירת צירוף נוכחי לאוסף הכללים. ההיסטים בקובץ מתפרשים כדלתא לעוגן ה-Mark ב-GPOS
              (נדרש גופן עם MarkToBase; ראו{" "}
              <code className="inline-code">scripts/apply_nikkud_project.py</code>).
            </p>
            <div className="field row">
              <button type="button" className="primary" onClick={saveCurrentToProject} disabled={!marks.length}>
                שמור צירוף נוכחי לפרויקט
              </button>
            </div>
            <ul className="rule-list">
              {rules.map((r) => (
                <li key={r.id} className="rule-row">
                  <button
                    type="button"
                    className={r.id === selectedRuleId ? "mark-sel" : "mark-btn"}
                    onClick={() => loadRuleIntoEditor(r)}
                  >
                    {String.fromCodePoint(r.baseCodePoint)} · {r.marks.length} סימנים
                  </button>
                  <button type="button" className="rule-del" onClick={() => deleteRule(r.id)} aria-label="מחק">
                    ✕
                  </button>
                </li>
              ))}
            </ul>
            {rules.length === 0 ? <p className="muted">אין כללים בפרויקט</p> : null}
            <div className="field row">
              <button type="button" onClick={onDownloadProject}>
                הורד nikkud-project.json
              </button>
              <button type="button" onClick={() => projectFileInputRef.current?.click()}>
                טען פרויקט…
              </button>
              <input
                ref={projectFileInputRef}
                type="file"
                accept=".json,application/json"
                hidden
                onChange={onPickProjectFile}
              />
            </div>
          </div>

          <div className="field">
            <label>אות בסיס</label>
            <select
              value={baseCodePoint}
              onChange={(e) => setBaseCodePoint(Number(e.target.value))}
            >
              {HEBREW_LETTERS.map((l) => (
                <option key={l.codePoint} value={l.codePoint}>
                  {l.label} (U+{l.codePoint.toString(16).toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>הוספת ניקוד</label>
            <NikkudPicker selectedCodePoint={markToAdd} onSelect={setMarkToAdd} />
            <button type="button" className="primary nikkud-add-btn" onClick={addMark}>
              הוסף את הניקוד הנבחר
            </button>
          </div>

          <div className="field">
            <label>סימנים בשכבה</label>
            <ul className="mark-list">
              {marks.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    className={
                      m.id === selectedMarkId ? "mark-row mark-row--sel" : "mark-row mark-row--plain"
                    }
                    onClick={() => setSelectedMarkId(m.id)}
                  >
                    <span className="mark-row-glyph" aria-hidden>
                      {String.fromCodePoint(m.codePoint)}
                    </span>
                    <span className="mark-row-meta">
                      ΔX {m.offsetX} · ΔY {m.offsetY}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {marks.length === 0 ? <p className="muted">אין סימנים — הוסף מרשימה</p> : null}
          </div>

          <div className="field">
            <label>היסט (יחידות פונט) — נבחר: {selectedMark ? String.fromCodePoint(selectedMark.codePoint) : "—"}</label>
            <div className="readout">
              <span>ΔX: {selectedMark?.offsetX ?? "—"}</span>
              <span>ΔY: {selectedMark?.offsetY ?? "—"}</span>
            </div>
            <div className="arrows" dir="ltr">
              <button type="button" onClick={() => bump(-5, 0)} disabled={!selectedMark}>
                ←
              </button>
              <button type="button" onClick={() => bump(0, -5)} disabled={!selectedMark}>
                ↑
              </button>
              <button type="button" onClick={() => bump(0, 5)} disabled={!selectedMark}>
                ↓
              </button>
              <button type="button" onClick={() => bump(5, 0)} disabled={!selectedMark}>
                →
              </button>
            </div>
            <p className="hint">חיצים במקלדת: 5 יחידות; Shift: 25 · סימן חדש מתחיל ב־0,0 (דלתא לייצוא)</p>
          </div>

          <div className="field row">
            <button type="button" onClick={removeSelectedMark} disabled={!selectedMark}>
              מחק נבחר
            </button>
            <button type="button" onClick={nudgeAwayFromDagesh} disabled={!marks.length}>
              הרחק מדגש (חפיפה)
            </button>
          </div>

          <div className="field">
            <label>תצוגת פרויקט (JSON)</label>
            <textarea
              readOnly
              rows={8}
              value={JSON.stringify(projectFile, null, 2)}
              className="json-out"
            />
          </div>

          <div className="field cli-hint">
            <strong>בניית גופן (מקומי):</strong>
            <pre className="cli-pre">
{`pip install -r hebrew-nikkud-web-editor/scripts/requirements.txt
python hebrew-nikkud-web-editor/scripts/apply_nikkud_project.py ^
  --input MyFont.ttf --project nikkud-project.json -o MyFont-nikkud.ttf`}
            </pre>
          </div>
        </aside>
      </div>
    </div>
  );
}
