"use client";

import { memo, useMemo, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from '@/lib/utils';
import type { Scenario, DisplayParticipant, Participant } from "@/lib/types";
import type { ParticipantColor } from '@/lib/config';
import { Bot as BotIcon, User, VolumeX, ShieldCheck, Crown, Loader2, Info, Send, UserCircle, Bot, Users, Search, UserCog, Ban, MoreVertical, EyeOff, MessagesSquare, Clock, Settings, Shield, UserX, AlertTriangle, AlertCircle, Check, MessageSquare } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from '../ui/button';
import type { SessionData } from "@/lib/types";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { useToast } from '@/hooks/use-toast';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

interface ChatSidebarProps {
  participants: DisplayParticipant[];
  isLoadingParticipants: boolean;
  currentUserId: string | null;
  getParticipantColorClasses: (pUserId?: string, pSenderType?: 'admin' | 'user' | 'bot' | 'system') => ParticipantColor;
  isAdminView?: boolean;
  onInitiateDm?: (participant: Participant) => void;
  currentUserBadges?: ('admin' | 'moderator')[];
  onApplyPenalty?: (participantId: string, penaltyType: 'yellow' | 'red') => void;
  onAssignBadge?: (participantId: string, badgeType: 'admin' | 'moderator') => Promise<void>;
  onRemoveBadge?: (participantId: string, badgeType: 'admin' | 'moderator') => Promise<void>;
  onToggleMute?: (participantId: string) => Promise<void>;
  onRemoveParticipant?: (participantId: string) => Promise<void>;
  onClearAllBlurs?: () => Promise<void>;
  onAdjustCooldown?: (seconds: number) => Promise<void>;
  currentCooldown?: number;
  onShowModeratorOverview?: () => void;
  onShowParticipantMessages?: (participant: Participant) => void;
  reportedMessagesCount?: number;
  onToggleBlockUser?: (participantId: string) => Promise<void>;
  blockedUserIds?: string[];
}

interface UserInfoBoxProps {
  scenarioTitle: string;
  sessionStatus: SessionData['status'];
  userDisplayName: string;
  userRole: string;
  isMuted: boolean;
  activePenalty: Participant['activePenalty'] | null | undefined;
  penaltyTimeRemaining: string | null;
  assignedBadges?: ('admin' | 'moderator')[];
  cooldownRemainingSeconds: number | null;
  messageCooldownSeconds: number;
  onToggleMute?: (participantId: string) => Promise<void>;
  onRemoveParticipant?: (participantId: string) => Promise<void>;
  onClearAllBlurs?: () => Promise<void>;
  onAdjustCooldown?: (seconds: number) => Promise<void>;
  currentCooldown?: number; // KEIN Komma, KEINE Zuweisung
  onShowModeratorOverview?: () => void;
  onShowParticipantMessages?: (participant: Participant) => void;
  reportedMessagesCount?: number;
  onToggleBlockUser?: (participantId: string) => Promise<void>;
  blockedUserIds?: string[]; // KEIN Komma, KEINE Zuweisung
}

const ChatSidebar = memo(function ChatSidebar({
  participants,
  isLoadingParticipants,
  currentUserId,
  getParticipantColorClasses,
  isAdminView = false,
  onInitiateDm,
  currentUserBadges,
  onApplyPenalty,
  onAssignBadge,
  onRemoveBadge,
  onToggleMute,
  onRemoveParticipant,
  onClearAllBlurs,
  onAdjustCooldown,
  currentCooldown,
  onShowModeratorOverview,
  onShowParticipantMessages,
  reportedMessagesCount,
  onToggleBlockUser,
  blockedUserIds = []
}: ChatSidebarProps) {
  const { toast } = useToast();
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showCooldownDialog, setShowCooldownDialog] = useState(false);
  const [newCooldownValue, setNewCooldownValue] = useState(currentCooldown || 0);
  const [pendingAction, setPendingAction] = useState<{participantId?: string, action?: string} | null>(null);
  const [showRemoveConfirmDialog, setShowRemoveConfirmDialog] = useState(false);
  
  const isAdmin = currentUserBadges?.includes('admin');
  const isModerator = currentUserBadges?.includes('moderator');
  const hasModPermissions = isAdmin || isModerator;

  const handleClearAllBlurs = async () => {
    if (onClearAllBlurs) {
      try {
        await onClearAllBlurs();
        toast({
          title: "Erfolgreich",
          description: "Alle Blur-Markierungen wurden entfernt.",
        });
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Fehler",
          description: "Blur-Markierungen konnten nicht entfernt werden.",
        });
      }
    } else {
      toast({
        variant: "destructive",
        title: "Keine Berechtigung",
        description: "Diese Aktion ist nicht verfügbar.",
      });
    }
  };

  const handleAdjustCooldown = () => {
    setShowCooldownDialog(true);
  };
  
  const handleSaveCooldown = async () => {
    if (onAdjustCooldown) {
      try {
        await onAdjustCooldown(newCooldownValue);
        toast({
          title: "Cooldown angepasst",
          description: `Nachrichten-Cooldown wurde auf ${newCooldownValue} Sekunden gesetzt.`,
        });
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Fehler",
          description: "Cooldown konnte nicht angepasst werden.",
        });
      }
    } else {
      toast({
        variant: "destructive",
        title: "Keine Berechtigung",
        description: "Diese Aktion ist nicht verfügbar.",
      });
    }
    setShowCooldownDialog(false);
  };

  const handleAssignModeratorBadge = async (participantId: string) => {
    if (onAssignBadge) {
      try {
        await onAssignBadge(participantId, 'moderator');
        toast({
          title: "Badge zugewiesen",
          description: "Moderator-Badge wurde zugewiesen.",
        });
      } catch (error) {
        toast({
          variant: "destructive", 
          title: "Fehler",
          description: "Badge konnte nicht zugewiesen werden.",
        });
      }
    } else {
      toast({
        variant: "destructive",
        title: "Keine Berechtigung",
        description: "Diese Aktion ist nicht verfügbar.",
      });
    }
  };
  
  const handleToggleMute = async (participantId: string, isMuted: boolean) => {
    if (onToggleMute) {
      try {
        await onToggleMute(participantId);
        toast({
          title: isMuted ? "Stummschaltung aufgehoben" : "Teilnehmer stummgeschaltet",
          description: `Stummschaltung wurde ${isMuted ? 'aufgehoben' : 'aktiviert'}.`,
        });
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Fehler",
          description: "Stummschaltung konnte nicht geändert werden.",
        });
      }
    } else {
      toast({
        variant: "destructive",
        title: "Keine Berechtigung",
        description: "Diese Aktion ist nicht verfügbar.",
      });
    }
  };
  
  const confirmRemoveParticipant = (participantId: string) => {
    setPendingAction({participantId, action: 'remove'});
    setShowRemoveConfirmDialog(true);
  };
  
  const handleRemoveParticipant = async () => {
    if (!pendingAction?.participantId) return;
    
    if (onRemoveParticipant) {
      try {
        await onRemoveParticipant(pendingAction.participantId);
        toast({
          title: "Teilnehmer entfernt",
          description: "Der Teilnehmer wurde aus dem Chat entfernt.",
        });
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Fehler",
          description: "Teilnehmer konnte nicht entfernt werden.",
        });
      }
    } else {
      toast({
        variant: "destructive",
        title: "Keine Berechtigung",
        description: "Diese Aktion ist nicht verfügbar.",
      });
    }
    
    setPendingAction(null);
    setShowRemoveConfirmDialog(false);
  };

  return (
    <>
      <div className="flex items-center justify-between pl-2 pt-2 pr-2">
        <h2 className="text-lg font-semibold">Teilnehmende ({isLoadingParticipants ? '...' : participants.filter(p => p.isBot ? isAdminView : true).length})</h2>
        
        {/* Admin Control Panel Toggle */}
        {hasModPermissions && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className={cn(
                      "flex gap-1.5 items-center h-8",
                      isAdmin ? "border-pink-500 text-pink-500" : "border-yellow-400 text-yellow-500"
                    )}>
                      <Shield className="h-4 w-4" />
                      <span className="text-xs">{isAdmin ? "Admin" : "Moderator"}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Moderations-Funktionen</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    
                    {isAdmin && (
                      <>
                        <DropdownMenuItem onClick={handleClearAllBlurs} className="cursor-pointer">
                          <EyeOff className="mr-2 h-4 w-4" />
                          <span>Alle Blurs aufheben</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleAdjustCooldown} className="cursor-pointer">
                          <Clock className="mr-2 h-4 w-4" />
                          <span>Cooldown anpassen</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    
                    <DropdownMenuItem 
                      onClick={() => {
                        if (onShowModeratorOverview) {
                          onShowModeratorOverview();
                        } else {
                          toast({title: "Hinweis", description: "Moderationsübersicht wird angezeigt"});
                        }
                      }}
                      className="cursor-pointer relative"
                    >
                      <MessagesSquare className="mr-2 h-4 w-4" />
                      <span>Moderationsübersicht</span>
                      {reportedMessagesCount && reportedMessagesCount > 0 && (
                        <span className="absolute top-1 right-1 flex h-3 w-3 items-center justify-center rounded-full bg-red-500 text-[0.6rem] text-white p-0.5">
                          {reportedMessagesCount > 9 ? '9+' : reportedMessagesCount}
                        </span>
                      )}
                    </DropdownMenuItem>
                    
                    <DropdownMenuItem
                      onClick={() => toast({title: "Hinweis", description: "Weitere Einstellungen werden geöffnet"})}
                      className="cursor-pointer"
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Weitere Einstellungen</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TooltipTrigger>
              <TooltipContent>
                <p>Moderationsfunktionen</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      
      <ScrollArea className="flex-1 pb-2">
        <div className="space-y-3 py-2 px-2">
          {isLoadingParticipants ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
              <p className="text-sm text-muted-foreground">Lade Teilnehmer...</p>
            </div>
          ) : (!participants || participants.filter(p => p.isBot ? isAdminView : true).length === 0) ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Noch keine Teilnehmer beigetreten.</p>
          ) : (
            participants.map((p) => {
              if (p.isBot && !isAdminView) return null;

              const pColor = getParticipantColorClasses(p.userId, p.isBot ? 'bot' : (p.userId === currentUserId && isAdminView ? 'admin' : 'user'));
              const isAdminParticipant = p.userId === currentUserId && isAdminView;
              const isCurrentParticipantMuted = p.isMuted ?? false;
              const participantIsAdmin = p.assignedBadges?.includes('admin');
              const participantIsModerator = p.assignedBadges?.includes('moderator');
              const participantHasPrivileges = participantIsAdmin || participantIsModerator;
              const isBlockedByCurrentUser = blockedUserIds.includes(p.userId);

              return (
                <div key={p.id} className={cn(
                  "flex items-center gap-3 p-2 rounded-md hover:bg-muted/80 dark:hover:bg-muted/50 transition-colors",
                  isBlockedByCurrentUser && "opacity-60 hover:opacity-75"
                )}>
                  <Avatar className={cn("h-9 w-9 border-2", pColor.ring)}>
                    <AvatarImage src={`https://placehold.co/40x40.png?text=${p.avatarFallback}`} alt={p.displayName} data-ai-hint="person user"/>
                    <AvatarFallback className={cn("font-semibold", pColor.bg, pColor.text)}>{p.avatarFallback}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium flex items-center flex-wrap">
                      <span className={cn("truncate", pColor.nameText)}>{p.displayName}</span>
                      {p.isBot && <Badge variant="outline" className="ml-1.5 text-xs px-1.5 py-0.5 h-5 leading-tight bg-purple-600/90 dark:bg-purple-700 text-white border border-purple-700/50 dark:border-purple-900/50 shadow-sm flex items-center gap-1"><BotIcon className="h-3 w-3" />BOT</Badge>}
                      {isAdminParticipant && <Badge variant="outline" className="ml-1.5 text-xs px-1.5 py-0.5 h-5 leading-tight bg-red-600/90 dark:bg-red-700 text-white border border-red-700/50 dark:border-red-900/50 shadow-sm flex items-center gap-1"><Crown className="h-3 w-3" />ADMIN</Badge>}
                      {p.userId === currentUserId && !isAdminView && <Badge variant="secondary" className="ml-1.5 text-xs px-1.5 py-0">Du</Badge>}
                      {isCurrentParticipantMuted && !p.isBot && <VolumeX className="inline h-3 w-3 text-destructive ml-1.5" />}
                      {isBlockedByCurrentUser && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Ban className="inline h-3 w-3 text-red-500 ml-1.5 cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Von dir blockiert</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      
                      {p.assignedBadges?.map(badge => (
                        <Badge
                          key={badge}
                          variant="default"
                          className={cn(
                            "ml-1.5 text-xs px-1.5 py-0.5 h-5 leading-tight shadow-sm flex items-center gap-1",
                            badge === 'admin' && "bg-pink-600/90 dark:bg-pink-500 hover:bg-pink-700/90 dark:hover:bg-pink-600 text-white",
                            badge === 'moderator' && "bg-amber-600/90 dark:bg-yellow-400 hover:bg-amber-700/90 dark:hover:bg-yellow-500 text-white dark:text-black"
                          )}
                          title={`${badge.charAt(0).toUpperCase() + badge.slice(1)}-Badge`}
                        >
                          {badge === 'admin' ? <Crown className="h-3 w-3"/> : <ShieldCheck className="h-3 w-3"/>}
                        </Badge>
                      ))}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{p.role}</p>
                    
                    {/* Penalty Badge */}
                    {p.activePenalty && (
                      <Badge variant={p.activePenalty.type === 'red' ? "destructive" : "default"}
                        className={cn(
                          "mt-1 text-xs",
                          p.activePenalty.type === 'yellow' && "bg-amber-600/90 dark:bg-yellow-500 text-white dark:text-black"
                        )}
                      >
                        {p.activePenalty.type === 'yellow' ? 'Gelbe Karte' : 'Rote Karte'}
                      </Badge>
                    )}
                  </div>
                  
                  {/* Action Buttons Container */}
                  <div className="flex items-center gap-1.5">
                    {/* Direct Message Button */}
                    {p.userId !== currentUserId && onInitiateDm && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="h-7 w-7 p-1 text-muted-foreground hover:text-primary"
                              onClick={(e) => { 
                                e.stopPropagation();
                                if (isBlockedByCurrentUser) {
                                  toast({variant: "destructive", title: "Blockiert", description: "Du hast diesen Nutzer blockiert. DM nicht möglich."});
                                  return;
                                }
                                onInitiateDm(p as Participant);
                              }}
                              disabled={isBlockedByCurrentUser}
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Direktnachricht an {p.displayName}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    
                    {/* User Actions Menu (Block/Unblock for normal users, extended for mods) */}
                    {currentUserId !== p.userId && !p.isBot && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className={cn(
                                    "h-7 w-7 p-1",
                                    (hasModPermissions && !participantHasPrivileges) ? 
                                      (isAdmin ? "text-pink-500 hover:text-pink-600" : "text-yellow-500 hover:text-yellow-600") :
                                      "text-muted-foreground hover:text-primary"
                                  )}
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuLabel>Aktionen für {p.displayName}</DropdownMenuLabel>
                                <DropdownMenuSeparator />

                                {/* Block/Unblock für alle Nutzer (außer sich selbst/Bots) */}
                                {onToggleBlockUser && !participantHasPrivileges && (
                                  <DropdownMenuItem
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      setPendingAction({ participantId: p.id, action: 'toggleBlock' });
                                      try {
                                        await onToggleBlockUser(p.userId);
                                        toast({
                                          title: isBlockedByCurrentUser ? "Blockierung aufgehoben" : "Nutzer blockiert",
                                          description: `${p.displayName} wurde ${isBlockedByCurrentUser ? 'entblockt' : 'blockiert'}.`
                                        });
                                      } catch (err) {
                                        toast({variant: "destructive", title: "Fehler", description: "Aktion fehlgeschlagen."})                                        
                                      }
                                      setPendingAction(null);
                                    }}
                                    className={cn("cursor-pointer", isBlockedByCurrentUser ? "text-green-600" : "text-red-600")}
                                    disabled={pendingAction?.participantId === p.id && pendingAction?.action === 'toggleBlock'}
                                  >
                                    <Ban className="mr-2 h-4 w-4" />
                                    <span>{isBlockedByCurrentUser ? 'Blockierung aufheben' : 'Nutzer blockieren'}</span>
                                    {pendingAction?.participantId === p.id && pendingAction?.action === 'toggleBlock' && <Loader2 className="ml-auto h-4 w-4 animate-spin"/>}
                                  </DropdownMenuItem>
                                )}
                                {onToggleBlockUser && !participantHasPrivileges && <DropdownMenuSeparator />} 

                                {/* Admin/Mod spezifische Aktionen für NORMALE Teilnehmer */}
                                {hasModPermissions && !participantHasPrivileges && (
                                  <>
                                    {/* Nachrichtenübersicht */}
                                    {onShowParticipantMessages && (
                                      <>
                                        <DropdownMenuItem 
                                          onClick={(e) => { 
                                            e.stopPropagation(); 
                                            onShowParticipantMessages(p as Participant); 
                                          }}
                                          className="text-blue-600 cursor-pointer"
                                        >
                                          <MessageSquare className="h-4 w-4 mr-2" />
                                          Nachrichtenübersicht
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                      </>
                                    )}
                                    
                                    {/* Penalties - Nur für normale Teilnehmer ohne aktive Strafe */}
                                    {onApplyPenalty && !p.activePenalty && (
                                      <>
                                        <DropdownMenuItem 
                                          onClick={(e) => { 
                                            e.stopPropagation(); 
                                            onApplyPenalty(p.id, 'yellow'); 
                                          }}
                                          className="text-yellow-600 cursor-pointer"
                                        >
                                          <Ban className="mr-2 h-4 w-4" />
                                          <span>Gelbe Karte</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem 
                                          onClick={(e) => { 
                                            e.stopPropagation(); 
                                            onApplyPenalty(p.id, 'red'); 
                                          }}
                                          className="text-red-600 cursor-pointer"
                                        >
                                          <Ban className="mr-2 h-4 w-4" />
                                          <span>Rote Karte</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                      </>
                                    )}
                                    
                                    {/* Strafe aufheben, wenn aktiv */}
                                    {p.activePenalty && isAdmin && (
                                      <DropdownMenuItem 
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          try {
                                            toast({
                                              title: "Strafe aufgehoben", 
                                              description: `Die Strafe für ${p.displayName} wurde aufgehoben.`
                                            });
                                          } catch (error) {
                                            toast({
                                              variant: "destructive",
                                              title: "Fehler", 
                                              description: "Strafe konnte nicht aufgehoben werden."
                                            });
                                          }
                                        }}
                                        className="text-green-600 cursor-pointer"
                                      >
                                        <Check className="mr-2 h-4 w-4" />
                                        <span>Strafe aufheben</span>
                                      </DropdownMenuItem>
                                    )}
                                    
                                    {/* Mute Toggle */}
                                    <DropdownMenuItem 
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        await handleToggleMute(p.id, !!p.isMuted);
                                      }}
                                      className="cursor-pointer"
                                    >
                                      <VolumeX className="mr-2 h-4 w-4" />
                                      <span>{p.isMuted ? 'Stummschaltung aufheben' : 'Stummschalten'}</span>
                                    </DropdownMenuItem>
                                    
                                    {/* Badge Management - Only for Admins */}
                                    {isAdmin && (
                                      <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem 
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            await handleAssignModeratorBadge(p.id);
                                          }}
                                          className="cursor-pointer"
                                        >
                                          <ShieldCheck className="mr-2 h-4 w-4 text-yellow-500" />
                                          <span>Zum Moderator ernennen</span>
                                        </DropdownMenuItem>
                                        
                                        {/* Teilnehmer entfernen */}
                                        <DropdownMenuItem 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            confirmRemoveParticipant(p.id);
                                          }}
                                          className="cursor-pointer text-red-600"
                                        >
                                          <UserX className="mr-2 h-4 w-4" />
                                          <span>Teilnehmer entfernen</span>
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                  </>
                                )}

                                {/* Separate Sektion für Admin/Mod-Teilnehmer */}
                                {hasModPermissions && participantHasPrivileges && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuLabel>Admin/Mod Aktionen</DropdownMenuLabel>
                                    
                                    {/* Nachrichtenübersicht für Admin/Mod */}
                                    {onShowParticipantMessages && (
                                      <DropdownMenuItem 
                                        onClick={(e) => { 
                                          e.stopPropagation(); 
                                          onShowParticipantMessages(p as Participant); 
                                        }}
                                        className="text-blue-600 cursor-pointer"
                                      >
                                        <MessageSquare className="h-4 w-4 mr-2" />
                                        Nachrichtenübersicht
                                      </DropdownMenuItem>
                                    )}
                                    
                                    {/* Direktnachricht */}
                                    {onInitiateDm && p.userId !== currentUserId && (
                                      <DropdownMenuItem 
                                        onClick={(e) => { 
                                          e.stopPropagation(); 
                                          onInitiateDm(p as Participant); 
                                        }}
                                        className="cursor-pointer"
                                      >
                                        <Send className="h-4 w-4 mr-2" />
                                        Direktnachricht
                                      </DropdownMenuItem>
                                    )}
                                    
                                    {/* Admin-spezifische Aktionen für andere Mods */}
                                    {isAdmin && p.userId !== currentUserId && (
                                      <>
                                        <DropdownMenuSeparator />
                                        
                                        {/* Moderator-Badge entfernen (nur für Moderatoren, nicht für andere Admins) */}
                                        {p.assignedBadges?.includes('moderator') && !p.assignedBadges?.includes('admin') && (
                                          <DropdownMenuItem 
                                            onClick={async (e) => {
                                              e.stopPropagation();
                                              if (onRemoveBadge) {
                                                try {
                                                  await onRemoveBadge(p.id, 'moderator');
                                                  toast({
                                                    title: "Badge entfernt",
                                                    description: `Moderator-Badge wurde von ${p.displayName} entfernt.`,
                                                  });
                                                } catch (error) {
                                                  toast({
                                                    variant: "destructive",
                                                    title: "Fehler",
                                                    description: "Badge konnte nicht entfernt werden.",
                                                  });
                                                }
                                              }
                                            }}
                                            className="cursor-pointer text-orange-600"
                                          >
                                            <ShieldCheck className="mr-2 h-4 w-4" />
                                            <span>Moderator-Status entziehen</span>
                                          </DropdownMenuItem>
                                        )}
                                        
                                        {/* Stummschalten (Admins können andere Admins/Mods stummschalten) */}
                                        <DropdownMenuItem 
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            await handleToggleMute(p.id, !!p.isMuted);
                                          }}
                                          className="cursor-pointer"
                                        >
                                          <VolumeX className="mr-2 h-4 w-4" />
                                          <span>{p.isMuted ? 'Stummschaltung aufheben' : 'Stummschalten'}</span>
                                        </DropdownMenuItem>
                                        
                                        {/* Aktive Strafe aufheben */}
                                        {p.activePenalty && (
                                          <DropdownMenuItem 
                                            onClick={async (e) => {
                                              e.stopPropagation();
                                              try {
                                                toast({
                                                  title: "Strafe aufgehoben",
                                                  description: `Die Strafe für ${p.displayName} wurde aufgehoben.`,
                                                });
                                              } catch (error) {
                                                toast({
                                                  variant: "destructive",
                                                  title: "Fehler",
                                                  description: "Strafe konnte nicht aufgehoben werden.",
                                                });
                                              }
                                            }}
                                            className="text-green-600 cursor-pointer"
                                          >
                                            <Check className="mr-2 h-4 w-4" />
                                            <span>Strafe aufheben</span>
                                          </DropdownMenuItem>
                                        )}
                                      </>
                                    )}
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Teilnehmeraktionen</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
      
      {/* Cooldown Dialog */}
      <Dialog open={showCooldownDialog} onOpenChange={setShowCooldownDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nachrichten-Cooldown anpassen</DialogTitle>
            <DialogDescription>
              Bestimme die Zeit (in Sekunden), die Teilnehmer zwischen Nachrichten warten müssen.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="cooldown">Cooldown-Zeit in Sekunden: {newCooldownValue}</Label>
              <div className="flex items-center gap-4">
                <Slider
                  id="cooldown"
                  min={0}
                  max={60}
                  step={1}
                  value={[newCooldownValue]}
                  onValueChange={(value) => setNewCooldownValue(value[0])}
                />
                <Input
                  type="number"
                  value={newCooldownValue}
                  onChange={(e) => setNewCooldownValue(parseInt(e.target.value) || 0)}
                  className="w-20"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCooldownDialog(false)}>Abbrechen</Button>
            <Button onClick={handleSaveCooldown}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Entfernen-Bestätigung Dialog */}
      <Dialog open={showRemoveConfirmDialog} onOpenChange={setShowRemoveConfirmDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" /> Teilnehmer entfernen
            </DialogTitle>
            <DialogDescription>
              Möchtest du diesen Teilnehmer wirklich aus dem Chat entfernen? Diese Aktion kann nicht rückgängig gemacht werden.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setPendingAction(null);
              setShowRemoveConfirmDialog(false);
            }}>Abbrechen</Button>
            <Button variant="destructive" onClick={handleRemoveParticipant}>Entfernen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
});

