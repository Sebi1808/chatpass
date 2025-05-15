
"use client";

import { useState } from 'react'; // Keep useState for local state like showReactionPicker
import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CornerDownLeft, Quote, SmilePlus, Bot as BotIcon, Crown, Edit3 } from "lucide-react";
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
  onOpenReactionPicker: (messageId: string) => void;
  onImageClick: (imageUrl: string, imageFileName?: string) => void; // Prop for opening modal
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
  onOpenReactionPicker,
  onImageClick, // Use this prop
}: MessageBubbleProps) {
  const [showReactionPicker, setShowReactionPicker] = useState(false); // Local state for this bubble's picker
  const isOwn = message.senderUserId === currentUserId;

  // Determine bubble color. For own messages, check if it's an admin in admin view.
  let bubbleColor: ParticipantColor;
  if (isOwn) {
    // If the current user is an admin (based on senderType from message), use admin color.
    // This assumes message.senderType is correctly set to 'admin' for admins.
    if (message.senderType === 'admin') {
      bubbleColor = getParticipantColorClasses(message.senderUserId, 'admin');
    } else {
      // Otherwise, use the 'own' color for regular users.
      bubbleColor = getParticipantColorClasses(message.senderUserId, 'user'); // Will resolve to ownColor
    }
  } else {
    bubbleColor = getParticipantColorClasses(message.senderUserId, message.senderType);
  }


  const handleLocalEmojiSelectForReaction = (emoji: string) => {
    onReaction(message.id, emoji);
    setShowReactionPicker(false); // Close picker after reaction
  };


  return (
    <div
      id={`msg-${message.id}`}
      className={`flex gap-3 ${isOwn ? "justify-end" : "justify-start"}`}
    >
      {!isOwn && (
        <Avatar className={cn("h-10 w-10 border-2 self-end shrink-0", bubbleColor.ring)}>
          <AvatarImage src={`https://placehold.co/40x40.png?text=${message.avatarFallback}`} alt={message.senderName} data-ai-hint="person user"/>
          <AvatarFallback className={cn(bubbleColor.bg, bubbleColor.text)}>{message.avatarFallback}</AvatarFallback>
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
              {message.senderType === 'bot' && <Badge variant="outline" className={cn("ml-1.5 text-xs px-1 py-0 flex items-center gap-1", isOwn ? "border-primary-foreground/50 text-primary-foreground/80 bg-primary-foreground/10" : `border-accent/50 text-accent bg-accent/10`)}>🤖 BOT</Badge>}
              {message.senderType === 'admin' && <Badge variant="outline" className={cn("ml-1.5 text-xs px-1.5 py-0 flex items-center gap-1", isOwn ? "border-primary-foreground/70 text-primary-foreground/80 bg-primary-foreground/10" : "border-destructive/70 text-destructive-foreground bg-destructive/20")}>👑 ADMIN</Badge>}
            </button>
            <span className={`text-xs ${isOwn ? "text-primary-foreground/70" : bubbleColor.text} opacity-70`}>{message.timestampDisplay}</span>
          </div>

          {message.replyToMessageId && message.replyToMessageSenderName && message.replyToMessageContentSnippet && (
            <div
              className={cn("text-xs p-1.5 rounded-md mb-1.5 flex items-center gap-1 cursor-pointer hover:opacity-100", isOwn ? "bg-black/20 text-primary-foreground/80" : "bg-black/10 text-current opacity-80")}
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
              onClick={() => onImageClick(message.imageUrl!, message.imageFileName)} // Use onImageClick prop
            >
              <Image
                src={message.imageUrl}
                alt={message.imageFileName || "Hochgeladenes Bild"}
                width={700} // Base width for aspect ratio calculation by Next/Image
                height={500} // Base height
                className="rounded-md object-contain h-auto" // h-auto is important
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
                    variant={currentUserReacted ? "secondary" : "ghost"}
                    size="sm"
                    className={cn(
                      "h-auto px-1.5 py-0.5 rounded-full text-xs",
                      currentUserReacted
                        ? (isOwn ? 'bg-primary-foreground/20 border border-primary-foreground/50 text-primary-foreground' : `bg-black/30 border border-current text-current`)
                        : cn(bubbleColor.text, `hover:bg-black/10`)
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
                <Button variant="ghost" size="sm" className={cn("h-auto px-1.5 py-0.5 opacity-60 hover:opacity-100", bubbleColor.text, "hover:bg-black/10")} onClick={(e) => { e.stopPropagation(); onSetReply(message); }} aria-label="Antworten">
                  <CornerDownLeft className="h-3.5 w-3.5 mr-1" /> <span className="text-xs">Antworten</span>
                </Button>
                 <Button variant="ghost" size="sm" className={cn("h-auto px-1.5 py-0.5 opacity-60 hover:opacity-100", bubbleColor.text, "hover:bg-black/10")} onClick={(e) => { e.stopPropagation(); onSetQuote(message); }} aria-label="Zitieren">
                  <Quote className="h-3.5 w-3.5 mr-1" /> <span className="text-xs">Zitieren</span>
                </Button>
              </>
            )}
            <Popover open={showReactionPicker} onOpenChange={setShowReactionPicker}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn("h-auto px-1.5 py-0.5 opacity-60 hover:opacity-100", bubbleColor.text, "hover:bg-black/10")}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenReactionPicker(message.id); // Inform parent which message is being reacted to
                    setShowReactionPicker(true);
                  }}
                  aria-label="Reagieren"
                >
                  <SmilePlus className="h-3.5 w-3.5 mr-1" /> <span className="text-xs">Reagieren</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 mb-1 max-w-[300px] sm:max-w-xs" side="top" align={isOwn ? "end" : "start"} onClick={(e) => e.stopPropagation()}>
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
           <AvatarFallback className={cn(bubbleColor.bg, bubbleColor.text)}>
            {message.senderType === 'admin' ? <Crown className="h-5 w-5" /> : message.avatarFallback}
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}

    