/* SlopTour: Slop CRM. Targets are ids in crm/index.html. */
SlopTour.define({
  app: 'crm',
  title: 'Slop CRM tour',
  steps: [
    { id: 'views', title: 'Views', text: 'Switch between Customers, Pipeline and Follow-ups.', target: '#tab-customers' },
    { id: 'search', title: 'Search', text: 'Find a customer by name, email, phone or address.', target: '#cSearch' },
    { id: 'stage', title: 'Stage and category', text: 'Filter by pipeline stage, or by category.', target: '#cStage' },
    { id: 'rows', title: 'Customers', text: 'Your customer list. Open a row to see the customer.', target: '#cRows' },
    { id: 'pipeline', title: 'Pipeline', text: 'The Pipeline tab shows your customers by stage.', target: '#tab-pipeline' },
    { id: 'import', title: 'Import', text: 'Bring customers in from Slop Contacts.', target: '#cImport' },
  ],
});
