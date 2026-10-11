/* SlopTour: Slop Invoices. Targets are ids in invoices/index.html. */
SlopTour.define({
  app: 'invoices',
  title: 'Slop Invoices tour',
  steps: [
    { id: 'search', title: 'Search', text: 'Find an invoice by number, customer or notes.', target: '#iSearch' },
    { id: 'new', title: 'New invoice', text: 'Start an invoice from scratch, or use From an order.', target: '#iNew' },
    { id: 'from-order', title: 'From an order', text: 'Turn an order into an invoice in one step.', target: '#iFromOrder' },
    { id: 'outstanding', title: 'Outstanding', text: 'Unpaid balances, at a glance.', target: '#iOutstanding' },
    { id: 'list', title: 'Invoice list', text: 'Open an invoice to edit it, print it or record payments.', target: '#iRows' },
    { id: 'data', title: 'Data', text: 'Back up or restore your invoices from the Data tab.', target: '#tab-data' },
  ],
});
