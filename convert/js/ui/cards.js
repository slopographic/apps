/* The hub's conversion cards. One card per converter page in PAGES (core/pages.js, the single list), grouped by
 * category and filtered by the search box. Each card shows the file type on both sides of an arrow, a one-line
 * description, the accepted types and a Convert link to the page. */
import { PAGES } from '../core/pages.js';
import { h } from './dom.js';

export const CATEGORIES = ['Documents', 'Images', 'Data', 'Text & code'];

const accepts = (p) => (p.from.length ? p.from.map((k) => k.toUpperCase()).join(', ') : 'Any file');

function card(p) {
  const [from, to] = p.pair;
  const search = [p.label, from, to, p.cat, p.summary, accepts(p)].join(' ').toLowerCase();
  return h('article', { class: 'cv-pair', 'data-pair': p.slug, 'data-search': search },
    h('div', { class: 'cv-pair-path', role: 'img', 'aria-label': `${from} to ${to}` },
      h('span', { class: 'cv-badge cv-badge-from', 'aria-hidden': 'true' }, from),
      h('span', { class: 'cv-arrow', 'aria-hidden': 'true' }, '→'),
      h('span', { class: 'cv-badge cv-badge-to', 'aria-hidden': 'true' }, to)),
    h('h3', { class: 'cv-pair-title' }, p.label),
    h('p', { class: 'cv-pair-desc' }, p.summary),
    h('p', { class: 'cv-pair-accepts' }, 'Accepts: ', h('span', null, accepts(p))),
    h('a', { class: 'cv-btn cv-primary cv-pair-go', href: `${p.slug}/`, 'aria-label': `Convert: ${p.label}` }, 'Convert'));
}

/** Draws the grouped cards into `root` and wires the search box `search` (an input) and the empty message `empty`. */
export function mountCards(root, { search = null, empty = null } = {}) {
  const groups = CATEGORIES.map((cat, i) => {
    const pages = PAGES.filter((p) => p.cat === cat);
    const id = `cv-cat-${i}`;
    return { cat, pages, section: h('section', { class: 'cv-cat', 'aria-labelledby': id, 'data-cat': cat },
      h('h3', { class: 'cv-cat-h', id }, cat),
      h('div', { class: 'cv-pairs' }, pages.map(card))) };
  });
  root.replaceChildren(...groups.map((g) => g.section));

  const apply = () => {
    const terms = (search ? search.value : '').trim().toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    for (const g of groups) {
      let n = 0;
      for (const c of g.section.querySelectorAll('.cv-pair')) {
        const ok = terms.every((t) => c.dataset.search.includes(t));
        c.hidden = !ok;
        if (ok) n++;
      }
      g.section.hidden = n === 0;
      shown += n;
    }
    if (empty) empty.hidden = shown > 0;
  };
  if (search) search.addEventListener('input', apply);
  apply();
  return { apply, count: () => root.querySelectorAll('.cv-pair').length };
}
