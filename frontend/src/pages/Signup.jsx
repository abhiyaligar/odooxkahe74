import React, { useState, useRef } from 'react';
import { Eye, EyeOff, Check, Circle, Loader2, ShoppingBag, Store, AlertCircle } from 'lucide-react';
import { api } from '../api/client';
import { getPasswordStrength } from '../utils/password';

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
  const passwordInputRef = useRef(null);

  // Conditional fields state
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  // Email verification states
  const [step, setStep] = useState('signup'); // 'signup', 'verify'
  const [verificationCode, setVerificationCode] = useState('');
  const [notification, setNotification] = useState('');

  const strength = getPasswordStrength(password);
  const allRulesMet = strength.score === 5;

  const validateForm = () => {
    const newErrors = {};
    if (!name) newErrors.name = 'Full Name is required';
    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!email.includes('@')) {
      newErrors.email = 'Please enter a valid email address';
    }

    const strength = getPasswordStrength(password);
    if (!password) {
      newErrors.password = 'Password is required';
    } else if (strength.score < 5) {
      newErrors.password = 'Password does not meet all requirements';
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
    if (newErrors.password) {
      passwordInputRef.current?.focus();
    }
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLoading || !agreeTerms) return;

    if (!validateForm()) return;

    setIsLoading(true);
    setErrors({});
    setNotification('');

    try {
      const signupPayload = {
        name,
        email,
        password,
        role: 'Customer',
        phone,
        address,
      };

      // 1. Create account
      await api.post('/auth/signup', signupPayload);

      // 2. Request verification code
      try {
        await api.post('/auth/send-verification-code', { email });
        setNotification('Account created! A verification code has been sent to your email.');
        setStep('verify');
      } catch (sendErr) {
        setErrors({ general: 'Account created, but failed to send verification email. Please log in to try again.' });
      }
    } catch (err) {
      setErrors({ general: err.message || 'Signup failed' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifySubmit = async (e) => {
    e.preventDefault();
    if (isLoading) return;

    if (!verificationCode || verificationCode.length !== 6) {
      setErrors({ general: 'Please enter a valid 6-digit verification code.' });
      return;
    }

    setIsLoading(true);
    setErrors({});
    setNotification('');

    try {
      // 1. Verify code
      await api.post('/auth/verify-email-code', {
        email,
        code: verificationCode
      });

      // 2. Autologin
      const params = new URLSearchParams();
      params.append('username', email);
      params.append('password', password);

      const res = await api.post('/auth/login', params);
      localStorage.setItem('access_token', res.access_token);

      onSignupSuccess('Customer');
    } catch (err) {
      setErrors({ general: err.message || 'Verification failed. Please check the code.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setErrors({});
    setNotification('');
    try {
      await api.post('/auth/send-verification-code', { email });
      setNotification('A new verification code has been sent to your email.');
    } catch (err) {
      setErrors({ general: err.message || 'Failed to resend verification code.' });
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
        <div className="text-center space-y-1 flex flex-col items-center">
          <img
            src="/logo.png"
            alt="AutoCrafERP Logo"
            className="h-8 w-auto object-contain dark:invert-0 invert mb-1"
          />
          <h2 className="text-md font-bold tracking-tight text-textPrimary mt-1 font-sans">AutoCrafERP</h2>
          <p className="text-[10px] uppercase tracking-widest text-textSecondary font-semibold">
            {step === 'signup' ? 'Create your account' : 'Verify Email Address'}
          </p>
        </div>

        {errors.general && (
          <div className="bg-danger/10 border border-danger/20 text-danger p-3 rounded-custom flex items-start space-x-2 text-[11px] font-mono leading-relaxed mb-4">
            <AlertCircle className="h-4 w-4 shrink-0 text-danger mt-0.5" />
            <span>{errors.general}</span>
          </div>
        )}

        {notification && (
          <div className="bg-success/10 border border-success/20 text-success p-3 rounded-custom flex items-start space-x-2 text-[11px] font-mono leading-relaxed mb-4">
            <Check size={14} className="h-4 w-4 shrink-0 text-success mt-0.5" />
            <span>{notification}</span>
          </div>
        )}
        {step === 'signup' && (
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
                className={`w-full bg-card border text-xs py-2 ${errors.name ? 'border-danger focus:border-danger' : 'border-border focus:border-accent'
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
                className={`w-full bg-card border text-xs py-2 ${errors.email ? 'border-danger focus:border-danger' : 'border-border focus:border-accent'
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
                    ref={passwordInputRef}
                    type={showPassword ? "text" : "password"}
                    placeholder="Min 8 chars"
                    disabled={isLoading}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`w-full bg-card border text-xs py-2 pr-8 ${errors.password ? 'border-danger focus:border-danger' : 'border-border focus:border-accent'
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

                {/* Password Strength Checklist & Bar */}
                <div className="mt-2 space-y-2 border-t border-border/40 pt-2.5">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider">
                      <span className="text-textSecondary">Strength</span>
                      <span className={
                        strength.score <= 1 ? "text-danger" :
                          strength.score <= 4 ? "text-warning" : "text-success"
                      }>
                        {
                          strength.score <= 1 ? "Weak" :
                            strength.score <= 3 ? "Fair" :
                              strength.score === 4 ? "Good" : "Strong"
                        }
                      </span>
                    </div>
                    <div className="flex gap-1 w-full h-1">
                      {[1, 2, 3, 4, 5].map((index) => {
                        let active = index <= strength.score;
                        let colorClass = "bg-border/60";
                        if (active) {
                          if (strength.score <= 1) colorClass = "bg-danger";
                          else if (strength.score <= 4) colorClass = "bg-warning";
                          else colorClass = "bg-success";
                        }
                        return (
                          <div
                            key={index}
                            className={`h-full flex-1 rounded-full transition-all duration-300 ${colorClass}`}
                          />
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-1 pt-1">
                    {[
                      { met: strength.length, text: "At least 8 characters" },
                      { met: strength.uppercase, text: "One uppercase letter" },
                      { met: strength.lowercase, text: "One lowercase letter" },
                      { met: strength.number, text: "One number" },
                      { met: strength.special, text: "One special character" },
                    ].map((req, i) => (
                      <div key={i} className={`flex items-center space-x-2 text-[10px] transition-colors duration-150 ${req.met ? "text-textPrimary" : "text-textSecondary"
                        }`}>
                        {req.met ? (
                          <Check size={10} className="text-success shrink-0" strokeWidth={3} />
                        ) : (
                          <Circle size={10} className="text-textSecondary shrink-0 opacity-60" />
                        )}
                        <span>{req.text}</span>
                      </div>
                    ))}
                  </div>
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
                    className={`w-full bg-card border text-xs py-2 pr-8 ${errors.confirmPassword ? 'border-danger focus:border-danger' : 'border-border focus:border-accent'
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
                  className={`w-full bg-card border text-xs py-2 ${errors.phone ? 'border-danger focus:border-danger' : 'border-border focus:border-accent'
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
                  className={`w-full bg-card border text-xs py-2 px-3 focus:outline-none rounded-custom resize-none focus:border-accent ${errors.address ? 'border-danger focus:border-danger' : 'border-border'
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
                className={`h-4 w-4 border rounded flex items-center justify-center shrink-0 mt-0.5 transition-colors duration-150 ${agreeTerms ? 'border-accent bg-accent text-background' : 'border-border bg-background'
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
              disabled={isLoading || !agreeTerms || !allRulesMet || password !== confirmPassword}
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
        )}

        {step === 'verify' && (
          <form onSubmit={handleVerifySubmit} className="space-y-4">
            <p className="text-[11px] text-textSecondary leading-relaxed">
              We have sent a 6-digit email verification code to <strong>{email}</strong>. Enter it below to activate your account.
            </p>

            {/* Verification Code field */}
            <div className="flex flex-col space-y-1.5">
              <label className="text-[10px] font-bold text-textSecondary uppercase tracking-wider">Verification Code</label>
              <input
                type="text"
                placeholder="e.g. 123456"
                maxLength={6}
                disabled={isLoading}
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                required
                className="w-full bg-card border border-border text-xs py-2 px-3 tracking-[0.2em] font-mono text-center font-bold"
              />
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center bg-accent text-background font-bold text-xs py-2.5 rounded-custom hover:bg-accent/90 disabled:opacity-50 transition-all duration-150"
            >
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <Loader2 size={14} className="animate-spin text-background" />
                  <span>Activating...</span>
                </div>
              ) : (
                <span>Verify & Activate</span>
              )}
            </button>

            {/* Resend and go back buttons */}
            <div className="flex flex-col space-y-3 pt-2 text-center text-[11px]">
              <button
                type="button"
                disabled={isLoading}
                onClick={handleResendCode}
                className="font-semibold text-textSecondary hover:text-textPrimary transition-colors"
              >
                Resend Code
              </button>
              <button
                type="button"
                disabled={isLoading}
                onClick={() => {
                  setStep('signup');
                  setErrors({});
                  setNotification('');
                }}
                className="text-textSecondary hover:text-textPrimary transition-colors"
              >
                &larr; Back to Registration
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
