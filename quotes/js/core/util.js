// Slop Quotes: the quote's own words for refusals and its status names; the rest is SlopBiz (shared/biz/biz.js). Classic
// script, loaded after shared/data and shared/biz/biz.js. Exposes window.SlopQuotes.util. Nothing here stores anything.
(function (g) {
  'use strict';
  const S = g.SlopData;
  const NS = (g.SlopQuotes = g.SlopQuotes || {});

  // The quote's own words where they differ from SlopBiz.PLAIN; the data layer's message follows after a colon.
  const PLAIN = { invalid_transition: 'That change is not allowed for this quote', conflict: 'Already converted' };
  const FIELD = { customerId: 'Customer', date: 'Date', validUntil: 'Valid until', lines: 'Lines', notes: 'Notes', currency: 'Currency', status: 'Status' };
  const STATUS = { draft: 'Draft', sent: 'Sent', accepted: 'Accepted', declined: 'Declined' };

  const B = g.SlopBiz;
  /** One readable line for a failed Result, in the words of a quote (SlopBiz.refusal). */
  const refusal = (r) => B.refusal(r, { plain: PLAIN, fields: FIELD });

  NS.util = { PLAIN, FIELD, STATUS, refusal, settings: B.settings, money: B.money, h: B.h, ok: S.result.ok, fail: S.result.fail };
})(typeof window !== 'undefined' ? window : globalThis);
