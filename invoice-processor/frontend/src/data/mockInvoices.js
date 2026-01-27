// Mock invoice data matching our test cases
export const mockInvoices = [
  {
    id: 'INV-TC-US-2007',
    vendor: 'Maple Creative',
    vendorLogo: '🍁',
    invoiceNumber: 'INV-TC-US-2007',
    poMatch: null,
    amount: 42350.00,
    currency: 'CAD',
    dueDate: '2025-09-14',
    invoiceDate: '2025-08-16',
    confidence: 95,
    status: 'ready_for_approval',
    paymentTerms: 'Net 30',
    billFrom: {
      name: 'Maple Creative Agency',
      address: '123 Creative Blvd, Toronto, ON M5J 2N1',
      email: 'billing@maplecreative.com',
      phone: '(416) 555-0123'
    },
    billTo: {
      name: 'TechCorp Canada',
      address: '88 Lakeshore Dr, Suite 500, Toronto, ON M5J 2N1',
      entity: 'TechCorp Inc. Canada'
    },
    lineItems: [
      { description: 'Retainer + Media Buy Pass-through', quantity: 1, rate: 42350.00, amount: 42350.00 }
    ],
    daysOverdue: 133,
    pdfUrl: '/invoices/maple-creative.pdf'
  },
  {
    id: 'INV-TC-US-2008',
    vendor: 'Office Depot',
    vendorLogo: '📦',
    invoiceNumber: 'INV-TC-US-2008',
    poMatch: null,
    amount: 2900.00,
    currency: 'USD',
    dueDate: '2025-09-19',
    invoiceDate: '2025-08-19',
    confidence: 94,
    status: 'ready_for_approval',
    paymentTerms: 'Net 30',
    billFrom: {
      name: 'Office Depot Business Solutions',
      address: '6600 N Military Trail, Boca Raton, FL 33496',
      email: 'business@officedepot.com',
      phone: '(800) 463-3768'
    },
    billTo: {
      name: 'TechCorp USA',
      address: '100 Tech Plaza, San Francisco, CA 94105',
      entity: 'TechCorp Inc.'
    },
    lineItems: [
      { description: 'Office Supplies Q3', quantity: 1, rate: 1500.00, amount: 1500.00 },
      { description: 'Printer Cartridges', quantity: 10, rate: 140.00, amount: 1400.00 }
    ],
    daysOverdue: 128,
    pdfUrl: '/invoices/office-depot.pdf'
  },
  {
    id: 'INV-TC-US-2009',
    vendor: 'Widgets Inc',
    vendorLogo: '⚙️',
    invoiceNumber: 'INV-TC-US-2009',
    poMatch: 'PO-2025-0892',
    amount: 5000.00,
    currency: 'USD',
    dueDate: '2026-02-01',
    invoiceDate: '2026-01-15',
    confidence: 98,
    status: 'ready_for_approval',
    paymentTerms: 'Net 30',
    billFrom: {
      name: 'Widgets Inc.',
      address: '500 Widget Way, Austin, TX 78701',
      email: 'ar@widgets.com',
      phone: '(512) 555-9876'
    },
    billTo: {
      name: 'TechCorp USA',
      address: '100 Tech Plaza, San Francisco, CA 94105',
      entity: 'TechCorp Inc.'
    },
    lineItems: [
      { description: 'WidgetA', quantity: 10, rate: 300.00, amount: 3000.00 },
      { description: 'WidgetB', quantity: 5, rate: 400.00, amount: 2000.00 }
    ],
    daysOverdue: 0,
    pdfUrl: '/invoices/widgets-inc.pdf'
  },
  {
    id: 'INV-TC-US-2010',
    vendor: 'Gadgets Co',
    vendorLogo: '🔧',
    invoiceNumber: 'INV-TC-US-2010',
    poMatch: null,
    amount: 15000.00,
    currency: 'USD',
    dueDate: '2026-01-30',
    invoiceDate: '2026-01-10',
    confidence: 72,
    status: 'needs_review',
    paymentTerms: 'Net 20',
    billFrom: {
      name: 'Gadgets Co.',
      address: '200 Gadget Lane, Seattle, WA 98101',
      email: 'invoices@gadgets.co',
      phone: '(206) 555-4321'
    },
    billTo: {
      name: 'TechCorp USA',
      address: '100 Tech Plaza, San Francisco, CA 94105',
      entity: 'TechCorp Inc.'
    },
    lineItems: [
      { description: 'GadgetX', quantity: 20, rate: 750.00, amount: 15000.00 }
    ],
    daysOverdue: 0,
    pdfUrl: '/invoices/gadgets-co.pdf',
    flags: ['high_amount', 'low_confidence']
  },
  {
    id: 'INV-TC-US-2011',
    vendor: 'Cloud Services Ltd',
    vendorLogo: '☁️',
    invoiceNumber: 'INV-TC-US-2011',
    poMatch: 'PO-2025-1001',
    amount: 8500.00,
    currency: 'USD',
    dueDate: '2026-02-15',
    invoiceDate: '2026-01-20',
    confidence: 97,
    status: 'needs_review',
    paymentTerms: 'Net 30',
    billFrom: {
      name: 'Cloud Services Ltd',
      address: '1 Cloud Way, Denver, CO 80202',
      email: 'billing@cloudservices.io',
      phone: '(303) 555-7890'
    },
    billTo: {
      name: 'TechCorp USA',
      address: '100 Tech Plaza, San Francisco, CA 94105',
      entity: 'TechCorp Inc.'
    },
    lineItems: [
      { description: 'Monthly SaaS Subscription', quantity: 1, rate: 5000.00, amount: 5000.00 },
      { description: 'Additional Storage (500GB)', quantity: 1, rate: 2000.00, amount: 2000.00 },
      { description: 'Premium Support', quantity: 1, rate: 1500.00, amount: 1500.00 }
    ],
    daysOverdue: 0,
    pdfUrl: '/invoices/cloud-services.pdf'
  }
];

// Stats calculation
export const getInvoiceStats = () => {
  const total = mockInvoices.reduce((sum, inv) => sum + inv.amount, 0);
  const needsReview = mockInvoices.filter(inv => inv.status === 'needs_review').length;
  const readyForApproval = mockInvoices.filter(inv => inv.status === 'ready_for_approval').length;
  
  return {
    totalInvoices: mockInvoices.length,
    totalAmount: total,
    needsReview,
    readyForApproval,
    processedToday: 6
  };
};

export const getInvoiceById = (id) => {
  return mockInvoices.find(inv => inv.id === id);
};
