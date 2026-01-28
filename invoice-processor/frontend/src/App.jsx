import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import InboxPage from './pages/InboxPage';
import DetailPage from './pages/DetailPage';
import ApprovalsPage from './pages/ApprovalsPage';
import PayPage from './pages/PayPage';
import SettingsPage from './pages/SettingsPage';
import VendorsPage from './pages/VendorsPage';
import { InvoiceProvider } from './context/InvoiceContext';

function Layout({ children }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 ml-56 p-8">
        {children}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <InvoiceProvider>
        <Routes>
          {/* Invoice Detail - Full screen overlay */}
          <Route path="/invoice/:id" element={<DetailPage />} />
          
          {/* Main layout routes */}
          <Route path="/*" element={
            <Layout>
              <Routes>
                <Route path="/" element={<InboxPage />} />
                <Route path="/inbox" element={<InboxPage />} />
                {/* Placeholder routes */}
                <Route path="/requisitions" element={<PlaceholderPage title="Requisitions" />} />
                <Route path="/purchase-orders" element={<PlaceholderPage title="Purchase Orders" />} />
                <Route path="/prepayments" element={<PlaceholderPage title="Prepayments" />} />
                <Route path="/vendors" element={<VendorsPage />} />
                <Route path="/approvals" element={<ApprovalsPage />} />
                <Route path="/pay" element={<PayPage />} />
                <Route path="/audit" element={<PlaceholderPage title="Audit" />} />
                <Route path="/insights" element={<PlaceholderPage title="Insights" />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </Layout>
          } />
        </Routes>
      </InvoiceProvider>
    </BrowserRouter>
  );
}

function PlaceholderPage({ title }) {
  return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{title}</h1>
        <p className="text-gray-500">This page is under construction</p>
      </div>
    </div>
  );
}
