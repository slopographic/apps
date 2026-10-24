/* Slop Reports: the built-in reports, each a small JSON query (see engine.js for every key). Read-only: a report
 * never writes. "$today" and "$today+14" in a where value are resolved when the report runs. Classic script: sets
 * window.SlopReports.BUILTIN (frozen). The customers collection is the one Slop Contacts and Slop CRM share. */
(function (g) {
  'use strict';
  const ns = (g.SlopReports = g.SlopReports || {});

  const BUILTIN = [
    { id: 'unpaid-invoices', title: 'Unpaid invoices by customer',
      note: 'Issued invoices that are not paid. Balance is the total less payments made, in each invoice currency.',
      from: 'invoices', where: [['status', '=', 'issued']], enrich: ['invoiceBalance'],
      join: { from: 'customers', on: ['customerId', 'id'], type: 'left', prefix: 'customer_' },
      by: ['customerId', 'customer_name', 'currency'], count: true, sum: ['total', 'balance'],
      orderBy: 'sum_balance', desc: true,
      columns: [
        { field: 'customer_name', label: 'Customer' },
        { field: 'currency', label: 'Currency' },
        { field: 'count', label: 'Invoices', type: 'number' },
        { field: 'sum_total', label: 'Total', type: 'money' },
        { field: 'sum_balance', label: 'Balance due', type: 'money' },
      ] },
    { id: 'contacts-by-group', title: 'Contacts by group',
      note: 'A contact in two groups is counted in both. A contact in no group is shown as (no group).',
      from: 'customers', unwind: 'groupIds',
      join: { from: 'customerGroups', on: ['groupIds', 'id'], type: 'left', prefix: 'group_' },
      by: ['group_name'], count: true, orderBy: 'count', desc: true,
      columns: [
        { field: 'group_name', label: 'Group' },
        { field: 'count', label: 'Contacts', type: 'number' },
      ] },
    { id: 'crm-by-stage', title: 'CRM leads by stage',
      note: 'Value is the issued and paid invoices of each customer, in the base currency.',
      from: 'customers', enrich: ['customerValue'], by: ['stage'], count: true, sum: ['value'],
      orderBy: 'stage',
      columns: [
        { field: 'stage', label: 'Stage' },
        { field: 'count', label: 'Customers', type: 'number' },
        { field: 'sum_value', label: 'Value', type: 'money', currency: 'base' },
      ] },
    { id: 'follow-ups-14', title: 'Follow-ups due in the next 14 days',
      note: 'Customers with a follow-up date from today to 14 days ahead. A record with the same email that was imported from Slop Contacts is shown beside it.',
      from: 'customers', where: [['followUp', '>=', '$today'], ['followUp', '<=', '$today+14']],
      join: { from: 'customers', on: ['email', 'email'], type: 'left', prefix: 'contact_', ci: true, where: [['contactId', 'starts', '']] },
      orderBy: 'followUp',
      columns: [
        { field: 'followUp', label: 'Follow-up', type: 'date' },
        { field: 'name', label: 'Name' },
        { field: 'stage', label: 'Stage' },
        { field: 'email', label: 'Email' },
        { field: 'contact_name', label: 'Contact name' },
        { field: 'contact_phone', label: 'Contact phone' },
      ] },
    { id: 'profit-by-month', title: 'Profit by month',
      note: 'From the ledger: income is what was posted to revenue accounts, expense what was posted to expense accounts (Slop Expenses and any manual entry), in the base currency. A voided invoice or expense cancels itself out.',
      from: 'journal', enrich: ['profit'], by: ['month'], sum: ['income', 'expense', 'profit'], orderBy: 'month', desc: true,
      columns: [
        { field: 'month', label: 'Month' },
        { field: 'sum_income', label: 'Income', type: 'money', currency: 'base' },
        { field: 'sum_expense', label: 'Expenses', type: 'money', currency: 'base' },
        { field: 'sum_profit', label: 'Profit', type: 'money', currency: 'base' },
      ] },
    { id: 'expenses-by-category', title: 'Expenses by category',
      note: 'Recorded expenses that are not void, by expense account, in each expense currency. Amount includes tax.',
      from: 'expenses', where: [['status', '=', 'posted']],
      join: { from: 'accounts', on: ['account', 'code'], type: 'left', prefix: 'account_' },
      by: ['account', 'account_name', 'currency'], count: true, sum: ['amount', 'tax'], orderBy: 'sum_amount', desc: true,
      columns: [
        { field: 'account', label: 'Account' },
        { field: 'account_name', label: 'Category' },
        { field: 'currency', label: 'Currency' },
        { field: 'count', label: 'Expenses', type: 'number' },
        { field: 'sum_amount', label: 'Amount', type: 'money' },
        { field: 'sum_tax', label: 'Tax', type: 'money' },
      ] },
    { id: 'hours-by-customer', title: 'Hours by customer',
      note: 'From Slop Timesheets: the time logged for each customer (internal time is shown as (none)), and what the billable part is worth at its rates, in each currency.',
      from: 'timeEntries', enrich: ['timeValue'],
      join: { from: 'customers', on: ['customerId', 'id'], type: 'left', prefix: 'customer_' },
      by: ['customer_name', 'currency'], count: true, sum: ['minutes', 'value'], orderBy: 'sum_minutes', desc: true,
      columns: [
        { field: 'customer_name', label: 'Customer' },
        { field: 'currency', label: 'Currency' },
        { field: 'count', label: 'Entries', type: 'number' },
        { field: 'sum_minutes', label: 'Time', type: 'duration' },
        { field: 'sum_value', label: 'Billable value', type: 'money' },
      ] },
  ];

  ns.BUILTIN = Object.freeze(BUILTIN.map((r) => Object.freeze(r)));
})(typeof window !== 'undefined' ? window : globalThis);