ChatSidebar.displayName = "ChatSidebar";

export { ChatSidebar };

export const UserInfoBox: React.FC<UserInfoBoxProps> = ({
  scenarioTitle,
  sessionStatus,
  userDisplayName,
  userRole,
  isMuted,
  activePenalty,
  penaltyTimeRemaining,
  assignedBadges,
  cooldownRemainingSeconds,
  messageCooldownSeconds,
  onToggleMute,
  onRemoveParticipant,
  onClearAllBlurs,
  onAdjustCooldown,
  currentCooldown = 0,
  onShowModeratorOverview,
  onShowParticipantMessages,
  reportedMessagesCount,
  onToggleBlockUser,
  blockedUserIds = []
}) => {
  return (
    <div className="flex items-center gap-4">
      <Avatar className={cn("h-12 w-12")}>
        <AvatarImage src={`https://placehold.co/40x40.png?text=${userDisplayName}`} alt={userDisplayName} />
        <AvatarFallback className="text-xs">
          {userDisplayName.substring(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-grow overflow-hidden">
        <p className="text-sm font-semibold">{userDisplayName}</p>
        <p className="text-xs text-muted-foreground">Rolle: {userRole}</p>
        {assignedBadges && assignedBadges.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {assignedBadges.map(badge => (
              <Badge
                key={badge}
                variant="default"
                className={cn(
                  "text-xs px-1.5 py-0.5",
                  badge === 'admin' && "bg-pink-600/90 dark:bg-pink-500 hover:bg-pink-700/90 dark:hover:bg-pink-600 text-white",
                  badge === 'moderator' && "bg-amber-600/90 dark:bg-yellow-400 hover:bg-amber-700/90 dark:hover:bg-yellow-500 text-white dark:text-black"
                )}
                title={`${badge.charAt(0).toUpperCase() + badge.slice(1)}-Badge`}
              >
                {badge.toUpperCase()}
              </Badge>
            ))}
          </div>
        )}
      </div>
      {isMuted && (
        <Badge variant="destructive" className="ml-2">
          Muted
        </Badge>
      )}
    </div>
  );
};
    