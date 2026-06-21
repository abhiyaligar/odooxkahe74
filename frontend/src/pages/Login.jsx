import React, { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff, Check, Loader2, KeyRound } from 'lucide-react';
import { api } from '../api/client';

const decodeJwt = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    return {};
  }
};

export default function LoginPage({ onLogin, onBack, onSignup }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({ email: '', password: '', general: '' });
  
  // Forgot / Reset Password States
  const [mode, setMode] = useState('login'); // 'login', 'forgot', 'reset'
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [notification, setNotification] = useState('');
  
  const emailInputRef = useRef(null);

  // Autofocus email field on mount
  useEffect(() => {
    if (emailInputRef.current) {
      emailInputRef.current.focus();
    }
  }, []);



  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLoading) return;

    let hasErrors = false;
    const newErrors = { email: '', password: '', general: '' };

    if (!email) {
      newErrors.email = 'Email address or username is required';
      hasErrors = true;
    } else if (!email.includes('@')) {
      newErrors.email = 'Please enter a valid email address';
      hasErrors = true;
    }

    if (!password) {
      newErrors.password = 'Password is required';
      hasErrors = true;
    }

    if (hasErrors) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    setErrors({ email: '', password: '', general: '' });

    try {
      const params = new URLSearchParams();
      params.append('username', email);
      params.append('password', password);

      const res = await api.post('/auth/login', params);
      const token = res.access_token;
      localStorage.setItem('access_token', token);
      
      const decoded = decodeJwt(token);
      let role = decoded.role;
      
      if (!role) {
        role = 'StoreAdmin';
      }
      
      onLogin(role);
    } catch (err) {
      setErrors(prev => ({
        ...prev,
        general: err.message || 'Invalid email or password.'
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    if (isLoading) return;
    if (!email) {
      setErrors({ email: 'Email address is required', password: '', general: '' });
      return;
    }
    setIsLoading(true);
    setErrors({ email: '', password: '', general: '' });
    setNotification('');
    try {
      await api.post('/auth/forgot-password', { email });
      setNotification('A password reset code has been sent to your email.');
      setMode('reset');
    } catch (err) {
      setErrors(prev => ({
        ...prev,
        general: err.message || 'Failed to send reset code.'
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    if (isLoading) return;
    if (!resetCode || resetCode.length !== 6) {
      setErrors({ email: '', password: '', general: 'Please enter a valid 6-digit code' });
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setErrors({ email: '', password: '', general: 'New password must be at least 8 characters' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrors({ email: '', password: '', general: 'Passwords do not match' });
      return;
    }
    setIsLoading(true);
    setErrors({ email: '', password: '', general: '' });
    setNotification('');
    try {
      await api.post('/auth/reset-password', {
        email,
        code: resetCode,
        new_password: newPassword
      });
      setNotification('Password reset successfully! You can now sign in.');
      setMode('login');
      setPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setResetCode('');
    } catch (err) {
      setErrors(prev => ({
        ...prev,
        general: err.message || 'Failed to reset password.'
      }));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-background p-4 select-none">
      
      {/* Main Login Card */}
      <div className="w-full max-w-[400px] bg-card border border-border rounded-custom p-8 shadow-[0_4px_16px_rgba(0,0,0,0.5)] flex flex-col space-y-6">
        
        {/* Back Button */}
        {onBack && (
          <button 
            type="button"
            onClick={onBack}
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
          <h2 className="text-md font-bold tracking-tight text-textPrimary mt-1">AutoCrafERP</h2>
          <p className="text-[10px] uppercase tracking-widest text-textSecondary font-semibold">
            {mode === 'login' && 'Mini ERP Ecosystem'}
            {mode === 'forgot' && 'Reset your password'}
            {mode === 'reset' && 'Confirm Code & Password'}
          </p>
        </div>

        {/* General Alert Box */}
        {errors.general && (
          <div className="bg-danger/10 border border-danger/20 text-danger p-3 rounded-custom flex items-start space-x-2 text-[11px] font-mono leading-relaxed">
            <AlertCircle className="h-4 w-4 shrink-0 text-danger mt-0.5" />
            <span>{errors.general}</span>
          </div>
        )}

        {/* Notification Box */}
        {notification && (
          <div className="bg-success/10 border border-success/20 text-success p-3 rounded-custom flex items-start space-x-2 text-[11px] font-mono leading-relaxed">
            <Check size={14} className="h-4 w-4 shrink-0 text-success mt-0.5" />
            <span>{notification}</span>
          </div>
        )}

        {/* Conditional Forms based on mode */}
        {mode === 'login' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email field */}
            <div className="flex flex-col space-y-1.5">
              <label className="text-[10px] font-bold text-textSecondary uppercase tracking-wider">Email or Username</label>
              <input
                ref={emailInputRef}
                type="text"
                placeholder="e.g. admin@autocrafterp.com"
                disabled={isLoading}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full bg-card border text-xs py-2 ${
                  errors.email ? 'border-danger focus:border-danger' : 'border-border focus:border-accent'
                }`}
              />
              {errors.email && (
                <span className="text-[10px] text-danger font-mono">{errors.email}</span>
              )}
            </div>

            {/* Password field */}
            <div className="flex flex-col space-y-1.5">
              <label className="text-[10px] font-bold text-textSecondary uppercase tracking-wider">Password</label>
              <div className="relative w-full">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  disabled={isLoading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full bg-card border text-xs py-2 pr-10 ${
                    errors.password ? 'border-danger focus:border-danger' : 'border-border focus:border-accent'
                  }`}
                />
                <button
                  type="button"
                  tabIndex="-1"
                  disabled={isLoading}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2 text-textSecondary hover:text-textPrimary transition-colors duration-150"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {errors.password && (
                <span className="text-[10px] text-danger font-mono">{errors.password}</span>
              )}
            </div>

            {/* Remember Me and Forgot Password */}
            <div className="flex items-center justify-between text-[11px] pt-1">
              <label className="flex items-center space-x-2 cursor-pointer">
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => setRememberMe(!rememberMe)}
                  className={`h-4 w-4 border rounded flex items-center justify-center transition-colors duration-150 ${
                    rememberMe ? 'border-accent bg-accent text-background' : 'border-border bg-background'
                  }`}
                >
                  {rememberMe && <Check size={10} strokeWidth={3.5} />}
                </button>
                <span className="text-textSecondary select-none font-medium">Remember me</span>
              </label>

              <button
                type="button"
                tabIndex="-1"
                disabled={isLoading}
                onClick={() => {
                  setMode('forgot');
                  setErrors({ email: '', password: '', general: '' });
                }}
                className="text-textSecondary hover:text-textPrimary font-medium transition-colors duration-150"
              >
                Forgot password?
              </button>
            </div>

            {/* Submit Sign In Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center bg-accent text-background font-bold text-xs py-2.5 rounded-custom hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150"
            >
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <Loader2 size={14} className="animate-spin text-background" />
                  <span>Signing In...</span>
                </div>
              ) : (
                <span>Sign In</span>
              )}
            </button>

            {/* Signup Redirect Link */}
            <div className="text-center pt-1.5">
              <button
                type="button"
                disabled={isLoading}
                onClick={onSignup}
                className="text-[11px] text-textSecondary hover:text-textPrimary transition-colors duration-150"
              >
                Don't have an account? <span className="underline font-bold">Sign Up</span>
              </button>
            </div>
          </form>
        )}

        {mode === 'forgot' && (
          <form onSubmit={handleForgotSubmit} className="space-y-4">
            <p className="text-[11px] text-textSecondary leading-relaxed">
              Enter your email address below. If it exists in our system, we will send you a 6-digit code to reset your password.
            </p>

            {/* Email field */}
            <div className="flex flex-col space-y-1.5">
              <label className="text-[10px] font-bold text-textSecondary uppercase tracking-wider">Email Address</label>
              <input
                type="email"
                placeholder="e.g. user@autocrafterp.com"
                disabled={isLoading}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-card border border-border text-xs py-2 px-3 focus:border-accent"
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
                  <span>Sending Code...</span>
                </div>
              ) : (
                <span>Send Code</span>
              )}
            </button>

            {/* Actions redirect */}
            <div className="text-center pt-1.5 flex flex-col space-y-2">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrors({ email: '', password: '', general: '' });
                }}
                className="text-[11px] text-textSecondary hover:text-textPrimary transition-colors duration-150"
              >
                &larr; Back to Sign In
              </button>
            </div>
          </form>
        )}

        {mode === 'reset' && (
          <form onSubmit={handleResetSubmit} className="space-y-4">
            <p className="text-[11px] text-textSecondary leading-relaxed">
              We've sent a 6-digit verification code to <strong>{email}</strong>. Enter the code and set your new password.
            </p>

            {/* Verification Code field */}
            <div className="flex flex-col space-y-1.5">
              <label className="text-[10px] font-bold text-textSecondary uppercase tracking-wider">Verification Code</label>
              <input
                type="text"
                placeholder="e.g. 123456"
                maxLength={6}
                disabled={isLoading}
                value={resetCode}
                onChange={(e) => setResetCode(e.target.value)}
                required
                className="w-full bg-card border border-border text-xs py-2 px-3 tracking-[0.2em] font-mono text-center font-bold"
              />
            </div>

            {/* New Password field */}
            <div className="flex flex-col space-y-1.5">
              <label className="text-[10px] font-bold text-textSecondary uppercase tracking-wider">New Password</label>
              <input
                type="password"
                placeholder="••••••••"
                disabled={isLoading}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="w-full bg-card border border-border text-xs py-2 px-3 focus:border-accent"
              />
            </div>

            {/* Confirm New Password field */}
            <div className="flex flex-col space-y-1.5">
              <label className="text-[10px] font-bold text-textSecondary uppercase tracking-wider">Confirm New Password</label>
              <input
                type="password"
                placeholder="••••••••"
                disabled={isLoading}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full bg-card border border-border text-xs py-2 px-3 focus:border-accent"
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
                  <span>Resetting Password...</span>
                </div>
              ) : (
                <span>Reset Password</span>
              )}
            </button>

            {/* Back button */}
            <div className="text-center pt-1.5">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrors({ email: '', password: '', general: '' });
                }}
                className="text-[11px] text-textSecondary hover:text-textPrimary transition-colors duration-150"
              >
                &larr; Back to Sign In
              </button>
            </div>
          </form>
        )}


      </div>

      {/* Footer */}
      <footer className="mt-8 text-center text-[10px] text-textMuted font-mono">
        © 2026 AutoCrafERP · Built for Odoo Hackathon
      </footer>
    </div>
  );
}

// Simple internal icon fallback for validation alert box
const AlertCircle = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);
