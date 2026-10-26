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
