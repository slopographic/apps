/* The Options box when files have their own targets: one set of options per conversion in use. With one conversion it
 * is the plain list it always was (ids cv-o-<key>); with several, each conversion's options sit under its name (ids
 * cv-o-<conversion>-<key>). Values typed are kept per conversion, so they survive a redraw or a target change. */
import { h } from './dom.js';
import { renderOptions, readOptions } from './options.js';

export class OptionSets {
  constructor(container) { this.el = container; this.store = {}; this.shown = []; this.defaults = {}; }

  save() { for (const s of this.shown) this.store[s.conv.id] = readOptions(s.el, s.conv.options, s.prefix); }

  /** convs: the conversions in use, in list order. defaults: the page's option defaults ({} on the hub). */
  draw(convs, defaults = {}) {
    this.save();
    this.defaults = defaults;
    this.shown = [];
    const fieldset = this.el.closest('fieldset');
    const val = (c) => ({ ...defaults, ...(this.store[c.id] || {}) });
    this.el.classList.toggle('cv-opts-multi', convs.length > 1);   // the sets stack, each its own grid of options
    if (convs.length <= 1) {
      const c = convs[0];
      renderOptions(this.el, c ? c.options : [], c ? val(c) : defaults);
      if (c) this.shown.push({ conv: c, el: this.el, prefix: '' });
      return;
    }
    this.el.replaceChildren();
    for (const c of convs.filter((x) => x.options.length)) {
      const body = h('div', { class: 'cv-opts-body' });
      const hid = `cv-oset-${c.id}`;
      this.el.append(h('div', { class: 'cv-opt-set', role: 'group', 'aria-labelledby': hid }, h('p', { class: 'cv-opt-set-h', id: hid }, c.label), body));
      renderOptions(body, c.options, val(c), `${c.id}-`);
      this.shown.push({ conv: c, el: body, prefix: `${c.id}-` });
    }
    if (fieldset) fieldset.hidden = !this.shown.length;
  }

  /** The option values for a conversion: what is on screen, else what was kept, else its defaults. */
  read(conv) {
    if (!conv) return {};
    const s = this.shown.find((x) => x.conv.id === conv.id);
    if (s) return readOptions(s.el, conv.options, s.prefix);
    const out = {};
    for (const o of conv.options) out[o.key] = o.value;
    return { ...out, ...this.defaults, ...(this.store[conv.id] || {}) };
  }
}
