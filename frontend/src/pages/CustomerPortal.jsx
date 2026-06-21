import React, { useState } from 'react';
import { useErpStore } from '../store/erpStore';
import { ThemeToggle } from '../components/common/ThemeToggle';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import Profile from './Profile';
import { OrderTrackingStepper } from '../components/common/OrderTrackingStepper';
import {
  ShoppingBag,
  ShoppingCart,
  User,
  ChevronRight,
  Check,
  Search,
  Plus,
  Minus,
  Trash2,
  Clock,
  MapPin,
  Truck,
  ArrowLeft,
  Loader2,
  LogOut,
  Settings,
  Shield,
  Mail,
  Calendar
} from 'lucide-react';

export default function CustomerPortal() {
  const queryClient = useQueryClient();
  const {
    currentRole,
    setCurrentRole,
    logout
  } = useErpStore();

  // Fetch data
  const { data: products = [], isLoading: isLoadingProducts } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.get('/products/')
  });

  const { data: salesOrders = [], isLoading: isLoadingOrders } = useQuery({
    queryKey: ['salesOrders'],
    queryFn: () => api.get('/sales-orders/')
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => api.get('/customers/')
  });

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => api.get('/auth/me')
  });

  // Navigation state
  const [currentTab, setCurrentTab] = useState("catalog"); // catalog, detail, cart, orders, track, profile
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Profile edit state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editProfileName, setEditProfileName] = useState("");

  React.useEffect(() => {
    if (currentUser?.name && !isEditingProfile) {
      setEditProfileName(currentUser.name);
    }
  }, [currentUser, isEditingProfile]);

  // Shopping Cart state
  const [cart, setCart] = useState([]);

  // Catalog filter states
  const [searchQuery, setSearchQuery] = useState("");

  // Checkout Form states
  const [customerName, setCustomerName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");


  // Determine a customer ID to use for the portal
  const customerId = currentUser?.customer_profile?.id || null;

  React.useEffect(() => {
    if (currentUser?.customer_profile) {
      setCustomerName(currentUser.customer_profile.name || "");
      setPhone(currentUser.customer_profile.phone || "");
      setAddress(currentUser.customer_profile.address || "");
    }
  }, [currentUser]);

  const createSalesOrderMutation = useMutation({
    mutationFn: (newOrder) => api.post('/sales-orders/', newOrder),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['salesOrders'] });
      setCart([]);
      setSelectedOrder(data);
      setCurrentTab("track");
    },
    onError: (err) => alert("Failed to create order: " + err.message)
  });

  // SVG representation for products to replace placeholders
  const renderProductSvg = (name, className = "w-16 h-16 text-textSecondary") => {
    if (name.toLowerCase().includes("chair")) {
      return (
        <svg className={className} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M24 16h16v16H24z" fill="currentColor" fillOpacity="0.05" />
          <path d="M20 32h24v4H20z" fill="currentColor" fillOpacity="0.1" />
          <line x1="32" y1="36" x2="32" y2="46" />
          <line x1="20" y1="50" x2="44" y2="50" />
          <line x1="32" y1="46" x2="20" y2="50" />
          <line x1="32" y1="46" x2="44" y2="50" />
          <circle cx="20" cy="50" r="1.5" fill="currentColor" />
          <circle cx="44" cy="50" r="1.5" fill="currentColor" />
          <circle cx="32" cy="50" r="1.5" fill="currentColor" />
        </svg>
      );
    }
    // Default to table
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 26 32 16 52 26 32 36" fill="currentColor" fillOpacity="0.05" />
        <line x1="16" y1="28" x2="16" y2="48" />
        <line x1="32" y1="36" x2="32" y2="52" />
        <line x1="48" y1="28" x2="48" y2="48" />
        <polyline points="16 28 32 36 48 28" />
      </svg>
    );
  };

  // Filter products to show only finished goods
  const finishedGoods = products.filter(p => p.type === "FinishedGood");

  const filteredCatalog = finishedGoods.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter sales orders for customer
  const customerOrders = customerId ? salesOrders.filter(so => so.customer_id === customerId) : [];

  // Status mapping: internal -> customer friendly
  const customerStatusLabels = {
    Draft: "Order Placed",
    Confirmed: "Preparing",
    PartiallyDelivered: "Out for Delivery",
    FullyDelivered: "Delivered",
    Cancelled: "Cancelled"
  };

  const customerStatusColors = {
    Draft: "border-border text-textSecondary bg-elevated/30",
    Confirmed: "border-warning/40 text-warning bg-warning/5",
    PartiallyDelivered: "border-warning/40 text-warning bg-warning/5",
    FullyDelivered: "border-success/40 text-success bg-success/5",
    Cancelled: "border-danger/40 text-danger bg-danger/5"
  };

  // Cart operations
  const addToCart = (product, quantity) => {
    const qty = Number(quantity);
    const existing = cart.find(item => item.product.id === product.id);
    if (existing) {
      setCart(cart.map(item =>
        item.product.id === product.id ? { ...item, quantity: item.quantity + qty } : item
      ));
    } else {
      setCart([...cart, { product, quantity: qty }]);
    }
  };

  const updateCartQty = (productId, diff) => {
    setCart(cart.map(item => {
      if (item.product.id === productId) {
        const nextQty = item.quantity + diff;
        return nextQty > 0 ? { ...item, quantity: nextQty } : item;
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter(item => item.product.id !== productId));
  };

  const getCartTotal = () => {
    return cart.reduce((sum, item) => sum + ((item.product.sales_price || 0) * item.quantity), 0);
  };

  const getCartItemCount = () => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  };

  const handleCheckoutSubmit = (e) => {
    e.preventDefault();
    if (cart.length === 0 || !customerId) {
      if (!customerId) alert("No customer available in the system. Create a customer in the ERP first.");
      return;
    }

    // Construct lines
    const lines = cart.map(item => ({
      product_id: item.product.id,
      quantity_ordered: item.quantity
    }));

    // Expect delivery 3 days from now
    const deliveryPromise = new Date();
    deliveryPromise.setDate(deliveryPromise.getDate() + 3);

    createSalesOrderMutation.mutate({
      customer_id: customerId,
      expected_delivery_date: deliveryPromise.toISOString(),
      lines: lines
    });
  };

  // Track page horizontal stepper stages (extracted to OrderTrackingStepper component)
  return (
    <div className="min-h-screen bg-background text-textPrimary flex flex-col font-sans select-none antialiased">
      {/* Customer Navbar */}
      <header className="flex h-16 w-full items-center justify-between border-b border-border bg-card px-6 shrink-0">
        {/* Brand Left */}
        <div className="flex items-center space-x-2 cursor-pointer" onClick={() => setCurrentTab("catalog")}>
          <div className="h-7 w-7 rounded bg-accent text-background flex items-center justify-center font-black text-xs tracking-tighter">
            AC
          </div>
          <span className="font-semibold text-sm tracking-wide text-textPrimary uppercase">AutoCrafERP Store</span>
        </div>

        {/* Center Links */}
        <nav className="hidden md:flex items-center space-x-6 text-xs font-semibold tracking-wide uppercase">
          <button
            onClick={() => setCurrentTab("catalog")}
            className={`transition-colors duration-150 ${currentTab === "catalog" || currentTab === "detail" ? 'text-textPrimary' : 'text-textSecondary hover:text-textPrimary'}`}
          >
            Catalog
          </button>
          <button
            onClick={() => setCurrentTab("orders")}
            className={`transition-colors duration-150 ${currentTab === "orders" || currentTab === "track" ? 'text-textPrimary' : 'text-textSecondary hover:text-textPrimary'}`}
          >
            My Orders
          </button>
        </nav>

        {/* Right Actions */}
        <div className="flex items-center space-x-4">

          {/* Theme Switcher Toggle */}
          <ThemeToggle />

          {/* Cart Icon Link */}
          <button
            onClick={() => setCurrentTab("cart")}
            className="relative p-1.5 rounded-custom border border-border hover:bg-elevated/40 transition-colors"
          >
            <ShoppingCart size={16} className="text-textSecondary hover:text-textPrimary" />
            {getCartItemCount() > 0 && (
              <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-accent text-background text-[9px] font-bold flex items-center justify-center font-mono">
                {getCartItemCount()}
              </span>
            )}
          </button>

          {/* User Avatar & Dropdown */}
          <div className="relative border-l border-border pl-4 ml-2">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="h-8 w-8 rounded-full border border-border bg-elevated hover:bg-card flex items-center justify-center overflow-hidden text-xs font-semibold text-textPrimary transition-colors duration-150"
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

            {showUserMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowUserMenu(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-48 bg-card border border-border rounded-[8px] shadow-lg overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        setCurrentTab('profile');
                      }}
                      className="flex w-full items-center px-4 py-2 text-sm text-textPrimary hover:bg-elevated transition-colors"
                    >
                      <Settings size={14} className="mr-2 text-textSecondary" />
                      My Profile
                    </button>
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        if (window.confirm("Sign out of AutoCrafERP Customer Portal?")) {
                          logout();
                        }
                      }}
                      className="flex w-full items-center px-4 py-2 text-sm text-danger hover:bg-danger/10 transition-colors"
                    >
                      <LogOut size={14} className="mr-2" />
                      Sign Out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

        </div>
      </header>

      {/* Body Viewport */}
      <main className="flex-1 overflow-y-auto max-w-6xl w-full mx-auto p-6 md:p-8 space-y-6">

        {/* VIEW 1: CATALOG GRID */}
        {(currentTab === "catalog") && (
          <div className="space-y-6">
            <div className="space-y-1">
              <h2 className="text-xl font-bold tracking-tight">Our Premium Collections</h2>
              <p className="text-xs text-textSecondary">Handcrafted, high-durability timber and steel furniture built for elegant spaces.</p>
            </div>

            {/* Catalog Filter Bar */}
            <div className="flex items-center w-full md:w-80 relative">
              <Search className="absolute left-3 text-textMuted" size={14} />
              <input
                type="text"
                placeholder="Search collection..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 bg-card border border-border rounded-custom text-xs py-2 focus:border-accent"
              />
            </div>

            {/* Products Grid */}
            {isLoadingProducts ? (
              <div className="flex flex-col items-center justify-center py-12 text-textMuted">
                <Loader2 className="animate-spin mb-4" size={32} />
                <p className="text-sm font-mono">Loading catalog...</p>
              </div>
            ) : filteredCatalog.length === 0 ? (
              <div className="border border-border bg-card rounded-[8px] p-8 text-center">
                <p className="text-xs text-textSecondary">No products available in the catalog yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCatalog.map(p => {
                  const isMTO = p.procurement_strategy === "MTO";
                  return (
                    <div
                      key={p.id}
                      className="bg-card border border-border rounded-[8px] p-5 flex flex-col space-y-4 hover:border-textSecondary transition-all duration-150"
                    >
                      {/* Product Vector Image */}
                      <div
                        onClick={() => {
                          setSelectedProduct(p);
                          setCurrentTab("detail");
                        }}
                        className="aspect-video w-full bg-elevated border border-border rounded-custom flex items-center justify-center cursor-pointer hover:bg-elevated/80 transition-colors"
                      >
                        {renderProductSvg(p.name, "w-12 h-12 text-textSecondary")}
                      </div>

                      <div className="space-y-1 flex-1">
                        <div className="flex items-start justify-between">
                          <h3
                            onClick={() => {
                              setSelectedProduct(p);
                              setCurrentTab("detail");
                            }}
                            className="font-bold text-sm text-textPrimary hover:underline cursor-pointer"
                          >
                            {p.name}
                          </h3>
                          <span className="text-sm font-extrabold font-mono text-textPrimary">${(p.sales_price || 0).toFixed(2)}</span>
                        </div>
                        <p className="text-[11px] text-textSecondary line-clamp-2 leading-relaxed">
                          Handcrafted solid construction, styled with minimal geometries. Fits beautifully in modern offices and dining halls.
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <span className={`inline-block text-[9px] font-bold uppercase rounded px-2 py-0.5 tracking-wider border font-mono ${isMTO ? 'border-warning/40 text-warning bg-warning/5' : 'border-success/40 text-success bg-success/5'
                          }`}>
                          {isMTO ? "Built to Order" : "In Stock"}
                        </span>

                        {cart.find(item => item.product.id === p.id) ? (
                          <div className="flex items-center space-x-2 bg-background border border-border rounded-custom p-0.5">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); updateCartQty(p.id, -1); }}
                              className="p-1 text-textSecondary hover:text-textPrimary"
                            >
                              <Minus size={10} />
                            </button>
                            <span className="w-8 text-center font-mono font-bold text-xs">{cart.find(item => item.product.id === p.id).quantity}</span>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); updateCartQty(p.id, 1); }}
                              className="p-1 text-textSecondary hover:text-textPrimary"
                            >
                              <Plus size={10} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); addToCart(p, 1); }}
                            className="bg-accent hover:bg-accent/90 text-background text-xs font-bold px-3 py-1.5 rounded-custom transition-colors duration-150"
                          >
                            Add to Order
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: PRODUCT DETAIL */}
        {currentTab === "detail" && selectedProduct && (
          <div className="space-y-6">
            <button
              onClick={() => setCurrentTab("catalog")}
              className="flex items-center space-x-2 text-xs text-textSecondary hover:text-textPrimary transition-colors"
            >
              <ArrowLeft size={14} />
              <span>Back to Catalog</span>
            </button>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
              {/* Image Box */}
              <div className="aspect-square w-full bg-card border border-border rounded-[8px] flex items-center justify-center">
                {renderProductSvg(selectedProduct.name, "w-32 h-32 text-textPrimary")}
              </div>

              {/* Product Info details */}
              <div className="space-y-6">
                <div className="space-y-2 border-b border-border pb-4">
                  <h2 className="text-2xl font-bold tracking-tight">{selectedProduct.name}</h2>
                  <div className="flex items-center space-x-4">
                    <span className="text-xl font-extrabold font-mono text-accent">${(selectedProduct.sales_price || 0).toFixed(2)}</span>

                    {/* User Friendly Stock Message */}
                    <span className="flex items-center text-xs space-x-1">
                      {selectedProduct.procurement_strategy === "MTS" ? (
                        <>
                          <span className="h-1.5 w-1.5 rounded-full bg-success" />
                          <span className="text-success font-medium">✓ Ready to ship</span>
                        </>
                      ) : (
                        <>
                          <span className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse" />
                          <span className="text-warning font-medium">Built to order — estimated delivery in 5 days</span>
                        </>
                      )}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-textSecondary uppercase tracking-wider">Description</span>
                  <p className="text-xs text-textSecondary leading-relaxed">
                    Designed for heavy-duty commercial and residential environments. Constructed from premium seasoned oak timber paired with high-tensile fasteners to ensure long-lasting structural rigidity. Built with flat non-decorative edges for a sleek modern architectural footprint.
                  </p>
                </div>

                <div className="pt-4 flex items-center space-x-4">
                  {cart.find(item => item.product.id === selectedProduct.id) ? (
                    <div className="flex-1 flex items-center justify-center space-x-4 bg-background border border-border rounded-custom p-1.5 py-2">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); updateCartQty(selectedProduct.id, -1); }}
                        className="p-2 bg-elevated rounded-custom text-textSecondary hover:text-textPrimary hover:bg-card transition-colors"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-12 text-center font-mono font-bold text-sm">{cart.find(item => item.product.id === selectedProduct.id).quantity}</span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); updateCartQty(selectedProduct.id, 1); }}
                        className="p-2 bg-elevated rounded-custom text-textSecondary hover:text-textPrimary hover:bg-card transition-colors"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        addToCart(selectedProduct, 1);
                      }}
                      className="flex-1 bg-accent hover:bg-accent/90 text-background font-bold text-xs py-3 rounded-custom transition-all duration-150 text-center"
                    >
                      Add to Order
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 3: CART / CHECKOUT */}
        {currentTab === "cart" && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold tracking-tight">Your Order Cart</h2>

            {cart.length === 0 ? (
              <div className="border border-border bg-card rounded-[8px] p-8 text-center space-y-4">
                <p className="text-xs text-textSecondary">Your shopping cart is empty. Browse our catalog to select custom-built furniture.</p>
                <button
                  onClick={() => setCurrentTab("catalog")}
                  className="bg-accent text-background text-xs font-bold py-2 px-6 rounded-custom hover:bg-accent/90 transition-all"
                >
                  Browse Catalog
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

                {/* Cart Line Items */}
                <div className="lg:col-span-2 border border-border bg-card rounded-[8px] divide-y divide-border overflow-hidden">
                  {cart.map(item => (
                    <div key={item.product.id} className="p-4 flex items-center justify-between text-xs">
                      <div className="space-y-1">
                        <span className="font-bold text-textPrimary">{item.product.name}</span>
                        <span className="text-[10px] text-textSecondary font-mono block">${(item.product.sales_price || 0).toFixed(2)} / unit</span>
                      </div>

                      <div className="flex items-center space-x-4">
                        {/* Qty selectors */}
                        <div className="flex items-center space-x-2 bg-background border border-border rounded-custom p-0.5">
                          <button
                            type="button"
                            onClick={() => updateCartQty(item.product.id, -1)}
                            className="p-1 text-textSecondary hover:text-textPrimary"
                          >
                            <Minus size={10} />
                          </button>
                          <span className="w-8 text-center font-mono font-bold text-xs">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateCartQty(item.product.id, 1)}
                            className="p-1 text-textSecondary hover:text-textPrimary"
                          >
                            <Plus size={10} />
                          </button>
                        </div>

                        {/* Subtotal */}
                        <span className="font-mono font-bold text-textPrimary w-20 text-right">
                          ${((item.product.sales_price || 0) * item.quantity).toFixed(2)}
                        </span>

                        {/* Remove */}
                        <button
                          onClick={() => removeFromCart(item.product.id)}
                          className="text-textMuted hover:text-danger p-1 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Checkout form and summary */}
                <div className="space-y-4">
                  {/* Summary Card */}
                  <div className="bg-card border border-border rounded-[8px] p-5 space-y-4">
                    <span className="text-[10px] font-bold text-textSecondary uppercase tracking-wider block">Order Summary</span>
                    <div className="divide-y divide-border text-xs">
                      <div className="py-2 flex items-center justify-between font-mono">
                        <span className="text-textSecondary">Subtotal</span>
                        <span>${getCartTotal().toFixed(2)}</span>
                      </div>
                      <div className="py-3 flex items-center justify-between font-mono text-sm font-bold">
                        <span className="text-textPrimary">Order Total</span>
                        <span className="text-accent">${getCartTotal().toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Delivery address form */}
                  <form onSubmit={handleCheckoutSubmit} className="bg-card border border-border rounded-[8px] p-5 space-y-4">
                    <span className="text-[10px] font-bold text-textSecondary uppercase tracking-wider block">Shipping Information</span>

                    <div className="flex flex-col space-y-1">
                      <span className="text-[10px] text-textSecondary font-semibold">Contact Customer</span>
                      <input
                        type="text"
                        required
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="bg-background text-xs py-2"
                        disabled={createSalesOrderMutation.isPending}
                      />
                    </div>

                    <div className="flex flex-col space-y-1">
                      <span className="text-[10px] text-textSecondary font-semibold">Shipping Address</span>
                      <textarea
                        required
                        rows="2"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        disabled={createSalesOrderMutation.isPending}
                        className="bg-background border border-border rounded-custom text-textPrimary px-3 py-1.5 text-xs focus:outline-none focus:border-accent resize-none transition-colors"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={createSalesOrderMutation.isPending}
                      className="w-full bg-accent hover:bg-accent/90 text-background font-bold text-xs py-2.5 rounded-custom transition-all duration-150 disabled:opacity-50"
                    >
                      {createSalesOrderMutation.isPending ? 'Processing...' : 'Place Order'}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW 4: MY ORDERS LIST */}
        {currentTab === "orders" && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold tracking-tight">Your Order History</h2>

            {isLoadingOrders ? (
              <div className="flex flex-col items-center justify-center py-12 text-textMuted">
                <Loader2 className="animate-spin mb-4" size={32} />
                <p className="text-sm font-mono">Loading your orders...</p>
              </div>
            ) : customerOrders.length === 0 ? (
              <div className="border border-border bg-card rounded-[8px] p-8 text-center space-y-4">
                <p className="text-xs text-textSecondary">You haven't placed any orders yet.</p>
                <button
                  onClick={() => setCurrentTab("catalog")}
                  className="bg-accent text-background text-xs font-bold py-2 px-6 rounded-custom hover:bg-accent/90 transition-all"
                >
                  Browse Catalog
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {customerOrders.map(order => {
                  const itemLines = order.lines || [];
                  const count = itemLines.reduce((sum, l) => sum + l.quantity_ordered, 0);
                  const total = itemLines.reduce((sum, l) => sum + (l.quantity_ordered * (l.unit_price || 0)), 0);

                  return (
                    <div
                      key={order.id}
                      onClick={() => {
                        setSelectedOrder(order);
                        setCurrentTab("track");
                      }}
                      className="bg-card border border-border rounded-[8px] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:border-textSecondary transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2 text-xs font-mono font-bold text-textPrimary">
                          <span>{order.order_number}</span>
                          <span className="text-[10px] text-textMuted font-normal">{new Date(order.created_at).toLocaleDateString()}</span>
                        </div>
                        <p className="text-[11px] text-textSecondary">
                          Order contains {count} item(s) • Total price: ${total.toFixed(2)}
                        </p>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                        {/* Friendly Status Badge */}
                        <span className={`inline-block text-[9px] font-mono font-bold uppercase rounded-full px-2.5 py-0.5 tracking-wider border ${customerStatusColors[order.status] || ''
                          }`}>
                          {customerStatusLabels[order.status] || order.status}
                        </span>
                        <ChevronRight size={16} className="text-textSecondary" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* VIEW 5: ORDER TRACKING DETAIL */}
        {currentTab === "track" && selectedOrder && (
          <div className="space-y-6">
            <button
              onClick={() => setCurrentTab("orders")}
              className="flex items-center space-x-2 text-xs text-textSecondary hover:text-textPrimary transition-colors"
            >
              <ArrowLeft size={14} />
              <span>Back to Orders</span>
            </button>

            <div className="space-y-6">

              {/* Stepper */}
              <OrderTrackingStepper status={selectedOrder.status} />

              {/* Friendly status banner */}
              <div className="bg-card border border-border rounded-[8px] p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold tracking-tight text-textPrimary">
                    Order Status: {customerStatusLabels[selectedOrder.status] || selectedOrder.status}
                  </h3>
                  <span className="text-[10px] font-mono text-textSecondary">Expected Delivery: {selectedOrder.expected_delivery_date ? new Date(selectedOrder.expected_delivery_date).toLocaleDateString() : 'Pending'}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans text-textSecondary leading-relaxed">
                  <div className="flex items-start space-x-2">
                    <MapPin size={14} className="text-textMuted shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[10px] font-bold text-textSecondary uppercase tracking-wider block">Shipping Address</span>
                      <span>{address}</span>
                    </div>
                  </div>

                  <div className="flex items-start space-x-2">
                    <Truck size={14} className="text-textMuted shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[10px] font-bold text-textSecondary uppercase tracking-wider block">Fulfillment Agent</span>
                      <span>AutoCrafERP Logistics</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Order Lines */}
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-textSecondary block">Your Purchased Items</span>
                <div className="border border-border bg-card rounded-[8px] overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-elevated/40 border-b border-border text-[10px] font-semibold text-textSecondary uppercase tracking-wider">
                        <th className="py-2.5 px-3">Item</th>
                        <th className="py-2.5 px-3 text-right">Qty</th>
                        <th className="py-2.5 px-3 text-right font-mono">Price</th>
                        <th className="py-2.5 px-3 text-right font-mono">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedOrder.lines || []).map(line => {
                        const prod = products.find(p => p.id === line.product_id);
                        return (
                          <tr key={line.id} className="border-b border-border/40 last:border-0 hover:bg-elevated/10 transition-colors">
                            <td className="py-2 px-3 text-textPrimary font-semibold">{prod?.name || 'Unknown Item'}</td>
                            <td className="py-2 px-3 text-right text-textSecondary font-mono">{line.quantity_ordered}</td>
                            <td className="py-2 px-3 text-right text-textSecondary font-mono">${(line.unit_price || 0).toFixed(2)}</td>
                            <td className="py-2 px-3 text-right text-textPrimary font-bold font-mono">
                              ${(line.quantity_ordered * (line.unit_price || 0)).toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* VIEW 6: PROFILE */}
        {currentTab === "profile" && (
          <Profile />
        )}
      </main>
    </div>
  );
}
