# shared/video: the video core (window.SlopVideo)

One copy of the pure layout and random-edit logic, used by SlopCut (`slopcut/`) and Reel Remix (`remix/`).
Classic scripts, no DOM except the lane widget, no fetch, no storage. Each file attaches to `window.SlopVideo`.

## Files and load order

| File | Namespace | What it is |
|---|---|---|
| `seed.js` | `SlopVideo.seed` | mulberry32 `rng(seed)`, `make()`, `parse(text)` (hex or any text), `hex()`, `shuffle()`. |
| `presets.js` | `SlopVideo.presets` | Frame size presets (`LIST`), `aspectSize('16:9'…)`, `size(id, w, h)`, `choices()`, `idFor(w, h)`, `clamp()`. |
| `grid.js` | `SlopVideo.grid` | `grid(rows, cols, {gap, border})` equal cells as fractions; `parse('1x3')`; `id(rows, cols)`; `specs()`. |
| `templates.js` | `SlopVideo.templates` | The named templates (Single, Split horizontal, Split vertical, Picture-in-picture, Grid 2×2, Grid 3×3, Three-up, Vertical reel) in `list`; `get(id)` also resolves any grid id; `grid()`, `region()`, `slotCount()`, `label()`, `tiles()`. |
| `layout.js` | `SlopVideo.layout` | `fit(frame, media, region)`: the transform that letterboxes a picture into a region. `trackOf(slot)`. |
| `segments.js` | `SlopVideo.segments` | Layout switches over time: `clean`, `norm(list, total)`, `at(segs, t)`, `add`, `move`, `remove`, `maxSlots`. All pure. |
| `random-edit.js` | `SlopVideo.random` | `plan(opts, media)` (pure), `norm`, `usable`, `switches`, `regionFor(plan, item)`. |
| `lane-view.js` | `SlopVideo.laneView` | The Layout lane widget: `mount(host, {label, onCommit, onSeek})` returns `update({duration, switches, layouts, playhead})`. |
| `lane.css` | | Styles for the lane (uses `--sui-*` tokens when present). |

Load order matters only in that `presets.js` precedes `templates.js` and `segments.js` precedes `random-edit.js`.

## Layout notation

- **`RxC` is rows × columns.** `1x3` is one row of three equal columns (the spec's "three equal columns"); `3x1` is three
  stacked rows; `2x3` is two rows of three columns (six slots). Template ids are `grid-RxC`; bare `RxC` also resolves.
- Each grid axis is 1 to `grid.MAX` (4). Slot i is cell i, row by row, left to right. Slot i lives on video track i (V(i+1) in SlopCut).
- `gap` and `border` are fractions of the frame (max 0.2 and 0.3).

## Frame presets

`presets.LIST`: Phone vertical 1080×1920 (9:16), Square 1080×1080, Landscape 1920×1080 (16:9), 4K landscape 3840×2160,
Portrait 1080×1350 (4:5). Custom width and height are clamped to even numbers (16 to 7680 × 4320). `aspectSize('16:9')`
gives the landscape preset, `'9:16'` the phone one, `'1:1'` the square one, so existing aspect choices use these presets.

## Segments (layout switches over time)

A timeline's layout is a list of switches `{ start, layout }` (layout = a template id). Each holds until the next one.
`segments.norm(list, total)` gives `{ start, end, layout, slots }` covering `[0, total)`. The random edit plans by segment:
a beat never crosses a switch, so every cut uses the slots of the layout active at its start.

## The plan

`random.plan(opts, media)` returns `null` when nothing is usable, otherwise `{ seed, seedHex, target, pace, aspect, size,
tpl, switches, layouts, segments, slots, cuts, total, clips, used }`. `cuts` is a list of beats; a beat is a list of
`{ media, slot, start, dur, in }`.

- Layout source, in order: `opts.segments` (manual switches), else `opts.switches` (random switch points drawn from
  `opts.layouts`, lengths from the pace: fast 2–4 s, medium 4–8 s, slow 6–12 s, never the same layout twice in a row when
  avoidable), else `opts.tpl` over the whole length. `tpl: 'random'` draws one grid from `layouts` with the seed.
- `size` (optional `{w, h}`) is the sequence size; without it the app uses `aspect`.
- Same seed, options and media (sorted by name, so import order does not matter) give the same plan.
- No clip repeats within a beat, and none repeats until every clip is used (when there are enough).

## Tests

`tests/node/slopedit-video-core.test.mjs` (run with `node tests/run.mjs slopedit`): grid 1x3 is three equal columns with no
overlap; 4x4 gives 16 regions; gap and border stay inside and do not overlap; a custom 2x3 fills six slots; the named
template ids are unchanged; 1920×1080 is 16:9 and 1080×1920 is 9:16; the same seed gives the same plan; a 1x1 then 1x3
switch puts one clip in the first span and three in the second; random switches draw from the list and cover the length;
switch edits are pure; `fit` letterboxes.

## Using it

```js
const SV = window.SlopVideo;
const plan = SV.random.plan({ seed: 1, target: 30, pace: 'medium', size: SV.presets.get('landscape'), layouts: ['grid-1x2', 'grid-2x2'], switches: true }, clips);
const region = SV.random.regionFor(plan, plan.cuts[0][0]);   // where that cut goes
const t = SV.layout.fit({ w: 1920, h: 1080 }, { w: clip.w, h: clip.h }, region);
```

Keep the signatures stable: SlopCut's `io/reel.js` and the Remix manifest replay (`remix` options in a Drive manifest) call `plan`.

## Limits

No audio, no transitions, no keyframes: the core only decides cuts, slots, regions and sizes. Clip durations come from the
app (`dur` on each media item; stills use `Infinity`). The lane widget needs `document` and is not loaded in Node.
