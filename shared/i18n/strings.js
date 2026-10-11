/* English strings for the shared pieces of the homepage and Settings: the header tabs, the footer and the Settings
 * labels. Keys are dotted, grouped by where they appear. The text is the same as the HTML it replaces, so a page with
 * no language support shows the same words. Classic script: needs shared/i18n/i18n.js loaded first. Add new keys to
 * the language's own table (window.SlopI18n.add(code, {...})), never edit an existing English string without checking
 * every page that uses the key (see shared/i18n/HANDOFF.md). */
(function (g) {
  'use strict';
  if (!g.SlopI18n) return;
  g.SlopI18n.add('en', {
    'nav.apps': 'Apps',
    'nav.status': 'Status',
    'nav.profile': 'Profile',

    'footer.office': 'Office and creative software that runs in your browser.',
    'footer.creative': 'Creative software that runs in your browser.',
    'footer.offline': 'Everything works offline-first. Your files never leave your device.',
    'footer.accounts_home': 'No accounts. Analytics and ads stay off unless you switch them on in Settings.',
    'footer.accounts_settings': 'No accounts. Analytics and ads are off unless you turn them on in Settings.',
    'footer.settings_link': 'Settings and privacy',
    'footer.code_license': 'Code MIT',
    'footer.trademarks': 'Sloppo™ and Slopographic™ are trademarks',

    'settings.appearance': 'Appearance',
    'settings.appearance_lede': 'One theme for every Slopographic app and for this site. Pick it here and it applies at once. Each app uses the same choice when it opens.',
    'settings.theme': 'Theme',
    'settings.privacy': 'Privacy',
    'settings.analytics_ads': 'Analytics and ads',
    'settings.defaults': 'Defaults',
    'settings.exchange_rates': 'Exchange rates',
    'settings.app_settings': 'App settings',
    'settings.donate': 'Donate',

    'settings.language': 'Language',
    'settings.language_saved': 'Saved. {name} is the language of the app text.',
  });
})(typeof window !== 'undefined' ? window : globalThis);
