import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useErpStore } from '../../store/erpStore';
import { ThemeToggle } from './ThemeToggle';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
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
  UserPlus,
  UserCheck,
  Activity,
  LogOut,
  Menu,
  X,
  Wallet,
  FileText
} from 'lucide-react';

export const Layout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentRole, setCurrentRole, globalSearch, setGlobalSearch, logout } = useErpStore();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => api.get('/auth/me')
  });

  // Role details mapping
  const roleDisplayNames = {
    SuperAdmin: "Super Admin",
    StoreAdmin: "Store Admin",
    UserAdmin: "User Admin",
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
    UserAdmin: "UA",
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
      name: "Customers",
      path: "/customers",
      icon: UserCheck,
      roles: ["SuperAdmin", "StoreAdmin"]
    },
    {
      name: "Users",
      path: "/users",
      icon: UserPlus,
      roles: ["SuperAdmin", "StoreAdmin", "UserAdmin"]
    },
    {
      name: "Audit Logs",
      path: "/audit-logs",
      icon: Activity,
      roles: ["SuperAdmin", "StoreAdmin"]
    },
    {
      name: "Wallet",
      path: "/wallet",
      icon: Wallet,
      roles: ["SuperAdmin", "StoreAdmin", "SalesUser", "PurchaseUser", "ManufacturingUser", "InventoryManager", "BusinessOwner", "Customer"]
    },
    {
      name: "Invoices",
      path: "/invoices",
      icon: FileText,
      roles: ["SuperAdmin", "StoreAdmin", "SalesUser", "PurchaseUser", "BusinessOwner"]
    }
  ];

  // Filter items based on current role permissions
  const filteredNavItems = navigationItems.filter(item => item.roles.includes(currentRole));

  // Determine current page title
  const currentPath = location.pathname;
  const activeItem = navigationItems.find(item => item.path === currentPath);
  const pageTitle = activeItem ? activeItem.name : "AutoCrafERP";

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-textPrimary">
      
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar - Desktop and Mobile (Drawer) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-border bg-card transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } ${isCollapsed ? 'lg:w-16' : 'lg:w-60'}`}
      >
        {/* Logo Section */}
        <div className="flex h-16 items-center justify-between border-b border-border px-4 relative">
          {(!isCollapsed || isMobileMenuOpen) ? (
            <div className="flex flex-col">
              <span className="font-semibold tracking-wide text-sm">AUTOCRAFTERP</span>
              <span className="text-[10px] text-textSecondary uppercase tracking-widest font-mono">Platform</span>
            </div>
          ) : (
            <span className="mx-auto font-bold text-sm tracking-tighter">AC</span>
          )}

          {/* Close button for mobile menu */}
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="p-1 rounded-custom hover:bg-elevated/80 text-textSecondary hover:text-textPrimary lg:hidden"
            title="Close Menu"
          >
            <X size={18} />
          </button>

          {/* Collapse toggle for desktop */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden lg:flex h-6 w-6 items-center justify-center rounded-custom border border-border bg-elevated hover:bg-card text-textSecondary hover:text-textPrimary transition-all duration-150 absolute -right-3 top-5 z-10 shadow-lg"
          >
            {isCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-1 py-4 overflow-y-auto">
          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);

            return (
              <button
                key={item.name}
                onClick={() => {
                  navigate(item.path);
                  setIsMobileMenuOpen(false); // Auto close mobile drawer on navigate
                }}
                className={`flex w-full items-center py-3 px-4 text-left transition-all duration-150 border-l-[3px] ${isActive
                    ? 'bg-accent/10 border-accent text-textPrimary'
                    : 'text-textSecondary hover:bg-elevated/40 hover:text-textPrimary border-transparent'
                  }`}
              >
                <Icon size={18} className={`${isActive ? 'text-textPrimary' : 'text-textSecondary'} shrink-0`} />
                {(!isCollapsed || isMobileMenuOpen) && (
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
        <header className="flex h-16 w-full items-center justify-between border-b border-border bg-card px-4 sm:px-6 shrink-0">
          
          {/* Mobile hamburger menu trigger + Title */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-1.5 rounded-custom border border-border bg-elevated text-textSecondary hover:text-textPrimary lg:hidden shrink-0"
              title="Open Menu"
            >
              <Menu size={18} />
            </button>
            <h1 className="text-sm sm:text-lg font-semibold tracking-tight truncate max-w-[120px] sm:max-w-none">
              {pageTitle}
            </h1>
          </div>

          {/* Header Action Items */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            
            {/* Global Search - Hidden on small mobile screens */}
            <div className="relative w-36 sm:w-64 hidden md:block">
              <Search className="absolute left-3 top-2.5 text-textMuted" size={14} />
              <input
                type="text"
                placeholder="Global search..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                className="w-full bg-background border border-border rounded-custom py-1.5 pl-9 pr-3 text-xs text-textPrimary placeholder:text-textMuted focus:outline-none focus:border-accent"
              />
            </div>

            {/* Theme Toggle Button */}
            <ThemeToggle />

            {/* Role Display Tag */}
            <div
              className="flex items-center space-x-1.5 bg-elevated border border-border rounded-custom px-2.5 py-1.5 text-xs text-textPrimary font-medium shrink-0"
              title={`Current permissions bound to: ${roleDisplayNames[currentRole]}`}
            >
              <ShieldAlert size={14} className="text-textSecondary" />
              <span className="hidden sm:inline">{roleDisplayNames[currentRole]}</span>
              <span className="sm:hidden">{roleInitials[currentRole]}</span>
            </div>

            {/* User Avatar linking to Profile */}
            <button
              onClick={() => navigate('/profile')}
              title="My Profile"
              className="h-8 w-8 rounded-full border border-border bg-elevated hover:bg-card flex items-center justify-center text-xs font-semibold text-textPrimary transition-all duration-150 overflow-hidden shrink-0"
            >
              {currentUser?.avatar_url ? (
                <img 
                  src={currentUser.avatar_url} 
                  alt="Avatar" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <User size={16} />
              )}
            </button>

            {/* Sign Out Button */}
            <button
              onClick={() => {
                if (window.confirm("Sign out of AutoCrafERP?")) {
                  logout();
                }
              }}
              title="Sign Out"
              className="p-1.5 rounded-custom border border-border bg-elevated hover:bg-card flex items-center justify-center text-textSecondary hover:text-danger transition-colors duration-150 shrink-0"
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>

        {/* Dynamic Page Component Render */}
        <main className="flex-1 overflow-y-auto bg-background p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};
