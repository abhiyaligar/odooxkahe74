import React, { useEffect, useState } from 'react';
import { ThemeToggle } from '../components/common/ThemeToggle';
import { 
  ArrowRight, 
  Layers, 
  MapPin, 
  Truck, 
  Hammer, 
  CheckCircle2, 
  ShieldCheck, 
  Search,
  ShoppingCart
} from 'lucide-react';

export default function LandingPage({ onNavigateToLogin }) {
  const [isScrolled, setIsScrolled] = useState(false);

  // Monitor scroll height to make navbar opaque
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 40) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Smooth scroll helper
  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Mock Featured Products
  const featuredProducts = [
    { id: 'fp1', name: 'Dining Table', price: 800, badge: 'Made to Order', desc: 'Premium oak top table built for corporate and dining gatherings.' },
    { id: 'fp2', name: 'Office Chair', price: 300, badge: 'In Stock', desc: 'Ergonomic swivel mesh base chair supporting posture alignments.' },
    { id: 'fp3', name: 'Solid Wood Bookshelf', price: 650, badge: 'Made to Order', desc: 'Multi-tiered storage shelf crafted from seasoned mahogany logs.' },
    { id: 'fp4', name: 'Minimalist Credenza', price: 950, badge: 'Made to Order', desc: 'Flat-paneled mahogany side cabinet with custom sliding tracks.' }
  ];

  return (
    <div className="min-h-screen w-screen bg-background text-textPrimary flex flex-col font-sans select-none overflow-x-hidden antialiased">
      
      {/* Sticky Navbar */}
      <header 
        className={`fixed top-0 left-0 w-full h-16 z-50 flex items-center justify-between px-6 md:px-12 transition-all duration-150 ${
          isScrolled 
            ? 'bg-card border-b border-border shadow-lg' 
            : 'bg-transparent border-b border-transparent'
        }`}
      >
        {/* Brand Left */}
        <div className="flex items-center space-x-2 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <div className="h-7 w-7 rounded bg-accent text-background flex items-center justify-center font-black text-xs tracking-tighter">
            SF
          </div>
          <span className="font-bold text-sm tracking-wide text-textPrimary uppercase">Shiv Furniture</span>
        </div>

        {/* Center Links */}
        <nav className="hidden md:flex items-center space-x-8 text-xs font-semibold uppercase tracking-wider text-textSecondary">
          <button onClick={() => scrollToSection('catalog')} className="hover:text-textPrimary transition-colors">Catalog</button>
          <button onClick={() => scrollToSection('benefits')} className="hover:text-textPrimary transition-colors">Benefits</button>
          <button onClick={() => scrollToSection('how-it-works')} className="hover:text-textPrimary transition-colors">How It Works</button>
        </nav>

        {/* Right Actions */}
        <div className="flex items-center space-x-3">
          
          {/* Theme Switcher Toggle */}
          <ThemeToggle />

          <button 
            onClick={() => onNavigateToLogin('login')}
            className="text-xs font-semibold px-4 py-2 hover:bg-elevated/40 border border-transparent rounded-custom text-textSecondary hover:text-textPrimary transition-all duration-150"
          >
            Log In
          </button>
          <button 
            onClick={() => onNavigateToLogin('signup')}
            className="bg-accent hover:bg-accent/90 text-background text-xs font-bold px-4 py-2 rounded-custom transition-all duration-150 shadow-md"
          >
            Sign Up
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 md:px-12 max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        {/* Left Hero Texts */}
        <div className="space-y-6">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-[1.1] text-textPrimary">
            Furniture, made to order — and tracked every step of the way.
          </h1>
          <p className="text-sm md:text-base text-textSecondary leading-relaxed max-w-lg">
            We build architectural solid timber furniture tailored to your design layout. Monitor raw material sourcing, workshop fabrication, and delivery updates in real-time.
          </p>
          <div className="pt-2 flex flex-row items-center space-x-3">
            <button 
              onClick={() => scrollToSection('catalog')}
              className="flex items-center space-x-2 bg-accent hover:bg-accent/90 text-background text-xs font-bold px-6 py-3.5 rounded-custom transition-all duration-150 shadow-lg"
            >
              <span>Browse Catalog</span>
              <ArrowRight size={14} strokeWidth={2.5} />
            </button>
            <button 
              onClick={() => onNavigateToLogin('signup')}
              className="bg-card border border-border hover:bg-elevated/40 text-textPrimary text-xs font-semibold px-6 py-3.5 rounded-custom transition-all duration-150"
            >
              Sign Up
            </button>
          </div>
        </div>

        {/* Right Hero Image Placeholder */}
        <div className="aspect-[4/3] w-full bg-card border border-border rounded-[8px] flex flex-col items-center justify-center p-6 text-center space-y-3 relative overflow-hidden group">
          <div className="h-12 w-12 rounded-full border border-border bg-elevated/60 flex items-center justify-center text-textSecondary">
            <Hammer size={20} />
          </div>
          <div className="space-y-1">
            <span className="text-xs font-bold text-textPrimary block">Artisan Workshop Cam Placeholder</span>
            <span className="text-[10px] text-textMuted font-mono uppercase tracking-widest block">Live Stream Feed Simulation</span>
          </div>
          <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors duration-200" />
        </div>
      </section>

      {/* Value Propositions Section */}
      <section id="benefits" className="bg-card/30 border-y border-border py-20 px-6 md:px-12 w-full">
        <div className="max-w-6xl w-full mx-auto space-y-12">
          {/* Header */}
          <div className="text-center space-y-1 max-w-md mx-auto">
            <span className="text-[10px] font-bold text-textSecondary uppercase tracking-widest font-mono">Operations Credibility</span>
            <h2 className="text-xl font-bold tracking-tight">Handcrafted Rigor Meets ERP Transparency</h2>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Prop 1 */}
            <div className="bg-card border border-border rounded-[8px] p-6 space-y-4">
              <div className="h-8 w-8 rounded border border-border bg-elevated/60 flex items-center justify-center text-textSecondary">
                <Hammer size={16} />
              </div>
              <div className="space-y-1.5">
                <h3 className="font-bold text-sm text-textPrimary">Made to Order</h3>
                <p className="text-xs text-textSecondary leading-relaxed">
                  We don't overproduce. Each piece is scheduled on our shop floor only when ordered, conserving materials and custom fit options.
                </p>
              </div>
            </div>

            {/* Prop 2 */}
            <div className="bg-card border border-border rounded-[8px] p-6 space-y-4">
              <div className="h-8 w-8 rounded border border-border bg-elevated/60 flex items-center justify-center text-textSecondary">
                <CheckCircle2 size={16} />
              </div>
              <div className="space-y-1.5">
                <h3 className="font-bold text-sm text-textPrimary">Real-Time Order Tracking</h3>
                <p className="text-xs text-textSecondary leading-relaxed">
                  Bypass traditional support desk black holes. Track when legs are turned, tops are polished, and logistics are loaded on-vehicle.
                </p>
              </div>
            </div>

            {/* Prop 3 */}
            <div className="bg-card border border-border rounded-[8px] p-6 space-y-4">
              <div className="h-8 w-8 rounded border border-border bg-elevated/60 flex items-center justify-center text-textSecondary">
                <ShieldCheck size={16} />
              </div>
              <div className="space-y-1.5">
                <h3 className="font-bold text-sm text-textPrimary">Quality Craftsmanship</h3>
                <p className="text-xs text-textSecondary leading-relaxed">
                  Built exclusively with seasoned native oak timber and rigid internal steel skeletons to survive decades of heavy office usage.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Products Section */}
      <section id="catalog" className="py-20 px-6 md:px-12 max-w-6xl w-full mx-auto space-y-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-textSecondary uppercase tracking-widest font-mono font-semibold">Bestselling Pieces</span>
            <h2 className="text-xl font-bold tracking-tight">Handcrafted Featured Collections</h2>
          </div>
          <button 
            onClick={() => onNavigateToLogin('login')}
            className="flex items-center space-x-1.5 text-xs font-bold text-textPrimary hover:underline"
          >
            <span>View Full Catalog</span>
            <ArrowRight size={12} strokeWidth={2.5} />
          </button>
        </div>

        {/* Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {featuredProducts.map(p => (
            <div 
              key={p.id}
              className="bg-card border border-border rounded-[8px] p-4 flex flex-col space-y-3.5 hover:border-textSecondary transition-colors duration-150 cursor-pointer"
              onClick={() => onNavigateToLogin('login')}
            >
              {/* Image Box */}
              <div className="aspect-video w-full bg-elevated border border-border rounded flex items-center justify-center text-textMuted text-[10px] font-semibold">
                {p.name} Image
              </div>
              
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-textPrimary">{p.name}</span>
                  <span className="text-xs font-extrabold font-mono text-textPrimary">${p.price}</span>
                </div>
                <p className="text-[10px] text-textSecondary leading-relaxed line-clamp-2">
                  {p.desc}
                </p>
              </div>

              <div className="flex items-center pt-1">
                <span className={`inline-block text-[8px] font-bold uppercase rounded px-2 py-0.5 tracking-wider border font-mono ${
                  p.badge === 'In Stock' ? 'border-success/40 text-success bg-success/5' : 'border-warning/40 text-warning bg-warning/5'
                }`}>
                  {p.badge}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it Works Section */}
      <section id="how-it-works" className="bg-card/30 border-y border-border py-20 px-6 md:px-12 w-full">
        <div className="max-w-6xl w-full mx-auto space-y-12">
          {/* Header */}
          <div className="text-center space-y-1 max-w-sm mx-auto">
            <span className="text-[10px] font-bold text-textSecondary uppercase tracking-widest font-mono">Simple Steps</span>
            <h2 className="text-xl font-bold tracking-tight">Our Integrated Sourcing Process</h2>
          </div>

          {/* Stepper Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center relative">
            {/* Step 1 */}
            <div className="space-y-3 relative flex flex-col items-center">
              <div className="h-10 w-10 rounded-full border border-border bg-elevated flex items-center justify-center font-mono font-bold text-xs text-accent">
                01
              </div>
              <h3 className="font-bold text-sm text-textPrimary">Browse & Order</h3>
              <p className="text-[11px] text-textSecondary leading-relaxed max-w-xs">
                Log into our Customer Portal, browse our designs, add items to cart, and lock in your order draft.
              </p>
            </div>

            {/* Step 2 */}
            <div className="space-y-3 relative flex flex-col items-center">
              <div className="h-10 w-10 rounded-full border border-border bg-elevated flex items-center justify-center font-mono font-bold text-xs text-accent">
                02
              </div>
              <h3 className="font-bold text-sm text-textPrimary">We Build or Ship</h3>
              <p className="text-[11px] text-textSecondary leading-relaxed max-w-xs">
                Staff confirms the request. Stock is allocated, or replenishment routes automatically schedule shop floor manufacturing.
              </p>
            </div>

            {/* Step 3 */}
            <div className="space-y-3 relative flex flex-col items-center">
              <div className="h-10 w-10 rounded-full border border-border bg-elevated flex items-center justify-center font-mono font-bold text-xs text-accent">
                03
              </div>
              <h3 className="font-bold text-sm text-textPrimary">Track Delivery</h3>
              <p className="text-[11px] text-textSecondary leading-relaxed max-w-xs">
                Receive detailed dispatch updates and tracking histories as finished goods move out of our warehouse docks.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Banner Strip */}
      <section className="py-20 px-6 md:px-12 max-w-4xl w-full mx-auto">
        <div className="bg-card border border-border rounded-[8px] p-8 md:p-12 text-center space-y-6 shadow-xl">
          <h2 className="text-2xl font-black tracking-tight text-textPrimary">Ready to design your workspace?</h2>
          <p className="text-xs text-textSecondary leading-relaxed max-w-md mx-auto">
            Create an external customer account to customize sizes, check delivery promises, and trace current fabrication logs.
          </p>
          <button 
            onClick={() => onNavigateToLogin('signup')}
            className="inline-flex items-center space-x-2 bg-accent hover:bg-accent/90 text-background font-bold text-xs px-8 py-3 rounded-custom transition-all duration-150 shadow-md"
          >
            <span>Create an Account</span>
            <ArrowRight size={12} strokeWidth={2.5} />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-border bg-card/65 py-12 px-6 md:px-12 w-full text-xs text-textSecondary">
        <div className="max-w-6xl w-full mx-auto grid grid-cols-2 md:grid-cols-5 gap-8 border-b border-border pb-8">
          
          {/* Tagline Column */}
          <div className="col-span-2 space-y-3">
            <div className="flex items-center space-x-2">
              <div className="h-6 w-6 rounded bg-accent text-background flex items-center justify-center font-black text-[10px] tracking-tighter">
                SF
              </div>
              <span className="font-bold text-xs text-textPrimary uppercase">Shiv Furniture Works</span>
            </div>
            <p className="text-[11px] text-textMuted leading-relaxed max-w-xs">
              Artisan woodworking meets robust resource planning automation. Built for Odoo-style hackathon demo showcases.
            </p>
            {/* Socials placeholder */}
            <div className="flex items-center space-x-3 pt-2 text-[10px] font-mono text-textMuted uppercase">
              <span className="hover:text-textPrimary cursor-pointer">TW</span>
              <span>·</span>
              <span className="hover:text-textPrimary cursor-pointer">IG</span>
              <span>·</span>
              <span className="hover:text-textPrimary cursor-pointer">FB</span>
              <span>·</span>
              <span className="hover:text-textPrimary cursor-pointer">GH</span>
            </div>
          </div>

          {/* Links Column 1 */}
          <div className="space-y-2.5">
            <span className="font-bold text-[10px] uppercase text-textPrimary tracking-wider block">Company</span>
            <ul className="space-y-1.5 text-[11px]">
              <li className="hover:text-textPrimary cursor-pointer">About Us</li>
              <li className="hover:text-textPrimary cursor-pointer">Artisan Team</li>
              <li className="hover:text-textPrimary cursor-pointer">Press kit</li>
            </ul>
          </div>

          {/* Links Column 2 */}
          <div className="space-y-2.5">
            <span className="font-bold text-[10px] uppercase text-textPrimary tracking-wider block">Support</span>
            <ul className="space-y-1.5 text-[11px]">
              <li className="hover:text-textPrimary cursor-pointer">Help Desk</li>
              <li className="hover:text-textPrimary cursor-pointer">Warranty Policy</li>
              <li className="hover:text-textPrimary cursor-pointer">Care Instructions</li>
            </ul>
          </div>

          {/* Links Column 3 */}
          <div className="space-y-2.5">
            <span className="font-bold text-[10px] uppercase text-textPrimary tracking-wider block">Hackathon</span>
            <ul className="space-y-1.5 text-[11px]">
              <li className="hover:text-textPrimary cursor-pointer">Mini ERP PRD</li>
              <li className="hover:text-textPrimary cursor-pointer">Zustand Store DB</li>
              <li className="hover:text-textPrimary cursor-pointer">Odoo Code Engine</li>
            </ul>
          </div>

        </div>

        {/* Copyright Line */}
        <div className="max-w-6xl w-full mx-auto pt-6 flex flex-col md:flex-row items-center justify-between text-[10px] text-textMuted font-mono gap-4">
          <span>© 2026 Shiv Furniture Works. All rights reserved.</span>
          <span>Designed with Grayscale minimal SaaS identity frameworks.</span>
        </div>
      </footer>

    </div>
  );
}
