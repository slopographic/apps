# Slop 3D: handoff

A browser 3D editor for simple models and scenes. Nothing is uploaded: files open from disk or Slop Drive, save to
Slop Drive, and download. Status in `shared/apps.js` is `building`, group `creative`.

## Renderer decision

- **three.js r170, vendored** in `vendor/three/three.module.min.js`, loaded with a dynamic `import()` relative to the page.
  No CDN. Licence: MIT (`vendor/three/LICENSE`, © 2010–2024 three.js authors). The page never fetches it from the network.
- The vendored build has no addons for orbit controls, transform controls, GLTF/OBJ loaders or exporters, so:
  - **Camera**: our own orbit, pan, zoom, frame and numbered views (`js/render/camera.js`).
  - **Move gizmo**: our own three coloured arrows that drag along an axis, snapped (`js/render/gizmo.js`).
  - **OBJ and glTF/GLB import**: our own parsers, pure JS (`js/core/obj.js`, `js/core/glb.js`).
  - **OBJ export**: our own writer (`js/core/obj.js`). **GLB export is not done** (no exporter vendored).
- Shading is `MeshStandardMaterial` (smooth normals, roughness, metallic, opacity, optional embedded image texture).
  Lights are real three.js lights built from the scene's light nodes.

## Files

- `index.html`, `css/app.css`, `css/panels.css`: the page (topbar, outliner, viewport, inspector, status line).
- `js/core/` (pure, no DOM, loads in Node): `xform.js` (4×4 maths, Euler XYZ in degrees), `snap.js`, `geometry.js`
  (primitives as parameters), `blob.js` (icosphere plus value noise, seeded), `model.js` (scene and tree), `ops.js`
  (duplicate, group, ungroup, reparent, move, set field, bounds), `history.js` (snapshot undo with merge keys),
  `format.js` (.s3d serialise, parse and validate), `obj.js`, `glb.js`.
- `js/render/` (three.js): `stage.js` (renderer, loop, picking, PNG capture), `camera.js`, `objects.js` (scene to
  three objects, synced by id), `gizmo.js`.
- `js/app/` (UI): `state.js`, `actions.js` (every edit goes through `commit`), `viewport.js`, `outliner.js`,
  `inspector.js`, `menus.js` (right-click menus), `commands.js` (SlopCmd ids `3d.*`), `files.js`, `main.js`.
- Tests: `tests/node/3d-*.test.mjs` (pure logic, via `tests/node/3d-env.mjs`), `tests/3d/app.test.html` with `3d.spec.js`
  (browser, same-origin iframe of the real app; WebGL tests report skipped when the browser has no WebGL).

## The .s3d format (version 1)

The file is the scene JSON itself, UTF-8, with `"format": "slop-3d"` and `"version": 1`.

```
{ format, version, name, seq, background: "#rrggbb", roots: [id…],
  nodes: { id: { id, type: "mesh"|"group"|"light", name, visible, parent: id|null,
                 transform: { p: [x,y,z], r: [x,y,z] /* degrees, XYZ */, s: [x,y,z] },
                 geom:     { kind: "cube"|"plane"|"sphere"|"cylinder"|"cone"|"torus"|"blob", …params }   // mesh
                           | { kind: "mesh", positions: [], normals?: [], indices: [] }                   // imported mesh
                 material: { color, roughness, metallic, opacity, map?: "data:image/…" }                 // mesh
                 children: [id…]                                                                         // group
                 light:    { kind: "directional"|"ambient", color, intensity }                           // light
  } } }
```

- Parameters: sizes in scene units; `segments` 3–256, `rings` 2–256, `sides` 3–128, `detail` 0–5, `seed` integer.
- Reading: `format.parse(text)` returns `{ ok: true, scene }` or `{ ok: false, errors: [...] }`. It never throws.
  A newer `version` is refused with a clear message, so nothing is half-read.
- Writing: `format.serialize(scene)`. Round trips are exact (tested).

## What works

- Viewport: orbit (drag), pan (Shift-drag or middle drag), zoom (wheel), frame selection (F, double-click), frame all
  (Home), numbered views 1 front, 2 top, 3 side, 4 perspective, wireframe (W), grid (G), axes.
- Primitives: cube, sphere, cylinder, cone, torus, plane, blob, created at the origin, plus groups and lights (sun and
  ambient). Shape parameters are editable in the inspector.
- Edit: duplicate (Ctrl+D), delete, group and ungroup (Ctrl+G / Ctrl+Shift+G), undo and redo (Ctrl+Z, Ctrl+Shift+Z),
  select all, hide or show (H), rename (F2 or double-click in the outliner).
- Transform: move by the gizmo arrows (snapped to the Snap step), numeric position, rotation (degrees) and scale
  fields, arrow keys to nudge on X and Z, Shift+Up/Down for Y (the step is the Snap step, or 0.1 when Snap is off).
- Materials: colour picker, roughness, metallic, opacity. Lights are edited the same way as objects.
- Outliner: a tree with eye toggles, click, Shift or Ctrl selection (synced with the viewport), drag onto a group to
  put inside, onto an edge to reorder.
- Right-click on an object: duplicate, delete, group, ungroup, frame, hide, rename, add. On empty space: add, select all,
  views, toggles, undo and redo.
- Import: OBJ (one mesh per object), glTF 2.0 .gltf (embedded data URIs) and .glb (triangle primitives, node hierarchy,
  base colour), and images (a standing textured plane, image stored inside the file, 8 MB limit). From disk or Slop Drive.
- Export: .s3d (Save to Slop Drive, or download), OBJ, PNG at 1× or 2× of the viewport.
- Slop Drive: `?drive=<id>` opens a record; Save updates the linked record or asks for a folder.
- SlopCmd palette and shortcuts, SlopCtx right-click menus, SlopUI dialogs and toasts, SlopGuard unsaved-work warning.

## What is missing

- Rotate and scale gizmos (use the numeric fields).
- GLB export (no exporter in the vendored three.js).
- Boolean operations, sculpting, animation, UV editing, materials beyond the four values plus an image.
- Multi-object inspector editing (the inspector shows the last selected object).
- Snapping for typed values (only gizmo drags and nudges snap). Camera moves are not in the undo history.
- Clicking a child in the viewport selects the child; select the group in the outliner to move the whole group.

## Notes

- Opening or importing a model from disk or Drive creates a new scene that keeps the model and is marked unsaved.
- Memory: every edit clones the scene as JSON (simple, exact undo). Very large imported meshes (millions of triangles)
  will be slow to edit.
