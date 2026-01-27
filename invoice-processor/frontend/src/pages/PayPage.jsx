import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DollarSign,
  Calendar,
  TrendingUp,
  AlertTriangle,
  Filter,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  CreditCard,
  CheckCircle,
  Clock,
  Lock,
  FileText
} from 'lucide-react';
import { useInvoices } from '../context/InvoiceContext';

const tabs = [
  { id: 'ready_to_pay', label: 'Ready to Pay', icon: FileText },
  { id: 'authorize', label: 'Authorize', icon: Lock },
  { id: 'paid', label: 'Paid', icon: CheckCircle },
  { id: 'cards', label: 'Cards', icon: CreditCard },
];

export default function PayPage() {
  const navigate = useNavigate();
  const { 
    payableInvoices, 
    paidInvoices, 
    schedulePayment, 
    markAsPaid, 
    updatePaymentMethod 
  } = useInvoices();
  
  const [activeTab, setActiveTab] = useState('ready_to_pay');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);

  // Filter invoices based on status
  const readyToPay = payableInvoices.filter(inv => inv.status === 'ready_to_pay');
  const scheduled = payableInvoices.filter(inv => inv.status === 'scheduled');
  const allPayable = payableInvoices;

  // Mock payment batches for Authorize tab (in real app, this would come from context)
  const paymentBatches = []; // Empty by default, will populate when invoices are batched

  const getDisplayItems = () => {
    switch (activeTab) {
      case 'ready_to_pay':
        return { type: 'invoices', data: allPayable };
      case 'paid':
        return { type: 'invoices', data: paidInvoices };
      case 'authorize':
        return { type: 'batches', data: paymentBatches };
      case 'cards':
        return { type: 'invoices', data: [] };
      default:
        return { type: 'invoices', data: allPayable };
    }
  };

  const displayItems = getDisplayItems();

  // Calculate stats for Ready to Pay
  const totalAmount = allPayable.reduce((sum, inv) => sum + (inv.amount || 0), 0);
  const earlyPaySavings = allPayable.reduce((sum, inv) => {
    if (inv.earlyPayDiscount) {
      return sum + (inv.amount * inv.earlyPayDiscount / 100);
    }
    return sum;
  }, 0);
  const discountCount = allPayable.filter(inv => inv.earlyPayDiscount > 0).length;
  
  const overdueInvoices = allPayable.filter(inv => {
    if (!inv.dueDate) return false;
    return new Date(inv.dueDate) < new Date();
  });
  const lateFeeRisk = overdueInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);

  // Calculate stats for Authorize tab
  const batchTotal = paymentBatches.reduce((sum, batch) => sum + (batch.totalAmount || 0), 0);

  const formatCurrency = (amount, currency = 'USD') => {
    const symbol = currency === 'GBP' ? '£' : '$';
    return `${symbol}${new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    });
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedItems(displayItems.data.map(item => item.id));
    } else {
      setSelectedItems([]);
    }
  };

  const handleSelectItem = (itemId) => {
    setSelectedItems(prev => {
      if (prev.includes(itemId)) {
        return prev.filter(id => id !== itemId);
      }
      return [...prev, itemId];
    });
  };

  const getPriorityBadge = (amount) => {
    if (amount >= 10000) return { label: 'High', color: 'bg-blue-100 text-blue-700' };
    if (amount >= 5000) return { label: 'Medium', color: 'bg-gray-100 text-gray-700' };
    return null;
  };

  const getEntityBadge = (entity) => {
    if (!entity) return { initials: 'TC', name: 'TechCorp Inc.' };
    const words = entity.split(' ');
    const initials = words.length >= 2 
      ? words[0][0] + words[1][0] 
      : entity.substring(0, 2);
    return { initials: initials.toUpperCase(), name: entity };
  };

  // Render stats cards based on active tab
  const renderStatsCards = () => {
    if (activeTab === 'authorize') {
      return (
        <div className="grid grid-cols-4 gap-4 mb-6">
          {/* Pending Authorization */}
          <div className="bg-white border-2 border-amber-200 rounded-xl p-4">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center mb-3">
              <Lock size={20} className="text-amber-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{paymentBatches.length}</p>
            <p className="text-sm font-medium text-gray-700">Pending Authorization</p>
            <p className="text-xs text-gray-500">Payment batches</p>
          </div>

          {/* Total Pending */}
          <div className="bg-white border-2 border-teal-200 rounded-xl p-4">
            <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center mb-3">
              <DollarSign size={20} className="text-teal-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(batchTotal)}</p>
            <p className="text-sm font-medium text-gray-700">Total Pending</p>
            <p className="text-xs text-gray-500">Awaiting approval</p>
          </div>

          {/* Authorized Today */}
          <div className="bg-white border-2 border-green-200 rounded-xl p-4">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mb-3">
              <CheckCircle size={20} className="text-green-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">0</p>
            <p className="text-sm font-medium text-gray-700">Authorized Today</p>
            <p className="text-xs text-gray-500">Payment batches</p>
          </div>

          {/* Avg. Review Time */}
          <div className="bg-white border-2 border-purple-200 rounded-xl p-4">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mb-3">
              <Clock size={20} className="text-purple-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">0</p>
            <p className="text-sm font-medium text-gray-700">Avg. Review Time</p>
            <p className="text-xs text-gray-500">Hours per batch</p>
          </div>
        </div>
      );
    }

    // Default stats cards for Ready to Pay
    return (
      <div className="grid grid-cols-5 gap-4 mb-6">
        {/* Ready to Pay */}
        <div className="bg-white border-2 border-teal-200 rounded-xl p-4">
          <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center mb-3">
            <DollarSign size={20} className="text-teal-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{readyToPay.length}</p>
          <p className="text-sm font-medium text-gray-700">Ready to Pay</p>
          <p className="text-xs text-gray-500">Awaiting payment</p>
        </div>

        {/* Scheduled */}
        <div className="bg-white border-2 border-purple-200 rounded-xl p-4">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mb-3">
            <Calendar size={20} className="text-purple-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{scheduled.length}</p>
          <p className="text-sm font-medium text-gray-700">Scheduled</p>
          <p className="text-xs text-gray-500">Payment scheduled</p>
        </div>

        {/* Total Amount */}
        <div className="bg-white border-2 border-teal-200 rounded-xl p-4">
          <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center mb-3">
            <DollarSign size={20} className="text-teal-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalAmount)}</p>
          <p className="text-sm font-medium text-gray-700">Total Amount</p>
          <p className="text-xs text-gray-500">Ready for payment</p>
        </div>

        {/* Early Pay Savings */}
        <div className="bg-white border-2 border-green-200 rounded-xl p-4">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mb-3">
            <TrendingUp size={20} className="text-green-600" />
          </div>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(earlyPaySavings)}</p>
          <p className="text-sm font-medium text-gray-700">Early Pay Savings</p>
          <p className="text-xs text-gray-500">{discountCount} discounts available</p>
        </div>

        {/* Late Fees Risk */}
        <div className="bg-white border-2 border-red-200 rounded-xl p-4">
          <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center mb-3">
            <AlertTriangle size={20} className="text-red-600" />
          </div>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(lateFeeRisk)}</p>
          <p className="text-sm font-medium text-gray-700">Late Fees Risk</p>
          <p className="text-xs text-gray-500">{overdueInvoices.length} overdue invoices</p>
        </div>
      </div>
    );
  };

  // Render table based on active tab
  const renderTable = () => {
    if (activeTab === 'authorize') {
      return (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Payment Batches ({paymentBatches.length})</h2>
            <button className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
              <Download size={14} />
              Export CSV
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="w-10 py-3 px-3">
                    <input
                      type="checkbox"
                      checked={selectedItems.length === paymentBatches.length && paymentBatches.length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase">Batch ID</th>
                  <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase">Entity</th>
                  <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase">Method</th>
                  <th className="text-center py-3 px-3 text-xs font-semibold text-gray-500 uppercase"># Invoices</th>
                  <th className="text-right py-3 px-3 text-xs font-semibold text-gray-500 uppercase">Total Amount</th>
                  <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase">Due Date</th>
                  <th className="text-center py-3 px-3 text-xs font-semibold text-gray-500 uppercase">Exceptions</th>
                  <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paymentBatches.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="py-12 text-center">
                      <div className="flex flex-col items-center">
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                          <Lock size={24} className="text-gray-400" />
                        </div>
                        <p className="text-gray-500 font-medium">No batches pending authorization</p>
                        <p className="text-gray-400 text-sm">Payment batches will appear here for approval</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paymentBatches.map((batch) => {
                    const isSelected = selectedItems.includes(batch.id);
                    const entityBadge = getEntityBadge(batch.entity);
                    
                    return (
                      <tr key={batch.id} className={`hover:bg-gray-50 ${isSelected ? 'bg-teal-50' : ''}`}>
                        <td className="py-3 px-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleSelectItem(batch.id)}
                            className="rounded border-gray-300"
                          />
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-teal-600">{batch.batchId}</span>
                            <span className="text-xs text-gray-500">{formatDate(batch.createdAt)}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <span className="w-7 h-7 bg-blue-100 text-blue-700 rounded text-[10px] font-semibold flex items-center justify-center">
                              {entityBadge.initials}
                            </span>
                            <span className="text-sm text-gray-900">{entityBadge.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-sm text-gray-600">{batch.method}</td>
                        <td className="py-3 px-3 text-sm text-gray-900 text-center">{batch.invoiceCount}</td>
                        <td className="py-3 px-3 text-sm font-medium text-gray-900 text-right">
                          {formatCurrency(batch.totalAmount, batch.currency)}
                        </td>
                        <td className="py-3 px-3 text-sm text-gray-600">{formatDate(batch.dueDate)}</td>
                        <td className="py-3 px-3 text-center">
                          {batch.exceptions > 0 ? (
                            <span className="inline-flex items-center gap-1 text-amber-600">
                              <AlertTriangle size={14} />
                              <span className="text-sm">{batch.exceptions}</span>
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400">0</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                            <Clock size={12} />
                            Pending
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <button className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
                            <Eye size={14} />
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    // Default invoices table
    return (
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">
            {activeTab === 'ready_to_pay' && `Ready to Pay Invoices (${allPayable.length})`}
            {activeTab === 'paid' && `Paid Invoices (${paidInvoices.length})`}
            {activeTab === 'cards' && 'Card Payments (0)'}
          </h2>
          <button className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            <Download size={14} />
            Export CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="w-10 py-3 px-3">
                  <input
                    type="checkbox"
                    checked={selectedItems.length === displayItems.data.length && displayItems.data.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase">Invoice</th>
                <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase">Vendor</th>
                <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase">Entity</th>
                <th className="text-right py-3 px-3 text-xs font-semibold text-gray-500 uppercase">Amount</th>
                <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase">Due Date</th>
                <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase">Early Pay</th>
                <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase">Scheduled</th>
                <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase">Sync</th>
                <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase">Method</th>
                <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {displayItems.data.length === 0 ? (
                <tr>
                  <td colSpan="12" className="py-12 text-center">
                    <div className="flex flex-col items-center">
                      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                        <DollarSign size={24} className="text-gray-400" />
                      </div>
                      <p className="text-gray-500 font-medium">No invoices to display</p>
                      <p className="text-gray-400 text-sm">
                        {activeTab === 'ready_to_pay' 
                          ? 'Approved invoices will appear here for payment'
                          : activeTab === 'paid'
                          ? 'Paid invoices will appear here'
                          : 'No items in this category'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                displayItems.data.map((invoice) => {
                  const priority = getPriorityBadge(invoice.amount);
                  const isSelected = selectedItems.includes(invoice.id);
                  const isOverdue = invoice.dueDate && new Date(invoice.dueDate) < new Date();
                  
                  return (
                    <tr key={invoice.id} className={`hover:bg-gray-50 ${isSelected ? 'bg-teal-50' : ''}`}>
                      <td className="py-3 px-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectItem(invoice.id)}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-teal-600">{invoice.invoiceNumber}</span>
                          {priority && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded w-fit mt-1 ${priority.color}`}>
                              {priority.label}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-sm text-gray-900">{invoice.vendor}</td>
                      <td className="py-3 px-3 text-sm text-gray-600">{invoice.entity || 'TechCorp Inc.'}</td>
                      <td className="py-3 px-3 text-sm font-medium text-gray-900 text-right">
                        {formatCurrency(invoice.amount)}
                      </td>
                      <td className={`py-3 px-3 text-sm ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                        {formatDate(invoice.dueDate)}
                      </td>
                      <td className="py-3 px-3">
                        {invoice.earlyPayDiscount > 0 ? (
                          <span className="text-sm text-green-600 font-medium">+{invoice.earlyPayDiscount}%</span>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-sm text-gray-600">
                        {invoice.scheduledDate ? formatDate(invoice.scheduledDate) : '—'}
                      </td>
                      <td className="py-3 px-3">
                        {invoice.status === 'scheduled' ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                            Scheduled
                          </span>
                        ) : invoice.status === 'paid' ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            Paid
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          Synced
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <select
                          value={invoice.paymentMethod || 'ACH'}
                          onChange={(e) => updatePaymentMethod(invoice.id, e.target.value)}
                          className="text-sm border border-gray-200 rounded-lg px-2 py-1 bg-white"
                        >
                          <option value="ACH">ACH</option>
                          <option value="Wire">Wire</option>
                          <option value="Check">Check</option>
                        </select>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => navigate(`/invoice/${invoice.id}`)}
                            className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
                          >
                            <Eye size={14} />
                            View
                          </button>
                          {invoice.status === 'ready_to_pay' && (
                            <button
                              onClick={() => schedulePayment(invoice.id)}
                              className="text-xs px-2 py-1 bg-teal-500 text-white rounded hover:bg-teal-600"
                            >
                              Schedule
                            </button>
                          )}
                          {invoice.status === 'scheduled' && (
                            <button
                              onClick={() => markAsPaid(invoice.id)}
                              className="text-xs px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                            >
                              Pay Now
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Get summary text based on active tab
  const getSummaryText = () => {
    switch (activeTab) {
      case 'authorize':
        return `${paymentBatches.length} batches pending authorization • ${formatCurrency(batchTotal)} total`;
      case 'paid':
        return `${paidInvoices.length} invoices paid`;
      case 'cards':
        return '0 card payments';
      default:
        return `${allPayable.length} invoices ready for payment • ${formatCurrency(totalAmount)} total`;
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center">
            <CreditCard size={20} className="text-teal-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Pay</h1>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-4">
          {tabs.map((tab) => {
            const count = tab.id === 'ready_to_pay' ? allPayable.length
              : tab.id === 'paid' ? paidInvoices.length
              : tab.id === 'authorize' ? paymentBatches.length
              : 0;
            
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setSelectedItems([]);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-teal-50 text-teal-700 border border-teal-200'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <tab.icon size={16} />
                {tab.label}
                <span className={`px-2 py-0.5 rounded-full text-xs ${
                  activeTab === tab.id ? 'bg-teal-500 text-white' : 'bg-gray-200 text-gray-600'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Summary text */}
        <p className="text-sm text-gray-500">{getSummaryText()}</p>
      </div>

      {/* Stats Cards */}
      {renderStatsCards()}

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl mb-6">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="w-full px-4 py-3 flex items-center justify-between text-sm font-medium text-gray-700"
        >
          <div className="flex items-center gap-2">
            <Filter size={16} />
            <span>FILTERS</span>
          </div>
          {showFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {showFilters && (
          <div className="px-4 pb-4 border-t border-gray-100">
            <div className="grid grid-cols-4 gap-4 pt-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  {activeTab === 'authorize' ? 'Entity' : 'Vendor'}
                </label>
                <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option>All {activeTab === 'authorize' ? 'Entities' : 'Vendors'}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  {activeTab === 'authorize' ? 'Method' : 'Entity'}
                </label>
                <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option>All</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Amount Range</label>
                <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option>Any Amount</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Due Date</label>
                <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option>Any Date</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      {renderTable()}
    </div>
  );
}
