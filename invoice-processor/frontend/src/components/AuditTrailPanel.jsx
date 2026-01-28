import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Cpu, 
  FileText, 
  DollarSign,
  Send,
  ShieldCheck,
  Ban,
  Sparkles,
  User,
  Bot
} from 'lucide-react';

/**
 * AuditTrailPanel - Displays chronological audit trail for an invoice
 * 
 * Similar to the screenshot reference showing:
 * - Invoice Received
 * - AI Processing
 * - Smart Coding Applied
 * etc.
 * 
 * Session: 2026-01-28_EXPLAIN (Galatiq Committee)
 */

// Map event types to icons and colors
const eventConfig = {
  invoice_received: {
    icon: FileText,
    color: 'text-blue-500',
    bgColor: 'bg-blue-100',
    borderColor: 'border-blue-200',
  },
  ai_processing: {
    icon: Cpu,
    color: 'text-purple-500',
    bgColor: 'bg-purple-100',
    borderColor: 'border-purple-200',
  },
  validation_complete: {
    icon: ShieldCheck,
    color: 'text-teal-500',
    bgColor: 'bg-teal-100',
    borderColor: 'border-teal-200',
  },
  approval_routed: {
    icon: Send,
    color: 'text-amber-500',
    bgColor: 'bg-amber-100',
    borderColor: 'border-amber-200',
  },
  approval_decision: {
    icon: CheckCircle,
    color: 'text-green-500',
    bgColor: 'bg-green-100',
    borderColor: 'border-green-200',
  },
  payment_initiated: {
    icon: DollarSign,
    color: 'text-blue-500',
    bgColor: 'bg-blue-100',
    borderColor: 'border-blue-200',
  },
  payment_complete: {
    icon: CheckCircle,
    color: 'text-green-500',
    bgColor: 'bg-green-100',
    borderColor: 'border-green-200',
  },
  payment_rejected: {
    icon: Ban,
    color: 'text-red-500',
    bgColor: 'bg-red-100',
    borderColor: 'border-red-200',
  },
  payment_failed: {
    icon: XCircle,
    color: 'text-red-500',
    bgColor: 'bg-red-100',
    borderColor: 'border-red-200',
  },
};

// Format relative time (e.g., "7 hours ago")
function formatRelativeTime(timestamp) {
  if (!timestamp) return '';
  
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

// Format absolute time (e.g., "Jan 27, 11:42 PM")
function formatAbsoluteTime(timestamp) {
  if (!timestamp) return '';
  
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
  }) + ', ' + date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
}

// Get actor display info
function getActorDisplay(actor) {
  if (!actor) return { name: 'System', icon: Bot };
  
  if (actor === 'system') {
    return { name: 'System', icon: Bot };
  }
  
  if (actor.startsWith('ai:')) {
    const agentName = actor.replace('ai:', '');
    const nameMap = {
      'ingestion': 'Ingestion Agent',
      'validation': 'Validation Agent',
      'approval': 'Approval Agent',
      'payment': 'Payment Agent',
    };
    return { 
      name: nameMap[agentName] || agentName, 
      icon: Sparkles,
      isAI: true 
    };
  }
  
  if (actor.startsWith('human:')) {
    return { 
      name: actor.replace('human:', ''), 
      icon: User,
      isHuman: true 
    };
  }
  
  return { name: actor, icon: Bot };
}

// Single audit event card
function AuditEventCard({ event, isLast }) {
  const config = eventConfig[event.event_type] || {
    icon: Clock,
    color: 'text-gray-500',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-200',
  };
  
  const Icon = config.icon;
  const actorInfo = getActorDisplay(event.actor);
  const ActorIcon = actorInfo.icon;
  
  return (
    <div className={`relative pl-8 pb-6 ${!isLast ? 'border-l-2 border-gray-200 ml-3' : 'ml-3'}`}>
      {/* Timeline dot */}
      <div className={`absolute -left-3 top-0 w-6 h-6 rounded-full ${config.bgColor} border-2 ${config.borderColor} flex items-center justify-center`}>
        <Icon size={12} className={config.color} />
      </div>
      
      {/* Event content */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors">
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-sm text-gray-900">{event.title}</h4>
            {actorInfo.isAI && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700">
                <Sparkles size={8} />
                AI
              </span>
            )}
          </div>
          <div className="text-right">
            <p className="text-[11px] text-gray-500">{formatRelativeTime(event.timestamp)}</p>
            <p className="text-[10px] text-gray-400">{formatAbsoluteTime(event.timestamp)}</p>
          </div>
        </div>
        
        {/* Actor */}
        <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
          <ActorIcon size={12} className={actorInfo.isAI ? 'text-purple-400' : 'text-gray-400'} />
          <span>{actorInfo.name}</span>
        </div>
        
        {/* Description */}
        <p className="text-sm text-gray-600">{event.description}</p>
        
        {/* Details (if present) */}
        {event.details && Object.keys(event.details).length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(event.details).slice(0, 6).map(([key, value]) => {
                // Skip internal keys or complex objects
                if (key.startsWith('_') || typeof value === 'object' && value !== null && !Array.isArray(value)) {
                  return null;
                }
                
                // Format the key
                const displayKey = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                
                // Format the value
                let displayValue = value;
                if (Array.isArray(value)) {
                  displayValue = value.length > 0 ? value.join(', ') : 'None';
                } else if (typeof value === 'number') {
                  displayValue = Number.isInteger(value) ? value : value.toFixed(2);
                } else if (typeof value === 'boolean') {
                  displayValue = value ? 'Yes' : 'No';
                }
                
                return (
                  <div key={key} className="text-[11px]">
                    <span className="text-gray-500">{displayKey}:</span>{' '}
                    <span className="text-gray-700 font-medium">{String(displayValue)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        {/* AI Summary (if present) */}
        {event.ai_summary && event.ai_summary !== event.description && (
          <div className="mt-3 p-2 bg-purple-50 rounded-lg border border-purple-100">
            <div className="flex items-center gap-1 text-[10px] font-medium text-purple-600 mb-1">
              <Sparkles size={10} />
              AI Analysis
            </div>
            <p className="text-xs text-purple-800">{event.ai_summary}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Empty state
function EmptyState() {
  return (
    <div className="text-center py-8">
      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
        <Clock size={20} className="text-gray-400" />
      </div>
      <h3 className="font-semibold text-sm text-gray-900 mb-1">No Audit Events</h3>
      <p className="text-xs text-gray-500">Audit trail will appear as the invoice is processed.</p>
    </div>
  );
}

export default function AuditTrailPanel({ auditTrail = [], className = '' }) {
  // Sort by timestamp descending (most recent first)
  const sortedEvents = [...(auditTrail || [])].sort((a, b) => {
    return new Date(b.timestamp) - new Date(a.timestamp);
  });
  
  if (!sortedEvents.length) {
    return (
      <div className={className}>
        <EmptyState />
      </div>
    );
  }
  
  return (
    <div className={`space-y-0 ${className}`}>
      {sortedEvents.map((event, idx) => (
        <AuditEventCard 
          key={`${event.event_type}-${event.timestamp}-${idx}`} 
          event={event} 
          isLast={idx === sortedEvents.length - 1}
        />
      ))}
    </div>
  );
}

