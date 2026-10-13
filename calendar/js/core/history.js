// Undo for calendar edits. Each drag move is one step: push(label, undo) records how to reverse it, and undo() runs the
// newest step. Steps live in memory for this visit (most recent last, up to LIMIT). Exposes window.SlopCal.history.
(function (g) {
  'use strict';
  const NS = (g.SlopCal = g.SlopCal || {});
  const LIMIT = 50;
  const steps = [];

  /** Records one step. undo is an async function that reverses it and resolves to a Result. */
  function push(label, undo) {
    steps.push({ label, undo });
    if (steps.length > LIMIT) steps.shift();
  }

  /** Runs the newest step's undo and removes it. Resolves to { ok, label } or { ok: false, message }. */
  async function undo() {
    const step = steps.pop();
    if (!step) return { ok: false, message: 'Nothing to undo.' };
    const r = await step.undo();
    if (!r || !r.ok) return { ok: false, message: (r && r.message) || 'Could not undo that.' };
    return { ok: true, label: step.label };
  }

  NS.history = { push, undo, get size() { return steps.length; } };
})(typeof window !== 'undefined' ? window : globalThis);
