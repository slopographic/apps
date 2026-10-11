/* SlopTour: Slop Orders. Targets are ids in orders/index.html. */
SlopTour.define({
  app: 'orders',
  title: 'Slop Orders tour',
  steps: [
    { id: 'search', title: 'Search', text: 'Find an order by number, customer or notes.', target: '#oSearch' },
    { id: 'new', title: 'New order', text: 'Start an order. It opens in the editor, where you add the customer and lines.', target: '#oNew' },
    { id: 'status', title: 'Status', text: 'Show only the orders in one status.', target: '#oStatus' },
    { id: 'list', title: 'Order list', text: 'Your orders with their totals. Open one to edit it.', target: '#view-list' },
    { id: 'summary', title: 'Summary', text: 'Totals for the orders you can see.', target: '#oSummary' },
    { id: 'samples', title: 'Samples', text: 'Make random sample orders to try the app. Delete all samples removes them.', target: '#oSamples' },
  ],
});
