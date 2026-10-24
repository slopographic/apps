# Touch and pen (window.SlopTouch)

One layer that makes every app work with a finger or a pen, on iOS (Safari, WebKit) and Android (Chrome). The apps keep
their mouse code: they already use pointer events, and the layer turns the touch gestures into the events the apps
already handle. Loaded on every app page by the shell (`shell/shell.js`); pages without the shell (Paint Classic, Image
to 3D, Sheet view) load the three scripts and the CSS themselves.

| file | what |
| --- | --- |
| `gesture.js` | pure recognizer: tap, double tap, long press, two-finger pinch/pan, from pointer samples and times (`SlopTouch.gesture`; Node-tested in `tests/node/touch-gesture.test.mjs`) |
| `events.js` | DOM helpers: `SlopTouch.surface`, `.hit`, `.coarse`, and the synthetic events (`SlopTouch.events`) |
| `touch.js` | the wiring: window capture listeners, dedupe, palm rejection (`SlopTouch.ready`) |
| `touch.css` | surfaces (`[data-touch-surface]`), `--slop-hit`, `.slop-hit` / `[data-touch-hit]` |

## What a finger does

| gesture | the app gets | notes |
| --- | --- | --- |
| tap | the browser's own click | `html { touch-action: manipulation }`: no 300 ms delay, no double-tap page zoom (pinch still zooms the page) |
| double tap (≤ 300 ms between, ≤ 24 px apart, each ≤ 10 px of wobble) | a `dblclick` MouseEvent at the point, after the second click | iOS sends none. Chrome on Android sometimes sends its own: if it comes first the layer sends none; if after, it is swallowed. Never in a text field (the system selects a word) |
| long press (500 ms, ≤ 10 px) | a `contextmenu` MouseEvent (button 2) at the point | iOS sends none; Chrome on Android sends its own, then the layer sends none (or swallows the browser's if ours went first). If the app prevented it (opened a menu), the click when the finger lifts is swallowed so it does not hit a menu item. Never in a text field |
| two fingers on a surface that zooms | its `zoom(scale, cx, cy)` / `pan(dx, dy)` hooks, or wheel events | the app's one-finger drag gets a `pointercancel` and the fingers' pointer events stop reaching it until they lift |
| pen down | pressure on the pointer events as usual (Apple Pencil, S Pen); touches are ignored until 400 ms after it lifts | a finger already down when the pen lands (the palm) gets a `pointercancel` |

Every synthetic event has `e.slopTouch === true` (and `isTrusted === false`).

The dblclick is dispatched inside the second tap's click (after the app's own click handlers, in the same dispatch), so
it runs in a user gesture: an editor it opens can focus and iOS shows the keyboard. iOS does not for a focus from a timer,
so an app that opens a text field from its own double-tap detection does it in the pointerdown/up (Tables, Slop PDF).

## Surfaces

An editing surface is anything the person drags on: a canvas, a page view, a timeline, an editor. Mark it:

```html
<div id="stage" data-touch-surface="wheel"></div>
```
```js
SlopTouch.surface(stage, { zoom(scale, cx, cy) { view.zoomAt(scale, cx, cy); }, pan(dx, dy) { view.panBy(dx, dy); } });
```

The CSS then sets `touch-action: none` (a drag is never a scroll, so no `pointercancel` mid-drag), no iOS callout, no
text selection, `overscroll-behavior: contain` (no pull-to-refresh), and iOS's `gesturestart` there is prevented. Text
fields and contenteditable inside a surface stay selectable. Everything else on the page scrolls and zooms as normal.

| attribute value / option | two fingers |
| --- | --- |
| `""` / no options | nothing (the page does not zoom there either) |
| `"wheel"` / `{ wheel: true }` | pinch → Ctrl+wheel, `deltaY = -100·ln(scale)` (as Chrome and Safari send a trackpad pinch); pan → plain wheel, deltas against the fingers |
| `"wheel-zoom"` / `{ wheel: 'zoom' }` | only the pinch, as Ctrl+wheel (for a 3D view whose plain wheel zooms) |
| `"nav"` / `{ nav: true }` | left to the surface's SlopNav engine (`shared/nav`), which has its own pinch and pan (PhotoSlop, SlopVector, Slop PDF) |
| `{ zoom, pan }` | the hooks, in client pixels, scale since the last call |

