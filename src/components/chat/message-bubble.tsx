
"use client";

import { useState, type MouseEvent, memo } from 'react';
import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CornerDownLeft, Quote, SmilePlus, Bot as BotIcon, Crown, Trash2, MessageSquare } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from '@/lib/utils';
import type { DisplayMessage } from '@/lib/types';
import type { ParticipantColor, emojiCategories as EmojiCategoriesType } from '@/lib/config';

interface MessageBubbleProps {
  message: DisplayMessage;
  currentUserId: string | null;
  getParticipantColorClasses: (pUserId?: string, pSenderType?: 'admin' | 'user' | 'bot') => ParticipantColor;
  onMentionUser: (name: string) => void;
  onSetReply: (message: DisplayMessage) => void;
  onSetQuote: (message: DisplayMessage) => void;
  onScrollToMessage: (messageId: string) => void;
  onReaction: (messageId: string, emoji: string) => void;
  reactingToMessageId: string | null;
  setReactingToMessageId: (messageId: string | null) => void;
  emojiCategories: typeof EmojiCategoriesType;
  onOpenImageModal: (imageUrl: string, imageFileName?: string) => void; // Re-added for new modal
}

const MessageBubble = memo(function MessageBubble({
  message,
  currentUserId,
  getParticipantColorClasses,
  onMentionUser,
  onSetReply,
  onSetQuote,
  onScrollToMessage,
  onReaction,
  reactingToMessageId,
  setReactingToMessageId,
  emojiCategories,
  onOpenImageModal, // Re-added
}: MessageBubbleProps) {
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  const isOwn = message.senderUserId === currentUserId && message.senderType !== 'admin';
  const bubbleColor = getParticipantColorClasses(message.senderUserId, message.senderType);

  const handleLocalEmojiSelectForReaction = (emoji: string) => {
    onReaction(message.id, emoji);
    setShowReactionPicker(false);
    setReactingToMessageId(null);
  };

  const handleOpenReactionPicker = (e: MouseEvent) => {
    e.stopPropagation();
    setReactingToMessageId(message.id);
    setShowReactionPicker(prev => !prev);
  };


  return (
    <div
      id={`msg-${message.id}`}
      className={cn(
        "flex w-full items-end gap-2 group/message",
        isOwn ? "justify-end" : "justify-start"
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
          bubbleColor.bg, // Apply background color
          bubbleColor.text  // Apply text color
        )}
      >
        <div className="p-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5"> {/* Ensure vertical alignment for name and badge */}
              <button
                onClick={() => !isOwn && onMentionUser(message.senderName)}
                className={cn(
                  "text-xs font-semibold hover:underline",
                  bubbleColor.nameText // Apply name text color
                )}
                disabled={isOwn}
              >
                {message.senderName}
              </button>
              {message.senderType === 'admin' && (
                <Badge variant="outline" className="text-xs px-1.5 py-0.5 h-5 leading-tight bg-red-700 text-white border border-red-900 shadow-md flex items-center gap-1">
                  <Crown className="h-3 w-3" /> ADMIN
                </Badge>
              )}
              {message.senderType === 'bot' && (
                <Badge variant="outline" className="text-xs px-1.5 py-0.5 h-5 leading-tight bg-purple-700 text-white border border-purple-900 shadow-md flex items-center gap-1">
                  <BotIcon className="h-3 w-3" /> BOT
                </Badge>
              )}
            </div>
            <span className={cn("text-xs opacity-80", bubbleColor.nameText)}>{message.timestampDisplay}</span>
          </div>

          {message.replyToMessageId && message.replyToMessageSenderName && message.replyToMessageContentSnippet && (
            <div
              className={cn(
                "text-xs p-1.5 rounded-md mb-1.5 flex items-center gap-1 cursor-pointer",
                "bg-black/10 hover:bg-black/20 dark:bg-white/5 dark:hover:bg-white/10", // Consistent contrast
                "opacity-90" // Retain opacity from bubbleColor.text if desired, or set explicitly
              )}
              onClick={() => onScrollToMessage(message.replyToMessageId as string)}
              title="Zum Original springen"
            >
              <CornerDownLeft className="h-3 w-3 shrink-0" />
              <div className="truncate">
                <span className="font-medium">Antwort auf {message.replyToMessageSenderName}:</span> {message.replyToMessageContentSnippet}
              </div>
            </div>
          )}

        {message.imageUrl && (
            <div
              className="my-2 relative w-full max-w-xs sm:max-w-sm md:max-w-md rounded-md overflow-hidden group cursor-pointer" // Added cursor-pointer
              onClick={() => onOpenImageModal(message.imageUrl!, message.imageFileName)} // Re-added onClick for modal
            >
              <Image
                src={message.imageUrl}
                alt={message.imageFileName || "Hochgeladenes Bild"}
                width={700} 
                height={500} 
                className="rounded-md object-contain h-auto w-full"
                data-ai-hint="chat image"
                priority={false}
              />
            </div>
          )}
          {message.imageFileName && !message.imageUrl && <p className="text-xs opacity-70 mt-1 italic">Bild wird geladen: {message.imageFileName}</p>}

          {message.content && <p className="text-sm whitespace-pre-wrap">{message.content}</p>}

          {message.reactions && Object.keys(message.reactions).length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {Object.entries(message.reactions).map(([emoji, reactedUserIds]) => {
                if (!Array.isArray(reactedUserIds) || reactedUserIds.length === 0) return null;
                const currentUserReacted = currentUserId ? reactedUserIds.includes(currentUserId) : false;
                return (
                  <Button
                    key={emoji}
                    variant={"ghost"}
                    size="sm"
                    className={cn(
                      "h-auto px-1.5 py-0.5 rounded-full text-xs border",
                      // Consistent background for all reaction buttons for better contrast
                      "bg-black/10 dark:bg-white/10 border-current/30 hover:bg-black/20 dark:hover:bg-white/20",
                      currentUserReacted && 'bg-black/30 dark:bg-white/30 border-current/50 ring-1 ring-current/50 shadow-md' // Stronger highlight for own reaction
                    )}
                    onClick={(e) => { e.stopPropagation(); onReaction(message.id, emoji); }}
                  >
                    <span className="text-sm mr-0.5">{emoji}</span>
                    <span>{reactedUserIds.length}</span>
                  </Button>
                );
              })}
            </div>
          )}

          {/* Action buttons always visible */}
          <div className="flex items-center gap-1 mt-1.5 -ml-1 opacity-100 transition-opacity duration-150">
            {!isOwn && (
              <>
                <Button variant="ghost" size="sm" className={cn("h-auto px-1.5 py-0.5", "hover:bg-black/10 dark:hover:bg-white/10")} onClick={(e) => { e.stopPropagation(); onSetReply(message); }} aria-label="Antworten">
                  <CornerDownLeft className="h-3.5 w-3.5 mr-1" /> <span className="text-xs">Antworten</span>
                </Button>
                 <Button variant="ghost" size="sm" className={cn("h-auto px-1.5 py-0.5", "hover:bg-black/10 dark:hover:bg-white/10")} onClick={(e) => { e.stopPropagation(); onSetQuote(message); }} aria-label="Zitieren">
                  <Quote className="h-3.5 w-3.5 mr-1" /> <span className="text-xs">Zitieren</span>
                </Button>
              </>
            )}
            <Popover open={showReactionPicker && reactingToMessageId === message.id} onOpenChange={(open) => {
                if (!open) {
                    setShowReactionPicker(false);
                    setReactingToMessageId(null);
                } else {
                    setShowReactionPicker(true);
                    setReactingToMessageId(message.id);
                }
            }}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn("h-auto px-1.5 py-0.5", "hover:bg-black/10 dark:hover:bg-white/10")}
                  onClick={handleOpenReactionPicker}
                  aria-label="Reagieren"
                >
                  <SmilePlus className="h-3.5 w-3.5 mr-1" /> <span className="text-xs">Reagieren</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 mb-1 max-w-[300px] sm:max-w-xs z-20" side="top" align={isOwn ? "end" : "start"} onClick={(e) => e.stopPropagation()}>
                <Tabs defaultValue={emojiCategories[0].name} className="w-full">
                  <TabsList className="grid w-full grid-cols-5 h-auto p-1">
                    {emojiCategories.map(category => (
                      <TabsTrigger key={category.name} value={category.name} className="text-lg p-1 h-8" title={category.name}>
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
                              className="text-xl p-0 h-8 w-8"
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
      {isOwn && message.senderName && message.avatarFallback && (
        <Avatar className={cn("h-10 w-10 border-2 self-end shrink-0", bubbleColor.ring)}>
          <AvatarImage src={`https://placehold.co/40x40.png?text=${message.avatarFallback}`} alt="My Avatar" data-ai-hint="person user"/>
           <AvatarFallback className={cn("font-semibold",bubbleColor.bg, bubbleColor.text)}>
            {message.avatarFallback}
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
});

MessageBubble.displayName = "MessageBubble";

export { MessageBubble };
