import { useState } from 'react';
import { 
  Settings, 
  RotateCcw, 
  AlertTriangle, 
  Check,
  Database,
  Trash2,
  Info
} from 'lucide-react';
import { useInvoices } from '../context/InvoiceContext';

export default function SettingsPage() {
  const { processedInvoices, routedInvoices, processedCount, resetAllData } = useInvoices();
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);

  const totalInvoices = processedInvoices.length + routedInvoices.length;
  const pendingApprovals = routedInvoices.filter(inv => inv.status === 'pending_approval').length;
  const fullyApproved = routedInvoices.filter(inv => inv.status === 'fully_approved').length;

  const handleReset = () => {
    resetAllData();
    setShowResetConfirm(false);
    setResetComplete(true);
    setTimeout(() => setResetComplete(false), 3000);
  };

  return (
    <div className="min-h-screen max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
          <Settings size={20} className="text-gray-600" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500">Manage your demo environment</p>
        </div>
      </div>

      {/* Demo Data Section */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Database size={18} className="text-gray-500" />
            <h2 className="font-semibold text-gray-900">Demo Data</h2>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Manage invoice data created during this demo session
          </p>
        </div>

        {/* Current Stats */}
        <div className="px-6 py-4 bg-gray-50/50">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Current Session Data
          </h3>
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-2xl font-bold text-gray-900">{processedCount}</div>
              <div className="text-xs text-gray-500">Invoices Processed</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-2xl font-bold text-gray-900">{processedInvoices.length}</div>
              <div className="text-xs text-gray-500">In Inbox</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-2xl font-bold text-amber-600">{pendingApprovals}</div>
              <div className="text-xs text-gray-500">Pending Approval</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-2xl font-bold text-green-600">{fullyApproved}</div>
              <div className="text-xs text-gray-500">Fully Approved</div>
            </div>
          </div>
        </div>

        {/* Reset Action */}
        <div className="px-6 py-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-medium text-gray-900">Reset Demo Data</h3>
              <p className="text-sm text-gray-500 mt-1">
                Clear all processed invoices, approvals, and reset the demo to its initial state. 
                This action cannot be undone.
              </p>
            </div>
            <button
              onClick={() => setShowResetConfirm(true)}
              disabled={totalInvoices === 0}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                totalInvoices === 0
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-red-50 text-red-600 hover:bg-red-100'
              }`}
            >
              <RotateCcw size={16} />
              Reset Demo
            </button>
          </div>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex gap-3">
          <Info size={20} className="text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-900">About Demo Mode</h3>
            <p className="text-sm text-blue-700 mt-1">
              This is a demonstration environment for the GALATIQ AI-powered invoice processing system. 
              All data is stored locally in your browser session and will be cleared when you refresh 
              the page or use the reset button above.
            </p>
          </div>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowResetConfirm(false)}
        >
          <div 
            className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle size={20} className="text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Reset Demo Data?</h3>
            </div>
            
            <p className="text-gray-600 mb-4">
              This will permanently delete all demo data including:
            </p>
            
            <ul className="text-sm text-gray-600 mb-6 space-y-2">
              <li className="flex items-center gap-2">
                <Trash2 size={14} className="text-gray-400" />
                <span>{processedInvoices.length} invoice(s) in inbox</span>
              </li>
              <li className="flex items-center gap-2">
                <Trash2 size={14} className="text-gray-400" />
                <span>{routedInvoices.length} invoice(s) in approvals</span>
              </li>
              <li className="flex items-center gap-2">
                <Trash2 size={14} className="text-gray-400" />
                <span>All approval chain history</span>
              </li>
            </ul>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
              >
                <RotateCcw size={16} />
                Reset Everything
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Toast */}
      {resetComplete && (
        <div className="fixed bottom-6 right-6 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-in slide-in-from-bottom-4">
          <Check size={18} />
          <span className="font-medium">Demo data has been reset</span>
        </div>
      )}
    </div>
  );
}

