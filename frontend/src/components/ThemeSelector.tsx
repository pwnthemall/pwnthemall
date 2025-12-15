import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Palette } from 'lucide-react';

interface ThemeSelectorProps {
  currentTheme: string;
  onThemeChange: (themeId: string) => void;
  className?: string;
}

const AVAILABLE_THEMES = [
  { id: 'default', name: 'Default Dark', icon: '🌑' },
  { id: 'alien-invasion', name: 'Alien Invasion', icon: '🛸' },
];

export function ThemeSelector({
  currentTheme,
  onThemeChange,
  className = '',
}: ThemeSelectorProps) {
  const currentThemeData = AVAILABLE_THEMES.find(t => t.id === currentTheme) || AVAILABLE_THEMES[0];

  const handleThemeChange = (themeId: string) => {
    // Save to localStorage
    localStorage.setItem('pwnthemall-theme', themeId);
    // Reload page to apply theme
    window.location.reload();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={className}>
          <Palette className="w-4 h-4 mr-2" />
          {currentThemeData.icon} {currentThemeData.name}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Choose Theme</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {AVAILABLE_THEMES.map((theme) => (
          <DropdownMenuItem
            key={theme.id}
            onClick={() => handleThemeChange(theme.id)}
            className={currentTheme === theme.id ? 'bg-accent' : ''}
          >
            <span className="mr-2 text-lg">{theme.icon}</span>
            <span>{theme.name}</span>
            {currentTheme === theme.id && (
              <span className="ml-auto text-xs text-muted-foreground">✓ Active</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
