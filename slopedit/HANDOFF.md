# SlopEdit — handoff

In-browser video editor at `/slopedit/` (registry id `slopedit`). Work in progress; see the step list below.

## Status
1. Media bin: done (import via picker, drag and drop, Slop Drive; thumbnails, duration, waveforms).
2. Timeline: in progress.

## Layout
`js/core` model/history/edit, `js/media` analysis and library, `js/ui` shell, bin, menus, commands, `js/io` session/synth/sample.
Vendored: `vendor/mp4-muxer` (MIT), `vendor/webm-muxer` (MIT).
