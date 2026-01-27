import { useState, useRef } from 'react';
import { X, Upload, Zap, FileText, AlertTriangle, CheckCircle, File, Loader2 } from 'lucide-react';

const API_URL = 'http://localhost:8000';

const testInvoices = [
  {
    id: 'test-1',
    name: 'Widgets Inc.',
    description: 'Complete invoice — Full extraction demo',
    amount: 5000,
    icon: '⚙️',
    expectedOutcome: 'approved',
    outcomeLabel: 'Will Approve & Pay',
    rawText: `INVOICE #INV-2026-0042
Date: January 26, 2026

Bill From:
Widgets Inc.
500 Widget Way, Austin, TX 78701
ar@widgets.com | (512) 555-9876

Bill To:
TechCorp Inc.
100 Tech Plaza, San Francisco, CA 94105

PO#: PO-2025-0892

Items:
WidgetA    10 @ $300.00   $3,000.00
WidgetB    5 @ $400.00    $2,000.00

Subtotal: $5,000.00
Tax (0%): $0.00
Total Due: $5,000.00

Terms: Net 30
Due Date: February 25, 2026`,
  },
  {
    id: 'test-2',
    name: 'Gadgets Co.',
    description: 'Messy format — Self-correction demo',
    amount: 15000,
    icon: '🔧',
    expectedOutcome: 'needs_review',
    outcomeLabel: 'Will Flag for Review',
    rawText: `Vndr: Gadgets Co.
200 Gadget Lane, Seattle, WA 98101
invoices@gadgets.co

Amt: $15,000
Itms: GadgetX:20 @ $750

Due: 2026-01-30
Terms: Net 20`,
  },
  {
    id: 'test-3',
    name: 'Fraudster LLC',
    description: 'Fraud signals — Rejection demo',
    amount: 100000,
    icon: '⚠️',
    expectedOutcome: 'rejected',
    outcomeLabel: 'Will Reject',
    rawText: `Vendor: Fraudster LLC
Amount: 100000
Items: FakeItem:100
Due: yesterday`,
  },
];

export { testInvoices };

