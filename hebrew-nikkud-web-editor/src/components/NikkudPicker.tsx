import { NIKKUD_POINTS } from "../data/nikkudPoints";

export interface NikkudPickerProps {
  selectedCodePoint: number;
  onSelect: (codePoint: number) => void;
}

export function NikkudPicker({ selectedCodePoint, onSelect }: NikkudPickerProps) {
  return (
    <div className="nikkud-picker" role="listbox" aria-label="בחירת ניקוד — כל סימן בעיגול">
      {NIKKUD_POINTS.map((item) => {
        const sel = item.codePoint === selectedCodePoint;
        const hex = item.codePoint.toString(16).toUpperCase();
        const label = `${item.nameHe} — U+${hex}`;
        return (
          <button
            key={item.codePoint}
            type="button"
            role="option"
            aria-selected={sel}
            aria-label={label}
            title={label}
            className={sel ? "nikkud-dot nikkud-dot--selected" : "nikkud-dot"}
            onClick={() => onSelect(item.codePoint)}
          >
            <span className="nikkud-dot-char" aria-hidden>
              {item.char}
            </span>
          </button>
        );
      })}
    </div>
  );
}
