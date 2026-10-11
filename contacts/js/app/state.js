/* Slop Contacts: shared app state and events. Exposes SlopContacts.state (S) and the event bus:
 *   S.on('change', fn)  the list or file changed (autosave, SlopGuard and re-render listen)
 *   S.on('render', fn)  view only (selection, filter, search)
 * The list is always normalised contacts. Changing the list through setList() marks the file dirty. */
(function () {
  'use strict';
  const SC = (window.SlopContacts = window.SlopContacts || {});
  const CC_KEY = 'slop-contacts.cc';
  const readCc = () => { try { return localStorage.getItem(CC_KEY) || ''; } catch (e) { return ''; } };
  const subs = {};

  const S = {
    list: [],                 // contacts
    sel: new Set(),           // selected ids
    query: '',               // search text
    group: null,              // null = all, '' = ungrouped, otherwise a group name
    cc: readCc(),             // default country code for E.164 (per viewer, also kept in the draft)
    file: { name: 'Contacts', driveId: null, folderId: null, dirty: false },
    ready: false,
    on(type, fn) { (subs[type] = subs[type] || []).push(fn); return () => { subs[type] = (subs[type] || []).filter((f) => f !== fn); }; },
    emit(type, data) { for (const fn of (subs[type] || []).slice()) { try { fn(data); } catch (e) { console.error(e); } } },
    byId: (id) => S.list.find((c) => c.id === id) || null,
    /** Contacts shown now: the group filter, then the search (every word must match). */
    visible() {
      const words = S.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
      return S.list.filter((c) => {
        if (S.group === '' && c.groups.length) return false;
        if (S.group && !c.groups.includes(S.group)) return false;
        if (!words.length) return true;
        const hay = SC.model.haystack(c);
        return words.every((w) => hay.includes(w));
      });
    },
    selected: () => S.list.filter((c) => S.sel.has(c.id)),
    /** Ids for a bulk action: the selection when there is one, else null (= every contact). */
    scope: () => (S.sel.size ? new Set(S.sel) : null),
    groupCounts() {
      const map = new Map();
      let none = 0;
      for (const c of S.list) {
        if (!c.groups.length) none++;
        for (const g of c.groups) map.set(g, (map.get(g) || 0) + 1);
      }
      return { all: S.list.length, none, groups: [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: 'base' })) };
    },
    /** Replace the whole list. dirty = true for user changes; false for a file just opened. */
    setList(list, { dirty = true } = {}) {
      S.list = list.map(SC.model.normalise);
      S.sel = new Set([...S.sel].filter((id) => S.list.some((c) => c.id === id)));
      if (S.group && !S.groupCounts().groups.some(([g]) => g === S.group)) S.group = null;
      S.file.dirty = dirty ? true : S.file.dirty;
      S.emit('change');
      S.emit('render');
    },
    /** Put changed contacts back into the list by id (a copy of the list, same order). */
    replaceMany(updated) {
      const byId = new Map(updated.map((c) => [c.id, c]));
      S.setList(S.list.map((c) => byId.get(c.id) || c));
    },
    setSel(ids) { S.sel = new Set(ids); S.emit('render'); },
    setCc(v) { S.cc = String(v || '').trim(); try { localStorage.setItem(CC_KEY, S.cc); } catch (e) { /* blocked */ } S.emit('change'); },
  };
  SC.state = S;
})();
