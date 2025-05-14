
"use client";

import type { RefObject } from 'react';
import { MessageSquare } from "lucide-react";
import { MessageBubble } from './message-bubble';
import type { DisplayMessage } from '@/lib/types';
import type { ParticipantColor, emojiCategories as EmojiCategoriesType } from '@/lib/config';

interface MessageListProps {
  messages: DisplayMessage[];
  currentUserId: string | null;
  getParticipantColorClasses: (pUserId?: string, pSenderType?: 'admin' | 'user' | 'bot') => ParticipantColor;
  onMentionUser: (name: string) => void;
  onSetReply: (message: DisplayMessage) => void;
  onSetQuote: (message: DisplayMessage) => void;
  onScrollToMessage: (messageId: string) => void;
  onSetImageForModal: (imageUrl: string | null, imageFileName?: string | null) => void;
  onReaction: (messageId: string, emoji: string) => void; 
  emojiCategories: typeof EmojiCategoriesType; 
  messagesEndRef: RefObject<HTMLDivElement>;
  isChatDataLoading: boolean;
  isAdminView?: boolean;
  onOpenReactionPicker: (messageId: string) => void;
}

export function MessageList({
  messages,
  currentUserId,
  getParticipantColorClasses,
  onMentionUser,
  onSetReply,
  onSetQuote,
  onScrollToMessage,
  onSetImageForModal,
  onReaction, 
  emojiCategories, 
  messagesEndRef,
  isChatDataLoading,
  isAdminView = false,
  onOpenReactionPicker,
}: MessageListProps) {
  return (
    <div className="space-y-6">
      {messages.map((msg) => (
        <MessageBubble
          key={msg.id}
          message={msg}
          isOwn={msg.isOwn}
          currentUserId={currentUserId}
          getParticipantColorClasses={getParticipantColorClasses}
          onMentionUser={onMentionUser}
          onSetReply={onSetReply}
          onSetQuote={onSetQuote}
          onScrollToMessage={onScrollToMessage}
          onSetImageForModal={onSetImageForModal}
          onReaction={onReaction} 
          emojiCategories={emojiCategories} 
          onOpenReactionPicker={onOpenReactionPicker}
        />
      ))}
      <div ref={messagesEndRef} />
      {messages.length === 0 && !isChatDataLoading && (
        <div className="text-center text-muted-foreground py-8">
          <MessageSquare className="mx-auto h-12 w-12 mb-2 opacity-50" />
          <p>Noch keine Nachrichten in dieser Sitzung.</p>
          {!isAdminView && <p>Sei der Erste, der eine Nachricht sendet!</p>}
        </div>
      )}
      {isChatDataLoading && (
        <div className="text-center text-muted-foreground py-8">
          <MessageSquare className="mx-auto h-12 w-12 mb-2 opacity-50 animate-pulse" />
          <p>Lade Chat-Nachrichten...</p>
        </div>
      )}
    </div>
  );
}

    