The shell loads the layer after the page's own scripts may have run, so app code does not wait for it: it sets the
attribute itself, and for hooks the element's `touchSurface` property (`el.touchSurface = { zoom, pan }`), which the layer
reads when two fingers land. `SlopTouch.surface(el, opts)` does both, when the layer is there.

Use the hooks when the app's wheel zoom is tuned to mouse notches (a pinch through it would crawl or jump).

## Hit areas

`--slop-hit` is 0 for a mouse and 44 px under `(pointer: coarse)` (`--slop-hit-r` half). A DOM handle grows invisibly with
`class="slop-hit"` or `data-touch-hit` (an `::after` of at least 44 × 44 px; the handle must be positioned, and must not
use its own `::after`), or uses the variable in its CSS (`min-width: var(--slop-hit)`, or a transparent border).
Handles drawn on a canvas or in SVG use `SlopTouch.hit(e, r)` in their hit test: the radius r for a mouse, at least
22 px for a finger and 12 for a pen (CSS pixels: divide by the zoom for document units).

## The apps

| app | surface (two fingers) | notes |
| --- | --- | --- |
| Slop PDF | `#viewer`, `nav` (SlopNav pinches) | its own double-tap on annotations (pointer.js); handles 44 px (workspace.css); signature pad a surface |
| PhotoSlop | `#viewport`, `nav` | handles, guides and the curve dialog grab from a finger's reach; a long press opens the canvas menu and drops the stroke; pressure from the pen (core/view.js) |
| Paint Classic | `#wrap`, hooks stepping its zoom levels | no shell: loads the layer itself; a long press on a swatch is its menu |
| SlopVector | stage, `nav` | handle and anchor radius by `SlopTouch.hit`; pencil records pressure |
| Slop Press, Label, Nodes, Slop 3D, Image to 3D, Drive's 3D preview and graph, SlopIsolate | hooks (`touchSurface`) | Label pans with one finger on empty stage |
| SlopCut, Effects, Projects | timelines are surfaces; pinch zooms, pan scrolls | trim edges and keys 44 px |
| Slides | slide canvas | handles from 22 px; double tap edits text |
| Tables | headers and the selection knob only | a finger drag on cells scrolls them (as phone spreadsheets do); the knob extends the selection; double tap edits (in the gesture) |
| Docs | none on the page (it scrolls) | the caret moves on the tap's lift; header/footer open on a double tap |
| Drive, Gallery, Music, Calendar, Hex, Code, Contacts | grips, waves and draggable chips only | lists keep scrolling; long press selects and opens the menu (Drive), starts a range (Hex) |

## Android back

The shared sheets and dialogs (`shared/ui/sheet.js`, `SlopUI.dialog`) do not push history entries, so the back button
or gesture leaves the page as it always did; the layer adds none. A pull-to-refresh cannot start on a surface
(`overscroll-behavior: contain`).

## Rules (tools/check-rules.mjs, rule 3)

- App scripts use pointer events: a `'mousedown'`/`'mousemove'`/`'mouseup'` listener is refused unless the line has a
  `touch-ok: <why>` comment (a `mousedown` whose only job is `preventDefault()` to keep the focus is fine: browsers send
  it after a tap too).
- A script that drags (`setPointerCapture`) marks its surface: `data-touch-surface`, `SlopTouch.surface`, or
  `touch-action` in its own code, or a `touch-ok:` comment that says where it is marked.

## Tests

- `tests/node/touch-gesture.test.mjs`: the recognizer's timings, distances and cancel rules.
- `tests/shared/touch.test.html`: the layer on a page (dblclick, contextmenu, wheel, hooks, palm rejection).
- Pages marked `<meta name="slop-test-touch">` also run on touch tablets: `node tests/run.mjs --touch --browser=webkit`
  (an iPad, Safari's engine) and `--browser=chromium` (an Android tablet; real multi-touch by CDP). `--device="iPhone 15"`
  picks another Playwright device. CI runs both (`.github/workflows/rules.yml`, job `touch`). In the test pages,
  `tests/shared/touch-kit.js` (`TouchKit.tap/doubleTap/longPress/drag/pinch/pan2`) sends real touches where the engine
  can (a tap in WebKit, everything in Chromium) and touch pointer events from the page where it cannot.
- Locally WebKit runs in CI's image: `podman run --rm -v $PWD:/w -w /w mcr.microsoft.com/playwright:v1.64.1-noble node tests/run.mjs <page> --touch --browser=webkit --skip-node`.
