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

## Wave 1, group F (tools and utilities)

| English | Svenska | Note |
| --- | --- | --- |
| Slopographic home (brand link) | Slopographic start | as the PDF app; not «startsida» |
| 100% local (badge) | 100 % lokalt |  |
| Get more (download a model) | Hämta mer | «Hämta mer…»; every AI and model page |
| model (AI) | modell | «Det här verktyget behöver en modell», «Språk och modell» |
| detect automatically (language) | Identifiera automatiskt |  |
| hash / checksum | hash / kontrollsumma | «Kopiera hash», «Förväntad hash»; the app name is «Kontrollsumma» |
| serial number | serienummer | «Serienummerräknare» |
| recognised text | igenkänd text | OCR |
| searchable PDF | sökbar PDF |  |
| transcribe / transcript | Transkribera / transkription | «Transkribera igen» |
| subtitles | undertexter | «Webbundertexter (.vtt)» |
| record / recording | Spela in / inspelning | «Stoppa inspelningen» |
| discard (a recording) | Släng |  |
| resume | Fortsätt | after Pause |
| countdown | nedräkning |  |
| webcam | webbkamera |  |
| trim | Trimma |  |
| playhead | uppspelningshuvud |  |
| frame (video) / frame rate | bildruta / bildfrekvens |  |
| microphone | mikrofon |  |
| denoise | Brusreducering | tool name; «Filtrerar…» |
| portrait blur | Porträttoskärpa | «Oskärpa:» for the strength |
| auto tags / suggest tags | Automatiska taggar / Föreslå taggar |  |
| tag (noun / verb) | tagg / tagga |  |
| before / after | Före / Efter |  |
| like / dislike (photos) | Gilla / Ogilla | «Gillade», «Osorterade» |
| upscale | Skala upp | «uppskalad», noun «uppskalning» |
| resize | Ändra storlek | «Ändra storlek på {n} filer» |
| keep aspect ratio | Behåll proportioner |  |
| fit / cover / stretch | Anpassa / Täck (beskär) / Sträck ut |  |
| long edge | långsida |  |
| resampling | omsampling |  |
| preset (saved settings) | förval |  |
| custom size / target size | Anpassad storlek / Målstorlek |  |
| transparent | genomskinlig |  |
| output (settings group) | Utdata |  |
| queue | kö |  |
| lossless | förlustfri |  |
| tile (processing) | ruta |  |
| metadata remover | Ta bort metadata | SlopClean; «Kopiera och rensa» |
| removed / kept | Borttagen / Kvar |  |
| location (GPS) | Plats (GPS) |  |
| colour profile (ICC) | Färgprofil (ICC) |  |
| maker notes | Tillverkarens anteckningar |  |
| date taken | Fotograferingsdatum |  |
| chunk (PNG/WebP) | segment |  |
| mailbox (.mbox) | brevlåda |  |
| email (sample) | mejl / e-post | «exempelmejl», «e-postfil» |
| attachment | bilaga | «Bilagor ({n})» |
| Cc / Bcc | Kopia / Hemlig kopia | as Outlook sv |
| remote images / embedded images | Fjärrbilder / inbäddade bilder |  |
| sort A to Z | A till Ö |  |
| Start (empty panel section) | Kom igång |  |
| page header / margins | Sidhuvud / Marginaler | html2pdf |
| portrait / landscape (paper) | Stående / Liggande |  |
| background graphics | Bakgrundsgrafik |  |
| depth / depth map | djup / djupkarta | Image to 3D |
| mesh / point cloud | Nät / Punktmoln | «Höjdfältsnät»; «Splats» stays |
| smoothing | Utjämning |  |
| subject (vs background) | Motiv |  |
| orbit (3D view) | rotera | «Dra för att rotera» |
| compare | Jämför | Slop Compare |
| side by side / unified | Sida vid sida / Samlad |  |
| ignore whitespace / case | Ignorera blanksteg / skiftläge |  |
| threshold | tröskel |  |
| swap A and B | Byt plats på A och B |  |
| key column | nyckelkolumn |  |
| path (JSON) | Sökväg |  |
| node / wire / graph | nod / tråd / graf | Slopnodes |
| value / formula / output (node types) | Värde / Formel / Utdata |  |
| canvas (graph or drawing) | arbetsyta / rityta | graph / paint |
| loop (cycle) | slinga |  |
| actual size | Verklig storlek |  |
| offset (byte position) | position | «Gå till position» |
| inspector | Granskare |  |
| executable | körbar fil |  |
| binary data | binära data |  |
| notebook | anteckningsbok | plural «anteckningsböcker» |
| pin / unpin | Fäst / Lossa |  |
| trash (Slop Drive) | papperskorg | «Flytta till papperskorgen»; the button verb is «Släng» |
| callout (Markdown note block) | faktaruta | the PDF annotation stays «pratbubbla» |
| divider | avdelare |  |
| explorer / open editors | Utforskaren / Öppna redigerare | as VS Code sv |
| extensions / snippets | Tillägg / Kodsnuttar |  |
| formatter | Formaterare | «Formatera dokument» |
| language mode | språkläge |  |
| line wrap | radbrytning |  |
| Ln, Col | Rad, kol |  |
| read only | Skrivskyddad |  |
| copy path | Kopiera sökväg |  |
| plain text | Oformaterad text |  |
| console | Konsol |  |
| library (music) | bibliotek |  |
| playlist / track | spellista / spår | «3 spår» |
| now playing | Spelas nu |  |
| shuffle / repeat / mute | Blanda / Upprepa / Ljud av |  |
| seek | Spola |  |
| playback speed | Uppspelningshastighet | short «Hastighet» |
| workflow / step | arbetsflöde / steg |  |
| template | mall |  |
| run (noun / button) | körning / Kör |  |
| share link | Delningslänk | button «Dela länk» |
| pick a colour | Hämta | «Hämta från skärmen» |
| eyedropper | pipett |  |
| palette (colours) | palett |  |
| harmony (colours) | harmoni | Komplementär / Analog / Triad / Tetrad / Kvadrat / Monokrom |
| contrast check | Kontrastkontroll | Godkänd / Underkänd |
| QR: error correction / quiet zone / module | felkorrigering / tyst zon / modul |  |
| raw text | råtext |  |
| logo | logotyp |  |
| buffer (SlopBuffer) | bufferten | «Kopiera till bufferten» |
| primary / secondary colour (Paint) | förgrundsfärg / bakgrundsfärg | as MS Paint sv |
| Tool Box / Color Box | Verktygslåda / Färgruta |  |
| Flip/Rotate / Stretch/Skew | Vänd/rotera / Töj/lutning |  |
| magnifier / airbrush / eraser | Förstoringsglas / Sprayburk / Suddgummi |  |
| free-form select | Fri markering |  |
| clipboard | Urklipp | as Windows sv |
| hue / saturation / luminosity | nyans / mättnad / ljushet |  |
| spreadsheet / sheet | kalkylblad / blad |  |
| table style | Tabellformat | Randig / Enkel / Rutnät / Kompakt |
| (Blanks) | (Tomma) | filter list |
| watermark (verb) | vattenstämpla | «Vattenstämpla 3 bilder» |
| nine positions | Uppe till vänster … Nere till höger, Mitten |  |
| opacity | Opacitet |  |
| paste (a Paste item) | klipp | «Nytt klipp», «Bildklipp» |
| expires | Upphör |  |
| paper tape | pappersremsa | Slopculator |
| expression / variable | uttryck / variabel |  |
| exchange rate | växelkurs |  |
