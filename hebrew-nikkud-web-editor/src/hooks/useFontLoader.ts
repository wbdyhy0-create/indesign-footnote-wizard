import { useCallback, useState } from "react";
import opentype from "opentype.js";
import type { Font } from "opentype.js";

export function useFontLoader() {
  const [font, setFont] = useState<Font | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const loadFromFile = useCallback((file: File) => {
    setError(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const buf = e.target?.result;
      if (!(buf instanceof ArrayBuffer)) {
        setError("טעינה נכשלה");
        return;
      }
      try {
        const parsed = opentype.parse(buf);
        setFont(parsed);
      } catch {
        setError("לא ניתן לפרק את קובץ הגופן");
        setFont(null);
      }
    };
    reader.onerror = () => setError("שגיאת קריאת קובץ");
    reader.readAsArrayBuffer(file);
  }, []);

  const clearFont = useCallback(() => {
    setFont(null);
    setFileName("");
    setError(null);
  }, []);

  return { font, fileName, error, loadFromFile, clearFont };
}
