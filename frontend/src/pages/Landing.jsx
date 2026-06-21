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
import { HeroChartPreview } from '../components/common/HeroChartPreview';

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
      <header className="fixed top-0 left-0 w-full z-50 flex items-center justify-between px-6 md:px-8 py-4 bg-[#0a0a0a] border-b border-white/10">
        
        {/* Brand Left */}
        <div className="flex items-center gap-[10px] cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <img 
            src="/logo.png" 
            alt="AutoCraft Logo" 
            className="h-6 md:h-8 w-auto object-contain dark:invert-0 invert" 
          />
          <span className="font-bold text-sm tracking-wide text-white uppercase">AutoCraft</span>
        </div>

        {/* Center Links */}
        <nav className="hidden md:flex items-center justify-center space-x-8 text-xs font-semibold uppercase tracking-[0.02em] text-white/60">
          <button onClick={() => scrollToSection('catalog')} className="hover:text-white transition-colors duration-200">Catalog</button>
          <button onClick={() => scrollToSection('benefits')} className="hover:text-white transition-colors duration-200">Benefits</button>
          <button onClick={() => scrollToSection('how-it-works')} className="hover:text-white transition-colors duration-200">How It Works</button>
        </nav>

        {/* Right Actions */}
        <div className="flex items-center justify-end space-x-5">
          <ThemeToggle />
          <div className="flex items-center space-x-4 ml-2">
            <button 
              onClick={() => onNavigateToLogin('login')}
              className="text-xs font-semibold text-white/80 hover:text-white transition-colors duration-200"
            >
              Log In
            </button>
            <button 
              onClick={() => onNavigateToLogin('signup')}
              className="bg-white text-black text-xs font-bold px-4 py-2 rounded-lg hover:bg-white/90 transition-colors duration-200"
            >
              Sign Up
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-32 px-6 md:px-12 max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        {/* Left Hero Texts */}
        <div className="space-y-6">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-[1.1] text-textPrimary">
            From raw timber to your doorstep — tracked live.
          </h1>
          <p className="text-sm md:text-base text-textSecondary leading-relaxed max-w-lg">
            Every order, every material, every workshop update — visible in real time. No spreadsheets, no guessing where your furniture is.
          </p>
          <div className="pt-2 flex flex-row items-center space-x-3">
            <button 
              onClick={() => scrollToSection('catalog')}
              className="group flex items-center space-x-2 bg-white text-black text-xs font-semibold px-7 py-3.5 rounded-lg transition-all duration-300 ease-in-out hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(255,255,255,0.15)] active:scale-[0.98]"
            >
              <span>Browse Catalog</span>
              <ArrowRight size={14} strokeWidth={2.5} className="transition-transform duration-300 ease-in-out group-hover:translate-x-1" />
            </button>
            <button 
              onClick={() => onNavigateToLogin('signup')}
              className="bg-card border border-border hover:bg-elevated/40 text-textPrimary text-xs font-semibold px-6 py-3.5 rounded-custom transition-all duration-150"
            >
              Sign Up
            </button>
          </div>
        </div>

        {/* Right Hero Live Charts Preview */}
        <div className="aspect-[4/3] w-full bg-card border border-border rounded-[12px] flex flex-col justify-center p-6 relative overflow-hidden shadow-2xl">
          <div className="w-full relative z-10 pointer-events-none">
            <HeroChartPreview />
          </div>
          
          {/* Subtle gradient overlay to make it look embedded */}
          <div className="absolute inset-0 bg-gradient-to-tr from-accent/5 to-transparent pointer-events-none" />
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
            <div className="flex items-center gap-2 mb-4">
              <img 
                src="/logo.png" 
                alt="AutoCraft Logo" 
                className="h-5 w-auto object-contain dark:invert-0 invert" 
              />
              <span className="font-bold text-xs text-textPrimary uppercase">AutoCraft</span>
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
          <span>© 2026 AutoCraft. All rights reserved.</span>
          <span>Designed with Grayscale minimal SaaS identity frameworks.</span>
        </div>
      </footer>

    </div>
  );
}
