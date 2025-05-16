
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Message, DisplayMessage, Scenario, SessionData } from '@/lib/types';

export function useMessages(
  sessionId: string | null,
  currentUserId: string | null,
  isAdminView: boolean = false,
  currentScenario: Scenario | undefined,
  sessionData: SessionData | null
) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [messagesError, setMessagesError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setMessages([]);
      setIsLoadingMessages(false);
      return;
    }

    setIsLoadingMessages(true);
    setMessagesError(null);
    console.log(`useMessages: Setting up Firestore listener for messages in session: ${sessionId}`);

    const messagesColRef = collection(db, "sessions", sessionId, "messages");
    const q_msg = query(messagesColRef, orderBy("timestamp", "asc"));

    const unsubscribe = onSnapshot(q_msg, (querySnapshot) => {
      console.log(`useMessages: Received message snapshot for session ${sessionId}. Document count: ${querySnapshot.size}`);
      let newMessagesData: DisplayMessage[] = [];

      // Handle Initial Post
      if (currentScenario?.initialPost && sessionData?.createdAt) {
        const initialPostTimestamp = sessionData.createdAt instanceof Timestamp 
          ? sessionData.createdAt 
          : (sessionData.createdAt as any)?.seconds 
            ? new Timestamp((sessionData.createdAt as any).seconds, (sessionData.createdAt as any).nanoseconds)
            : new Timestamp(0,0); // Fallback, should ideally be a valid Firestore Timestamp

        const initialPostMessage: DisplayMessage = {
          id: `initial-post-${sessionId}`,
          senderUserId: 'system-initial-post',
          senderName: currentScenario.initialPost.authorName || "System",
          avatarFallback: currentScenario.initialPost.authorAvatarFallback || "SY",
          senderType: 'system',
          content: currentScenario.initialPost.content,
          imageUrl: currentScenario.initialPost.imageUrl,
          platform: currentScenario.initialPost.platform || 'Generic',
          timestamp: initialPostTimestamp,
          isOwn: false,
          timestampDisplay: initialPostTimestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          reactions: {},
        };
        newMessagesData.push(initialPostMessage);
      }
      
      querySnapshot.forEach((docSn) => {
        const data = docSn.data() as Message;
        const timestamp = data.timestamp as Timestamp | null;
        newMessagesData.push({
          ...data,
          id: docSn.id,
          isOwn: data.senderUserId === currentUserId && (!isAdminView || (isAdminView && data.senderType === 'admin')),
          timestampDisplay: timestamp ? timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Senden...'
        });
      });
      
      // Sort messages if initial post was added (ensure it's first if timestamps are tricky)
      // Or simply rely on Firestore's orderBy for all except the prepended initial post.
      // If initialPost is always very first, its timestamp (sessionData.createdAt) should ensure this.
      // For safety, explicitly sort if initial post is present and might not be strictly first.
      if (currentScenario?.initialPost) {
        newMessagesData.sort((a, b) => {
          const tsA = a.timestamp instanceof Timestamp ? a.timestamp.toMillis() : 0;
          const tsB = b.timestamp instanceof Timestamp ? b.timestamp.toMillis() : 0;
          return tsA - tsB;
        });
      }

      setMessages(newMessagesData);
      setIsLoadingMessages(false);
    }, (error) => {
      console.error(`useMessages: Error fetching messages for session ${sessionId}:`, error);
      setMessagesError("Nachrichten konnten nicht geladen werden: " + error.message);
      setIsLoadingMessages(false);
    });

    return () => {
      console.log(`useMessages: Cleaning up Firestore listener for messages in session: ${sessionId}`);
      unsubscribe();
    };
  }, [sessionId, currentUserId, isAdminView, currentScenario, sessionData]);

  return { messages, isLoadingMessages, messagesError };
}
