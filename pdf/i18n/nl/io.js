/* Slop PDF, Nederlands: openen en opslaan, de lagen, lettertypen, bijlagen, het wachtwoord, opgeslagen bewerkingen en de
 * meldingen van het inlezen. Dezelfde sleutels als pdf/i18n/en/io.js. Terms: shared/i18n/glossary-nl.md.
 * Regels: shared/i18n/APPS-HOWTO.md. */
window.SlopI18n && window.SlopI18n.add('nl', {
  'pdf.core.font_missing': '{family} is niet geïnstalleerd.',
  'pdf.core.layer_numbered': '{name} {n}',
  'pdf.core.layer_step_n': 'Stap {n}',
  'pdf.core.layer_text': 'Tekst',
  'pdf.core.layer_callout': 'Aanwijzing',
  'pdf.core.layer_comment': 'Opmerking',
  'pdf.core.layer_rect': 'Rechthoek',
  'pdf.core.layer_ellipse': 'Ellips',
  'pdf.core.layer_line': 'Lijn',
  'pdf.core.layer_arrow': 'Pijl',
  'pdf.core.layer_drawing': 'Tekening',
  'pdf.core.layer_highlighter': 'Markeerstift',
  'pdf.core.layer_highlight': 'Markering',
  'pdf.core.layer_texthl': 'Tekstmarkering',
  'pdf.core.layer_whiteout': 'Wit vlak',
  'pdf.core.layer_image': 'Afbeelding',
  'pdf.core.layer_redaction': 'Redigeermarkering',
  'pdf.core.layer_step': 'Stap',
  'pdf.core.layer_paragraph': 'Alinea',
  'pdf.core.layer_signature': 'Handtekening',
  'pdf.core.layer_item': 'Item',
  'pdf.io.meta_pages': 'pagina’s {list}',
  'pdf.io.meta_page': 'pagina {n}',
  'pdf.io.font_stream_raw': 'Deze lettertypestroom is opgeslagen op een manier die niet wordt gedecodeerd',
  'pdf.io.not_embedded': 'niet ingesloten',
  'pdf.io.font_composite': 'Samengesteld ({type})',
  'pdf.io.not_decoded': 'Niet gedecodeerd',
  'pdf.io.image_undecodable': 'De afbeeldingsgegevens konden niet worden uitgepakt',
  'pdf.io.image_no_size': 'De afbeelding heeft geen grootte',
  'pdf.io.image_short': 'De afbeeldingsgegevens zijn korter dan de grootte',
  'pdf.io.att_raw': 'Deze bijlage is opgeslagen op een manier die niet wordt gedecodeerd',
  'pdf.core.needs_password': 'Voor deze PDF is een wachtwoord nodig.',
  'pdf.core.err_invalid': '‘{name}’ is geen geldige PDF, of is onherstelbaar beschadigd.',
  'pdf.core.err_empty': '‘{name}’ is leeg.',
  'pdf.core.err_password': '‘{name}’ heeft het juiste wachtwoord nodig.',
  'pdf.core.err_open': '‘{name}’ kon niet worden geopend: {msg}',
  'pdf.core.unsupported_encryption': 'Versleuteling wordt niet ondersteund',
  'pdf.core.writer_missing': 'De PDF-schrijver is niet geladen.',
  'pdf.io.unknown': 'onbekend',
  'pdf.io.none': 'geen',
  'pdf.io.skip_stencil': 'Stencilmasker (1 bit) wordt niet gedecodeerd',
  'pdf.io.skip_jpx': 'JPEG 2000-afbeeldingen worden niet gedecodeerd',
  'pdf.io.skip_jbig2': 'JBIG2-afbeeldingen worden niet gedecodeerd',
  'pdf.io.skip_ccitt': 'CCITT-faxafbeeldingen worden niet gedecodeerd',
  'pdf.io.skip_filter': 'Filter {filter} wordt niet gedecodeerd',
  'pdf.io.skip_raw': 'Ongecomprimeerde afbeeldingen van dit type worden niet gedecodeerd',
  'pdf.io.skip_bpc': 'Samples van {bpc} bit worden niet gedecodeerd',
  'pdf.io.skip_palette': 'Palet in {cs} wordt niet gedecodeerd',
  'pdf.io.skip_colour': 'Kleurruimte {cs} wordt niet gedecodeerd',
  'pdf.io.mask_excluded': 'masker niet opgenomen',
  'pdf.io.font_not_embedded': 'Niet ingesloten: de PDF verwijst naar het lettertype, dus er is geen bestand om op te slaan',
  'pdf.io.font_subset': 'subset: kan onvolledig zijn',
  'pdf.io.att_on_page': 'bijgevoegd op pagina {n}',
  'pdf.io.att_document': 'bijgevoegd aan het document',
  'pdf.io.att_einvoice': 'e-factuur (ZUGFeRD / Factur-X)',
  'pdf.io.att_rel': 'relatie: {rel}',
  'pdf.io.assets_name': 'PDF-bestanden',
  'pdf.io.no_font_file': 'Niet ingesloten, dus er is geen lettertypebestand',
  'pdf.io.crypto_load_failed': 'De code voor het PDF-wachtwoord kon niet worden geladen.',
  'pdf.io.crypto_not_loaded': 'De code voor het PDF-wachtwoord is niet geladen.',
  'pdf.io.changes_replayed': 'Opgeslagen wijzigingen opnieuw uitvoeren',
  'pdf.io.log_found_title': 'Opgeslagen bewerkingen gevonden',
  'pdf.io.log_found_body': 'Slop PDF heeft {n} bewerkingen aan ‘{name}’ op dit apparaat bewaard. Voer ze opnieuw uit op dit bestand, of gooi ze weg. Opslaan of Exporteren schrijft in beide gevallen een nieuwe PDF.',
  'pdf.io.log_found_body#one': 'Slop PDF heeft {n} bewerking aan ‘{name}’ op dit apparaat bewaard. Voer die opnieuw uit op dit bestand, of gooi hem weg. Opslaan of Exporteren schrijft in beide gevallen een nieuwe PDF.',
  'pdf.io.log_discard': 'Weggooien',
  'pdf.io.log_replay': 'Opnieuw uitvoeren',
  'pdf.io.log_replayed': 'Opgeslagen bewerkingen opnieuw uitvoeren',
  'pdf.io.no_pages': 'Er zijn geen pagina’s om te exporteren.',
  'pdf.io.redact_pending': '{n} gebieden zijn gemarkeerd voor redigeren, maar nog niet geredigeerd. Open Redigeren en kies ‘Redigeren toepassen’, of verwijder de markeringen.',
  'pdf.io.redact_pending#one': '{n} gebied is gemarkeerd voor redigeren, maar nog niet geredigeerd. Open Redigeren en kies ‘Redigeren toepassen’, of verwijder de markering.',
  'pdf.io.source_missing': 'Een bronbestand ontbreekt.',
  'pdf.io.locked': '‘{name}’ gebruikt versleuteling die Slop PDF niet kan verwijderen ({why}), dus de pagina’s kunnen niet worden geëxporteerd.',
  'pdf.io.layer': 'Laag',
  'pdf.io.layer_hide': 'Laag ‘{name}’ verbergen',
  'pdf.io.layer_show': 'Laag ‘{name}’ tonen',
  'pdf.io.layer_delete': 'Laag ‘{name}’ verwijderen',
  'pdf.io.sample_busy_playful': 'Er wordt een verse lading slijm gemengd…',
  'pdf.io.sample_busy_plain': 'Het voorbeeld wordt gemaakt…',
  'pdf.io.restore': 'Herstellen',
  'pdf.io.close_all': 'Alles sluiten',

  // ui/cover-save.js: a save with old text still under covers
  'pdf.io.cover_title': 'Old text is still in the file', // English until translated (cover guard)
  'pdf.io.cover_body': '{n} edited lines still have their old text hidden in the file. Anyone can copy it.', // English until translated (cover guard)
  'pdf.io.cover_body#one': '{n} edited line still has its old text hidden in the file. Anyone can copy it.', // English until translated (cover guard)
  'pdf.io.cover_images_note': 'Make those pages images to take the old text out for good. Text on those pages will no longer be selectable; the other pages stay as they are.', // English until translated (cover guard)
  'pdf.io.cover_keep': 'Save anyway', // English until translated (cover guard)
  'pdf.io.cover_images': 'Make those pages images', // English until translated (cover guard)
  'pdf.io.cover_cancelled': 'Cancelled. Nothing was saved.', // English until translated (cover guard)
  'pdf.io.cover_making': 'Making the pages images…', // English until translated (cover guard)
  'pdf.io.cover_made': '{n} pages are images now: the old text is gone for good.', // English until translated (cover guard)
  'pdf.io.cover_made#one': '{n} page is an image now: the old text is gone for good.', // English until translated (cover guard)
  'pdf.io.cover_undo': 'Make pages images', // English until translated (cover guard)
  'pdf.io.cover_file_name': 'Image pages.pdf', // English until translated (cover guard)
});
