import { useState } from 'react';
import { 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Building2, 
  FileText, 
  Package, 
  Files,
  Mail,
  Phone,
  MapPin,
  Calendar,
  CreditCard,
  Hash,
  DollarSign
} from 'lucide-react';
import ConfidenceBadge from './ConfidenceBadge';

const tabs = [
  { id: 'header', label: 'Header Details', icon: FileText },
  { id: 'vendor', label: 'Vendor Compliance', icon: Building2 },
  { id: 'line_items', label: 'Line Items', icon: Package },
  { id: 'documents', label: 'Documents', icon: Files }
];

const FieldCard = ({ icon: Icon, label, value, confidence, placeholder }) => (
  <div className="space-y-1">
    <div className="flex items-center gap-2 text-xs text-gray-500">
      <Icon size={12} />
      <span>{label}</span>
      {confidence && <ConfidenceBadge confidence={confidence} size="small" />}
    </div>
    <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900">
      {value || <span className="text-gray-400">{placeholder}</span>}
    </div>
  </div>
);

const SectionCard = ({ title, icon: Icon, children }) => (
  <div className="bg-white border border-gray-200 rounded-xl p-4">
    <div className="flex items-center gap-2 mb-4">
      <Icon size={18} className="text-[var(--primary)]" />
      <h3 className="font-semibold text-gray-900">{title}</h3>
    </div>
    {children}
  </div>
);

export default function ExtractedDataPanel({ invoice }) {
  const [activeTab, setActiveTab] = useState('header');
  const currentTabIndex = tabs.findIndex(t => t.id === activeTab);

  const formatCurrency = (amount, currency) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Status Banner */}
      <div className={`px-6 py-3 flex items-center justify-center gap-2 ${
        invoice.status === 'ready_for_approval' 
          ? 'bg-green-500 text-white' 
          : 'bg-amber-500 text-white'
      }`}>
        {invoice.status === 'ready_for_approval' ? (
          <>
            <CheckCircle size={18} />
            <span className="font-medium">All Clear — Ready for Approval</span>
          </>
        ) : (
          <>
            <AlertCircle size={18} />
            <span className="font-medium">Review Required — Check Flagged Fields</span>
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex items-center justify-center gap-8 py-4">
          {tabs.map((tab, idx) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 text-sm font-medium pb-2 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'text-[var(--primary)] border-[var(--primary)]'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-center pb-2">
          <span className="text-xs text-gray-400">{currentTabIndex + 1} / {tabs.length}</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'header' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Header Details</h2>
              <p className="text-sm text-gray-500">Invoice number, date, currency, and basic information</p>
            </div>

            {/* Invoice Total Card */}
            <div className="bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Invoice Total</p>
                  <p className="text-4xl font-bold text-gray-900">
                    {formatCurrency(invoice.amount, invoice.currency)}
                    <span className="text-lg font-normal text-gray-500 ml-2">{invoice.currency}</span>
                  </p>
                  {invoice.daysOverdue > 0 && (
                    <div className="flex items-center gap-1 mt-2 text-red-500 text-sm">
                      <Clock size={14} />
                      <span>{invoice.daysOverdue} days overdue</span>
                    </div>
                  )}
                </div>
                <ConfidenceBadge confidence={invoice.confidence} size="large" />
              </div>
            </div>

            {/* Bill From / Bill To */}
            <div className="grid grid-cols-2 gap-4">
              <SectionCard title="Bill From (Vendor)" icon={Building2}>
                <div className="space-y-3">
                  <FieldCard 
                    icon={Building2} 
                    label="Vendor Name" 
                    value={invoice.billFrom?.name} 
                    confidence={95}
                  />
                  <FieldCard 
                    icon={MapPin} 
                    label="Address" 
                    value={invoice.billFrom?.address}
                    placeholder="Street, City, State, ZIP"
                    confidence={95}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <FieldCard 
                      icon={Mail} 
                      label="Email" 
                      value={invoice.billFrom?.email}
                      confidence={95}
                    />
                    <FieldCard 
                      icon={Phone} 
                      label="Phone" 
                      value={invoice.billFrom?.phone}
                      confidence={95}
                    />
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Bill To (Customer)" icon={FileText}>
                <div className="space-y-3">
                  <FieldCard 
                    icon={Building2} 
                    label="Company Name" 
                    value={invoice.billTo?.name} 
                    confidence={95}
                  />
                  <FieldCard 
                    icon={MapPin} 
                    label="Billing Address" 
                    value={invoice.billTo?.address}
                    placeholder="Street, City, State, ZIP"
                    confidence={95}
                  />
                  <FieldCard 
                    icon={Building2} 
                    label="Business Entity" 
                    value={invoice.billTo?.entity}
                    confidence={95}
                  />
                </div>
              </SectionCard>
            </div>

            {/* Invoice Details */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Invoice Details</h3>
              <div className="grid grid-cols-3 gap-4">
                <FieldCard 
                  icon={Hash} 
                  label="Invoice Number" 
                  value={invoice.invoiceNumber} 
                  confidence={95}
                />
                <FieldCard 
                  icon={Calendar} 
                  label="Invoice Date" 
                  value={new Date(invoice.invoiceDate).toLocaleDateString('en-US', { 
                    month: 'short', day: 'numeric', year: 'numeric' 
                  })} 
                  confidence={95}
                />
                <FieldCard 
                  icon={Calendar} 
                  label="Due Date" 
                  value={new Date(invoice.dueDate).toLocaleDateString('en-US', { 
                    month: 'short', day: 'numeric', year: 'numeric' 
                  })} 
                  confidence={95}
                />
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <FieldCard 
                  icon={DollarSign} 
                  label="Currency" 
                  value={invoice.currency} 
                  confidence={95}
                />
                <FieldCard 
                  icon={CreditCard} 
                  label="Payment Terms" 
                  value={invoice.paymentTerms} 
                  confidence={95}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'vendor' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Vendor Compliance</h2>
              <p className="text-sm text-gray-500">Vendor verification and compliance status</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
              <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">Vendor Verified</h3>
              <p className="text-gray-500">This vendor is in good standing</p>
            </div>
          </div>
        )}

        {activeTab === 'line_items' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Line Items</h2>
              <p className="text-sm text-gray-500">Extracted line items from invoice</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Description</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">Qty</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Rate</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {invoice.lineItems?.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-3 px-4 text-gray-900">{item.description}</td>
                      <td className="py-3 px-4 text-center text-gray-600">{item.quantity}</td>
                      <td className="py-3 px-4 text-right text-gray-600">${item.rate.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right font-medium text-gray-900">${item.amount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan="3" className="py-3 px-4 text-right font-medium text-gray-500">Total</td>
                    <td className="py-3 px-4 text-right font-bold text-gray-900">
                      {formatCurrency(invoice.amount, invoice.currency)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Documents</h2>
              <p className="text-sm text-gray-500">Attached documents and files</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
              <Files size={48} className="text-gray-300 mx-auto mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">Original Invoice PDF</h3>
              <p className="text-gray-500 text-sm">1 document attached</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
