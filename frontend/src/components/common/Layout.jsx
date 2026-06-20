import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useErpStore } from '../../store/erpStore';
import { ThemeToggle } from './ThemeToggle';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingBag, 
  ShoppingCart, 
  Layers, 
  Factory, 
  Search, 
  ChevronLeft, 
  ChevronRight,
  ShieldAlert,
  User,
  Users,
  Activity
} from 'lucide-react';

export const Layout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentRole, setCurrentRole, globalSearch, setGlobalSearch, logout } = useErpStore();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);

  // Role details mapping
  const roleDisplayNames = {
    SuperAdmin: "Super Admin",
    StoreAdmin: "Store Admin",
    SalesUser: "Sales User",
    PurchaseUser: "Purchase User",
    ManufacturingUser: "Manufacturing User",
    InventoryManager: "Inventory Manager",
    BusinessOwner: "Business Owner",
    Customer: "Customer Portal"
  };

  const roleInitials = {
    SuperAdmin: "SA",
    StoreAdmin: "AD",
    SalesUser: "SU",
    PurchaseUser: "PU",
    ManufacturingUser: "MU",
    InventoryManager: "IM",
    BusinessOwner: "BO",
    Customer: "CS"
  };

  // Sidebar items definition
  const navigationItems = [
    { 
      name: "Dashboard", 
      path: "/dashboard", 
      icon: LayoutDashboard,
      roles: ["SuperAdmin", "StoreAdmin", "BusinessOwner"]
    },
    { 
      name: "Products", 
      path: "/products", 
      icon: Package,
      roles: ["SuperAdmin", "StoreAdmin", "SalesUser", "PurchaseUser", "ManufacturingUser", "InventoryManager", "BusinessOwner"]
    },
    { 
      name: "Sales Orders", 
      path: "/sales", 
      icon: ShoppingBag,
      roles: ["SuperAdmin", "StoreAdmin", "SalesUser", "PurchaseUser", "InventoryManager", "BusinessOwner"]
    },
    { 
      name: "Purchase Orders", 
      path: "/purchase", 
      icon: ShoppingCart,
      roles: ["SuperAdmin", "StoreAdmin", "PurchaseUser", "ManufacturingUser", "InventoryManager", "BusinessOwner"]
    },
    { 
      name: "Recipes", 
      path: "/recipes", 
      icon: Layers,
      roles: ["SuperAdmin", "StoreAdmin", "ManufacturingUser", "BusinessOwner"]
    },
    { 
      name: "Manufacturing", 
      path: "/manufacturing", 
      icon: Factory,
      roles: ["SuperAdmin", "StoreAdmin", "PurchaseUser", "ManufacturingUser", "InventoryManager", "BusinessOwner"]
    },
    { 
      name: "Vendors", 
      path: "/vendors", 
      icon: Users,
      roles: ["SuperAdmin", "StoreAdmin"]
    },
    { 
      name: "Audit Logs", 
      path: "/audit-logs", 
      icon: Activity,
      roles: ["SuperAdmin"]
    }
  ];

  // Filter items based on current role permissions
  const filteredNavItems = navigationItems.filter(item => item.roles.includes(currentRole));

  // Determine current page title
  const currentPath = location.pathname;
  const activeItem = navigationItems.find(item => item.path === currentPath);
  const pageTitle = activeItem ? activeItem.name : "Shiv Furniture Works";

  // Redirect if role changes and loses access to current page
  const handleRoleChange = (role) => {
    setCurrentRole(role);
    setShowRoleDropdown(false);
    
    // Check if new role has access to current path
    const targetItem = navigationItems.find(item => item.path === currentPath);
    if (targetItem && !targetItem.roles.includes(role)) {
      // Find the first page the new role has access to
      const fallbackItem = navigationItems.find(item => item.roles.includes(role));
      if (fallbackItem) {
        navigate(fallbackItem.path);
      }
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-textPrimary">
      {/* Sidebar */}
      <aside 
        className={`flex flex-col border-r border-border bg-card transition-all duration-150 relative ${
          isCollapsed ? 'w-16' : 'w-60'
        }`}
      >
        {/* Logo Section */}
        <div className="flex h-16 items-center justify-between border-b border-border px-4">
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="font-semibold tracking-wide text-sm">SHIV FURNITURE</span>
              <span className="text-[10px] text-textSecondary uppercase tracking-widest font-mono">ERP Works</span>
            </div>
          )}
          {isCollapsed && (
            <span className="mx-auto font-bold text-sm tracking-tighter">SF</span>
          )}
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden lg:flex h-6 w-6 items-center justify-center rounded-custom border border-border bg-elevated hover:bg-card text-textSecondary hover:text-textPrimary transition-all duration-150 absolute -right-3 top-5 z-10 shadow-lg"
          >
            {isCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-1 py-4">
          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);

            return (
              <button
                key={item.name}
                onClick={() => navigate(item.path)}
                className={`flex w-full items-center py-3 px-4 text-left transition-all duration-150 border-l-[3px] ${
                  isActive 
                    ? 'bg-accent/10 border-accent text-textPrimary' 
                    : 'text-textSecondary hover:bg-elevated/40 hover:text-textPrimary border-transparent'
                }`}
              >
                <Icon size={18} className={`${isActive ? 'text-textPrimary' : 'text-textSecondary'} shrink-0`} />
                {!isCollapsed && (
                  <span className="ml-3 text-sm font-medium tracking-wide">
                    {item.name}
                  </span>
                )}
              </button>
            );
          })}
        </nav>


      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="flex h-16 w-full items-center justify-between border-b border-border bg-card px-6">
          <div className="flex items-center space-x-4">
            <h1 className="text-lg font-semibold tracking-tight">{pageTitle}</h1>
          </div>

          {/* Global Search & Action Area */}
          <div className="flex items-center space-x-4">
            {/* Global Search Bar */}
            <div className="relative w-64">
              <Search className="absolute left-3 top-2.5 text-textMuted" size={14} />
              <input
                type="text"
                placeholder="Global search..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                className="w-full bg-background border border-border rounded-custom py-1.5 pl-9 pr-3 text-xs text-textPrimary placeholder:text-textMuted focus:outline-none focus:border-accent"
              />
            </div>
            
            {/* Theme Switcher Toggle */}
            <ThemeToggle />

            {/* Role Display */}
            <div 
              className="flex items-center space-x-2 bg-elevated border border-border rounded-custom px-3 py-1.5 text-xs text-textPrimary font-medium"
              title={`Current permissions bound to: ${roleDisplayNames[currentRole]}`}
            >
              <ShieldAlert size={14} className="text-textSecondary" />
              <span>{roleDisplayNames[currentRole]}</span>
            </div>

            {/* User Avatar & Logout */}
            <button
              onClick={() => {
                if (window.confirm("Sign out of Shiv Furniture Works ERP?")) {
                  logout();
                }
              }}
              title="Sign Out"
              className="h-8 w-8 rounded-full border border-border bg-elevated hover:bg-card flex items-center justify-center text-xs font-semibold text-textPrimary hover:text-danger transition-colors duration-150"
            >
              <User size={16} />
            </button>
          </div>
        </header>

        {/* Dashboard/Page Content */}
        <main className="flex-1 overflow-y-auto bg-background p-6">
          {children}
        </main>
      </div>
    </div>
  );
};
