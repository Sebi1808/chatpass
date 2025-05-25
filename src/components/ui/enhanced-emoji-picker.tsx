"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { X, Search, Smile } from 'lucide-react';

import {
  initializeEmojiDatabase,
  searchEmojis,
  getEmojiCategories,
  getEmojisByCategory,
  getRecentEmojis,
  addToRecentEmojis,
  getEmojiVariations,
  isEmojiDatabaseReady,
  type EmojiData,
  type EmojiCategory,
  type EmojiWithVariations,
  SKIN_TONES
} from '@/lib/emoji-utils';

interface EnhancedEmojiPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onEmojiSelect: (emoji: string) => void;
  variant?: 'reaction' | 'input';
  position?: 'top' | 'bottom';
  align?: 'start' | 'center' | 'end';
  className?: string;
}

interface EmojiButtonProps {
  emoji: EmojiData;
  onClick: (emoji: EmojiData) => void;
  onVariationSelect?: (variation: string) => void;
  showTooltip?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const EmojiButton: React.FC<EmojiButtonProps> = ({ 
  emoji, 
  onClick, 
  onVariationSelect,
  showTooltip = true,
  size = 'md' 
}) => {
  const [showVariations, setShowVariations] = useState(false);
  const emojiWithVariations = getEmojiVariations(emoji);
  
  const sizeClasses = {
    sm: 'w-8 h-8 text-lg hover:scale-110',
    md: 'w-10 h-10 text-xl hover:scale-110', 
    lg: 'w-12 h-12 text-2xl hover:scale-105'
  };

  const handleClick = () => {
    onClick(emoji);
  };

  const handleLongPress = () => {
    if (emojiWithVariations.hasVariations) {
      setShowVariations(true);
    }
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        className={cn(
          "rounded-lg transition-all duration-150 p-0 border-0 hover:bg-muted/60",
          sizeClasses[size]
        )}
        onClick={handleClick}
        onMouseDown={() => {
          if (emojiWithVariations.hasVariations) {
            const timer = setTimeout(handleLongPress, 500);
            const handleMouseUp = () => {
              clearTimeout(timer);
              document.removeEventListener('mouseup', handleMouseUp);
            };
            document.addEventListener('mouseup', handleMouseUp);
          }
        }}
        title={showTooltip ? emoji.annotation : undefined}
      >
        {emoji.emoji}
      </Button>
      
      {showVariations && emojiWithVariations.hasVariations && (
        <div className="absolute bottom-full left-0 z-50 mb-1 bg-popover border rounded-lg shadow-lg p-2 flex gap-1">
          <Button
            variant="ghost" 
            className="w-8 h-8 p-0 text-lg hover:bg-muted/60"
            onClick={() => {
              onClick(emoji);
              setShowVariations(false);
            }}
          >
            {emoji.emoji}
          </Button>
          {emojiWithVariations.variations.map((variation, index) => (
            <Button
              key={index}
              variant="ghost"
              className="w-8 h-8 p-0 text-lg hover:bg-muted/60"
              onClick={() => {
                onVariationSelect?.(variation.emoji);
                setShowVariations(false);
              }}
            >
              {variation.emoji}
            </Button>
          ))}
          <Button
            variant="ghost"
            size="icon"
            className="w-6 h-6 p-0"
            onClick={() => setShowVariations(false)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
};

const SkinToneSelector: React.FC<{
  selectedEmoji: EmojiData | null;
  onVariationSelect: (variation: string) => void;
  onClose: () => void;
}> = ({ selectedEmoji, onVariationSelect, onClose }) => {
  if (!selectedEmoji) return null;
  
  const emojiWithVariations = getEmojiVariations(selectedEmoji);

  return (
    <div className="p-4 border-t bg-muted/30">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-sm">Hautton wählen</h4>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex gap-2 flex-wrap">
        <Button
          variant="ghost"
          className="h-10 w-10 p-0 rounded border hover:bg-background"
          onClick={() => onVariationSelect(selectedEmoji.emoji)}
        >
          <span className="text-lg">{selectedEmoji.emoji}</span>
        </Button>
        {emojiWithVariations.variations.map((variation, index) => (
          <Button
            key={index}
            variant="ghost"
            className="h-10 w-10 p-0 rounded border hover:bg-background"
            onClick={() => onVariationSelect(variation.emoji)}
          >
            <span className="text-lg">{variation.emoji}</span>
          </Button>
        ))}
      </div>
    </div>
  );
};

const EnhancedEmojiPicker: React.FC<EnhancedEmojiPickerProps> = ({
  isOpen,
  onClose,
  onEmojiSelect,
  variant = 'input',
  position = 'bottom',
  align = 'start',
  className
}) => {
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('frequent');
  const [selectedEmoji, setSelectedEmoji] = useState<EmojiData | null>(null);
  const [showSkinTones, setShowSkinTones] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [searchActive, setSearchActive] = useState(false);
  const [scrollPositions, setScrollPositions] = useState<{[key: string]: number}>({});
  
  // Refs für bessere Event-Behandlung
  const pickerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const emojiGridScrollRef = useRef<HTMLDivElement>(null);
  const lastOpenStateRef = useRef(isOpen);

  // Initialisiere Emoji-Datenbank
  useEffect(() => {
    const initDatabase = async () => {
      if (!isEmojiDatabaseReady()) {
        await initializeEmojiDatabase();
      }
      setIsInitialized(true);
    };
    
    if (isOpen && !isInitialized) {
      initDatabase();
    }
  }, [isOpen, isInitialized]);

  // Handle open/close state changes
  useEffect(() => {
    if (isOpen && !lastOpenStateRef.current) {
      // Just opened
      if (!isMobile && searchInputRef.current) {
        // Delay focus to avoid race conditions
        const focusTimer = setTimeout(() => {
          searchInputRef.current?.focus();
        }, 200);
        return () => clearTimeout(focusTimer);
      }
    } else if (!isOpen && lastOpenStateRef.current) {
      // Just closed - reset state
      setSearchQuery('');
      setSelectedCategory('frequent');
      setShowSkinTones(false);
      setSelectedEmoji(null);
      setSearchActive(false);
    }
    
    lastOpenStateRef.current = isOpen;
  }, [isOpen, isMobile]);

  // KOMPLETT überarbeiteter Outside-Click Handler
  useEffect(() => {
    if (!isOpen) return;

    // Für Mobile: KEIN Outside-Click Handler!
    if (isMobile) {
      console.log('[DEBUG] Mobile mode: NO outside click handler attached');
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      // Ignoriere Klicks auf den Picker selbst
      if (pickerRef.current && pickerRef.current.contains(target)) {
        console.log('[DEBUG] Click inside picker, not closing');
        return;
      }
      
      // Ignoriere Klicks auf den Trigger-Button
      const clickedElement = target as HTMLElement;
      const isEmojiTrigger = clickedElement.closest('[data-emoji-trigger="true"]');
      if (isEmojiTrigger) {
        console.log('[DEBUG] Click on emoji trigger, not closing');
        return;
      }
      
      // NEU: Ignoriere Klicks auf Hautton-Popup-Elemente
      const isSkinTonePopup = clickedElement.closest('[data-skin-tone-popup="true"]');
      if (isSkinTonePopup) {
        console.log('[DEBUG] Click on skin tone popup, not closing');
        return;
      }
      
      // Schließe den Picker (nur Desktop)
      console.log('[DEBUG] Outside click detected, closing picker');
      onClose();
    };

    // Verwende 'mousedown' statt 'click' für bessere Kontrolle
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside, true);
      console.log('[DEBUG] Outside click listener added for DESKTOP only');
    }, 50);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside, true);
      console.log('[DEBUG] Outside click listener removed');
    };
  }, [isOpen, onClose, isMobile]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const categories = useMemo(() => {
    if (!isInitialized) return [];
    return getEmojiCategories();
  }, [isInitialized]);

  const displayedEmojis = useMemo(() => {
    if (!isInitialized) return [];
    
    if (searchQuery.trim()) {
      return searchEmojis(searchQuery, 100);
    }
    
    return getEmojisByCategory(selectedCategory);
  }, [searchQuery, selectedCategory, isInitialized]);

  // Simplified Emoji-Click Handler
  const handleEmojiClick = useCallback((emoji: EmojiData) => {
    console.log('[DEBUG] EnhancedEmojiPicker handleEmojiClick called with emoji:', emoji.emoji, 'variant:', variant, 'isMobile:', isMobile);
    
    // Add to recent emojis
    addToRecentEmojis(emoji);
    
    // Call the callback
    console.log('[DEBUG] EnhancedEmojiPicker calling onEmojiSelect with:', emoji.emoji);
    onEmojiSelect(emoji.emoji);
    
    // WICHTIG: Nur bei Reaktionen schließen, niemals bei Input (auch nicht Mobile)
    if (variant === 'reaction') {
      console.log('[DEBUG] Closing picker because variant is reaction');
      onClose();
    } else {
      console.log('[DEBUG] Keeping picker open because variant is input');
    }
  }, [onEmojiSelect, onClose, variant, isMobile]);

  const handleVariationSelect = useCallback((variation: string) => {
    console.log('[DEBUG] EnhancedEmojiPicker handleVariationSelect called with:', variation, 'variant:', variant, 'isMobile:', isMobile);
    
    // Call the parent callback - this is the main functionality
    onEmojiSelect(variation);
    console.log('[DEBUG] onEmojiSelect called with variation:', variation);
    
    // WICHTIG: Auch bei Varianten nur bei Reaktionen schließen
    if (variant === 'reaction') {
      console.log('[DEBUG] Closing picker after variation because variant is reaction');
      onClose();
    } else {
      console.log('[DEBUG] Keeping picker open after variation because variant is input');
    }
    
    // Reset only accessible states (old skin tone system)
    setShowSkinTones(false);
    setSelectedEmoji(null);
    
    console.log('[DEBUG] Parent skin tone states reset');
  }, [onEmojiSelect, onClose, variant, isMobile]);

  const handleCloseSkinTones = useCallback(() => {
    setShowSkinTones(false);
    setSelectedEmoji(null);
  }, []);

  // STABILER Search Handler mit useCallback
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    console.log('[DEBUG] Search input changed to:', newValue);
    setSearchQuery(newValue);
  }, []);

  // Improved Category Change Handler
  const handleCategoryChange = useCallback((categoryId: string) => {
    console.log('[DEBUG] Category changed to:', categoryId);
    
    // Speichere aktuelle Scroll-Position
    if (emojiGridScrollRef.current) {
      setScrollPositions(prev => ({
        ...prev,
        [selectedCategory]: emojiGridScrollRef.current!.scrollTop
      }));
    }
    
    setSelectedCategory(categoryId);
    
    // Clear search when switching categories
    if (searchQuery.trim()) {
      setSearchQuery('');
      // Refocus on search input if needed
      if (searchInputRef.current && !isMobile) {
        searchInputRef.current.focus();
      }
    }
    
    // Stelle Scroll-Position der neuen Kategorie wieder her
    setTimeout(() => {
      if (emojiGridScrollRef.current) {
        const savedPosition = scrollPositions[categoryId] || 0;
        emojiGridScrollRef.current.scrollTop = savedPosition;
      }
    }, 50); // Kurze Verzögerung damit das Grid gerendert ist
    
  }, [searchQuery, isMobile, selectedCategory, scrollPositions]);

  // Memoized components to prevent re-renders
  const searchSection = useMemo(() => (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input
        ref={searchInputRef}
        type="text"
        placeholder="Emojis suchen..."
        value={searchQuery}
        onChange={handleSearchChange}
        className="pl-10"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />
    </div>
  ), [searchQuery, handleSearchChange]);

  const emojiGrid = useMemo(() => {
    const EmojiButton: React.FC<{ emoji: EmojiData }> = ({ emoji }) => {
      const variations = getEmojiVariations(emoji);
      const [showVariations, setShowVariations] = useState(false);
      const [longPressStarted, setLongPressStarted] = useState(false);
      const timerRef = useRef<NodeJS.Timeout>();
      const buttonRef = useRef<HTMLButtonElement>(null);
      
      // Simple click handler - always send emoji immediately  
      const handleClick = (e: React.MouseEvent) => {
        console.log('[DEBUG] EmojiButton handleClick START', {
          emoji: emoji.emoji,
          longPressStarted,
          variant,
          isMobile,
          timestamp: Date.now()
        });
        
        if (longPressStarted) {
          console.log('[DEBUG] Ignoring click because it was a long press');
          setLongPressStarted(false);
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        
        // Prevent ALL event propagation for mobile
        e.preventDefault();
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();
        
        console.log('[DEBUG] About to call handleEmojiClick for:', emoji.emoji);
        
        // Small delay to ensure state is stable
        setTimeout(() => {
          handleEmojiClick(emoji);
          console.log('[DEBUG] handleEmojiClick completed for:', emoji.emoji);
        }, 10);
      };
      
      // Mouse events for desktop
      const handleMouseDown = (e: React.MouseEvent) => {
        if (!variations.hasVariations) return;
        
        timerRef.current = setTimeout(() => {
          setLongPressStarted(true);
          setShowVariations(true);
        }, 300);
      };
      
      const handleMouseUp = () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
      };
      
      const handleMouseLeave = () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
        setLongPressStarted(false);
      };
      
      // Touch events for mobile
      const handleTouchStart = (e: React.TouchEvent) => {
        if (!variations.hasVariations) return;
        
        console.log('[SKIN TONE DEBUG] Touch start - showing variations popup');
        timerRef.current = setTimeout(() => {
          setLongPressStarted(true);
          setShowVariations(true);
        }, 300);
      };
      
      const handleTouchEnd = () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
      };

      // Calculate smart positioning for variations popup
      const getVariationsPosition = () => {
        if (!buttonRef.current) return { top: 0, left: 0, showTop: false };
        
        const rect = buttonRef.current.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        console.log('[SKIN TONE DEBUG] Calculating position:', {
          buttonRect: rect,
          viewport: { width: viewportWidth, height: viewportHeight },
          variationsCount: variations.variations.length
        });
        
        // Calculate popup dimensions with buffer
        const estimatedPopupWidth = (variations.variations.length + 1) * (isMobile ? 44 : 36) + 24; // Extra buffer
        const popupHeight = isMobile ? 52 : 44; // Extra buffer
        
        // Start with position below button
        let top = rect.bottom + 4;
        let left = rect.left;
        
        // Vertical positioning: above if no space below
        if (top + popupHeight > viewportHeight - 20) {
          top = rect.top - popupHeight - 4;
        }
        
        // Horizontal positioning: center on button first
        left = rect.left + (rect.width / 2) - (estimatedPopupWidth / 2);
        
        // Adjust if going off right edge
        if (left + estimatedPopupWidth > viewportWidth - 20) {
          left = rect.right - estimatedPopupWidth;
        }
        
        // Adjust if going off left edge  
        if (left < 20) {
          left = 20;
        }
        
        // Final safety checks
        top = Math.max(20, Math.min(top, viewportHeight - popupHeight - 20));
        left = Math.max(20, Math.min(left, viewportWidth - estimatedPopupWidth - 20));
        
        const finalPosition = { top, left, showTop: top < rect.top };
        console.log('[SKIN TONE DEBUG] Final position calculated:', finalPosition);
        
        return finalPosition;
      };

      const position = showVariations ? getVariationsPosition() : { top: 0, left: 0, showTop: false };

      return (
        <div className="relative">
          <Button
            ref={buttonRef}
            variant="ghost"
            className={cn(
              "p-0 rounded hover:bg-muted/50 transition-colors relative",
              isMobile ? "h-11 w-11" : "h-8 w-8"
            )}
            onClick={handleClick}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            title={`${emoji.annotation}${variations.hasVariations ? ' (Lange drücken für Hauttöne)' : ''}`}
          >
            <span className={cn("select-none", isMobile ? "text-xl" : "text-base")}>
              {emoji.emoji}
            </span>
            {/* Variations indicator */}
            {variations.hasVariations && (
              <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-blue-500 rounded-full border border-background" />
            )}
          </Button>
          
          {/* Global variations popup using portal */}
          {showVariations && variations.hasVariations && typeof document !== 'undefined' && createPortal(
            <>
              {/* Debug: Verify portal renders */}
              {console.log('[SKIN TONE DEBUG] Portal rendering with showVariations:', showVariations, 'variations count:', variations.variations.length)}
              
              {/* Backdrop */}
              <div 
                className="fixed inset-0 z-[89]" 
                style={{ pointerEvents: 'auto' }}
                data-skin-tone-popup="true"
                onClick={(e) => {
                  console.log('[SKIN TONE DEBUG] Backdrop clicked - closing variations');
                  e.stopPropagation();
                  setShowVariations(false);
                  setLongPressStarted(false);
                }}
                onMouseDown={(e) => {
                  console.log('[SKIN TONE DEBUG] Backdrop mousedown');
                  e.stopPropagation();
                }}
              />
              
              {/* Globally positioned variations panel */}
              <div 
                className="fixed z-[90] bg-popover border-2 border-border rounded-lg shadow-2xl p-3 flex gap-2 min-w-max"
                style={{
                  top: `${position.top}px`,
                  left: `${position.left}px`,
                  pointerEvents: 'auto'
                }}
                data-skin-tone-popup="true"
                onClick={(e) => {
                  console.log('[SKIN TONE DEBUG] Popup panel clicked - preventing propagation');
                  e.stopPropagation();
                }}
                onMouseDown={(e) => {
                  console.log('[SKIN TONE DEBUG] Popup panel mousedown - preventing propagation');
                  e.stopPropagation();
                }}
              >
                {/* Standard version first */}
                <Button
                  variant="ghost"
                  className={cn(
                    "p-1 rounded-md hover:bg-muted transition-all duration-150 hover:scale-105 border border-transparent hover:border-border",
                    isMobile ? "h-10 w-10" : "h-8 w-8"
                  )}
                  style={{ pointerEvents: 'auto', zIndex: 91 }}
                  data-skin-tone-popup="true"
                  onClick={(e) => {
                    console.log('[SKIN TONE DEBUG] === STANDARD EMOJI BUTTON CLICKED ===');
                    console.log('[SKIN TONE DEBUG] Standard emoji button clicked:', emoji.emoji);
                    console.log('[SKIN TONE DEBUG] Event details:', { 
                      type: e.type, 
                      target: e.target, 
                      currentTarget: e.currentTarget 
                    });
                    e.stopPropagation();
                    e.preventDefault();
                    handleVariationSelect(emoji.emoji);
                    // Reset local states here where they're accessible
                    setShowVariations(false);
                    setLongPressStarted(false);
                    console.log('[SKIN TONE DEBUG] Standard emoji button click handled, local states reset');
                  }}
                  onMouseDown={(e) => {
                    console.log('[SKIN TONE DEBUG] Standard button mousedown');
                    e.stopPropagation();
                  }}
                  title="Standard"
                >
                  <span className={cn("text-center", isMobile ? "text-lg" : "text-base")}>
                    {emoji.emoji}
                  </span>
                </Button>
                
                {/* Skin tone variations */}
                {variations.variations.map((variation, index) => (
                  <Button
                    key={index}
                    variant="ghost"
                    className={cn(
                      "p-1 rounded-md hover:bg-muted transition-all duration-150 hover:scale-105 border border-transparent hover:border-border",
                      isMobile ? "h-10 w-10" : "h-8 w-8"
                    )}
                    style={{ pointerEvents: 'auto', zIndex: 91 }}
                    data-skin-tone-popup="true"
                    onClick={(e) => {
                      console.log('[SKIN TONE DEBUG] === VARIATION BUTTON CLICKED ===');
                      console.log('[SKIN TONE DEBUG] Variation button clicked:', variation.emoji, 'description:', variation.description);
                      console.log('[SKIN TONE DEBUG] Event details:', { 
                        type: e.type, 
                        target: e.target, 
                        currentTarget: e.currentTarget 
                      });
                      e.stopPropagation();
                      e.preventDefault();
                      handleVariationSelect(variation.emoji);
                      // Reset local states here where they're accessible
                      setShowVariations(false);
                      setLongPressStarted(false);
                      console.log('[SKIN TONE DEBUG] Variation button click handled, local states reset');
                    }}
                    onMouseDown={(e) => {
                      console.log('[SKIN TONE DEBUG] Variation button mousedown:', variation.emoji);
                      e.stopPropagation();
                    }}
                    title={variation.description}
                  >
                    <span className={cn("text-center", isMobile ? "text-lg" : "text-base")}>
                      {variation.emoji}
                    </span>
                  </Button>
                ))}
              </div>
            </>,
            document.body
          )}
        </div>
      );
    };

    return (
      <div className={cn(
        "grid gap-1 p-2",
        isMobile ? "grid-cols-8" : "grid-cols-10"
      )}>
        {displayedEmojis.map((emoji, index) => (
          <EmojiButton key={`${emoji.unicode}-${index}`} emoji={emoji} />
        ))}
      </div>
    );
  }, [displayedEmojis, handleEmojiClick, handleVariationSelect, isMobile]);

  const skinToneSelector = useMemo(() => {
    if (!selectedEmoji) return null;
    
    const emojiWithVariations = getEmojiVariations(selectedEmoji);

    return (
      <div className="p-4 border-t bg-muted/30">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-sm">Hautton wählen</h4>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleCloseSkinTones}
            className="h-6 w-6 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="ghost"
            className="h-10 w-10 p-0 rounded border hover:bg-background"
            onClick={() => handleVariationSelect(selectedEmoji.emoji)}
            title="Standard"
          >
            <span className="text-lg">{selectedEmoji.emoji}</span>
          </Button>
          {emojiWithVariations.variations.map((variation, index) => (
            <Button
              key={index}
              variant="ghost"
              className="h-10 w-10 p-0 rounded border hover:bg-background"
              onClick={() => handleVariationSelect(variation.emoji)}
              title={variation.description}
            >
              <span className="text-lg">{variation.emoji}</span>
            </Button>
          ))}
        </div>
      </div>
    );
  }, [selectedEmoji, handleVariationSelect, handleCloseSkinTones]);

  if (!isOpen) return null;

  // Reaction: Zentriertes Modal über der Nachricht (für Reaktions-Emojis)
  if (variant === 'reaction') {
    return createPortal(
      <>
        {/* Backdrop */}
        <div 
          className="fixed inset-0 z-[80] bg-black/20"
          onClick={onClose}
        />
        {/* Zentriertes Modal */}
        <div 
          className="fixed inset-4 z-[81] max-w-lg max-h-[60vh] mx-auto my-auto bg-background border rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div 
            ref={pickerRef} 
            className="flex flex-col h-full"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30 flex-shrink-0">
              <h2 className="text-sm font-medium">Reaktion hinzufügen</h2>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onClose}
                className="h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>

            {/* Content - Scrollbar */}
            <div className="flex-1 overflow-hidden min-h-0">
              {searchActive && searchQuery.trim() ? (
                <div 
                  className="h-full overflow-y-auto p-2"
                  style={{ 
                    WebkitOverflowScrolling: 'touch',
                    scrollbarWidth: 'thin',
                    overscrollBehavior: 'contain'
                  }}
                >
                  {emojiGrid}
                </div>
              ) : (
                <div className="h-full flex flex-col">
                  {/* Category Tabs */}
                  <div className="px-2 py-2 border-b bg-muted/30 flex-shrink-0">
                    <div 
                      className="flex gap-1 overflow-x-auto"
                      style={{ 
                        WebkitOverflowScrolling: 'touch',
                        scrollbarWidth: 'none',
                        msOverflowStyle: 'none'
                      }}
                    >
                      {categories.slice(0, 10).map((category) => (
                        <button
                          key={category.id}
                          onClick={() => handleCategoryChange(category.id)}
                          className={cn(
                            "flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-lg transition-colors touch-manipulation",
                            selectedCategory === category.id
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-muted text-muted-foreground"
                          )}
                          title={category.nameDE}
                        >
                          {category.icon}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Emoji Grid - Scrollbar */}
                  <div 
                    ref={emojiGridScrollRef}
                    className="flex-1 overflow-y-auto p-2"
                    style={{ 
                      WebkitOverflowScrolling: 'touch',
                      scrollbarWidth: 'thin',
                      overscrollBehavior: 'contain'
                    }}
                  >
                    {emojiGrid}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </>,
      document.body
    );
  }

  // Desktop: Absolute positioning Card-Popup (für Input-Emojis)
  if (!isMobile) {
    return (
      <Card
        ref={pickerRef}
        className={cn(
          "absolute z-[70] w-80 bg-background border shadow-lg",
          position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
          align === 'start' && 'left-0',
          align === 'center' && 'left-1/2 transform -translate-x-1/2',
          align === 'end' && 'right-0',
          className
        )}
      >
        <div className="p-3 space-y-3">
          {searchSection}
          
          {searchQuery.trim() ? (
            <ScrollArea className="h-48 border rounded-md bg-background">
              {emojiGrid}
            </ScrollArea>
          ) : (
            <div>
              <Tabs value={selectedCategory} onValueChange={handleCategoryChange} className="w-full">
                <TabsList className="grid w-full grid-cols-10 h-10 bg-muted/30">
                  {categories.slice(0, 10).map((category) => (
                    <TabsTrigger
                      key={category.id}
                      value={category.id}
                      className="h-8 text-sm data-[state=active]:bg-background"
                      title={category.nameDE}
                    >
                      <span className="select-none">{category.icon}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              
              <ScrollArea className="h-48 border rounded-md bg-background mt-2">
                {emojiGrid}
              </ScrollArea>
            </div>
          )}
          
          {showSkinTones && skinToneSelector}
        </div>
      </Card>
    );
  }

  // Mobile: Splitscreen-Bereich zwischen Chat und Eingabe (nur für Input-Emojis)
  return (
    <div className="w-full h-full bg-background flex flex-col">
      <div 
        ref={pickerRef} 
        className="flex flex-col h-full"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30 flex-shrink-0">
          <h2 className="text-sm font-medium">Emoji auswählen</h2>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => {
                setSearchActive(!searchActive);
                if (!searchActive) {
                  setSearchQuery('');
                }
              }} 
              className="h-6 w-6 p-0"
            >
              <Search className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-6 w-6 p-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Search */}
        {searchActive && (
          <div className="px-4 py-2 border-b flex-shrink-0">
            {searchSection}
          </div>
        )}
        
        {/* Content mit nativen Scroll-Eigenschaften */}
        <div className="flex-1 flex flex-col min-h-0">
          {searchActive && searchQuery.trim() ? (
            <div 
              className="flex-1 overflow-y-auto p-2"
              style={{ 
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'thin',
                overscrollBehavior: 'contain'
              }}
            >
              {emojiGrid}
            </div>
          ) : (
            <>
              {/* Category Tabs */}
              <div className="px-2 py-2 border-b bg-muted/30 flex-shrink-0">
                <div 
                  className="flex gap-1 overflow-x-auto"
                  style={{ 
                    WebkitOverflowScrolling: 'touch',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none'
                  }}
                >
                  {categories.slice(0, 10).map((category) => (
                    <Button
                      key={category.id}
                      variant={selectedCategory === category.id ? "default" : "ghost"}
                      size="sm"
                      className={cn(
                        "h-8 w-8 p-0 rounded-full flex-shrink-0",
                        selectedCategory === category.id && "bg-primary text-primary-foreground"
                      )}
                      onClick={() => handleCategoryChange(category.id)}
                      title={category.nameDE}
                    >
                      <span className="text-base">{category.icon}</span>
                    </Button>
                  ))}
                </div>
              </div>
              
              {/* Emoji Grid mit nativem vertikalen Scrollen */}
              <div 
                className="flex-1 overflow-y-auto p-2"
                style={{ 
                  WebkitOverflowScrolling: 'touch',
                  scrollbarWidth: 'thin',
                  overscrollBehavior: 'contain'
                }}
                ref={emojiGridScrollRef}
              >
                {emojiGrid}
              </div>
            </>
          )}
        </div>
        
        {/* Skin Tone Selector */}
        {showSkinTones && (
          <div className="flex-shrink-0 border-t">
            {skinToneSelector}
          </div>
        )}
      </div>
    </div>
  );
};

export { EnhancedEmojiPicker }; 