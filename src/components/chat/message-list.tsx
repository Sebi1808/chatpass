"use client";

import type { RefObject } from 'react';
import { memo } from 'react';
import { MessageSquare } from "lucide-react";
import { MessageBubble } from './message-bubble';
import type { DisplayMessage, Participant } from '@/lib/types';
import type { ParticipantColor, emojiCategories as EmojiCategoriesType } from '@/lib/config';
import { cn } from '@/lib/utils';

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
  onOpenDm,
  toggleBlurMessage, 
  isTogglingBlur, 
  currentUserBadges,
  currentParticipantDetails,
  participants,
  onBlockUser,
  onReportMessage,
  blockingEnabled,
  reportingEnabled,
}: MessageListProps) {
  return (
    <div className="space-y-1"> {/* Reduced space-y for tighter packing */}
      {messages.map((msg) => {
        const isOwnMessage = msg.isOwn;
        const isAdmin = msg.senderType === 'admin';
        const isBot = msg.senderType === 'bot';
        const isSystem = msg.senderType === 'system';
        const showAvatar = !isOwnMessage && !isSystem;
        const senderType = msg.senderType as 'admin' | 'user' | 'bot' | undefined;
        const colorClasses = getParticipantColorClasses(msg.senderUserId, senderType);

        const messageReactions = msg.reactions || {};
        const hasReactions = Object.keys(messageReactions).length > 0;

        const participant = participants?.find(p => p.userId === msg.senderUserId);
        const participantHasPrivileges = participant?.assignedBadges?.includes('admin') || participant?.assignedBadges?.includes('moderator');

        return (
          <div
            key={msg.id}
            className={cn(
              "message-container flex mb-4 group relative",
              isOwnMessage && "justify-end",
              isSystem && "justify-center"
            )}
            data-message-id={msg.id}
          >
            <MessageBubble
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
              onOpenDm={onOpenDm}
              toggleBlurMessage={toggleBlurMessage}
              isTogglingBlur={isTogglingBlur}
              currentUserBadges={currentUserBadges}
              currentParticipantDetails={currentParticipantDetails}
              participants={participants}
              onBlockUser={onBlockUser}
              onReportMessage={onReportMessage}
              blockingEnabled={blockingEnabled || false}
              reportingEnabled={reportingEnabled || false}
            />
          </div>
        );
      })}
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

// Optimierte Vergleichsfunktion für React.memo
const areEqual = (prevProps: MessageListProps, nextProps: MessageListProps) => {
  // Tiefenvergleich nur für die wichtigsten Props
  if (prevProps.messages.length !== nextProps.messages.length) return false;
  if (prevProps.currentUserId !== nextProps.currentUserId) return false;
  if (prevProps.isChatDataLoading !== nextProps.isChatDataLoading) return false;
  if (prevProps.isAdminView !== nextProps.isAdminView) return false;
  if (prevProps.reactingToMessageId !== nextProps.reactingToMessageId) return false;
  if (prevProps.isTogglingBlur !== nextProps.isTogglingBlur) return false;
  if (prevProps.currentUserBadges?.length !== nextProps.currentUserBadges?.length) return false;
  if (prevProps.participants?.length !== nextProps.participants?.length) return false;
  if (prevProps.blockingEnabled !== nextProps.blockingEnabled) return false;
  if (prevProps.reportingEnabled !== nextProps.reportingEnabled) return false;
  
  // Vergleiche nur die IDs der Nachrichten, nicht den gesamten Inhalt
  for (let i = 0; i < prevProps.messages.length; i++) {
    if (prevProps.messages[i].id !== nextProps.messages[i].id) return false;
    // Vergleiche nur kritische Felder, die eine Neudarstellung erfordern
    if (prevProps.messages[i].content !== nextProps.messages[i].content) return false;
    if (prevProps.messages[i].isBlurred !== nextProps.messages[i].isBlurred) return false;
    if (JSON.stringify(prevProps.messages[i].reactions) !== JSON.stringify(nextProps.messages[i].reactions)) return false;
  }
  
  return true;
};

// Exportiere die optimierte Version
const OptimizedMessageList = memo(MessageList, areEqual);
OptimizedMessageList.displayName = "MessageList";

export { OptimizedMessageList as MessageList };
