
"use client";

import { useState, useEffect } from 'react';
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
      setMessagesError(null);
      // console.log("useMessages: No session ID, clearing messages.");
      return;
    }

    setIsLoadingMessages(true);
    setMessagesError(null);
    // console.log(`useMessages: Setting up Firestore listener for messages in session: ${sessionId}`);

    const messagesColRef = collection(db, "sessions", sessionId, "messages");
    const q_msg = query(messagesColRef, orderBy("timestamp", "asc"));

    const unsubscribe = onSnapshot(q_msg, (querySnapshot) => {
      // console.log(`useMessages: Received message snapshot for session ${sessionId}. Document count: ${querySnapshot.size}`);
      let newMessagesData: DisplayMessage[] = [];
      
      // Handle initial post
      let initialPostMessage: DisplayMessage | null = null;
      if (currentScenario?.initialPost && sessionData?.createdAt) {
        const initialPostConfig = currentScenario.initialPost;
        let validInitialPostTimestamp: Timestamp;

        if (sessionData.createdAt instanceof Timestamp) {
          validInitialPostTimestamp = sessionData.createdAt;
        } else if (sessionData.createdAt instanceof Date) {
          validInitialPostTimestamp = Timestamp.fromDate(sessionData.createdAt);
        } else if (typeof sessionData.createdAt === 'object' && sessionData.createdAt && 'seconds' in sessionData.createdAt && 'nanoseconds' in sessionData.createdAt) {
           validInitialPostTimestamp = new Timestamp((sessionData.createdAt as any).seconds, (sessionData.createdAt as any).nanoseconds);
        }
         else {
          // console.warn("useMessages: sessionData.createdAt is not a valid Firestore Timestamp or JS Date. Using current time for initial post.");
          validInitialPostTimestamp = Timestamp.now(); 
        }
        
        initialPostMessage = {
          id: `initial-post-${sessionId}`,
          senderUserId: 'system-initial-post',
          senderName: initialPostConfig.authorName || "System",
          avatarFallback: initialPostConfig.authorAvatarFallback || "SY",
          senderType: 'system',
          content: initialPostConfig.content,
          imageUrl: initialPostConfig.imageUrl,
          platform: initialPostConfig.platform || 'Generic',
          timestamp: validInitialPostTimestamp,
          isOwn: false,
          timestampDisplay: validInitialPostTimestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          reactions: {},
        };
        // console.log("useMessages: Created initial post message:", initialPostMessage);
      }
      
      querySnapshot.forEach((docSn) => {
        const data = docSn.data() as Message;
        const timestamp = data.timestamp as Timestamp | null; // Assuming timestamp is already a Firestore Timestamp or null
        newMessagesData.push({
          ...data,
          id: docSn.id,
          isOwn: data.senderUserId === currentUserId && (!isAdminView || (isAdminView && data.senderType === 'admin')),
          timestampDisplay: timestamp ? timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Senden...'
        });
      });
      
      let combinedMessages = [...newMessagesData];
      if (initialPostMessage) {
        // Avoid duplicates if the initial post was somehow already fetched (e.g., if manually added)
        if (!combinedMessages.find(msg => msg.id === initialPostMessage!.id)) {
          combinedMessages.unshift(initialPostMessage);
        }
      }

      // Sort all messages again to ensure initial post is correctly placed if timestamps are very close
      combinedMessages.sort((a, b) => {
        const tsA = a.timestamp instanceof Timestamp ? a.timestamp.toMillis() : (a.timestamp && typeof (a.timestamp as any).seconds === 'number' ? (a.timestamp as any).seconds * 1000 : Date.now());
        const tsB = b.timestamp instanceof Timestamp ? b.timestamp.toMillis() : (b.timestamp && typeof (b.timestamp as any).seconds === 'number' ? (b.timestamp as any).seconds * 1000 : Date.now());
        return tsA - tsB;
      });
      
      // console.log("useMessages: Formatted and sorted messages count:", combinedMessages.length);
      setMessages(combinedMessages);
      setIsLoadingMessages(false);
    }, (error) => {
      console.error(`useMessages: Error fetching messages for session ${sessionId}:`, error);
      setMessagesError("Nachrichten konnten nicht geladen werden: " + error.message);
      setIsLoadingMessages(false);
    });

    return () => {
      // console.log(`useMessages: Cleaning up Firestore listener for messages in session: ${sessionId}`);
      unsubscribe();
    };
  }, [sessionId, currentUserId, isAdminView, currentScenario, sessionData]); // Added currentScenario and sessionData as dependencies

  return { messages, isLoadingMessages, messagesError };
}
