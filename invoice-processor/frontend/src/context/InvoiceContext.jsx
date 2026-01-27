import { createContext, useContext, useState, useCallback } from 'react';

const InvoiceContext = createContext(null);

// Default approval chain for AP workflow
const DEFAULT_APPROVERS = [
  { id: 'ap-clerk', name: 'Sarah Chen', role: 'AP Clerk', avatar: '👩‍💼', threshold: 0 },
  { id: 'ap-manager', name: 'Michael Torres', role: 'AP Manager', avatar: '👨‍💼', threshold: 5000 },
  { id: 'controller', name: 'Jennifer Walsh', role: 'Controller', avatar: '👩‍💻', threshold: 25000 },
  { id: 'cfo', name: 'David Kim', role: 'CFO', avatar: '👔', threshold: 100000 },
];

function getApprovalChain(amount) {
  // Determine which approvers are needed based on amount
  return DEFAULT_APPROVERS.filter(approver => amount >= approver.threshold).map((approver, index, arr) => ({
    ...approver,
    status: 'pending',
    order: index + 1,
    isRequired: true,
    isFinal: index === arr.length - 1,
  }));
}

export function InvoiceProvider({ children }) {
  const [processedInvoices, setProcessedInvoices] = useState([]);
  const [routedInvoices, setRoutedInvoices] = useState([]);
  const [payableInvoices, setPayableInvoices] = useState([]);
  const [paidInvoices, setPaidInvoices] = useState([]);
  const [processedCount, setProcessedCount] = useState(0);

  const addProcessedInvoice = useCallback((invoice) => {
    setProcessedInvoices(prev => [invoice, ...prev]);
    setProcessedCount(prev => prev + 1);
  }, []);

  const getInvoiceById = useCallback((id) => {
    const fromProcessed = processedInvoices.find(inv => inv.id === id);
    if (fromProcessed) return fromProcessed;
    const fromRouted = routedInvoices.find(inv => inv.id === id);
    if (fromRouted) return fromRouted;
    const fromPayable = payableInvoices.find(inv => inv.id === id);
    if (fromPayable) return fromPayable;
    const fromPaid = paidInvoices.find(inv => inv.id === id);
    return fromPaid || null;
  }, [processedInvoices, routedInvoices, payableInvoices, paidInvoices]);

  // Legacy route function (frontend-only, no AI)
  const routeInvoice = useCallback((invoiceId) => {
    // Find the invoice first (outside of state updater)
    const invoice = processedInvoices.find(inv => inv.id === invoiceId);
    if (!invoice) return;
    
    // Create routed invoice with approval chain
    const routedInvoice = {
      ...invoice,
      status: 'pending_approval',
      routedAt: new Date().toISOString(),
      approvalChain: getApprovalChain(invoice.amount),
      currentApproverIndex: 0,
    };
    
    // Update both states separately (not nested)
    setProcessedInvoices(prev => prev.filter(inv => inv.id !== invoiceId));
    setRoutedInvoices(prev => [routedInvoice, ...prev]);
  }, [processedInvoices]);

  /**
   * Handle the result of the Approval Agent's smart triage.
   * Called after the ApprovalProcessingModal completes.
   * 
   * @param {string} invoiceId - The invoice being processed
   * @param {Object} result - The triage result from the Approval Agent
   * @param {string} result.route - 'auto_approve' | 'route_to_human' | 'auto_reject'
   */
  const handleApprovalTriageResult = useCallback((invoiceId, result) => {
    const invoice = processedInvoices.find(inv => inv.id === invoiceId);
    if (!invoice) return;

    const route = result?.route || 'route_to_human';

    if (route === 'auto_approve') {
      // Skip approval chain, go straight to payable
      const payableInvoice = {
        ...invoice,
        status: 'ready_to_pay',
        routedAt: new Date().toISOString(),
        autoApproved: true,
        approvalMethod: 'ai_auto_approve',
        approvalChain: [], // No human approval needed
        aiTriageResult: result,
      };
      
      setProcessedInvoices(prev => prev.filter(inv => inv.id !== invoiceId));
      setPayableInvoices(prev => [payableInvoice, ...prev]);
    } else if (route === 'auto_reject') {
      // Auto-rejected by AI
      const rejectedInvoice = {
        ...invoice,
        status: 'rejected',
        rejectedAt: new Date().toISOString(),
        rejectedBy: 'AI Approval Agent',
        rejectionReason: 'Auto-rejected due to major red flags',
        aiTriageResult: result,
      };
      
      setProcessedInvoices(prev => prev.map(inv => 
        inv.id === invoiceId ? rejectedInvoice : inv
      ));
    } else {
      // Route to human approval chain
      const routedInvoice = {
        ...invoice,
        status: 'pending_approval',
        routedAt: new Date().toISOString(),
        approvalChain: getApprovalChain(invoice.amount),
        currentApproverIndex: 0,
        aiTriageResult: result,
      };
      
      setProcessedInvoices(prev => prev.filter(inv => inv.id !== invoiceId));
      setRoutedInvoices(prev => [routedInvoice, ...prev]);
    }
  }, [processedInvoices]);

  const routeAllReady = useCallback(() => {
    // Find ready invoices first (outside of state updater)
    const readyInvoices = processedInvoices.filter(inv => inv.status === 'ready_for_approval');
    if (readyInvoices.length === 0) return;
    
    const newRoutedInvoices = readyInvoices.map(invoice => ({
      ...invoice,
      status: 'pending_approval',
      routedAt: new Date().toISOString(),
      approvalChain: getApprovalChain(invoice.amount),
      currentApproverIndex: 0,
    }));
    
    // Update both states separately (not nested)
    setProcessedInvoices(prev => prev.filter(inv => inv.status !== 'ready_for_approval'));
    setRoutedInvoices(prev => [...newRoutedInvoices, ...prev]);
  }, [processedInvoices]);

  const approveByCurrentApprover = useCallback((invoiceId) => {
    const invoice = routedInvoices.find(inv => inv.id === invoiceId);
    if (!invoice) return;
    
    const newChain = [...invoice.approvalChain];
    const currentIndex = invoice.currentApproverIndex;
    
    // Mark current approver as approved
    newChain[currentIndex] = {
      ...newChain[currentIndex],
      status: 'approved',
      approvedAt: new Date().toISOString(),
    };
    
    // Check if this was the final approver
    const isFinalApproval = currentIndex === newChain.length - 1;
    
    if (isFinalApproval) {
      // Move to payable invoices
      const payableInvoice = {
        ...invoice,
        approvalChain: newChain,
        currentApproverIndex: currentIndex,
        status: 'ready_to_pay',
        fullyApprovedAt: new Date().toISOString(),
        paymentMethod: 'ACH',
        scheduledDate: null,
        earlyPayDiscount: Math.random() > 0.5 ? Math.floor(Math.random() * 3) + 1 : 0, // 0-3%
      };
      
      setRoutedInvoices(prev => prev.filter(inv => inv.id !== invoiceId));
      setPayableInvoices(prev => [payableInvoice, ...prev]);
    } else {
      // Just update the approval chain
      setRoutedInvoices(prev => prev.map(inv => {
        if (inv.id !== invoiceId) return inv;
        return {
          ...inv,
          approvalChain: newChain,
          currentApproverIndex: currentIndex + 1,
          status: 'pending_approval',
        };
      }));
    }
  }, [routedInvoices]);

  const rejectByCurrentApprover = useCallback((invoiceId, reason) => {
    setRoutedInvoices(prev => prev.map(invoice => {
      if (invoice.id !== invoiceId) return invoice;
      
      const newChain = [...invoice.approvalChain];
      const currentIndex = invoice.currentApproverIndex;
      
      newChain[currentIndex] = {
        ...newChain[currentIndex],
        status: 'rejected',
        rejectedAt: new Date().toISOString(),
        rejectionReason: reason,
      };
      
      return {
        ...invoice,
        approvalChain: newChain,
        status: 'approval_rejected',
        rejectedAt: new Date().toISOString(),
        rejectionReason: reason,
      };
    }));
  }, []);

  const schedulePayment = useCallback((invoiceId, scheduledDate) => {
    setPayableInvoices(prev => prev.map(invoice => {
      if (invoice.id !== invoiceId) return invoice;
      return {
        ...invoice,
        status: 'scheduled',
        scheduledDate: scheduledDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Default 7 days
      };
    }));
  }, []);

  const markAsPaid = useCallback((invoiceId) => {
    const invoice = payableInvoices.find(inv => inv.id === invoiceId);
    if (!invoice) return;
    
    const paidInvoice = {
      ...invoice,
      status: 'paid',
      paidAt: new Date().toISOString(),
      transactionId: `TXN-${Date.now().toString(36).toUpperCase()}`,
    };
    
    setPayableInvoices(prev => prev.filter(inv => inv.id !== invoiceId));
    setPaidInvoices(prev => [paidInvoice, ...prev]);
  }, [payableInvoices]);

  const updatePaymentMethod = useCallback((invoiceId, method) => {
    setPayableInvoices(prev => prev.map(invoice => {
      if (invoice.id !== invoiceId) return invoice;
      return {
        ...invoice,
        paymentMethod: method,
      };
    }));
  }, []);

  const resetAllData = useCallback(() => {
    setProcessedInvoices([]);
    setRoutedInvoices([]);
    setPayableInvoices([]);
    setPaidInvoices([]);
    setProcessedCount(0);
  }, []);

  const value = {
    processedInvoices,
    routedInvoices,
    payableInvoices,
    paidInvoices,
    processedCount,
    addProcessedInvoice,
    getInvoiceById,
    routeInvoice,
    routeAllReady,
    handleApprovalTriageResult,
    approveByCurrentApprover,
    rejectByCurrentApprover,
    schedulePayment,
    markAsPaid,
    updatePaymentMethod,
    resetAllData,
  };

  return (
    <InvoiceContext.Provider value={value}>
      {children}
    </InvoiceContext.Provider>
  );
}

export function useInvoices() {
  const context = useContext(InvoiceContext);
  if (!context) {
    throw new Error('useInvoices must be used within an InvoiceProvider');
  }
  return context;
}

