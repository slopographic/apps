# Glossary: Swedish (sv)

Register: informal «du», as the Swedish versions of Microsoft Office, Adobe Acrobat and Google Workspace do, and as shared/i18n/sv.js already does. Buttons and menu commands are imperatives («Spara», «Öppna», «Ta bort», «Rotera åt höger»); menu titles follow Office («Arkiv», «Redigera», «Visa», «Infoga», «Verktyg», «Hjälp»). Sentence case everywhere («Spara som», not «Spara Som»). Running text says «du/din/dina». Status messages and toasts use the past tense without a subject («Roterade 3 sidor», «Sparade rapport.pdf»), progress uses «…» («Läser in…», «Sparar…»). Quotes are ”svenska” (same sign both ends), as in sv.js. Plurals: Swedish has one/other, so keep every '#one' form. Numbers: thin space for grouping and comma decimals come from Intl; write «%» with a space before it in prose («60 %»), but keep the English «{pct}%» in compact labels. Possessive of a format: «PDF:er», «PDF:en», «PNG-bilder».

**Undo labels.** The generic word is `ui.undo_what` = «Ångra: {what}» and `ui.redo_what` = «Gör om: {what}»; the status toasts are `pdf.app.undid` = «Ångrade: {what}» and `pdf.app.redid` = «Gjorde om: {what}». So every undo step label (`pdf.cmd.undo_*`, `pdf.act.undo_*`, `pdf.*.undo_*`) is written as the command itself, imperative, sentence case, like a menu item: «Rotera sida», «Ta bort 3 sidor», «Lägg till text», «Ersätt ”{text}”». After the colon it reads as «Ångra: Rotera sida». Do not use noun phrases («rotering av sida»).

