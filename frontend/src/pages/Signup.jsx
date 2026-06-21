import React, { useState } from 'react';
import { Eye, EyeOff, Check, Loader2, ShoppingBag, Store, AlertCircle } from 'lucide-react';
import { api } from '../api/client';

export default function SignupPage({ onSignupSuccess, onBackToLogin, onBackToHome }) {
  const [role, setRole] = useState('Customer'); // only Customer signup allowed
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
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!phone) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^\d{10}$/.test(phone)) {
      newErrors.phone = 'Phone number must be exactly 10 digits';
    }
    if (!address) newErrors.address = 'Delivery address is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLoading || !agreeTerms) return;

    if (!validateForm()) return;

    setIsLoading(true);
    setErrors({});
    
    try {
      const signupPayload = {
        name,
        email,
        password,
        role: 'Customer',
        phone,
        address,
      };

      await api.post('/auth/signup', signupPayload);
      
      const params = new URLSearchParams();
      params.append('username', email);
      params.append('password', password);
      
      const res = await api.post('/auth/login', params);
      localStorage.setItem('access_token', res.access_token);
      
      onSignupSuccess('Customer');
    } catch (err) {
      setErrors({ general: err.message || 'Signup failed' });
    } finally {
      setIsLoading(false);
    }
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

          <form onSubmit={handleSubmit} className="space-y-4 animate-all-custom transition-all duration-150">
            
            {errors.general && (
              <div className="bg-danger/10 border border-danger/20 text-danger p-3 rounded-custom flex items-start space-x-2 text-[11px] font-mono leading-relaxed mb-4">
                <AlertCircle className="h-4 w-4 shrink-0 text-danger mt-0.5" />
                <span>{errors.general}</span>
              </div>
            )}
            

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
                  errors.name ? 'border-danger focus:border-danger' : 'border-border focus:border-accent'
                }`}
                required
              />
              {errors.name && <span className="text-[9px] text-danger font-mono">{errors.name}</span>}
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
                  errors.email ? 'border-danger focus:border-danger' : 'border-border focus:border-accent'
                }`}
                required
              />
              {errors.email && <span className="text-[9px] text-danger font-mono">{errors.email}</span>}
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
                      errors.password ? 'border-danger focus:border-danger' : 'border-border focus:border-accent'
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
                {errors.password && <span className="text-[9px] text-danger font-mono">{errors.password}</span>}
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
                      errors.confirmPassword ? 'border-danger focus:border-danger' : 'border-border focus:border-accent'
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
                {errors.confirmPassword && <span className="text-[9px] text-danger font-mono">{errors.confirmPassword}</span>}
              </div>
            </div>

            {/* Customer Fields (Phone and Address always rendered) */}
            <div className="space-y-4 pt-1">
              {/* Phone */}
              <div className="flex flex-col space-y-1">
                <label className="text-[10px] font-bold text-textSecondary uppercase tracking-wider">Phone Number</label>
                <input
                  type="tel"
                  placeholder="e.g. 1234567890"
                  disabled={isLoading}
                  value={phone}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setPhone(val);
                  }}
                  className={`w-full bg-card border text-xs py-2 ${
                    errors.phone ? 'border-danger focus:border-danger' : 'border-border focus:border-accent'
                  }`}
                  required
                />
                {errors.phone && <span className="text-[9px] text-danger font-mono">{errors.phone}</span>}
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
                    errors.address ? 'border-danger focus:border-danger' : 'border-border'
                  }`}
                  required
                />
                {errors.address && <span className="text-[9px] text-danger font-mono">{errors.address}</span>}
              </div>
            </div>

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
                <span>Create Customer Account</span>
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

      </div>
    </div>
  );
}
