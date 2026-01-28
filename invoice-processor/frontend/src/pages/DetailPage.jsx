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
  AlertTriangle,
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
  Sparkles,
  TrendingDown,
  ShieldAlert,
  Ban,
  XCircle
} from 'lucide-react';
import PDFViewer from '../components/PDFViewer';
import ProcessingHistoryView from '../components/ProcessingHistoryView';
import ProcessingView from '../components/ProcessingView';
import CollaboratePanel from '../components/CollaboratePanel';
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
  const [showCollaboratePanel, setShowCollaboratePanel] = useState(false);
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
  // Check for all "good" statuses that should show the green banner
  const goodStatuses = ['ready_for_approval', 'approved', 'auto_approved', 'paid', 'fully_approved'];
  const isReadyForApproval = goodStatuses.includes(invoice.status);
  const isRejected = invoice.status === 'rejected';

  // Parse vendor risk warnings from validation
  const validationWarnings = invoice.aiValidation?.warnings || [];
  const validationErrors = invoice.aiValidation?.errors || [];
  
  // Check for specific vendor risk conditions
  const vendorRiskAlerts = {
    isSuspended: validationErrors.some(e => e.includes('SUSPENDED')),
    isHighRisk: validationWarnings.some(w => w.includes('HIGH RISK')),
    hasIncompleteCompliance: validationWarnings.some(w => w.includes('incomplete compliance')),
  };
  const hasVendorRiskAlerts = vendorRiskAlerts.isSuspended || vendorRiskAlerts.isHighRisk || vendorRiskAlerts.hasIncompleteCompliance;

  // Open approval modal to run the Approval Agent
  const handleRouteForApproval = () => {
    setShowApprovalModal(true);
  };

  // Handle completion of Approval Agent analysis (from ProcessingView in approval mode)
  const handleApprovalComplete = (result, extractedData, validationResult, approvalResult, processingHistory) => {
    // The result from ProcessingView contains the route info
    const triageResult = {
      route: result.route,
      invoiceStatus: result.invoiceStatus,
      processingTime: result.processingTime,
      tokenUsage: result.tokenUsage,
    };
    
    // Pass the processing history so it can be merged with existing history
    handleApprovalTriageResult(invoice.id, triageResult, processingHistory);
    setShowApprovalModal(false);
    
    // Navigate based on the triage result
    if (result.route === 'auto_approve' || result.status === 'auto_approved') {
      navigate('/pay');
    } else if (result.route === 'route_to_human' || result.status === 'pending_approval') {
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
      {/* Critical: Suspended Vendor or Rejected Invoice */}
      {(vendorRiskAlerts.isSuspended || isRejected) ? (
        <div className="px-6 py-2.5 flex items-center justify-center gap-2 bg-red-600 text-white">
          <Ban size={16} strokeWidth={2.5} />
          <span className="font-medium text-sm">
            {vendorRiskAlerts.isSuspended 
              ? `⚠️ SUSPENDED VENDOR — ${invoice.vendor} is blocked in vendor master` 
              : `Auto-Rejected — Critical issues detected`}
          </span>
        </div>
      ) : (
        <div className={`px-6 py-2 flex items-center justify-center gap-2 ${
          isReadyForApproval 
            ? 'bg-teal-500 text-white' 
            : hasVendorRiskAlerts
              ? 'bg-amber-600 text-white'
              : 'bg-amber-500 text-white'
        }`}>
          {isReadyForApproval ? (
            <>
              <CheckCircle size={16} strokeWidth={2.5} />
              <span className="font-medium text-sm">All Clear — Ready for Approval</span>
            </>
          ) : hasVendorRiskAlerts ? (
            <>
              <ShieldAlert size={16} strokeWidth={2.5} />
              <span className="font-medium text-sm">⚠️ Vendor Risk Alerts — Review Compliance Tab</span>
            </>
          ) : (
            <>
              <AlertCircle size={16} strokeWidth={2.5} />
              <span className="font-medium text-sm">Review Required — Check Flagged Fields</span>
            </>
          )}
        </div>
      )}

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
          <button 
            onClick={() => setShowCollaboratePanel(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors border border-gray-200 text-sm"
          >
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
              {/* Rejection/Critical Issues Banner - Only for rejected invoices or critical errors */}
              {(isRejected || validationErrors.length > 0) && (
                <div className={`border rounded-xl overflow-hidden ${
                  isRejected ? 'border-red-300 ring-2 ring-red-100' : 'border-amber-300'
                }`}>
                  <div className={`px-4 py-3 flex items-center gap-2 ${
                    isRejected ? 'bg-red-50' : 'bg-amber-50'
                  }`}>
                    <XCircle size={18} className={isRejected ? 'text-red-500' : 'text-amber-500'} />
                    <h3 className={`font-semibold text-sm ${isRejected ? 'text-red-800' : 'text-amber-800'}`}>
                      {isRejected ? 'Invoice Auto-Rejected' : 'Validation Issues'}
                    </h3>
                    {isRejected && (
                      <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                        CRITICAL
                      </span>
                    )}
                  </div>
                  <div className="px-4 py-3 bg-white space-y-2">
                    {/* Show validation errors (deduplicated) - these are the primary issues */}
                    {validationErrors.length > 0 && (
                      <div className="space-y-1.5">
                        {validationErrors.map((error, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-sm text-red-700">
                            <Ban size={14} className="mt-0.5 flex-shrink-0" />
                            <span>{error}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Show rejection reason - summarizes the issues */}
                    {isRejected && invoice.rejectionReason && (
                      <div className="pt-2 mt-2 border-t border-red-100">
                        <p className="text-xs text-red-600">
                          <strong>Rejection Reason:</strong> {invoice.rejectionReason}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

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
                      aiExtracted={invoice.billFrom?._aiExtracted?.address && !invoice.billFrom?._validationEnriched?.address}
                      validationCorrected={!!invoice.billFrom?._validationEnriched?.address}
                      onClick={handleFieldClick}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Field 
                        icon={Mail} 
                        label="Email" 
                        value={invoice.billFrom?.email} 
                        small
                        aiExtracted={invoice.billFrom?._aiExtracted?.email && !invoice.billFrom?._validationEnriched?.email}
                        validationCorrected={!!invoice.billFrom?._validationEnriched?.email}
                        onClick={handleFieldClick}
                      />
                      <Field 
                        icon={Phone} 
                        label="Phone" 
                        value={invoice.billFrom?.phone} 
                        small
                        aiExtracted={invoice.billFrom?._aiExtracted?.phone && !invoice.billFrom?._validationEnriched?.phone}
                        validationCorrected={!!invoice.billFrom?._validationEnriched?.phone}
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

          {activeTab === 'vendor' && (() => {
            // Session 2026-01-28_VENDOR: Use vendor master data instead of AI extraction
            // vendorProfile is the authoritative source from vendor master database
            const vendorProfile = invoice.vendorProfile;
            const hasVendorRecord = !!vendorProfile;
            
            // Build full address from vendor profile components
            const vendorAddress = hasVendorRecord && vendorProfile.address
              ? [vendorProfile.address, vendorProfile.city, vendorProfile.state, vendorProfile.zip_code]
                  .filter(Boolean)
                  .join(', ')
              : null;
            
            return (
            <div className="space-y-5 max-w-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Vendor Compliance</h2>
                  <p className="text-xs text-gray-500">Tax IDs, banking verification, and remit-to addresses</p>
                </div>
                {/* Show "Vendor on Record" badge if matched, or "Not Found" warning if not */}
                {hasVendorRecord ? (
                  <div className="flex items-center gap-1.5 text-[10px] text-teal-600 bg-teal-50 px-2 py-1 rounded-full border border-teal-200">
                    <CheckCircle size={10} />
                    <span>Vendor on Record: {vendorProfile.vendor_id}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-[10px] text-amber-600 bg-amber-50 px-2 py-1 rounded-full border border-amber-200">
                    <AlertTriangle size={10} />
                    <span>Vendor Not in System</span>
                  </div>
                )}
              </div>

              {/* Vendor Risk Alerts Section - Only shown when there are risks */}
              {hasVendorRiskAlerts && (
                <div className={`border rounded-xl overflow-hidden ${
                  vendorRiskAlerts.isSuspended ? 'border-red-300 ring-2 ring-red-100' : 'border-amber-300 ring-1 ring-amber-100'
                }`}>
                  {/* Header */}
                  <div className={`px-4 py-3 flex items-center gap-2 ${
                    vendorRiskAlerts.isSuspended ? 'bg-red-50' : 'bg-amber-50'
                  }`}>
                    <ShieldAlert size={18} className={vendorRiskAlerts.isSuspended ? 'text-red-500' : 'text-amber-500'} />
                    <h3 className={`font-semibold text-sm ${vendorRiskAlerts.isSuspended ? 'text-red-800' : 'text-amber-800'}`}>
                      Vendor Risk Alerts
                    </h3>
                    <span className={`ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      vendorRiskAlerts.isSuspended 
                        ? 'bg-red-100 text-red-700' 
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {vendorRiskAlerts.isSuspended ? 'CRITICAL' : 'WARNING'}
                    </span>
                  </div>
                  
                  {/* Alert Items */}
                  <div className="divide-y divide-gray-100 bg-white">
                    {/* Suspended Vendor Alert */}
                    {vendorRiskAlerts.isSuspended && (
                      <div className="px-4 py-3 flex items-start gap-3 bg-red-50/50">
                        <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                          <Ban size={16} className="text-red-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-red-800">Vendor Suspended</span>
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-100 text-red-700">BLOCKED</span>
                          </div>
                          <p className="text-xs text-red-700 mt-0.5">
                            {invoice.vendor} is suspended in the vendor master directory. This invoice cannot be processed until the vendor status is resolved.
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {/* High Risk Alert */}
                    {vendorRiskAlerts.isHighRisk && (
                      <div className="px-4 py-3 flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                          <AlertTriangle size={16} className="text-amber-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-amber-800">High Risk Vendor</span>
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">FLAGGED</span>
                          </div>
                          <p className="text-xs text-gray-600 mt-0.5">
                            This vendor has been flagged as high risk in our system. Additional scrutiny is recommended before approval.
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {/* Incomplete Compliance Alert */}
                    {vendorRiskAlerts.hasIncompleteCompliance && (
                      <div className="px-4 py-3 flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                          <FileText size={16} className="text-amber-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-amber-800">Incomplete Compliance</span>
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">MISSING DOCS</span>
                          </div>
                          <p className="text-xs text-gray-600 mt-0.5">
                            Vendor has incomplete compliance documentation (e.g., W-9, certificates). Request updated documents before processing.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Vendor Information Section - FROM VENDOR MASTER (not AI) */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <FileText size={14} className="text-gray-400" />
                  <span className="text-sm font-medium text-gray-700">Vendor Information</span>
                </div>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    {/* Vendor Name from vendor master */}
                    <Field 
                      icon={Building2} 
                      label="Vendor Name" 
                      value={hasVendorRecord ? vendorProfile.name : null}
                    />
                    {/* Tax ID from vendor master (masked for display) */}
                    <Field 
                      icon={FileText} 
                      label="Tax ID / EIN" 
                      value={hasVendorRecord && vendorProfile.tax_id ? vendorProfile.tax_id : null} 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Email from vendor master */}
                    <Field 
                      icon={Mail} 
                      label="Email" 
                      value={hasVendorRecord ? vendorProfile.email : null}
                    />
                    {/* Phone from vendor master */}
                    <Field 
                      icon={Phone} 
                      label="Phone" 
                      value={hasVendorRecord ? vendorProfile.phone : null}
                    />
                  </div>
                </div>
              </div>

              {/* Remit-to Address Section - FROM VENDOR MASTER (not AI) */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <MapPin size={14} className="text-gray-400" />
                  <span className="text-sm font-medium text-gray-700">Remit-to Address</span>
                </div>
                <Field 
                  icon={MapPin} 
                  label="Address" 
                  value={vendorAddress} 
                  hideLabel
                />
              </div>
            </div>
            );
          })()}

          {activeTab === 'line_items' && (() => {
            // Get validated line items if available
            const validatedItems = invoice.aiValidation?.line_items_validated || [];
            const hasValidationData = validatedItems.length > 0;
            const itemsWithIssues = validatedItems.filter(i => i.has_stock_issue);
            const hasInventoryIssues = itemsWithIssues.length > 0;
            
            // Calculate total variance
            const totalVariance = validatedItems.reduce((sum, item) => {
              if (item.has_stock_issue && item.variance < 0) {
                return sum + item.variance;
              }
              return sum;
            }, 0);
            
            return (
            <div className="space-y-4 max-w-4xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Line Items</h2>
                  <p className="text-xs text-gray-500">Verify extracted line items and inventory validation</p>
                </div>
                {invoice._aiExtracted?.items && (
                  <div className="flex items-center gap-1.5 text-[10px] text-purple-500 bg-purple-50 px-2 py-1 rounded-full">
                    <Sparkles size={10} />
                    <span>AI Extracted</span>
                  </div>
                )}
              </div>

              {/* Stats Header with Variance */}
              <div className={`bg-white border rounded-xl p-4 ${
                hasInventoryIssues ? 'border-red-200 ring-1 ring-red-50' : 
                invoice._aiExtracted?.items ? 'border-purple-200 ring-1 ring-purple-50' : 'border-gray-200'
              }`}>
                <div className="flex items-center justify-between">
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
                    {hasInventoryIssues ? (
                      <div className="flex items-center gap-1.5 text-red-600">
                        <AlertTriangle size={16} strokeWidth={2.5} />
                        <span className="text-sm font-medium">{itemsWithIssues.length} Exception{itemsWithIssues.length > 1 ? 's' : ''}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-teal-600">
                        <CheckCircle size={16} strokeWidth={2.5} />
                        <span className="text-sm font-medium">All Verified</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    {/* Variance Card */}
                    {hasValidationData && totalVariance !== 0 && (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200">
                        <TrendingDown size={14} className="text-red-500" />
                        <span className="text-xs text-gray-500">Qty Variance</span>
                        <span className="text-sm font-bold text-red-600">{totalVariance}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      {invoice._aiExtracted?.items && (
                        <Sparkles size={16} className="text-purple-400" />
                      )}
                      <span className={`text-2xl font-bold ${
                        hasInventoryIssues ? 'text-red-500' :
                        invoice._aiExtracted?.items ? 'text-purple-500' : 'text-teal-500'
                      }`}>
                        {invoice.confidence || 100}%
                      </span>
                    </div>
                  </div>
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
                hasInventoryIssues ? 'border-red-200' :
                invoice._aiExtracted?.items ? 'border-purple-200' : 'border-gray-200'
              }`}>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left py-3 px-3 font-medium text-gray-500 text-[11px] w-8">#</th>
                      <th className="text-left py-3 px-3 font-medium text-gray-500 text-[11px]">Description</th>
                      <th className="text-center py-3 px-3 font-medium text-gray-500 text-[11px]">Inv Qty</th>
                      {hasValidationData && (
                        <th className="text-center py-3 px-3 font-medium text-gray-500 text-[11px]">In Stock</th>
                      )}
                      <th className="text-right py-3 px-3 font-medium text-gray-500 text-[11px]">Rate</th>
                      <th className="text-right py-3 px-3 font-medium text-gray-500 text-[11px]">Amount</th>
                      {hasValidationData && (
                        <>
                          <th className="text-center py-3 px-3 font-medium text-gray-500 text-[11px]">Variance</th>
                          <th className="text-center py-3 px-3 font-medium text-gray-500 text-[11px]">Status</th>
                        </>
                      )}
                      <th className="w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {invoice.lineItems?.length > 0 ? (
                      invoice.lineItems.map((item, idx) => {
                        // Find matching validated item
                        const validatedItem = validatedItems.find(v => 
                          v.name === item.description || 
                          v.name === (item.description || item.item)
                        ) || validatedItems[idx];
                        const hasIssue = validatedItem?.has_stock_issue;
                        const variance = validatedItem?.variance;
                        const inStock = validatedItem?.in_stock;
                        const matchedTo = validatedItem?.matched_to;
                        const isFuzzyMatch = validatedItem?.is_fuzzy_match;
                        
                        return (
                        <tr key={idx} className={`hover:bg-gray-50 ${
                          hasIssue ? 'bg-red-50' : 
                          item._aiExtracted?.description ? 'bg-purple-50/30' : ''
                        }`}>
                          <td className="py-3 px-3 text-gray-400">{idx + 1}.</td>
                          <td className="py-3 px-3">
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1.5">
                                {item._aiExtracted?.description && <Sparkles size={10} className="text-purple-400" />}
                                <span className={`font-medium ${
                                  hasIssue ? 'text-red-700' :
                                  item._aiExtracted?.description ? 'text-purple-700' : 'text-gray-900'
                                }`}>
                                  {item.description}
                                </span>
                              </div>
                              {isFuzzyMatch && matchedTo && (
                                <div className="flex items-center gap-1 text-[10px] text-blue-600">
                                  <Sparkles size={8} />
                                  <span>Matched to "{matchedTo}"</span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className={`font-medium ${
                              hasIssue ? 'text-red-700' :
                              item._aiExtracted?.quantity ? 'text-purple-700' : 'text-gray-600'
                            }`}>
                              {item.quantity}
                            </span>
                          </td>
                          {hasValidationData && (
                            <td className="py-3 px-3 text-center">
                              <span className={`font-medium ${hasIssue ? 'text-red-600' : 'text-green-600'}`}>
                                {inStock !== undefined ? inStock : '—'}
                              </span>
                            </td>
                          )}
                          <td className="py-3 px-3 text-right">
                            <span className={item._aiExtracted?.rate ? 'text-purple-700' : 'text-gray-600'}>
                              {item.rate ? `$${item.rate.toLocaleString()}` : '—'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {item._aiExtracted?.amount && <Sparkles size={10} className="text-purple-400" />}
                              <span className={`font-medium ${
                                hasIssue ? 'text-red-700' :
                                item._aiExtracted?.amount ? 'text-purple-700' : 'text-gray-900'
                              }`}>
                                {item.amount ? `$${item.amount.toLocaleString()}` : '—'}
                              </span>
                            </div>
                          </td>
                          {hasValidationData && (
                            <>
                              <td className="py-3 px-3 text-center">
                                {variance !== undefined && variance !== 0 ? (
                                  <span className={`font-medium ${variance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                    {variance > 0 ? '+' : ''}{variance}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">—</span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-center">
                                {hasIssue ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700 border border-red-200">
                                    Exception
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700">
                                    <CheckCircle size={10} />
                                    OK
                                  </span>
                                )}
                              </td>
                            </>
                          )}
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
                        );
                      })
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
            );
          })()}

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

      {/* Processing View in Approval Mode (Stage 2: Smart Triage) */}
      {showApprovalModal && (
        <ProcessingView
          invoice={invoice}
          onComplete={handleApprovalComplete}
          approvalMode={true}
          existingData={{
            extractedData: {
              invoiceNumber: invoice.invoiceNumber,
              invoiceDate: invoice.invoiceDate,
              dueDate: invoice.dueDate,
              vendor: invoice.vendor,
              amount: invoice.amount,
              subtotal: invoice.subtotal,
              tax: invoice.tax,
              currency: invoice.currency,
              paymentTerms: invoice.paymentTerms,
              poNumber: invoice.poMatch,
              billFrom: invoice.billFrom,
              billTo: invoice.billTo,
              items: invoice.lineItems,
              confidence: invoice.confidence,
              flags: invoice.flags,
            },
            validationResult: invoice.aiValidation,
          }}
        />
      )}

      {/* Collaborate Panel (Comments, Approvals, Audit) */}
      {showCollaboratePanel && (
        <CollaboratePanel 
          invoice={invoice}
          onClose={() => setShowCollaboratePanel(false)}
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
