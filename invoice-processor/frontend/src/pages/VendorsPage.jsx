import { useState, useEffect } from 'react';
import { 
  Users, 
  AlertTriangle, 
  AlertCircle,
  Clock, 
  Search,
  Filter,
  Download,
  Plus,
  Eye,
  CheckCircle,
  XCircle,
  RefreshCw,
  ChevronDown
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function StatCard({ icon: Icon, value, label, iconBgColor, valueColor }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3">
      <div className="flex items-start justify-between">
        <div className={`w-7 h-7 rounded-md flex items-center justify-center ${iconBgColor}`}>
          <Icon size={14} className={valueColor} />
        </div>
      </div>
      <div className={`text-xl font-bold mt-2 ${valueColor}`}>{value}</div>
      <div className="text-[11px] text-gray-500">{label}</div>
    </div>
  );
}

function ComplianceBadge({ status }) {
  if (status === 'complete') {
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-50 text-green-700 border border-green-200">
        <CheckCircle size={9} />
        Complete
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
      <AlertTriangle size={9} />
      Incomplete
    </span>
  );
}

function ContractBadge({ status }) {
  if (status === 'active') {
    return <span className="text-green-600 text-[11px] font-medium">Active</span>;
  }
  if (status === 'suspended') {
    return <span className="text-red-600 text-[11px] font-medium">Suspended</span>;
  }
  if (status === 'renewing_soon') {
    return <span className="text-amber-600 text-[10px] font-medium bg-amber-50 px-1 py-0.5 rounded">Renewing Soon</span>;
  }
  return <span className="text-gray-500 text-[11px]">{status || '—'}</span>;
}

function SyncBadge({ status }) {
  if (status === 'synced') {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-green-600">
        <CheckCircle size={9} />
        Synced
      </span>
    );
  }
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-600">
        <Clock size={9} />
        Pending
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-red-600">
      <XCircle size={9} />
      Failed
    </span>
  );
}

