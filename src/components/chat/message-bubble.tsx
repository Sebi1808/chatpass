"use client";

import { type MouseEvent, memo, useState, useMemo } from 'react';
import NextImage from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CornerDownLeft, Quote, SmilePlus, Smile, Bot as BotIcon, Crown, MessageSquare, ThumbsUp, Heart, Laugh, Angry, Check, X, Send as SendIcon, Loader2, Eye, EyeOff, AlertTriangle, ShieldCheck, MoreVertical, Ban, Undo2, Mic, Play, Pause } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from '@/lib/utils';
import type { DisplayMessage, Participant } from '@/lib/types';
import type { ParticipantColor, emojiCategories as EmojiCategoriesType } from '@/lib/config';
import { useToast } from "@/hooks/use-toast";
import { Timestamp } from 'firebase/firestore';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface MessageBubbleProps {
  message: DisplayMessage & { isFromBlockedUser?: boolean };
  currentUserId: string | null;
  getParticipantColorClasses: (pUserId?: string, pSenderType?: 'admin' | 'user' | 'bot') => ParticipantColor;
  onMentionUser: (name: string) => void;
  onSetReply: (message: DisplayMessage) => void;
  onSetQuote: (message: DisplayMessage) => void;
  onReaction: (messageId: string, emoji: string) => Promise<void>;
  reactingToMessageId: string | null;
  setReactingToMessageId: (messageId: string | null) => void;
  emojiCategories: typeof EmojiCategoriesType;
  isAdminView?: boolean;
  onOpenImageModal: (imageUrl: string, imageFileName?: string) => void;
  onOpenDm?: (recipient: Participant) => void;
  toggleBlurMessage?: (messageId: string) => Promise<void>;
  isTogglingBlur?: string | null;
  currentUserBadges?: ('admin' | 'moderator')[];
  currentParticipantDetails?: Participant | null;
  participants?: Participant[];
  onBlockUser?: (userId: string) => Promise<void>;
  onReportMessage?: (messageId: string, reason: string) => Promise<void>;
  blockingEnabled?: boolean;
  reportingEnabled?: boolean;
}

