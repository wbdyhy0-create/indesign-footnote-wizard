declare module "opentype.js" {
  export interface BoundingBox {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }

  export interface Path {
    fill: string | null;
    stroke: string | null;
    strokeWidth: number;
    draw(ctx: CanvasRenderingContext2D): void;
    getBoundingBox(): BoundingBox;
  }

  export interface Glyph {
    advanceWidth: number;
    getPath(x: number, y: number, fontSize: number): Path;
  }

  export interface Font {
    unitsPerEm: number;
    charToGlyph(char: string): Glyph;
  }

  function parse(buffer: ArrayBuffer): Font;

  const opentype: { parse: typeof parse };
  export default opentype;
}
