import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  BarChart3,
  Users,
  Inbox,
  CheckSquare,
  Clock,
  FileSearch,
  TrendingUp,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useInvoices } from '../context/InvoiceContext';

const NavSection = ({ title, children, collapsed }) => (
  <div className="mb-4">
    {!collapsed && (
      <h3 className="px-4 text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
        {title}
      </h3>
    )}
    <nav className="space-y-0.5">
      {children}
    </nav>
  </div>
);

const NavItem = ({ to, icon: Icon, label, active, badge, collapsed }) => (
  <Link
    to={to}
    className={`flex items-center gap-3 px-4 py-2 text-[13px] font-medium transition-all duration-200 ${
      collapsed ? 'justify-center mx-2 rounded-lg' : 'mx-2 rounded-lg'
    } ${
      active 
        ? 'bg-teal-50 text-teal-600 border-l-2 border-teal-500 ml-0 rounded-l-none' 
        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
    }`}
    title={collapsed ? label : undefined}
  >
    <Icon size={18} strokeWidth={1.5} />
    {!collapsed && (
      <>
        <span className="flex-1">{label}</span>
        {badge > 0 && (
          <span className="bg-teal-100 text-teal-600 text-[11px] font-semibold px-2 py-0.5 rounded-full min-w-[20px] text-center">
            {badge}
          </span>
        )}
      </>
    )}
    {collapsed && badge > 0 && (
      <span className="absolute -top-1 -right-1 bg-teal-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
        {badge}
      </span>
    )}
  </Link>
);

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const currentPath = location.pathname;
  const { processedInvoices, routedInvoices, payableInvoices } = useInvoices();
  
  const inboxCount = processedInvoices.length;
  const pendingApprovals = routedInvoices.filter(inv => inv.status === 'pending_approval').length;
  const readyToPayCount = payableInvoices.length;

  return (
    <aside className={`${collapsed ? 'w-16' : 'w-56'} bg-white border-r border-gray-100 flex flex-col h-screen fixed left-0 top-0 transition-all duration-300 z-40`}>
      {/* Logo */}
      <div className="h-14 px-4 border-b border-gray-100 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg flex items-center justify-center shadow-sm">
            <BarChart3 size={16} className="text-white" />
          </div>
          {!collapsed && (
            <span className="font-bold text-[15px] text-teal-600">GALATIQ</span>
          )}
        </Link>
        <button 
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Main Nav Item */}
      {!collapsed && (
        <div className="px-2 py-3">
          <Link
            to="/"
            className="flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
          >
            <BarChart3 size={18} strokeWidth={1.5} />
            <span>Pulse</span>
          </Link>
        </div>
      )}

      {/* Navigation */}
      <div className="flex-1 py-2 overflow-y-auto">
        <NavSection title="Procurement" collapsed={collapsed}>
          <NavItem 
            to="/vendors" 
            icon={Users} 
            label="Vendors" 
            collapsed={collapsed}
          />
        </NavSection>

        <NavSection title="Payables" collapsed={collapsed}>
          <NavItem 
            to="/" 
            icon={Inbox} 
            label="Inbox" 
            active={currentPath === '/' || currentPath === '/inbox'}
            badge={inboxCount}
            collapsed={collapsed}
          />
          <NavItem 
            to="/approvals" 
            icon={CheckSquare} 
            label="Approvals"
            active={currentPath === '/approvals'}
            badge={pendingApprovals}
            collapsed={collapsed}
          />
          <NavItem 
            to="/pay" 
            icon={Clock} 
            label="Pay" 
            active={currentPath === '/pay'}
            badge={readyToPayCount}
            collapsed={collapsed}
          />
        </NavSection>

        <NavSection title="Audit" collapsed={collapsed}>
          <NavItem 
            to="/audit" 
            icon={FileSearch} 
            label="Audit" 
            collapsed={collapsed}
          />
        </NavSection>

        <NavSection title="Reporting" collapsed={collapsed}>
          <NavItem 
            to="/insights" 
            icon={TrendingUp} 
            label="Insights" 
            collapsed={collapsed}
          />
          <NavItem 
            to="/settings" 
            icon={Settings} 
            label="Settings" 
            collapsed={collapsed}
          />
        </NavSection>
      </div>

      {/* User Section */}
      <div className="border-t border-gray-100 p-3">
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'} mb-2`}>
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-xs font-semibold shadow-sm">
            J
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900">Jchung</div>
              <div className="text-xs text-gray-500 truncate">jchung@galatiq.com</div>
            </div>
          )}
        </div>
        {!collapsed && (
          <button className="flex items-center gap-2 text-[13px] text-gray-500 hover:text-gray-700 transition-colors w-full px-1 py-1.5">
            <LogOut size={16} strokeWidth={1.5} />
            <span>Logout</span>
          </button>
        )}
      </div>
    </aside>
  );
}
