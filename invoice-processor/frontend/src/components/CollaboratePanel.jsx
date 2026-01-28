import { useState } from 'react';
import { 
  X,
  MessageSquare,
  CheckCircle,
  Clock,
  ChevronRight
} from 'lucide-react';
import AuditTrailPanel from './AuditTrailPanel';

/**
 * CollaboratePanel - Slide-out panel with Comments, Approvals, and Audit tabs
 * 
 * Matches the UI from the screenshot showing:
 * - Comments tab (placeholder)
 * - Approvals tab (placeholder)  
 * - Audit tab (shows audit trail)
 * 
 * Session: 2026-01-28_EXPLAIN (Galatiq Committee)
 */

const tabs = [
  { id: 'comments', label: 'Comments' },
  { id: 'approvals', label: 'Approvals' },
  { id: 'audit', label: 'Audit' },
];

export default function CollaboratePanel({ invoice, onClose }) {
  const [activeTab, setActiveTab] = useState('audit'); // Default to audit tab
  
  const auditTrail = invoice?.auditTrail || invoice?.processingHistory?.auditTrail || [];
  
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className="relative w-[400px] max-w-full bg-white shadow-2xl flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <MessageSquare size={18} className="text-gray-500" />
            <h2 className="font-semibold text-gray-900">Collaborate</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight size={18} className="text-gray-400" />
          </button>
        </div>
        
        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors relative ${
                activeTab === tab.id
                  ? 'text-teal-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-500" />
              )}
            </button>
          ))}
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'comments' && (
            <CommentsTab />
          )}
          
          {activeTab === 'approvals' && (
            <ApprovalsTab invoice={invoice} />
          )}
          
          {activeTab === 'audit' && (
            <AuditTrailPanel auditTrail={auditTrail} />
          )}
        </div>
      </div>
      
      {/* Slide-in animation */}
      <style>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}

// Placeholder Comments tab
function CommentsTab() {
  return (
    <div className="text-center py-8">
      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
        <MessageSquare size={20} className="text-gray-400" />
      </div>
      <h3 className="font-semibold text-sm text-gray-900 mb-1">No Comments Yet</h3>
      <p className="text-xs text-gray-500">Comments and notes will appear here.</p>
    </div>
  );
}

// Placeholder Approvals tab showing approval chain
function ApprovalsTab({ invoice }) {
  const approvalChain = invoice?.approvalChain || [];
  const aiTriageResult = invoice?.aiTriageResult;
  
  if (!approvalChain.length && !aiTriageResult) {
    return (
      <div className="text-center py-8">
        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <CheckCircle size={20} className="text-gray-400" />
        </div>
        <h3 className="font-semibold text-sm text-gray-900 mb-1">No Approvals Yet</h3>
        <p className="text-xs text-gray-500">Route this invoice to begin approval process.</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* AI Triage Result */}
      {aiTriageResult && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center">
              <Clock size={12} className="text-purple-500" />
            </div>
            <h4 className="font-semibold text-sm text-purple-800">AI Triage</h4>
          </div>
          <p className="text-xs text-purple-700">
            Route: <span className="font-medium">{aiTriageResult.route?.replace(/_/g, ' ')}</span>
          </p>
          {aiTriageResult.risk_score !== undefined && (
            <p className="text-xs text-purple-700">
              Risk Score: <span className="font-medium">{(aiTriageResult.risk_score * 100).toFixed(0)}%</span>
            </p>
          )}
        </div>
      )}
      
      {/* Approval Chain */}
      {approvalChain.map((approver, idx) => (
        <div 
          key={approver.id || idx}
          className={`border rounded-xl p-4 ${
            approver.status === 'approved' 
              ? 'border-green-200 bg-green-50' 
              : approver.status === 'rejected'
                ? 'border-red-200 bg-red-50'
                : 'border-gray-200 bg-white'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
              approver.status === 'approved'
                ? 'bg-green-100 text-green-600'
                : approver.status === 'rejected'
                  ? 'bg-red-100 text-red-600'
                  : 'bg-gray-100 text-gray-500'
            }`}>
              {approver.avatar || approver.name?.charAt(0) || idx + 1}
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-sm text-gray-900">{approver.name}</h4>
              <p className="text-xs text-gray-500">{approver.role}</p>
            </div>
            <div className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              approver.status === 'approved'
                ? 'bg-green-100 text-green-700'
                : approver.status === 'rejected'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-gray-100 text-gray-500'
            }`}>
              {approver.status === 'approved' ? 'Approved' : 
               approver.status === 'rejected' ? 'Rejected' : 'Pending'}
            </div>
          </div>
          {approver.approvedAt && (
            <p className="text-[10px] text-gray-400 mt-2">
              Approved: {new Date(approver.approvedAt).toLocaleString()}
            </p>
          )}
          {approver.rejectionReason && (
            <p className="text-xs text-red-600 mt-2">
              Reason: {approver.rejectionReason}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

