// The touch mode of the test runner (tests/touch.mjs): which pages run, on which device, and the CDP touches it sends.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { touchDevice, isTouchPage, cdpTouch, DEFAULT_DEVICE } from '../touch.mjs';

const list = {
  'iPad Pro 11 landscape': { viewport: { width: 1194, height: 834 }, isMobile: true, hasTouch: true, defaultBrowserType: 'webkit' },
  'Galaxy Tab S4 landscape': { viewport: { width: 1138, height: 712 }, isMobile: true, hasTouch: true, defaultBrowserType: 'chromium' },
  'Phone': { viewport: { width: 400, height: 800 }, defaultBrowserType: 'chromium' },
};

test('only pages with the slop-test-touch meta run in touch mode', () => {
  assert.ok(isTouchPage('<head><meta name="slop-test-touch"></head>'));
  assert.ok(isTouchPage('<meta name="slop-test-touch" content="">'));
  assert.ok(!isTouchPage('<meta name="slop-test-limit" content="9">'));
  assert.ok(!isTouchPage(''));
});

test('WebKit runs as an iPad and Chromium as an Android tablet, with touch on; --device picks another', () => {
  assert.equal(touchDevice('webkit', null, list).name, DEFAULT_DEVICE.webkit);
  assert.equal(touchDevice('chromium', null, list).name, DEFAULT_DEVICE.chromium);
  const d = touchDevice('chromium', 'Phone', list);
  assert.equal(d.options.hasTouch, true);
  assert.equal(d.options.defaultBrowserType, undefined);
  assert.throws(() => touchDevice('webkit', 'Nokia 3310', list), /not a Playwright device/);
});

test('CDP touches: whole-pixel points for start and move, none for end and cancel', () => {
  assert.deepEqual(cdpTouch({ type: 'start', points: [{ id: 1, x: 10.4, y: 20.6 }] }).touchPoints.map((p) => [p.id, p.x, p.y]), [[1, 10, 21]]);
  assert.equal(cdpTouch({ type: 'move', points: [{ id: 1, x: 0, y: 0 }, { id: 2, x: 5, y: 5 }] }).type, 'touchMove');
  assert.deepEqual(cdpTouch({ type: 'end', points: [{ id: 1, x: 0, y: 0 }] }), { type: 'touchEnd', touchPoints: [] });
  assert.throws(() => cdpTouch({ type: 'wiggle' }));
});
