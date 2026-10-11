/* Portuguese, Brazil (pt-BR): a full table. Every key in shared/i18n/strings.js has a Portuguese string here, with the same
 * {placeholders} (tests/node/i18n.test.mjs checks both). Classic script: needs shared/i18n/i18n.js loaded first, and loads
 * after strings.js. Only shared chrome is here; an app's own body text is still English (see HANDOFF.md). */
(function (g) {
  'use strict';
  if (!g.SlopI18n) return;
  g.SlopI18n.add('pt-BR', {
    'nav.home': 'Início',
    'nav.apps': 'Apps',
    'nav.status': 'Status',
    'nav.profile': 'Perfil',
    'nav.settings': 'Configurações',

    'shell.switch_app': 'Trocar de app',
    'shell.switch_title': 'Trocar de app ({shortcut})',

    'switcher.search': 'Buscar apps',
    'switcher.recent': 'Recentes',
    'switcher.open_tabs': 'Abas abertas',
    'switcher.all_apps': 'Todos os apps',
    'switcher.hint': 'Enter para abrir · ↑ ↓ para mover',
    'switcher.no_match': 'Nenhum app corresponde a “{query}”.',
    'switcher.tab_name': 'Aba aberta',
    'switcher.tab_sub': 'Em outra janela',
    'switcher.esc': 'Esc',

    'footer.office': 'Software de escritório e criação que roda no seu navegador.',
    'footer.creative': 'Software de criação que roda no seu navegador.',
    'footer.offline': 'Tudo funciona offline primeiro. Seus arquivos nunca saem do seu dispositivo.',
    'footer.accounts_home': 'Sem contas. Análises e anúncios continuam desligados, a menos que você os ative em Configurações.',
    'footer.accounts_settings': 'Sem contas. Análises e anúncios ficam desligados, a menos que você os ative em Configurações.',
    'footer.settings_link': 'Configurações e privacidade',
    'footer.code_license': 'Código MIT',
    'footer.trademarks': 'Sloppo™ e Slopographic™ são marcas comerciais',

    'settings.appearance': 'Aparência',
    'settings.appearance_lede': 'Um só tema para todos os apps Slopographic e para este site. Escolha aqui e ele vale na hora. Cada app usa a mesma escolha ao abrir.',
    'settings.theme': 'Tema',
    'settings.privacy': 'Privacidade',
    'settings.analytics_ads': 'Análises e anúncios',
    'settings.defaults': 'Padrões',
    'settings.exchange_rates': 'Taxas de câmbio',
    'settings.app_settings': 'Configurações dos apps',
    'settings.donate': 'Pote de gorjetas',

    'settings.language': 'Idioma',
    'settings.language_saved': 'Salvo. {name} é o idioma do texto do app.',

    'consent.region': 'Escolha de privacidade',
    'consent.text': 'Análises e anúncios estão desligados. Quer ligá-los? Você pode mudar isso a qualquer momento em',
    'consent.reject': 'Recusar',
    'consent.accept': 'Aceitar',
    'consent.close_aria': 'Recusar o opcional e fechar',

    'support.region': 'Apoie a Slopographic',
    'support.title': 'Apoie a Slopographic',
    'support.text': 'A Sloppo tornou isto gratuito. Se ajudou, uma doação mantém o projeto funcionando.',
    'support.fine': 'Análises e anúncios vêm desligados por padrão.',
    'support.donate': 'Pote de gorjetas',
    'support.no_thanks': 'Não, obrigado',
    'support.close_aria': 'Fechar por enquanto',
    'support.ads': 'Anúncios',
    'support.ads_aria': 'Anúncios: desligados ou ligados',
    'support.ads_off': 'Não',
    'support.ads_on': 'Sim',
    'support.ads_turn_off': 'Desligar anúncios',
    'support.ad_region': 'Anúncio',
    'support.ad_label': 'Anúncio',
    'support.ad_empty': 'Espaço para anúncio (nenhuma unidade de anúncios configurada)',

    'menu.file': 'Arquivo',
    'menu.edit': 'Editar',
    'menu.view': 'Exibir',
    'menu.help': 'Ajuda',
    'menu.save': 'Salvar',
    'menu.open': 'Abrir',
    'menu.export': 'Exportar',
    'menu.print': 'Imprimir',
    'menu.cancel': 'Cancelar',
    'menu.ok': 'OK',
    'menu.close': 'Fechar',
  });
})(typeof window !== 'undefined' ? window : globalThis);
