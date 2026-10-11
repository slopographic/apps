/* English strings for the shared chrome: the top bar and home link, the Apps button and app switcher, the Settings
 * labels, the homepage footer, the consent strip, the support card and the common menu words. Keys are dotted, grouped
 * by where they appear. The text is the same as the HTML or the script it replaces, so a page with no language support
 * shows the same words. Classic script: needs shared/i18n/i18n.js loaded first. Other languages live in their own
 * files (shared/i18n/es.js, ...), which must hold every key here (tests/node/i18n.test.mjs checks that). Add new keys
 * here and to every language file, never edit an existing English string without checking every use (HANDOFF.md). */
(function (g) {
  'use strict';
  if (!g.SlopI18n) return;
  g.SlopI18n.add('en', {
    'nav.home': 'Home',
    'nav.apps': 'Apps',
    'nav.status': 'Status',
    'nav.profile': 'Profile',
    'nav.settings': 'Settings',

    'shell.switch_app': 'Switch app',
    'shell.switch_title': 'Switch app ({shortcut})',

    'switcher.search': 'Search apps',
    'switcher.recent': 'Recent',
    'switcher.open_tabs': 'Open tabs',
    'switcher.all_apps': 'All apps',
    'switcher.hint': 'Enter to open · ↑ ↓ to move',
    'switcher.no_match': 'No app matches “{query}”.',
    'switcher.tab_name': 'Open tab',
    'switcher.tab_sub': 'Open in another window',
    'switcher.esc': 'Esc',

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
    'settings.donate': 'Tip jar',

    'settings.language': 'Language',
    'settings.language_saved': 'Saved. {name} is the language of the app text.',

    'consent.region': 'Privacy choice',
    'consent.text': 'Analytics and ads are off. Turn them on? You can change this any time in',
    'consent.reject': 'Reject',
    'consent.accept': 'Accept',
    'consent.close_aria': 'Reject optional and close',

    'support.region': 'Support Slopographic',
    'support.title': 'Support Slopographic',
    'support.text': 'Sloppo made this free. If it helped, a donation keeps it going.',
    'support.fine': 'Analytics and ads are off by default.',
    'support.donate': 'Tip jar',
    'support.no_thanks': 'No thanks',
    'support.close_aria': 'Close for now',
    'support.ads': 'Ads',
    'support.ads_aria': 'Ads: Off or On',
    'support.ads_off': 'Off',
    'support.ads_on': 'On',
    'support.ads_turn_off': 'Turn off ads',
    'support.ad_region': 'Advertisement',
    'support.ad_label': 'Ad',
    'support.ad_empty': 'Ad space (no ad unit configured)',

    'menu.file': 'File',
    'menu.edit': 'Edit',
    'menu.view': 'View',
    'menu.help': 'Help',
    'menu.save': 'Save',
    'menu.open': 'Open',
    'menu.export': 'Export',
    'menu.print': 'Print',
    'menu.cancel': 'Cancel',
    'menu.ok': 'OK',
    'menu.close': 'Close',
  });
})(typeof window !== 'undefined' ? window : globalThis);