export default function UploadModal({ isOpen, onClose, onSelectInvoice }) {
  const [activeTab, setActiveTab] = useState('upload'); // 'upload' or 'test'
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const validateAndSetFile = (file) => {
    setUploadError(null);
    
    // Check file type
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setUploadError('Please upload a PDF file');
      return;
    }
    
    // Check file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File too large. Maximum size is 10MB');
      return;
    }
    
    setUploadedFile(file);
  };

  const handleUploadAndProcess = async () => {
    if (!uploadedFile) return;
    
    setIsUploading(true);
    setUploadError(null);
    
    try {
      // Step 1: Upload the PDF
      const formData = new FormData();
      formData.append('file', uploadedFile);
      
      const uploadResponse = await fetch(`${API_URL}/api/invoices/upload-pdf`, {
        method: 'POST',
        body: formData,
      });
      
      if (!uploadResponse.ok) {
        const error = await uploadResponse.json();
        throw new Error(error.detail || 'Upload failed');
      }
      
      const uploadResult = await uploadResponse.json();
      console.log('PDF uploaded:', uploadResult);
      
      // Step 2: Create an invoice object that ProcessingView can use
      // The file_path will be sent to the WebSocket for processing
      const pdfInvoice = {
        id: uploadResult.invoice_id,
        name: uploadedFile.name.replace('.pdf', ''),
        description: 'PDF Invoice',
        amount: 0, // Will be extracted by AI
        icon: '📄',
        expectedOutcome: 'unknown',
        outcomeLabel: 'Processing...',
        rawText: uploadResult.file_path, // This is the key - send the file path
        isPdf: true,
        filePath: uploadResult.file_path,
        originalFilename: uploadedFile.name,
      };
      
      // Close modal and start processing
      setUploadedFile(null);
      setIsUploading(false);
      onSelectInvoice(pdfInvoice);
      
    } catch (error) {
      console.error('Upload error:', error);
      setUploadError(error.message || 'Failed to upload PDF');
      setIsUploading(false);
    }
  };

  const clearFile = () => {
    setUploadedFile(null);
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[var(--primary)] to-teal-600 px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <Upload className="text-white" size={20} />
              </div>
              <div>
                <h2 className="font-semibold text-white text-lg">Process Invoice</h2>
                <p className="text-white/80 text-sm">Upload PDF or use test data</p>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X size={20} className="text-white/80" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'upload'
                ? 'text-teal-600 border-b-2 border-teal-500 bg-teal-50/50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <File size={16} />
              Upload PDF
            </div>
          </button>
          <button
            onClick={() => setActiveTab('test')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'test'
                ? 'text-teal-600 border-b-2 border-teal-500 bg-teal-50/50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Zap size={16} />
              Test Invoices
            </div>
          </button>
        </div>

        {/* Upload Tab Content */}
        {activeTab === 'upload' && (
          <div className="p-6">
            {/* Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !uploadedFile && fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-teal-400 bg-teal-50'
                  : uploadedFile
                    ? 'border-teal-300 bg-teal-50/50'
                    : 'border-gray-300 hover:border-teal-400 hover:bg-gray-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
              
              {uploadedFile ? (
                <div className="space-y-3">
                  <div className="w-14 h-14 bg-teal-100 rounded-full flex items-center justify-center mx-auto">
                    <FileText size={28} className="text-teal-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{uploadedFile.name}</p>
                    <p className="text-sm text-gray-500">
                      {(uploadedFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      clearFile();
                    }}
                    className="text-sm text-red-600 hover:text-red-700 font-medium"
                  >
                    Remove file
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                    <Upload size={28} className="text-gray-400" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      Drop your invoice PDF here
                    </p>
                    <p className="text-sm text-gray-500">
                      or click to browse • Max 10MB
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Error Message */}
            {uploadError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
                <AlertTriangle size={16} />
                <span className="text-sm">{uploadError}</span>
              </div>
            )}

            {/* Process Button */}
            <button
              onClick={handleUploadAndProcess}
              disabled={!uploadedFile || isUploading}
              className={`w-full mt-4 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                uploadedFile && !isUploading
                  ? 'bg-teal-500 hover:bg-teal-600 text-white'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              {isUploading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Zap size={18} />
                  Process Invoice
                </>
              )}
            </button>

            {/* Info */}
            <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
              <p className="text-sm text-blue-700">
                <strong>PDF Parsing Enabled:</strong> The AI will extract text from your PDF 
                and process it through the full pipeline — Ingestion, Validation, and Approval stages.
              </p>
            </div>
          </div>
        )}

        {/* Test Invoices Tab Content */}
        {activeTab === 'test' && (
          <>
            {/* Description */}
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
              <p className="text-sm text-gray-600">
                Select a test invoice to watch the multi-agent AI pipeline process it in real-time.
                Each invoice demonstrates a different scenario.
              </p>
            </div>

            {/* Test Invoices */}
            <div className="p-4 space-y-3 max-h-[400px] overflow-auto">
              {testInvoices.map((invoice) => (
                <button
                  key={invoice.id}
                  onClick={() => onSelectInvoice(invoice)}
                  className="w-full p-4 border-2 border-gray-100 rounded-xl hover:border-[var(--primary)] hover:bg-[var(--primary)]/5 transition-all text-left group"
                >
                  <div className="flex items-start gap-4">
                    <div className="text-3xl">{invoice.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold text-gray-900 truncate">
                          {invoice.name}
                        </h3>
                        <span className="text-gray-900 font-bold whitespace-nowrap">
                          ${invoice.amount.toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{invoice.description}</p>
                      
                      {/* Expected Outcome Badge */}
                      <div className="flex items-center gap-2 mt-3">
                        {invoice.expectedOutcome === 'approved' && (
                          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-green-100 text-green-700 font-medium">
                            <CheckCircle size={12} />
                            {invoice.outcomeLabel}
                          </span>
                        )}
                        {invoice.expectedOutcome === 'needs_review' && (
                          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 font-medium">
                            <AlertTriangle size={12} />
                            {invoice.outcomeLabel}
                          </span>
                        )}
                        {invoice.expectedOutcome === 'rejected' && (
                          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-red-100 text-red-700 font-medium">
                            <X size={12} />
                            {invoice.outcomeLabel}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 group-hover:bg-[var(--primary)] transition-colors">
                      <Zap size={16} className="text-gray-400 group-hover:text-white transition-colors" />
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <FileText size={14} />
                <span>Test invoices match the scenarios from the technical assessment</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
