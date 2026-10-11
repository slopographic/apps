/* Italian (it): a full table. Every key in shared/i18n/strings.js has an Italian string here, with the same {placeholders}
 * (tests/node/i18n.test.mjs checks both). Classic script: needs shared/i18n/i18n.js loaded first, and loads after strings.js.
 * Only shared chrome is here; an app's own body text is still English (see HANDOFF.md). */
(function (g) {
  'use strict';
  if (!g.SlopI18n) return;
  g.SlopI18n.add('it', {
    'nav.home': 'Home',
    'nav.apps': 'App',
    'nav.status': 'Stato',
    'nav.profile': 'Profilo',
    'nav.settings': 'Impostazioni',

    'shell.switch_app': 'Cambia app',
    'shell.switch_title': 'Cambia app ({shortcut})',

    'switcher.search': 'Cerca app',
    'switcher.recent': 'Recenti',
    'switcher.open_tabs': 'Schede aperte',
    'switcher.all_apps': 'Tutte le app',
    'switcher.hint': 'Invio per aprire · ↑ ↓ per spostarti',
    'switcher.no_match': 'Nessuna app corrisponde a “{query}”.',
    'switcher.tab_name': 'Scheda aperta',
    'switcher.tab_sub': 'In un’altra finestra',
    'switcher.esc': 'Esc',

    'footer.office': 'Software per ufficio e creatività che funziona nel tuo browser.',
    'footer.creative': 'Software creativo che funziona nel tuo browser.',
    'footer.offline': 'Tutto funziona prima di tutto offline. I tuoi file non lasciano mai il tuo dispositivo.',
    'footer.accounts_home': 'Nessun account. Analisi e pubblicità restano disattivate finché non le attivi in Impostazioni.',
    'footer.accounts_settings': 'Nessun account. Analisi e pubblicità sono disattivate finché non le attivi in Impostazioni.',
    'footer.settings_link': 'Impostazioni e privacy',
    'footer.code_license': 'Codice MIT',
    'footer.trademarks': 'Sloppo™ e Slopographic™ sono marchi',

    'settings.appearance': 'Aspetto',
    'settings.appearance_lede': 'Un unico tema per tutte le app Slopographic e per questo sito. Scegli qui e si applica subito. Ogni app usa la stessa scelta quando si apre.',
    'settings.theme': 'Tema',
    'settings.privacy': 'Privacy',
    'settings.analytics_ads': 'Analisi e pubblicità',
    'settings.defaults': 'Predefiniti',
    'settings.exchange_rates': 'Tassi di cambio',
    'settings.app_settings': 'Impostazioni delle app',
    'settings.donate': 'Dona',

    'settings.language': 'Lingua',
    'settings.language_saved': 'Salvato. {name} è la lingua del testo dell’app.',

    'consent.region': 'Scelta sulla privacy',
    'consent.text': 'Analisi e pubblicità sono disattivate. Vuoi attivarle? Puoi cambiarlo in qualsiasi momento in',
    'consent.reject': 'Rifiuta',
    'consent.accept': 'Accetta',
    'consent.close_aria': 'Rifiuta le opzioni facoltative e chiudi',

    'support.region': 'Sostieni Slopographic',
    'support.title': 'Sostieni Slopographic',
    'support.text': 'Sloppo ha reso questo strumento gratuito. Se ti è stato utile, una donazione lo mantiene attivo.',
    'support.fine': 'Analisi e pubblicità sono disattivate per impostazione predefinita.',
    'support.donate': 'Dona',
    'support.no_thanks': 'No, grazie',
    'support.close_aria': 'Chiudi per ora',
    'support.ads': 'Pubblicità',
    'support.ads_aria': 'Pubblicità: disattivata o attivata',
    'support.ads_off': 'No',
    'support.ads_on': 'Sì',
    'support.ads_turn_off': 'Disattiva la pubblicità',
    'support.ad_region': 'Pubblicità',
    'support.ad_label': 'Annuncio',
    'support.ad_empty': 'Spazio pubblicitario (nessuna unità pubblicitaria configurata)',

    'menu.file': 'File',
    'menu.edit': 'Modifica',
    'menu.view': 'Visualizza',
    'menu.help': 'Aiuto',
    'menu.save': 'Salva',
    'menu.open': 'Apri',
    'menu.export': 'Esporta',
    'menu.print': 'Stampa',
    'menu.cancel': 'Annulla',
    'menu.ok': 'OK',
    'menu.close': 'Chiudi',
  });
})(typeof window !== 'undefined' ? window : globalThis);
