/** Pomoćne funkcije za boje: kontrast, mešanje, izvlačenje boje iz logoa. */

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r: number, g: number, b: number) {
  return "#" + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
}

export function luminance(hex: string) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Bela ili tamna boja teksta preko date pozadine (WCAG kontrast). */
export function onColor(hex: string) {
  const L = luminance(hex);
  const vsWhite = 1.05 / (L + 0.05);
  const vsDark = (L + 0.05) / 0.06;
  // bela ima prednost na brend bojama srednje svetline
  return vsWhite >= 3 || vsWhite >= vsDark ? "#FFFFFF" : "#111318";
}

export function mix(a: string, b: string, t: number) {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

/** Najzastupljenija zasićena boja na slici (za predlog primarne boje iz logoa). */
export async function dominantColor(dataUrl: string): Promise<string | null> {
  const img = new Image();
  img.src = dataUrl;
  await img.decode().catch(() => null);
  if (!img.width) return null;
  const c = document.createElement("canvas");
  c.width = c.height = 48;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, 48, 48);
  const data = ctx.getImageData(0, 0, 48, 48).data;
  const buckets = new Map<string, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
    if (a < 200) continue;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    if (max - min < 40 || max < 40 || min > 230) continue; // preskoči sive, crne, bele
    const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
    const e = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    e.n++; e.r += r; e.g += g; e.b += b;
    buckets.set(key, e);
  }
  let best: { n: number; r: number; g: number; b: number } | null = null;
  for (const e of buckets.values()) if (!best || e.n > best.n) best = e;
  return best ? rgbToHex(best.r / best.n, best.g / best.n, best.b / best.n) : null;
}

/** Smanjuje sliku u pregledaču pre uploada (max strana, JPEG/PNG). */
export async function compressImage(file: File, max = 1200, keepAlpha = false): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return keepAlpha ? c.toDataURL("image/png") : c.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}