function VendorDetailModal({ vendor, onClose }) {
  if (!vendor) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg flex items-center justify-center text-white font-semibold">
              {vendor.name.charAt(0)}
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">{vendor.name}</h2>
              <p className="text-xs text-gray-500">{vendor.vendor_id}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 hover:bg-gray-100 rounded"
          >
            <XCircle size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Status Badges */}
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded text-xs font-medium ${
              vendor.status === 'active' ? 'bg-green-50 text-green-700 border border-green-200' :
              vendor.status === 'suspended' ? 'bg-red-50 text-red-700 border border-red-200' :
              'bg-gray-50 text-gray-700 border border-gray-200'
            }`}>
              {vendor.status === 'active' ? '✓ Active' : vendor.status === 'suspended' ? '⚠ Suspended' : vendor.status}
            </span>
            <span className={`px-2.5 py-1 rounded text-xs font-medium ${
              vendor.risk_level === 'low' ? 'bg-green-50 text-green-700 border border-green-200' :
              vendor.risk_level === 'medium' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
              'bg-red-50 text-red-700 border border-red-200'
            }`}>
              Risk: {vendor.risk_level}
            </span>
          </div>

          {/* Contact Information */}
          <div>
            <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-2">Contact Information</h3>
            <div className="grid grid-cols-2 gap-3 bg-gray-50 rounded-lg p-3 text-sm">
              <div>
                <p className="text-xs text-gray-500">Phone</p>
                <p className="font-medium text-gray-900">{vendor.phone || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Email</p>
                <p className="font-medium text-gray-900">{vendor.email || '—'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-gray-500">Address</p>
                <p className="font-medium text-gray-900">
                  {vendor.address}{vendor.city && `, ${vendor.city}`}{vendor.state && `, ${vendor.state}`} {vendor.zip_code}
                </p>
              </div>
            </div>
          </div>

          {/* Payment Information */}
          <div>
            <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-2">Payment Details</h3>
            <div className="grid grid-cols-2 gap-3 bg-gray-50 rounded-lg p-3 text-sm">
              <div>
                <p className="text-xs text-gray-500">Payment Method</p>
                <p className="font-medium text-gray-900">{vendor.payment_method}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Payment Terms</p>
                <p className="font-medium text-gray-900">{vendor.payment_terms}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Currency</p>
                <p className="font-medium text-gray-900">{vendor.currency}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Tax ID</p>
                <p className="font-medium text-gray-900">{vendor.tax_id || '—'}</p>
              </div>
            </div>
          </div>

          {/* Notes */}
          {vendor.notes && (
            <div>
              <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-2">Notes</h3>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-gray-700">{vendor.notes}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VendorsPage() {
  const [vendors, setVendors] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVendor, setSelectedVendor] = useState(null);

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/vendors`);
      if (!response.ok) throw new Error('Failed to fetch vendors');
      const data = await response.json();
      setVendors(data.vendors);
      setStats(data.stats);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredVendors = vendors.filter(vendor => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      vendor.name.toLowerCase().includes(query) ||
      vendor.vendor_id.toLowerCase().includes(query) ||
      (vendor.email && vendor.email.toLowerCase().includes(query))
    );
  });

  const compliantCount = vendors.filter(v => v.compliance_status === 'complete').length;
  const needsAttentionCount = vendors.filter(v => v.compliance_status !== 'complete').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw size={24} className="animate-spin text-teal-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle size={32} className="text-red-400 mx-auto mb-2" />
          <p className="text-sm text-gray-600">{error}</p>
          <button onClick={fetchVendors} className="mt-2 text-sm text-teal-600 hover:underline">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-base font-semibold text-gray-900">Vendor Directory</h1>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1 px-2.5 py-1 border border-gray-300 rounded text-gray-600 hover:bg-gray-50 text-[11px] font-medium">
            <Download size={12} />
            Export
          </button>
          <button className="flex items-center gap-1 px-2.5 py-1 bg-teal-500 text-white rounded hover:bg-teal-600 text-[11px] font-medium">
            <Plus size={12} />
            Add Vendor
          </button>
        </div>
      </div>

      {/* Subtitle stats */}
      <div className="flex items-center gap-1 text-[11px] text-gray-500 mb-3">
        <span className="font-medium text-gray-700">{vendors.length}</span> vendors
        <span className="text-gray-300 mx-0.5">|</span>
        <span className="font-medium text-green-600">{compliantCount}</span> compliant
        <span className="text-gray-300 mx-0.5">|</span>
        <span className="font-medium text-amber-600">{needsAttentionCount}</span> need attention
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-2.5 mb-3">
        <StatCard 
          icon={Users} 
          value={stats?.total_vendors || 0} 
          label="Total Vendors" 
          iconBgColor="bg-blue-100"
          valueColor="text-blue-600"
        />
        <StatCard 
          icon={AlertTriangle} 
          value={stats?.needs_attention || 0} 
          label="Flagged Issues" 
          iconBgColor="bg-amber-100"
          valueColor="text-amber-600"
        />
        <StatCard 
          icon={AlertCircle} 
          value={stats?.high_risk || 0} 
          label="High Risk" 
          iconBgColor="bg-red-100"
          valueColor="text-red-600"
        />
        <StatCard 
          icon={Clock} 
          value={stats?.pending_compliance || 0} 
          label="Pending Compliance" 
          iconBgColor="bg-orange-100"
          valueColor="text-orange-600"
        />
      </div>

      {/* Alert Banner */}
      {needsAttentionCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-3 flex items-start gap-2">
          <AlertTriangle size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-[11px] font-medium text-amber-800">{needsAttentionCount} vendors require attention</p>
            <p className="text-[10px] text-amber-600">Issues include: Missing bank info, expired contracts, or incomplete compliance</p>
          </div>
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search vendors..."
            className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded text-[11px] focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
          />
        </div>
        <button className="flex items-center gap-1 px-2.5 py-1.5 border border-gray-300 rounded text-gray-600 hover:bg-gray-50 text-[11px]">
          <Filter size={12} />
          Filters
          <ChevronDown size={12} />
        </button>
      </div>

      {/* Vendors Table */}
      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-2.5 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Vendor Name</th>
                <th className="px-2.5 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Currency</th>
                <th className="px-2.5 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Payment Method</th>
                <th className="px-2.5 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Payment Terms</th>
                <th className="px-2.5 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Compliance</th>
                <th className="px-2.5 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Contract Renewal</th>
                <th className="px-2.5 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Contract</th>
                <th className="px-2.5 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Info Change</th>
                <th className="px-2.5 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">ERP Sync</th>
                <th className="px-2.5 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Created</th>
                <th className="px-2.5 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredVendors.map((vendor) => (
                <tr key={vendor.vendor_id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-2.5 py-2">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-5 h-5 rounded flex items-center justify-center text-white font-medium text-[10px] ${
                        vendor.status === 'suspended' ? 'bg-red-500' :
                        vendor.risk_level === 'high' ? 'bg-red-500' :
                        vendor.risk_level === 'medium' ? 'bg-amber-500' :
                        'bg-teal-500'
                      }`}>
                        {vendor.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-[11px]">{vendor.name}</p>
                        <p className="text-[9px] text-gray-400">{vendor.vendor_id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-2.5 py-2">
                    <span className="px-1 py-0.5 bg-gray-100 rounded text-[9px] font-medium text-gray-600">
                      {vendor.currency}
                    </span>
                  </td>
                  <td className="px-2.5 py-2 text-[11px] text-gray-600">{vendor.payment_method}</td>
                  <td className="px-2.5 py-2 text-[11px] text-gray-600">{vendor.payment_terms}</td>
                  <td className="px-2.5 py-2">
                    <ComplianceBadge status={vendor.compliance_status} />
                  </td>
                  <td className="px-2.5 py-2 text-[11px] text-gray-600">{vendor.contract_renewal || '—'}</td>
                  <td className="px-2.5 py-2">
                    <ContractBadge status={vendor.contract_status} />
                  </td>
                  <td className="px-2.5 py-2 text-[11px] text-gray-500">No</td>
                  <td className="px-2.5 py-2">
                    <SyncBadge status={vendor.erp_sync_status} />
                  </td>
                  <td className="px-2.5 py-2 text-[11px] text-gray-500">
                    {vendor.created_at ? new Date(vendor.created_at).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' }) : '—'}
                  </td>
                  <td className="px-2.5 py-2">
                    <button 
                      onClick={() => setSelectedVendor(vendor)}
                      className="flex items-center gap-0.5 text-[10px] text-gray-500 hover:text-gray-700"
                    >
                      <Eye size={10} />
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredVendors.length === 0 && (
          <div className="p-6 text-center">
            <Users size={24} className="text-gray-300 mx-auto mb-2" />
            <p className="text-[11px] text-gray-500">No vendors found</p>
          </div>
        )}
      </div>

      {/* Vendor Detail Modal */}
      {selectedVendor && (
        <VendorDetailModal 
          vendor={selectedVendor} 
          onClose={() => setSelectedVendor(null)} 
        />
      )}
    </div>
  );
}
