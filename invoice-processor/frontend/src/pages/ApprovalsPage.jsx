import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  User, 
  ChevronRight,
  Sparkles,
  ArrowRight,
  Eye
} from 'lucide-react';
import { useInvoices } from '../context/InvoiceContext';

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

const formatDate = (dateString) => {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
};

function ApprovalChainStep({ approver, isActive, isLast }) {
  const getStatusIcon = () => {
    if (approver.status === 'approved') {
      return <CheckCircle size={16} className="text-green-500" />;
    }
    if (approver.status === 'rejected') {
      return <XCircle size={16} className="text-red-500" />;
    }
    if (isActive) {
      return <Clock size={16} className="text-amber-500 animate-pulse" />;
    }
    return <Clock size={16} className="text-gray-300" />;
  };

  const getStatusColor = () => {
    if (approver.status === 'approved') return 'bg-green-100 border-green-300';
    if (approver.status === 'rejected') return 'bg-red-100 border-red-300';
    if (isActive) return 'bg-amber-50 border-amber-300 ring-2 ring-amber-200';
    return 'bg-gray-50 border-gray-200';
  };

  return (
    <div className="flex items-center">
      <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${getStatusColor()} transition-all`}>
        <div className="text-2xl">{approver.avatar}</div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900">{approver.name}</span>
            {getStatusIcon()}
          </div>
          <span className="text-xs text-gray-500">{approver.role}</span>
          {approver.status === 'approved' && approver.approvedAt && (
            <div className="text-xs text-green-600 mt-0.5">
              Approved {formatDate(approver.approvedAt)}
            </div>
          )}
          {approver.status === 'rejected' && (
            <div className="text-xs text-red-600 mt-0.5">
              Rejected: {approver.rejectionReason || 'No reason provided'}
            </div>
          )}
        </div>
      </div>
      {!isLast && (
        <ChevronRight size={20} className="mx-2 text-gray-300" />
      )}
    </div>
  );
}

function ApprovalCard({ invoice, onApprove, onReject, onView }) {
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  
  const currentApprover = invoice.approvalChain[invoice.currentApproverIndex];
  const isFullyApproved = invoice.status === 'fully_approved';
  const isRejected = invoice.status === 'approval_rejected';
  const approvedCount = invoice.approvalChain.filter(a => a.status === 'approved').length;

  const handleReject = () => {
    onReject(invoice.id, rejectReason);
    setShowRejectModal(false);
    setRejectReason('');
  };

  return (
    <div className={`bg-white rounded-xl border ${
      isFullyApproved ? 'border-green-200 bg-green-50/30' : 
      isRejected ? 'border-red-200 bg-red-50/30' : 
      'border-gray-200'
    } overflow-hidden`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{invoice.vendorLogo}</span>
            <div>
              <h3 className="font-semibold text-gray-900">{invoice.vendor}</h3>
              <p className="text-sm text-gray-500">#{invoice.invoiceNumber}</p>
            </div>
          </div>
          {invoice.aiProcessed && (
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-[var(--primary)]/10 text-[var(--primary)]">
              <Sparkles size={12} />
              AI Processed
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-xl font-bold text-gray-900">{formatCurrency(invoice.amount)}</div>
            <div className="text-xs text-gray-500">Due {formatDate(invoice.dueDate)}</div>
          </div>
          <button
            onClick={() => onView(invoice)}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Eye size={18} />
          </button>
        </div>
      </div>

      {/* Approval Chain */}
      <div className="px-6 py-4 bg-gray-50/50">
        <div className="flex items-center gap-2 mb-3">
          <User size={14} className="text-gray-400" />
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Approval Chain ({approvedCount}/{invoice.approvalChain.length} complete)
          </span>
        </div>
        <div className="flex items-center flex-wrap gap-2">
          {invoice.approvalChain.map((approver, index) => (
            <ApprovalChainStep
              key={approver.id}
              approver={approver}
              isActive={index === invoice.currentApproverIndex && !isFullyApproved && !isRejected}
              isLast={index === invoice.approvalChain.length - 1}
            />
          ))}
        </div>
      </div>

      {/* Actions */}
      {!isFullyApproved && !isRejected && (
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-white">
          <div className="text-sm text-gray-600">
            <span className="font-medium text-amber-600">Waiting on:</span>{' '}
            {currentApprover?.name} ({currentApprover?.role})
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowRejectModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium"
            >
              <XCircle size={16} />
              Reject
            </button>
            <button
              onClick={() => onApprove(invoice.id)}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors text-sm font-medium"
            >
              <CheckCircle size={16} />
              Approve as {currentApprover?.name?.split(' ')[0]}
            </button>
          </div>
        </div>
      )}

      {/* Fully Approved State */}
      {isFullyApproved && (
        <div className="px-6 py-4 border-t border-green-200 bg-green-50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle size={18} />
            <span className="font-medium">Fully Approved</span>
            <span className="text-sm text-green-600">• Ready for payment</span>
          </div>
          <button className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium">
            <ArrowRight size={16} />
            Send to Pay
          </button>
        </div>
      )}

      {/* Rejected State */}
      {isRejected && (
        <div className="px-6 py-4 border-t border-red-200 bg-red-50">
          <div className="flex items-center gap-2 text-red-700">
            <XCircle size={18} />
            <span className="font-medium">Rejected</span>
            {invoice.rejectionReason && (
              <span className="text-sm text-red-600">• {invoice.rejectionReason}</span>
            )}
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowRejectModal(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Reject Invoice</h3>
            <p className="text-sm text-gray-600 mb-4">
              Rejecting invoice <span className="font-mono font-medium">{invoice.invoiceNumber}</span> from {invoice.vendor}
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter rejection reason..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-200 focus:border-red-400 resize-none"
              rows={3}
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
              >
                Reject Invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ApprovalsPage() {
  const navigate = useNavigate();
  const { routedInvoices, approveByCurrentApprover, rejectByCurrentApprover } = useInvoices();
  const [activeFilter, setActiveFilter] = useState('pending');

  const pendingInvoices = routedInvoices.filter(inv => inv.status === 'pending_approval');
  const approvedInvoices = routedInvoices.filter(inv => inv.status === 'fully_approved');
  const rejectedInvoices = routedInvoices.filter(inv => inv.status === 'approval_rejected');

  const filteredInvoices = activeFilter === 'pending' 
    ? pendingInvoices 
    : activeFilter === 'approved' 
      ? approvedInvoices 
      : rejectedInvoices;

  const totalPendingAmount = pendingInvoices.reduce((sum, inv) => sum + inv.amount, 0);

  const handleView = (invoice) => {
    navigate(`/invoice/${invoice.id}`);
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Approvals</h1>
      </div>

      {/* Stats Row */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <span className="font-medium text-gray-900">{pendingInvoices.length}</span>
        <span>pending</span>
        <span className="text-gray-300">|</span>
        <span className="font-medium text-gray-900">{formatCurrency(totalPendingAmount)}</span>
        <span>awaiting approval</span>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Clock size={20} className="text-amber-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{pendingInvoices.length}</div>
              <div className="text-sm text-gray-600">Pending Approval</div>
            </div>
          </div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle size={20} className="text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{approvedInvoices.length}</div>
              <div className="text-sm text-gray-600">Fully Approved</div>
            </div>
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <XCircle size={20} className="text-red-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{rejectedInvoices.length}</div>
              <div className="text-sm text-gray-600">Rejected</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => setActiveFilter('pending')}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            activeFilter === 'pending'
              ? 'bg-amber-100 text-amber-700'
              : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Clock size={16} />
          Pending
          <span className={`px-2 py-0.5 rounded-full text-xs ${
            activeFilter === 'pending' ? 'bg-amber-200' : 'bg-gray-100'
          }`}>
            {pendingInvoices.length}
          </span>
        </button>
        <button
          onClick={() => setActiveFilter('approved')}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            activeFilter === 'approved'
              ? 'bg-green-100 text-green-700'
              : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <CheckCircle size={16} />
          Approved
          <span className={`px-2 py-0.5 rounded-full text-xs ${
            activeFilter === 'approved' ? 'bg-green-200' : 'bg-gray-100'
          }`}>
            {approvedInvoices.length}
          </span>
        </button>
        <button
          onClick={() => setActiveFilter('rejected')}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            activeFilter === 'rejected'
              ? 'bg-red-100 text-red-700'
              : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <XCircle size={16} />
          Rejected
          <span className={`px-2 py-0.5 rounded-full text-xs ${
            activeFilter === 'rejected' ? 'bg-red-200' : 'bg-gray-100'
          }`}>
            {rejectedInvoices.length}
          </span>
        </button>
      </div>

      {/* Invoice Cards */}
      {filteredInvoices.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-gray-400 mb-2">
            {activeFilter === 'pending' ? (
              <Clock size={48} className="mx-auto" />
            ) : activeFilter === 'approved' ? (
              <CheckCircle size={48} className="mx-auto" />
            ) : (
              <XCircle size={48} className="mx-auto" />
            )}
          </div>
          <h3 className="text-gray-900 font-medium">
            No {activeFilter} invoices
          </h3>
          <p className="text-gray-500 text-sm mt-1">
            {activeFilter === 'pending' 
              ? 'Route invoices from the inbox to see them here'
              : activeFilter === 'approved'
                ? 'Approved invoices will appear here'
                : 'Rejected invoices will appear here'
            }
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredInvoices.map(invoice => (
            <ApprovalCard
              key={invoice.id}
              invoice={invoice}
              onApprove={approveByCurrentApprover}
              onReject={rejectByCurrentApprover}
              onView={handleView}
            />
          ))}
        </div>
      )}
    </div>
  );
}

