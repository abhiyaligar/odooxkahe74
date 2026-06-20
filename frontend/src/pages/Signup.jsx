import React, { useState } from 'react';
import { Eye, EyeOff, Check, Loader2, ShoppingBag, Store, AlertCircle } from 'lucide-react';

export default function SignupPage({ onSignupSuccess, onBackToLogin, onBackToHome }) {
  const [role, setRole] = useState(null); // 'Customer' or 'StoreAdmin'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Conditional fields state
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [staffRole, setStaffRole] = useState('Admin'); // default for StoreAdmin
  const [inviteCode, setInviteCode] = useState('');

  const handleRoleSelect = (selectedRole) => {
    if (isLoading) return;
    setRole(selectedRole);
    setErrors({});
  };

  const validateForm = () => {
    const newErrors = {};
    if (!name) newErrors.name = 'Full Name is required';
    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!email.includes('@')) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (role === 'Customer') {
      if (!phone) newErrors.phone = 'Phone number is required';
      if (!address) newErrors.address = 'Delivery address is required';
    }

    if (role === 'StoreAdmin') {
      if (!inviteCode) newErrors.inviteCode = 'Invite code is required';
      else if (inviteCode !== 'SHIV2026') {
        newErrors.inviteCode = 'Invalid invite code. Try: SHIV2026';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isLoading || !role || !agreeTerms) return;

    if (!validateForm()) return;

    setIsLoading(true);
    
    // Simulate API registration delay
    setTimeout(() => {
      setIsLoading(false);
      
      // Determine actual system role: Customer or staff role selected in dropdown
      const finalRole = role === 'Customer' ? 'Customer' : staffRole === 'Admin' ? 'StoreAdmin' : staffRole;
      
      onSignupSuccess(finalRole);
    }, 1200);
  };

  return (
    <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-background p-4 select-none">
      
      {/* Main Signup Card */}
      <div className="w-full max-w-[440px] bg-card border border-border rounded-custom p-8 shadow-[0_4px_16px_rgba(0,0,0,0.5)] flex flex-col space-y-6">
        
        {/* Back Button */}
        {onBackToHome && (
          <button 
            type="button"
            onClick={onBackToHome}
            className="self-start text-[10px] font-bold text-textSecondary hover:text-textPrimary tracking-wide uppercase transition-colors duration-150"
          >
            &larr; Back to Home
          </button>
        )}

        {/* Brand Header */}
        <div className="text-center space-y-1">
          <div className="inline-flex h-8 w-8 items-center justify-center rounded bg-accent text-background font-black text-sm tracking-tighter">
            SF
          </div>
          <h2 className="text-md font-bold tracking-tight text-textPrimary mt-2 font-sans">Shiv Furniture Works</h2>
          <p className="text-[10px] uppercase tracking-widest text-textSecondary font-semibold">Create your account</p>
        </div>

        {/* Role Selection Cards */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-textSecondary uppercase tracking-wider block">Account Type</label>
          <div className="grid grid-cols-2 gap-3">
            {/* Customer option */}
            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleRoleSelect('Customer')}
              className={`p-4 border rounded-custom flex flex-col items-center text-center space-y-2 transition-all duration-150 ${
                role === 'Customer'
                  ? 'border-accent bg-elevated/40 text-textPrimary shadow-lg'
                  : 'border-border bg-background hover:bg-elevated/20 text-textSecondary hover:text-textPrimary'
              }`}
            >
              <ShoppingBag size={20} className={role === 'Customer' ? 'text-textPrimary' : 'text-textSecondary'} />
              <div className="space-y-0.5">
                <span className="text-xs font-bold block">Customer</span>
                <span className="text-[9px] text-textMuted font-medium block">Order furniture</span>
              </div>
            </button>

            {/* Store Admin option */}
            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleRoleSelect('StoreAdmin')}
              className={`p-4 border rounded-custom flex flex-col items-center text-center space-y-2 transition-all duration-150 ${
                role === 'StoreAdmin'
                  ? 'border-accent bg-elevated/40 text-textPrimary shadow-lg'
                  : 'border-border bg-background hover:bg-elevated/20 text-textSecondary hover:text-textPrimary'
              }`}
            >
              <Store size={20} className={role === 'StoreAdmin' ? 'text-textPrimary' : 'text-textSecondary'} />
              <div className="space-y-0.5">
                <span className="text-xs font-bold block">Store Admin</span>
                <span className="text-[9px] text-textMuted font-medium block">Manage ERP ops</span>
              </div>
            </button>
          </div>
        </div>

        {/* Dynamic Form Render */}
        {!role ? (
          <div className="bg-card border border-border border-dashed p-6 rounded-custom text-center text-xs text-textMuted">
            Select an account type to continue
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 animate-all-custom transition-all duration-150">
            
            {/* Shared Field: Full Name */}
            <div className="flex flex-col space-y-1">
              <label className="text-[10px] font-bold text-textSecondary uppercase tracking-wider">Full Name</label>
              <input
                type="text"
                placeholder="e.g. Vikas Kumar"
                disabled={isLoading}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`w-full bg-card border text-xs py-2 ${
                  errors.name ? 'border-statusRed focus:border-statusRed' : 'border-border focus:border-accent'
                }`}
                required
              />
              {errors.name && <span className="text-[9px] text-statusRed font-mono">{errors.name}</span>}
            </div>

            {/* Shared Field: Email */}
            <div className="flex flex-col space-y-1">
              <label className="text-[10px] font-bold text-textSecondary uppercase tracking-wider">Email Address</label>
              <input
                type="email"
                placeholder="e.g. vikas@example.com"
                disabled={isLoading}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full bg-card border text-xs py-2 ${
                  errors.email ? 'border-statusRed focus:border-statusRed' : 'border-border focus:border-accent'
                }`}
                required
              />
              {errors.email && <span className="text-[9px] text-statusRed font-mono">{errors.email}</span>}
            </div>

            {/* Passwords row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Password */}
              <div className="flex flex-col space-y-1">
                <label className="text-[10px] font-bold text-textSecondary uppercase tracking-wider">Password</label>
                <div className="relative w-full">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Min 6 chars"
                    disabled={isLoading}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`w-full bg-card border text-xs py-2 pr-8 ${
                      errors.password ? 'border-statusRed focus:border-statusRed' : 'border-border focus:border-accent'
                    }`}
                    required
                  />
                  <button
                    type="button"
                    tabIndex="-1"
                    disabled={isLoading}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-2 text-textSecondary hover:text-textPrimary"
                  >
                    {showPassword ? <EyeOff size={12} /> : <Eye size={12} />}
                  </button>
                </div>
                {errors.password && <span className="text-[9px] text-statusRed font-mono">{errors.password}</span>}
              </div>

              {/* Confirm Password */}
              <div className="flex flex-col space-y-1">
                <label className="text-[10px] font-bold text-textSecondary uppercase tracking-wider">Confirm</label>
                <div className="relative w-full">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Repeat password"
                    disabled={isLoading}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`w-full bg-card border text-xs py-2 pr-8 ${
                      errors.confirmPassword ? 'border-statusRed focus:border-statusRed' : 'border-border focus:border-accent'
                    }`}
                    required
                  />
                  <button
                    type="button"
                    tabIndex="-1"
                    disabled={isLoading}
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2 top-2 text-textSecondary hover:text-textPrimary"
                  >
                    {showConfirmPassword ? <EyeOff size={12} /> : <Eye size={12} />}
                  </button>
                </div>
                {errors.confirmPassword && <span className="text-[9px] text-statusRed font-mono">{errors.confirmPassword}</span>}
              </div>
            </div>

            {/* CONDITIONAL FIELDS: CUSTOMER */}
            {role === 'Customer' && (
              <div className="space-y-4 pt-1">
                {/* Phone */}
                <div className="flex flex-col space-y-1">
                  <label className="text-[10px] font-bold text-textSecondary uppercase tracking-wider">Phone Number</label>
                  <input
                    type="tel"
                    placeholder="e.g. 555-0100"
                    disabled={isLoading}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={`w-full bg-card border text-xs py-2 ${
                      errors.phone ? 'border-statusRed focus:border-statusRed' : 'border-border focus:border-accent'
                    }`}
                    required
                  />
                  {errors.phone && <span className="text-[9px] text-statusRed font-mono">{errors.phone}</span>}
                </div>

                {/* Delivery Address */}
                <div className="flex flex-col space-y-1">
                  <label className="text-[10px] font-bold text-textSecondary uppercase tracking-wider">Delivery Address</label>
                  <textarea
                    placeholder="Full shipping address details..."
                    disabled={isLoading}
                    rows="2"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className={`w-full bg-card border text-xs py-2 px-3 focus:outline-none rounded-custom resize-none focus:border-accent ${
                      errors.address ? 'border-statusRed focus:border-statusRed' : 'border-border'
                    }`}
                    required
                  />
                  {errors.address && <span className="text-[9px] text-statusRed font-mono">{errors.address}</span>}
                </div>
              </div>
            )}

            {/* CONDITIONAL FIELDS: STORE ADMIN */}
            {role === 'StoreAdmin' && (
              <div className="space-y-4 pt-1">
                <div className="grid grid-cols-2 gap-4">
                  {/* Staff Role selection */}
                  <div className="flex flex-col space-y-1">
                    <label className="text-[10px] font-bold text-textSecondary uppercase tracking-wider">Staff Role</label>
                    <select
                      disabled={isLoading}
                      value={staffRole}
                      onChange={(e) => setStaffRole(e.target.value)}
                      className="w-full text-xs"
                    >
                      <option value="StoreAdmin">Store Admin</option>
                      <option value="SalesUser">Sales User</option>
                      <option value="PurchaseUser">Purchase User</option>
                      <option value="ManufacturingUser">Manufacturing User</option>
                      <option value="InventoryManager">Inventory Manager</option>
                    </select>
                  </div>

                  {/* Invite Code */}
                  <div className="flex flex-col space-y-1">
                    <label className="text-[10px] font-bold text-textSecondary uppercase tracking-wider">Invite Code</label>
                    <input
                      type="text"
                      placeholder="e.g. SHIV2026"
                      disabled={isLoading}
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                      className={`w-full bg-card border text-xs py-2 font-mono uppercase ${
                        errors.inviteCode ? 'border-statusRed focus:border-statusRed' : 'border-border focus:border-accent'
                      }`}
                      required
                    />
                  </div>
                </div>
                {errors.inviteCode ? (
                  <span className="text-[9px] text-statusRed font-mono block">{errors.inviteCode}</span>
                ) : (
                  <span className="text-[9px] text-textMuted font-mono block">Ask manager for the active system invite code.</span>
                )}
              </div>
            )}

            {/* Terms and conditions checkbox */}
            <div className="flex items-start space-x-2 pt-2">
              <button
                type="button"
                disabled={isLoading}
                onClick={() => setAgreeTerms(!agreeTerms)}
                className={`h-4 w-4 border rounded flex items-center justify-center shrink-0 mt-0.5 transition-colors duration-150 ${
                  agreeTerms ? 'border-accent bg-accent text-background' : 'border-border bg-background'
                }`}
              >
                {agreeTerms && <Check size={10} strokeWidth={3.5} />}
              </button>
              <span className="text-[11px] text-textSecondary leading-normal">
                I agree to the <span className="hover:text-textPrimary cursor-pointer underline">Terms of Service</span> and <span className="hover:text-textPrimary cursor-pointer underline">Privacy Policy</span>.
              </span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !agreeTerms}
              className="w-full flex items-center justify-center bg-accent text-background font-bold text-xs py-2.5 rounded-custom hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 shadow-md"
            >
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <Loader2 size={14} className="animate-spin text-background" />
                  <span>Registering...</span>
                </div>
              ) : (
                <span>
                  {role === 'Customer' ? 'Create Customer Account' : 'Create Store Admin Account'}
                </span>
              )}
            </button>

            {/* Already have account redirect */}
            <div className="text-center pt-2">
              <button
                type="button"
                disabled={isLoading}
                onClick={onBackToLogin}
                className="text-[11px] text-textSecondary hover:text-textPrimary transition-colors duration-150"
              >
                Already have an account? <span className="underline font-bold">Log In</span>
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
}
