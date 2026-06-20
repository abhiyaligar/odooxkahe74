import React from 'react';
import { useTheme } from './ThemeProvider';
import { Sun, Moon } from 'lucide-react';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex bg-elevated border border-border p-0.5 rounded-custom text-textSecondary shrink-0">
      <button
        type="button"
        onClick={() => setTheme('light')}
        title="Light Mode"
        className={`p-1.5 rounded-custom transition-all duration-150 ${
          theme === 'light'
            ? 'bg-card text-textPrimary shadow-sm border border-border/40'
            : 'hover:text-textPrimary border border-transparent'
        }`}
      >
        <Sun size={13} strokeWidth={2.5} />
      </button>
      <button
        type="button"
        onClick={() => setTheme('dark')}
        title="Dark Mode"
        className={`p-1.5 rounded-custom transition-all duration-150 ${
          theme === 'dark'
            ? 'bg-card text-textPrimary shadow-sm border border-border/40'
            : 'hover:text-textPrimary border border-transparent'
        }`}
      >
        <Moon size={13} strokeWidth={2.5} />
      </button>
    </div>
  );
}
