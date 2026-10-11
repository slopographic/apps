/* Slop PDF — the built-in sample document, “Sloppo's Guide to Goo”, generated with pdf-lib (includes a fillable form). */
(function () {
  'use strict';
  var SP = window.SP, U = SP.util, E = SP.engine;

  /* --------------------------------------------------------- sample PDF */
  E.makeSample = async function () {
    var L = PDFLib, doc = await L.PDFDocument.create();
    var H = doc.embedStandardFont(L.StandardFonts.HelveticaBold), R = doc.embedStandardFont(L.StandardFonts.Helvetica), T = doc.embedStandardFont(L.StandardFonts.TimesRomanItalic);
    var ink = L.rgb(0.04, 0.04, 0.04), bone = L.rgb(0.945, 0.929, 0.894), lime = L.rgb(0.831, 1, 0.227), pink = L.rgb(1, 0.37, 0.64), cyan = L.rgb(0.22, 0.84, 1), grey = L.rgb(0.35, 0.35, 0.35);
    var blob = 'M100 0C100 0 30 78 30 122a70 70 0 0 0 140 0C170 78 100 0 100 0z';
    function para(pg, text, x, y, w, size, font, color) {
      var words = text.split(' '), line = '', lh = size * 1.45;
      words.forEach(function (wd) {
        var test = line ? line + ' ' + wd : wd;
        if (font.widthOfTextAtSize(test, size) > w && line) { pg.drawText(line, { x: x, y: y, size: size, font: font, color: color }); y -= lh; line = wd; } else line = test;
      });
      if (line) { pg.drawText(line, { x: x, y: y, size: size, font: font, color: color }); y -= lh; }
      return y;
    }
    function footer(pg, n) {
      pg.drawText('SLOPOGRAPHIC · FIELD MANUAL Nº 001', { x: 56, y: 30, size: 7.5, font: H, color: grey });
      pg.drawText(String(n), { x: pg.getWidth() - 64, y: 30, size: 9, font: H, color: grey });
    }
    // 1 — cover
    var p1 = doc.addPage(E.SIZES.a4);
    p1.drawRectangle({ x: 0, y: 0, width: p1.getWidth(), height: p1.getHeight(), color: ink });
    p1.drawSvgPath(blob, { x: 330, y: 760, scale: 1.6, color: lime });
    p1.drawSvgPath('M60 140a40 40 0 0 0 32 39', { x: 330, y: 760, scale: 1.6, borderColor: L.rgb(1, 1, 1), borderWidth: 6, borderLineCap: L.LineCapStyle.Round, borderOpacity: 0.85 });
    p1.drawCircle({ x: 120, y: 420, size: 26, color: pink }); p1.drawCircle({ x: 175, y: 470, size: 12, color: cyan }); p1.drawCircle({ x: 92, y: 488, size: 7, color: lime });
    p1.drawText('FIELD MANUAL Nº 001', { x: 56, y: 330, size: 11, font: H, color: lime });
    p1.drawText("Sloppo's Guide", { x: 56, y: 270, size: 50, font: H, color: bone });
    p1.drawText('to Goo', { x: 56, y: 214, size: 50, font: H, color: bone });
    p1.drawText('Everything a well-adjusted slime needs to know.', { x: 56, y: 172, size: 16, font: T, color: bone });
    p1.drawRectangle({ x: 56, y: 96, width: 140, height: 26, color: lime });
    p1.drawText('SLOPOGRAPHIC', { x: 66, y: 104, size: 11, font: H, color: ink });
    // 2 — what is goo
    var p2 = doc.addPage(E.SIZES.a4);
    p2.drawRectangle({ x: 0, y: 0, width: p2.getWidth(), height: p2.getHeight(), color: bone });
    p2.drawText('01', { x: 56, y: 760, size: 13, font: H, color: pink });
    p2.drawText('What is goo?', { x: 56, y: 722, size: 34, font: H, color: ink });
    var y = para(p2, 'Goo is any substance that is too thick to pour politely and too thin to stack. Scientists call it a non-Newtonian fluid. Sloppo calls it home, lunch and, on Sundays, a bed.', 56, 680, 483, 12.5, R, ink);
    y = para(p2, 'This guide covers the four classical goos, how to store them, and what to do when your goo develops opinions. Use the Slop PDF editor to reorder, rotate, sign or stamp these pages: everything happens in your browser.', 56, y - 10, 483, 12.5, R, ink);
    p2.drawText('Viscosity by goo type', { x: 56, y: y - 34, size: 15, font: H, color: ink });
    var bars = [['Lime slime', 0.92, lime], ['Pink ooze', 0.64, pink], ['Blue gel', 0.41, cyan], ['Grey sludge', 0.78, grey]], by = y - 70;
    bars.forEach(function (b) {
      p2.drawText(b[0], { x: 56, y: by + 5, size: 11, font: R, color: ink });
      p2.drawRectangle({ x: 160, y: by, width: 360, height: 20, color: L.rgb(0.88, 0.86, 0.81) });
      p2.drawRectangle({ x: 160, y: by, width: 360 * b[1], height: 20, color: b[2] });
      p2.drawText(Math.round(b[1] * 100) + '%', { x: 165 + 360 * b[1] - 34, y: by + 6, size: 9, font: H, color: ink });
      by -= 34;
    });
    p2.drawSvgPath(blob, { x: 420, y: by - 10, scale: 0.55, color: lime, borderColor: ink, borderWidth: 3 });
    p2.drawText('Fig. 1 — Sloppo, at rest.', { x: 56, y: by - 60, size: 11, font: T, color: grey });
    footer(p2, 2);
    // 3 — the goo spectrum (landscape)
    var p3 = doc.addPage([841.89, 595.28]);
    p3.drawRectangle({ x: 0, y: 0, width: p3.getWidth(), height: p3.getHeight(), color: L.rgb(1, 1, 1) });
    p3.drawText('02', { x: 56, y: 530, size: 13, font: H, color: cyan });
    p3.drawText('The goo spectrum', { x: 56, y: 494, size: 34, font: H, color: ink });
    para(p3, 'A landscape page, so you can try rotating it in the organizer. Each swatch below is a vector shape: zoom in all you like.', 56, 458, 700, 12.5, R, grey);
    var sw = [[lime, 'LIME', 'Classic. Glows faintly.'], [pink, 'BUBBLEGUM', 'Sticky. Smells of 1997.'], [cyan, 'GLACIER', 'Cold, polite, wobbly.'], [L.rgb(1, 0.62, 0.11), 'MARMALADE', 'Bitter. Rare. Prized.']];
    sw.forEach(function (s, i) {
      var x = 56 + i * 186;
      p3.drawRectangle({ x: x, y: 230, width: 170, height: 170, color: s[0] });
      p3.drawCircle({ x: x + 120, y: 350, size: 22, color: L.rgb(1, 1, 1), opacity: 0.55 });
      p3.drawText(s[1], { x: x, y: 204, size: 13, font: H, color: ink });
      p3.drawText(s[2], { x: x, y: 186, size: 10.5, font: R, color: grey });
    });
    p3.drawLine({ start: { x: 56, y: 140 }, end: { x: 786, y: 140 }, thickness: 2, color: ink, dashArray: [6, 6] });
    p3.drawText('Warmer  >>', { x: 720, y: 120, size: 10, font: H, color: ink });
    footer(p3, 3);
    // 4 — license form
    var p4 = doc.addPage(E.SIZES.a4);
    p4.drawRectangle({ x: 0, y: 0, width: p4.getWidth(), height: p4.getHeight(), color: bone });
    p4.drawText('03', { x: 56, y: 760, size: 13, font: H, color: L.rgb(0.45, 0.6, 0) });
    p4.drawText('Goo licence application', { x: 56, y: 722, size: 30, font: H, color: ink });
    para(p4, 'A real fillable form. Open the Forms tool to fill it in, then sign it with the Sign tool.', 56, 690, 483, 12, R, grey);
    var form = doc.getForm();
    var labels = [['Applicant name', 'applicant', 620], ['Favourite goo', 'favourite', 560]];
    labels.forEach(function (l) {
      p4.drawText(l[0], { x: 56, y: l[2] + 30, size: 10, font: H, color: ink });
      var tf = form.createTextField(l[1]);
      tf.addToPage(p4, { x: 56, y: l[2], width: 483, height: 24, borderColor: ink, borderWidth: 1, backgroundColor: L.rgb(1, 1, 1) });
    });
    p4.drawText('Goo grade', { x: 56, y: 530, size: 10, font: H, color: ink });
    var dd = form.createDropdown('grade');
    dd.addOptions(['Starter slime', 'Advanced ooze', 'Master of muck']);
    dd.addToPage(p4, { x: 56, y: 500, width: 220, height: 24, borderColor: ink, borderWidth: 1, backgroundColor: L.rgb(1, 1, 1) });
    var cb = form.createCheckBox('agree');
    cb.addToPage(p4, { x: 56, y: 450, width: 16, height: 16, borderColor: ink, borderWidth: 1, backgroundColor: L.rgb(1, 1, 1) });
    p4.drawText('I promise to keep my goo hydrated and never feed it after midnight.', { x: 82, y: 454, size: 11, font: R, color: ink });
    p4.drawLine({ start: { x: 56, y: 330 }, end: { x: 300, y: 330 }, thickness: 1, color: ink });
    p4.drawText('Signature', { x: 56, y: 314, size: 9, font: H, color: grey });
    p4.drawLine({ start: { x: 340, y: 330 }, end: { x: 539, y: 330 }, thickness: 1, color: ink });
    p4.drawText('Date', { x: 340, y: 314, size: 9, font: H, color: grey });
    p4.drawSvgPath(blob, { x: 470, y: 250, scale: 0.4, color: pink });
    footer(p4, 4);
    form.updateFieldAppearances(R);
    doc.setTitle("Sloppo's Guide to Goo"); doc.setAuthor('Sloppo'); doc.setSubject('A Slopographic field manual'); doc.setKeywords(['goo', 'slime', 'slopographic']);
    doc.setProducer('Slop PDF · slopographic.com/pdf'); doc.setCreator('Slop PDF');
    return doc.save();
  };
})();
