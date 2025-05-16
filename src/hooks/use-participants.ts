
"use client";

import { useState, useEffect } from 'react';
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
      setParticipantsError(null); 
      console.log("useParticipants: No session ID, clearing participants.");
      return;
    }

    setIsLoadingParticipants(true);
    setParticipantsError(null);
    console.log(`useParticipants: Setting up Firestore listener for participants in session: ${sessionId}`);

    const participantsColRef = collection(db, "sessions", sessionId, "participants");
    // Order by bot status first (bots on top), then by join time
    const q_participants = query(participantsColRef, orderBy("isBot", "desc"), orderBy("joinedAt", "asc"));


    const unsubscribe = onSnapshot(q_participants, (querySnapshot) => {
      console.log(`useParticipants: Received participant snapshot for session ${sessionId}. Document count: ${querySnapshot.size}`);
      let fetchedParticipants: DisplayParticipant[] = [];
      querySnapshot.forEach((docSn) => {
        const data = docSn.data() as Participant;
        fetchedParticipants.push({
          ...data,
          id: docSn.id,
          // Ensure botConfig defaults if not present or partially present
          botConfig: data.isBot ? { 
            id: data.botScenarioId || data.id, // Fallback to participant id if botScenarioId is missing
            personality: data.botConfig?.personality || 'standard', 
            currentEscalation: data.botConfig?.currentEscalation ?? 0, 
            isActive: data.botConfig?.isActive ?? true, 
            autoTimerEnabled: data.botConfig?.autoTimerEnabled ?? false,
            initialMission: data.botConfig?.initialMission || "",
            currentMission: data.botConfig?.currentMission || data.botConfig?.initialMission || "",
            templateOriginId: data.botConfig?.templateOriginId
          } : undefined // No botConfig for human participants
        });
      });
      
      // Client-side sort: bots first, then humans, then by joinedAt if needed
      // Firestore query already sorts by isBot desc, joinedAt asc.
      // If further client-side refinement is needed, it can be done here.
      // For now, rely on Firestore's ordering.
      
      console.log('useParticipants: Fetched and ordered participants from Firestore:', fetchedParticipants.map(p => ({name: p.name, isBot: p.isBot, joinedAt: p.joinedAt})));
      setParticipants(fetchedParticipants);
      setIsLoadingParticipants(false);
    }, (error) => {
      console.error(`useParticipants: Error fetching participants for session ${sessionId}:`, error);
      // Check for Firestore index error specifically
      if (error.message && error.message.includes("The query requires an index")) {
        setParticipantsError(`Firestore-Fehler: Ein benötigter Index für die Teilnehmerabfrage fehlt. Bitte erstellen Sie ihn in der Firebase Console. Details: ${error.message}`);
      } else {
        setParticipantsError("Teilnehmerliste konnte nicht geladen werden: " + error.message);
      }
      setParticipants([]);
      setIsLoadingParticipants(false);
    });

    return () => {
      console.log(`useParticipants: Cleaning up Firestore listener for participants in session: ${sessionId}`);
      unsubscribe();
    };
  }, [sessionId]);

  return { participants, isLoadingParticipants, participantsError };
}
