"use client";

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Users, MessageSquare, Settings, X, Menu, ChevronUp, ArrowLeft, Sun, Moon, AlertTriangle, Loader2 } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import type { Participant } from '@/lib/types';
import { useTheme } from 'next-themes';

interface MobileChatLayoutProps {
  children: React.ReactNode;
  sidebar: React.ReactNode;
  messageInput: React.ReactNode;
  participants: Participant[];
  unreadDms: number;
  showModeratorOverview?: () => void;
  currentUserBadges?: ('admin' | 'moderator')[];
  reportedMessagesCount?: number;
  currentParticipantDetails?: Participant | null;
  penaltyTimeRemaining?: string | null;
  adminBroadcastInboxMessages?: any[];
  unreadAdminBroadcastCount?: number;
  showInbox?: () => void;
  showAdminBroadcastInboxModal?: () => void;
  userRole?: string;
  roleDescription?: string;
}

export const MobileChatLayout = ({ 
  children, 
  sidebar, 
  messageInput, 
  participants, 
  unreadDms,
  showModeratorOverview,
  currentUserBadges,
  reportedMessagesCount = 0,
  currentParticipantDetails,
  penaltyTimeRemaining,
  adminBroadcastInboxMessages = [],
  unreadAdminBroadcastCount = 0,
  showInbox,
  showAdminBroadcastInboxModal,
  userRole,
  roleDescription
}: MobileChatLayoutProps) => {
  const isMobile = useIsMobile();
  const [showMobileParticipants, setShowMobileParticipants] = useState(false);
  const [showUserInfo, setShowUserInfo] = useState(false);
  const { theme, setTheme } = useTheme();

  // Mobile: Bottom Navigation + Slide-up Sheets
  if (isMobile) {
    return (
      <div className="flex flex-col h-[100dvh] max-h-[100dvh] bg-background overscroll-none">
        {/* Mobile Header with User Info */}
        <div className="border-b bg-card shadow-sm z-10 pt-safe-area-inset-top">
          {/* Top Bar */}
          <div className="flex items-center justify-between p-3">
            <div className="flex items-center gap-3">
              <h1 className="font-semibold text-lg">Chat</h1>
              <Button 
                variant="outline" 
                className="text-xs h-auto py-1 px-2 touch-manipulation"
                onClick={() => {
                  setShowMobileParticipants(true);
                  setShowUserInfo(false);
                }}
              >
                {participants.length} Online
              </Button>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Theme Toggle */}
              <Button
                variant="ghost"
                size="sm"
                className="h-10 w-10 min-h-[44px] min-w-[44px] touch-manipulation"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              >
                {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </Button>
              
              {/* User Info Button */}
              <Button
                variant="ghost"
                size="sm"
                className="h-10 w-10 min-h-[44px] min-w-[44px] touch-manipulation"
                onClick={() => setShowUserInfo(!showUserInfo)}
              >
                <Menu className="h-5 w-5" />
              </Button>
            </div>
          </div>
          
          {/* Expandable User Info */}
          {showUserInfo && currentParticipantDetails && (
            <div className="p-3 border-t bg-muted/30 animate-in slide-in-from-top duration-200">
              {/* User Info */}
              <div className="flex items-center gap-3 mb-3">
                <Avatar className="h-10 w-10 border-2 border-border">
                  <AvatarImage 
                    src={`https://placehold.co/40x40.png?text=${currentParticipantDetails.avatarFallback}`} 
                    alt={currentParticipantDetails.displayName} 
                  />
                  <AvatarFallback className="font-bold text-sm">
                    {currentParticipantDetails.avatarFallback}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{currentParticipantDetails.displayName}</p>
                  <p className="text-xs text-muted-foreground">{userRole || currentParticipantDetails.role}</p>
                </div>
              </div>

              {/* Status */}
              <div className="space-y-2 text-sm">
                {currentParticipantDetails.isMuted && !currentParticipantDetails.activePenalty && (
                  <Badge variant="destructive" className="text-xs">Stumm</Badge>
                )}
                {currentParticipantDetails.activePenalty && (
                  <Badge 
                    variant={currentParticipantDetails.activePenalty.type === 'red' ? "destructive" : "default"} 
                    className={cn("text-xs", currentParticipantDetails.activePenalty.type === 'yellow' && "bg-yellow-500 text-black")}
                  >
                    {currentParticipantDetails.activePenalty.description} 
                    {penaltyTimeRemaining && (
                      <span className="ml-1.5 flex items-center">
                        <Loader2 className="h-3 w-3 animate-spin mr-1" /> 
                        {penaltyTimeRemaining}
                      </span>
                    )}
                  </Badge>
                )}
                {!currentParticipantDetails.isMuted && !currentParticipantDetails.activePenalty && (
                  <Badge variant="default" className="text-xs bg-green-500">Aktiv</Badge>
                )}
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-2 gap-2 mt-3">
                {/* Inbox Button */}
                <Button 
                  variant="outline" 
                  size="sm"
                  className="h-10 text-xs relative"
                  onClick={() => {
                    showInbox?.();
                    setShowUserInfo(false);
                  }}
                >
                  <MessageSquare className="h-4 w-4 mr-1.5" />
                  Nachrichten
                  {unreadDms > 0 && (
                    <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 text-xs">
                      {unreadDms}
                    </Badge>
                  )}
                </Button>

                {/* Admin Messages */}
                {adminBroadcastInboxMessages.length > 0 && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    className={cn(
                      "h-10 text-xs relative",
                      unreadAdminBroadcastCount > 0 && "border-red-500 bg-red-50 dark:bg-red-950/20"
                    )}
                    onClick={() => {
                      showAdminBroadcastInboxModal?.();
                      setShowUserInfo(false);
                    }}
                  >
                    <AlertTriangle className="h-4 w-4 mr-1.5 text-red-500" />
                    Admin
                    {unreadAdminBroadcastCount > 0 && (
                      <span className="ml-1 h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>
                    )}
                  </Button>
                )}

                {/* Participants */}
                <Button 
                  variant="outline" 
                  size="sm"
                  className="h-10 text-xs"
                  onClick={() => {
                    setShowMobileParticipants(true);
                    setShowUserInfo(false);
                  }}
                >
                  <Users className="h-4 w-4 mr-1.5" />
                  Teilnehmer
                </Button>

                {/* Moderation */}
                {currentUserBadges?.length && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="h-10 text-xs relative"
                    onClick={() => {
                      showModeratorOverview?.();
                      setShowUserInfo(false);
                    }}
                  >
                    <Settings className="h-4 w-4 mr-1.5" />
                    Moderation
                    {reportedMessagesCount > 0 && (
                      <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 text-xs">
                        {reportedMessagesCount}
                      </Badge>
                    )}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Chat Messages Area - Full Height */}
        <div className="flex-1 relative overflow-hidden">
          {children}
        </div>

        {/* Message Input - Fixed Bottom */}
        <div className="border-t bg-background pb-safe-area-inset-bottom">
          {messageInput}
        </div>

        {/* Mobile Participants Bottom Sheet */}
        {showMobileParticipants && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/50 z-50 touch-manipulation"
              onClick={() => setShowMobileParticipants(false)}
            />
            
            {/* Bottom Sheet */}
            <div className="fixed bottom-0 left-0 right-0 bg-card rounded-t-2xl shadow-2xl z-50 max-h-[85dvh] animate-in slide-in-from-bottom duration-300 pb-safe-area-inset-bottom">
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-12 h-1 bg-muted-foreground/30 rounded-full" />
              </div>
              
              {/* Header */}
              <div className="flex items-center justify-between px-4 pb-3 border-b">
                <h3 className="font-semibold text-lg">Teilnehmer ({participants.length})</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowMobileParticipants(false)}
                  className="h-10 w-10 min-h-[44px] min-w-[44px] touch-manipulation"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
              
              {/* Participants List */}
              <div className="overflow-y-auto max-h-[70dvh] px-4 py-2">
                {sidebar}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // Desktop: Original Layout with Theme Toggle
  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className="w-64 md:w-72 lg:w-80 border-r flex flex-col bg-muted/40">
        {/* Theme Toggle in Desktop Sidebar */}
        <div className="p-3 border-b flex justify-between items-center">
          <h2 className="font-semibold">Chat</h2>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
        <div className="flex-1 overflow-hidden">
          {sidebar}
        </div>
      </div>
      
      {/* Desktop Chat Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {children}
        {messageInput}
      </div>
    </div>
  );
}; 