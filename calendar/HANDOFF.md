# Slop Calendar: handoff

Month, week, day and agenda views over the shared store. Events, the To-do tasks layer, repeats, time zones, reminders,
.ics import and export, a config kind, and CRM links. Nothing is uploaded. Registry id `calendar` (shared/apps.js).

## Files
- `index.html`, `css/calendar.css`: the page. Every script is loaded in dependency order at the bottom.
- `js/core/model.js` (`SlopCal.model`): loads events (repeats expanded) and open tasks for a range of viewer days.
  Each item keeps its own zone, so the view can show the viewer's time and the event's time.
- `js/ui/app.js` (`SlopCal.app`): period, view, viewer zone (saved in localStorage), task toggle, redraw on store changes.
  On a phone (640 px or less) the week and day views show the agenda.
- `js/ui/month.js`, `timegrid.js` (week and day), `agenda.js`, `chip.js` (blocks and column layout), `drag.js` (move and resize).
- `js/ui/editor.js` (the event dialog), `ics-ui.js` (export, and import with a preview), `commands.js` (SlopCmd), `js/config.js`.
- Shared, pure and node-testable: `shared/calendar/tz.js` (SlopTime), `rrule.js` (SlopRecur), `ics.js` (SlopIcs),
  `store.js` (SlopEvents: form to record, record to form, save, patch, remove).

## Data (shared store, DB version 4)
- `events`: timed events keep `start` and `end` (epoch ms) and `tz`. All-day events keep `startDay` and `endDay` (inclusive).
  `freq` (none, daily, weekly, monthly, yearly), `until` (day, inclusive), `remind` (minutes before), `kind` (event, call,
  meeting), `customerId`, `uid`.
- `tasks`, `reminders`: see `todo/HANDOFF.md` and `reminders/HANDOFF.md`.
- Upgrade: `DB_VERSION` 3 to 4 in `shared/data/store.js`; `createStores` adds the three collections, and no record changes.
  `schema-defs.js` gains the three collections and their checks. `bundle-check.js` reads older backups as empty for them.

## Time zones (Intl only)
- `SlopTime.wallToUtc(y, mo, d, h, mi, zone)` converts a wall-clock reading to an instant; `parts(ms, zone)` reads one back.
  Nothing is downloaded. The zone list is `Intl.supportedValuesOf('timeZone')` where it exists.
- A timed event is saved as an instant plus its zone. The editor shows the start in the event's zone and in the viewer's zone.
  A drag works out the new time on the viewer's wall clock, then saves the instant in the event's zone.

## Repeats (`shared/calendar/rrule.js`)
- Daily, weekly, monthly, yearly, with an inclusive end day. Dates step on the event's own wall clock, so a 09:00 weekly event
  stays at 09:00 across daylight saving. Monthly and yearly repeats skip dates that do not exist (31 February, 29 February).
- Dragging or resizing a repeating event changes the whole series. Single-occurrence exceptions are not supported.

## .ics (RFC 5545 subset, `shared/calendar/ics.js`)
- Written: VEVENT with UID, DTSTAMP, DTSTART, DTEND, SUMMARY, LOCATION, DESCRIPTION, RRULE (FREQ with UNTIL), VALARM (DISPLAY,
  as minutes before), and X-SLOP-COLOR and X-SLOP-KIND. Timed events use TZID with no VTIMEZONE block, and all-day events use
  VALUE=DATE. Lines fold at 75 octets.
- Read: the same, plus UTC and floating times (floating uses the viewer's zone). INTERVAL other than 1 and BY* parts are not kept:
  the import warns and repeats by FREQ alone. Unknown RRULE forms import once, with a warning.
- Import shows a preview first: how many will be added, how many are skipped because their UID is already here, and the
  warnings. Nothing is written until the person confirms, and the write is one transaction.

## Config kind `calendar` (shared/config, app `calendar`)
- `events`: a list. Times are written as the reading in the event's zone (`startLocal` as `YYYY-MM-DDTHH:MM`, plus `tz`).
  Import validates first (zones, dates, end after start), then adds in one transaction. It never changes existing events.

## Reminders
- Event reminders come from `remind`, per occurrence. The popup is `SlopReminderEngine` (`shared/reminders/engine.js`).
  Snooze and dismiss are written to `reminders`. See `reminders/HANDOFF.md`.

## CRM
- Customer detail: Schedule adds a call or meeting event linked to the customer (`crm/js/ui/detail.js`).
- Follow-ups: lists the next 60 days of linked events (repeats expanded), and open linked tasks (`crm/js/ui/followups.js`).

## Keys and commands (SlopCmd)
- Left and Right arrows move the period. `t` today, `m`, `w`, `d`, `a` for the views, `n` new event, `k` shows or hides to-dos.
- Palette (Ctrl+K) lists every command, including "Go to Slop To-do", "Go to Slop Reminders" and "Go to Slop CRM".
- Keys are plain letters, so they work outside text fields only (SlopCmd rules).

## Tests
- `node tests/run.mjs calendar`: `tests/node/calendar-recurrence.test.mjs` (recurrence, .ics round trip and import warnings,
  time zone conversion, fixed dates) and `tests/calendar/calendar.test.html` (a weekly event made in the editor, linked to a
  customer, repeats four times in the week view, and shows in the CRM follow-ups).

## Not done or not checked
- Drag and resize have no automated test. They were not checked by hand on a phone.
- Deleting an event leaves its reminder rows behind (harmless, but they are not swept).
- Reminders show only while a tab is open. There is no background scheduling.
