
"use client";

import type { RefObject } from 'react';
import { memo } from 'react';
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
  // onScrollToMessage: (messageId: string) => void; // This was never fully implemented or used
  onReaction: (messageId: string, emoji: string) => Promise<void>; 
  reactingToMessageId: string | null; 
  setReactingToMessageId: (messageId: string | null) => void;
  emojiCategories: typeof EmojiCategoriesType; 
  messagesEndRef: RefObject<HTMLDivElement>;
  isChatDataLoading: boolean;
  isAdminView?: boolean;
  onOpenImageModal: (imageUrl: string, imageFileName?: string) => void;
}

const MessageList = memo(function MessageList({
  messages,
  currentUserId,
  getParticipantColorClasses,
  onMentionUser,
  onSetReply,
  onSetQuote,
  // onScrollToMessage,
  onReaction, 
  reactingToMessageId,
  setReactingToMessageId,
  emojiCategories, 
  messagesEndRef,
  isChatDataLoading,
  isAdminView = false,
  onOpenImageModal,
}: MessageListProps) {
  return (
    <div className="space-y-1"> {/* Reduced space-y for tighter packing */}
      {messages.map((msg) => (
        <MessageBubble
          key={msg.id}
          message={msg}
          currentUserId={currentUserId}
          getParticipantColorClasses={getParticipantColorClasses}
          onMentionUser={onMentionUser}
          onSetReply={onSetReply}
          onSetQuote={onSetQuote}
          // onScrollToMessage={onScrollToMessage}
          onReaction={onReaction} 
          reactingToMessageId={reactingToMessageId}
          setReactingToMessageId={setReactingToMessageId}
          emojiCategories={emojiCategories}
          isAdminView={isAdminView}
          onOpenImageModal={onOpenImageModal}
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
      {isChatDataLoading && messages.length === 0 && ( // Show loading only if no messages yet
        <div className="text-center text-muted-foreground py-8">
          <MessageSquare className="mx-auto h-12 w-12 mb-2 opacity-50 animate-pulse" />
          <p>Lade Chat-Nachrichten...</p>
        </div>
      )}
    </div>
  );
});

MessageList.displayName = "MessageList";

export { MessageList };
