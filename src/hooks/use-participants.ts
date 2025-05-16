
"use client";

import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, Timestamp, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Participant, DisplayParticipant, BotConfig } from '@/lib/types';

export function useParticipants(sessionId: string | null) {
  const [participants, setParticipants] = useState<DisplayParticipant[]>([]);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(true);
  const [participantsError, setParticipantsError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setParticipants([]);
      setIsLoadingParticipants(false);
      setParticipantsError(null);
      // console.log("useParticipants: No session ID, clearing participants.");
      return;
    }

    setIsLoadingParticipants(true);
    setParticipantsError(null);
    // console.log(`useParticipants: Setting up Firestore listener for participants in session: ${sessionId}`);

    const participantsColRef = collection(db, "sessions", sessionId, "participants");
    // Sort by joinedAt, client-side will handle bot priority
    const q_participants = query(participantsColRef, orderBy("joinedAt", "asc"));

    const unsubscribe = onSnapshot(q_participants, (querySnapshot) => {
      // console.log(`useParticipants: Received participant snapshot for session ${sessionId}. Document count: ${querySnapshot.size}`);
      let fetchedParticipants: DisplayParticipant[] = [];
      querySnapshot.forEach((docSn) => {
        const data = docSn.data() as Participant;
        const botConfigData = data.botConfig as BotConfig | undefined; // Explicitly type botConfig
        
        fetchedParticipants.push({
          ...data,
          id: docSn.id,
          // Ensure botConfig is correctly formed or undefined
          botConfig: data.isBot ? { 
            id: data.botScenarioId || data.id, // Fallback to participant id if botScenarioId is missing
            name: botConfigData?.name || data.name, // Ensure name is present
            personality: botConfigData?.personality || 'standard', 
            currentEscalation: botConfigData?.currentEscalation ?? 0, 
            isActive: botConfigData?.isActive ?? true, 
            autoTimerEnabled: botConfigData?.autoTimerEnabled ?? false,
            initialMission: botConfigData?.initialMission || "",
            currentMission: botConfigData?.currentMission || botConfigData?.initialMission || "",
            templateOriginId: botConfigData?.templateOriginId,
            avatarFallback: botConfigData?.avatarFallback || data.avatarFallback
          } : undefined,
        });
      });
      
      // Client-side sort: bots first, then humans by joinedAt
      fetchedParticipants.sort((a, b) => {
        if (a.isBot && !b.isBot) return -1;
        if (!a.isBot && b.isBot) return 1;
        // Fallback to joinedAt if both are same type (already handled by Firestore orderBy)
        const timeA = a.joinedAt instanceof Timestamp ? a.joinedAt.toMillis() : (typeof a.joinedAt === 'object' && a.joinedAt && 'seconds' in a.joinedAt ? (a.joinedAt as unknown as Timestamp).toMillis() : 0);
        const timeB = b.joinedAt instanceof Timestamp ? b.joinedAt.toMillis() : (typeof b.joinedAt === 'object' && b.joinedAt && 'seconds' in b.joinedAt ? (b.joinedAt as unknown as Timestamp).toMillis() : 0);
        return timeA - timeB;
      });
      
      // console.log('useParticipants: Fetched and re-sorted participants:', fetchedParticipants.map(p => ({name: p.name, isBot: p.isBot, joinedAt: p.joinedAt})));
      setParticipants(fetchedParticipants);
      setIsLoadingParticipants(false);
    }, (error) => {
      console.error(`useParticipants: Error fetching participants for session ${sessionId}:`, error);
      if (error.message && error.message.includes("The query requires an index")) {
        setParticipantsError(`Firestore-Fehler: Ein benötigter Index für die Teilnehmerabfrage fehlt. Details: ${error.message}`);
      } else {
        setParticipantsError("Teilnehmerliste konnte nicht geladen werden: " + error.message);
      }
      setParticipants([]); // Clear participants on error
      setIsLoadingParticipants(false);
    });

    return () => {
      // console.log(`useParticipants: Cleaning up Firestore listener for participants in session: ${sessionId}`);
      unsubscribe();
    };
  }, [sessionId]);

  return { participants, isLoadingParticipants, participantsError };
}
