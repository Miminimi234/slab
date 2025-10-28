import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Palette, Check } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useTheme } from '@/contexts/ThemeContext';
import { themes, Theme } from '@/lib/themes';

export function ThemeSwitcher() {
  const { currentTheme, setTheme, availableThemes } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const handleThemeChange = (theme: Theme) => {
    setTheme(theme);
    setIsOpen(false);
  };

  // Calculate optimal popup position
  useEffect(() => {
    if (isOpen && buttonRef.current && popupRef.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const popupRect = popupRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      // Popup dimensions (approximate)
      const popupWidth = 256; // w-64 = 16rem = 256px
      const popupHeight = 300; // Approximate height
      
      let x = 0;
      let y = -popupHeight - 12; // Default: above the button
      
      // Check if popup would go off the right edge
      if (buttonRect.left + popupWidth > viewportWidth) {
        x = viewportWidth - buttonRect.right - popupWidth;
      }
      
      // Check if popup would go off the left edge
      if (buttonRect.left + x < 0) {
        x = -buttonRect.left + 8; // 8px margin from left edge
      }
      
      // Check if popup would go off the top edge
      if (buttonRect.top + y < 0) {
        y = buttonRect.height + 12; // Position below the button instead
      }
      
      setPopupPosition({ x, y });
    }
  }, [isOpen]);

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isOpen && buttonRef.current && popupRef.current) {
        const target = event.target as Node;
        if (!buttonRef.current.contains(target) && !popupRef.current.contains(target)) {
          setIsOpen(false);
        }
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="p-1 text-muted-foreground hover:text-foreground transition-colors"
        title="Change theme"
      >
        <Palette className="w-4 h-4" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={popupRef}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute z-50"
            style={{
              left: popupPosition.x,
              top: popupPosition.y,
            }}
          >
            <Card className="p-3 w-64 bg-card border shadow-lg">
              <div className="space-y-3">
                <h3 className="font-semibold text-sm">Choose Theme</h3>
                <div className="grid grid-cols-2 gap-2">
                  {availableThemes.map((theme) => {
                    const themeConfig = themes[theme];
                    const isSelected = currentTheme === theme;
                    
                    return (
                      <button
                        key={theme}
                        onClick={() => handleThemeChange(theme)}
                        className={`relative p-3 rounded-lg border transition-all ${
                          isSelected 
                            ? 'border-primary bg-primary/10' 
                            : 'border-border hover:border-primary/50 hover:bg-muted/50'
                        }`}
                      >
                        <div className="space-y-2">
                          {/* Color Preview */}
                          <div className="flex gap-1">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: `hsl(${themeConfig.colors.primary})` }}
                            />
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: `hsl(${themeConfig.colors.secondary})` }}
                            />
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: `hsl(${themeConfig.colors.accent})` }}
                            />
                          </div>
                          
                          {/* Theme Info */}
                          <div className="text-left">
                            <p className="text-sm font-medium">{themeConfig.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {themeConfig.description}
                            </p>
                          </div>
                          
                          {/* Selection Indicator */}
                          {isSelected && (
                            <div className="absolute top-2 right-2">
                              <Check className="w-4 h-4 text-primary" />
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
