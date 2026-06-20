import React from 'react';
import { useTheme } from './ThemeProvider';
import { Sun, Moon, Monitor } from 'lucide-react';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    if (theme === 'light') {
      setTheme('dark');
    } else if (theme === 'dark') {
      setTheme('system');
    } else {
      setTheme('light');
    }
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={`Theme: ${theme === 'light' ? 'Light' : theme === 'dark' ? 'Dark' : 'System'}. Click to cycle.`}
      className="p-2 bg-elevated hover:bg-card border border-border rounded-custom text-textSecondary hover:text-textPrimary transition-all duration-150 shrink-0 flex items-center justify-center"
    >
      {theme === 'light' && <Sun size={14} strokeWidth={2.5} />}
      {theme === 'dark' && <Moon size={14} strokeWidth={2.5} />}
      {theme === 'system' && <Monitor size={14} strokeWidth={2.5} />}
    </button>
  );
}
