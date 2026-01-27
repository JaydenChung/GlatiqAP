import { useEffect, useRef } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  ArrowRight,
  AlertTriangle,
  Sparkles,
  Code,
  GitBranch,
  Cpu,
  Braces,
  Coins,
  X,
  Target
} from 'lucide-react';

const stages = [
  { id: 'ingestion', label: 'Ingestion', icon: '📥', description: 'Extract structured data' },
  { id: 'validation', label: 'Validation', icon: '✅', description: 'Check inventory & rules' },
  { id: 'approval', label: 'Approval', icon: '🤔', description: 'AI decision reasoning' },
  { id: 'payment', label: 'Payment', icon: '💰', description: 'Execute transaction' },
];

// Map field names to what we look for in logs
const fieldToLogPatterns = {
  'Invoice Number': ['Invoice #', 'invoice_number'],
  'Invoice Date': ['Invoice Date', 'invoice_date'],
  'Due Date': ['Due Date', 'due_date'],
  'Vendor Name': ['Vendor:', 'vendor'],
  'Currency': ['Currency', 'currency', 'USD'],
  'Payment Terms': ['Payment Terms', 'payment_terms', 'Net'],
  'Address': ['Address', 'address', 'bill_from'],
  'Email': ['Email', 'email', '@'],
  'Phone': ['Phone', 'phone', '555'],
  'Company Name': ['bill_to', 'Company', 'TechCorp'],
  'Billing Address': ['bill_to', 'address'],
  'Business Entity': ['entity', 'bill_to'],
  'Amount': ['Amount:', 'amount', '$'],
};

