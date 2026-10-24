// How the apps run, said once and in plain words: every Slopographic app works right in the browser on a phone, tablet
// or computer, with nothing to install, and keeps working offline after the first visit (the offline worker,
// service-worker.js, mounted by shell/shell.js through shared/pwa.js). It can also be added to a home screen or desktop
// (manifest.webmanifest). Used by the app pages (tools/seo/landing.mjs), the task FAQs and the round-ups
// (shared/seo/roundups/*.mjs); how-it-works/index.html says the same in its own words.
export const INSTALL = {
  /** A table value for rows like "Mobile app" and "Desktop app". */
  short: 'Works in the browser',
  /** A pro in a round-up. */
  pro: 'Works on your phone, tablet and computer in the browser, even offline',
  /** A con in a round-up, when one is needed. */
  con: 'Not in the app stores',
  /** The full answer, for an app page note or an FAQ. */
  how: 'Nothing to install: just open it in the browser on your phone, tablet or computer. It keeps working without internet after your first visit. Want an icon on your home screen? On iPhone or iPad, tap Share, then Add to Home Screen. On Android, open the browser menu and tap Add to Home screen. On a computer, click the install icon in the address bar.',
};
