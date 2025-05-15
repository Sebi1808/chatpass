
"use client";

import { useState, type MouseEvent } from 'react';
import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CornerDownLeft, Quote, SmilePlus, Bot as BotIcon, Crown, Edit3, MessageSquare, User } from "lucide-react";
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
  emojiCategories: typeof EmojiCategoriesType;
  onOpenImageModal: (imageUrl: string, imageFileName?: string) => void;
}

export function MessageBubble({
  message,
  currentUserId,
  getParticipantColorClasses,
  onMentionUser,
  onSetReply,
  onSetQuote,
  onScrollToMessage,
  onReaction,
  emojiCategories,
  onOpenImageModal,
}: MessageBubbleProps) {
  const [showReactionPickerPopover, setShowReactionPickerPopover] = useState(false);
  
  const isOwn = message.senderUserId === currentUserId && message.senderType !== 'admin';
  const isAdminMessage = message.senderType === 'admin';

  // Call getParticipantColorClasses to get the color object
  const bubbleColor = getParticipantColorClasses(message.senderUserId, message.senderType);

  // Log the determined color for debugging
  // console.log(`MessageBubble: userId=${message.senderUserId}, senderType=${message.senderType}, isOwn=${isOwn}, isAdminMessage=${isAdminMessage}, bubbleColorName=${bubbleColor.name}`);

  const handleLocalEmojiSelectForReaction = (emoji: string) => {
    onReaction(message.id, emoji);
    setShowReactionPickerPopover(false);
  };

  const handleImageClick = (e: MouseEvent<HTMLDivElement | HTMLImageElement>) => {
    e.stopPropagation(); // Prevent other clicks if image is inside other clickable elements
    if (message.imageUrl) {
      onOpenImageModal(message.imageUrl, message.imageFileName);
    }
  };

  return (
    <div
      id={`msg-${message.id}`}
      className={cn(
        "flex gap-3 w-full",
        isOwn ? "justify-end" : "justify-start"
      )}
    >
      {(!isOwn || isAdminMessage) && (
        <Avatar className={cn("h-10 w-10 border-2 self-end shrink-0", bubbleColor.ring)}>
          <AvatarImage src={`https://placehold.co/40x40.png?text=${message.avatarFallback}`} alt={message.senderName} data-ai-hint="person user"/>
          <AvatarFallback className={cn("font-semibold",bubbleColor.bg, bubbleColor.text)}>{message.avatarFallback}</AvatarFallback>
        </Avatar>
      )}
      <div className={cn(
          "max-w-[70%] md:max-w-[65%] lg:max-w-[60%] rounded-xl shadow-md flex flex-col",
          bubbleColor.bg, // Apply background from bubbleColor
          bubbleColor.text  // Apply text color from bubbleColor
        )}
      >
        <div className="p-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5"> {/* Container for name and badge */}
              <button
                onClick={() => !isOwn && !isAdminMessage && onMentionUser(message.senderName)}
                className={cn(
                  "text-xs font-semibold cursor-pointer hover:underline",
                  bubbleColor.nameText // Apply nameText color
                )}
                disabled={isOwn || isAdminMessage}
              >
                {message.senderName}
              </button>
              {message.senderType === 'bot' && (
                <Badge variant="outline" className={cn("text-xs px-1.5 py-0.5 h-5 leading-tight border-purple-400/70 text-purple-100 bg-purple-600/90 shadow")}>
                  <BotIcon className="h-3 w-3 mr-1" />BOT
                </Badge>
              )}
              {isAdminMessage && (
                <Badge variant="outline" className={cn("text-xs px-1.5 py-0.5 h-5 leading-tight border-red-400/70 text-red-100 bg-red-600/90 shadow")}>
                  <Crown className="h-3 w-3 mr-1" />ADMIN
                </Badge>
              )}
            </div>
            <span className={cn("text-xs opacity-70", isOwn ? "text-primary-foreground/70" : bubbleColor.text, "opacity-80")}>{message.timestampDisplay}</span>
          </div>

          {message.replyToMessageId && message.replyToMessageSenderName && message.replyToMessageContentSnippet && (
            <div
              className={cn(
                "text-xs p-1.5 rounded-md mb-1.5 flex items-center gap-1 cursor-pointer hover:opacity-100",
                isOwn ? "bg-black/20 text-primary-foreground/80" : "bg-black/10 opacity-80",
                bubbleColor.text // ensure reply snippet text also respects bubbleColor
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
              className="my-2 relative w-full max-w-xs sm:max-w-sm md:max-w-md rounded-md overflow-hidden group cursor-pointer"
              onClick={handleImageClick}
            >
              <Image
                src={message.imageUrl}
                alt={message.imageFileName || "Hochgeladenes Bild"}
                width={700} 
                height={500} 
                className="rounded-md object-contain h-auto w-full" 
                data-ai-hint="chat image"
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
                    variant={"ghost"} // Base variant for reactions
                    size="sm"
                    className={cn(
                      "h-auto px-1.5 py-0.5 rounded-full text-xs border",
                      currentUserReacted
                        ? (isOwn ? 'bg-primary-foreground/30 border-primary-foreground/50 text-primary-foreground' : 'bg-black/40 border-current/50 text-current') // Stronger highlight for own reaction
                        : cn(bubbleColor.text, `hover:bg-black/10 border-current/30`) // Default reaction button style
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

          <div className="flex items-center gap-1 mt-1.5 -ml-1">
            {(!isOwn || isAdminMessage) && (
              <>
                <Button variant="ghost" size="sm" className={cn("h-auto px-1.5 py-0.5 opacity-60 hover:opacity-100", bubbleColor.text, "hover:bg-black/10")} onClick={(e) => { e.stopPropagation(); onSetReply(message); }} aria-label="Antworten">
                  <CornerDownLeft className="h-3.5 w-3.5 mr-1" /> <span className="text-xs">Antworten</span>
                </Button>
                 <Button variant="ghost" size="sm" className={cn("h-auto px-1.5 py-0.5 opacity-60 hover:opacity-100", bubbleColor.text, "hover:bg-black/10")} onClick={(e) => { e.stopPropagation(); onSetQuote(message); }} aria-label="Zitieren">
                  <Quote className="h-3.5 w-3.5 mr-1" /> <span className="text-xs">Zitieren</span>
                </Button>
              </>
            )}
            <Popover open={showReactionPickerPopover} onOpenChange={setShowReactionPickerPopover}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn("h-auto px-1.5 py-0.5 opacity-60 hover:opacity-100", bubbleColor.text, "hover:bg-black/10")}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowReactionPickerPopover(true); 
                  }}
                  aria-label="Reagieren"
                >
                  <SmilePlus className="h-3.5 w-3.5 mr-1" /> <span className="text-xs">Reagieren</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 mb-1 max-w-[300px] sm:max-w-xs" side="top" align={isOwn && !isAdminMessage ? "end" : "start"} onClick={(e) => e.stopPropagation()}>
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
      {isOwn && !isAdminMessage && message.senderName && message.avatarFallback && (
        <Avatar className={cn("h-10 w-10 border-2 self-end shrink-0", bubbleColor.ring)}>
          <AvatarImage src={`https://placehold.co/40x40.png?text=${message.avatarFallback}`} alt="My Avatar" data-ai-hint="person user"/>
           <AvatarFallback className={cn("font-semibold",bubbleColor.bg, bubbleColor.text)}>
            {message.avatarFallback}
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}

    