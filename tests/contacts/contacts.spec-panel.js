/* Slop Contacts detail panel and photos in the app: row click opens the preview, Edit switches the panel to the form in
 * place, Save and Cancel, Duplicate, Delete, the unsaved-form guard, bulk actions with the panel open, a photo from the
 * file picker (resized to 256 px JPEG), a link shown as initials, the desktop column and the 390 px bottom sheet. */
(function () {
  'use strict';
  const { describe, it, expect, sleep, waitFor } = SlopTest;

  /** Load the real app in the first test frame with a known list. */
  async function bootWith(list) {
    await CT.clearDrafts();
    const fr = document.getElementById('app');
    fr.src = 'about:blank';
    await waitFor(() => fr.contentWindow && fr.contentWindow.location.href === 'about:blank', { timeout: 5000 });
    fr.src = '../../contacts/index.html';
    await waitFor(() => fr.contentWindow && fr.contentWindow.location.pathname.endsWith('/contacts/index.html') && fr.contentWindow.SlopContacts && fr.contentWindow.SlopContacts.ready, { timeout: 30000 });
    const win = fr.contentWindow;
    win.SlopContacts.state.setList(list);
    await sleep(20);
    return win;
  }
  const LIST = () => [
    CT.make({ id: 'p1', name: { given: 'Ann', family: 'Lee' }, phones: [{ value: '+44 7700 900123', types: ['CELL'] }],
      emails: [{ value: 'ann@example.com', types: ['HOME'] }], groups: ['Friends'], note: 'Met at the fair' }),
    CT.make({ id: 'p2', name: { given: 'Bob', family: 'Ray' }, org: 'Globex', emails: [{ value: 'bob@globex.com' }] }),
    CT.make({ id: 'p3', name: { given: 'Cy' } }),
  ];
  const $ = (win, id) => win.document.getElementById(id);
  const rowCount = (win) => win.document.querySelectorAll('#rows .row').length;
  const foot = (win, label) => [...win.document.querySelectorAll('#detailFoot button')].find((b) => b.textContent === label);
  const dlgButton = (win, label) => [...win.document.querySelectorAll('.sui-dlg button')].find((b) => b.textContent === label);
  const openRow = (win, id) => win.document.querySelector(`.row[data-id="${id}"] .open`);
  const pngFile = (w, h, name = 'pic.png') => new Promise((res) => {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const g = cv.getContext('2d');
    g.fillStyle = '#c33'; g.fillRect(0, 0, w, h);
    cv.toBlob((b) => res(new File([b], name, { type: 'image/png' })), 'image/png');
  });

  describe('detail panel', () => {
    it('a row click opens the panel with a preview of that contact, and the list stays', async () => {
      const win = await bootWith(LIST());
      expect($(win, 'detail').hidden).toBeTruthy();
      openRow(win, 'p1').click();
      expect($(win, 'detail').hidden).toBeFalsy();
      const body = $(win, 'detailBody').textContent;
      expect(body).toContain('Ann Lee');
      expect(body).toContain('+44 7700 900123');
      expect(body).toContain('ann@example.com');
      expect(body).toContain('Friends');
      expect(body).toContain('Met at the fair');
      expect(rowCount(win)).toBe(3);
      expect(win.document.querySelectorAll('.row.is-open')).toHaveLength(1);
    });
    it('clicking another row switches the panel and the list is not closed', async () => {
      const win = await bootWith(LIST());
      openRow(win, 'p1').click();
      openRow(win, 'p2').click();
      expect($(win, 'detailBody').textContent).toContain('Bob Ray');
      expect($(win, 'detailBody').textContent).toContain('Globex');
      expect(rowCount(win)).toBe(3);
      expect(win.document.querySelector('.row.is-open').dataset.id).toBe('p2');
    });
    it('Edit switches to the form in place; Save stores the change and shows the preview again', async () => {
      const win = await bootWith(LIST());
      openRow(win, 'p2').click();
      foot(win, 'Edit').click();
      expect(win.document.querySelector('#detailBody .ed')).toBeTruthy();
      expect(rowCount(win)).toBe(3);
      win.document.querySelector('#detailBody input[aria-label="Given name"]').value = 'Robert';
      foot(win, 'Save').click();
      await sleep(20);
      expect(win.SlopContacts.state.byId('p2').name.given).toBe('Robert');
      expect($(win, 'detailBody').textContent).toContain('Robert Ray');
      expect(win.document.querySelector('#detailBody .ed')).toBeFalsy();
    });
    it('Cancel leaves the contact unchanged', async () => {
      const win = await bootWith(LIST());
      openRow(win, 'p1').click();
      foot(win, 'Edit').click();
      win.document.querySelector('#detailBody input[aria-label="Given name"]').value = 'Zed';
      foot(win, 'Cancel').click();
      await sleep(20);
      expect(win.SlopContacts.state.byId('p1').name.given).toBe('Ann');
      expect($(win, 'detailBody').textContent).toContain('Ann Lee');
    });
    it('a form with unsaved changes asks before another row replaces it; Cancel keeps the form', async () => {
      const win = await bootWith(LIST());
      openRow(win, 'p1').click();
      foot(win, 'Edit').click();
      win.document.querySelector('#detailBody input[aria-label="Given name"]').value = 'Typed';
      openRow(win, 'p3').click();
      await waitFor(() => dlgButton(win, 'Discard'));
      dlgButton(win, 'Cancel').click();
      await waitFor(() => !win.document.querySelector('.sui-dlg'));
      expect(win.document.querySelector('#detailBody input[aria-label="Given name"]').value).toBe('Typed');
      openRow(win, 'p3').click();
      await waitFor(() => dlgButton(win, 'Discard'));
      dlgButton(win, 'Discard').click();
      await waitFor(() => !win.document.querySelector('.sui-dlg'));
      expect($(win, 'detailBody').textContent).toContain('Cy');
      expect(win.SlopContacts.state.byId('p1').name.given).toBe('Ann');
    });
    it('Duplicate puts a copy under the original and opens the copy in the form', async () => {
      const win = await bootWith(LIST());
      openRow(win, 'p1').click();
      foot(win, 'Duplicate').click();
      await sleep(20);
      const ids = win.SlopContacts.state.list.map((c) => c.id);
      expect(ids).toHaveLength(4);
      expect(ids[1]).not.toBe('p1');
      expect(ids[0]).toBe('p1');
      expect(win.SlopContacts.state.byId(ids[1]).name.given).toBe('Ann');
      expect(win.document.querySelector('#detailBody .ed')).toBeTruthy();
    });
    it('Delete asks, then removes the contact and closes the panel', async () => {
      const win = await bootWith(LIST());
      openRow(win, 'p3').click();
      foot(win, 'Delete').click();
      await waitFor(() => dlgButton(win, 'Delete'));
      dlgButton(win, 'Delete').click();
      await sleep(40);
      expect(win.SlopContacts.state.list.map((c) => c.id)).toEqual(['p1', 'p2']);
      expect($(win, 'detail').hidden).toBeTruthy();
      expect(rowCount(win)).toBe(2);
    });
    it('bulk actions stay in the toolbar while the panel is open', async () => {
      const win = await bootWith(LIST());
      openRow(win, 'p1').click();
      win.document.querySelector('input[data-ck="p2"]').click();
      await sleep(20);
      expect($(win, 'selBar').hidden).toBeFalsy();
      expect($(win, 'selCount').textContent).toBe('1 selected');
      expect(win.document.querySelector('.main-top #selBar')).toBeTruthy();
      expect(win.document.querySelector('.main-top [data-cmd="groups.add"]')).toBeTruthy();
      expect($(win, 'detail').hidden).toBeFalsy();
    });
    it('on a wide screen the panel is a column and the list keeps its own scroll', async () => {
      const win = await bootWith(LIST());
      openRow(win, 'p1').click();
      await sleep(40);
      const panel = $(win, 'detail').getBoundingClientRect();
      expect(panel.width).toBeGreaterThanOrEqual(300);
      expect(panel.width).toBeLessThanOrEqual(380);
      expect(win.getComputedStyle($(win, 'main')).overflowY).toBe('auto');
      expect($(win, 'main').getBoundingClientRect().height).toBeLessThan(win.innerHeight);
    });
    it('at 390 px the panel is a bottom sheet with no horizontal page scroll', async () => {
      const win = await bootWith(LIST());
      const fr = document.getElementById('app');
      fr.style.width = '390px';
      await sleep(120);
      openRow(win, 'p1').click();
      await sleep(60);
      const r = $(win, 'detail').getBoundingClientRect();
      const overflow = win.document.documentElement.scrollWidth - win.document.documentElement.clientWidth;
      fr.style.width = '1280px';
      expect(Math.round(r.left)).toBe(0);
      expect(Math.round(r.width)).toBe(390);
      expect(Math.round(r.bottom)).toBe(win.innerHeight);
      expect(overflow).toBeLessThanOrEqual(1);
    });
  });

  describe('photos in the app', () => {
    it('a picture from the file picker is stored as a JPEG of at most 256 px, shown in the list and kept on save', async () => {
      const win = await bootWith(LIST());
      const file = await pngFile(1000, 600);
      win.SlopUI.pickFiles = async () => [file];
      openRow(win, 'p1').click();
      foot(win, 'Edit').click();
      [...win.document.querySelectorAll('#detailBody button')].find((b) => b.textContent === 'Choose photo…').click();
      await waitFor(() => win.document.querySelector('#detailBody .ed-photo img'));
      foot(win, 'Save').click();
      await sleep(30);
      const photo = win.SlopContacts.state.byId('p1').photo;
      expect(photo.startsWith('data:image/jpeg;base64,')).toBeTruthy();
      const img = await new Promise((res, rej) => { const i = new win.Image(); i.onload = () => res(i); i.onerror = rej; i.src = photo; });
      expect(img.naturalWidth).toBe(256);
      expect(img.naturalHeight).toBe(154);
      expect(win.document.querySelector('[data-id="p1"] .avatar img')).toBeTruthy();
      expect($(win, 'detailBody').querySelector('.avatar img')).toBeTruthy();
      const vcf = win.SlopContacts.vcard.write(win.SlopContacts.state.list);
      expect(vcf).toContain('PHOTO;ENCODING=b;TYPE=JPEG:');
      openRow(win, 'p1').click();
      foot(win, 'Edit').click();
      win.document.querySelector('#detailBody input[aria-label="Given name"]').value = 'Anna';
      foot(win, 'Save').click();
      await sleep(20);
      expect(win.SlopContacts.state.byId('p1').photo).toBe(photo);
    });
    it('Remove photo clears it; a web link is kept as text and shown as initials, never loaded', async () => {
      const list = LIST();
      list[1] = CT.make({ ...list[1], photo: 'https://example.com/bob.jpg' });
      const win = await bootWith(list);
      openRow(win, 'p2').click();
      await sleep(20);
      expect(win.document.querySelector('[data-id="p2"] .av-init').textContent).toBe('BR');
      expect(win.document.querySelector('[data-id="p2"] img')).toBeFalsy();
      expect(win.document.querySelectorAll('img[src^="https"]')).toHaveLength(0);
      expect($(win, 'detailBody').textContent).toContain('https://example.com/bob.jpg');
      foot(win, 'Edit').click();
      [...win.document.querySelectorAll('#detailBody button')].find((b) => b.textContent === 'Remove photo').click();
      foot(win, 'Save').click();
      await sleep(20);
      expect(win.SlopContacts.state.byId('p2').photo).toBe('');
    });
  });
})();
