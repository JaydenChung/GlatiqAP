import { useNavigate } from 'react-router-dom';
import { Eye, AlertTriangle, FileText, Users, Mail, DollarSign, Package, ArrowRight } from 'lucide-react';

const formatCurrency = (amount, currency = 'USD') => {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
  return formatter.format(amount);
};

const formatDate = (dateString) => {
  if (!dateString) return '—';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const getIssueConfig = (issueType) => {
  const issues = {
    'Threshold Variance': { icon: DollarSign, color: 'text-amber-600', bg: 'bg-amber-50' },
    'Prepaid': { icon: FileText, color: 'text-amber-600', bg: 'bg-amber-50' },
    'Vendor Issue': { icon: Users, color: 'text-amber-600', bg: 'bg-amber-50' },
    'Missing W9 Form': { icon: Users, color: 'text-amber-600', bg: 'bg-amber-50' },
    'Wrong Entity': { icon: FileText, color: 'text-amber-600', bg: 'bg-amber-50' },
    'Suspicious Email': { icon: Mail, color: 'text-red-600', bg: 'bg-red-50' },
    'Suspicious Activity': { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
    'Over Quantity': { icon: Package, color: 'text-amber-600', bg: 'bg-amber-50' },
    'Inventory Variance': { icon: Package, color: 'text-amber-600', bg: 'bg-amber-50' },
  };
  return issues[issueType] || { icon: AlertTriangle, color: 'text-gray-600', bg: 'bg-gray-50' };
};

export default function InvoiceTable({ invoices, onRoute, variant = 'default' }) {
  const navigate = useNavigate();

  const handleRowClick = (invoice) => {
    navigate(`/invoice/${invoice.id}`);
  };

  if (invoices.length === 0) {
    return null;
  }

  const isReviewVariant = variant === 'review';

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Table Header */}
      <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-gray-100 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
        <div className="col-span-1 flex items-center">
          <input
            type="checkbox"
            className="w-4 h-4 rounded border-gray-300 text-teal-500 focus:ring-teal-500"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        <div className="col-span-2">Vendor</div>
        <div className="col-span-2">Invoice #</div>
        {isReviewVariant && <div className="col-span-2">Issue</div>}
        <div className={isReviewVariant ? 'col-span-1 text-right' : 'col-span-2 text-right'}>Amount</div>
        <div className="col-span-1">Due Date</div>
        <div className="col-span-2">Entity</div>
        <div className="col-span-1"></div>
      </div>

      {/* Table Body */}
      <div className="divide-y divide-gray-50">
        {invoices.map((invoice) => (
          <div
            key={invoice.id}
            onClick={() => handleRowClick(invoice)}
            className="grid grid-cols-12 gap-4 px-6 py-4 items-center cursor-pointer hover:bg-gray-50/50 transition-colors"
          >
            {/* Checkbox */}
            <div className="col-span-1">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-gray-300 text-teal-500 focus:ring-teal-500"
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            {/* Vendor */}
            <div className="col-span-2">
              <span className="text-sm font-medium text-gray-900">
                {invoice.vendor}
              </span>
            </div>

            {/* Invoice # */}
            <div className="col-span-2">
              <span className="text-sm text-gray-600 font-mono">
                {invoice.invoiceNumber}
              </span>
            </div>

            {/* Issue (only for review variant) */}
            {isReviewVariant && (
              <div className="col-span-2">
                {invoice.issueType && (
                  <div className="flex items-center gap-1.5">
                    {(() => {
                      const config = getIssueConfig(invoice.issueType);
                      const Icon = config.icon;
                      return (
                        <>
                          <div className={`p-1 rounded ${config.bg}`}>
                            <Icon size={12} className={config.color} />
                          </div>
                          <span className={`text-sm font-medium ${config.color}`}>
                            {invoice.issueType}
                          </span>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* Amount */}
            <div className={`${isReviewVariant ? 'col-span-1' : 'col-span-2'} text-right`}>
              <span className="text-sm font-semibold text-gray-900 tabular-nums">
                {formatCurrency(invoice.amount, invoice.currency)}
              </span>
            </div>

            {/* Due Date */}
            <div className="col-span-1">
              <span className="text-sm text-gray-600">
                {formatDate(invoice.dueDate)}
              </span>
            </div>

            {/* Entity */}
            <div className="col-span-2">
              <span className="text-sm text-gray-600">
                {invoice.entity || 'TechCorp Inc. — US'}
              </span>
            </div>

            {/* Actions */}
            <div className="col-span-1 flex items-center justify-end gap-2">
              {/* Route button for ready invoices */}
              {variant === 'ready' && onRoute && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRoute(invoice);
                  }}
                  className="flex items-center gap-1.5 text-sm font-medium text-teal-600 hover:text-teal-700 bg-teal-50 hover:bg-teal-100 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <ArrowRight size={15} />
                  <span>Route</span>
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRowClick(invoice);
                }}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                <Eye size={15} />
                <span>Review</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
