"use client";

import { type MouseEvent, memo, useState } from 'react';
import NextImage from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CornerDownLeft, Quote, SmilePlus, Bot as BotIcon, Crown, MessageSquare, ThumbsUp, Heart, Laugh, Angry, Check, X, Send as SendIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from '@/lib/utils';
import type { DisplayMessage, Participant } from '@/lib/types';
import type { ParticipantColor, emojiCategories as EmojiCategoriesType } from '@/lib/config';
import { useToast } from "@/hooks/use-toast";
import { Timestamp } from 'firebase/firestore';

interface MessageBubbleProps {
  message: DisplayMessage;
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
}: MessageBubbleProps) {

  const isOwn = message.senderUserId === currentUserId && (!isAdminView || (isAdminView && message.senderType === 'admin'));
  const bubbleColor = getParticipantColorClasses(message.senderUserId, message.senderType === 'system' ? undefined : message.senderType);

  // console.log(`MessageBubble for ${message.id} by ${message.senderName}, color:`, bubbleColor, "isOwn:", isOwn);

  const handleLocalEmojiSelectForReaction = async (emoji: string) => {
    await onReaction(message.id, emoji);
    setReactingToMessageId(null); // Close picker after reaction
  };

  const handleOpenReactionPicker = (e: MouseEvent) => {
    e.stopPropagation();
    setReactingToMessageId(reactingToMessageId === message.id ? null : message.id);
  };

  const handleDirectMessagePlaceholder = () => {
    if (onOpenDm) {
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
         onOpenDm(recipient);
      } else if (message.senderUserId === currentUserId) {
        toast({title: "Hinweis", description: "Du kannst dir nicht selbst eine DM schreiben."});
      }
    } else {
      toast({ title: "DM Funktion nicht verfügbar", description: "Setup für DMs ist nicht vollständig." });
    }
  };

  const { toast } = useToast();

  return (
    <div
      id={`msg-${message.id}`}
      className={cn(
        "flex w-full items-start gap-2 group/message py-1",
        isOwn ? "justify-end pl-10 sm:pl-16" : "justify-start pr-10 sm:pr-16"
      )}
    >
      {!isOwn && (
        <Avatar className={cn("h-10 w-10 border-2 self-end shrink-0", bubbleColor.ring)}>
          <AvatarImage src={`https://placehold.co/40x40.png?text=${message.avatarFallback}`} alt={message.senderName} data-ai-hint="person user"/>
           <AvatarFallback className={cn("font-semibold", bubbleColor.bg, bubbleColor.text)}>{message.avatarFallback}</AvatarFallback>
        </Avatar>
      )}
      <div
        className={cn(
          "max-w-[85%] sm:max-w-[70%] md:max-w-[65%] lg:max-w-[60%]",
          "rounded-xl shadow-md flex flex-col",
          bubbleColor.bg,
          bubbleColor.text
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
            </div>
          </div>

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
            <Popover open={reactingToMessageId === message.id} onOpenChange={(open) => {
                if (!open && reactingToMessageId === message.id) { // Only close if this specific popover was open
                    setReactingToMessageId(null);
                }
            }}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn("h-auto px-1.5 py-0.5", "hover:bg-black/10 dark:hover:bg-white/10 text-current/80 hover:text-current")}
                  onClick={handleOpenReactionPicker}
                  aria-label="Reagieren"
                >
                  <SmilePlus className="h-3.5 w-3.5 mr-1" /> <span className="text-xs">Reagieren</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-auto p-0 mb-1 max-w-[300px] sm:max-w-xs z-20"
                side="top"
                align={isOwn ? "end" : "start"}
                onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside popover
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
                              className="text-xl p-0 h-9 w-9 hover:bg-muted/50" // Slightly larger emoji text
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
        </div>
      </div>
      {isOwn && ( 
        <Avatar className={cn("h-10 w-10 border-2 self-end shrink-0", bubbleColor.ring)}>
            <AvatarImage src={`https://placehold.co/40x40.png?text=${message.avatarFallback}`} alt={message.senderName} data-ai-hint="person user"/>
            <AvatarFallback className={cn("font-semibold", bubbleColor.bg, bubbleColor.text)}>{message.avatarFallback}</AvatarFallback>
        </Avatar>
      )}
    </div>
  );
});

MessageBubble.displayName = "MessageBubble";

export { MessageBubble };
