/* Finance conversions: SIE accounting files and bank statements (OFX/QFX, QIF, camt.053, MT940) to CSV and XLSX.
 * The readers and the tables are shared (shared/finance/: index.js reads, tables.js makes the rows); the CSV writer is
 * this app's (csv.js) and the XLSX writer is the shared one with several sheets, bold headers, number and date formats
 * (shared/sheets/write.js, the same as Sheet viewer's export). catalog.js lists FINANCE among its conversions.
 * Each run's result has info (the status line) and preview (the first sheet as tab-separated text, for the preview). */
import { readFinance, FORMAT_LABEL } from '../../../shared/finance/index.js';
import { sieSheets, sieVoucherRows, sieBalanceRows, statementSheets, statementRows } from '../../../shared/finance/tables.js';
import { totals } from '../../../shared/finance/model.js';
import { toXlsxBlob } from '../../../shared/sheets/write.js';
import { KEY } from '../../../shared/sheets/csv.js';
import { rowsToCsv } from './csv.js';
import { stemOf as base } from '../io/files.js';
import { tr } from './i18n.js';

export const STATEMENT_KINDS = ['ofx', 'qif', 'camt053', 'mt940'];
const MONEY = '#,##0.00';
const SEP = { key: 'delimiter', type: 'select', get label() { return tr('convert.fin.separator', 'Separator'); }, value: ',',
  get options() { return [[',', tr('convert.fin.sep_comma', 'Comma (decimal point)')], [';', tr('convert.fin.sep_semicolon', 'Semicolon (decimal comma, for Excel in Swedish, German and others)')], ['\t', tr('convert.fin.sep_tab', 'Tab')]]; },
  get hint() { return tr('convert.fin.sep_hint', 'With semicolons, amounts are written 1234,50 so a European Excel reads them as numbers.'); } };

/** The file read by the shared reader; the detected kind is a hint, the content decides. */
const read = async (f) => readFinance(new Uint8Array(await f.file.arrayBuffer()), f.name);
async function readSieFile(f) {
  const r = await read(f);
  if (r.kind !== 'ledger') throw new Error(tr('convert.fin.not_sie', 'This is a bank statement, not an SIE file. Use Bank statement to CSV or to Excel.'));
  return r;
}

