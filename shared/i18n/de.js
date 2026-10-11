/* German (de): a full table. Every key in shared/i18n/strings.js has a German string here, with the same {placeholders}
 * (tests/node/i18n.test.mjs checks both). Classic script: needs shared/i18n/i18n.js loaded first, and loads after strings.js.
 * Only shared chrome is here; an app's own body text is still English (see HANDOFF.md). */
(function (g) {
  'use strict';
  if (!g.SlopI18n) return;
  g.SlopI18n.add('de', {
    'nav.home': 'Start',
    'nav.apps': 'Apps',
    'nav.status': 'Status',
    'nav.profile': 'Profil',
    'nav.settings': 'Einstellungen',

    'shell.switch_app': 'App wechseln',
    'shell.switch_title': 'App wechseln ({shortcut})',

    'switcher.search': 'Apps suchen',
    'switcher.recent': 'Zuletzt verwendet',
    'switcher.open_tabs': 'Geöffnete Tabs',
    'switcher.all_apps': 'Alle Apps',
    'switcher.hint': 'Eingabe zum Öffnen · ↑ ↓ zum Wechseln',
    'switcher.no_match': 'Keine App passt zu „{query}“.',
    'switcher.tab_name': 'Geöffneter Tab',
    'switcher.tab_sub': 'In einem anderen Fenster',
    'switcher.esc': 'Esc',

    'footer.office': 'Büro- und Kreativsoftware, die in Ihrem Browser läuft.',
    'footer.creative': 'Kreativsoftware, die in Ihrem Browser läuft.',
    'footer.offline': 'Alles funktioniert zuerst offline. Ihre Dateien verlassen Ihr Gerät nie.',
    'footer.accounts_home': 'Keine Konten. Analysen und Werbung bleiben aus, außer Sie schalten sie in den Einstellungen ein.',
    'footer.accounts_settings': 'Keine Konten. Analysen und Werbung sind aus, außer Sie schalten sie in den Einstellungen ein.',
    'footer.settings_link': 'Einstellungen und Datenschutz',
    'footer.code_license': 'Code MIT',
    'footer.trademarks': 'Sloppo™ und Slopographic™ sind Marken',

    'settings.appearance': 'Darstellung',
    'settings.appearance_lede': 'Ein Design für alle Slopographic-Apps und für diese Website. Wählen Sie es hier, es wird sofort angewendet. Jede App übernimmt beim Öffnen dieselbe Wahl.',
    'settings.theme': 'Design',
    'settings.privacy': 'Datenschutz',
    'settings.analytics_ads': 'Analysen und Werbung',
    'settings.defaults': 'Standardeinstellungen',
    'settings.exchange_rates': 'Wechselkurse',
    'settings.app_settings': 'App-Einstellungen',
    'settings.donate': 'Spenden',

    'settings.language': 'Sprache',
    'settings.language_saved': 'Gespeichert. {name} ist die Sprache des App-Textes.',

    'consent.region': 'Datenschutzauswahl',
    'consent.text': 'Analysen und Werbung sind aus. Einschalten? Sie können das jederzeit ändern unter',
    'consent.reject': 'Ablehnen',
    'consent.accept': 'Akzeptieren',
    'consent.close_aria': 'Optionales ablehnen und schließen',

    'support.region': 'Slopographic unterstützen',
    'support.title': 'Slopographic unterstützen',
    'support.text': 'Sloppo hat dies kostenlos gemacht. Wenn es Ihnen geholfen hat, hält eine Spende es am Laufen.',
    'support.fine': 'Analysen und Werbung sind standardmäßig aus.',
    'support.donate': 'Spenden',
    'support.no_thanks': 'Nein danke',
    'support.close_aria': 'Vorerst schließen',
    'support.ads': 'Werbung',
    'support.ads_aria': 'Werbung: aus oder ein',
    'support.ads_off': 'Aus',
    'support.ads_on': 'Ein',
    'support.ads_turn_off': 'Werbung ausschalten',
    'support.ad_region': 'Werbung',
    'support.ad_label': 'Werbung',
    'support.ad_empty': 'Werbefläche (keine Werbeeinheit konfiguriert)',

    'menu.file': 'Datei',
    'menu.edit': 'Bearbeiten',
    'menu.view': 'Ansicht',
    'menu.help': 'Hilfe',
    'menu.save': 'Speichern',
    'menu.open': 'Öffnen',
    'menu.export': 'Exportieren',
    'menu.print': 'Drucken',
    'menu.cancel': 'Abbrechen',
    'menu.ok': 'OK',
    'menu.close': 'Schließen',
  });
})(typeof window !== 'undefined' ? window : globalThis);
