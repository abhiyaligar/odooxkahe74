import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useErpStore } from './store/erpStore';
import { Layout } from './components/common/Layout';
import { ThemeProvider } from './components/common/ThemeProvider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Import Pages
import LoginPage from './pages/Login';
import SignupPage from './pages/Signup';
import LandingPage from './pages/Landing';
import CustomerPortal from './pages/CustomerPortal';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import SalesOrders from './pages/SalesOrders';
import PurchaseOrders from './pages/PurchaseOrders';
import Recipes from './pages/Recipes';
import Manufacturing from './pages/Manufacturing';
import Vendors from './pages/Vendors';
import AuditLogs from './pages/AuditLogs';
import Users from './pages/Users';

// Role-based root redirector
const RootRedirect = () => {
  const { currentRole } = useErpStore();
  
  if (currentRole === "Customer") {
    return <Navigate to="/portal" replace />;
  }
  if (["SuperAdmin", "StoreAdmin", "BusinessOwner"].includes(currentRole)) {
    return <Navigate to="/dashboard" replace />;
  }
  if (currentRole === "SalesUser") {
    return <Navigate to="/sales" replace />;
  }
  if (currentRole === "PurchaseUser") {
    return <Navigate to="/purchase" replace />;
  }
  return <Navigate to="/products" replace />;
};

// Route Guard for authenticated users
const RequireAuth = ({ children, allowedRoles }) => {
  const { isAuthenticated, currentRole } = useErpStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(currentRole)) {
    if (currentRole === "Customer") {
      return <Navigate to="/portal" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

// Route Guard for guests only (redirects to dashboard/portal if already logged in)
const RequireUnauth = ({ children }) => {
  const { isAuthenticated, currentRole } = useErpStore();

  if (isAuthenticated) {
    if (currentRole === "Customer") {
      return <Navigate to="/portal" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

function AppContent() {
  const { login } = useErpStore();
  const navigate = useNavigate();

  return (
    <Routes>
      {/* Public Landing Page */}
      <Route path="/" element={
        <LandingPage onNavigateToLogin={(target) => navigate(target === "signup" ? "/signup" : "/login")} />
      } />

      {/* Guest Only Routes */}
      <Route path="/login" element={
        <RequireUnauth>
          <LoginPage 
            onLogin={login} 
            onBack={() => navigate("/")} 
            onSignup={() => navigate("/signup")} 
          />
        </RequireUnauth>
      } />
      <Route path="/signup" element={
        <RequireUnauth>
          <SignupPage 
            onSignupSuccess={login} 
            onBackToLogin={() => navigate("/login")} 
            onBackToHome={() => navigate("/")} 
          />
        </RequireUnauth>
      } />

      {/* Customer Portal */}
      <Route path="/portal" element={
        <RequireAuth allowedRoles={["Customer"]}>
          <CustomerPortal />
        </RequireAuth>
      } />

      {/* Staff ERP Routes */}
      <Route path="/*" element={
        <RequireAuth allowedRoles={["SuperAdmin", "StoreAdmin", "BusinessOwner", "SalesUser", "PurchaseUser", "ManufacturingUser", "InventoryManager"]}>
          <Layout>
            <Routes>
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="products" element={<Products />} />
              <Route path="sales" element={<SalesOrders />} />
              <Route path="purchase" element={<PurchaseOrders />} />
              <Route path="recipes" element={<Recipes />} />
              <Route path="manufacturing" element={<Manufacturing />} />
              <Route path="vendors" element={
                <RequireAuth allowedRoles={["SuperAdmin", "StoreAdmin"]}>
                  <Vendors />
                </RequireAuth>
              } />
              <Route path="users" element={
                <RequireAuth allowedRoles={["SuperAdmin", "StoreAdmin"]}>
                  <Users />
                </RequireAuth>
              } />
              <Route path="audit-logs" element={
                <RequireAuth allowedRoles={["SuperAdmin", "StoreAdmin"]}>
                  <AuditLogs />
                </RequireAuth>
              } />
              <Route path="*" element={<RootRedirect />} />
            </Routes>
          </Layout>
        </RequireAuth>
      } />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
