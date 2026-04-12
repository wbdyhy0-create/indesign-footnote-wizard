import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorCanvas } from "./components/EditorCanvas";
import { HEBREW_LETTERS, NIKKUD_AND_CANTILLATION } from "./data/codepoints";
import { useFontLoader } from "./hooks/useFontLoader";
import type { MarkInstance } from "./types";
import { markZoneForCodePoint } from "./lib/markZones";
import { nudgeOutOfCenterOverlap } from "./lib/collision";
import type { BBox } from "./lib/collision";

function defaultOffsetsForMark(cp: number): { offsetX: number; offsetY: number } {
  const z = markZoneForCodePoint(cp);
  switch (z) {
    case "center":
      return { offsetX: 0, offsetY: 40 };
    case "lower":
      return { offsetX: 0, offsetY: 120 };
    case "meteg":
      return { offsetX: -120, offsetY: -20 };
    case "upper":
    default:
      return { offsetX: 0, offsetY: -120 };
  }
}

function newMarkId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `m-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function App() {
  const { font, fileName, error, loadFromFile, clearFont } = useFontLoader();
  const [baseCodePoint, setBaseCodePoint] = useState(0x05d0);
  const [marks, setMarks] = useState<MarkInstance[]>([]);
  const [selectedMarkId, setSelectedMarkId] = useState<string | null>(null);
  const [markToAdd, setMarkToAdd] = useState(0x05b8);
  const markBoxesRef = useRef<Map<string, BBox>>(new Map());

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
    const { offsetX, offsetY } = defaultOffsetsForMark(markToAdd);
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

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>עורך עוגני ניקוד — שלד Frontend</h1>
        <p className="app-sub">
          טעינת גופן עם opentype.js, קנבס, היסטים ביחידות עיצוב הפונט, תמיכה במספר סימנים
        </p>
      </header>

      <section className="panel">
        <label className="file-label">
          <span>טעינת גופן</span>
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
        <div className="canvas-wrap">
          <EditorCanvas
            font={font}
            baseCodePoint={baseCodePoint}
            marks={marks}
            selectedMarkId={selectedMarkId}
            onSelectMark={setSelectedMarkId}
            onBoxesMeasured={handleBoxesMeasured}
          />
        </div>

        <aside className="side">
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
            <label>הוספת ניקוד / טעם</label>
            <select value={markToAdd} onChange={(e) => setMarkToAdd(Number(e.target.value))}>
              {NIKKUD_AND_CANTILLATION.map((l) => (
                <option key={l.codePoint} value={l.codePoint}>
                  {l.label} U+{l.codePoint.toString(16).toUpperCase()}
                </option>
              ))}
            </select>
            <button type="button" className="primary" onClick={addMark}>
              הוסף סימן
            </button>
          </div>

          <div className="field">
            <label>סימנים בשכבה</label>
            <ul className="mark-list">
              {marks.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    className={m.id === selectedMarkId ? "mark-sel" : "mark-btn"}
                    onClick={() => setSelectedMarkId(m.id)}
                  >
                    {String.fromCodePoint(m.codePoint)} · ΔX {m.offsetX} · ΔY {m.offsetY}
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
            <p className="hint">חיצים במקלדת: 5 יחידות; Shift: 25</p>
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
            <label>ייצוא JSON (שלד)</label>
            <textarea
              readOnly
              rows={6}
              value={JSON.stringify({ baseCodePoint, marks }, null, 2)}
              className="json-out"
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
