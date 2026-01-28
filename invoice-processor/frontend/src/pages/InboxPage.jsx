import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, AlertCircle, CheckCircle, Sparkles } from 'lucide-react';
import InvoiceTable from '../components/InvoiceTable';
import UploadModal from '../components/UploadModal';
import ProcessingView from '../components/ProcessingView';
import { useInvoices } from '../context/InvoiceContext';

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

export default function InboxPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('all');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [processingInvoice, setProcessingInvoice] = useState(null);
  const [routingInvoice, setRoutingInvoice] = useState(null); // For Approval Agent modal
  const [aiWorkflowEnabled, setAiWorkflowEnabled] = useState(true);
  
  const { processedInvoices, processedCount, addProcessedInvoice, handleApprovalTriageResult } = useInvoices();

  // Only show AI-processed invoices
  const allInvoices = processedInvoices;
  
  // Calculate stats dynamically
  const stats = {
    totalInvoices: allInvoices.length,
    totalAmount: allInvoices.reduce((sum, inv) => sum + inv.amount, 0),
    needsReview: allInvoices.filter(inv => inv.status === 'needs_review').length,
    readyForApproval: allInvoices.filter(inv => inv.status === 'ready_for_approval').length,
    rejected: allInvoices.filter(inv => inv.status === 'rejected').length,
    processedToday: processedCount,
  };

  const filteredInvoices = activeTab === 'all' 
    ? allInvoices 
    : activeTab === 'needs_review'
      ? allInvoices.filter(inv => inv.status === 'needs_review')
      : activeTab === 'rejected'
        ? allInvoices.filter(inv => inv.status === 'rejected')
        : allInvoices.filter(inv => inv.status === 'ready_for_approval');

  const needsReviewInvoices = allInvoices.filter(inv => inv.status === 'needs_review');
  const needsReviewTotal = needsReviewInvoices.reduce((sum, inv) => sum + inv.amount, 0);
  
  const readyInvoices = allInvoices.filter(inv => inv.status === 'ready_for_approval');
  const readyTotal = readyInvoices.reduce((sum, inv) => sum + inv.amount, 0);

  const handleSelectTestInvoice = (testInvoice) => {
    setShowUploadModal(false);
    setProcessingInvoice(testInvoice);
  };

  const handleProcessingComplete = (result, extractedData, validationResult, approvalResult, processingHistory) => {
    const newInvoice = createInvoiceFromResult(
      processingInvoice, 
      result, 
      extractedData, 
      validationResult, 
      approvalResult,
      processingHistory
    );
    
    addProcessedInvoice(newInvoice);
    setProcessingInvoice(null);
  };

  // Open the Approval Agent modal when routing an invoice
  const handleRoute = (invoice) => {
    setRoutingInvoice(invoice);
  };

  // Handle completion of Approval Agent analysis (from ProcessingView in approval mode)
  const handleApprovalComplete = (result, extractedData, validationResult, approvalResult, processingHistory) => {
    if (routingInvoice) {
      // The result from ProcessingView contains the route info
      const triageResult = {
        route: result.route,
        invoiceStatus: result.invoiceStatus,
        processingTime: result.processingTime,
        tokenUsage: result.tokenUsage,
      };
      
      // Pass the processing history so it can be merged with existing history
      handleApprovalTriageResult(routingInvoice.id, triageResult, processingHistory);
      
      // Navigate based on the triage result
      if (result.route === 'auto_approve' || result.status === 'auto_approved') {
        navigate('/pay');
      } else if (result.route === 'route_to_human' || result.status === 'pending_approval') {
        navigate('/approvals');
      }
      // For auto_reject, stay on inbox page (invoice will show as rejected)
      
      setRoutingInvoice(null);
    }
  };

  // Route all ready invoices (one at a time via modal)
  const handleRouteAll = () => {
    // Start with the first ready invoice
    const firstReady = processedInvoices.find(inv => inv.status === 'ready_for_approval');
    if (firstReady) {
      setRoutingInvoice(firstReady);
    }
  };

  // Determine which section to show based on active tab
  const showNeedsReviewSection = activeTab === 'all' || activeTab === 'needs_review';
  const showReadySection = activeTab === 'all' || activeTab === 'ready_for_approval';

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Invoice Inbox</h1>
        
        <div className="flex items-center gap-3">
          {/* AI Workflow Toggle */}
          <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-4 py-2">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-teal-500" />
              <span className="text-sm font-medium text-gray-700">AI Workflow</span>
              <span className="text-[10px] font-semibold bg-teal-100 text-teal-600 px-1.5 py-0.5 rounded">NEW</span>
            </div>
            <button
              onClick={() => setAiWorkflowEnabled(!aiWorkflowEnabled)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                aiWorkflowEnabled ? 'bg-teal-500' : 'bg-gray-300'
              }`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                aiWorkflowEnabled ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
            {!aiWorkflowEnabled && (
              <span className="text-xs text-gray-500">Click to enable</span>
            )}
          </div>
          
          {/* Upload Button */}
          <button 
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium text-sm px-4 py-2 rounded-lg transition-colors"
          >
            <Upload size={16} />
            Upload
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <span className="font-medium text-gray-900">{stats.totalInvoices}</span>
        <span>invoices</span>
        <span className="text-gray-300">|</span>
        <span className="font-medium text-gray-900">{formatCurrency(stats.totalAmount)}</span>
        <span>total</span>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => setActiveTab('needs_review')}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            activeTab === 'needs_review'
              ? 'bg-amber-50 text-amber-600 ring-1 ring-amber-200'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <AlertCircle size={15} />
          Needs Review
          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
            activeTab === 'needs_review' ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-600'
          }`}>
            {stats.needsReview}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('ready_for_approval')}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            activeTab === 'ready_for_approval'
              ? 'bg-teal-50 text-teal-600 ring-1 ring-teal-200'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <CheckCircle size={15} />
          Ready for Approval
          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
            activeTab === 'ready_for_approval' ? 'bg-teal-100 text-teal-600' : 'bg-gray-100 text-gray-600'
          }`}>
            {stats.readyForApproval}
          </span>
        </button>
      </div>

      {/* Empty State */}
      {allInvoices.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Sparkles size={28} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No invoices yet</h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            Process invoices through the AI workflow to see them appear here. Click Upload to get started.
          </p>
          <button 
            onClick={() => setShowUploadModal(true)}
            className="inline-flex items-center gap-2 bg-teal-500 hover:bg-teal-600 text-white font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            <Upload size={18} />
            Upload Invoice
          </button>
        </div>
      )}

      {/* Needs Review Section */}
      {needsReviewInvoices.length > 0 && showNeedsReviewSection && (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-2 h-2 bg-amber-400 rounded-full" />
            <h2 className="text-sm font-semibold text-gray-900">Invoices Requiring Review</h2>
            <span className="text-sm text-gray-500">
              {needsReviewInvoices.length} invoices • {formatCurrency(needsReviewTotal)}
            </span>
          </div>
          <InvoiceTable 
            invoices={needsReviewInvoices} 
            onRoute={handleRoute}
            variant="review"
          />
        </div>
      )}

      {/* Ready for Approval Section */}
      {readyInvoices.length > 0 && showReadySection && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-teal-400 rounded-full" />
              <h2 className="text-sm font-semibold text-gray-900">Ready for Approval</h2>
              <span className="text-sm text-gray-500">
                {readyInvoices.length} invoices • {formatCurrency(readyTotal)}
              </span>
            </div>
            <button
              onClick={handleRouteAll}
              className="text-sm font-medium text-teal-600 hover:text-teal-700 transition-colors"
            >
              Route all →
            </button>
          </div>
          <InvoiceTable 
            invoices={readyInvoices} 
            onRoute={handleRoute}
            variant="ready"
          />
        </div>
      )}

      {/* Upload Modal */}
      <UploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onSelectInvoice={handleSelectTestInvoice}
      />

      {/* Processing View (Stage 1: Ingestion + Validation) */}
      {processingInvoice && (
        <ProcessingView
          invoice={processingInvoice}
          onComplete={handleProcessingComplete}
        />
      )}

      {/* Processing View in Approval Mode (Stage 2: Smart Triage) */}
      {routingInvoice && (
        <ProcessingView
          invoice={routingInvoice}
          onComplete={handleApprovalComplete}
          approvalMode={true}
          existingData={{
            extractedData: {
              invoiceNumber: routingInvoice.invoiceNumber,
              invoiceDate: routingInvoice.invoiceDate,
              dueDate: routingInvoice.dueDate,
              vendor: routingInvoice.vendor,
              amount: routingInvoice.amount,
              subtotal: routingInvoice.subtotal,
              tax: routingInvoice.tax,
              currency: routingInvoice.currency,
              paymentTerms: routingInvoice.paymentTerms,
              poNumber: routingInvoice.poMatch,
              billFrom: routingInvoice.billFrom,
              billTo: routingInvoice.billTo,
              items: routingInvoice.lineItems,
              confidence: routingInvoice.confidence,
              flags: routingInvoice.flags,
            },
            validationResult: routingInvoice.aiValidation,
          }}
        />
      )}
    </div>
  );
}

// Helper function to create invoice entry from processing results
// NOW uses ACTUAL AI-extracted data AND applies validation corrections
function createInvoiceFromResult(testInvoice, result, extractedData, validationResult, approvalResult, processingHistory) {
  const now = new Date();
  
  // Get corrections from validation result (includes enrichments from vendor master)
  const corrections = result?.corrections || validationResult?.corrections || {};
  
  // IMPORTANT: result.invoiceData contains the FULLY ENRICHED data from the backend
  // This includes bill_from with phone/email populated from vendor master
  const backendInvoiceData = result?.invoiceData || {};
  
  // Apply corrections to extracted data (validation agent fixes like payment_terms)
  const correctedData = { ...extractedData };
  if (corrections.payment_terms?.corrected) {
    correctedData.paymentTerms = corrections.payment_terms.corrected;
  }
  
  // Use the enriched bill_from from backend if available (has phone/email from vendor master)
  if (backendInvoiceData.bill_from) {
    correctedData.billFrom = {
      name: backendInvoiceData.bill_from.name || extractedData?.billFrom?.name,
      address: backendInvoiceData.bill_from.address || extractedData?.billFrom?.address,
      phone: backendInvoiceData.bill_from.phone || extractedData?.billFrom?.phone,
      email: backendInvoiceData.bill_from.email || extractedData?.billFrom?.email,
    };
  }
  
  // Also apply vendor enrichments from corrections (in case bill_from wasn't in backend data)
  if (!correctedData.billFrom) {
    correctedData.billFrom = {};
  }
  if (corrections.phone?.corrected && !correctedData.billFrom.phone) {
    correctedData.billFrom = { ...correctedData.billFrom, phone: corrections.phone.corrected };
  }
  if (corrections.email?.corrected && !correctedData.billFrom.email) {
    correctedData.billFrom = { ...correctedData.billFrom, email: corrections.email.corrected };
  }
  if (corrections.address?.corrected && !correctedData.billFrom.address) {
    correctedData.billFrom = { ...correctedData.billFrom, address: corrections.address.corrected };
  }
  
  // Use the invoice number from AI extraction, fall back to generated ID
  const aiInvoiceNumber = correctedData?.invoiceNumber && correctedData.invoiceNumber !== 'UNKNOWN' 
    ? correctedData.invoiceNumber 
    : null;
  const invoiceId = processingHistory?.invoiceId || result?.invoiceId || aiInvoiceNumber || `INV-TC-US-${now.getTime().toString(36).toUpperCase().slice(-4)}`;
  
  // Use AI confidence if available, otherwise determine from status
  let confidence = extractedData?.confidence || 50;
  let status;
  let issueType = null;
  
  // Handle staged workflow statuses
  if (result.status === 'inbox') {
    // Stage 1 complete - determine status based on validation
    if (validationResult?.passed === false || (validationResult?.errors?.length > 0)) {
      status = 'needs_review';
      issueType = validationResult?.errors?.[0] || 'Validation Issues';
    } else {
      status = 'ready_for_approval';
    }
  } else if (result.status === 'auto_approved') {
    status = 'ready_for_approval';
  } else if (result.status === 'pending_approval') {
    status = 'needs_review';
    issueType = 'Requires VP Approval';
  } else if (result.status === 'approved') {
    status = 'ready_for_approval';
  } else if (result.status === 'rejected' || result.status === 'auto_reject') {
    status = 'rejected';
    issueType = result.reason || 'Rejected by AI';
  } else {
    status = 'needs_review';
  }

  // Build bill_from from ACTUAL AI extraction (or fallback to minimal data)
  // Also check correctedData which may have vendor enrichments
  const billFromSource = correctedData?.billFrom || extractedData?.billFrom;
  const billFrom = billFromSource ? {
    name: billFromSource.name || extractedData?.vendor || testInvoice.name,
    address: billFromSource.address || null,
    email: billFromSource.email || null,
    phone: billFromSource.phone || null,
    // Track which fields were AI-extracted
    _aiExtracted: {
      name: !!extractedData?.billFrom?.name,
      address: !!extractedData?.billFrom?.address,
      email: !!extractedData?.billFrom?.email,
      phone: !!extractedData?.billFrom?.phone,
    },
    // Track which fields were enriched from vendor master
    _validationEnriched: {
      phone: !!corrections.phone?.corrected,
      email: !!corrections.email?.corrected,
      address: !!corrections.address?.corrected,
    }
  } : {
    name: extractedData?.vendor || testInvoice.name,
    address: corrections.address?.corrected || null,
    email: corrections.email?.corrected || null,
    phone: corrections.phone?.corrected || null,
    _aiExtracted: { name: !!extractedData?.vendor, address: false, email: false, phone: false },
    _validationEnriched: {
      phone: !!corrections.phone?.corrected,
      email: !!corrections.email?.corrected,
      address: !!corrections.address?.corrected,
    }
  };

  // Build bill_to from ACTUAL AI extraction (or null if not extracted)
  const billTo = extractedData?.billTo ? {
    name: extractedData.billTo.name || null,
    address: extractedData.billTo.address || null,
    entity: extractedData.billTo.entity || null,
    _aiExtracted: {
      name: !!extractedData.billTo.name,
      address: !!extractedData.billTo.address,
      entity: !!extractedData.billTo.entity,
    }
  } : {
    name: null,
    address: null,
    entity: null,
    _aiExtracted: { name: false, address: false, entity: false }
  };

  // Build line items from ACTUAL AI extraction
  const lineItems = (extractedData?.items || []).map(item => ({
    item: item.sku || null,
    sku: item.sku || null,
    description: item.description || item.name,
    quantity: item.quantity || 1,
    rate: item.unit_price || 0,
    amount: item.amount || 0,
    _aiExtracted: {
      sku: !!item.sku,
      description: !!(item.description || item.name),
      quantity: !!item.quantity,
      rate: !!item.unit_price,
      amount: !!item.amount,
    }
  }));

  // Use AI-extracted flags if available
  const aiFlags = extractedData?.flags || [];
  const statusFlags = status === 'rejected' 
    ? ['fraud_detected', 'ai_rejected'] 
    : status === 'needs_review'
      ? ['requires_review']
      : [];
  const allFlags = [...new Set([...aiFlags, ...statusFlags])];

  return {
    id: invoiceId,
    vendor: extractedData?.vendor || testInvoice.name,
    vendorLogo: testInvoice.icon,
    
    // Header Details - from AI extraction
    invoiceNumber: aiInvoiceNumber || invoiceId,
    invoiceDate: extractedData?.invoiceDate || null,
    dueDate: extractedData?.dueDate || null,
    
    // Amounts - from AI extraction
    amount: extractedData?.amount || testInvoice.amount,
    subtotal: extractedData?.subtotal || extractedData?.amount || testInvoice.amount,
    tax: extractedData?.tax || 0,
    currency: extractedData?.currency || 'USD',
    
    // Payment Info - from AI extraction (with validation corrections applied)
    paymentTerms: correctedData?.paymentTerms || null,
    poMatch: correctedData?.poNumber || null,
    
    // Parties - from AI extraction
    billFrom: billFrom,
    billTo: billTo,
    
    // Line Items - from AI extraction
    lineItems: lineItems,
    
    // Status & metadata
    confidence: confidence,
    status: status,
    issueType: issueType,
    daysOverdue: 0,
    
    // AI Processing metadata
    aiProcessed: true,
    aiResult: result,
    aiValidation: validationResult,
    aiApproval: approvalResult,
    processingHistory: processingHistory || null,
    processedAt: now.toISOString(),
    backendInvoiceId: invoiceId,
    invoiceStatus: result.invoiceStatus || result.status,
    flags: allFlags,
    
    // Track what was AI-extracted at top level
    _aiExtracted: {
      invoiceNumber: !!aiInvoiceNumber,
      invoiceDate: !!extractedData?.invoiceDate,
      dueDate: !!extractedData?.dueDate,
      vendor: !!extractedData?.vendor,
      amount: !!extractedData?.amount,
      subtotal: !!extractedData?.subtotal,
      tax: extractedData?.tax > 0,
      currency: !!extractedData?.currency,
      paymentTerms: !!extractedData?.paymentTerms,
      poNumber: !!extractedData?.poNumber,
      billFrom: !!extractedData?.billFrom,
      billTo: !!extractedData?.billTo,
      items: (extractedData?.items?.length || 0) > 0,
      confidence: true, // Always from AI
      flags: aiFlags.length > 0,
    },
    
    // Source file info (for PDF display in DetailPage)
    sourceFile: result?.source_path || testInvoice?.filePath || null,
    source_path: result?.source_path || testInvoice?.filePath || null,
    originalFilename: result?.original_filename || testInvoice?.originalFilename || null,
    isPdf: result?.source_type === 'pdf' || testInvoice?.isPdf || false,
    
    // Validation corrections (fields changed by validation agent)
    // These will be highlighted in amber/orange in the UI
    _validationCorrected: result?.corrections || validationResult?.corrections || {},
  };
}
