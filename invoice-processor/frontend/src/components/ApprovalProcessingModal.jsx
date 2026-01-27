import { useState, useEffect, useRef } from 'react';
import { X, Brain, CheckCircle, XCircle, AlertTriangle, Clock, Loader2, Sparkles } from 'lucide-react';

/**
 * Modal that shows the Approval Agent analyzing an invoice via WebSocket streaming.
 * This runs Stage 2 of the workflow: Smart Triage Analysis.
 */
export default function ApprovalProcessingModal({ 
  invoice, 
  onComplete, 
  onClose,
  wsUrl = 'ws://localhost:8000'
}) {
  const [logs, setLogs] = useState([]);
  const [status, setStatus] = useState('connecting'); // connecting, processing, complete, error
  const [result, setResult] = useState(null);
  const [processingTime, setProcessingTime] = useState(0);
  const logsEndRef = useRef(null);
  const wsRef = useRef(null);
  const startTimeRef = useRef(Date.now());

  // Auto-scroll to bottom of logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Timer for processing time
  useEffect(() => {
    if (status === 'processing') {
      const interval = setInterval(() => {
        setProcessingTime((Date.now() - startTimeRef.current) / 1000);
      }, 100);
      return () => clearInterval(interval);
    }
  }, [status]);

  // WebSocket connection
  useEffect(() => {
    const backendId = invoice.backendInvoiceId || invoice.id;
    const ws = new WebSocket(`${wsUrl}/ws/approval/${backendId}`);
    wsRef.current = ws;
    startTimeRef.current = Date.now();

    ws.onopen = () => {
      setStatus('processing');
      setLogs(prev => [...prev, {
        type: 'system',
        message: '🔗 Connected to Approval Agent',
        timestamp: Date.now()
      }]);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleEvent(data);
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setLogs(prev => [...prev, {
        type: 'error',
        message: '❌ Connection error',
        timestamp: Date.now()
      }]);
      setStatus('error');
    };

    ws.onclose = () => {
      if (status === 'processing') {
        setLogs(prev => [...prev, {
          type: 'system',
          message: '🔗 Connection closed',
          timestamp: Date.now()
        }]);
      }
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [invoice, wsUrl]);

  const handleEvent = (event) => {
    switch (event.event) {
      case 'connected':
        setLogs(prev => [...prev, {
          type: 'system',
          message: event.message || 'Connected to Approval Agent',
          timestamp: event.timestamp
        }]);
        break;

      case 'log':
        setLogs(prev => [...prev, {
          type: event.level || 'info',
          message: event.message,
          stage: event.stage,
          timestamp: event.timestamp
        }]);
        break;

      case 'stage_start':
        setLogs(prev => [...prev, {
          type: 'stage',
          message: `Starting: ${event.description}`,
          stage: event.stage,
          timestamp: event.timestamp
        }]);
        break;

      case 'grok_call':
        setLogs(prev => [...prev, {
          type: 'grok',
          message: `🤖 Calling ${event.model}...`,
          stage: event.stage,
          timestamp: event.timestamp
        }]);
        break;

      case 'grok_response':
        // Don't add raw JSON to logs, it's handled by other events
        break;

      case 'stage_complete':
        setLogs(prev => [...prev, {
          type: event.status === 'complete' ? 'success' : event.status === 'failed' ? 'error' : 'warning',
          message: `Stage complete: ${event.stage}`,
          stage: event.stage,
          data: event.data,
          timestamp: event.timestamp
        }]);
        break;

      case 'stage2_complete':
        setStatus('complete');
        setProcessingTime((Date.now() - startTimeRef.current) / 1000);
        setResult({
          route: event.result?.route,
          invoiceStatus: event.result?.invoice_status,
          processingTime: event.processing_time,
          tokenUsage: event.token_usage
        });
        break;

      case 'error':
        setLogs(prev => [...prev, {
          type: 'error',
          message: event.message,
          timestamp: event.timestamp
        }]);
        setStatus('error');
        break;

      default:
        console.log('Unknown event:', event);
    }
  };

  const handleComplete = () => {
    if (onComplete && result) {
      onComplete(result);
    }
  };

  const getLogStyles = (type) => {
    const styles = {
      system: 'text-gray-500 bg-gray-50',
      info: 'text-gray-700',
      success: 'text-green-600 bg-green-50',
      error: 'text-red-600 bg-red-50',
      warning: 'text-amber-600 bg-amber-50',
      grok: 'text-purple-600 bg-purple-50',
      json: 'text-blue-600 bg-blue-50 font-mono text-xs',
      stage: 'text-teal-600 bg-teal-50 font-medium',
    };
    return styles[type] || styles.info;
  };

  const getRouteDisplay = (route) => {
    switch (route) {
      case 'auto_approve':
        return {
          icon: CheckCircle,
          color: 'text-green-600',
          bg: 'bg-green-50 border-green-200',
          label: 'Auto-Approved',
          description: 'Invoice approved automatically — ready for payment'
        };
      case 'auto_reject':
        return {
          icon: XCircle,
          color: 'text-red-600',
          bg: 'bg-red-50 border-red-200',
          label: 'Auto-Rejected',
          description: 'Major red flags detected — invoice rejected'
        };
      case 'route_to_human':
      default:
        return {
          icon: AlertTriangle,
          color: 'text-amber-600',
          bg: 'bg-amber-50 border-amber-200',
          label: 'Needs Human Review',
          description: 'Routed to approval chain for VP review'
        };
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-purple-50 to-indigo-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Brain size={22} className="text-purple-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Approval Agent Analysis</h2>
              <p className="text-sm text-gray-600">
                Smart triage for {invoice.vendor} • ${invoice.amount?.toLocaleString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-500 font-mono">
              {processingTime.toFixed(1)}s
            </div>
            {status !== 'complete' && (
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white/50 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>

        {/* Logs */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-900 font-mono text-sm">
          {logs.map((log, index) => (
            <div
              key={index}
              className={`py-1 px-2 rounded mb-0.5 ${getLogStyles(log.type)}`}
            >
              {log.message}
            </div>
          ))}
          
          {status === 'processing' && (
            <div className="flex items-center gap-2 py-2 text-gray-400 animate-pulse">
              <Loader2 size={14} className="animate-spin" />
              <span>Processing...</span>
            </div>
          )}
          
          <div ref={logsEndRef} />
        </div>

        {/* Result Footer */}
        {status === 'complete' && result && (
          <div className={`px-6 py-5 border-t ${getRouteDisplay(result.route).bg}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {(() => {
                  const display = getRouteDisplay(result.route);
                  const Icon = display.icon;
                  return (
                    <>
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${display.bg} border`}>
                        <Icon size={26} className={display.color} />
                      </div>
                      <div>
                        <div className={`font-bold text-lg ${display.color}`}>
                          {display.label}
                        </div>
                        <div className="text-sm text-gray-600">
                          {display.description}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
              <button
                onClick={handleComplete}
                className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-lg transition-colors"
              >
                <Sparkles size={18} />
                Continue
              </button>
            </div>
            
            {/* Processing Stats */}
            <div className="mt-4 pt-4 border-t border-gray-200/50 flex items-center gap-6 text-xs text-gray-500">
              <div>
                <span className="font-medium">Processing Time:</span>{' '}
                {result.processingTime?.toFixed(2) || processingTime.toFixed(2)}s
              </div>
              {result.tokenUsage && (
                <>
                  <div>
                    <span className="font-medium">Tokens:</span>{' '}
                    {result.tokenUsage.total_tokens?.toLocaleString() || 'N/A'}
                  </div>
                  <div>
                    <span className="font-medium">Cost:</span>{' '}
                    ${result.tokenUsage.estimated_cost?.toFixed(4) || '0.00'}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Error Footer */}
        {status === 'error' && (
          <div className="px-6 py-4 border-t bg-red-50 border-red-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-red-600">
                <XCircle size={20} />
                <span className="font-medium">Analysis failed</span>
              </div>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