const MessageBubble = memo(function MessageBubble({
  message,
  currentUserId,
  getParticipantColorClasses,
  onMentionUser,
  onSetReply,
  onSetQuote,
  onReaction,
  reactingToMessageId,
  setReactingToMessageId,
  emojiCategories,
  isAdminView = false,
  onOpenImageModal,
  onOpenDm,
  toggleBlurMessage,
  isTogglingBlur,
  currentUserBadges,
  currentParticipantDetails,
  participants,
  onBlockUser,
  onReportMessage,
  blockingEnabled = false,
  reportingEnabled = false,
}: MessageBubbleProps) {

  const [isLocallyUnblurred, setIsLocallyUnblurred] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [showBlockConfirmation, setShowBlockConfirmation] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const { toast } = useToast();

  const isOwn = message.senderUserId === currentUserId && (!isAdminView || (isAdminView && message.senderType === 'admin'));
  const bubbleColor = getParticipantColorClasses(message.senderUserId, message.senderType === 'system' ? undefined : message.senderType);

  const senderParticipant = useMemo(() => {
    if (!message.senderUserId || !participants) return null;
    return participants.find(p => p.userId === message.senderUserId);
  }, [message.senderUserId, participants]);
  const senderAssignedBadges = useMemo(() => senderParticipant?.assignedBadges || [], [senderParticipant]);

  // console.log(`MessageBubble for ${message.id} by ${message.senderName}, color:`, bubbleColor, "isOwn:", isOwn);

  const handleLocalEmojiSelectForReaction = async (emoji: string) => {
    console.log('[DEBUG] handleLocalEmojiSelectForReaction called with emoji:', emoji, 'for message:', message.id);
    await onReaction(message.id, emoji); 
    setReactingToMessageId(null); // Close after selecting an emoji
  };

  const handleOpenReactionPicker = (e: MouseEvent) => {
    console.log('[DEBUG] handleOpenReactionPicker called for message:', message.id);
    e.stopPropagation(); // Prevent triggering other handlers
    setReactingToMessageId(reactingToMessageId === message.id ? null : message.id);
  };

  const handleDirectMessagePlaceholder = () => {
    console.log('[DM Debug] handleDirectMessagePlaceholder called');
    console.log('[DM Debug] onOpenDm exists:', !!onOpenDm);
    console.log('[DM Debug] message data:', {
      senderUserId: message.senderUserId,
      senderName: message.senderName,
      avatarFallback: message.avatarFallback,
      senderType: message.senderType,
      currentUserId: currentUserId
    });
    
    if (onOpenDm) {
      if (!message.senderUserId || !message.senderName || typeof message.avatarFallback === 'undefined') {
        toast({ title: "DM Fehler", description: "Sender-Informationen unvollständig für DM." });
        return;
      }

      const recipient: Participant = {
        id: message.senderUserId,
        userId: message.senderUserId,
        displayName: message.senderName,
        avatarFallback: message.avatarFallback,
        role: "Teilnehmer",
        realName: message.senderName,
        joinedAt: Timestamp.now(),
        status: 'Beigetreten',
        isBot: message.senderType === 'bot',
        roleId: "unknown",
      };
      if (message.senderType !== 'system' && message.senderUserId !== currentUserId) {
         console.log('[DM Debug] Calling onOpenDm with recipient:', recipient);
         onOpenDm(recipient);
      } else if (message.senderUserId === currentUserId) {
        toast({title: "Hinweis", description: "Du kannst dir nicht selbst eine DM schreiben."});
      }
    } else {
      toast({ title: "DM Funktion nicht verfügbar", description: "Setup für DMs ist nicht vollständig." });
    }
  };

  // Neue Funktion zum temporären Aufheben der Blur-Eigenschaft
  const handleToggleLocalBlur = () => {
    setIsLocallyUnblurred(prev => !prev);
  };

  // Neue Funktion zum Aufheben oder Setzen des Blurs durch einen Moderator/Admin
  const handleToggleMessageBlur = async () => {
    if (toggleBlurMessage) {
      try {
        await toggleBlurMessage(message.id);
      } catch (error) {
        console.error("Fehler beim Ändern des Blur-Status:", error);
      }
    }
  };

  // Ermitteln, ob aktueller Benutzer die Berechtigung zum Blurren/Entblurren hat
  const canModerateContent = useMemo(() => {
    if (isAdminView) return false; // Admins verwenden eigene Moderation im Dashboard
    return currentUserBadges?.includes('admin') || currentUserBadges?.includes('moderator');
  }, [currentUserBadges, isAdminView]);

  // NEU: Funktion zum Blockieren eines Nutzers
  const handleBlockUser = async () => {
    if (!currentUserId || !message.senderUserId || !onBlockUser) return;
    
    setIsBlocking(true);
    try {
      await onBlockUser(message.senderUserId);
      setShowBlockConfirmation(false);
      toast({ 
        title: "Nutzer blockiert", 
        description: `${message.senderName} wurde erfolgreich blockiert.` 
      });
    } catch (error: any) {
      console.error("Fehler beim Blockieren:", error);
      toast({ 
        variant: "destructive", 
        title: "Blockieren fehlgeschlagen", 
        description: error.message || "Der Nutzer konnte nicht blockiert werden." 
      });
    } finally {
      setIsBlocking(false);
    }
  };

  // NEU: Funktion zum Melden einer Nachricht
  const handleReportMessage = async () => {
    if (!currentUserId || !message.id || !onReportMessage || !reportReason.trim()) {
      toast({ variant: "destructive", title: "Fehler", description: "Bitte gib einen Grund für die Meldung an." });
      return;
    }
    
    setIsSubmittingReport(true);
    try {
      await onReportMessage(message.id, reportReason);
      setShowReportDialog(false);
      setReportReason("");
      toast({ title: "Nachricht gemeldet", description: "Deine Meldung wurde an die Moderatoren weitergeleitet." });
    } catch (error: any) {
      console.error("Fehler beim Melden:", error);
      toast({ 
        variant: "destructive", 
        title: "Meldung fehlgeschlagen", 
        description: error.message || "Die Nachricht konnte nicht gemeldet werden." 
      });
    } finally {
      setIsSubmittingReport(false);
    }
  };

  // NEU: Prüfen, ob Aktionen für diesen Nutzer möglich sind
  const canBeActedUpon = useMemo(() => {
    // Keine Aktionen für eigene Nachrichten, System oder Bots
    if (isOwn || message.senderType === 'system' || message.senderType === 'bot') return false;
    // Keine Aktionen für Admins/Moderatoren (außer durch Admins)
    if (participants && message.senderUserId) {
      const sender = participants.find(p => p.userId === message.senderUserId);
      if (sender?.assignedBadges?.includes('admin') || 
         (sender?.assignedBadges?.includes('moderator') && !currentUserBadges?.includes('admin'))) {
        return false;
      }
    }
    return true;
  }, [isOwn, message, participants, currentUserBadges]);

  // NEU: Prüfen ob der Nutzer blockiert ist (entweder durch isUserBlocked oder durch isFromBlockedUser)
  const isUserBlocked = useMemo(() => {
    if (message.isFromBlockedUser) return true;
    if (!currentParticipantDetails || !message.senderUserId) return false;
    return currentParticipantDetails.blockedUserIds?.includes(message.senderUserId) || false;
  }, [currentParticipantDetails, message.senderUserId, message.isFromBlockedUser]);

  return (
    <div
      id={`msg-${message.id}`}
      className={cn(
        "flex w-full items-start gap-2 group/message py-1",
        isOwn ? "justify-end pl-10 sm:pl-16" : "justify-start pr-10 sm:pr-16"
      )}
    >
      {!isOwn && (
        <div className="relative">
          <Avatar className={cn("h-10 w-10 border-2 self-end shrink-0", bubbleColor.ring)}>
            <AvatarImage src={`https://placehold.co/40x40.png?text=${message.avatarFallback}`} alt={message.senderName} data-ai-hint="person user"/>
             <AvatarFallback className={cn("font-semibold", bubbleColor.bg, bubbleColor.text)}>{message.avatarFallback}</AvatarFallback>
          </Avatar>
          {/* NEU: Block-Symbol bei blockierten Nutzern */}
          {isUserBlocked && (
            <div className="absolute -top-1 -right-1 bg-red-500 text-white p-0.5 rounded-full">
              <Ban className="h-3.5 w-3.5" />
            </div>
          )}
        </div>
      )}
      <div
        className={cn(
          "max-w-[85%] sm:max-w-[70%] md:max-w-[65%] lg:max-w-[60%]",
          "rounded-xl shadow-md flex flex-col",
          bubbleColor.bg,
          bubbleColor.text,
          "relative" // Hinzugefügt für absolute Positionierung des Blur-Overlays
        )}
      >
        <div className="p-3">
          <div className="flex items-center justify-between mb-1">
            <div className={cn("flex items-center gap-1.5", bubbleColor.nameText)}>
              <button
                onClick={() => !isOwn && onMentionUser(message.senderName)}
                className="text-xs font-semibold hover:underline"
                disabled={isOwn && !isAdminView}
              >
                {message.senderName}
              </button>
              {message.senderType === 'admin' && (
                <Badge variant="outline" className="text-xs px-1.5 py-0.5 h-5 leading-tight bg-red-600/90 text-white border border-red-900/50 shadow-sm flex items-center gap-1">
                  👑 ADMIN
                </Badge>
              )}
              {message.senderType === 'bot' && (
                <Badge variant="outline" className="text-xs px-1.5 py-0.5 h-5 leading-tight bg-purple-600/90 text-white border border-purple-900/50 shadow-sm flex items-center gap-1">
                  🤖 BOT
                </Badge>
              )}
              {message.senderType !== 'admin' && message.senderType !== 'bot' && senderAssignedBadges.map(badge => (
                <Badge
                  key={badge}
                  variant="default"
                  className={cn(
                    "text-xs px-1.5 py-0.5 h-5 leading-tight shadow-sm flex items-center gap-1",
                    badge === 'admin' && "bg-pink-500 hover:bg-pink-600 text-white border-pink-700",
                    badge === 'moderator' && "bg-yellow-400 hover:bg-yellow-500 text-black border-yellow-600"
                  )}
                  title={`${badge.charAt(0).toUpperCase() + badge.slice(1)}-Badge`}
                >
                  {badge === 'admin' ? <Crown className="h-3 w-3"/> : <ShieldCheck className="h-3 w-3"/>} 
                  {badge.toUpperCase()}
                </Badge>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <span className={cn("text-xs opacity-80", bubbleColor.nameText)}>{message.timestampDisplay}</span>
              {!isOwn && message.senderType !== 'system' && message.senderType !== 'admin' && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 p-0 opacity-60 hover:opacity-100 text-current/80 hover:text-current"
                  onClick={handleDirectMessagePlaceholder}
                  title={`Direktnachricht an ${message.senderName}`}
                >
                  <SendIcon className="h-3 w-3" />
                </Button>
              )}
              
              {/* NEU: Kontext-Menü für Moderationsaktionen und Blockieren/Entsperren */}
              {!isOwn && canBeActedUpon && message.senderUserId && (blockingEnabled || reportingEnabled) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-5 w-5 p-0 opacity-60 hover:opacity-100 text-current/80 hover:text-current"
                    >
                      <MoreVertical className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    {blockingEnabled && (
                      isUserBlocked ? (
                        <DropdownMenuItem 
                          onClick={() => onBlockUser?.(message.senderUserId!)}
                          className="text-green-600 cursor-pointer"
                        >
                          <Undo2 className="h-4 w-4 mr-2" />
                          <span>Nutzer entsperren</span>
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem 
                          onClick={() => setShowBlockConfirmation(true)}
                          className="text-red-600 cursor-pointer"
                        >
                          <Ban className="h-4 w-4 mr-2" />
                          <span>Nutzer blockieren</span>
                        </DropdownMenuItem>
                      )
                    )}
                    
                    {reportingEnabled && (
                      <DropdownMenuItem 
                        onClick={() => setShowReportDialog(true)}
                        className="cursor-pointer"
                      >
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        <span>Nachricht melden</span>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          {/* NEU: Anzeige für blockierte Nachrichten */}
          {isUserBlocked ? (
            <div className="bg-muted/30 p-3 rounded-md text-center my-1">
              <p className="text-sm text-muted-foreground">
                <Ban className="inline-block h-4 w-4 mr-1 mb-1" />
                Nachricht von blockiertem Nutzer ausgeblendet
              </p>
              <Button 
                variant="ghost" 
                size="sm" 
                className="mt-1 text-xs h-7"
                onClick={() => onBlockUser?.(message.senderUserId!)}
              >
                Blockierung aufheben
              </Button>
            </div>
          ) : (
            <>
              {message.replyToMessageId && message.replyToMessageSenderName && message.replyToMessageContentSnippet && (
                <a
                  href={`#msg-${message.replyToMessageId}`}
                  className={cn(
                    "text-xs p-1.5 rounded-md mb-1.5 flex items-center gap-1 cursor-pointer",
                    "bg-black/10 hover:bg-black/20 dark:bg-white/5 dark:hover:bg-white/10",
                    "opacity-90"
                  )}
                  title="Zum Original springen"
                >
                  <CornerDownLeft className="h-3 w-3 shrink-0" />
                  <div className="truncate">
                    <span className="font-medium">Antwort auf {message.replyToMessageSenderName}:</span> {message.replyToMessageContentSnippet}
                  </div>
                </a>
              )}

              {message.imageUrl &&
                <div 
                  onClick={() => onOpenImageModal(message.imageUrl!, message.imageFileName)}
                  className="my-2 relative w-full max-w-xs sm:max-w-sm md:max-w-md rounded-md overflow-hidden group cursor-pointer"
                >
                  <NextImage
                    src={message.imageUrl}
                    alt={message.imageFileName || "Hochgeladenes Bild"}
                    width={700} 
                    height={500} 
                    className="rounded-md object-contain h-auto w-full"
                    data-ai-hint="chat image"
                    priority={false}
                  />
                </div>
              }
              {message.imageFileName && !message.imageUrl && <p className="text-xs opacity-70 mt-1 italic">Bild wird geladen: {message.imageFileName}</p>}

              {/* Voice Message Player - NEU */}
              {message.voiceMessageUrl && (
                <div className="my-2 w-full max-w-sm">
                  <div className="bg-muted/30 dark:bg-muted/40 border border-muted-foreground/20 rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-500 text-white flex-shrink-0">
                        <Mic className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-foreground">Sprachnachricht</span>
                          {message.voiceMessageDuration && (
                            <span className="text-xs text-muted-foreground">
                              {Math.floor(message.voiceMessageDuration / 60)}:{(message.voiceMessageDuration % 60).toString().padStart(2, '0')} min
                            </span>
                          )}
                        </div>
                        <audio 
                          controls 
                          className="w-full h-8" 
                          style={{height: '32px'}}
                          preload="metadata"
                        >
                          <source src={message.voiceMessageUrl} type="audio/webm" />
                          <source src={message.voiceMessageUrl} type="audio/mp4" />
                          <source src={message.voiceMessageUrl} type="audio/mpeg" />
                          Ihr Browser unterstützt keine Audio-Wiedergabe.
                        </audio>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {message.voiceMessageFileName && !message.voiceMessageUrl && (
                <p className="text-xs opacity-70 mt-1 italic">Sprachnachricht wird geladen: {message.voiceMessageFileName}</p>
              )}

              {message.content && <p className="text-sm whitespace-pre-wrap">{message.content}</p>}
          
              {/* Display Reactions */}
              {message.reactions && Object.keys(message.reactions).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {Object.entries(message.reactions).map(([emoji, reactedUserIds]) => {
                    if (!Array.isArray(reactedUserIds) || reactedUserIds.length === 0) return null;
                    const currentUserReacted = currentUserId ? reactedUserIds.includes(currentUserId) : false;
                    return (
                      <Button
                        key={emoji}
                        variant="ghost" // Keep variant ghost for minimal default styling
                        size="sm" 
                        className={cn(
                          "h-auto px-1.5 py-0.5 rounded-full text-xs border", // Smaller padding and text
                          "flex items-center gap-1",
                          currentUserReacted 
                            ? "bg-primary/30 dark:bg-primary/40 border-primary/50 dark:border-primary/60 text-primary-foreground" // More distinct when current user reacted
                            : "bg-black/10 dark:bg-white/10 border-black/20 dark:border-white/20 hover:bg-black/20 dark:hover:bg-white/20" // General contrasting background
                        )}
                        onClick={(e) => { e.stopPropagation(); onReaction(message.id, emoji); }}
                        aria-label={`Reaktion ${emoji}, ${reactedUserIds.length} mal`}
                      >
                        <span className="text-base mr-0.5">{emoji}</span> {/* Emoji size itself */}
                        <span>{reactedUserIds.length}</span>
                      </Button>
                    );
                  })}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-1 mt-1.5 -ml-1 opacity-100 transition-opacity duration-150">
                {!isOwn && (
                  <>
                    <Button variant="ghost" size="sm" className={cn("h-auto px-1.5 py-0.5", "hover:bg-black/10 dark:hover:bg-white/10 text-current/80 hover:text-current")} onClick={(e) => { e.stopPropagation(); onSetReply(message); }} aria-label="Antworten">
                      <CornerDownLeft className="h-3.5 w-3.5 mr-1" /> <span className="text-xs">Antworten</span>
                    </Button>
                    <Button variant="ghost" size="sm" className={cn("h-auto px-1.5 py-0.5", "hover:bg-black/10 dark:hover:bg-white/10 text-current/80 hover:text-current")} onClick={(e) => { e.stopPropagation(); onSetQuote(message); }} aria-label="Zitieren">
                      <Quote className="h-3.5 w-3.5 mr-1" /> <span className="text-xs">Zitieren</span>
                    </Button>
                  </>
                )}
                
                {/* Emoji-Picker-Popover */}
                <Popover open={reactingToMessageId === message.id} onOpenChange={(open) => {
                  if (!open && reactingToMessageId === message.id) {
                    setReactingToMessageId(null);
                  }
                }}>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className={cn("h-auto px-1.5 py-0.5", "hover:bg-black/10 dark:hover:bg-white/10 text-current/80 hover:text-current")} 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        handleOpenReactionPicker(e); 
                      }} 
                      aria-label="Reaktion hinzufügen"
                    >
                      <Smile className="h-3.5 w-3.5 mr-1" /> <span className="text-xs">Reaktion</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-auto p-0 mb-1 max-w-[300px] sm:max-w-xs z-20"
                    side="top"
                    align={isOwn ? "end" : "start"}
                    onClick={(e) => e.stopPropagation()}
                    onInteractOutside={() => {if(reactingToMessageId === message.id) setReactingToMessageId(null)}}
                  >
                    <Tabs defaultValue={emojiCategories[0].name} className="w-full">
                      <TabsList className="grid w-full grid-cols-5 h-auto p-1">
                        {emojiCategories.map(category => (
                          <TabsTrigger key={category.name} value={category.name} className="text-xl p-1.5 h-9" title={category.name}>
                            {category.icon}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                      {emojiCategories.map(category => (
                        <TabsContent key={category.name} value={category.name} className="mt-0">
                          <ScrollArea className="h-48">
                            <div className="grid grid-cols-8 gap-0.5 p-2">
                              {category.emojis.map(emoji => (
                                <Button
                                  key={emoji}
                                  variant="ghost"
                                  size="icon"
                                  className="text-xl p-0 h-9 w-9 hover:bg-muted/50"
                                  onClick={() => handleLocalEmojiSelectForReaction(emoji)}
                                >
                                  {emoji}
                                </Button>
                              ))}
                            </div>
                          </ScrollArea>
                        </TabsContent>
                      ))}
                    </Tabs>
                  </PopoverContent>
                </Popover>
              </div>
            </>
          )}
        </div>

        {/* Blur Overlay - NEU */}
        {message.isBlurred && !isLocallyUnblurred && (
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-md rounded-xl flex items-center justify-center cursor-pointer z-10 p-2 text-center"
            onClick={handleToggleLocalBlur}
            title="Klicken zum Anzeigen"
          >
            <div className="flex flex-col items-center justify-center gap-1 max-w-full">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <p className="text-white font-medium text-xs line-clamp-1 px-1">Problematischer Inhalt</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-0.5 text-xs bg-transparent border-white/30 text-white hover:bg-white/20 whitespace-nowrap py-0 px-2 h-6 min-w-0 max-w-full"
                onClick={(e) => { 
                  e.stopPropagation(); 
                  handleToggleLocalBlur(); 
                }}
              >
                <Eye className="h-3 w-3 mr-1 flex-shrink-0" /> 
                <span className="truncate">Anzeigen</span>
              </Button>
            </div>
          </div>
        )}
        
        {/* Temporär entblurrt Hinweis - NEU */}
        {message.isBlurred && isLocallyUnblurred && (
          <div className="absolute top-0 right-0 bg-red-500 text-white text-xs px-2 py-0.5 rounded-bl-md">
            <Button 
              variant="link" 
              size="sm" 
              className="p-0 h-auto text-white underline text-xs"
              onClick={handleToggleLocalBlur}
            >
              <EyeOff className="h-3 w-3 mr-1" /> Verbergen
            </Button>
          </div>
        )}
      </div>
      {isOwn && ( 
        <Avatar className={cn("h-10 w-10 border-2 self-end shrink-0", bubbleColor.ring)}>
            <AvatarImage src={`https://placehold.co/40x40.png?text=${message.avatarFallback}`} alt={message.senderName} data-ai-hint="person user"/>
            <AvatarFallback className={cn("font-semibold", bubbleColor.bg, bubbleColor.text)}>{message.avatarFallback}</AvatarFallback>
        </Avatar>
      )}
      
      {/* NEU: Report-Dialog */}
      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2 text-yellow-500" />
              Nachricht melden
            </DialogTitle>
            <DialogDescription>
              Bitte beschreibe kurz, warum du diese Nachricht als problematisch meldest.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea
              placeholder="Grund für die Meldung..."
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              className="min-h-[100px]"
              disabled={isSubmittingReport}
            />
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowReportDialog(false);
                setReportReason("");
              }}
              disabled={isSubmittingReport}
            >
              Abbrechen
            </Button>
            <Button 
              onClick={handleReportMessage} 
              disabled={!reportReason.trim() || isSubmittingReport}
            >
              {isSubmittingReport ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Senden...
                </>
              ) : "Melden"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* NEU: Block-Bestätigungsdialog */}
      <Dialog open={showBlockConfirmation} onOpenChange={setShowBlockConfirmation}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Ban className="h-5 w-5 mr-2 text-red-500" />
              Nutzer blockieren
            </DialogTitle>
            <DialogDescription>
              Möchtest du {message.senderName} wirklich blockieren? Du siehst dann keine Nachrichten mehr von diesem Teilnehmer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowBlockConfirmation(false)}
              disabled={isBlocking}
            >
              Abbrechen
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleBlockUser}
              disabled={isBlocking}
            >
              {isBlocking ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Blockieren...
                </>
              ) : "Blockieren"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});

MessageBubble.displayName = "MessageBubble";

export { MessageBubble };
