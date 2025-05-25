"use client";

import React from 'react';
import { HelpCircle, Type } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { MARKDOWN_RULES } from '@/lib/markdown-utils';
import { cn } from '@/lib/utils';

interface MarkdownInfoProps {
  className?: string;
  size?: 'sm' | 'md';
}

export const MarkdownInfo: React.FC<MarkdownInfoProps> = ({ 
  className,
  size = 'sm' 
}) => {
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';
  
  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex items-center justify-center rounded-full",
              "text-muted-foreground hover:text-foreground transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
              size === 'sm' ? "h-5 w-5" : "h-6 w-6",
              className
            )}
            aria-label="Markdown-Formatierung anzeigen"
          >
            <Type className={iconSize} />
          </button>
        </TooltipTrigger>
        <TooltipContent 
          side="top" 
          align="center"
          className="max-w-xs p-3 bg-popover text-popover-foreground border shadow-md"
        >
          <div className="space-y-2">
            <div className="font-medium text-xs text-center mb-2">
              📝 Textformatierung
            </div>
            <div className="grid grid-cols-1 gap-1.5 text-xs">
              {MARKDOWN_RULES.map((rule, index) => (
                <div key={index} className="flex items-center justify-between gap-3">
                  <span className="font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {rule.example}
                  </span>
                  <span className="text-foreground">{rule.description}</span>
                </div>
              ))}
            </div>
            <div className="text-xs text-muted-foreground text-center mt-2 pt-2 border-t">
              Tipp: Formatierung wird in der Nachricht angezeigt
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}; 