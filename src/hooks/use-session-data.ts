
"use client";

import { useState, useEffect } from 'react';
import { doc, onSnapshot, Timestamp } from 'firebase/firestore'; // Added Timestamp import
import { db } from '@/lib/firebase';
import type { SessionData } from '@/lib/types';

export function useSessionData(sessionId: string | null) {
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setSessionData(null);
      setIsLoading(false);
      setError(null);
      // console.log("useSessionData: No session ID, clearing session data.");
      return;
    }

    // console.log(`useSessionData: Setting up Firestore listener for session: ${sessionId}`);
    setIsLoading(true);
    setError(null);
    const sessionDocRef = doc(db, "sessions", sessionId);

    const unsubscribe = onSnapshot(sessionDocRef, (docSnap) => {
      if (docSnap.exists()) {
        // console.log(`useSessionData: Received session data for ${sessionId}:`, docSnap.data());
        const data = docSnap.data() as Omit<SessionData, 'createdAt' | 'updatedAt'> & { createdAt?: Timestamp | Date, updatedAt?: Timestamp | Date };
        
        let createdAtTimestamp: Timestamp | undefined = undefined;
        if (data.createdAt instanceof Timestamp) {
          createdAtTimestamp = data.createdAt;
        } else if (data.createdAt instanceof Date) {
          createdAtTimestamp = Timestamp.fromDate(data.createdAt);
        } else if (data.createdAt && typeof (data.createdAt as any).seconds === 'number') {
           createdAtTimestamp = new Timestamp((data.createdAt as any).seconds, (data.createdAt as any).nanoseconds);
        }

        let updatedAtTimestamp: Timestamp | undefined = undefined;
        if (data.updatedAt instanceof Timestamp) {
          updatedAtTimestamp = data.updatedAt;
        } else if (data.updatedAt instanceof Date) {
          updatedAtTimestamp = Timestamp.fromDate(data.updatedAt);
        } else if (data.updatedAt && typeof (data.updatedAt as any).seconds === 'number') {
           updatedAtTimestamp = new Timestamp((data.updatedAt as any).seconds, (data.updatedAt as any).nanoseconds);
        }
        
        setSessionData({
            ...data,
            createdAt: createdAtTimestamp || Timestamp.now(), // Fallback if undefined
            updatedAt: updatedAtTimestamp
        } as SessionData);
        setError(null);
      } else {
        // console.warn(`useSessionData: Session document ${sessionId} does not exist.`);
        setSessionData(null);
        setError("Sitzungsdokument nicht gefunden.");
      }
      setIsLoading(false);
    }, (err) => {
      console.error(`useSessionData: Error fetching session data for ${sessionId}:`, err);
      setError("Fehler beim Laden der Sitzungsdaten: " + err.message);
      setSessionData(null);
      setIsLoading(false);
    });

    return () => {
      // console.log(`useSessionData: Cleaning up Firestore listener for session: ${sessionId}`);
      unsubscribe();
    };
  }, [sessionId]);

  return { sessionData, isLoading, error };
}