export default function ProcessingHistoryView({ invoice, onClose, highlightField }) {
  const history = invoice.processingHistory;
  const logRefs = useRef([]);
  const logContainerRef = useRef(null);
  
  const extractedData = {
    vendor: invoice.vendor,
    amount: invoice.amount,
    dueDate: invoice.dueDate,
    items: invoice.lineItems?.map(item => ({
      name: item.description,
      quantity: item.quantity,
    })) || [],
  };

  // Find log entries that match the highlighted field
  const findMatchingLogIndices = (logs, fieldName) => {
    if (!fieldName || !logs) return [];
    
    const patterns = fieldToLogPatterns[fieldName] || [fieldName.toLowerCase()];
    const matches = [];
    
    logs.forEach((log, idx) => {
      const message = log.message?.toLowerCase() || '';
      const matchesPattern = patterns.some(pattern => 
        message.includes(pattern.toLowerCase())
      );
      // Prioritize success logs that show the extracted value
      if (matchesPattern && (log.type === 'success' || log.type === 'json')) {
        matches.push(idx);
      }
    });
    
    return matches;
  };

  const matchingLogIndices = highlightField 
    ? findMatchingLogIndices(history?.logs, highlightField.name)
    : [];

  // Scroll to the first matching log when highlightField changes
  useEffect(() => {
    if (matchingLogIndices.length > 0 && logRefs.current[matchingLogIndices[0]]) {
      setTimeout(() => {
        logRefs.current[matchingLogIndices[0]]?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }, 300);
    }
  }, [highlightField, matchingLogIndices]);

  const getLogColor = (type) => {
    switch (type) {
      case 'success': return 'text-green-400';
      case 'error': return 'text-red-400';
      case 'warning': return 'text-amber-400';
      case 'system': return 'text-blue-400 font-semibold';
      case 'grok': return 'text-purple-400';
      case 'json': return 'text-cyan-400 font-mono text-xs';
      case 'state': return 'text-pink-400';
      default: return 'text-gray-300';
    }
  };

  const getStageStyles = (status) => {
    switch (status) {
      case 'complete':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'warning':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'failed':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'running':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'skipped':
        return 'bg-gray-700/50 text-gray-500 border-gray-600/30';
      default:
        return 'bg-gray-800/50 text-gray-500 border-gray-700/30';
    }
  };

  const getStageIcon = (status) => {
    switch (status) {
      case 'complete':
        return <CheckCircle size={16} />;
      case 'warning':
        return <AlertTriangle size={16} />;
      case 'failed':
        return <XCircle size={16} />;
      default:
        return <Clock size={16} />;
    }
  };

  // If no processing history, show a placeholder
  if (!history) {
    return (
      <div className="fixed inset-0 bg-gray-950 z-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <Code size={32} className="text-gray-500" />
          </div>
          <h2 className="text-white text-xl font-semibold mb-2">Processing History Unavailable</h2>
          <p className="text-gray-400 mb-6">No processing logs were saved for this invoice.</p>
          <button
            onClick={onClose}
            className="bg-white text-gray-900 px-6 py-2 rounded-lg font-medium hover:bg-gray-100"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const { logs, rawText, stageStatus, tokenUsage, workflowState, processingTime } = history;
  const result = invoice.aiResult;

  return (
    <div className="fixed inset-0 bg-gray-950 z-50 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 px-6 py-4 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <span className="text-3xl">{invoice.vendorLogo || '📄'}</span>
            </div>
            <div>
              <h1 className="text-white font-semibold text-lg">
                {highlightField ? 'Extraction Source' : 'Processing History'}
              </h1>
              <p className="text-gray-400 text-sm">
                {invoice.vendor} • ${(invoice.amount || 0).toLocaleString()}
              </p>
            </div>
            {/* Field being traced indicator */}
            {highlightField && (
              <div className="ml-4 flex items-center gap-2 bg-purple-500/20 border border-purple-500/30 px-4 py-2 rounded-lg">
                <Target size={16} className="text-purple-400" />
                <div>
                  <div className="text-purple-300 text-xs uppercase tracking-wide">Tracing Field</div>
                  <div className="text-white font-medium text-sm">
                    {highlightField.name}: <span className="text-purple-300">{highlightField.value}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Tech Stack Badges */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs bg-purple-500/10 text-purple-400 px-3 py-1.5 rounded-full border border-purple-500/20">
              <Cpu size={12} />
              <span>xAI Grok</span>
            </div>
            <div className="flex items-center gap-2 text-xs bg-pink-500/10 text-pink-400 px-3 py-1.5 rounded-full border border-pink-500/20">
              <GitBranch size={12} />
              <span>LangGraph StateGraph</span>
            </div>
            {tokenUsage?.total?.total_tokens > 0 && (
              <div className="flex items-center gap-2 text-xs bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-full border border-emerald-500/20">
                <Coins size={12} />
                <span>{tokenUsage.total.total_tokens.toLocaleString()} tokens</span>
              </div>
            )}
            <div className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-full ${
              result?.status === 'approved' || result?.status === 'auto_approved'
                ? 'text-green-400 bg-green-500/10' 
                : result?.status === 'inbox'
                ? 'text-blue-400 bg-blue-500/10'
                : result?.status === 'pending_approval'
                ? 'text-amber-400 bg-amber-500/10'
                : result?.status === 'error'
                ? 'text-orange-400 bg-orange-500/10'
                : 'text-red-400 bg-red-500/10'
            }`}>
              {result?.status === 'approved' || result?.status === 'auto_approved' || result?.status === 'inbox' 
                ? <CheckCircle size={14} /> 
                : result?.status === 'pending_approval'
                ? <Clock size={14} />
                : <XCircle size={14} />}
              <span>
                {result?.status === 'approved' ? 'Complete' : 
                 result?.status === 'auto_approved' ? 'Auto-Approved' :
                 result?.status === 'inbox' ? 'In Inbox' :
                 result?.status === 'pending_approval' ? 'Pending' :
                 result?.status === 'error' ? 'Error' : 'Rejected'}
              </span>
            </div>
            <div className="text-gray-500 text-sm font-mono">
              {processingTime}s
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X size={20} className="text-gray-400" />
            </button>
          </div>
        </div>
      </div>

      {/* LangGraph Pipeline Visualization */}
      <div className="bg-gray-900/50 px-6 py-4 border-b border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <GitBranch size={14} />
            <span>LangGraph StateGraph Flow</span>
          </div>
          <div className="text-xs text-gray-500 font-mono">
            workflow.compile() → app.invoke(state)
          </div>
        </div>
        <div className="flex items-center justify-center gap-3">
          {stages.map((stage, idx) => (
            <div key={stage.id} className="flex items-center">
              <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border transition-all ${getStageStyles(stageStatus?.[idx] || 'complete')}`}>
                {getStageIcon(stageStatus?.[idx] || 'complete')}
                <div>
                  <div className="text-sm font-medium">{stage.label}</div>
                  <div className="text-xs opacity-70">{stage.description}</div>
                </div>
              </div>
              {idx < stages.length - 1 && (
                <div className="flex items-center mx-2">
                  <ArrowRight size={18} className="text-gray-500" />
                  {idx === 0 && <span className="text-[10px] text-gray-600 ml-1">edge</span>}
                </div>
              )}
            </div>
          ))}
          <div className="flex items-center ml-2">
            <ArrowRight size={18} className="text-gray-500" />
            <div className="ml-2 px-3 py-2 rounded-lg bg-green-500/20 border border-green-500/30 text-green-400 text-sm">
              END
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Raw Input */}
        <div className="w-1/5 border-r border-gray-800 flex flex-col bg-gray-900/30">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
            <span className="text-lg">📄</span>
            <h3 className="text-white font-medium text-sm">Raw Input</h3>
          </div>
          <div className="flex-1 p-4 overflow-auto">
            <pre className="text-gray-300 font-mono text-sm whitespace-pre-wrap leading-relaxed">
              {rawText || 'Raw text not available'}
            </pre>
          </div>
        </div>

        {/* Center: Extracted Data + JSON */}
        <div className="w-2/5 border-r border-gray-800 flex flex-col bg-gray-900/20">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
            <span className="text-lg">📊</span>
            <h3 className="text-white font-medium text-sm">Extracted Data</h3>
            <span className="ml-auto text-xs text-green-400">
              <Sparkles size={12} className="inline mr-1" />
              Grok JSON Mode
            </span>
          </div>
          <div className="flex-1 overflow-auto">
            <div className="p-4">
              {/* Extracted Fields */}
              <div className="space-y-3 mb-4">
                <DataField label="Vendor" value={extractedData.vendor} />
                <DataField 
                  label="Amount" 
                  value={`$${(extractedData.amount || 0).toLocaleString()}`}
                  highlight={extractedData.amount > 10000}
                />
                <DataField 
                  label="Due Date" 
                  value={extractedData.dueDate || 'Not specified'} 
                />
                <div className="pt-2 border-t border-gray-800">
                  <span className="text-gray-500 text-xs uppercase tracking-wide">Line Items</span>
                  <div className="mt-2 space-y-2">
                    {extractedData.items.map((item, idx) => (
                      <div key={idx} className="bg-gray-800/50 rounded-lg px-3 py-2">
                        <div className="text-white text-sm font-medium">{item.name}</div>
                        <div className="text-gray-400 text-xs">Qty: {item.quantity}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Validation Result */}
              {invoice.aiValidation && (
                <div className="mt-4 border-t border-gray-800 pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Braces size={14} className="text-cyan-400" />
                    <span className="text-xs text-cyan-400 uppercase tracking-wide">
                      Validation Result
                    </span>
                  </div>
                  <pre className="bg-gray-950 rounded-lg p-3 text-xs font-mono text-cyan-300 overflow-auto max-h-48">
                    {JSON.stringify(invoice.aiValidation, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Agent Log */}
        <div className="flex-1 flex flex-col bg-gray-950">
          <div className="px-4 py-2 border-b border-gray-800 flex items-center gap-1">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500/20 text-blue-400">
              <Code size={12} />
              Agent Log
            </div>
          </div>

          <div ref={logContainerRef} className="flex-1 p-4 overflow-auto font-mono text-sm">
            {/* Highlight indicator */}
            {highlightField && matchingLogIndices.length > 0 && (
              <div className="mb-4 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                <div className="flex items-center gap-2 text-purple-300 text-xs">
                  <Target size={14} />
                  <span>
                    Found {matchingLogIndices.length} log {matchingLogIndices.length === 1 ? 'entry' : 'entries'} showing where <strong>{highlightField.name}</strong> was extracted
                  </span>
                </div>
              </div>
            )}
            
            {logs?.length > 0 ? (
              logs.map((log, idx) => {
                const isHighlighted = matchingLogIndices.includes(idx);
                return (
                  <div 
                    key={idx} 
                    ref={el => logRefs.current[idx] = el}
                    className={`flex gap-3 mb-0.5 px-2 py-1 rounded transition-all ${
                      isHighlighted 
                        ? 'bg-purple-500/30 ring-2 ring-purple-500/50 animate-pulse' 
                        : 'hover:bg-gray-900/50'
                    }`}
                  >
                    <span className="text-gray-600 w-12 text-right shrink-0">[{log.time}s]</span>
                    <span className={`${getLogColor(log.type)} ${isHighlighted ? 'font-semibold' : ''}`}>
                      {isHighlighted && (
                        <Target size={12} className="inline mr-1 text-purple-400" />
                      )}
                      {log.type === 'json' ? (
                        <pre className="whitespace-pre-wrap">{log.message}</pre>
                      ) : (
                        log.message
                      )}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="text-gray-500 text-center py-8">
                No logs available
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Result Footer - Compact */}
      <div className={`px-4 py-2.5 border-t ${
        result?.status === 'approved' || result?.status === 'auto_approved'
          ? 'bg-gradient-to-r from-green-900/30 to-green-800/20 border-green-800/30' 
          : result?.status === 'inbox'
          ? 'bg-gradient-to-r from-blue-900/30 to-blue-800/20 border-blue-800/30'
          : result?.status === 'pending_approval'
          ? 'bg-gradient-to-r from-amber-900/30 to-amber-800/20 border-amber-800/30'
          : result?.status === 'error'
          ? 'bg-gradient-to-r from-orange-900/30 to-orange-800/20 border-orange-800/30'
          : 'bg-gradient-to-r from-red-900/30 to-red-800/20 border-red-800/30'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              result?.status === 'approved' || result?.status === 'auto_approved' ? 'bg-green-500/20' :
              result?.status === 'inbox' ? 'bg-blue-500/20' :
              result?.status === 'pending_approval' ? 'bg-amber-500/20' :
              result?.status === 'error' ? 'bg-orange-500/20' : 'bg-red-500/20'
            }`}>
              {result?.status === 'approved' || result?.status === 'auto_approved'
                ? <CheckCircle className="text-green-400" size={16} />
                : result?.status === 'inbox'
                ? <CheckCircle className="text-blue-400" size={16} />
                : result?.status === 'pending_approval'
                ? <Clock className="text-amber-400" size={16} />
                : result?.status === 'error'
                ? <AlertTriangle className="text-orange-400" size={16} />
                : <XCircle className="text-red-400" size={16} />
              }
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h3 className={`font-semibold text-sm ${
                  result?.status === 'approved' || result?.status === 'auto_approved' ? 'text-green-400' :
                  result?.status === 'inbox' ? 'text-blue-400' :
                  result?.status === 'pending_approval' ? 'text-amber-400' :
                  result?.status === 'error' ? 'text-orange-400' : 'text-red-400'
                }`}>
                  {result?.status === 'approved' 
                    ? (result?.requiresReview ? 'Approved — Flagged for Review' : 'Invoice Approved & Paid')
                    : result?.status === 'auto_approved'
                    ? 'Auto-Approved — Ready for Payment'
                    : result?.status === 'inbox'
                    ? 'Stage 1 Complete — Invoice in Inbox'
                    : result?.status === 'pending_approval'
                    ? 'Routed to Approval Queue'
                    : result?.status === 'error'
                    ? 'Processing Error'
                    : 'Invoice Rejected'
                  }
                </h3>
                <span className="text-gray-500 text-xs">
                  {new Date(invoice.processedAt).toLocaleString()}
                  {processingTime && <> • {processingTime}s</>}
                  {tokenUsage?.total?.total_tokens > 0 && (
                    <> • {tokenUsage.total.total_tokens.toLocaleString()} tokens</>
                  )}
                </span>
              </div>
              <p className="text-gray-400 text-xs">
                {result?.status === 'approved' 
                  ? `Transaction ID: ${result?.transactionId || 'N/A'}`
                  : result?.status === 'inbox'
                  ? 'Ingestion and validation completed successfully'
                  : result?.status === 'auto_approved'
                  ? 'Under $10K with no flags — auto-approved by agent'
                  : result?.status === 'pending_approval'
                  ? 'Waiting for VP/Manager approval'
                  : result?.reason || 'Processing completed'
                }
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="bg-white text-gray-900 px-4 py-1.5 text-sm rounded-lg font-medium hover:bg-gray-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function DataField({ label, value, highlight, error }) {
  return (
    <div>
      <span className="text-gray-500 text-xs uppercase tracking-wide">{label}</span>
      <div className={`mt-1 text-sm font-medium ${
        error ? 'text-red-400' :
        highlight ? 'text-amber-400' :
        'text-white'
      }`}>
        {value}
      </div>
    </div>
  );
}

