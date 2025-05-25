"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, X, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { emojiCategories, type Emoji, type EmojiCategory } from '@/lib/config';

interface EmojiPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onEmojiSelect: (emoji: string) => void;
  position?: 'top' | 'bottom';
  align?: 'start' | 'center' | 'end';
  isMobile?: boolean;
  isInModal?: boolean;
  className?: string;
}

export const EmojiPicker: React.FC<EmojiPickerProps> = ({
  isOpen,
  onClose,
  onEmojiSelect,
  position = 'top',
  align = 'start',
  isMobile = false,
  isInModal = false,
  className
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>(emojiCategories[0].name);
  const [recentEmojis, setRecentEmojis] = useState<Emoji[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [hoveredEmoji, setHoveredEmoji] = useState<Emoji | null>(null);

  // Lade kürzlich verwendete Emojis
  useEffect(() => {
    const saved = localStorage.getItem('recentEmojis');
    if (saved) {
      try {
        const parsedEmojis = JSON.parse(saved) as Emoji[];
        // Stelle sicher, dass es wirklich Emoji-Objekte sind (einfache Prüfung)
        if (Array.isArray(parsedEmojis) && parsedEmojis.every(e => typeof e === 'object' && e !== null && 'char' in e && 'name' in e)) {
          setRecentEmojis(parsedEmojis);
        } else {
          localStorage.removeItem('recentEmojis'); // Ungültige Daten entfernen
        }
      } catch (e) {
        localStorage.removeItem('recentEmojis'); // Fehler beim Parsen
      }
    }
  }, []);

  // Focus auf Suchfeld wenn geöffnet
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Speichere kürzlich verwendete Emojis
  const handleEmojiClick = useCallback((emoji: Emoji) => {
    onEmojiSelect(emoji.char);
    
    // Update recent emojis
    const newRecent = [emoji, ...recentEmojis.filter(e => e.char !== emoji.char)].slice(0, 24);
    setRecentEmojis(newRecent);
    localStorage.setItem('recentEmojis', JSON.stringify(newRecent));
    
    // Clear search after selection
    setSearchQuery('');
  }, [onEmojiSelect, recentEmojis]);

  // Suche Emojis
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    
    const query = searchQuery.toLowerCase();
    const results: Emoji[] = [];
    
    emojiCategories.forEach(category => {
      category.emojis.forEach(emoji => {
        if (
          emoji.name.toLowerCase().includes(query) || 
          (emoji.keywords && emoji.keywords.some(k => k.toLowerCase().includes(query))) ||
          emoji.char.includes(query) 
        )
        {
          results.push(emoji);
        }
      });
    });
    
    return results.length > 0 ? results : null;
  }, [searchQuery]);

  if (!isOpen) return null;

  // Mobile Full-Screen Version
  if (isMobile) {
    return (
      <div className="fixed inset-0 bg-black/50 z-[60] flex items-end animate-in fade-in duration-200">
        <div className="bg-card w-full rounded-t-2xl shadow-2xl animate-in slide-in-from-bottom duration-300 pb-safe-area-inset-bottom max-h-[75vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="font-semibold text-lg">Emoji auswählen</h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-10 w-10 min-h-[44px] min-w-[44px]"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Search & Hover Info */}
          <div className="p-3 border-b">
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder={hoveredEmoji ? hoveredEmoji.name : "Emoji suchen (z.B. Lachen)"}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-12 text-base"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="h-5 text-xs text-muted-foreground text-center truncate">
              {hoveredEmoji ? hoveredEmoji.name : (searchQuery && !searchResults?.length ? "Nichts gefunden" : "")}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto min-h-0">
            {searchResults ? (
              <ScrollArea className="h-full p-3">
                <div className="grid grid-cols-6 sm:grid-cols-8 gap-1">
                  {searchResults.map(emoji => (
                    <Button
                      key={emoji.char}
                      variant="ghost"
                      className="text-2xl p-0 h-12 w-12 touch-manipulation hover:bg-muted transition-colors duration-100 rounded-lg relative group"
                      onClick={() => handleEmojiClick(emoji)}
                      onMouseEnter={() => setHoveredEmoji(emoji)}
                      onMouseLeave={() => setHoveredEmoji(null)}
                    >
                      {emoji.char}
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            ) : searchQuery ? (
              <div className="p-6 text-center text-muted-foreground">
                Keine Emojis für \"{searchQuery}\" gefunden.
              </div>
            ) : (
              <Tabs defaultValue={activeCategory} onValueChange={setActiveCategory} className="h-full flex flex-col">
                <div className="overflow-x-auto whitespace-nowrap no-scrollbar border-b">
                  <TabsList className="p-2 h-auto justify-start">
                    {recentEmojis.length > 0 && (
                      <TabsTrigger value="recent" className="text-2xl px-3 py-2 h-auto data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                        <Clock className="h-5 w-5" />
                      </TabsTrigger>
                    )}
                    {emojiCategories.map(category => (
                      <TabsTrigger 
                        key={category.name} 
                        value={category.name} 
                        className="text-2xl px-3 py-2 h-auto data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
                      >
                        {category.icon}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>

                {recentEmojis.length > 0 && (
                  <TabsContent value="recent" className="flex-1 overflow-auto p-3">
                    <div className="grid grid-cols-6 sm:grid-cols-8 gap-1">
                      {recentEmojis.map(emoji => (
                          <Button
                            key={emoji.char}
                            variant="ghost"
                            className="text-2xl p-0 h-12 w-12 touch-manipulation hover:bg-muted transition-colors duration-100 rounded-lg relative group"
                            onClick={() => handleEmojiClick(emoji)}
                            onMouseEnter={() => setHoveredEmoji(emoji)}
                            onMouseLeave={() => setHoveredEmoji(null)}
                          >
                            {emoji.char}
                          </Button>
                        ))}
                    </div>
                  </TabsContent>
                )}

                {emojiCategories.map(category => (
                  <TabsContent key={category.name} value={category.name} className="flex-1 overflow-auto p-3">
                    <div className="grid grid-cols-6 sm:grid-cols-8 gap-1">
                      {category.emojis.map(emoji => (
                        <Button
                          key={emoji.char}
                          variant="ghost"
                          className="text-2xl p-0 h-12 w-12 touch-manipulation hover:bg-muted transition-colors duration-100 rounded-lg relative group"
                          onClick={() => handleEmojiClick(emoji)}
                          onMouseEnter={() => setHoveredEmoji(emoji)}
                          onMouseLeave={() => setHoveredEmoji(null)}
                        >
                          {emoji.char}
                        </Button>
                      ))}
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            )}
          </div>
           {/* Hover-Info-Leiste unten (nur Desktop, hier für Mobile ggf. anpassen oder weglassen) */}
           <div className="p-2 border-t text-center text-sm text-muted-foreground truncate">
            {hoveredEmoji ? hoveredEmoji.name : (searchQuery && !searchResults?.length ? "Nichts gefunden" : "")}
          </div>
        </div>
      </div>
    );
  }

  // Desktop Popover Version
  return (
    <Card className={cn(
      isInModal ? "fixed z-[70]" : "absolute z-50",
      "w-[350px] shadow-2xl border bg-card overflow-hidden rounded-xl",
      !isInModal && position === 'top' ? 'bottom-full mb-2' : '',
      !isInModal && position === 'bottom' ? 'top-full mt-2' : '',
      !isInModal && align === 'start' && 'left-0',
      !isInModal && align === 'center' && 'left-1/2 -translate-x-1/2',
      !isInModal && align === 'end' && 'right-0',
      isInModal && 'left-1/2 -translate-x-1/2 bottom-20',
      className
    )}>
      {/* Header mit Suche */}
      <div className="p-2.5 border-b">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            placeholder="Emoji suchen (z.B. Lachen)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-8 h-8 text-sm rounded-md"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSearchQuery('')}
              className="absolute right-0.5 top-1/2 transform -translate-y-1/2 h-7 w-7"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Emoji Content */}
      <div className="h-[280px]">
        {searchQuery ? (
          <ScrollArea className="h-full p-2.5">
            <div className="grid grid-cols-9 gap-0.5">
              {searchResults ? (
                searchResults.map(emoji => (
                  <Button
                    key={emoji.char}
                    variant="ghost"
                    className="text-xl p-0 h-8 w-8 hover:bg-muted transition-colors duration-100 rounded-md relative group"
                    onClick={() => handleEmojiClick(emoji)}
                    onMouseEnter={() => setHoveredEmoji(emoji)}
                    onMouseLeave={() => setHoveredEmoji(null)}
                  >
                    {emoji.char}
                  </Button>
                ))
              ) : (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Keine Emojis für \"{searchQuery}\" gefunden.
                </div>
              )}
            </div>
          </ScrollArea>
        ) : (
          <Tabs defaultValue={activeCategory} onValueChange={setActiveCategory} className="h-full flex flex-col">
            <div className="overflow-x-auto whitespace-nowrap no-scrollbar border-b">
                <TabsList className="p-1.5 h-auto justify-start">
                    {recentEmojis.length > 0 && (
                        <TabsTrigger value="recent" className="text-xl p-1.5 h-auto data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                            <Clock className="h-4 w-4" />
                        </TabsTrigger>
                    )}
                    {emojiCategories.map(category => (
                        <TabsTrigger 
                            key={category.name} 
                            value={category.name} 
                            className="text-xl p-1.5 h-auto data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                            {category.icon}
                        </TabsTrigger>
                    ))}
                </TabsList>
            </div>
            <div className="flex-1 min-h-0">
              {recentEmojis.length > 0 && (
                <TabsContent value="recent" className="h-full mt-0">
                  <ScrollArea className="h-full p-2.5">
                    <div className="grid grid-cols-9 gap-0.5">
                      {recentEmojis.map(emoji => (
                          <Button
                            key={emoji.char}
                            variant="ghost"
                            className="text-xl p-0 h-8 w-8 hover:bg-muted transition-colors duration-100 rounded-md relative group"
                            onClick={() => handleEmojiClick(emoji)}
                            onMouseEnter={() => setHoveredEmoji(emoji)}
                            onMouseLeave={() => setHoveredEmoji(null)}
                          >
                            {emoji.char}
                          </Button>
                        ))}
                    </div>
                  </ScrollArea>
                </TabsContent>
              )}

              {emojiCategories.map(category => (
                <TabsContent key={category.name} value={category.name} className="h-full mt-0">
                  <ScrollArea className="h-full p-2.5">
                    <div className="grid grid-cols-9 gap-0.5">
                      {category.emojis.map(emoji => (
                        <Button
                          key={emoji.char}
                          variant="ghost"
                          className="text-xl p-0 h-8 w-8 hover:bg-muted transition-colors duration-100 rounded-md relative group"
                          onClick={() => handleEmojiClick(emoji)}
                          onMouseEnter={() => setHoveredEmoji(emoji)}
                          onMouseLeave={() => setHoveredEmoji(null)}
                        >
                          {emoji.char}
                        </Button>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>
              ))}
            </div>
          </Tabs>
        )}
      </div>

      {/* Footer mit Hover-Info und Schließen-Button */}
      <div className="p-1.5 border-t flex justify-between items-center">
        <span className="text-xs text-muted-foreground truncate pl-1.5 w-[calc(100%-80px)]">
          {hoveredEmoji ? hoveredEmoji.name : (searchQuery && !searchResults?.length ? "Nichts gefunden" : "")}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="text-xs h-7 px-2 rounded-md flex-shrink-0"
        >
          Schließen
        </Button>
      </div>
    </Card>
  );
}; 