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
