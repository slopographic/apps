/* Slop Watermark's headless operation, for Slop Workflows (registry: shared/ops/registry.js):
 *   watermark.apply   a text and/or logo watermark, painted by the one watermark engine (shared/watermark/core.js,
 *                     SlopWatermark.draw: positions and sizes as fractions of the shorter side, tiling, rotation). The
 *                     picture keeps its size and its format (JPG stays JPG; BMP and GIF become PNG).
 * toCfg(options) and fromCfg(cfg, logoDataUrl) map between these options and the engine's setup, so Slop Watermark's
 * "Add to a workflow…" sends its current setup (watermark/js/main.js). Sizes here are percent of the shorter side. */
import { register } from './registry.js';
import { scripts, decode, encode, stem, pictureKind, kindOfBlob, IMAGE_IN } from './load.js';

const g = globalThis;
const POSITIONS = [['tl', 'Top left'], ['tc', 'Top middle'], ['tr', 'Top right'], ['ml', 'Middle left'], ['mc', 'Centre'], ['mr', 'Middle right'], ['bl', 'Bottom left'], ['bc', 'Bottom middle'], ['br', 'Bottom right']];
const FONTS = [['Inter Tight, system-ui, sans-serif', 'Sans serif'], ['Georgia, serif', 'Serif'], ['ui-monospace, Menlo, Consolas, monospace', 'Monospace']];

export const WATERMARK_OPTIONS = [
  { key: 'mark', type: 'select', label: 'Watermark', value: 'text', options: [['text', 'Text'], ['logo', 'Logo'], ['both', 'Logo and text']] },
  { key: 'text', type: 'text', label: 'Text', value: '© Your name', placeholder: '© Your name' },
  { key: 'logo', type: 'image', label: 'Logo picture', value: '', hint: 'A PNG with a see-through background looks best. Kept inside the workflow.' },
  { key: 'font', type: 'select', label: 'Font', value: FONTS[0][0], options: FONTS },
  { key: 'colour', type: 'color', label: 'Text colour', value: '#ffffff' },
  { key: 'shadow', type: 'checkbox', label: 'Shadow behind the text', value: true },
  { key: 'size', type: 'number', label: 'Text size (% of the shorter side)', min: 1, max: 40, step: 0.5, value: 4.5 },
  { key: 'logoSize', type: 'number', label: 'Logo size (% of the shorter side)', min: 2, max: 100, step: 1, value: 20 },
  { key: 'opacity', type: 'range', label: 'Opacity (%)', min: 5, max: 100, value: 50 },
  { key: 'position', type: 'select', label: 'Position', value: 'br', options: POSITIONS },
  { key: 'margin', type: 'number', label: 'Margin (% of the shorter side)', min: 0, max: 30, step: 0.5, value: 3 },
  { key: 'rotate', type: 'number', label: 'Rotation (degrees)', min: -180, max: 180, value: 0 },
  { key: 'tile', type: 'checkbox', label: 'Repeat across the picture (tile)', value: false },
];

/** The engine's setup (SlopWatermark.defaults shape) for one mark: 'text' or 'logo'. */
export function toCfg(o = {}, kind = 'text') {
  return { kind, text: o.text ?? '© Your name', font: o.font || FONTS[0][0], weight: 600, colour: o.colour || '#ffffff', shadow: o.shadow !== false,
    size: Number(o.size ?? 4.5) / 100, logoScale: Number(o.logoSize ?? 20) / 100, opacity: Number(o.opacity ?? 50) / 100,
    position: o.position || 'br', tile: !!o.tile, rotate: Number(o.rotate) || 0, margin: Number(o.margin ?? 3) / 100 };
}
/** These options from Slop Watermark's setup (WMSettings.cfg()) and its logo's data URL. */
export function fromCfg(c = {}, logo = '') {
  return { mark: c.kind === 'logo' ? 'logo' : 'text', text: c.text ?? '', logo: logo || '', font: c.font || FONTS[0][0], colour: c.colour || '#ffffff',
    shadow: c.shadow !== false, size: Math.round((c.size ?? 0.045) * 1000) / 10, logoSize: Math.round((c.logoScale ?? 0.2) * 100),
    opacity: Math.round((c.opacity ?? 0.5) * 100), position: c.position || 'br', margin: Math.round((c.margin ?? 0.03) * 1000) / 10,
    rotate: c.rotate || 0, tile: !!c.tile };
}

const logos = new Map();
async function logoOf(dataUrl) {
  if (!dataUrl) return null;
  if (!logos.has(dataUrl)) logos.set(dataUrl, fetch(dataUrl).then((r) => r.blob()).then((b) => createImageBitmap(b)).catch(() => { logos.delete(dataUrl); throw new Error('The logo picture could not be read.'); }));
  return logos.get(dataUrl);
}

async function apply(files, o) {
  await scripts(['shared/watermark/core.js'], () => !!g.SlopWatermark);
  const f = files[0], { canvas } = await decode(f.file);
  const mark = o.mark || 'text', ctx = canvas.getContext('2d');
  const wantLogo = mark === 'logo' || mark === 'both', wantText = mark === 'text' || mark === 'both';
  if (wantLogo && !o.logo) throw new Error('Choose a logo picture for the watermark.');
  if (wantText && !String(o.text || '').trim() && !wantLogo) throw new Error('Type the watermark text.');
  const W = canvas.width, H = canvas.height, W_ = g.SlopWatermark;
  const logoCfg = toCfg(o, 'logo'), img = wantLogo ? await logoOf(o.logo) : null;
  if (wantLogo) W_.draw(ctx, W, H, logoCfg, { image: img });
  if (wantText && String(o.text || '').trim()) {
    const cfg = toCfg(o, 'text');
    ctx.save();
    if (wantLogo && !o.tile) {
      // logo and text at one position: the text goes above the logo at the bottom, below it at the top and the middle
      const l = W_.itemSize(ctx, W, H, logoCfg, img), t = W_.itemSize(ctx, W, H, cfg, null), gap = Math.min(W, H) * 0.01;
      ctx.translate(0, /^b/.test(cfg.position) ? -(l.h + gap) : /^t/.test(cfg.position) ? l.h + gap : (l.h + t.h) / 2 + gap);
    }
    W_.draw(ctx, W, H, cfg, null);
    ctx.restore();
  }
  const blob = await encode(canvas, pictureKind(f.kind), 0.92), kind = kindOfBlob(blob);
  return [{ name: `${stem(f.name)}.${kind}`, blob, kind }];
}

export const WATERMARK_OPS = register([
  { id: 'watermark.apply', label: 'Watermark', group: 'Pictures', from: IMAGE_IN, mode: 'each', out: (k) => pictureKind(k),
    description: 'Your text or logo on every picture: nine positions, size, opacity, rotation and tiling.',
    keywords: ['watermark', 'logo', 'copyright', 'stamp', 'brand'], options: WATERMARK_OPTIONS, run: apply,
    fromApp: (s = {}) => fromCfg(s.cfg || {}, s.logo || ''),   // Slop Watermark's "Add to a workflow…" (shared/ops/flowdoc.js)
    check: (o = {}) => ((o.mark === 'logo' || o.mark === 'both') && !o.logo ? 'Choose a logo picture.' : o.mark !== 'logo' && o.mark !== 'both' && !String(o.text ?? '© Your name').trim() ? 'Type the watermark text.' : '') },
], { app: 'watermark', label: 'Slop Watermark' });
