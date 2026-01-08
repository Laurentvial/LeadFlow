import React from 'react';
import { useTheme } from 'next-themes';
import { Button } from './ui/button';
import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isLocalhost, setIsLocalhost] = useState(false);

  // useEffect only runs on the client, so now we can safely show the UI
  useEffect(() => {
    setMounted(true);
    // Check if running on localhost
    const hostname = window.location.hostname;
    setIsLocalhost(hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '');
  }, []);

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="header-button"
        aria-label="Toggle theme"
      >
        <Sun className="header-icon" />
      </Button>
    );
  }

  // On localhost: show working toggle button for testing
  if (isLocalhost) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="header-button"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? (
          <Sun className="header-icon" />
        ) : (
          <Moon className="header-icon" />
        )}
      </Button>
    );
  }

  // On production: show disabled "À venir" button
  return (
    <Button
      variant="ghost"
      className="header-button"
      disabled
      aria-label="Dark mode - À venir"
      title="Dark mode - À venir"
      style={{ cursor: 'not-allowed', opacity: 0.6 }}
    >
      <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>À venir</span>
    </Button>
  );
}

