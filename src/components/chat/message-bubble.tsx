
"use client";

import type { MouseEvent, useState } from 'react';
import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CornerDownLeft, Quote, SmilePlus, Eye } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from '@/lib/utils';
import type { DisplayMessage } from '@/lib/types';
import type { ParticipantColor, emojiCategories as EmojiCategoriesType } from '@/lib/config';

interface MessageBubbleProps {
  message: DisplayMessage;
  isOwn: boolean;
  currentUserId: string | null;
  getParticipantColorClasses: (pUserId?: string, pSenderType?: 'admin' | 'user' | 'bot') => ParticipantColor;
  onMentionUser: (name: string) => void;
  onSetReply: (message: DisplayMessage) => void;
  onSetQuote: (message: DisplayMessage) => void;
  onScrollToMessage: (messageId: string) => void;
  onSetImageForModal: (imageUrl: string | null, imageFileName?: string | null) => void;
  onReaction: (messageId: string, emoji: string) => void;
  emojiCategories: typeof EmojiCategoriesType;
}

export function MessageBubble({
  message,
  isOwn,
  currentUserId,
  getParticipantColorClasses,
  onMentionUser,
  onSetReply,
  onSetQuote,
  onScrollToMessage,
  onSetImageForModal,
  onReaction,
  emojiCategories,
}: MessageBubbleProps) {
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const bubbleColor = isOwn
    ? (message.senderType === 'admin' ? getParticipantColorClasses(currentUserId || undefined, 'admin') : { bg: "bg-primary", text: "text-primary-foreground", nameText: "text-primary-foreground/90", ring: "ring-primary" })
    : getParticipantColorClasses(message.senderUserId, message.senderType);

  const handleMessageClick = (e: MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, a, img, [data-radix-popover-content-wrapper]')) {
      return;
    }
  };

  const handleEmojiSelectForReaction = (emoji: string) => {
    onReaction(message.id, emoji);
    setShowReactionPicker(false);
  };


  return (
    <div
      id={`msg-${message.id}`}
      className={`flex gap-3 ${isOwn ? "justify-end" : "justify-start"}`}
      onClick={handleMessageClick}
    >
      {!isOwn && (
        <Avatar className={cn("h-10 w-10 border-2 self-end shrink-0", bubbleColor.ring)}>
          <AvatarImage src={`https://placehold.co/40x40.png?text=${message.avatarFallback}`} alt={message.senderName} data-ai-hint="person user"/>
          <AvatarFallback className={`${bubbleColor.bg} ${bubbleColor.text}`}>{message.avatarFallback}</AvatarFallback>
        </Avatar>
      )}
      <div className={cn("max-w-xs md:max-w-md lg:max-w-lg rounded-xl shadow-md", bubbleColor.bg, bubbleColor.text)}>
        <div className="p-3">
          <div className="flex items-center justify-between mb-1">
            <button
              onClick={() => !isOwn && onMentionUser(message.senderName)}
              className={cn("text-xs font-semibold cursor-pointer hover:underline", bubbleColor.nameText)}
              disabled={isOwn}
            >
              {message.senderName}
              {message.senderType === 'bot' && <Badge variant="outline" className={cn("ml-1.5 text-xs px-1 py-0", isOwn ? "border-primary-foreground/50 text-primary-foreground/80 bg-primary-foreground/10" : "border-current text-current bg-transparent opacity-80")}>🤖 BOT</Badge>}
              {message.senderType === 'admin' && !isOwn && <Badge variant="destructive" className={cn("ml-1.5 text-xs px-1.5 py-0")}>👑 ADMIN</Badge>}
              {message.senderType === 'admin' && isOwn && <Badge variant="outline" className={cn("ml-1.5 text-xs px-1.5 py-0 border-primary-foreground/70 text-primary-foreground/80 bg-primary-foreground/10")}>👑 ADMIN (Du)</Badge>}
            </button>
            <span className={`text-xs ${isOwn ? "text-primary-foreground/70" : "opacity-70"}`}>{message.timestampDisplay}</span>
          </div>

          {message.replyToMessageId && message.replyToMessageSenderName && message.replyToMessageContentSnippet && (
            <div
              className={`text-xs p-1.5 rounded-md mb-1.5 flex items-center gap-1 ${isOwn ? "bg-black/20" : "bg-black/10"} opacity-80 cursor-pointer hover:opacity-100`}
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
              className="my-2 relative w-full max-w-[250px] sm:max-w-[300px] aspect-auto rounded-md overflow-hidden cursor-pointer group"
              onClick={(e) => { e.stopPropagation(); onSetImageForModal(message.imageUrl || null, message.imageFileName || "Bild");}}
            >
              <Image
                src={message.imageUrl}
                alt={message.imageFileName || "Hochgeladenes Bild"}
                width={300}
                height={300} // Provide a suitable height, next/image will maintain aspect ratio based on objectFit
                style={{
                  maxWidth: "100%",
                  height: "auto", // Allow height to adjust to maintain aspect ratio
                  objectFit: "contain",
                  display: "block"
                }}
                className="transition-transform duration-300 group-hover:scale-105"
                data-ai-hint="chat image"
              />
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <Eye className="h-8 w-8 text-white" />
              </div>
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
                    variant={currentUserReacted ? "secondary" : "ghost"}
                    size="sm"
                    className={cn(
                      "h-auto px-1.5 py-0.5 rounded-full text-xs",
                      currentUserReacted
                        ? `border ${bubbleColor.text === 'text-primary-foreground' ? 'border-primary-foreground/50 bg-black/30' : 'border-current bg-black/20'} ${bubbleColor.text}`
                        : `${bubbleColor.text} hover:bg-black/10`
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

          <div className="flex items-center gap-1 mt-1.5">
            {!isOwn && (
              <>
                <Button variant="ghost" size="sm" className={`h-auto px-1.5 py-0.5 opacity-60 hover:opacity-100 ${bubbleColor.text} hover:bg-black/10`} onClick={(e) => { e.stopPropagation(); onSetReply(message); }} aria-label="Antworten">
                  <CornerDownLeft className="h-3.5 w-3.5 mr-1" /> <span className="text-xs">Antworten</span>
                </Button>
                <Button variant="ghost" size="sm" className={`h-auto px-1.5 py-0.5 opacity-60 hover:opacity-100 ${bubbleColor.text} hover:bg-black/10`} onClick={(e) => { e.stopPropagation(); onSetQuote(message); }} aria-label="Zitieren">
                  <Quote className="h-3.5 w-3.5 mr-1" /> <span className="text-xs">Zitieren</span>
                </Button>
              </>
            )}
            <Popover open={showReactionPicker} onOpenChange={setShowReactionPicker}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className={`h-auto px-1.5 py-0.5 opacity-60 hover:opacity-100 ${bubbleColor.text} hover:bg-black/10`} onClick={(e) => { e.stopPropagation(); setShowReactionPicker(true); }} aria-label="Reagieren">
                  <SmilePlus className="h-3.5 w-3.5 mr-1" /> <span className="text-xs">Reagieren</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 mb-1 max-w-[300px] sm:max-w-xs" side="top" align="start" onClick={(e) => e.stopPropagation()}>
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
                              onClick={() => handleEmojiSelectForReaction(emoji)}
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
          <AvatarFallback className={`${bubbleColor.bg} ${bubbleColor.text}`}>
            {message.senderType === 'admin' ? "👑AD" : message.avatarFallback}
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
