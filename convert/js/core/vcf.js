/* vCard conversions (browser). The vCard reader and writer are the Contacts app's own (contacts/js/core/vcard-read.js and
 * vcard-write.js, with the helpers they use). They are classic scripts, so they are loaded once into this page, in order,
 * and used as they are. The header rule and the table shapes are in vcf-map.js. */
import { parseCsv, rowsToCsv } from './csv.js';
import { rowsToXlsx } from './xlsx.js';
import { decodeText } from './text.js';
import { readXlsx } from '../../../shared/sheets/xlsx.js';
import { contactsFromTable, contactsToTable } from './vcf-map.js';

const CORE = ['text', 'photo', 'model', 'vcard-read', 'vcard-write'];
let loading = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('The vCard code could not be loaded. Check the connection and reload the page.'));
    document.head.append(s);
  });
}

/** The Contacts core (SlopContacts.vcard.read and .write). Loaded once; resolves to the SlopContacts object. */
export function vcardCore() {
  if (!loading) {
    loading = (async () => {
      if (!(window.SlopContacts && window.SlopContacts.vcard && window.SlopContacts.vcard.write)) {
        for (const name of CORE) await loadScript(new URL(`../../../contacts/js/core/${name}.js`, import.meta.url).href);
      }
      return window.SlopContacts;
    })().catch((e) => { loading = null; throw e; });
  }
  return loading;
}

const base = (name) => String(name).replace(/\.[^.]+$/, '') || 'file';
const bytesOf = async (file) => new Uint8Array(await file.arrayBuffer());
const nonBlank = (rows) => rows.filter((r) => r.some((v) => String(v == null ? '' : v).trim() !== ''));

/** "Recognised: Name, E-mail, Phone. Not used: Department." (the line the tool shows after a conversion). */
export function describeMapping(mapping, count) {
  const seen = [...new Set(mapping.recognised.map((r) => r.label))];
  const got = seen.length ? `Recognised columns: ${seen.join(', ')}.` : 'No columns were recognised.';
  const skip = mapping.unrecognised.length ? ` Not used: ${mapping.unrecognised.join(', ')}.` : '';
  return `${got}${skip} ${count} contact${count === 1 ? '' : 's'}.`;
}

/** A table (CSV rows or XLSX text) to one vCard 3.0 file. The info line says which columns were recognised. */
async function tableToVcf(name, table) {
  const { contacts, mapping } = contactsFromTable(nonBlank(table));
  if (!contacts.length) throw new Error('No contacts found. The first row needs column names, such as Name, E-mail or Phone.');
  const SC = await vcardCore();
  const res = [{ name: `${name}.vcf`, blob: new Blob([SC.vcard.write(contacts, '3.0')], { type: 'text/vcard' }) }];
  res.info = describeMapping(mapping, contacts.length);
  return res;
}

export async function csvToVcf(files, o = {}) {
  const f = files[0];
  const rows = parseCsv(decodeText(await bytesOf(f.file)), { delimiter: o.delimiter && o.delimiter !== 'auto' ? o.delimiter : undefined });
  return tableToVcf(base(f.name), rows);
}

export async function xlsxToVcf(files) {
  const f = files[0];
  const { sheets } = await readXlsx(await bytesOf(f.file));
  return tableToVcf(base(f.name), sheets[0].text);
}

/** vCard text to contacts. Photos are left out: the outputs are text tables and JSON. */
async function readVcf(file) {
  const SC = await vcardCore();
  const contacts = SC.vcard.read(decodeText(await bytesOf(file)), { photos: false });
  if (!contacts.length) throw new Error('No vCard (BEGIN:VCARD) was found in this file.');
  return contacts;
}

export async function vcfToCsv(files) {
  const f = files[0];
  const { headers, rows } = contactsToTable(await readVcf(f.file));
  return [{ name: `${base(f.name)}.csv`, blob: new Blob([rowsToCsv([headers, ...rows])], { type: 'text/csv' }) }];
}

export async function vcfToXlsx(files) {
  const f = files[0];
  const { headers, rows } = contactsToTable(await readVcf(f.file));
  return [{ name: `${base(f.name)}.xlsx`, blob: await rowsToXlsx([headers, ...rows]) }];
}

export async function vcfToJson(files) {
  const f = files[0];
  const contacts = (await readVcf(f.file)).map(({ photo, ...c }) => c);
  return [{ name: `${base(f.name)}.json`, blob: new Blob([JSON.stringify(contacts, null, 2)], { type: 'application/json' }) }];
}

