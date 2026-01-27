import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  X, 
  MessageSquare, 
  ChevronLeft,
  ChevronRight,
  Save,
  CheckCircle,
  AlertCircle,
  FileText,
  Building2,
  List,
  Paperclip,
  Clock,
  MapPin,
  Mail,
  Phone,
  Hash,
  Calendar,
  Send,
  DollarSign,
  ChevronDown,
  Cpu,
  Sparkles
} from 'lucide-react';
import PDFViewer from '../components/PDFViewer';
import ProcessingHistoryView from '../components/ProcessingHistoryView';
import ApprovalProcessingModal from '../components/ApprovalProcessingModal';
import { useInvoices } from '../context/InvoiceContext';

const tabs = [
  { id: 'header', label: 'Header Details', icon: FileText },
  { id: 'vendor', label: 'Vendor Compliance', icon: Building2 },
  { id: 'line_items', label: 'Line Items', icon: List },
  { id: 'documents', label: 'Documents', icon: Paperclip }
];

export default function DetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getInvoiceById, handleApprovalTriageResult } = useInvoices();
  const invoice = getInvoiceById(id);
  const [activeTab, setActiveTab] = useState('header');
  const [showProcessingHistory, setShowProcessingHistory] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [highlightField, setHighlightField] = useState(null); // Field to highlight in processing history

  // Open processing history and highlight a specific field
  const handleFieldClick = (fieldName, fieldValue) => {
    if (invoice.aiProcessed && invoice.processingHistory) {
      setHighlightField({ name: fieldName, value: fieldValue });
      setShowProcessingHistory(true);
    }
  };

  if (!invoice) {
    return (
      <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Invoice Not Found</h2>
          <p className="text-gray-500 mb-4">The invoice you're looking for doesn't exist.</p>
          <button onClick={() => navigate('/')} className="text-teal-600 hover:underline">
            Back to Inbox
          </button>
        </div>
      </div>
    );
  }

  const currentTabIndex = tabs.findIndex(t => t.id === activeTab);
  const isReadyForApproval = invoice.status === 'ready_for_approval';

  // Open approval modal to run the Approval Agent
  const handleRouteForApproval = () => {
    setShowApprovalModal(true);
  };

  // Handle completion of Approval Agent analysis
  const handleApprovalComplete = (result) => {
    handleApprovalTriageResult(invoice.id, result);
    setShowApprovalModal(false);
    
    // Navigate based on the triage result
    if (result.route === 'auto_approve') {
      navigate('/pay');
    } else if (result.route === 'route_to_human') {
      navigate('/approvals');
    } else {
      navigate('/'); // Stay on inbox for rejected
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const getDaysUntilDue = () => {
    if (!invoice.dueDate) return null;
    const due = new Date(invoice.dueDate);
    const now = new Date();
    const diff = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const daysUntilDue = getDaysUntilDue();

  return (
    <div className="fixed inset-0 bg-gray-50 z-50 flex flex-col">
      {/* Status Banner - Full Width at Top */}
      <div className={`px-6 py-2 flex items-center justify-center gap-2 ${
        isReadyForApproval 
          ? 'bg-teal-500 text-white' 
          : 'bg-amber-500 text-white'
      }`}>
        {isReadyForApproval ? (
          <>
            <CheckCircle size={16} strokeWidth={2.5} />
            <span className="font-medium text-sm">All Clear — Ready for Approval</span>
          </>
        ) : (
          <>
            <AlertCircle size={16} strokeWidth={2.5} />
            <span className="font-medium text-sm">Review Required — Check Flagged Fields</span>
          </>
        )}
      </div>

      {/* Header Bar */}
      <div className="bg-white border-b border-gray-200 px-5 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center">
            <Building2 size={18} className="text-gray-500" />
          </div>
          <div>
          <div className="flex items-center gap-2">
              <h1 className="font-semibold text-gray-900 text-sm">{invoice.vendor}</h1>
              <span className="text-[11px] font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                #{invoice.invoiceNumber}
              </span>
            </div>
            <p className="text-xs text-gray-500">${formatCurrency(invoice.amount)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {invoice.aiProcessed && (
            <button 
              onClick={() => setShowProcessingHistory(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors border border-purple-200 text-sm"
            >
              <Cpu size={14} />
              <span>View AI Processing</span>
            </button>
          )}
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors border border-gray-200 text-sm">
            <MessageSquare size={14} />
            <span>Collaborate</span>
          </button>
          <button
            onClick={() => navigate('/')}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={18} className="text-gray-400" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-5 py-3">
        <div className="flex items-center justify-center gap-1">
          {tabs.map((tab, idx) => (
            <div key={tab.id} className="flex items-center">
              <button
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-full transition-all ${
                  activeTab === tab.id
                    ? 'bg-teal-500 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <tab.icon size={14} />
                {tab.label}
              </button>
              {idx < tabs.length - 1 && (
                <div className="flex items-center mx-1.5 text-gray-300">
                  <span className="w-6 border-t border-dashed border-gray-300"></span>
                  <ChevronRight size={12} />
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-center mt-2">
          <div className="flex items-center gap-1.5">
            <div className="w-24 h-0.5 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-teal-500 rounded-full transition-all duration-300"
                style={{ width: `${((currentTabIndex + 1) / tabs.length) * 100}%` }}
              />
            </div>
            <span className="text-[10px] text-gray-400">{currentTabIndex + 1} / {tabs.length}</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - PDF Viewer */}
        <div className="w-[40%] bg-white border-r border-gray-200">
          <PDFViewer invoice={invoice} />
        </div>

        {/* Right Panel */}
        <div className="w-[60%] overflow-auto px-6 py-5">
          {activeTab === 'header' && (
            <div className="space-y-5 max-w-2xl">
              {/* Section Title */}
              <div>
                <h2 className="text-base font-semibold text-gray-900">Header Details</h2>
                <p className="text-xs text-gray-500">Invoice number, date, currency, and basic information</p>
              </div>

              {/* Invoice Total */}
              <div>
                <p className="text-3xl font-bold text-gray-900">
                  ${formatCurrency(invoice.amount)}
                  <span className="text-sm font-normal text-gray-400 ml-2">{invoice.currency || 'USD'}</span>
                </p>
                {daysUntilDue !== null && (
                  <div className={`flex items-center gap-1 mt-1 text-xs ${daysUntilDue < 0 ? 'text-red-500' : 'text-teal-600'}`}>
                    <Clock size={12} />
                    <span>
                      {daysUntilDue < 0 
                        ? `${Math.abs(daysUntilDue)} days overdue` 
                        : `${daysUntilDue} days until due`}
                    </span>
                  </div>
                )}
              </div>

              {/* Bill From / Bill To */}
              <div className="grid grid-cols-2 gap-4">
                {/* Bill From */}
                <div className={`bg-white border rounded-xl p-4 ${
                  invoice.billFrom?._aiExtracted?.name ? 'border-purple-200 ring-1 ring-purple-50' : 'border-gray-200'
                }`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        invoice.billFrom?._aiExtracted?.name ? 'bg-purple-50' : 'bg-gray-100'
                      }`}>
                        <Send size={14} className={invoice.billFrom?._aiExtracted?.name ? 'text-purple-500' : 'text-gray-500'} />
                      </div>
                      <h3 className="font-semibold text-sm text-gray-900">Bill From (Vendor)</h3>
                    </div>
                    {invoice.billFrom?._aiExtracted?.name && (
                      <div className="flex items-center gap-1 text-purple-500" title="AI Extracted">
                        <Sparkles size={12} />
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    <Field 
                      icon={Building2} 
                      label="Vendor Name" 
                      value={invoice.billFrom?.name || invoice.vendor}
                      aiExtracted={invoice.billFrom?._aiExtracted?.name || invoice._aiExtracted?.vendor}
                      onClick={handleFieldClick}
                    />
                    <Field 
                      icon={MapPin} 
                      label="Address" 
                      value={invoice.billFrom?.address}
                      aiExtracted={invoice.billFrom?._aiExtracted?.address}
                      onClick={handleFieldClick}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Field 
                        icon={Mail} 
                        label="Email" 
                        value={invoice.billFrom?.email} 
                        small
                        aiExtracted={invoice.billFrom?._aiExtracted?.email}
                        onClick={handleFieldClick}
                      />
                      <Field 
                        icon={Phone} 
                        label="Phone" 
                        value={invoice.billFrom?.phone} 
                        small
                        aiExtracted={invoice.billFrom?._aiExtracted?.phone}
                        onClick={handleFieldClick}
                      />
                    </div>
                  </div>
                </div>

                {/* Bill To */}
                <div className={`bg-white border rounded-xl p-4 ${
                  invoice.billTo?._aiExtracted?.name ? 'border-purple-200 ring-1 ring-purple-50' : 'border-gray-200'
                }`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        invoice.billTo?._aiExtracted?.name ? 'bg-purple-50' : 'bg-teal-50'
                      }`}>
                        <FileText size={14} className={invoice.billTo?._aiExtracted?.name ? 'text-purple-500' : 'text-teal-600'} />
                      </div>
                      <h3 className="font-semibold text-sm text-gray-900">Bill To (Customer)</h3>
                    </div>
                    {invoice.billTo?._aiExtracted?.name && (
                      <div className="flex items-center gap-1 text-purple-500" title="AI Extracted">
                        <Sparkles size={12} />
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    <Field 
                      icon={Building2} 
                      label="Company Name" 
                      value={invoice.billTo?.name}
                      aiExtracted={invoice.billTo?._aiExtracted?.name}
                      onClick={handleFieldClick}
                    />
                    <Field 
                      icon={MapPin} 
                      label="Billing Address" 
                      value={invoice.billTo?.address}
                      aiExtracted={invoice.billTo?._aiExtracted?.address}
                      onClick={handleFieldClick}
                    />
                    <Field 
                      icon={Building2} 
                      label="Business Entity" 
                      value={invoice.billTo?.entity}
                      aiExtracted={invoice.billTo?._aiExtracted?.entity}
                      onClick={handleFieldClick}
                    />
                  </div>
                </div>
              </div>

              {/* Invoice Details */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm text-gray-900">Invoice Details</h3>
                  {invoice.aiProcessed && (
                    <div className="flex items-center gap-1.5 text-[10px] text-purple-500 bg-purple-50 px-2 py-1 rounded-full">
                      <Sparkles size={10} />
                      <span>Click any field to see extraction source</span>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <Field 
                    icon={Hash} 
                    label="Invoice Number" 
                    value={invoice.invoiceNumber}
                    aiExtracted={invoice._aiExtracted?.invoiceNumber}
                    onClick={handleFieldClick}
                  />
                  <Field 
                    icon={Calendar} 
                    label="Invoice Date" 
                    value={invoice.invoiceDate ? new Date(invoice.invoiceDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''} 
                    showIconInValue
                    aiExtracted={invoice._aiExtracted?.invoiceDate}
                    onClick={handleFieldClick}
                  />
                  <Field 
                    icon={Clock} 
                    label="Due Date" 
                    value={invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''} 
                    showIconInValue
                    aiExtracted={invoice._aiExtracted?.dueDate}
                    onClick={handleFieldClick}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field 
                    icon={DollarSign} 
                    label="Currency" 
                    value={invoice.currency || 'USD'} 
                    prefix="$"
                    dropdown
                    aiExtracted={invoice._aiExtracted?.currency}
                    onClick={handleFieldClick}
                  />
                  <Field 
                    icon={FileText} 
                    label="Payment Terms" 
                    value={invoice.paymentTerms} 
                    dropdown
                    aiExtracted={invoice._aiExtracted?.paymentTerms && !invoice._validationCorrected?.payment_terms}
                    validationCorrected={!!invoice._validationCorrected?.payment_terms}
                    onClick={handleFieldClick}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'vendor' && (
            <div className="space-y-5 max-w-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Vendor Compliance</h2>
                  <p className="text-xs text-gray-500">Tax IDs, banking verification, and remit-to addresses</p>
                </div>
                {invoice._aiExtracted?.billFrom && (
                  <div className="flex items-center gap-1.5 text-[10px] text-purple-500 bg-purple-50 px-2 py-1 rounded-full">
                    <Sparkles size={10} />
                    <span>AI Extracted Fields</span>
                  </div>
                )}
              </div>

              {/* Vendor Information Section */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <FileText size={14} className={invoice._aiExtracted?.vendor ? 'text-purple-400' : 'text-gray-400'} />
                  <span className="text-sm font-medium text-gray-700">Vendor Information</span>
                </div>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Field 
                      icon={Building2} 
                      label="Vendor Name" 
                      value={invoice.billFrom?.name || invoice.vendor}
                      aiExtracted={invoice.billFrom?._aiExtracted?.name || invoice._aiExtracted?.vendor}
                      onClick={handleFieldClick}
                    />
                    <Field icon={FileText} label="Tax ID / EIN" value="XX-XXXXXXX" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field 
                      icon={Mail} 
                      label="Email" 
                      value={invoice.billFrom?.email}
                      aiExtracted={invoice.billFrom?._aiExtracted?.email}
                      onClick={handleFieldClick}
                    />
                    <Field 
                      icon={Phone} 
                      label="Phone" 
                      value={invoice.billFrom?.phone}
                      aiExtracted={invoice.billFrom?._aiExtracted?.phone}
                      onClick={handleFieldClick}
                    />
                  </div>
                </div>
              </div>

              {/* Remit-to Address Section */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <MapPin size={14} className={invoice.billFrom?._aiExtracted?.address ? 'text-purple-400' : 'text-gray-400'} />
                  <span className="text-sm font-medium text-gray-700">Remit-to Address</span>
                  {invoice.billFrom?._aiExtracted?.address && (
                    <Sparkles size={12} className="text-purple-400" />
                  )}
                </div>
                <Field 
                  icon={MapPin} 
                  label="Address" 
                  value={invoice.billFrom?.address} 
                  hideLabel
                  aiExtracted={invoice.billFrom?._aiExtracted?.address}
                  onClick={handleFieldClick}
                />
              </div>
            </div>
          )}

          {activeTab === 'line_items' && (
            <div className="space-y-4 max-w-3xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Line Items</h2>
                  <p className="text-xs text-gray-500">Verify extracted line items and GL coding</p>
                </div>
                {invoice._aiExtracted?.items && (
                  <div className="flex items-center gap-1.5 text-[10px] text-purple-500 bg-purple-50 px-2 py-1 rounded-full">
                    <Sparkles size={10} />
                    <span>AI Extracted</span>
                  </div>
                )}
              </div>

              {/* Stats Header */}
              <div className={`bg-white border rounded-xl p-4 flex items-center justify-between ${
                invoice._aiExtracted?.items ? 'border-purple-200 ring-1 ring-purple-50' : 'border-gray-200'
              }`}>
                <div className="flex items-center gap-6">
                  <div className="flex items-baseline gap-1.5">
                    <span className={`text-2xl font-bold ${invoice._aiExtracted?.items ? 'text-purple-600' : 'text-gray-900'}`}>
                      {invoice.lineItems?.length || 1}
                    </span>
                    <span className="text-sm text-gray-500">Lines</span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className={`text-2xl font-bold ${invoice._aiExtracted?.amount ? 'text-purple-600' : 'text-gray-900'}`}>
                      ${formatCurrency(invoice.amount)}
                    </span>
                    <span className="text-sm text-gray-500">Total</span>
                    {invoice._aiExtracted?.amount && (
                      <Sparkles size={12} className="text-purple-400 ml-1" />
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-teal-600">
                    <CheckCircle size={16} strokeWidth={2.5} />
                    <span className="text-sm font-medium">All Verified</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {invoice._aiExtracted?.items && (
                    <Sparkles size={16} className="text-purple-400" />
                  )}
                  <span className={`text-2xl font-bold ${invoice._aiExtracted?.items ? 'text-purple-500' : 'text-teal-500'}`}>
                    {invoice.confidence || 100}%
                  </span>
                </div>
              </div>

              {/* Filter */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Filter..."
                  className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 pl-10 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              {/* Table */}
              <div className={`bg-white border rounded-xl overflow-hidden ${
                invoice._aiExtracted?.items ? 'border-purple-200' : 'border-gray-200'
              }`}>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-3 font-medium text-gray-500 text-[11px] w-8">#</th>
                      <th className="text-left py-3 px-3 font-medium text-gray-500 text-[11px]">Item</th>
                      <th className="text-left py-3 px-3 font-medium text-gray-500 text-[11px]">Description</th>
                      <th className="text-center py-3 px-3 font-medium text-gray-500 text-[11px]">Qty</th>
                      <th className="text-right py-3 px-3 font-medium text-gray-500 text-[11px]">Rate</th>
                      <th className="text-right py-3 px-3 font-medium text-gray-500 text-[11px]">Amount</th>
                      <th className="w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {invoice.lineItems?.length > 0 ? (
                      invoice.lineItems.map((item, idx) => (
                        <tr key={idx} className={`hover:bg-gray-50 ${item._aiExtracted?.description ? 'bg-purple-50/30' : ''}`}>
                          <td className="py-3 px-3 text-gray-400">{idx + 1}.</td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5">
                              {item._aiExtracted?.sku && <Sparkles size={10} className="text-purple-400" />}
                              <span className={`font-medium ${item._aiExtracted?.sku ? 'text-purple-700' : 'text-gray-900'}`}>
                                {item.item || item.sku || `ITEM-${idx + 1}`}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5">
                              {item._aiExtracted?.description && <Sparkles size={10} className="text-purple-400" />}
                              <span className={item._aiExtracted?.description ? 'text-purple-700' : 'text-gray-600'}>
                                {item.description}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className={item._aiExtracted?.quantity ? 'text-purple-700 font-medium' : 'text-gray-600'}>
                              {item.quantity}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <span className={item._aiExtracted?.rate ? 'text-purple-700' : 'text-gray-600'}>
                              {item.rate ? `$${item.rate.toLocaleString()}` : '—'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {item._aiExtracted?.amount && <Sparkles size={10} className="text-purple-400" />}
                              <span className={`font-medium ${item._aiExtracted?.amount ? 'text-purple-700' : 'text-gray-900'}`}>
                                {item.amount ? `$${item.amount.toLocaleString()}` : '—'}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center justify-end gap-1">
                              <button className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>
                              <button className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-red-500">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr className="hover:bg-gray-50">
                        <td className="py-3 px-3 text-gray-400">1.</td>
                        <td className="py-3 px-3 text-gray-900 font-medium">INV-TOTAL</td>
                        <td className="py-3 px-3 text-gray-600">Invoice Total</td>
                        <td className="py-3 px-3 text-center text-gray-600">1</td>
                        <td className="py-3 px-3 text-right text-gray-600">${invoice.amount?.toLocaleString()}</td>
                        <td className="py-3 px-3 text-right font-medium text-gray-900">${invoice.amount?.toLocaleString()}</td>
                        <td className="py-3 px-3">
                          <div className="flex items-center justify-end gap-1">
                            <button className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                            <button className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-red-500">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="space-y-4 max-w-2xl">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Documents</h2>
                <p className="text-xs text-gray-500">Attached documents and files</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Paperclip size={20} className="text-gray-400" />
                </div>
                <h3 className="font-semibold text-sm text-gray-900 mb-1">Original Invoice PDF</h3>
                <p className="text-gray-500 text-xs">1 document attached</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="bg-white border-t border-gray-200 px-5 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>←</span>
          <span>→</span>
          <span className="text-gray-500 ml-1">Navigate</span>
          <span className="mx-2 text-gray-300">|</span>
          <span className="text-gray-500">Esc</span>
          <span className="text-gray-500 ml-1">Close</span>
        </div>

        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors border border-gray-200 text-sm">
            <Save size={14} />
            <span>Save Draft</span>
          </button>
          <button
            onClick={handleRouteForApproval}
            className="flex items-center gap-1.5 bg-teal-500 hover:bg-teal-600 text-white font-medium text-sm px-4 py-2 rounded-lg transition-colors"
          >
            <Send size={14} />
            Route for Approval
          </button>
        </div>
      </div>

      {/* Processing History Modal */}
      {showProcessingHistory && (
        <ProcessingHistoryView 
          invoice={invoice} 
          onClose={() => {
            setShowProcessingHistory(false);
            setHighlightField(null);
          }}
          highlightField={highlightField}
        />
      )}

      {/* Approval Processing Modal (Stage 2: Smart Triage) */}
      {showApprovalModal && (
        <ApprovalProcessingModal
          invoice={invoice}
          onComplete={handleApprovalComplete}
          onClose={() => setShowApprovalModal(false)}
        />
      )}
    </div>
  );
}

// Compact Field Component with AI Extraction & Validation Correction Indicators
// - Purple: AI Extracted (from Ingestion Agent)
// - Amber: Validation Corrected (changed by Validation Agent)
// When aiExtracted or validationCorrected is true and onClick is provided, field is clickable
function Field({ icon: Icon, label, value, small, prefix, dropdown, showIconInValue, hideLabel, aiExtracted, validationCorrected, onClick }) {
  const hasValue = value && value !== '—' && value !== 'null';
  const showAiIndicator = aiExtracted && hasValue && !validationCorrected;
  const showCorrectionIndicator = validationCorrected && hasValue;
  const isClickable = (showAiIndicator || showCorrectionIndicator) && onClick;
  
  const handleClick = () => {
    if (isClickable) {
      onClick(label, value);
    }
  };
  
  // Determine styling based on indicator type
  const getBorderStyle = () => {
    if (showCorrectionIndicator) return 'border-amber-200 ring-1 ring-amber-100';
    if (showAiIndicator) return 'border-purple-200 ring-1 ring-purple-100';
    return 'border-gray-200';
  };
  
  const getHoverStyle = () => {
    if (showCorrectionIndicator) return 'cursor-pointer hover:ring-2 hover:ring-amber-300 hover:border-amber-300';
    if (showAiIndicator) return 'cursor-pointer hover:ring-2 hover:ring-purple-300 hover:border-purple-300';
    return '';
  };
  
  const getIconColor = () => {
    if (showCorrectionIndicator) return 'text-amber-500';
    if (showAiIndicator) return 'text-purple-400';
    return 'text-gray-400';
  };
  
  const getLabelColor = () => {
    if (showCorrectionIndicator) return 'text-amber-600';
    if (showAiIndicator) return 'text-purple-600';
    return 'text-gray-500';
  };
  
  return (
    <div 
      className={`border rounded-lg bg-white overflow-hidden transition-all ${getBorderStyle()} ${isClickable ? getHoverStyle() : ''}`}
      onClick={handleClick}
      title={showCorrectionIndicator ? 'Corrected by Validation Agent - Click to view details' : isClickable ? 'Click to see extraction source' : undefined}
    >
      {/* Label Row */}
      {!hideLabel && (
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100">
          <div className="flex items-center gap-1.5">
            <Icon size={12} className={getIconColor()} />
            <span className={`font-medium ${small ? 'text-[10px]' : 'text-[11px]'} ${getLabelColor()}`}>
              {label}
            </span>
          </div>
          {showCorrectionIndicator && (
            <div className="flex items-center gap-1 text-amber-500" title="Corrected by Validation Agent">
              <AlertCircle size={10} />
              {isClickable && (
                <span className="text-[9px] text-amber-500 ml-0.5">Corrected</span>
              )}
            </div>
          )}
          {showAiIndicator && (
            <div className="flex items-center gap-1 text-purple-500" title="AI Extracted - Click to view source">
              <Sparkles size={10} />
              {isClickable && (
                <span className="text-[9px] text-purple-400 ml-0.5">View source</span>
              )}
            </div>
          )}
        </div>
      )}
      {/* Value Row */}
      <div className={`flex items-center justify-between px-3 ${small ? 'py-2' : 'py-2.5'}`}>
        <div className="flex items-center gap-1.5">
          {showIconInValue && <Icon size={12} className={getIconColor()} />}
          {prefix && <span className={`text-sm ${getIconColor()}`}>{prefix}</span>}
          <span className={`${small ? 'text-xs' : 'text-sm'} ${
            hasValue ? 'text-gray-900' : 'text-gray-400 italic'
          }`}>
            {hasValue ? value : '—'}
          </span>
        </div>
        {dropdown && <ChevronDown size={12} className="text-gray-400" />}
      </div>
    </div>
  );
}
