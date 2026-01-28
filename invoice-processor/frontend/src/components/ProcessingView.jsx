import { useState, useEffect, useRef } from 'react';
import { 
  CheckCircle, 
  Loader2, 
  XCircle, 
  Clock,
  ArrowRight,
  AlertTriangle,
  Sparkles,
  RefreshCw,
  Code,
  GitBranch,
  Cpu,
  Braces,
  Wifi,
  WifiOff,
  Coins,
  Inbox,
  FileText
} from 'lucide-react';

const stages = [
  { id: 'ingestion', label: 'Ingestion', icon: '📥', description: 'Extract structured data' },
  { id: 'validation', label: 'Validation', icon: '✅', description: 'Check inventory & rules' },
  { id: 'approval', label: 'Approval', icon: '🤔', description: 'AI decision reasoning' },
  { id: 'payment', label: 'Payment', icon: '💰', description: 'Execute transaction' },
];

const WEBSOCKET_URL = 'ws://localhost:8000/ws/process';
const APPROVAL_WEBSOCKET_URL = 'ws://localhost:8000/ws/approval';
const PAYMENT_WEBSOCKET_URL = 'ws://localhost:8000/ws/payment';

/**
 * ProcessingView handles Stage 1, Stage 2, and Stage 3 workflows:
 * - Stage 1 (default): Ingestion + Validation
 * - Stage 2 (approvalMode): Approval Agent triage
 * - Stage 3 (paymentMode): Payment Agent execution
 * 
 * @param {Object} invoice - The invoice being processed
 * @param {Function} onComplete - Callback when processing completes
 * @param {boolean} approvalMode - If true, runs Stage 2 (Approval) workflow only
 * @param {boolean} paymentMode - If true, runs Stage 3 (Payment) workflow only
 * @param {Object} existingData - Pre-populated data from previous stages
 */
