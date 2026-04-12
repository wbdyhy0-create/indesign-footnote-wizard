import { NIKKUD_POINTS } from "../data/nikkudPoints";

export interface NikkudPickerProps {
  selectedCodePoint: number;
  onSelect: (codePoint: number) => void;
}

export function NikkudPicker({ selectedCodePoint, onSelect }: NikkudPickerProps) {
  return (
    <div className="nikkud-picker" role="listbox" aria-label="בחירת ניקוד">
      {NIKKUD_POINTS.map((item) => {
        const sel = item.codePoint === selectedCodePoint;
        const hex = item.codePoint.toString(16).toUpperCase();
        return (
          <button
            key={item.codePoint}
            type="button"
            role="option"
            aria-selected={sel}
            className={sel ? "nikkud-row nikkud-row--selected" : "nikkud-row"}
            onClick={() => onSelect(item.codePoint)}
          >
            <span className="nikkud-glyph" aria-hidden>
              {item.char}
            </span>
            <span className="nikkud-meta">
              <span className="nikkud-name">{item.nameHe}</span>
              <span className="nikkud-code">U+{hex}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
