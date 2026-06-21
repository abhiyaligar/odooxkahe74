import React from 'react';
import { useTheme } from './ThemeProvider';
import { Sun, Moon } from 'lucide-react';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="relative flex items-center bg-white/5 p-[3px] rounded-full text-textSecondary shrink-0 w-[54px]">
      {/* Sliding Background */}
      <div 
        className={`absolute top-[3px] bottom-[3px] w-6 rounded-full bg-card border border-white/10 transition-transform duration-300 ease-in-out ${
          theme === 'dark' ? 'translate-x-[22px]' : 'translate-x-0'
        }`}
      />

      <button
        type="button"
        onClick={() => setTheme('light')}
        title="Light Mode"
        className={`relative z-10 w-6 h-6 flex items-center justify-center rounded-full transition-colors duration-300 ${
          theme === 'light' ? 'text-textPrimary' : 'text-textSecondary hover:text-textPrimary'
        }`}
      >
        <Sun size={13} strokeWidth={2.5} />
      </button>
      <button
        type="button"
        onClick={() => setTheme('dark')}
        title="Dark Mode"
        className={`relative z-10 w-6 h-6 flex items-center justify-center rounded-full transition-colors duration-300 ${
          theme === 'dark' ? 'text-textPrimary' : 'text-textSecondary hover:text-textPrimary'
        }`}
      >
        <Moon size={13} strokeWidth={2.5} />
      </button>
    </div>
  );
}