export default function ProcessingView({ invoice, onComplete, approvalMode = false, paymentMode = false, existingData = null }) {
  // Determine starting stage based on mode
  const getInitialStage = () => {
    if (paymentMode) return 3;
    if (approvalMode) return 2;
    return 0;
  };
  
  const getInitialStageStatus = () => {
    if (paymentMode) return ['complete', 'complete', 'complete', 'pending'];  // Payment mode: first three stages done
    if (approvalMode) return ['complete', 'complete', 'pending', 'pending'];  // Approval mode: first two stages done
    return ['pending', 'pending', 'pending', 'pending'];
  };
  
  const [currentStage, setCurrentStage] = useState(getInitialStage());
  const [stageStatus, setStageStatus] = useState(getInitialStageStatus());
  const [logs, setLogs] = useState([]);
  // Pre-populate data in approval mode from existingData
  const [extractedData, setExtractedData] = useState(approvalMode && existingData?.extractedData ? {
    invoiceNumber: existingData.extractedData.invoiceNumber || invoice.invoiceNumber,
    invoiceDate: existingData.extractedData.invoiceDate || invoice.invoiceDate,
    dueDate: existingData.extractedData.dueDate || invoice.dueDate,
    vendor: existingData.extractedData.vendor || invoice.vendor,
    amount: existingData.extractedData.amount || invoice.amount,
    subtotal: existingData.extractedData.subtotal || invoice.subtotal,
    tax: existingData.extractedData.tax || invoice.tax,
    currency: existingData.extractedData.currency || invoice.currency || 'USD',
    paymentTerms: existingData.extractedData.paymentTerms || invoice.paymentTerms,
    poNumber: existingData.extractedData.poNumber || invoice.poMatch,
    billFrom: existingData.extractedData.billFrom || invoice.billFrom,
    billTo: existingData.extractedData.billTo || invoice.billTo,
    items: existingData.extractedData.items || invoice.lineItems || [],
    confidence: existingData.extractedData.confidence || invoice.confidence || 50,
    flags: existingData.extractedData.flags || invoice.flags || [],
  } : null);
  const [validationResult, setValidationResult] = useState(approvalMode && existingData?.validationResult ? existingData.validationResult : null);
  const [approvalResult, setApprovalResult] = useState(null);
  const [result, setResult] = useState(null);
  const [startTime] = useState(Date.now());
  const [activePanel, setActivePanel] = useState('log'); // 'log' | 'json' | 'state'
  const [currentJsonOutput, setCurrentJsonOutput] = useState(null);
  const [workflowState, setWorkflowState] = useState({
    raw_invoice: invoice.rawText || invoice.sourceFile || 'N/A',
    invoice_data: (approvalMode || paymentMode) ? {
      vendor: invoice.vendor,
      amount: invoice.amount,
      invoice_number: invoice.invoiceNumber,
    } : null,
    validation_result: (approvalMode || paymentMode) ? { is_valid: true } : null,
    approval_decision: paymentMode ? { approved: true } : null,
    payment_result: null,
    current_agent: paymentMode ? 'payment' : approvalMode ? 'approval' : 'ingestion',
    status: 'processing',
  });
  const [wsStatus, setWsStatus] = useState('connecting'); // 'connecting' | 'connected' | 'error' | 'closed'
  const [auditTrail, setAuditTrail] = useState([]);  // Session 2026-01-28_EXPLAIN: Audit trail events
  const [tokenUsage, setTokenUsage] = useState({
    total: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    byStage: {}
  });
  const logsEndRef = useRef(null);
  const wsRef = useRef(null);

  // Auto-scroll logs
  useEffect(() => {
    if (activePanel === 'log') {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, activePanel]);

  // WebSocket connection and event handling
  useEffect(() => {
    // Track if this effect instance is still active (for cleanup)
    let isActive = true;
    
    // Create WebSocket connection - different endpoint based on mode
    let wsUrl;
    const backendId = invoice.backendInvoiceId || invoice.id;
    
    if (paymentMode) {
      // For payment mode, connect to the payment WebSocket endpoint
      // Include approval info so backend knows if human approved
      const params = new URLSearchParams();
      
      // Check for human approval indicators
      const approvalChain = invoice.approvalChain || [];
      const humanApproved = approvalChain.some(a => a.status === 'approved');
      const fullyApproved = invoice.fullyApprovedAt || invoice.status === 'ready_to_pay';
      
      if (fullyApproved || humanApproved) {
        // Find who approved (last approver in chain or fallback)
        const lastApprover = approvalChain.filter(a => a.status === 'approved').pop();
        const approvedBy = lastApprover?.name || invoice.approvedBy || 'User';
        params.append('approved_by', `human:${approvedBy}`);
      }
      
      if (invoice.status) {
        params.append('invoice_status', invoice.status);
      }
      
      const queryString = params.toString();
      wsUrl = `${PAYMENT_WEBSOCKET_URL}/${backendId}${queryString ? '?' + queryString : ''}`;
    } else if (approvalMode) {
      // For approval mode, connect to the approval WebSocket endpoint
      wsUrl = `${APPROVAL_WEBSOCKET_URL}/${backendId}`;
    } else {
      wsUrl = WEBSOCKET_URL;
    }
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    
    ws.onopen = () => {
      if (!isActive) return; // Ignore if unmounted
      console.log('WebSocket connected to:', wsUrl);
      setWsStatus('connected');
      
      // In approval/payment mode, the connection itself triggers the workflow
      // In normal mode, send invoice data to process
      if (!approvalMode && !paymentMode) {
        ws.send(JSON.stringify({
          raw_invoice: invoice.rawText,
          invoice_id: invoice.id,
        }));
      }
    };
    
    ws.onmessage = (event) => {
      if (!isActive) return; // Ignore if unmounted
      try {
        const data = JSON.parse(event.data);
        handleEvent(data);
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
      }
    };
    
    ws.onerror = (error) => {
      if (!isActive) return; // Ignore if unmounted
      console.error('WebSocket error:', error);
      setWsStatus('error');
      addLog('error', '❌ WebSocket connection error');
      // Fall back to mock processing
      fallbackToMockProcessing();
    };
    
    ws.onclose = () => {
      if (!isActive) return; // Ignore if unmounted
      console.log('WebSocket closed');
      setWsStatus('closed');
    };
    
    return () => {
      isActive = false; // Mark as inactive before closing
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }, [invoice, approvalMode, paymentMode]);

  // Handle incoming WebSocket events
  const handleEvent = (event) => {
    const eventType = event.event;
    
    switch (eventType) {
      case 'connected':
        if (paymentMode) {
          addLog('system', '🔗 Connected to Payment Agent', 'payment');
          addLog('system', `💰 Executing payment for ${invoice.backendInvoiceId || invoice.id}`, 'payment');
          // Mark payment stage as running
          setCurrentStageWithRef(3);
          updateStageStatus(3, 'running');
        } else if (approvalMode) {
          addLog('system', '🔗 Connected to Approval Agent', 'approval');
          addLog('system', `🤔 Running approval analysis for ${invoice.backendInvoiceId || invoice.id}`, 'approval');
          // Mark approval stage as running
          setCurrentStageWithRef(2);
          updateStageStatus(2, 'running');
        } else {
          addLog('system', '🔌 Connected to processing server', 'ingestion');
        }
        break;
        
      case 'stage_start':
        handleStageStart(event);
        break;
        
      case 'stage_complete':
        handleStageComplete(event);
        break;
        
      case 'grok_call':
        addLog('grok', `🤖 Grok API Call:`, event.stage);
        addLog('grok', `   Model: ${event.model}`, event.stage);
        addLog('grok', `   Mode: ${event.mode} (structured output)`, event.stage);
        addLog('grok', `   Temperature: ${event.temperature}`, event.stage);
        break;
        
      case 'grok_response':
        setCurrentJsonOutput({ stage: event.stage, data: event.data });
        
        // Update extracted data for display (ALL fields from expanded schema)
        if (event.stage === 'ingestion' && event.data) {
          setExtractedData({
            // Header Details
            invoiceNumber: event.data.invoice_number,
            invoiceDate: event.data.invoice_date,
            dueDate: event.data.due_date,
            
            // Amounts
            vendor: event.data.vendor,
            amount: event.data.amount,
            subtotal: event.data.subtotal,
            tax: event.data.tax,
            currency: event.data.currency || 'USD',
            
            // Payment Info
            paymentTerms: event.data.payment_terms,
            poNumber: event.data.po_number,
            
            // Parties
            billFrom: event.data.bill_from,
            billTo: event.data.bill_to,
            
            // Line Items
            items: event.data.items || [],
            
            // Metadata
            confidence: event.data.confidence || 50,
            flags: event.data.flags || [],
          });
        }
        
        if (event.stage === 'validation' && event.data) {
          setValidationResult({
            passed: event.data.is_valid,
            errors: event.data.errors || [],
            warnings: event.data.warnings || [],
            inventoryCheck: Object.entries(event.data.inventory_check || {}).map(([item, check]) => ({
              item,
              requested: check.requested,
              inStock: check.in_stock,
              available: check.available,
            })),
            corrections: event.data.corrections || {},  // Capture validation corrections
          });
        }
        
        if (event.stage === 'approval' && event.data) {
          setApprovalResult({
            approved: event.data.approved,
            riskScore: event.data.risk_score,
            reason: event.data.reason,
            requiresReview: event.data.requires_review,
            reasoningChain: event.data.reasoning_chain || [],
          });
        }
        break;
        
      case 'self_correction':
        addLog('warning', `⚠️  ${event.reason}`, event.stage);
        addLog('warning', `🔄 SELF-CORRECTION: Retry attempt ${event.attempt}`, event.stage);
        break;
        
      case 'token_usage':
        setTokenUsage(prev => ({
          total: event.total || prev.total,
          byStage: {
            ...prev.byStage,
            [event.stage]: event.usage
          }
        }));
        if (event.usage) {
          addLog('info', `   📊 Tokens: ${event.usage.prompt_tokens} in / ${event.usage.completion_tokens} out (${event.usage.total_tokens} total)`, event.stage);
        }
        break;
        
      case 'state_update':
        setWorkflowState(event.state);
        // Capture audit trail from state if present
        if (event.state?.audit_trail) {
          setAuditTrail(event.state.audit_trail);
        }
        break;
        
      case 'log':
        addLog(event.level, event.message, event.stage);
        break;
        
      // STAGED WORKFLOW: Stage 1 complete (Ingestion + Validation)
      case 'stage1_complete':
        handleStage1Complete(event);
        break;
        
      // STAGED WORKFLOW: Stage 2 complete (Approval)
      case 'stage2_complete':
        handleStage2Complete(event);
        break;
        
      case 'complete':
        handleComplete(event);
        break;
        
      case 'rejected':
        handleRejected(event);
        break;
        
      case 'error':
        addLog('error', `❌ ${event.message}`);
        if (!result) {
          setResult({
            status: 'error',
            reason: event.message,
          });
        }
        break;
        
      default:
        console.log('Unknown event:', event);
    }
  };

  const handleStageStart = (event) => {
    const stageIndex = stages.findIndex(s => s.id === event.stage);
    if (stageIndex !== -1) {
      setCurrentStageWithRef(stageIndex);
      updateStageStatus(stageIndex, 'running');
    }
  };

  const handleStageComplete = (event) => {
    const stageIndex = stages.findIndex(s => s.id === event.stage);
    if (stageIndex !== -1) {
      updateStageStatus(stageIndex, event.status);
    }
  };

  // STAGED WORKFLOW: Handle Stage 1 complete (invoice now in INBOX)
  const handleStage1Complete = (event) => {
    const resultData = event.result || {};
    
    // Update token usage
    if (event.token_usage) {
      setTokenUsage(prev => ({
        ...prev,
        total: event.token_usage
      }));
    }
    
    // Capture audit trail from result
    if (resultData.audit_trail) {
      setAuditTrail(resultData.audit_trail);
    }
    
    // Set result to trigger the footer - status is "inbox" for staged workflow
    setResult({
      status: 'inbox',
      invoiceId: event.invoice_id || resultData.invoice_id,
      invoiceStatus: resultData.invoice_status,
      invoiceData: resultData.invoice_data,
      validationResult: resultData.validation_result,
      corrections: resultData.corrections || {},  // Include validation corrections
      processingTime: event.processing_time,
      tokenUsage: event.token_usage,
      nextAction: resultData.next_action || 'route_to_approval',
      message: resultData.message || 'Invoice processed. Route to approval to continue.',
      // Source file info
      source_type: resultData.source_type,
      source_path: resultData.source_path,
      original_filename: resultData.original_filename,
      // Audit trail (Session 2026-01-28_EXPLAIN)
      auditTrail: resultData.audit_trail || [],
    });
  };

  // STAGED WORKFLOW: Handle Stage 2 complete (approval analysis done)
  const handleStage2Complete = (event) => {
    const resultData = event.result || {};
    
    if (event.token_usage) {
      setTokenUsage(prev => ({
        ...prev,
        total: event.token_usage
      }));
    }
    
    // Capture audit trail from result (includes Payment Agent rejection logging)
    if (resultData.audit_trail) {
      setAuditTrail(resultData.audit_trail);
    }
    
    // Mark approval stage as complete
    updateStageStatus(2, 'complete');
    
    // For auto_reject, the Payment Agent also ran to log the rejection
    // Mark payment stage as "failed" (rejection logged)
    if (resultData.route === 'auto_reject') {
      updateStageStatus(3, 'failed');  // Payment logged rejection
    }
    
    // Update approval result with route info
    const newApprovalResult = {
      route: resultData.route,
      invoiceStatus: resultData.invoice_status,
      processingTime: event.processing_time,
      tokenUsage: event.token_usage,
    };
    setApprovalResult(prev => ({
      ...prev,
      ...newApprovalResult,
    }));
    
    const newResult = {
      status: resultData.route === 'auto_approve' ? 'auto_approved' :
              resultData.route === 'auto_reject' ? 'rejected' : 'pending_approval',
      invoiceId: event.invoice_id,
      invoiceStatus: resultData.invoice_status,
      route: resultData.route,
      processingTime: event.processing_time,
      tokenUsage: event.token_usage,
      auditTrail: resultData.audit_trail || [],  // Include audit trail with rejection
    };
    setResult(newResult);
    
    // Update workflow state
    setWorkflowState(prev => ({
      ...prev,
      approval_decision: {
        route: resultData.route,
        invoice_status: resultData.invoice_status,
      },
      current_agent: 'complete',
      status: 'complete',
    }));
  };

  const handleComplete = (event) => {
    const resultData = event.result || {};
    const approval = resultData.approval_decision || {};
    const payment = resultData.payment_result || {};
    
    // Update final token usage
    if (event.token_usage) {
      setTokenUsage(prev => ({
        ...prev,
        total: event.token_usage
      }));
    }
    
    // Capture audit trail from result (Session 2026-01-28_EXPLAIN)
    if (resultData.audit_trail) {
      setAuditTrail(resultData.audit_trail);
    }
    
    // In payment mode, handle payment-specific result
    if (paymentMode) {
      // Mark payment stage complete
      updateStageStatus(3, payment.success ? 'complete' : 'failed');
      
      setResult({
        status: payment.success ? 'paid' : 'payment_failed',
        transactionId: payment.transaction_id,
        paymentError: payment.error,
        processingTime: event.processing_time,
        tokenUsage: event.token_usage,
        invoiceData: resultData.invoice_data,
        auditTrail: resultData.audit_trail || [],  // Include audit trail
      });
      
      // Update workflow state
      setWorkflowState(prev => ({
        ...prev,
        payment_result: payment,
        current_agent: 'complete',
        status: payment.success ? 'completed' : 'failed',
      }));
    } else {
      setResult({
        status: 'approved',
        riskScore: approval.risk_score || 0,
        reason: approval.reason || 'Invoice processed successfully',
        requiresReview: approval.requires_review || false,
        transactionId: payment.transaction_id,
        processingTime: event.processing_time,
        tokenUsage: event.token_usage,
        auditTrail: resultData.audit_trail || [],  // Include audit trail
      });
    }
  };

  const handleRejected = (event) => {
    setResult({
      status: 'rejected',
      reason: event.reason,
      stage: event.stage,
    });
  };

  // Fallback mock processing if WebSocket fails
  const fallbackToMockProcessing = () => {
    addLog('warning', '⚠️  Falling back to simulated processing');
    // You could implement mock processing here as a fallback
    // For now, just show an error
    setResult({
      status: 'error',
      reason: 'Could not connect to processing server. Please ensure the API is running on localhost:8000',
    });
  };

  // Track current stage for log tagging
  const currentStageRef = useRef(paymentMode ? 'payment' : approvalMode ? 'approval' : 'ingestion');

  const addLog = (type, message, stage = null) => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    // Use provided stage, or fall back to current stage
    const logStage = stage || currentStageRef.current;
    setLogs(prev => [...prev, { time: elapsed, type, message, stage: logStage }]);
  };

  // Update current stage ref when stage changes
  const setCurrentStageWithRef = (stageIndex) => {
    setCurrentStage(stageIndex);
    const stageIds = ['ingestion', 'validation', 'approval', 'payment'];
    currentStageRef.current = stageIds[stageIndex] || 'ingestion';
  };

  const updateStageStatus = (index, status) => {
    setStageStatus(prev => {
      const next = [...prev];
      next[index] = status;
      return next;
    });
  };

  const getElapsedTime = () => {
    return ((Date.now() - startTime) / 1000).toFixed(1);
  };

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
      case 'running':
        return <Loader2 size={16} className="animate-spin" />;
      case 'skipped':
        return <XCircle size={16} />;
      default:
        return <Clock size={16} />;
    }
  };

  const getWsStatusBadge = () => {
    switch (wsStatus) {
      case 'connecting':
        return (
          <div className="flex items-center gap-2 text-xs bg-yellow-500/10 text-yellow-400 px-3 py-1.5 rounded-full border border-yellow-500/20">
            <Loader2 size={12} className="animate-spin" />
            <span>Connecting...</span>
          </div>
        );
      case 'connected':
        return (
          <div className="flex items-center gap-2 text-xs bg-green-500/10 text-green-400 px-3 py-1.5 rounded-full border border-green-500/20">
            <Wifi size={12} />
            <span>Live</span>
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center gap-2 text-xs bg-red-500/10 text-red-400 px-3 py-1.5 rounded-full border border-red-500/20">
            <WifiOff size={12} />
            <span>Disconnected</span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-950 z-50 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 px-6 py-4 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <span className="text-3xl">{paymentMode ? '💰' : approvalMode ? '🤔' : (invoice.icon || '📄')}</span>
              {!result && (
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
              )}
            </div>
            <div>
              <h1 className="text-white font-semibold text-lg">
                {result 
                  ? (paymentMode ? 'Payment Complete' : approvalMode ? 'Approval Analysis Complete' : 'Processing Complete')
                  : (paymentMode ? 'Payment Agent Processing' : approvalMode ? 'Approval Agent Analysis' : 'Processing Invoice')
                }
              </h1>
              <p className="text-gray-400 text-sm">
                {invoice.name || invoice.vendor} • ${(invoice.amount || 0).toLocaleString()}
              </p>
            </div>
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
            {getWsStatusBadge()}
            {tokenUsage.total.total_tokens > 0 && (
              <div className="flex items-center gap-2 text-xs bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-full border border-emerald-500/20">
                <Coins size={12} />
                <span>{tokenUsage.total.total_tokens.toLocaleString()} tokens</span>
              </div>
            )}
            {!result ? (
              <div className="flex items-center gap-2 text-blue-400 text-sm bg-blue-500/10 px-3 py-1.5 rounded-full">
                <Loader2 className="animate-spin" size={14} />
                <span>Running...</span>
              </div>
            ) : (
              <div className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-full ${
                result.status === 'approved' 
                  ? 'text-green-400 bg-green-500/10' 
                  : result.status === 'error'
                  ? 'text-orange-400 bg-orange-500/10'
                  : 'text-red-400 bg-red-500/10'
              }`}>
                {result.status === 'approved' ? <CheckCircle size={14} /> : <XCircle size={14} />}
                <span>{result.status === 'approved' ? 'Complete' : result.status === 'error' ? 'Error' : 'Rejected'}</span>
              </div>
            )}
            <div className="text-gray-500 text-sm font-mono">
              {getElapsedTime()}s
            </div>
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
              <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border transition-all ${getStageStyles(stageStatus[idx])}`}>
                {getStageIcon(stageStatus[idx])}
                <div>
                  <div className="text-sm font-medium">{stage.label}</div>
                  <div className="text-xs opacity-70">{stage.description}</div>
                </div>
              </div>
              {idx < stages.length - 1 && (
                <div className="flex items-center mx-2">
                  <ArrowRight size={18} className={`${
                    stageStatus[idx] === 'complete' || stageStatus[idx] === 'warning'
                      ? 'text-gray-500'
                      : 'text-gray-700'
                  }`} />
                  {idx === 0 && <span className="text-[10px] text-gray-600 ml-1">edge</span>}
                </div>
              )}
            </div>
          ))}
          <div className="flex items-center ml-2">
            <ArrowRight size={18} className="text-gray-700" />
            <div className="ml-2 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 text-sm">
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
            <span className="text-lg">{invoice.isPdf ? '📄' : '📝'}</span>
            <h3 className="text-white font-medium text-sm">
              {invoice.isPdf ? 'PDF Input' : 'Raw Input'}
            </h3>
            {invoice.isPdf && (
              <span className="ml-auto text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                <FileText size={10} />
                PDF
              </span>
            )}
            {invoice.id === 'test-2' && (
              <span className="ml-auto text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                <RefreshCw size={10} />
                Messy
              </span>
            )}
          </div>
          <div className="flex-1 p-4 overflow-auto">
            {invoice.isPdf ? (
              <div className="space-y-4">
                <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                  <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                    <FileText size={28} className="text-blue-400" />
                  </div>
                  <p className="text-white font-medium">{invoice.originalFilename || invoice.name}</p>
                  <p className="text-gray-500 text-sm mt-1">PDF file uploaded</p>
                </div>
                <div className="bg-gray-800/30 rounded-lg px-3 py-2">
                  <p className="text-xs text-gray-500 mb-1">File path:</p>
                  <p className="text-xs text-gray-400 font-mono break-all">{invoice.filePath || invoice.rawText}</p>
                </div>
                <div className="text-xs text-gray-500 flex items-center gap-2">
                  <Sparkles size={12} className="text-purple-400" />
                  <span>Text will be extracted by pdfplumber and sent to Grok</span>
                </div>
              </div>
            ) : (
              <pre className="text-gray-300 font-mono text-sm whitespace-pre-wrap leading-relaxed">
                {invoice.rawText}
              </pre>
            )}
          </div>
        </div>

        {/* Center: Extracted Data + JSON */}
        <div className="w-2/5 border-r border-gray-800 flex flex-col bg-gray-900/20">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
            <span className="text-lg">📊</span>
            <h3 className="text-white font-medium text-sm">Extracted Data</h3>
            {extractedData && (
              <span className="ml-auto text-xs text-green-400">
                <Sparkles size={12} className="inline mr-1" />
                Grok JSON Mode
              </span>
            )}
          </div>
          <div className="flex-1 overflow-auto">
            {extractedData ? (
              <div className="p-4">
                {/* Confidence Badge */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-gray-500 uppercase tracking-wide">AI Confidence</span>
                  <div className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${
                    extractedData.confidence >= 90 ? 'bg-green-500/20 text-green-400' :
                    extractedData.confidence >= 70 ? 'bg-amber-500/20 text-amber-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    <Sparkles size={10} />
                    {extractedData.confidence}%
                  </div>
                </div>
                
                {/* Flags */}
                {extractedData.flags?.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-1">
                    {extractedData.flags.map((flag, idx) => (
                      <span key={idx} className="text-[10px] px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded-full">
                        {flag}
                      </span>
                    ))}
                  </div>
                )}
                
                {/* Extracted Fields */}
                <div className="space-y-3 mb-4">
                  <DataField label="Invoice #" value={extractedData.invoiceNumber} />
                  <DataField label="Vendor" value={extractedData.vendor} />
                  <DataField 
                    label="Amount" 
                    value={`$${(extractedData.amount || 0).toLocaleString()} ${extractedData.currency}`}
                    highlight={extractedData.amount > 10000}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <DataField label="Invoice Date" value={extractedData.invoiceDate || '—'} small />
                    <DataField 
                      label="Due Date" 
                      value={extractedData.dueDate || '—'} 
                      error={!extractedData.dueDate}
                      small
                    />
                  </div>
                  {extractedData.paymentTerms && (
                    <DataField label="Payment Terms" value={extractedData.paymentTerms} />
                  )}
                  {extractedData.poNumber && (
                    <DataField label="PO Number" value={extractedData.poNumber} />
                  )}
                  
                  {/* Bill From */}
                  {extractedData.billFrom?.name && (
                    <div className="pt-2 border-t border-gray-800">
                      <span className="text-gray-500 text-xs uppercase tracking-wide">Bill From (Vendor)</span>
                      <div className="mt-2 bg-gray-800/50 rounded-lg px-3 py-2 space-y-1">
                        <div className="text-white text-sm font-medium">{extractedData.billFrom.name}</div>
                        {extractedData.billFrom.address && (
                          <div className="text-gray-400 text-xs">{extractedData.billFrom.address}</div>
                        )}
                        {extractedData.billFrom.email && (
                          <div className="text-gray-400 text-xs">{extractedData.billFrom.email}</div>
                        )}
                        {extractedData.billFrom.phone && (
                          <div className="text-gray-400 text-xs">{extractedData.billFrom.phone}</div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Bill To */}
                  {extractedData.billTo?.name && (
                    <div className="pt-2 border-t border-gray-800">
                      <span className="text-gray-500 text-xs uppercase tracking-wide">Bill To (Customer)</span>
                      <div className="mt-2 bg-gray-800/50 rounded-lg px-3 py-2 space-y-1">
                        <div className="text-white text-sm font-medium">{extractedData.billTo.name}</div>
                        {extractedData.billTo.address && (
                          <div className="text-gray-400 text-xs">{extractedData.billTo.address}</div>
                        )}
                        {extractedData.billTo.entity && (
                          <div className="text-gray-400 text-xs">{extractedData.billTo.entity}</div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Line Items */}
                  <div className="pt-2 border-t border-gray-800">
                    <span className="text-gray-500 text-xs uppercase tracking-wide">Line Items</span>
                    <div className="mt-2 space-y-2">
                      {(extractedData.items || []).map((item, idx) => (
                        <div key={idx} className="bg-gray-800/50 rounded-lg px-3 py-2">
                          <div className="flex items-center justify-between">
                            <div className="text-white text-sm font-medium">
                              {item.description || item.name}
                            </div>
                            {item.amount > 0 && (
                              <div className="text-green-400 text-sm font-medium">
                                ${item.amount.toLocaleString()}
                              </div>
                            )}
                          </div>
                          <div className="text-gray-400 text-xs flex items-center gap-2 mt-1">
                            <span>Qty: {item.quantity}</span>
                            {item.unit_price > 0 && (
                              <span>@ ${item.unit_price.toLocaleString()}/ea</span>
                            )}
                            {item.sku && (
                              <span className="text-gray-500">SKU: {item.sku}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* JSON Output Preview */}
                {currentJsonOutput && (
                  <div className="mt-4 border-t border-gray-800 pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Braces size={14} className="text-cyan-400" />
                      <span className="text-xs text-cyan-400 uppercase tracking-wide">
                        {currentJsonOutput.stage} Agent Output
                      </span>
                    </div>
                    <pre className="bg-gray-950 rounded-lg p-3 text-xs font-mono text-cyan-300 overflow-auto max-h-48">
                      {JSON.stringify(currentJsonOutput.data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <Loader2 className="animate-spin mb-2" size={24} />
                <span className="text-sm">Waiting for Grok extraction...</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Agent Log / State */}
        <div className="flex-1 flex flex-col bg-gray-950">
          {/* Tab Switcher */}
          <div className="px-4 py-2 border-b border-gray-800 flex items-center gap-1">
            <button
              onClick={() => setActivePanel('log')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activePanel === 'log' 
                  ? 'bg-blue-500/20 text-blue-400' 
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <Code size={12} />
              Agent Log
            </button>
            <button
              onClick={() => setActivePanel('state')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activePanel === 'state' 
                  ? 'bg-pink-500/20 text-pink-400' 
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <GitBranch size={12} />
              LangGraph State
            </button>
          </div>

          {/* Log Panel */}
          {activePanel === 'log' && (
            <div className="flex-1 p-4 overflow-auto font-mono text-sm">
              {logs.map((log, idx) => (
                <div key={idx} className="flex gap-3 mb-0.5 hover:bg-gray-900/50 px-2 py-0.5 rounded">
                  <span className="text-gray-600 w-12 text-right shrink-0">[{log.time}s]</span>
                  <span className={getLogColor(log.type)}>
                    {log.type === 'json' ? (
                      <pre className="whitespace-pre-wrap">{log.message}</pre>
                    ) : (
                      log.message
                    )}
                  </span>
                </div>
              ))}
              {!result && (
                <div className="flex items-center gap-2 text-blue-400 mt-3 px-2">
                  <Loader2 size={12} className="animate-spin" />
                  <span className="text-xs">Processing...</span>
                </div>
              )}
              <div ref={logsEndRef} />
            </div>
          )}

          {/* State Panel */}
          {activePanel === 'state' && (
            <div className="flex-1 p-4 overflow-auto">
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <GitBranch size={14} className="text-pink-400" />
                  <span className="text-xs text-pink-400 uppercase tracking-wide">
                    WorkflowState (TypedDict)
                  </span>
                </div>
                <pre className="bg-gray-900 rounded-lg p-4 text-xs font-mono text-gray-300 overflow-auto">
                  {JSON.stringify(workflowState, null, 2)}
                </pre>
              </div>
              
              <div className="text-xs text-gray-500 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-pink-400"></div>
                  <span>State is passed between agents via LangGraph edges</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                  <span>Each agent receives full state, returns partial update</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-400"></div>
                  <span>Conditional edges route based on validation/approval</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Result Footer - Compact */}
      {result && (
        <div className={`px-4 py-2.5 border-t ${
          result.status === 'approved' || result.status === 'auto_approved' || result.status === 'paid'
            ? 'bg-gradient-to-r from-green-900/30 to-green-800/20 border-green-800/30' 
            : result.status === 'inbox'
            ? 'bg-gradient-to-r from-blue-900/30 to-blue-800/20 border-blue-800/30'
            : result.status === 'pending_approval'
            ? 'bg-gradient-to-r from-amber-900/30 to-amber-800/20 border-amber-800/30'
            : result.status === 'error' || result.status === 'payment_failed'
            ? 'bg-gradient-to-r from-orange-900/30 to-orange-800/20 border-orange-800/30'
            : 'bg-gradient-to-r from-red-900/30 to-red-800/20 border-red-800/30'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                result.status === 'approved' || result.status === 'auto_approved' || result.status === 'paid' ? 'bg-green-500/20' :
                result.status === 'inbox' ? 'bg-blue-500/20' :
                result.status === 'pending_approval' ? 'bg-amber-500/20' :
                result.status === 'error' || result.status === 'payment_failed' ? 'bg-orange-500/20' : 'bg-red-500/20'
              }`}>
                {result.status === 'approved' || result.status === 'auto_approved' || result.status === 'paid'
                  ? <CheckCircle className="text-green-400" size={16} />
                  : result.status === 'inbox'
                  ? <CheckCircle className="text-blue-400" size={16} />
                  : result.status === 'pending_approval'
                  ? <Clock className="text-amber-400" size={16} />
                  : result.status === 'error' || result.status === 'payment_failed'
                  ? <AlertTriangle className="text-orange-400" size={16} />
                  : <XCircle className="text-red-400" size={16} />
                }
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h3 className={`font-semibold text-sm ${
                    result.status === 'approved' || result.status === 'auto_approved' || result.status === 'paid' ? 'text-green-400' :
                    result.status === 'inbox' ? 'text-blue-400' :
                    result.status === 'pending_approval' ? 'text-amber-400' :
                    result.status === 'error' || result.status === 'payment_failed' ? 'text-orange-400' : 'text-red-400'
                  }`}>
                    {result.status === 'paid'
                      ? 'Payment Successful — Invoice Paid'
                      : result.status === 'payment_failed'
                      ? 'Payment Failed'
                      : result.status === 'approved' 
                      ? (result.requiresReview ? 'Approved — Flagged for Review' : 'Invoice Approved & Paid')
                      : result.status === 'auto_approved'
                      ? (approvalMode ? 'Auto-Approved — Ready for Payment' : 'Auto-Approved — Ready for Payment')
                      : result.status === 'inbox'
                      ? 'Stage 1 Complete — Invoice in Inbox'
                      : result.status === 'pending_approval'
                      ? (approvalMode ? 'Needs Human Review — Routed to Approval Chain' : 'Routed to Approval Queue')
                      : result.status === 'error'
                      ? 'Processing Error'
                      : (approvalMode ? 'Auto-Rejected — Major Red Flags Detected' : 'Invoice Rejected')
                    }
                  </h3>
                  <span className="text-gray-500 text-xs">
                    {getElapsedTime()}s
                    {result.tokenUsage && <> • {result.tokenUsage.total_tokens?.toLocaleString() || 0} tokens</>}
                    {result.invoiceId && <> • {result.invoiceId}</>}
                  </span>
                </div>
                <p className="text-gray-400 text-xs">
                  {result.status === 'paid'
                    ? `Transaction ID: ${result.transactionId}`
                    : result.status === 'payment_failed'
                    ? result.paymentError || 'Payment could not be processed'
                    : result.status === 'approved' 
                    ? `Transaction ID: ${result.transactionId}`
                    : result.status === 'inbox'
                    ? result.message || 'Ready for routing to approval'
                    : result.status === 'pending_approval'
                    ? (approvalMode ? 'Routed to VP/Manager approval chain' : 'Waiting for VP/Manager approval')
                    : result.status === 'auto_approved'
                    ? (approvalMode ? 'Under $10K with no flags — auto-approved by AI' : 'Under $10K with no flags — auto-approved')
                    : result.status === 'rejected'
                    ? (approvalMode ? 'Major red flags detected — auto-rejected by AI' : result.reason)
                    : result.reason
                  }
                </p>
              </div>
            </div>
            <button
              onClick={() => onComplete(result, extractedData, validationResult, approvalResult, {
                logs,
                rawText: invoice.rawText,
                stageStatus,
                tokenUsage,
                workflowState,
                processingTime: getElapsedTime(),
                invoiceId: result.invoiceId,
                approvalMode,
                paymentMode,
                auditTrail: auditTrail.length > 0 ? auditTrail : (result.auditTrail || []),  // Session 2026-01-28_EXPLAIN
              })}
              className={`font-medium px-4 py-1.5 text-sm rounded-lg transition-all ${
                result.status === 'approved' || result.status === 'auto_approved' || result.status === 'paid'
                  ? 'bg-green-500 hover:bg-green-400 text-white'
                  : result.status === 'inbox'
                  ? 'bg-blue-500 hover:bg-blue-400 text-white'
                  : 'bg-white hover:bg-gray-100 text-gray-900'
              }`}
            >
              {result.status === 'paid'
                ? 'View Paid Invoices'
                : result.status === 'payment_failed'
                ? 'Close'
                : result.status === 'inbox' 
                ? 'View in Inbox' 
                : result.status === 'auto_approved'
                ? 'Go to Payments'
                : result.status === 'pending_approval'
                ? 'Go to Approvals'
                : 'Continue'
              }
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DataField({ label, value, highlight, error, small }) {
  return (
    <div>
      <span className={`text-gray-500 uppercase tracking-wide ${small ? 'text-[10px]' : 'text-xs'}`}>{label}</span>
      <div className={`mt-0.5 font-medium ${
        error ? 'text-red-400' :
        highlight ? 'text-amber-400' :
        'text-white'
      } ${small ? 'text-xs' : 'text-sm'}`}>
        {value}
      </div>
    </div>
  );
}
