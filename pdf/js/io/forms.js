/* Slop PDF — AcroForm support: listing fields (pdf.js), live preview via annotationStorage, filling/flattening (pdf-lib). */
(function () {
  'use strict';
  var SP = window.SP, U = SP.util, E = SP.engine;

  /* -------------------------------------------------------------- forms */
  E.loadFields = async function (f) {
    if (f.fields !== undefined) return f.fields;
    var list = [];
    try {
      var objs = await f.doc.getFieldObjects();
      if (objs) Object.keys(objs).forEach(function (name) {
        var ws = (objs[name] || []).filter(function (w) { return w && w.type && w.id; });
        if (!ws.length) return;
        var type = ws[0].type;
        if (type === 'button' || type === 'signature') return;
        var fld = { name: name, type: type, widgets: ws.map(function (w) { return { id: w.id, exportValue: w.exportValues, value: w.value, page: w.page }; }), readOnly: ws[0].editable === false, page: ws[0].page };
        if (type === 'radiobutton') {
          fld.options = ws.map(function (w) { return w.exportValues; });
          var on = ws.filter(function (w) { return w.value && w.value !== 'Off' && w.value === w.exportValues; })[0];
          fld.value = on ? on.exportValues : (ws[0].value && ws[0].value !== 'Off' ? ws[0].value : '');
        } else if (type === 'checkbox') {
          fld.value = !!(ws[0].value && ws[0].value !== 'Off');
        } else if (type === 'combobox' || type === 'listbox') {
          fld.options = (ws[0].items || []).map(function (it) { return [it.exportValue, it.displayValue]; });
          fld.value = Array.isArray(ws[0].value) ? (ws[0].value[0] || '') : (ws[0].value || '');
        } else {
          fld.value = ws[0].value == null ? '' : String(ws[0].value);
          fld.multiline = !!ws[0].multiline;
        }
        list.push(fld);
      });
    } catch (e) { console.warn('Slop PDF: could not read form fields', e); }
    f.fields = list;
    return list;
  };
  E.formKey = function (fid) { var v = E.state.forms[fid]; return v && Object.keys(v).length ? JSON.stringify(v) : ''; };
  E.syncStorage = function (f) {
    if (!f.fields || !f.fields.length) return;
    var vals = E.state.forms[f.id] || {}, st = f.doc.annotationStorage;
    f.fields.forEach(function (fld) {
      var has = Object.prototype.hasOwnProperty.call(vals, fld.name), v = has ? vals[fld.name] : fld.value;
      fld.widgets.forEach(function (w) {
        if (fld.type === 'checkbox') st.setValue(w.id, { value: !!v });
        else if (fld.type === 'radiobutton') st.setValue(w.id, { value: v === w.exportValue });
        else if (fld.type === 'listbox') st.setValue(w.id, { value: v ? [v] : [] });
        else st.setValue(w.id, { value: v == null ? '' : String(v) });
      });
    });
  }
;
  E.fillForm = function (src, vals, flatten) {
    var L = PDFLib, form;
    try { form = src.getForm(); } catch (e) { return; }
    var fields = form.getFields(); if (!fields.length) return;
    Object.keys(vals || {}).forEach(function (name) {
      var v = vals[name];
      try {
        var fld = form.getField(name);
        if (fld instanceof L.PDFTextField) { var s = E.sanitize(String(v == null ? '' : v), 'Helvetica'); if (s) fld.setText(s); else fld.setText(undefined); }
        else if (fld instanceof L.PDFCheckBox) { if (v) fld.check(); else fld.uncheck(); }
        else if (fld instanceof L.PDFRadioGroup) { if (v && v !== 'Off') fld.select(String(v)); else fld.clear(); }
        else if (fld instanceof L.PDFDropdown || fld instanceof L.PDFOptionList) { if (v) fld.select(String(v)); else fld.clear(); }
      } catch (e) { console.warn('Slop PDF: could not set field', name, e); }
    });
    try { form.updateFieldAppearances(); } catch (e) { console.warn('Slop PDF: field appearance update failed', e); }
    if (flatten) { try { form.flatten({ updateFieldAppearances: false }); } catch (e) { console.warn('Slop PDF: flatten failed', e); } }
  }
  /* Strip /P back-pointers and park internal link targets as page numbers, so copyPages
     does not drag the donor's whole page tree along. Fixed up again after copying. */;
})();
