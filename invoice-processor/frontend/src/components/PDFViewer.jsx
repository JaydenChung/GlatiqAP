import { useState } from 'react';
import { Search, ZoomIn, ZoomOut, RotateCw, Download, FileText, AlertCircle } from 'lucide-react';

/**
 * PDFViewer Component
 * 
 * Displays either:
 * 1. The actual uploaded PDF file (when invoice.sourceFile is set)
 * 2. A dynamic "mock" invoice rendering using the extracted data (for text-based invoices)
 * 
 * The mock rendering shows all the data that was extracted by the AI,
 * formatted as a visual invoice preview.
 */
export default function PDFViewer({ invoice }) {
  const [zoom, setZoom] = useState(100);
  const [pdfError, setPdfError] = useState(false);

  const formatCurrency = (amount) => {
    return `$${amount?.toLocaleString()}`;
  };

  const pageCount = invoice.lineItems?.length > 5 ? 3 : 1;

  // Check if this invoice has an actual PDF file to display
  const hasPdfFile = invoice.sourceFile || invoice.source_path || invoice.filePath;
  
  // Get the PDF URL for embedding
  const getPdfUrl = () => {
    const sourcePath = invoice.sourceFile || invoice.source_path || invoice.filePath;
    if (!sourcePath) return null;
    
    // Extract just the filename from the path
    const fileName = sourcePath.split('/').pop();
    return `http://localhost:8000/api/files/${fileName}`;
  };

  // Actual PDF Viewer using iframe
  const ActualPDFViewer = () => {
    const pdfUrl = getPdfUrl();
    
    if (pdfError) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8">
          <AlertCircle size={48} className="text-amber-500 mb-4" />
          <p className="text-center font-medium text-gray-700 mb-2">
            Unable to display PDF
          </p>
          <p className="text-center text-sm text-gray-500 mb-4">
            The PDF preview couldn't be loaded, but you can still download it.
          </p>
          <a 
            href={pdfUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors"
          >
            <Download size={16} />
            Download PDF
          </a>
        </div>
      );
    }

    return (
      <div className="w-full h-full bg-gray-200 rounded-lg overflow-hidden">
        <iframe
          src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=1`}
          width="100%"
          height="100%"
          style={{ 
            border: 'none',
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top left',
            width: `${10000 / zoom}%`,
            height: `${10000 / zoom}%`,
          }}
          title="Invoice PDF"
          onError={() => setPdfError(true)}
        />
      </div>
    );
  };

  // Mock PDF content - Shows ALL source data that AI can extract from
  // This is used when no actual PDF file is available (for text-based invoices)
  const MockInvoicePDF = () => (
    <div 
      className="bg-white shadow-lg rounded mx-auto"
      style={{ 
        width: '100%',
        maxWidth: `${Math.min(480, 420 * (zoom / 100))}px`,
        transform: `scale(${zoom / 100})`,
        transformOrigin: 'top center'
      }}
    >
      <div className="p-6">
        {/* Invoice Header */}
        <div className="flex justify-between items-start mb-4">
          <div>
            {/* Only show logo if NOT AI processed (mock data) */}
            {!invoice.aiProcessed && invoice.vendorLogo && (
              <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center mb-2">
                <span className="text-xl">{invoice.vendorLogo}</span>
              </div>
            )}
            <h2 className="text-base font-bold text-gray-900">{invoice.billFrom?.name || invoice.vendor}</h2>
            {/* Show vendor address if extracted */}
            {invoice.billFrom?.address && (
              <p className="text-[10px] text-gray-500 mt-0.5">{invoice.billFrom.address}</p>
            )}
            {/* Show vendor contact if extracted */}
            {(invoice.billFrom?.email || invoice.billFrom?.phone) && (
              <p className="text-[10px] text-gray-500">
                {invoice.billFrom?.email}{invoice.billFrom?.email && invoice.billFrom?.phone && ' | '}{invoice.billFrom?.phone}
              </p>
            )}
          </div>
          <div className="text-right">
            <h1 className="text-xl font-light text-gray-300 tracking-widest mb-1">INVOICE</h1>
            <p className="text-xs text-gray-500 font-mono"># {invoice.invoiceNumber}</p>
          </div>
        </div>

        {/* Bill To / Details */}
        <div className="grid grid-cols-2 gap-4 mb-6 text-xs">
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">BILL TO:</p>
            <p className="font-semibold text-gray-900">{invoice.billTo?.name || '—'}</p>
            {invoice.billTo?.address && (
              <p className="text-gray-600 leading-relaxed">{invoice.billTo.address}</p>
            )}
          </div>
          <div className="text-right space-y-1">
            <div>
              <span className="text-gray-400">Date: </span>
              <span className="text-gray-700">{invoice.invoiceDate ? new Date(invoice.invoiceDate).toLocaleDateString() : '—'}</span>
            </div>
            <div>
              <span className="text-gray-400">Payment Terms: </span>
              <span className="text-gray-700">{invoice.paymentTerms || '—'}</span>
            </div>
            <div>
              <span className="text-gray-400">Due Date: </span>
              <span className="text-gray-700">{invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : '—'}</span>
            </div>
            {invoice.poMatch && (
              <div>
                <span className="text-gray-400">PO#: </span>
                <span className="text-gray-700">{invoice.poMatch}</span>
              </div>
            )}
            <div className="bg-teal-50 border border-teal-200 px-3 py-1.5 inline-block rounded mt-2">
              <span className="text-[10px] text-gray-500">Balance Due: </span>
              <span className="font-bold text-gray-900">{formatCurrency(invoice.amount)}</span>
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <table className="w-full mb-4 text-[11px]">
          <thead>
            <tr className="bg-teal-500 text-white">
              <th className="text-left py-2 px-2.5 font-semibold rounded-tl">Item</th>
              <th className="text-center py-2 px-2.5 font-semibold">Quantity</th>
              <th className="text-right py-2 px-2.5 font-semibold">Rate</th>
              <th className="text-right py-2 px-2.5 font-semibold rounded-tr">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lineItems?.length > 0 ? (
              invoice.lineItems.map((item, idx) => (
                <tr key={idx} className="border-b border-gray-100">
                  <td className="py-2 px-2.5 text-gray-900">{item.description}</td>
                  <td className="py-2 px-2.5 text-center text-gray-600">{item.quantity}</td>
                  <td className="py-2 px-2.5 text-right text-gray-600">{formatCurrency(item.rate)}</td>
                  <td className="py-2 px-2.5 text-right text-gray-900 font-medium">{formatCurrency(item.amount)}</td>
                </tr>
              ))
            ) : (
              <tr className="border-b border-gray-100">
                <td className="py-2 px-2.5 text-gray-900">Invoice Total</td>
                <td className="py-2 px-2.5 text-center text-gray-600">1</td>
                <td className="py-2 px-2.5 text-right text-gray-600">{formatCurrency(invoice.amount)}</td>
                <td className="py-2 px-2.5 text-right text-gray-900 font-medium">{formatCurrency(invoice.amount)}</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mb-4">
          <div className="w-40 text-[11px]">
            <div className="flex justify-between py-1.5 border-b border-gray-100">
              <span className="text-gray-500">Subtotal:</span>
              <span className="text-gray-900">{formatCurrency(invoice.amount)}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-gray-100">
              <span className="text-gray-500">Tax (0%):</span>
              <span className="text-gray-900">$0.00</span>
            </div>
            <div className="flex justify-between py-2 font-bold text-xs">
              <span className="text-gray-900">Total:</span>
              <span className="text-gray-900">{formatCurrency(invoice.amount)}</span>
            </div>
          </div>
        </div>

        {/* Terms */}
        <div className="text-[9px] text-gray-400 border-t border-gray-100 pt-3">
          <p className="font-medium text-gray-500 mb-0.5">Terms & Conditions:</p>
          <p className="leading-relaxed">Payment is due within {invoice.paymentTerms?.replace('Net ', '') || '30'} days of invoice date. 
          Late payments may be subject to interest charges.</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-gray-100">
      {/* Toolbar */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button className="p-1.5 hover:bg-gray-100 rounded transition-colors">
            <Search size={15} className="text-gray-500" />
          </button>
          <button 
            onClick={() => setZoom(z => Math.max(50, z - 10))}
            className="p-1.5 hover:bg-gray-100 rounded transition-colors"
          >
            <ZoomOut size={15} className="text-gray-500" />
          </button>
          <span className="text-xs text-gray-500 min-w-[40px] text-center font-medium">{zoom}%</span>
          <button 
            onClick={() => setZoom(z => Math.min(150, z + 10))}
            className="p-1.5 hover:bg-gray-100 rounded transition-colors"
          >
            <ZoomIn size={15} className="text-gray-500" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          {hasPdfFile && (
            <span className="text-xs text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full flex items-center gap-1">
              <FileText size={10} />
              PDF
            </span>
          )}
          <span className="text-xs text-gray-400">{hasPdfFile ? '1 page' : `${pageCount} page${pageCount > 1 ? 's' : ''}`}</span>
        </div>
        <div className="flex items-center gap-1">
          <button className="p-1.5 hover:bg-gray-100 rounded transition-colors">
            <RotateCw size={15} className="text-gray-500" />
          </button>
          {hasPdfFile && (
            <a 
              href={getPdfUrl()} 
              target="_blank" 
              rel="noopener noreferrer"
              className="p-1.5 hover:bg-gray-100 rounded transition-colors"
            >
              <Download size={15} className="text-gray-500" />
            </a>
          )}
        </div>
      </div>

      {/* PDF Content */}
      <div className="flex-1 overflow-auto p-5 flex justify-center">
        {hasPdfFile ? <ActualPDFViewer /> : <MockInvoicePDF />}
      </div>
    </div>
  );
}
