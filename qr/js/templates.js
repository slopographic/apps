/* QR SLOP: the template gallery. Each template is a kind, default form values and a name with a short description.
 * Only public link formats are used (wa.me, t.me, instagram.com, x.com and so on); the app makes no network calls, and
 * every placeholder (yourhandle, 15550100100, YOUR_PLACE_ID) is for the person to replace. Pure. Classic script; exposes window.QRTemplates. */
(function (g) {
  'use strict';
  if (g.QRTemplates) return;

  const T = (id, group, name, desc, type, values) => ({ id, group, name, desc, type, values });
  const LIST = [
    T('wifi-card', 'Business', 'Wi-Fi card', 'Guests join by scanning the code. WPA2 with a password.', 'wifi',
      { ssid: 'Guest Wi-Fi', security: 'WPA', password: 'welcome-guest', hidden: false }),
    T('contact-card', 'Business', 'Contact card', 'A vCard that saves your name, company and phone to the phone book.', 'vcard',
      { first: 'Alex', last: 'Morgan', org: 'Morgan Studio', title: '', phone: '+1 555 010 0100', email: 'hello@example.com', url: 'https://example.com', street: '', city: '', postal: '', country: '' }),
    T('email-signature', 'Business', 'Email signature', 'For the end of an email: your name, title, company and website.', 'vcard',
      { first: 'Alex', last: 'Morgan', org: 'Example Co', title: 'Head of sales', phone: '+1 555 010 0100', email: 'alex@example.com', url: 'https://example.com', street: '', city: '', postal: '', country: '' }),
    T('review-link', 'Business', 'Review link', 'Sends people straight to your review page. Replace YOUR_PLACE_ID.', 'url',
      { url: 'https://search.google.com/local/writereview?placeid=YOUR_PLACE_ID' }),
    T('restaurant-menu', 'Hospitality', 'Restaurant menu', 'Opens your menu on the table or the door.', 'url',
      { url: 'https://example.com/menu' }),
    T('event', 'Events', 'Event', 'Adds a timed event to the calendar.', 'event',
      { title: 'Open evening', location: 'Main hall', start: '2026-11-14T18:00', end: '2026-11-14T21:00' }),
    T('link-in-bio', 'Social', 'Link in bio', 'One page that holds all of your links.', 'url',
      { url: 'https://example.com/yourname' }),
    T('instagram', 'Social', 'Instagram profile', 'Opens your Instagram profile.', 'url',
      { url: 'https://www.instagram.com/yourhandle/' }),
    T('x-profile', 'Social', 'X profile', 'Opens your profile on X.', 'url',
      { url: 'https://x.com/yourhandle' }),
    T('telegram', 'Social', 'Telegram', 'Opens a Telegram chat with you.', 'url',
      { url: 'https://t.me/yourhandle' }),
    T('whatsapp', 'Social', 'WhatsApp message', 'Opens a WhatsApp chat with a message already typed in.', 'url',
      { url: 'https://wa.me/15550100100?text=' + encodeURIComponent("Hi, I'd like to know more.") }),
  ];

  const byId = (id) => LIST.find((t) => t.id === id) || null;
  /** A fresh copy of a template's kind and values, so the form can change them without touching the gallery. */
  function copy(id) {
    const t = byId(id);
    return t ? { type: t.type, values: JSON.parse(JSON.stringify(t.values)) } : null;
  }

  g.QRTemplates = Object.freeze({ list: () => LIST.slice(), get: byId, copy });
})(typeof window !== 'undefined' ? window : globalThis);