| English | Svenska | Note |
| --- | --- | --- |
| app | app |  |
| apps | appar | as in sv.js (nav.apps) |
| file | fil |  |
| files | filer |  |
| folder | mapp |  |
| document | dokument |  |
| page | sida |  |
| pages | sidor |  |
| open | Öppna |  |
| save | Spara |  |
| save as | Spara som |  |
| download | Ladda ned | «Ladda ned PDF» |
| upload | Ladda upp | the site uploads nothing: «Inget laddas upp» |
| export | Exportera |  |
| import | Importera |  |
| print | Skriv ut |  |
| close | Stäng |  |
| cancel | Avbryt |  |
| OK | OK |  |
| delete | Ta bort | Office uses «Ta bort», not «Radera» |
| remove | Ta bort | same word as delete; «Rensa» for clearing a list |
| rename | Byt namn |  |
| duplicate | Duplicera |  |
| copy | Kopiera |  |
| paste | Klistra in |  |
| cut | Klipp ut |  |
| undo | Ångra | see the undo paragraph above |
| redo | Gör om |  |
| select all | Markera alla | «Markera allt» for text |
| search | Sök |  |
| find | Sök | «Sök i dokumentet»; «Sök och ersätt» |
| replace | Ersätt |  |
| settings | Inställningar |  |
| theme | Tema | as in sv.js (settings.theme) |
| language | Språk |  |
| help | Hjälp |  |
| about | Om | «Om Slop PDF» |
| view | Visa | menu title; «vy» for a view mode («Sidvy») |
| edit | Redigera |  |
| insert | Infoga |  |
| format | Format |  |
| tools | Verktyg |  |
| menu | meny |  |
| toolbar | verktygsfält |  |
| panel | panel |  |
| sidebar | sidofält |  |
| tab | flik | as in sv.js (switcher.open_tabs) |
| dialog | dialogruta |  |
| shortcut | kortkommando |  |
| keyboard shortcuts | Kortkommandon |  |
| command | kommando |  |
| zoom in | Zooma in |  |
| zoom out | Zooma ut |  |
| fit page | Anpassa sida | «Anpassa bredd» for fit width |
| rotate | Rotera |  |
| rotate left | Rotera åt vänster |  |
| rotate right | Rotera åt höger |  |
| merge | Sammanfoga |  |
| split | Dela upp | «delad vy» for split view |
| extract | Extrahera |  |
| compress | Komprimera |  |
| convert | Konvertera | as in sv.js (shell.convert) |
| sign | Signera |  |
| signature | Underskrift | a handwritten/drawn one; «digital signatur» for a certificate |
| stamp | Stämpel |  |
| watermark | Vattenstämpel |  |
| layer | lager | PDF optional content groups (OCG) are «lager» too |
| layers | Lager |  |
| comment | Kommentar |  |
| annotation | anteckning | Acrobat sv: «anteckning»; the tools are «Anteckningsverktyg» |
| highlight | Markera | the tool; the mark itself is «markering» |
| redact | Maskera | Acrobat sv; noun «maskering», «Tillämpa maskeringar». Never «Svärta» |
| redacted | Maskerad |  |
| form | formulär |  |
| field | fält |  |
| password | lösenord |  |
| protect | Skydda | «Skydda med lösenord» |
| image | bild |  |
| text | text |  |
| font | teckensnitt | as Office; «typsnitt» only for the site's typeface (footer.typeface) |
| color | färg |  |
| page number | sidnummer |  |
| thumbnail | miniatyr |  |
| preview | förhandsgranskning | «Förhandsgranska» as a command |
| drag and drop | dra och släpp |  |
| drop files here | Släpp filer här |  |
| untitled | Namnlös |  |
| recent | Senaste | as in sv.js (switcher.recent) |
| sample | exempel | «Prova ett exempel», «exempel-PDF» |
| tour | rundtur | «Guidad rundtur» |
| next | Nästa |  |
| back | Tillbaka |  |
| skip | Hoppa över |  |
| finish | Slutför |  |
| done | Klar |  |
| apply | Tillämpa |  |
| reset | Återställ |  |
| loading… | Läser in… |  |
| working… | Arbetar… |  |
| offline | offline |  |
| nothing is uploaded | Inget laddas upp |  |
| your files stay on this device | Dina filer stannar på den här enheten |  |
| beta | beta |  |
| flatten (form, annotations) | Platta till | «Platta till formulär»; noun «tillplattning» |
| callout | pratbubbla | a text box with a pointer, as Office shapes |
| step marker | stegmarkör | numbered marker |
| sticky note | fästis | as Acrobat sv («Lägg till fästis») |
| shape | form |  |
| line | linje |  |
| arrow | pil |  |
| rectangle | rektangel |  |
| ellipse | ellips |  |
| freehand / ink | frihand / bläck | «Rita» for the tool |
| strikeout | genomstrykning | «Stryk över» as a command |
| underline | understrykning | «Stryk under» as a command |
| object (page object) | objekt |  |
| nudge | flytta en bit |  |
| organize (pages) | Ordna | as in sv-apps.js |
| organizer (all pages view) | sidöversikt |  |
| page view | sidvy |  |
| metadata | metadata | «Dokumentegenskaper» in dialog titles |
| embedded | inbäddad |  |
| subset (font) | delmängd |  |
| OCR / recognise text | OCR / Känn igen text |  |
| rasterise | rastrera |  |
| blank page | tom sida |  |
| range (pages) | intervall |  |
| macro / workflow | makro / arbetsflöde |  |
| autosave | Spara automatiskt | noun «autosparning» |
| session | session |  |
| version | version | «Versioner» |
| revert | Återgå | «Återgå till originalet» |
| pane | ruta |  |
| zip | zip | «en .zip-fil» |
| Slop Drive | Slop Drive | brand: «till Slop Drive», «i Slop Drive», «från Slop Drive» |

## PDF editor (part B)

| English | Svenska | Note |
| --- | --- | --- |
| highlighter (tool) | Överstrykningspenna | the mark it leaves: «överstrykning» |
| whiteout | vit överstrykning | covers content, does not remove it (unlike «Maskera») |
| highlight box | markeringsruta |  |
| text highlight | textmarkering |  |
| redaction mark | maskeringsmarkering |  |
| bold / italic short labels | F / K | as Swedish Office |
| bring to front / send to back | Placera längst fram / Placera längst bak | «Flytta framåt» / «Flytta bakåt» one step |
| turn (object) | Vrid | «Rotera» stays for pages |
| resolve / reopen (comment) | Markera som löst / Öppna igen | state: «löst», «Lösta» |
| paragraph | stycke | «Styckeram» for the frame |
| lossless / lossy | förlustfri / med förlust |  |
| header / footer | sidhuvud / sidfot |  |
| anchor | fästpunkt |  |
| match case | Matcha gemener/versaler |  |
| regular expression | reguljärt uttryck | «Regex» as a short mode label |
| replay (saved edits) | Spela upp | «Ignorera» for discard |
| object kinds in sentences | indefinite, lower case | «Ta bort bild», «Markerad: bild» (colon avoids adjective agreement) |
| page positions | överst/nederst till vänster, i mitten, till höger | lower case in sentences |

