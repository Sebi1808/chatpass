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

        const createdAtVal = sessionData.createdAt;

        if (createdAtVal instanceof Timestamp) {
          validInitialPostTimestamp = createdAtVal;
        } else if (typeof (createdAtVal as any)?.toDate === 'function') {
          try {
            validInitialPostTimestamp = Timestamp.fromDate((createdAtVal as any).toDate());
          } catch (e) {
            // If toDate exists but is not a valid Date for Timestamp.fromDate
            // or if it IS a Date object but somehow invalid for Timestamp.fromDate,
            // we try to handle it as a Firestore-like plain object or fall back to now().
            if (typeof createdAtVal === 'object' && createdAtVal !== null && 
                'seconds' in createdAtVal && 'nanoseconds' in createdAtVal && 
                typeof (createdAtVal as any).seconds === 'number' && typeof (createdAtVal as any).nanoseconds === 'number') {
              validInitialPostTimestamp = new Timestamp((createdAtVal as any).seconds, (createdAtVal as any).nanoseconds);
            } else {
              console.warn("useMessages: createdAtVal.toDate() failed and value is not a Firestore-like object. Falling back to Timestamp.now(). createdAtVal:", createdAtVal, "Error:", e);
              validInitialPostTimestamp = Timestamp.now();
            }
          }
        } else if (typeof createdAtVal === 'object' && createdAtVal !== null && 
                   'seconds' in createdAtVal && 'nanoseconds' in createdAtVal && 
                   typeof (createdAtVal as any).seconds === 'number' && typeof (createdAtVal as any).nanoseconds === 'number') {
          // This handles Firestore-like plain objects if toDate() was not present
          validInitialPostTimestamp = new Timestamp((createdAtVal as any).seconds, (createdAtVal as any).nanoseconds);
        } else if (typeof createdAtVal === 'object' && createdAtVal !== null && createdAtVal instanceof Date) { 
          // Explicit Date check as a further fallback.
          try {
            validInitialPostTimestamp = Timestamp.fromDate(createdAtVal);
          } catch (e) {
            console.warn("useMessages: createdAtVal instanceof Date but Timestamp.fromDate() failed. Falling back to Timestamp.now(). createdAtVal:", createdAtVal, "Error:", e);
            validInitialPostTimestamp = Timestamp.now();
          }
        } else {
          console.warn("useMessages: createdAtVal is not a recognized Timestamp, Date, or Firestore-like object. Falling back to Timestamp.now(). createdAtVal:", createdAtVal);
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
        
        // Skip admin broadcast messages for the main chat feed
        if (data.isAdminBroadcast) {
          return; 
        }

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
