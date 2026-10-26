/* Original angular sigils. 8192 ids = 4 tiers × 8 radicals × 2 crowns. */

export const VB_W = 76;
export const VB_H = 100;

function tierPath(kind, x, y) {
  const a = x;
  const b = x + 14;
  const c = x + 28;
  const d = x + 42;
  const y0 = y;
  const y1 = y + 8;
  const y2 = y + 16;
  switch (kind) {
    case 0:
      return `M${a} ${y2} L${b} ${y0} L${d} ${y2}`;
    case 1:
      return `M${a} ${y0} L${b} ${y2} L${d} ${y0}`;
    case 2:
      return `M${a} ${y0 + 3} L${c} ${y0 + 3} L${c} ${y2 - 2} L${d} ${y2 - 2}`;
    case 3:
      return `M${a} ${y2 - 2} L${b} ${y2 - 2} L${b} ${y0 + 3} L${d} ${y0 + 3}`;
    case 4:
      return `M${a} ${y1} L${b} ${y1} L${d} ${y0 + 1} M${b} ${y1} L${d - 2} ${y2 - 1}`;
    case 5:
      return `M${a} ${y0 + 2} L${b} ${y2} L${c} ${y0 + 4} L${d} ${y2}`;
    case 6:
      return `M${a} ${y0 + 2} L${c - 4} ${y0 + 2} L${c + 4} ${y1} L${c - 4} ${y2 - 2} L${a} ${y2 - 2}`;
    default:
      return `M${a} ${y0 + 3} L${d - 2} ${y0 + 3} M${a} ${y2 - 2} L${c} ${y2 - 2} L${d} ${y1}`;
  }
}

export function glyphDefs(id) {
  const n = ((id & 8191) * 3221) & 8191;
  const tiers = [n & 7, (n >> 3) & 7, (n >> 6) & 7, (n >> 9) & 7];
  const crown = (n >> 12) & 1;
  const x = crown ? 26 : 18;
  const body = tiers.map((k, i) => tierPath(k, x, 16 + i * 18)).join(" ");
  const stem = `M${x} 8 L${x} 90 L${x + 14} 90`;
  const top = crown
    ? `M${x + 6} 3 L${x + 14} 10 M${x + 22} 3 L${x + 14} 10`
    : `M${x + 8} 4 L${x + 16} 11 L${x + 24} 4`;
  return { stem, body, crown: top };
}

export function glyphMarkup(id) {
  const g = glyphDefs(id);
  return (
    `<svg viewBox="0 0 ${VB_W} ${VB_H}" aria-hidden="true">` +
    `<path class="stem" d="${g.stem}"/>` +
    `<path class="under ink" d="${g.body}"/>` +
    `<path class="ink" d="${g.body}"/>` +
    `<path class="under crown" d="${g.crown}"/>` +
    `<path class="crown" d="${g.crown}"/>` +
    `</svg>`
  );
}