## PhotoSlop

Tool names are compounds, as in Swedish Photoshop («Penselverktyg», «Trollstavsverktyg»); the short form («Pensel») is the
history step and palette word, so never strip a suffix to get it. Layer names the app gives new layers stay English
(they are the person's document content).

| English | Svenska | Note |
| --- | --- | --- |
| layer mask | lagermask |  |
| clipping mask | urklippsmask | «Skapa urklippsmask» |
| brush | pensel | tool «Penselverktyg»; preset «förinställd pensel» |
| brush tip | spets |  |
| pencil | penna |  |
| eraser | suddgummi |  |
| blend mode | blandningsläge | Normal, Mörkna, Multiplicera, Färgbränning, Ljusna, Raster, Färgskugga, Linjär skugga (addera), Täcka över, Mjukt ljus, Hårt ljus, Differens, Uteslutning, Nyans, Mättnad, Färg, Luminiscens |
| opacity / fill | opacitet / fyllning |  |
| marquee | markeringsram | «Rektangulär markeringsram» |
| magic wand | trollstav |  |
| eyedropper | pipett |  |
| clone stamp | klonstämpel |  |
| healing brush / spot healing brush | läkningspensel / punktläkningspensel |  |
| gradient | övertoning | «Övertoningsverktyg» |
| paint bucket | färgpyts |  |
| dodge / burn | Ljusa / Bränn |  |
| smudge | Smeta ut |  |
| sponge | svamp |  |
| canvas | arbetsyta | «Arbetsytans storlek» |
| image size | Bildstorlek |  |
| resample | omsampling | Närmaste granne, Bilinjär, Bikubisk |
| flatten image | Gör till ett lager |  |
| merge down | Sammanfoga nedåt |  |
| feather | mjuk kant |  |
| tolerance / fuzziness | tolerans |  |
| contiguous | Angränsande |  |
| sample all layers | Sampla alla lager |  |
| expand / contract (selection) | Utöka / Dra ihop |  |
| select inverse | Omvänd markering |  |
| select subject | Markera motiv | «Isolera motiv» for SlopIsolate |
| colour range | Färgområde |  |
| free transform | Fri omformning | «Omforma»; «Verkställ» to commit |
| flip horizontal / vertical | Vänd horisontellt / vertikalt |  |
| clockwise / counter clockwise | medurs / moturs |  |
| guides / grid / rulers / snap | stödlinjer / stödraster / linjaler / Fäst mot |  |
| swatches | färgrutor |  |
| character (panel) | Tecken |  |
| tracking / leading | spärrning / radavstånd |  |
| anti-aliasing | kantutjämning |  |
| warp text | Förvräng text | Båge, Valv, Utbuktning, Flagga, Våg, Stigande |
| rasterize type | Rastrera text |  |
| layer style | lagerstil | «Blandningsalternativ» |
| drop / inner shadow | Skugga / Inre skugga |  |
| outer / inner glow | Yttre / Inre glöd |  |
| stroke (style) | Linje |  |
| colour / gradient overlay | Färgöverlägg / Övertoningsöverlägg |  |
| bevel & emboss | Avfasning och relief |  |
| adjustments | Justeringar | Nivåer, Kurvor, Nyans/mättnad, Ljusstyrka/kontrast, Färgbalans, Svartvitt, Fotofilter, Tröskel, Posterisera, Övertoningsmappning |
| vibrance | Lyster |  |
| highlights / midtones | högdagrar / mellantoner |  |
| blur / sharpen / noise | oskärpa / Skärpa / brus | «Gaussisk oskärpa», «Oskarp mask» |
| preset | förinställning |  |
| auto retouch | Autoretusch | «Autoförbättra», «Porträttretusch», «Räta upp» (straighten) |
| red eye | röda ögon |  |
| develop (RAW) | framkalla | «Som tagen» for As shot |
| recovery (autosave) | återställning |  |
| options bar | alternativfält |  |
| Window (menu) | Fönster |  |

## File convert

| English | Svenska | Note |
| --- | --- | --- |
| X to Y (conversion) | X till Y | «Till PNG» |
| conversion | konvertering |  |
| route (chain of conversions) | kedja | «mellansteg» for in-between steps |
| options | Alternativ |  |
| clear | Rensa |  |
| selected | markerade |  |
| quality / bitrate | Kvalitet / bithastighet | «kbit/s» in prose |
| frame (video) / frame rate | bildruta / bildfrekvens | «nyckelbildruta» |
| fade in / out | Tona in / Tona ut |  |
| cut (trim) | Klipp |  |
| subtitles | undertexter | «Förskjut tiderna» |
| line endings / encoding | radslut / teckenkodning | «Identifiera» for Detect |
| separator | avgränsare | «lodstreck» for pipe |
| sheet / workbook | blad / arbetsbok |  |
| plain text | oformaterad text |  |
| speaker notes | talaranteckningar |  |
| picture PDF | bild-PDF |  |
| unzip | Packa upp |  |
| voucher (SIE) | verifikation |  |
| statement / transaction / value date / counterparty | kontoutdrag / transaktion / valutadag / motpart |  |
| track / waypoint | spår / vägpunkt |  |
| mesh / up axis | nät / uppåtaxel | 3D |
| video engine | videomotor |  |
| Finance / Maps and GPS / Other (groups) | Ekonomi / Kartor och GPS / Övrigt |  |

## Video and motion (SlopCut, Slop Effects, Reel Remix)

| English | Svenska | Note |
| --- | --- | --- |
| clip | klipp | plural «klipp»; «Dela klipp» |
| timeline | tidslinje |  |
| track | spår | «Videospår», «Ljudspår» |
| sequence | sekvens |  |
| media bin | mediebibliotek | the tab: «Media» |
| playhead | uppspelningshuvud |  |
| play / pause | Spela upp / Pausa |  |
| frame | bildruta | «Nästa bildruta» |
| frame rate (fps) | bildfrekvens | keep «fps» in compact labels |
| keyframe | nyckelbildruta |  |
| transition | övergång |  |
| title (text on video) | titel |  |
| captions / subtitles | undertexter |  |
| trim | Trimma |  |
| razor / split at playhead | Klipp / Dela vid uppspelningshuvudet |  |
| ripple delete | Ta bort och stäng luckan |  |
| snap / snapping | Fäst / fästning | «Fäst mot klipp» |
| marker | markör |  |
| in / out point | startpunkt / slutpunkt | «I/O» keys stay |
| fade in / fade out | Tona in / Tona ut | noun «intoning», «uttoning» |
| volume | volym |  |
| mute / solo | Stäng av ljud / Solo |  |
| speed | hastighet |  |
| aspect ratio | bildförhållande |  |
| resolution | upplösning |  |
| render / encode | rendera / koda | «Renderar…», «Exporterar video…» |
| opacity | opacitet |  |
| blend mode | blandningsläge |  |
| mask | mask |  |
| crop | Beskär |  |
| colour grade | färgkorrigering |  |
| look (colour preset) | look | «Looks» as in DaVinci sv; or «stil» in running text |
| preset | förinställning |  |
| template | mall |  |
| composition | komposition | Slop Effects |
| easing | easing | «Mjuk in», «Mjuk ut», «Mjuk in/ut» for ease in/out |
| graph editor | kurvredigerare |  |
| seed (random) | slumpfrö |  |
| blur / glow / shadow | Oskärpa / Glöd / Skugga |  |
| grain / vignette / glitch | Filmkorn / Vinjett / Glitch |  |
| waveform | vågform |  |
| shuffle | Blanda |  |
| beat (music) | takt | «Klipp i takt» |
| slideshow | bildspel |  |
| project | projekt |  |
| loop | Upprepa | the toggle; «loop» for a looping clip |

## Labels (SlopLabel)

| English | Svenska | Note |
| --- | --- | --- |
| label | etikett |  |
| barcode | streckkod |  |
| QR code | QR-kod |  |
| label stock (sheet / roll) | etikettmaterial (ark / rulle) |  |
| printer | skrivare |  |
| print job | utskriftsjobb |  |
| data merge / print from data | dataimport / Skriv ut från data | «Dokumentkoppling» only for mail merge proper |
| variable (field) | variabel |  |
| serial number / counter | löpnummer / räknare |  |
| column / row | kolumn / rad |  |
| margin / gap | marginal / mellanrum |  |
| align / distribute | Justera / Fördela | «Justera vänster», «Centrera» |
| group / ungroup | Gruppera / Dela upp grupp |  |
| lock / unlock | Lås / Lås upp |  |
| grid / ruler / guide | rutnät / linjal / stödlinje |  |
| element (object on a label) | objekt |  |
| copies | kopior | «Antal kopior» |

## Wave 1 terms (SlopCut, SlopLabel, Slop Effects, Reel Remix)

| English | Svenska | Note |
| --- | --- | --- |
| inspector (panel) | Granskare | SlopCut's right panel |
| program monitor | programmonitor |  |
| colour matte | färgplatta |  |
| cross dissolve | övertoning | «Tona via svart/vitt» for dip to black/white |
| wipe | svep |  |
| lower third | namnskylt |  |
| random edit | slumpklippning | «Blanda om» for reshuffle |
| cut (a span of a random edit or reel) | klipp | same word as clip; «klippning» for the whole edit |
| slot (a cell of a layout) | plats |  |
| reel | reel | «Stående 9:16-reel» |
| effect layer | effektlager | «slumpeffektlager» for the random one |
| safe areas | säkra områden |  |
| shuttle (J/K/L) | spola | «Spola bakåt (J)» |
| ripple edit tool | Ripple-verktyg |  |
| null layer | nollager |  |
| solid layer | färglager |  |
| anchor point | fästpunkt | as the PDF part |
| feather (mask) | mjuk kant |  |
| quiet zone (barcode) | frizon |  |
| bearer bars | bärlister |  |
| human readable (barcode text) | läsbar text |  |
| check digit | kontrollsiffra |  |
| symbology | symbologi |  |
| record (a data row) | post | «Föregående post», «Skriv ut post 3» |
| prompt (variable asked at print) | fråga | «Fråga vid utskrift» |
| thermal transfer / direct thermal | termotransfer / direkt termo |  |
| darkness (printer) | svärta |  |
| config (saved setup) | konfiguration |  |
| print form link | länk till utskriftsformulär |  |
| inverse box | inverterad ruta |  |
| look (colour) | look | «Färglook», «Looks» |
| pace | tempo |  |

## Slop Press, SlopVector, Slop Slides, Slop Font (wave 1, group C)

| English | Svenska | Note |
| --- | --- | --- |
| place (a file, art, image) | Montera | as Adobe sv (InDesign, Illustrator): «Montera…», «Montera från Slop Drive…», «Monterade text» |
| master page | mallsida | «Ny mallsida», «Använd mallsida» |
| paragraph style / character style | styckeformat / teckenformat | as InDesign sv |
| swatch / Swatches panel | färgruta / Färgrutor |  |
| spread / facing pages | uppslag |  |
| text frame / image frame | textram / bildram |  |
| fill / stroke | fyllning / linje | «Fyllningsfärg», «Linjefärg», «Linjetjocklek»; Slides' shape «outline» is «kontur» |
| leading / tracking | radavstånd / spärrning | short labels «Radavst.», «Spärr.» |
| text wrap | textombrytning |  |
| overset text | överskjutande text |  |
| autoflow | flöda automatiskt |  |
| thread (text frames) | länka | «Visa textlänkar» |
| gutter | spaltavstånd | short label «Avst.» |
| inset (frame) | indrag / inre marginal |  |
| drop cap | anfang |  |
| baseline grid | baslinjeraster |  |
| composer | disposition | «Styckedisposition», «Enradsdisposition» |
| bleed / slug | utfall / informationsområde | marks: skärmärken, utfallsmärken, passmärken |
| pasteboard | montagebord |  |
| guide / smart guides | stödlinje / smarta stödlinjer |  |
| grid (view) | stödraster | «Fäst mot stödraster» |
| ruler | linjal |  |
| snap | Fäst |  |
| Type / Object / Window menus | Text / Objekt / Fönster |  |
| Document Setup | Dokumentinställningar (Press), Dokumentformat (Vector) | as each Adobe app |
| artboard | rityta |  |
| gradient | övertoning | «Färgstopp» for a stop |
| anchor point | ankarpunkt |  |
| path | bana | «Sammansatt bana» |
| clipping mask | urklippsmask | «Skapa/Frigör urklippsmask» |
| Pathfinder | Banhanterare | Förena / Minus framför / Snitt / Uteslut |
| expand / release | Utvidga / Frigör |  |
| reflect / flip | Spegla / Vänd vågrätt, Vänd lodrätt |  |
| blend mode | blandningsläge |  |
| miter / cap / join | gering / ände / hörn |  |
| eyedropper / scissors / pencil / paintbrush | Pipett / Sax / Blyertspenna / Pensel |  |
| buffer (Slop buffer) | buffert | «Kopiera till bufferten» |
| Slopify | Slopifiera | coined verb |
| slide (Slides) | bild | as PowerPoint sv: «Ny bild», «Bild 3 av 10» |
| presenter view / speaker notes | presentatörsvy / talaranteckningar |  |
| present / slide show | Presentera / bildspel |  |
| transition / animation | övergång / animering | «Med föregående», «Vid klick» |
| layout (slide) | layout | «Rubrik och innehåll», «Endast rubrik», «Tom» |
| template | mall | «Ny från mall…», «Mina mallar» |
| glyph | glyf | plural «glyfer» |
| kerning / kerning pair | kerning / kerningpar |  |
| ascender / descender / cap height / x-height | uppstapel / nedstapel / versalhöjd / x-höjd |  |
| type test (Font) | provtext |  |
| handwriting sheet | handskriftsark |  |
| trace (a picture) | Spåra |  |
| contour (glyph) | kontur | «Förena markerade konturer» |
| font weight names | Tunn … Svart in Slop Font's weight list; kept English where they are a typeface's style name (Vector) |  |

## Shared across apps (wave 1)

| English | Svenska | Note |
| --- | --- | --- |
| template | mall | «Mina mallar», «Från mall…», «Spara som mall» |
| discard (unsaved changes) | Ignorera | «Ignorera ändringarna?» |
| config (settings file) | konfiguration | «Importera konfiguration…» |
| tag | tagg | «Taggar», «otaggade» |
| duplicate (noun, exact copy) | dubblett | «Hitta dubbletter»; the verb stays «Duplicera» |
| grid / list / compact (view) | Rutnät / Lista / Kompakt |  |
| backup / back up | säkerhetskopia / Säkerhetskopiera | «Återställ från en säkerhetskopia» |
| deselect | Avmarkera | «Avmarkera alla» |
| invert selection | Invertera markering |  |
| selection | markering |  |
| properties (panel) | Egenskaper |  |
| pan (view, tool) | Panorera |  |
| transparent | Transparent | shorter than «Genomskinlig», fits button rows |

## Slop Tables

| English | Svenska | Note |
| --- | --- | --- |
| spreadsheet | kalkylark | «Namnlöst kalkylark» |
| workbook | arbetsbok |  |
| sheet | blad | menu «Blad»; «Lägg till blad» |
| cell | cell |  |
| formula / formula bar | formel / formelfält |  |
| name box | namnruta |  |
| number format | Talformat | General «Allmänt», Currency «Valuta», Custom «Anpassat» |
| clear contents | Radera innehåll | as Excel; delete stays «Ta bort» |
| freeze / unfreeze panes | Lås fönsterrutor / Lås upp fönsterrutor |  |
| pivot table | pivottabell |  |
| chart | diagram | column «Stapel», bar «Liggande stapel», line «Linje», pie «Cirkel» |
| legend (chart) | förklaring |  |
| series | serie |  |
| range (cells) | område | «Källområde», «Dataområde» |
| refresh | Uppdatera |  |
| sum / count / average | Summa / Antal / Medel |  |

## Slop Docs

| English | Svenska | Note |
| --- | --- | --- |
| bold / italic (full label) | Fet / Kursiv | F / K only as short labels |
| underlined (character format) | Understruken | the PDF command stays «Stryk under» |
| clear formatting | Rensa formatering |  |
| font size | teckenstorlek | «Öka/Minska teckenstorleken» |
| align left / centre / right | Vänsterjustera / Centrera / Högerjustera | menu items: Vänster, Centrerat, Höger |
| justify | Marginaljustera | menu item «Marginaljusterat» |
| alignment | Justering |  |
| bulleted / numbered list | Punktlista / Numrerad lista |  |
| paragraph style | Styckeformat |  |
| normal text | Normal text |  |
| title / heading (style) | Rubrik / Rubrik 1–3 |  |
| quote (style) | Citat |  |
| outline (document) | Disposition | as Word sv |
| section | avsnitt | «Lägg till avsnitt» |
| promote / demote (heading) | Höj nivå / Sänk nivå |  |
| collapse / expand | Komprimera / Expandera |  |
| caret | markören |  |
| seed (random) | frö | «Slumpa igen» for reshuffle |
| page break | sidbrytning |  |
| wrap text / inline (image) | Radbyte / I nivå med texten | as Word sv |
| different first page | Annorlunda förstasida | as Word sv |
| plain text | oformaterad text |  |
| buffer (Slop buffer) | bufferten | «Kopiera till bufferten» |
| untitled document | Namnlöst dokument |  |

## Slop Drive

| English | Svenska | Note |
| --- | --- | --- |
| Trash | Papperskorgen | «Flytta till papperskorgen», «Töm papperskorgen»; short button «Kasta» |
| Starred | Stjärnmärkta | place name |
| star / unstar | Stjärnmärk / Ta bort stjärna |  |
| Quick look | Snabbtitt | as macOS sv |
| delete forever | Ta bort permanent |  |
| local drive | lokal enhet | sidebar heading «Enheter» |
| local folder | lokal mapp |  |
| connect / disconnect (folder) | Anslut / Koppla från |  |
| allow access | Ge åtkomst | state «Åtkomst nekad» |
| details panel / info panel | detaljpanel / Infopanel |  |
| kind (file kind) | typ | «Alla» in the narrow kind filter |
| MIME type | MIME-typ |  |
| disk usage | Diskanvändning |  |
| treemap / sunburst | trädkarta / solstråle |  |
| cache | cache | «Rensa lokal cache…» |
| uploaded (source) | Uppladdad |  |
| faces and people | Ansikten och personer | «Hitta ansikten» |
| playback | uppspelning | «Spela upp», «Pausa», «Spelas nu» |

## Slop AI

| English | Svenska | Note |
| --- | --- | --- |
| chat (noun) | chatt | «Ny chatt», «Chattar» |
| model (AI) | modell |  |
| load / unload (a model) | Läs in / Ta ur | «Läser in…» |
| token(s) | token | same in the plural; «token/s» |
| persona | persona |  |
| system prompt | systemprompt |  |
| temperature (AI) | temperatur |  |
| Control apps (agent tools) | Styr appar |  |
| mini-app | miniapp | «Ny miniapp», «Miniappsbyggare» |
| sandboxed | sandlåda | «🔒 sandlåda» |
| workspace | arbetsyta |  |
| demo engine / real engine | demomotor / riktig motor |  |
| benchmark | prestandatest |  |
| spec card | systemkort |  |
| regenerate | Generera igen |  |
| verdict (can it run) | bedömning |  |
| Can my PC run it? | Klarar min dator det? |  |

## Slop 3D

| English | Svenska | Note |
| --- | --- | --- |
| mesh | nät | «Redigera nät» |
| vertex / edge / face | hörn / kant / yta | modes «Hörnläge», «Kantläge», «Ytläge» |
| edge loop | kantslinga |  |
| extrude | Extrudera |  |
| subdivide | Dela in |  |
| flip normals | Vänd normaler |  |
| wireframe | Trådmodell |  |
| snap (step) | Fäst / fäststeg |  |
| orbit (camera) | kretsa |  |
| frame (selection in view) | Rama in | «Rama in markering», «Rama in allt» |
| viewport (3D) | 3D-vy |  |
| outliner | Scenträd |  |
| scene | scen |  |
| transform | Transformering | the command group is «Transformera» |
| ungroup | Dela upp grupp |  |
| ambient / directional light | Omgivningsljus / Riktat ljus |  |
| render | Rendera |  |
| roughness / metallic / opacity | Grovhet / Metallisk / Opacitet |  |
| texture | textur |  |
| primitive | primitiv |  |

## SlopIsolate

| English | Svenska | Note |
| --- | --- | --- |
| cut out (background removal) | Frilägga | noun «friläggning»; «Frilägger…» |
| subject (of a photo) | motiv |  |
| mask | mask |  |
| matte (video alpha mask) | alfamask |  |
| keep / remove brush | Behåll-pensel / Ta bort-pensel | buttons «Behåll» / «Ta bort» |
| threshold | Tröskel |  |
| softness | Mjukhet |  |
| feather | Ludd | as Photoshop sv |
| decontaminate colours | Rensa färger | as Photoshop sv |
| refine edges | Förfina kanter |  |
| hardness (brush) | Hårdhet |  |
| drop shadow | Slagskugga | the section is «Skugga» |
| gradient | Övertoning |  |
| offset X / Y | Förskjutning X / Y |  |
| padding | Marginal |  |
| mixed (values differ) | Blandat |  |
| queue / queued | kö / I kö |  |
| look (background, shadow, crop) | utseende |  |
| frame (video) | bildruta |  |
| scrub (video) | Spola |  |
| batch (of images) | omgång |  |

## Slop Gallery

| English | Svenska | Note |
| --- | --- | --- |
| photo / photos | foto / foton |  |
| library (photo library) | bibliotek |  |
| album | album | plural «album» |
| favourite / favourites | favorit / Favoriter |  |
| people (view) | Personer |  |
| like / dislike | Gilla / Ogilla | «gillad», «ogillad» |
| slideshow | bildspel |  |
| reel (short video) | reel | «Gör reel» |
| face detection | ansiktsdetektering | detection only, no recognition |
| pace | tempo |  |
| aspect | bildformat | «16:9 liggande», «9:16 stående» |
| swipe deck (sort mode) | svepläge |  |

| invoice / credit note | faktura / kreditfaktura | «Fakturautkast» for a draft invoice |
| quote | offert |  |
| order (sales) / purchase order | order / inköpsorder | «Order» is the same in singular and plural |
| delivery note | följesedel |  |
| fulfil (an order) / fulfilled | leverera / levererad |  |
| confirmed (order status) | Bekräftad |  |
| issue (a document) / issued | utfärda / utfärdad |  |
| void (a document) | makulera / makulerad |  |
| post (to the books) / posted | bokföra / bokförd | «Bokför» on buttons |
| journal / journal entry | grundbok / verifikation | «Vänd» to reverse an entry |
| general ledger | huvudbok |  |
| trial balance | råbalans |  |
| profit and loss / balance sheet | resultaträkning / balansräkning |  |
| debit / credit | debet / kredit |  |
| opening balances | ingående balanser |  |
| tax (VAT) | moms | «Ingående moms» for tax to reclaim on expenses |
| due date / overdue | förfallodatum / förfallen |  |
| statement (customer account) | kontoutdrag |  |
| payment reminder | påminnelse |  |
| expense / mileage claim | utgift / milersättning |  |
| timesheet / billable | tidrapport / debiterbar |  |
| inventory (app) / stock (tab) | Lager / Lagersaldo |  |
| stock count | inventering |  |
| SKU / reorder level | artikelnr / beställningspunkt |  |
| lead / pipeline (CRM) | lead / säljtratt |  |
| numbering series | nummerserie |  |
| sample seed | frö | for the random samples of the business apps |
