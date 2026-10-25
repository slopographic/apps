// The touch mode of tests/run.mjs (--touch): pages marked <meta name="slop-test-touch"> run on a touch tablet, in WebKit
// (Safari's engine, as an iPad) or in Chromium (as an Android tablet), and get real touches from the runner.
// The page calls window.__slopInput(op) (tests/shared/touch-kit.js wraps it):
//   { op: 'tap', x, y }                                     one finger, tapped (every engine; Playwright's touchscreen)
//   { op: 'touch', type: 'start'|'move'|'end'|'cancel', points: [{ id, x, y }] }
//                                                           any fingers (Chromium only: CDP Input.dispatchTouchEvent)
// x, y are the test page's CSS pixels. It resolves true when it was sent, false when the engine cannot (the kit then
// sends pointer events from the page instead). Pure parts are tested in tests/node/touch-runner.test.mjs.
import { createRequire } from 'node:module';

/** The Playwright device a touch run uses: a landscape tablet (the editors want room), unless --device names one. */
export const DEFAULT_DEVICE = { webkit: 'iPad Pro 11 landscape', chromium: 'Galaxy Tab S4 landscape' };
/** Launch options per engine for the touch runs (Chromium uses the runner's own). */
export const TOUCH_ARGS = { webkit: {} };

let devices = null;
function loadDevices() {
  if (devices) return devices;
  for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright', `${process.env.npm_config_prefix || ''}/lib/node_modules/playwright`]) {
    try { devices = createRequire(import.meta.url)(p).devices; if (devices) return devices; } catch (e) { /* try next */ }
  }
  throw new Error('Playwright not found');
}
/** { name, options } for a context: the device's viewport, scale, user agent, isMobile and hasTouch. */
export function touchDevice(engine, name, list = null) {
  const all = list || loadDevices();
  const n = name || DEFAULT_DEVICE[engine] || DEFAULT_DEVICE.chromium;
  const d = all[n];
  if (!d) throw new Error(`--device="${n}": not a Playwright device`);
  const { defaultBrowserType, ...options } = d;
  return { name: n, options: { ...options, hasTouch: true } };
}
/** A page for the touch runs carries <meta name="slop-test-touch">. */
export const isTouchPage = (html) => /<meta\s+name="slop-test-touch"/.test(String(html || ''));

/** CDP touch event type for the bridge's type. */
export const CDP_TYPE = { start: 'touchStart', move: 'touchMove', end: 'touchEnd', cancel: 'touchCancel' };
/** The CDP params for one touch op: the fingers still down (none for end/cancel), at whole pixels. */
export function cdpTouch(op) {
  const type = CDP_TYPE[op.type];
  if (!type) throw new Error(`touch type "${op.type}"`);
  const points = op.type === 'end' || op.type === 'cancel' ? [] : (op.points || []).map((p) => ({ x: Math.round(p.x), y: Math.round(p.y), id: p.id, radiusX: 4, radiusY: 4, force: 1 }));
  return { type, touchPoints: points };
}

/** Gives the page its input bridge and tells it how it runs (window.__SLOPTEST_TOUCH__ = { engine, device }). */
export async function touchPage(page, engine, device) {
  let cdp = null;
  if (engine === 'chromium') cdp = await page.context().newCDPSession(page);
  await page.addInitScript((info) => { window.__SLOPTEST_TOUCH__ = info; }, { engine, device, multi: !!cdp });
  await page.exposeFunction('__slopInput', async (op) => {
    if (op.op === 'tap') { await page.touchscreen.tap(op.x, op.y); return true; }
    if (op.op === 'touch' && cdp) {
      // A partial lift: CDP sends touchEnd for the fingers left out of a touchMove's points, so 'end' with fingers
      // still down is a move with the rest.
      const rest = op.rest || [];
      if (op.type === 'end' && rest.length) await cdp.send('Input.dispatchTouchEvent', cdpTouch({ type: 'move', points: rest }));
      else await cdp.send('Input.dispatchTouchEvent', cdpTouch(op));
      return true;
    }
    return false;
  });
}