/** Sheets for the XLSX writer: bold header row, money columns as #,##0.00, date columns as real dates. */
export function workbookSheets(sheets) {
  return sheets.map((s) => {
    const fmt = new Map(), bold = new Set();
    s.rows[0].forEach((_, c) => bold.add(KEY(0, c)));
    const rows = s.rows.map((row, r) => row.map((v, c) => {
      if (r === 0) return v;
      if (s.dates.includes(c) && /^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(`${v}T00:00:00Z`);
      if (s.money.includes(c) && typeof v === 'number') fmt.set(KEY(r, c), MONEY);
      return v === '' ? null : v;
    }));
    return { name: s.name, rows, fmt, bold };
  });
}

/** CSV text from rows; with ";" the numbers get a decimal comma. A BOM keeps Excel reading å, ä and ö right. */
export function csvText(rows, delimiter = ',') {
  const comma = delimiter === ';';
  const out = rows.map((r) => r.map((v) => (typeof v === 'number' ? (comma ? String(v.toFixed(2)).replace('.', ',') : v.toFixed(2)) : v)));
  return `﻿${rowsToCsv(out, { delimiter, eol: '\r\n' })}`;
}

const tsv = (rows, n = 60) => rows.slice(0, n).map((r) => r.map((v) => (typeof v === 'number' ? v.toFixed(2) : String(v ?? ''))).join('\t')).join('\n');
/** ' 2 notes: the first note.' after a summary, or ''. */
const warnOf = (m) => (m.warnings.length ? ' ' + tr('convert.fin.notes', ['{n} notes: {first}', '{n} note: {first}'], { n: m.warnings.length, first: m.warnings[0] }) : '');

function sieInfo(m) {
  const lines = m.vouchers.reduce((t, v) => t + v.lines.length, 0);
  const cs = m.checksum && m.checksum.present ? ' ' + (m.checksum.ok ? tr('convert.fin.checksum_ok', 'Checksum matches.') : tr('convert.fin.checksum_bad', 'Checksum does not match.')) : '';
  return tr('convert.fin.sie_info', '{company}, SIE type {type}, {currency}: {accounts}, {vouchers} ({lines}).', {
    company: m.company || tr('convert.fin.sie_file', 'SIE file'), type: String(m.type), currency: m.currency,
    accounts: tr('convert.fin.accounts', ['{n} accounts', '{n} account'], { n: m.accounts.length }),
    vouchers: tr('convert.fin.vouchers', ['{n} vouchers', '{n} voucher'], { n: m.vouchers.length }),
    lines: tr('convert.fin.lines', ['{n} lines', '{n} line'], { n: lines }) }) + cs + warnOf(m);
}
function statementInfo(m) {
  const t = totals(m);
  const v = { format: FORMAT_LABEL[m.format], account: m.account || '', count: tr('convert.fin.transactions', ['{n} transactions', '{n} transaction'], { n: t.count }),
    in: t.moneyIn.toFixed(2), out: t.moneyOut.toFixed(2), currency: m.currency ? ` ${m.currency}` : '',
    pending: t.pending ? ' ' + tr('convert.fin.pending', '({n} pending, not counted)', { n: t.pending }) : '' };
  return tr(m.account ? 'convert.fin.statement_info_for' : 'convert.fin.statement_info',
    m.account ? '{format} for {account}: {count}, in {in}, out {out}{currency}{pending}.' : '{format}: {count}, in {in}, out {out}{currency}{pending}.', v) + warnOf(m);
}
const result = (files, info, preview) => Object.assign(files, { info, preview });

export async function sieToXlsx(files) {
  const f = files[0], { model } = await readSieFile(f);
  const sheets = sieSheets(model);
  return result([{ name: `${base(f.name)}.xlsx`, blob: await toXlsxBlob(workbookSheets(sheets)) }], sieInfo(model), tsv(sheets[1].rows.length > 1 ? sheets[1].rows : sheets[3].rows));
}

export async function sieToCsv(files, o = {}) {
  const f = files[0], { model } = await readSieFile(f);
  const vouchers = model.vouchers.length > 0;
  const rows = vouchers ? sieVoucherRows(model) : sieBalanceRows(model);
  const info = sieInfo(model) + (vouchers ? '' : ' ' + tr('convert.fin.no_vouchers', 'The file has no vouchers, so the CSV holds the balances per account.'));
  return result([{ name: `${base(f.name)}${vouchers ? '' : '-balances'}.csv`, blob: new Blob([csvText(rows, o.delimiter || ',')], { type: 'text/csv' }) }], info, tsv(rows));
}

export async function statementToCsv(files, o = {}) {
  const f = files[0], { model } = await readStatementFile(f);
  const rows = statementRows(model);
  return result([{ name: `${base(f.name)}.csv`, blob: new Blob([csvText(rows, o.delimiter || ',')], { type: 'text/csv' }) }], statementInfo(model), tsv(rows));
}

export async function statementToXlsx(files) {
  const f = files[0], { model } = await readStatementFile(f);
  const sheets = statementSheets(model);
  return result([{ name: `${base(f.name)}.xlsx`, blob: await toXlsxBlob(workbookSheets(sheets)) }], statementInfo(model), tsv(sheets[0].rows));
}

async function readStatementFile(f) {
  const r = await read(f);
  if (r.kind !== 'statement') throw new Error(tr('convert.fin.not_statement', 'This is an SIE accounting file, not a bank statement. Use SIE to CSV or SIE to Excel.'));
  return r;
}

export const FINANCE = [
  { id: 'sie-to-xlsx', get label() { return tr('convert.fin.sie_to_xlsx', 'SIE to Excel (XLSX)'); }, group: 'Finance', from: ['sie'], ext: 'xlsx', mode: 'each', options: [], run: sieToXlsx, // i18n-ignore: group id (shown through groupLabel)
    get note() { return tr('convert.fin.sie_to_xlsx_note', 'Sheets: Info, Vouchers (one row per transaction line), Accounts, Balances (opening, closing and result per year) and Periods when the file has period balances.'); } },
  { id: 'sie-to-csv', get label() { return tr('convert.fin.sie_to_csv', 'SIE to CSV'); }, group: 'Finance', from: ['sie'], ext: 'csv', mode: 'each', options: [SEP], run: sieToCsv, // i18n-ignore: group id (shown through groupLabel)
    get note() { return tr('convert.fin.sie_to_csv_note', 'One row per transaction line. A file without vouchers (SIE 1, 2 or 3) gives its balances per account instead.'); } },
  { id: 'bank-to-csv', get label() { return tr('convert.fin.bank_to_csv', 'Bank statement to CSV'); }, group: 'Finance', from: STATEMENT_KINDS, ext: 'csv', mode: 'each', options: [SEP], run: statementToCsv, // i18n-ignore: group id (shown through groupLabel)
    get note() { return tr('convert.fin.bank_to_csv_note', 'One row per transaction: date, value date, amount (money out is negative), currency, text, counterparty, reference.'); } },
  { id: 'bank-to-xlsx', get label() { return tr('convert.fin.bank_to_xlsx', 'Bank statement to Excel (XLSX)'); }, group: 'Finance', from: STATEMENT_KINDS, ext: 'xlsx', mode: 'each', options: [], run: statementToXlsx, // i18n-ignore: group id (shown through groupLabel)
    get note() { return tr('convert.fin.bank_to_xlsx_note', 'Sheets: Transactions, and Statement with the account, the period, the balances and a check that they add up.'); } },
];
