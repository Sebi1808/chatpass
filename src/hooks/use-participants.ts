
"use client";

import { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, Timestamp, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Participant, DisplayParticipant } from '@/lib/types';

export function useParticipants(sessionId: string | null) {
  const [participants, setParticipants] = useState<DisplayParticipant[]>([]);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(true);
  const [participantsError, setParticipantsError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setParticipants([]);
      setIsLoadingParticipants(false);
      setParticipantsError(null); // Clear error when no session ID
      // console.log("useParticipants: No session ID, clearing participants.");
      return;
    }

    setIsLoadingParticipants(true);
    setParticipantsError(null);
    // console.log(`useParticipants: Setting up Firestore listener for participants in session: ${sessionId}`);

    const participantsColRef = collection(db, "sessions", sessionId, "participants");
    // Basic query, sorting will be done client-side after fetching
    // This avoids needing a composite index for isBot + joinedAt if not essential for DB query
    const q_participants = query(participantsColRef, orderBy("joinedAt", "asc"));

    const unsubscribe = onSnapshot(q_participants, (querySnapshot) => {
      // console.log(`useParticipants: Received participant snapshot for session ${sessionId}. Document count: ${querySnapshot.size}`);
      let fetchedParticipants: DisplayParticipant[] = [];
      querySnapshot.forEach((docSn) => {
        const data = docSn.data() as Participant;
        fetchedParticipants.push({
          ...data,
          id: docSn.id,
          // ensure botConfig is at least an empty object if not present
          botConfig: data.botConfig || { id: data.botScenarioId || '', personality: 'standard', currentEscalation: 0, isActive: true, autoTimerEnabled: false } 
        });
      });

      // Client-side sorting: Bots first, then by joinedAt
      fetchedParticipants.sort((a, b) => {
        if (a.isBot && !b.isBot) return -1;
        if (!a.isBot && b.isBot) return 1;
        // For joinedAt, ensure they are valid Timestamps or comparable values
        const timeA = a.joinedAt instanceof Timestamp ? a.joinedAt.toMillis() : (typeof a.joinedAt === 'number' ? a.joinedAt : 0);
        const timeB = b.joinedAt instanceof Timestamp ? b.joinedAt.toMillis() : (typeof b.joinedAt === 'number' ? b.joinedAt : 0);
        return timeA - timeB;
      });
      
      // console.log('useParticipants: Fetched and sorted participants:', fetchedParticipants);
      setParticipants(fetchedParticipants);
      setIsLoadingParticipants(false);
    }, (error) => {
      console.error(`useParticipants: Error fetching participants for session ${sessionId}:`, error);
      setParticipantsError("Teilnehmerliste konnte nicht geladen werden: " + error.message);
      setParticipants([]);
      setIsLoadingParticipants(false);
    });

    return () => {
      // console.log(`useParticipants: Cleaning up Firestore listener for participants in session: ${sessionId}`);
      unsubscribe();
    };
  }, [sessionId]);

  return { participants, isLoading: isLoadingParticipants, error: participantsError };
}
