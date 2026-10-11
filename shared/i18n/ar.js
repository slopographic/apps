/* Arabic (ar): a full table, right to left (dir="rtl" is set by i18n.js from LANGS). Every key in shared/i18n/strings.js has
 * an Arabic string here, with the same {placeholders} (tests/node/i18n.test.mjs checks both). Classic script: needs
 * shared/i18n/i18n.js loaded first, and loads after strings.js. Only shared chrome is here; an app's own body text is
 * still English (see HANDOFF.md). */
(function (g) {
  'use strict';
  if (!g.SlopI18n) return;
  g.SlopI18n.add('ar', {
    'nav.home': 'الرئيسية',
    'nav.apps': 'التطبيقات',
    'nav.status': 'الحالة',
    'nav.profile': 'الملف الشخصي',
    'nav.settings': 'الإعدادات',

    'shell.switch_app': 'تبديل التطبيق',
    'shell.switch_title': 'تبديل التطبيق ({shortcut})',

    'switcher.search': 'البحث في التطبيقات',
    'switcher.recent': 'الأخيرة',
    'switcher.open_tabs': 'علامات التبويب المفتوحة',
    'switcher.all_apps': 'كل التطبيقات',
    'switcher.hint': 'Enter للفتح · ↑ ↓ للتنقل',
    'switcher.no_match': 'لا يوجد تطبيق يطابق “{query}”.',
    'switcher.tab_name': 'علامة تبويب مفتوحة',
    'switcher.tab_sub': 'في نافذة أخرى',
    'switcher.esc': 'Esc',

    'footer.office': 'برامج المكتب والإبداع التي تعمل في متصفحك.',
    'footer.creative': 'برامج الإبداع التي تعمل في متصفحك.',
    'footer.offline': 'كل شيء يعمل بلا اتصال أولاً. ملفاتك لا تغادر جهازك أبداً.',
    'footer.accounts_home': 'لا حسابات. تبقى التحليلات والإعلانات متوقفة ما لم تفعّلها من الإعدادات.',
    'footer.accounts_settings': 'لا حسابات. التحليلات والإعلانات متوقفة ما لم تفعّلها من الإعدادات.',
    'footer.settings_link': 'الإعدادات والخصوصية',
    'footer.code_license': 'الكود بترخيص MIT',
    'footer.trademarks': 'Sloppo™ وSlopographic™ علامتان تجاريتان',

    'settings.appearance': 'المظهر',
    'settings.appearance_lede': 'سمة واحدة لكل تطبيقات Slopographic ولهذا الموقع. اختَرها هنا وتُطبَّق فوراً. يستخدم كل تطبيق الاختيار نفسه عند فتحه.',
    'settings.theme': 'السمة',
    'settings.privacy': 'الخصوصية',
    'settings.analytics_ads': 'التحليلات والإعلانات',
    'settings.defaults': 'الافتراضات',
    'settings.exchange_rates': 'أسعار الصرف',
    'settings.app_settings': 'إعدادات التطبيقات',
    'settings.donate': 'تبرّع',

    'settings.language': 'اللغة',
    'settings.language_saved': 'تم الحفظ. اللغة المختارة لنص التطبيق: {name}.',

    'consent.region': 'خيار الخصوصية',
    'consent.text': 'التحليلات والإعلانات متوقفة. هل تريد تفعيلها؟ يمكنك تغيير ذلك في أي وقت من',
    'consent.reject': 'رفض',
    'consent.accept': 'قبول',
    'consent.close_aria': 'رفض الخيارات الاختيارية والإغلاق',

    'support.region': 'ادعم Slopographic',
    'support.title': 'ادعم Slopographic',
    'support.text': 'صنعت Sloppo هذا مجاناً. إذا أفادك، فالتبرع يُبقيه مستمراً.',
    'support.fine': 'التحليلات والإعلانات متوقفة افتراضياً.',
    'support.donate': 'تبرّع',
    'support.no_thanks': 'لا، شكراً',
    'support.close_aria': 'الإغلاق الآن',
    'support.ads': 'الإعلانات',
    'support.ads_aria': 'الإعلانات: متوقفة أو مفعّلة',
    'support.ads_off': 'إيقاف',
    'support.ads_on': 'تشغيل',
    'support.ads_turn_off': 'إيقاف الإعلانات',
    'support.ad_region': 'إعلان',
    'support.ad_label': 'إعلان',
    'support.ad_empty': 'مساحة إعلانية (لم تُضبط وحدة إعلانية)',

    'menu.file': 'ملف',
    'menu.edit': 'تحرير',
    'menu.view': 'عرض',
    'menu.help': 'مساعدة',
    'menu.save': 'حفظ',
    'menu.open': 'فتح',
    'menu.export': 'تصدير',
    'menu.print': 'طباعة',
    'menu.cancel': 'إلغاء',
    'menu.ok': 'موافق',
    'menu.close': 'إغلاق',
  });
})(typeof window !== 'undefined' ? window : globalThis);
