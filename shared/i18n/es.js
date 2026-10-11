/* Spanish (es): the second language, a full table. Every key in shared/i18n/strings.js has a Spanish string here, with
 * the same {placeholders} (tests/node/i18n.test.mjs checks both). Classic script: needs shared/i18n/i18n.js loaded first,
 * and loads after strings.js. Only shared chrome is here; an app's own body text is still English (see HANDOFF.md). */
(function (g) {
  'use strict';
  if (!g.SlopI18n) return;
  g.SlopI18n.add('es', {
    'nav.home': 'Inicio',
    'nav.apps': 'Aplicaciones',
    'nav.status': 'Estado',
    'nav.profile': 'Perfil',
    'nav.settings': 'Configuración',

    'shell.switch_app': 'Cambiar de app',
    'shell.switch_title': 'Cambiar de app ({shortcut})',

    'switcher.search': 'Buscar apps',
    'switcher.recent': 'Recientes',
    'switcher.open_tabs': 'Pestañas abiertas',
    'switcher.all_apps': 'Todas las apps',
    'switcher.hint': 'Intro para abrir · ↑ ↓ para moverte',
    'switcher.no_match': 'Ninguna app coincide con “{query}”.',
    'switcher.tab_name': 'Pestaña abierta',
    'switcher.tab_sub': 'En otra ventana',
    'switcher.esc': 'Esc',

    'footer.office': 'Software de oficina y creatividad que funciona en tu navegador.',
    'footer.creative': 'Software creativo que funciona en tu navegador.',
    'footer.offline': 'Todo funciona primero sin conexión. Tus archivos nunca salen de tu dispositivo.',
    'footer.accounts_home': 'Sin cuentas. Las analíticas y los anuncios siguen desactivados salvo que los actives en Configuración.',
    'footer.accounts_settings': 'Sin cuentas. Las analíticas y los anuncios están desactivados salvo que los actives en Configuración.',
    'footer.settings_link': 'Configuración y privacidad',
    'footer.code_license': 'Código MIT',
    'footer.trademarks': 'Sloppo™ y Slopographic™ son marcas comerciales',

    'settings.appearance': 'Apariencia',
    'settings.appearance_lede': 'Un solo tema para todas las apps de Slopographic y para este sitio. Elígelo aquí y se aplica al momento. Cada app usa la misma elección al abrirse.',
    'settings.theme': 'Tema',
    'settings.privacy': 'Privacidad',
    'settings.analytics_ads': 'Analíticas y anuncios',
    'settings.defaults': 'Valores predeterminados',
    'settings.exchange_rates': 'Tipos de cambio',
    'settings.app_settings': 'Ajustes de las apps',
    'settings.donate': 'Bote de propinas',

    'settings.language': 'Idioma',
    'settings.language_saved': 'Guardado. {name} es el idioma del texto de la app.',

    'consent.region': 'Elección de privacidad',
    'consent.text': 'Las analíticas y los anuncios están desactivados. ¿Los activas? Puedes cambiarlo en cualquier momento en',
    'consent.reject': 'Rechazar',
    'consent.accept': 'Aceptar',
    'consent.close_aria': 'Rechazar lo opcional y cerrar',

    'support.region': 'Apoya a Slopographic',
    'support.title': 'Apoya a Slopographic',
    'support.text': 'Sloppo hizo esto gratis. Si te ayudó, una donación lo mantiene en marcha.',
    'support.fine': 'Las analíticas y los anuncios están desactivados por defecto.',
    'support.donate': 'Bote de propinas',
    'support.no_thanks': 'No, gracias',
    'support.close_aria': 'Cerrar por ahora',
    'support.ads': 'Anuncios',
    'support.ads_aria': 'Anuncios: desactivados o activados',
    'support.ads_off': 'No',
    'support.ads_on': 'Sí',
    'support.ads_turn_off': 'Desactivar anuncios',
    'support.ad_region': 'Anuncio',
    'support.ad_label': 'Anuncio',
    'support.ad_empty': 'Espacio para anuncios (no hay unidad de anuncios configurada)',

    'menu.file': 'Archivo',
    'menu.edit': 'Editar',
    'menu.view': 'Ver',
    'menu.help': 'Ayuda',
    'menu.save': 'Guardar',
    'menu.open': 'Abrir',
    'menu.export': 'Exportar',
    'menu.print': 'Imprimir',
    'menu.cancel': 'Cancelar',
    'menu.ok': 'Aceptar',
    'menu.close': 'Cerrar',
  });
})(typeof window !== 'undefined' ? window : globalThis);
