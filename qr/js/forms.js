/* QR SLOP: the form for each kind of code. FIELDS lists the inputs of each type; draw() builds them with SlopUI's controls
 * and reports every change through onInput(key, value). Classic script; exposes window.QRForms. */
(function (g) {
  'use strict';
  if (g.QRForms) return;

  const F = (k, label, extra = {}) => Object.assign({ k, label, kind: 'text' }, extra);
  const PHONE = '+1 555 010 0100';
  const FIELDS = {
    text: [F('text', 'Text', { kind: 'textarea', ph: 'Any text, up to about 2,900 bytes' })],
    url: [F('url', 'Web address', { kind: 'url', ph: 'https://example.com' })],
    email: [F('to', 'To', { kind: 'email', ph: 'name@example.com' }), F('subject', 'Subject'), F('body', 'Message', { kind: 'textarea' })],
    phone: [F('number', 'Phone number', { kind: 'tel', ph: PHONE })],
    sms: [F('number', 'Phone number', { kind: 'tel', ph: PHONE }), F('message', 'Message (optional)', { kind: 'textarea' })],
    wifi: [
      F('ssid', 'Network name (SSID)'),
      F('security', 'Security', { kind: 'select', def: 'WPA', options: [['WPA', 'WPA / WPA2'], ['WEP', 'WEP'], ['nopass', 'None (open network)']] }),
      F('password', 'Password', { kind: 'password' }),
      F('hidden', 'Hidden network', { kind: 'check' }),
    ],
    vcard: [
      F('first', 'First name'), F('last', 'Last name'), F('org', 'Organisation'), F('title', 'Job title'),
      F('phone', 'Phone', { kind: 'tel' }), F('email', 'Email', { kind: 'email' }), F('url', 'Website', { kind: 'url' }),
      F('street', 'Street'), F('city', 'City'), F('postal', 'Postal code'), F('country', 'Country'),
    ],
    geo: [F('lat', 'Latitude (-90 to 90)', { kind: 'number', ph: '48.8584' }), F('lng', 'Longitude (-180 to 180)', { kind: 'number', ph: '2.2945' })],
    event: [
      F('title', 'Title'), F('location', 'Location'),
      F('start', 'Starts', { kind: 'datetime-local' }), F('end', 'Ends (optional)', { kind: 'datetime-local' }),
    ],
  };

  /** The value a field shows when nothing is stored yet. */
  function initial(f, values) {
    if (values[f.k] !== undefined) return values[f.k];
    if (f.def !== undefined) return f.def;
    return f.kind === 'check' ? false : '';
  }

  /** Draws the fields of one type into host. values is the stored object for that type; it is filled in as the person types. */
  function draw(host, type, values, onInput) {
    const E = g.SlopUI.el;
    host.replaceChildren();
    for (const f of FIELDS[type] || []) {
      const cur = initial(f, values);
      if (f.kind === 'check') {
        const c = g.SlopUI.check(f.label, cur);
        c.input.addEventListener('change', () => onInput(f.k, c.input.checked));
        host.append(c.el);
        continue;
      }
      let input;
      if (f.kind === 'select') input = g.SlopUI.select(f.options, cur);
      else if (f.kind === 'textarea') input = E('textarea', { class: 'sui-input', rows: 3, placeholder: f.ph || '', spellcheck: 'false' });
      else input = E('input', { class: 'sui-input', type: f.kind, placeholder: f.ph || '', autocomplete: 'off', spellcheck: 'false' });
      input.value = cur;
      input.addEventListener(f.kind === 'select' ? 'change' : 'input', () => onInput(f.k, input.value));
      host.append(g.SlopUI.field(f.label, input));
    }
  }

  g.QRForms = Object.freeze({ FIELDS, draw });
})(typeof window !== 'undefined' ? window : globalThis);
