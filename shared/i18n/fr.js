/* French (fr): a full table. Every key in shared/i18n/strings.js has a French string here, with the same {placeholders}
 * (tests/node/i18n.test.mjs checks both). Classic script: needs shared/i18n/i18n.js loaded first, and loads after strings.js.
 * Only shared chrome is here; an app's own body text is still English (see HANDOFF.md). */
(function (g) {
  'use strict';
  if (!g.SlopI18n) return;
  g.SlopI18n.add('fr', {
    'nav.home': 'Accueil',
    'nav.apps': 'Applications',
    'nav.status': 'État',
    'nav.profile': 'Profil',
    'nav.settings': 'Paramètres',

    'shell.switch_app': 'Changer d’application',
    'shell.switch_title': 'Changer d’application ({shortcut})',

    'switcher.search': 'Rechercher des applications',
    'switcher.recent': 'Récentes',
    'switcher.open_tabs': 'Onglets ouverts',
    'switcher.all_apps': 'Toutes les applications',
    'switcher.hint': 'Entrée pour ouvrir · ↑ ↓ pour naviguer',
    'switcher.no_match': 'Aucune application ne correspond à « {query} ».',
    'switcher.tab_name': 'Onglet ouvert',
    'switcher.tab_sub': 'Dans une autre fenêtre',
    'switcher.esc': 'Échap',

    'footer.office': 'Logiciels de bureautique et de création qui fonctionnent dans votre navigateur.',
    'footer.creative': 'Logiciels de création qui fonctionnent dans votre navigateur.',
    'footer.offline': 'Tout fonctionne d’abord hors ligne. Vos fichiers ne quittent jamais votre appareil.',
    'footer.accounts_home': 'Aucun compte. Les statistiques et les publicités restent désactivées, sauf si vous les activez dans Paramètres.',
    'footer.accounts_settings': 'Aucun compte. Les statistiques et les publicités sont désactivées, sauf si vous les activez dans Paramètres.',
    'footer.settings_link': 'Paramètres et confidentialité',
    'footer.code_license': 'Code sous licence MIT',
    'footer.trademarks': 'Sloppo™ et Slopographic™ sont des marques commerciales',

    'settings.appearance': 'Apparence',
    'settings.appearance_lede': 'Un seul thème pour toutes les applications Slopographic et pour ce site. Choisissez-le ici, il s’applique aussitôt. Chaque application reprend ce choix à son ouverture.',
    'settings.theme': 'Thème',
    'settings.privacy': 'Confidentialité',
    'settings.analytics_ads': 'Statistiques et publicités',
    'settings.defaults': 'Valeurs par défaut',
    'settings.exchange_rates': 'Taux de change',
    'settings.app_settings': 'Réglages des applications',
    'settings.donate': 'Pot à pourboires',

    'settings.language': 'Langue',
    'settings.language_saved': 'Enregistré. {name} est la langue du texte de l’application.',

    'consent.region': 'Choix de confidentialité',
    'consent.text': 'Les statistiques et les publicités sont désactivées. Les activer ? Vous pouvez changer cela à tout moment dans',
    'consent.reject': 'Refuser',
    'consent.accept': 'Accepter',
    'consent.close_aria': 'Refuser le facultatif et fermer',

    'support.region': 'Soutenir Slopographic',
    'support.title': 'Soutenir Slopographic',
    'support.text': 'Sloppo a rendu ceci gratuit. Si cela vous a aidé, un don permet de le faire vivre.',
    'support.fine': 'Les statistiques et les publicités sont désactivées par défaut.',
    'support.donate': 'Pot à pourboires',
    'support.no_thanks': 'Non merci',
    'support.close_aria': 'Fermer pour l’instant',
    'support.ads': 'Publicités',
    'support.ads_aria': 'Publicités : désactivées ou activées',
    'support.ads_off': 'Non',
    'support.ads_on': 'Oui',
    'support.ads_turn_off': 'Désactiver les publicités',
    'support.ad_region': 'Publicité',
    'support.ad_label': 'Publicité',
    'support.ad_empty': 'Espace publicitaire (aucune unité publicitaire configurée)',

    'menu.file': 'Fichier',
    'menu.edit': 'Édition',
    'menu.view': 'Affichage',
    'menu.help': 'Aide',
    'menu.save': 'Enregistrer',
    'menu.open': 'Ouvrir',
    'menu.export': 'Exporter',
    'menu.print': 'Imprimer',
    'menu.cancel': 'Annuler',
    'menu.ok': 'OK',
    'menu.close': 'Fermer',
  });
})(typeof window !== 'undefined' ? window : globalThis);
