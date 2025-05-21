"use client";

import { useState, useEffect, type FormEvent, useMemo, useCallback, useRef } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Scenario, SessionData, Participant, HumanRoleConfig } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, LogIn, AlertTriangle, Loader2, UserCheck, Info, Users2, CheckCircle, Clock, UserPlus, Edit3, Lock, Unlock, Eye, Check as CheckIcon } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, serverTimestamp, query, where, getDocs, Timestamp, onSnapshot, updateDoc, runTransaction, setDoc, writeBatch, addDoc } from "firebase/firestore";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle as ShadcnAlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useSessionData } from "@/hooks/use-session-data"; // Assuming this hook is correctly set up
import { createDefaultScenario } from '@/app/admin/scenario-editor/[scenarioId]/page';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle as ShadcnDialogTitle,
  DialogDescription as ShadcnDialogDescription,
  DialogTrigger,
  DialogClose
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle, // Ensure this is imported
} from "@/components/ui/alert-dialog";


type JoinStep = "nameInput" | "roleSelection" | "waitingRoom";

const LoadingScreen = ({ text = "Sitzung wird geladen..." }: { text?: string }) => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center"><Loader2 className="h-5 w-5 animate-spin mr-2 text-primary"/> {text}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Die Details zur Sitzung werden abgerufen. Bitte haben Sie einen Moment Geduld.</p>
        <Progress value={50} className="w-full mt-4 h-2" />
      </CardContent>
    </Card>
  </div>
);

const generateLocalUserId = (): string => {
  if (typeof window !== 'undefined') {
    let localId = localStorage.getItem('localUserId');
    if (!localId) {
      localId = `user-${Math.random().toString(36).substring(2, 9)}-${Date.now()}`;
      localStorage.setItem('localUserId', localId);
    }
    return localId;
  }
  return `server-user-${Date.now()}`;
};


export default function JoinSessionPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();

  const sessionId = params.sessionId as string;
  const searchParamsHook = useSearchParams(); // Hook needs to be called at top level
  const urlToken = searchParamsHook?.get("token");

  const [joinStep, setJoinStep] = useState<JoinStep>("nameInput");

  const [realName, setRealName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>("");
  
  const [currentScenario, setCurrentScenario] = useState<Scenario | null>(null);
  const { sessionData, isLoading: isLoadingSessionDataHook, error: sessionErrorHook } = useSessionData(sessionId);

  const [sessionParticipants, setSessionParticipants] = useState<Participant[]>([]);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(false); // Initial false
  const [isLoadingScenario, setIsLoadingScenario] = useState(true);
  const [currentParticipantDoc, setCurrentParticipantDoc] = useState<Participant | null>(null);
  const [isLoadingParticipantDoc, setIsLoadingParticipantDoc] = useState(true); // New loading state

  const [isSubmittingName, setIsSubmittingName] = useState(false);
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);
  
  const [showAdminMovedDialog, setShowAdminMovedDialog] = useState(false);
  const [adminMovedToRoleName, setAdminMovedToRoleName] = useState<string | null>(null);
  const previousRoleIdRef = useRef<string | null>(null);
  const previousSessionStatusRef = useRef<SessionData["status"] | null>(null);

  // Initialize userId and load names from localStorage
  useEffect(() => {
    const localId = generateLocalUserId();
    setUserId(localId);
    console.log("JoinPage: Generated/Retrieved userId:", localId);

    const storedRealName = localStorage.getItem(`chatUser_${sessionId}_${localId}_realName`);
    const storedDisplayName = localStorage.getItem(`chatUser_${sessionId}_${localId}_displayName`);
    
    if (storedRealName) setRealName(storedRealName);
    if (storedDisplayName) setDisplayName(storedDisplayName);
    // selectedRoleId will be set from Firestore participant doc or user interaction
  }, [sessionId]);

  // Effect to clear localStorage for the current session if the session is reset by the admin
  useEffect(() => {
    if (sessionData && userId && sessionId) {
      const currentStatus = sessionData.status;
      const previousStatus = previousSessionStatusRef.current;

      // Clear local storage if session transitions to 'pending'
      // or from an active/ended/paused state back to 'open' (indicating a reset for rejoin)
      const shouldClearStorage = 
        currentStatus === "pending" || 
        (currentStatus === "open" && 
          (previousStatus === "active" || previousStatus === "ended" || previousStatus === "paused"));

      if (shouldClearStorage) {
        console.log(`JoinPage: Session status changed to '${currentStatus}' (from '${previousStatus}'), clearing localStorage for sessionId ${sessionId} and userId ${userId} to force fresh join.`);
        localStorage.removeItem(`chatUser_${sessionId}_${userId}_realName`);
        localStorage.removeItem(`chatUser_${sessionId}_${userId}_displayName`);
        localStorage.removeItem(`chatUser_${sessionId}_${userId}_roleId`);
        localStorage.removeItem(`chatUser_${sessionId}_${userId}_roleName`);
        localStorage.removeItem(`chatUser_${sessionId}_${userId}_avatarFallback`);
        
        // Reset relevant local component states as well to reflect the cleared storage
        setRealName("");
        setDisplayName("");
        setSelectedRoleId(null);
        // This will naturally lead Effect 3 to set joinStep to 'nameInput'
      }
    }
    // Update the ref for the next render AFTER all other logic in this effect
    if (sessionData) {
      previousSessionStatusRef.current = sessionData.status;
    }
  }, [sessionData, userId, sessionId]);

  // Effect 1: Validate sessionData, token, and overall access
  useEffect(() => {
    console.log("JoinPage: Effect 1 - Validating sessionData and token. isLoadingSessionDataHook:", isLoadingSessionDataHook, "sessionData:", sessionData, "urlToken:", urlToken);
    if (isLoadingSessionDataHook) {
      return; // Wait for sessionData to load
    }

    if (sessionErrorHook) {
      setAccessError(sessionErrorHook);
      console.error("JoinPage: SessionData error from hook:", sessionErrorHook);
      return;
    }

    if (!sessionData) {
      setAccessError("Sitzungsdaten konnten nicht geladen werden. Ist der Link korrekt?");
      return;
    }

    console.log("JoinPage: Effect 1 - DETAILED CHECK: urlToken:", urlToken, "sessionData.invitationToken:", sessionData.invitationToken, "Comparison result (should be true for access):", sessionData.invitationToken === urlToken);

    // If session is 'pending', token MUST be present and match
    if (sessionData.status === "pending") {
      if (!urlToken || sessionData.invitationToken !== urlToken) {
        console.error("JoinPage: Effect 1 - TOKEN MISMATCH OR MISSING TOKEN for 'pending' session! urlToken:", urlToken, "sessionData.invitationToken:", sessionData.invitationToken);
        setAccessError("Ungültiger oder abgelaufener Einladungslink. Bitte fordern Sie einen neuen Link vom Administrator an.");
        return;
      }
    } else if (sessionData.status === "active" || sessionData.status === "open") {
      // For 'active' or 'open' sessions, allow joining if EITHER token matches OR if no urlToken is provided (direct access without token)
      // BUT, if a urlToken IS provided, it MUST match.
      if (urlToken && sessionData.invitationToken !== urlToken) {
        console.error("JoinPage: Effect 1 - TOKEN MISMATCH for 'active'/'open' session with provided token! urlToken:", urlToken, "sessionData.invitationToken:", sessionData.invitationToken);
        setAccessError("Der verwendete Einladungslink ist für diese Sitzung ungültig. Bitte aktuellen Link verwenden oder ohne Token beitreten, falls erlaubt.");
        return;
      }
      // If urlToken is null (direct access without token parameter in URL) and session is active/open, we allow access here.
      console.log("JoinPage: Effect 1 - Accessing active/open session. urlToken is:", urlToken);
    } else if (sessionData.status !== "ended" && sessionData.status !== "paused") {
      // For any other status that is not ended/paused, and a token is provided but doesn't match, or if no token is provided, deny access for safety.
      if (!urlToken || (urlToken && sessionData.invitationToken !== urlToken)) {
           console.error("JoinPage: Effect 1 - TOKEN MISMATCH OR MISSING TOKEN for session status '", sessionData.status, "'! urlToken:", urlToken, "sessionData.invitationToken:", sessionData.invitationToken);
           setAccessError("Ungültiger oder abgelaufener Einladungslink für diesen Sitzungsstatus.");
           return;
      }
    }
    
    // If token is valid OR not strictly required for this session state (and not explicitly denied above),
    // clear previous token/generic errors if they were related to token/loading issues that are now resolved.
    if (accessError && 
        (accessError.includes("Einladungslink") || 
         accessError.includes("Sitzungsdaten konnten nicht geladen werden") ||
         accessError.includes("Token konnte nicht überprüft werden") || // Example of another error to clear
         accessError.includes("Szenario-Details für diese Sitzung nicht gefunden") // Clear if scenario is now loaded
        )
       ) {
        // Check if scenario is actually loaded before clearing scenario-related error
        if (accessError.includes("Szenario-Details") && !currentScenario) {
            // Don't clear if scenario is still not loaded
        } else {
            setAccessError(null);
            console.log("JoinPage: Effect 1 - Cleared previous accessError as token is now valid or not strictly required for this state.");
        }
    }

  }, [sessionId, sessionData, urlToken, isLoadingSessionDataHook, sessionErrorHook, accessError, currentScenario]); // Added currentScenario to dependency array


  // Effect 2: Load scenario details (depends on valid sessionData)
  useEffect(() => {
    console.log("JoinPage: Effect 2 - Attempting to load scenario. accessError:", accessError, "sessionData:", sessionData);
    if (accessError || !sessionData || !sessionData.scenarioId) {
      if (!accessError && sessionData && !sessionData.scenarioId) {
          setAccessError("Keine Szenario-ID in den Sitzungsdaten gefunden. Sitzung möglicherweise fehlerhaft.");
      }
      setCurrentScenario(null);
      setIsLoadingScenario(false);
      return;
    }

    setIsLoadingScenario(true);
    const scenarioDocRef = doc(db, "scenarios", sessionData.scenarioId);
    console.log("JoinPage: Fetching scenario from Firestore:", sessionData.scenarioId);
    getDoc(scenarioDocRef)
      .then(scenarioSnap => {
        if (!scenarioSnap.exists()) {
          console.error("JoinPage: Scenario document not found in Firestore for ID:", sessionData.scenarioId);
          setAccessError("Szenario-Details für diese Sitzung nicht gefunden.");
          setCurrentScenario(null);
        } else {
          console.log("JoinPage: Scenario found:", scenarioSnap.data());
          setCurrentScenario({ id: scenarioSnap.id, ...scenarioSnap.data() } as Scenario);
          // Use functional update to ensure we are checking against the latest state of accessError
          setAccessError(currentErr => {
            if (currentErr && 
                (currentErr === "Szenario-Details für diese Sitzung nicht gefunden." || 
                 currentErr.includes("Keine Szenario-ID") ||
                 currentErr.includes("Wichtige Sitzungs- oder Szenariodaten fehlen") ||
                 currentErr.includes("Szenario-Daten für diese Sitzung konnten nicht final geladen werden"))) {
              console.log("JoinPage: Scenario loaded, clearing specific accessError (using functional update):", currentErr);
              return null; // Clear the error
            }
            return currentErr; // No change to error state
          });
        }
      })
      .catch(error => {
        console.error("JoinPage: Error fetching scenario details:", error);
        setAccessError(`Szenariodetails konnten nicht geladen werden: ${error.message}`);
        setCurrentScenario(null);
      })
      .finally(() => {
        setIsLoadingScenario(false);
      });
  }, [sessionData, accessError]); // Re-run if sessionData or accessError changes


  // Effect 3: Manage joinStep based on session status and user progress (depends on scenario loaded)
  useEffect(() => {
    console.log("JoinPage: Effect 3 - Managing joinStep. sessionData:", sessionData, "currentScenario:", currentScenario, "isLoadingScenario:", isLoadingScenario, "isLoadingParticipantDoc:", isLoadingParticipantDoc, "currentParticipantDoc:", currentParticipantDoc);

    if (isLoadingSessionDataHook || isLoadingScenario || isLoadingParticipantDoc || accessError) { // Added isLoadingParticipantDoc
      return;
    }

    if (!sessionData || !currentScenario) { // If still no sessionData or scenario after loading, something is wrong
      if (!accessError) setAccessError("Wichtige Sitzungs- oder Szenariodaten fehlen.");
      return;
    }
    
    const localRealName = localStorage.getItem(`chatUser_${sessionId}_${userId}_realName`);
    const localDisplayName = localStorage.getItem(`chatUser_${sessionId}_${userId}_displayName`);

    if (sessionData.status === "pending") {
      setAccessError("Der Administrator bereitet die Sitzung vor. Bitte warte einen Moment.");
      setJoinStep("nameInput");
    } else if (sessionData.status === "active" || sessionData.status === "open") {
        // Clear any previous "session not open/paused/ended" errors if we are now in open/active
        if (accessError && (accessError.includes("Vorbereitung") || accessError.includes("pausiert") || accessError.includes("beendet"))) {
            setAccessError(null);
        }
        
        if (localRealName && localDisplayName) {
            if (currentParticipantDoc?.roleId) {
                console.log("JoinPage: Effect 3 - User has names and Firestore roleId. Current joinStep:", joinStep, "Status:", sessionData.status);
                // User has a role. If session is active or already in waiting room, stay/go to waiting room.
                // If session is 'open' and role selection is NOT locked, they could technically change role, send to roleSelection.
                if (sessionData.status === "active" || joinStep === "waitingRoom") {
                    setJoinStep("waitingRoom");
                } else if (sessionData.status === "open" && !sessionData.roleSelectionLocked) {
                    setJoinStep("roleSelection");
                } else { // Open but locked, and has a role - effectively waiting room
                    setJoinStep("waitingRoom");
                }
            } else {
                // Names exist, but no roleId in Firestore (new to this session or role was cleared).
                // MUST go to role selection, even if locked, to get an initial role.
                console.log("JoinPage: Effect 3 - User has names BUT NO Firestore roleId. Forcing roleSelection. Locked:", sessionData.roleSelectionLocked);
                setJoinStep("roleSelection");
            }
        } else {
            console.log("JoinPage: Effect 3 - No names in localStorage. Setting joinStep to nameInput.");
            setJoinStep("nameInput");
        }
    } else if (sessionData.status === "ended") {
      setAccessError("Diese Sitzung wurde bereits beendet.");
      setJoinStep("nameInput");
    } else if (sessionData.status === "paused") {
      setAccessError("Diese Sitzung ist aktuell pausiert. Ein Beitritt ist momentan nicht möglich.");
      setJoinStep("nameInput");
    }
  }, [sessionId, sessionData, userId, currentScenario, isLoadingSessionDataHook, isLoadingScenario, router, accessError, currentParticipantDoc]);

  // Effect 4: Listener for current session participants (for role selection display)
  useEffect(() => {
    console.log("JoinPage: Effect 4 - Setting up participants listener. joinStep:", joinStep, "currentScenario:", currentScenario, "accessError:", accessError, "sessionData?.roleSelectionLocked:", sessionData?.roleSelectionLocked);
    if (joinStep !== "roleSelection" || !currentScenario || !currentScenario.humanRolesConfig || accessError || sessionData?.roleSelectionLocked) {
      // Only fetch all participants if user is in role selection, scenario loaded, no error, and role selection is NOT locked.
      // If role selection is locked, the list is not needed for selection purposes by this user.
      // If already in waitingRoom or nameInput, this list isn't directly needed by the join page itself.
      setIsLoadingParticipants(false);
      setSessionParticipants([]); // Clear participants if not in role selection or if prerequisites fail
      return;
    }

    setIsLoadingParticipants(true);
    const participantsColRef = collection(db, "sessions", sessionId, "participants");
    const q = query(participantsColRef, where("isBot", "==", false)); 

    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log("JoinPage: Participants snapshot received, count:", snapshot.size);
      const fetchedParticipants: Participant[] = [];
      snapshot.forEach(docSn => fetchedParticipants.push({ id: docSn.id, ...docSn.data() } as Participant));
      setSessionParticipants(fetchedParticipants);
      setIsLoadingParticipants(false);
    }, (error) => {
      console.error("JoinPage: Error fetching session participants:", error);
      toast({ variant: "destructive", title: "Fehler", description: "Teilnehmerdaten für Rollenauswahl konnten nicht geladen werden." });
      setIsLoadingParticipants(false);
    });
    return () => {
      console.log("JoinPage: Unsubscribing from participants listener.");
      unsubscribe();
    };
  }, [sessionId, toast, joinStep, currentScenario, accessError]);

  // Effect 5: Listen to own participant document (depends on userId)
  useEffect(() => {
    console.log("JoinPage: Effect 5 - Setting up own participant doc listener. userId:", userId, "accessError:", accessError);
    if (!userId || accessError ) { // If no userId or there's an access error, don't try to listen
      setCurrentParticipantDoc(null);
      setIsLoadingParticipantDoc(false); // Stop loading if prerequisites missing
      return;
    }

    setIsLoadingParticipantDoc(true); // Start loading
    const participantDocRef = doc(db, "sessions", sessionId, "participants", userId);

    const unsubscribe = onSnapshot(participantDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const participantData = { id: docSnap.id, ...docSnap.data() } as Participant;
        console.log("JoinPage: Own participant data updated:", participantData);
        setCurrentParticipantDoc(participantData);
        // Update local state if Firestore data is different (e.g., admin changed role)
        if (participantData.realName && realName !== participantData.realName) {
          setRealName(participantData.realName);
          localStorage.setItem(`chatUser_${sessionId}_${userId}_realName`, participantData.realName);
        }
        if (participantData.displayName && displayName !== participantData.displayName) {
          setDisplayName(participantData.displayName);
          localStorage.setItem(`chatUser_${sessionId}_${userId}_displayName`, participantData.displayName);
        }
        if (participantData.roleId && selectedRoleId !== participantData.roleId) {
          setSelectedRoleId(participantData.roleId);
          // Potentially show dialog if admin moved user
          if (previousRoleIdRef.current && previousRoleIdRef.current !== participantData.roleId && currentScenario?.humanRolesConfig) {
            const newRole = currentScenario.humanRolesConfig.find(r => r.id === participantData.roleId);
            if (newRole) {
              setAdminMovedToRoleName(newRole.name);
              setShowAdminMovedDialog(true);
            }
          }
        }
        previousRoleIdRef.current = participantData.roleId; // Update ref for next comparison

      } else {
        console.log("JoinPage: Own participant document does not exist.");
        setCurrentParticipantDoc(null);
        // Do not clear selectedRoleId here, as it might be set by user interaction before doc exists
      }
      setIsLoadingParticipantDoc(false); // Finished loading/update
    }, (error) => {
      console.error("JoinPage: Error fetching own participant document:", error);
      toast({ variant: "destructive", title: "Fehler", description: "Eigene Teilnehmerdaten konnten nicht geladen werden." });
      setCurrentParticipantDoc(null);
      setIsLoadingParticipantDoc(false); // Finished loading (with error)
    });

    return () => {
      console.log("JoinPage: Unsubscribing from own participant doc listener.");
      unsubscribe();
    };
  }, [userId, sessionId, accessError, toast, currentScenario, realName, displayName, selectedRoleId]); // Added dependencies

  // Effect 6: Countdown and redirection from waiting room
 useEffect(() => {
    console.log("JoinPage: Effect 6 - Managing countdown. joinStep:", joinStep, "simulationStartCountdownEndTime:", sessionData?.simulationStartCountdownEndTime, "accessError:", accessError);
    if (joinStep !== "waitingRoom" || !sessionData?.simulationStartCountdownEndTime || accessError) {
      setCountdownSeconds(null);
      return;
    }
    
    let targetTimeMillis: number;
    if (sessionData.simulationStartCountdownEndTime instanceof Timestamp) {
        targetTimeMillis = sessionData.simulationStartCountdownEndTime.toMillis();
    } else if (sessionData.simulationStartCountdownEndTime && typeof (sessionData.simulationStartCountdownEndTime as any).seconds === 'number') {
        // Handle plain object from Firestore if not auto-converted
        targetTimeMillis = (sessionData.simulationStartCountdownEndTime as any).seconds * 1000 + ((sessionData.simulationStartCountdownEndTime as any).nanoseconds || 0) / 1000000;
    } else {
        console.error("JoinPage: Invalid simulationStartCountdownEndTime format", sessionData.simulationStartCountdownEndTime);
        setCountdownSeconds(null);
        return;
    }
    
    const updateCountdown = () => {
        const now = Date.now();
        const remainingMillis = targetTimeMillis - now;
        if (remainingMillis <= 0) {
          setCountdownSeconds(0);
          // Redirection is now primarily handled by Effect 7 (status change listener)
        } else {
          setCountdownSeconds(Math.ceil(remainingMillis / 1000));
        }
    };
    
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [joinStep, sessionData?.simulationStartCountdownEndTime, accessError]);

   // Effect 7: Listen for session status change to "active" to trigger redirect from roleSelection or waitingRoom
  useEffect(() => {
    console.log("JoinPage: Effect 7 - Listening for session status active. sessionData.status:", sessionData?.status, "joinStep:", joinStep, "accessError:", accessError, "currentParticipantDoc?.roleId:", currentParticipantDoc?.roleId, "isLoadingParticipantDoc:", isLoadingParticipantDoc);
    
    if (isLoadingParticipantDoc) { // Wait for participant doc to be loaded/checked
        console.log("JoinPage: Effect 7 - Waiting for participant doc to load before evaluating redirect.");
        return;
    }

    if (userId && sessionId && sessionData && !accessError) {
      const storedRealName = localStorage.getItem(`chatUser_${sessionId}_${userId}_realName`);
      const storedDisplayName = localStorage.getItem(`chatUser_${sessionId}_${userId}_displayName`);

      // Condition for redirecting to chat - MODIFIED: RoleId IS NOW STRICTLY REQUIRED from currentParticipantDoc
      const canRedirectToChat = 
        storedRealName && 
        storedDisplayName &&
        currentParticipantDoc && // Ensure currentParticipantDoc is loaded
        currentParticipantDoc.roleId; // Ensure roleId is set in the Firestore document

      if (sessionData.status === "active") {
        if (canRedirectToChat) {
          if (joinStep === "roleSelection" || joinStep === "waitingRoom") {
            console.log("JoinPage: Effect 7 - Session active, ALL details present (names, Firestore roleId). Attempting redirect to chat.");
            toast({title: "Simulation gestartet!", description: "Du wirst zum Chat weitergeleitet."});
            router.push(`/chat/${sessionId}`);
          }
        } else {
          if (joinStep === "roleSelection" || joinStep === "waitingRoom") {
            console.log("JoinPage: Effect 7 - Session active, user in roleSelection/waitingRoom, but NOT ALL details for chat redirect available yet. Waiting. Details:", 
              { 
                storedRealName: !!storedRealName, 
                storedDisplayName: !!storedDisplayName, 
                currentParticipantDocExists: !!currentParticipantDoc,
                currentParticipantDocRoleId: currentParticipantDoc?.roleId 
              });
          }
        }
      } else if (sessionData.status === "open" && joinStep === "waitingRoom" && !sessionData.simulationStartCountdownEndTime && !isLoadingParticipantDoc && currentParticipantDoc?.roleId) {
        // If session is 'open', user is in waiting room, countdown is NOT active, and they HAVE a role, 
        // it might mean admin unlocked role selection or something similar. Send back to role selection.
        // This should ideally not happen if role selection is locked and they already have a role, but as a safeguard.
        if (!sessionData.roleSelectionLocked) {
            console.log("JoinPage: Effect 7 - Session 'open', in 'waitingRoom', no countdown, and role selection NOT locked. Moving to 'roleSelection'.");
            setJoinStep("roleSelection");
            // toast({ title: "Rollenauswahl aktualisiert", description: "Du kannst deine Rolle erneut wählen."});
        } else {
            console.log("JoinPage: Effect 7 - Session 'open', in 'waitingRoom', no countdown, but role selection IS locked. Staying in waiting room.");
        }
      }
    }
  }, [joinStep, sessionId, sessionData, router, toast, userId, accessError, currentParticipantDoc, isLoadingParticipantDoc]); // Ensure all dependencies are listed


  const handleNameSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!realName.trim() || !displayName.trim()) {
      toast({ variant: "destructive", title: "Fehler", description: "Bitte beide Namen eingeben." });
      return;
    }
    if (!userId) {
        toast({variant: "destructive", title: "Fehler", description: "Benutzer-ID nicht initialisiert. Bitte Seite neu laden."});
        return;
    }
    setIsSubmittingName(true);

    localStorage.setItem(`chatUser_${sessionId}_${userId}_realName`, realName.trim());
    localStorage.setItem(`chatUser_${sessionId}_${userId}_displayName`, displayName.trim());
    localStorage.setItem(`chatUser_${sessionId}_${userId}_avatarFallback`, (displayName.trim().substring(0,1) + (realName.trim().substring(0,1) || displayName.trim().substring(1,2) || 'U')).toUpperCase());
    
    try {
      const participantRef = doc(db, "sessions", sessionId, "participants", userId);
      const participantData: Omit<Participant, 'id'> = {
        userId: userId,
        realName: realName.trim(),
        displayName: displayName.trim(),
        role: currentParticipantDoc?.role || "", // Preserve existing role if any
        roleId: currentParticipantDoc?.roleId || "", // Preserve existing roleId
        avatarFallback: (displayName.trim().substring(0,1) + (realName.trim().substring(0,1) || displayName.trim().substring(1,2) || 'U')).toUpperCase(),
        isBot: false,
        status: "Nicht beigetreten",
        joinedAt: currentParticipantDoc?.joinedAt || (serverTimestamp() as Timestamp),
        updatedAt: serverTimestamp() as Timestamp
      };
      
      await setDoc(participantRef, participantData, { merge: true });
      setJoinStep("roleSelection");
    } catch (error: any) {
      console.error("JoinPage: Error saving/updating participant name details:", error);
      toast({variant: "destructive", title: "Speicherfehler", description: `Namen konnten nicht gespeichert werden: ${error.message}`});
    } finally {
      setIsSubmittingName(false);
    }
  };

  const handleDisplayNameChangeInRoleSelection = async (newDisplayName: string) => {
    setDisplayName(newDisplayName); // Update local state immediately
    if (userId && newDisplayName.trim() && joinStep === 'roleSelection') {
        localStorage.setItem(`chatUser_${sessionId}_${userId}_displayName`, newDisplayName.trim());
        try {
            const participantRef = doc(db, "sessions", sessionId, "participants", userId);
            const newAvatarFallback = (newDisplayName.trim().substring(0,1) + (realName.trim().substring(0,1) || newDisplayName.trim().substring(1,2) || 'U')).toUpperCase();
            localStorage.setItem(`chatUser_${sessionId}_${userId}_avatarFallback`, newAvatarFallback);
            
            await updateDoc(participantRef, { 
                displayName: newDisplayName.trim(), 
                avatarFallback: newAvatarFallback,
                updatedAt: serverTimestamp() 
            });
        } catch (error) {
            console.warn("JoinPage: Could not update displayName in Firestore immediately:", error);
        }
    }
  };


  const handleRoleSelection = async (newRoleId: string) => {
    if (!currentScenario || !currentScenario.humanRolesConfig || !userId || !displayName.trim()) {
      toast({ variant: "destructive", title: "Fehler", description: "Benutzername oder Szenariodaten fehlen für Rollenauswahl." });
      return;
    }
    
    const selectedRoleConfig = currentScenario.humanRolesConfig.find(r => r.id === newRoleId);
    if (!selectedRoleConfig) {
        toast({ variant: "destructive", title: "Fehler", description: "Ausgewählte Rolle nicht gefunden." });
        return;
    }

    // Allow role selection if: EITHER role selection is NOT locked OR if it IS locked BUT the user doesn't have a roleId yet for this session.
    const canSelectRole = !sessionData?.roleSelectionLocked || (sessionData?.roleSelectionLocked && !currentParticipantDoc?.roleId);

    if (!canSelectRole && currentParticipantDoc?.roleId && currentParticipantDoc.roleId !== newRoleId) {
        toast({ variant: "default", title: "Rollenauswahl gesperrt", description: "Die Rollenauswahl wurde vom Administrator gesperrt und du hast bereits eine Rolle.", className: "bg-yellow-500/10 border-yellow-500"});
        return;
    }
    
    setIsUpdatingRole(true);
    setSelectedRoleId(newRoleId); // Optimistic UI update

    console.log("JoinPage: handleRoleSelection - Attempting to set role. newRoleId:", newRoleId, "selectedRoleConfig:", selectedRoleConfig, "userId:", userId, "displayName:", displayName);

    try {
      const participantRef = doc(db, "sessions", sessionId, "participants", userId);
      const currentAvatarFallback = localStorage.getItem(`chatUser_${sessionId}_${userId}_avatarFallback`) || (displayName.trim().substring(0,1) + (realName.trim().substring(0,1) || displayName.trim().substring(1,2) || 'U')).toUpperCase();

      const updateData: Partial<Participant> = {
        role: selectedRoleConfig.name,
        roleId: selectedRoleConfig.id,
        displayName: displayName.trim(), 
        avatarFallback: currentAvatarFallback,
        status: "Beigetreten", 
        updatedAt: serverTimestamp() as Timestamp
      };
      
      await setDoc(participantRef, updateData, { merge: true });
      console.log("JoinPage: handleRoleSelection - Successfully set participantDoc in Firestore with data:", updateData);
      
      localStorage.setItem(`chatUser_${sessionId}_${userId}_roleId`, newRoleId);
      localStorage.setItem(`chatUser_${sessionId}_${userId}_roleName`, selectedRoleConfig.name);
      console.log("JoinPage: handleRoleSelection - Successfully set roleId in localStorage:", newRoleId);
      
      previousRoleIdRef.current = newRoleId; 
      
      // User stays in 'roleSelection' step until admin starts countdown.
      // If countdown already started, Effect 3 will move to 'waitingRoom'.
      toast({ title: "Rolle ausgewählt", description: `Du hast die Rolle "${selectedRoleConfig.name}" gewählt. Warte auf den Start.` });

    } catch (error: any) {
      console.error("JoinPage: Error updating participant role:", error);
      toast({variant: "destructive", title: "Fehler", description: `Rolle konnte nicht aktualisiert werden: ${error.message}`});
      setSelectedRoleId(currentParticipantDoc?.roleId || null); // Revert optimistic UI on error
    } finally {
      setIsUpdatingRole(false);
    }
  };

  const isLoadingPage = isLoadingSessionDataHook || isLoadingScenario || (joinStep === 'roleSelection' && isLoadingParticipants && sessionParticipants.length === 0); // Adjust isLoadingPage logic
  
  if (isLoadingPage && !accessError) { 
    let loadingText = "Sitzung wird geladen...";
    if(isLoadingSessionDataHook) loadingText = "Sitzungsdaten werden geprüft...";
    else if (isLoadingScenario && !currentScenario) loadingText = "Szenario-Details werden geladen...";
    else if (joinStep === 'roleSelection' && isLoadingParticipants) loadingText = "Rolleninformationen werden geladen...";
    return <LoadingScreen text={loadingText} />;
  }
  
  if (accessError) {
    const isInformationalError = accessError.includes("Vorbereitung") || accessError.includes("Warte") || accessError.includes("pausiert") || accessError.includes("beendet") || accessError.includes("läuft bereits") || accessError.includes("Token");
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className={cn("flex items-center", isInformationalError ? "text-blue-600" : "text-destructive")}>
              {isInformationalError ? <Info className="h-6 w-6 mr-2" /> : <AlertTriangle className="h-6 w-6 mr-2" />}
              {isInformationalError ? "Information" : "Zugangsproblem"}
            </CardTitle>
          </CardHeader>
          <CardContent>
             <Alert variant={isInformationalError ? "default" : "destructive"} className={isInformationalError ? "bg-blue-500/10 border-blue-500" : ""}>
                <ShadcnAlertTitle>{isInformationalError ? "Sitzungsstatus" : "Fehler"}</ShadcnAlertTitle>
                <AlertDescription>{accessError}</AlertDescription>
            </Alert>
            <Link href="/" passHref legacyBehavior>
              <Button variant="outline" className="w-full mt-6">
                <ArrowLeft className="mr-2 h-4 w-4" /> Zur Startseite
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!currentScenario || !sessionData) {
      return <LoadingScreen text="Wichtige Sitzungsdaten fehlen..." />;
  }

  if (joinStep === "nameInput") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <Link href="/" className="absolute top-4 left-4 sm:top-8 sm:left-8" aria-label="Zur Startseite">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-6 w-6" /></Button>
        </Link>
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl text-primary">Simulation beitreten: {currentScenario?.title || "..."}</CardTitle>
            <CardDescription>Schritt 1: Gib deine Namen ein.</CardDescription>
          </CardHeader>
          <form onSubmit={handleNameSubmit}>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="realName">Dein Klarname (für Admin sichtbar)</Label>
                <Input id="realName" type="text" placeholder="Max Mustermann" value={realName} onChange={(e) => setRealName(e.target.value)} required disabled={isSubmittingName} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="displayName">Dein Nickname (im Chat sichtbar)</Label>
                <Input id="displayName" type="text" placeholder="MaxPower99" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required disabled={isSubmittingName} />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={isSubmittingName || !realName.trim() || !displayName.trim() || isLoadingSessionDataHook || isLoadingScenario}>
                {isSubmittingName ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <UserPlus className="mr-2 h-5 w-5" />}
                Namen bestätigen & Rollen anzeigen
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    );
  }

  if (joinStep === "roleSelection") {
     const humanRoles = currentScenario?.humanRolesConfig || [];
     return (
      <div className="flex flex-col items-center min-h-screen bg-background p-4 pt-10 md:pt-16">
        <AlertDialog open={showAdminMovedDialog} onOpenChange={setShowAdminMovedDialog}>
            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle>Rolle geändert!</AlertDialogTitle>
                <AlertDialogDescription>
                    Der Administrator hat dich zur Rolle "{adminMovedToRoleName || 'einer neuen Rolle'}" verschoben.
                </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                <AlertDialogAction onClick={() => setShowAdminMovedDialog(false)}>OK</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <Button onClick={() => setJoinStep("nameInput")} variant="ghost" className="absolute top-4 left-4 sm:top-6 sm:left-6 text-sm" aria-label="Zurück zur Namenseingabe">
            <Edit3 className="h-4 w-4 mr-1.5" /> Namen/Nickname ändern
        </Button>
        <div className="w-full max-w-5xl">
          <Card className="w-full shadow-xl">
            <CardHeader className="text-center pb-4">
                <CardTitle className="text-2xl sm:text-3xl text-primary">Rollenauswahl für: {currentScenario?.title}</CardTitle>
                <CardDescription className="text-sm sm:text-base">
                  Wähle deine Rolle. Dein aktueller Nickname:
                  <Input
                      id="displayNameChangeInRoleSelection"
                      type="text"
                      value={displayName}
                      onChange={(e) => handleDisplayNameChangeInRoleSelection(e.target.value)}
                      className="mt-1 h-9 text-sm text-center inline-block w-auto mx-2 px-2 py-1 border rounded"
                      disabled={isUpdatingRole || sessionData?.roleSelectionLocked}
                      placeholder="Dein Nickname"
                  />
                  {sessionData?.roleSelectionLocked && <Badge variant="destructive" className="ml-2 text-xs"><Lock className="mr-1.5 h-3 w-3"/> Auswahl vom Admin gesperrt</Badge>}
                  {!sessionData?.roleSelectionLocked && <Badge variant="secondary" className="ml-2 text-xs"><Unlock className="mr-1.5 h-3 w-3"/> Auswahl offen</Badge>}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {isLoadingParticipants && <div className="text-sm text-muted-foreground flex items-center justify-center py-4"><Loader2 className="h-4 w-4 animate-spin mr-2"/> Lade Rollenbelegungen...</div>}
                {!humanRoles || humanRoles.length === 0 && !isLoadingScenario && (
                    <p className="text-sm text-muted-foreground py-4 text-center">Für dieses Szenario sind keine menschlichen Rollen definiert.</p>
                )}
                <ScrollArea className="h-[calc(100vh-450px)] sm:h-[calc(100vh-420px)] min-h-[250px] pr-3 -mr-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                        {humanRoles.map((role) => {
                            const participantsInThisRole = sessionParticipants.filter(p => p.roleId === role.id);
                            const isSelectedByCurrentUser = selectedRoleId === role.id;
                            const isDisabledForSelection = sessionData?.roleSelectionLocked && !!currentParticipantDoc?.roleId && currentParticipantDoc.roleId !== role.id;

                            return (
                                <Card
                                    key={role.id} 
                                    className={cn(
                                    "transition-all hover:shadow-lg flex flex-col justify-between min-h-[180px] sm:min-h-[200px]", 
                                    isSelectedByCurrentUser ? "ring-2 ring-primary shadow-primary/30" : "ring-1 ring-border",
                                    isDisabledForSelection
                                    ? "opacity-60 cursor-not-allowed bg-muted/30"
                                    : "cursor-pointer hover:bg-muted/5 dark:hover:bg-muted/10"
                                    )}
                                    onClick={() => {
                                      if (!isDisabledForSelection) {
                                          handleRoleSelection(role.id);
                                      } else {
                                          toast({ variant: "default", title: "Rollenauswahl gesperrt", description: "Die Rollenauswahl wurde vom Administrator gesperrt oder du hast bereits eine andere Rolle fixiert.", className: "bg-yellow-500/10 border-yellow-500"});
                                      }
                                    }}
                                >
                                    <CardHeader className="pb-1 pt-2.5 px-3 flex-row justify-between items-start">
                                        <CardTitle className="text-sm sm:text-base font-semibold">{role.name}</CardTitle>
                                        <Dialog>
                                            <DialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground hover:text-primary" onClick={(e) => e.stopPropagation()}><Info className="h-4 w-4"/></Button>
                                            </DialogTrigger>
                                            <DialogContent className="sm:max-w-md">
                                                <DialogHeader>
                                                <ShadcnDialogTitle>Rollenbeschreibung: {role.name}</ShadcnDialogTitle>
                                                </DialogHeader>
                                                <ScrollArea className="max-h-[60vh] mt-2 pr-2">
                                                    <pre className="whitespace-pre-wrap text-sm text-muted-foreground p-1">{role.description}</pre>
                                                </ScrollArea>
                                                <DialogClose asChild><Button type="button" variant="secondary" className="mt-3 w-full">Schließen</Button></DialogClose>
                                            </DialogContent>
                                        </Dialog>
                                    </CardHeader>
                                    <CardContent className="text-xs text-muted-foreground space-y-1 flex-grow px-3 pb-2">
                                        <div className="min-h-[40px]"> 
                                        {isLoadingParticipants ? <div className="flex items-center text-xs"><Loader2 className="h-3 w-3 animate-spin mr-1.5"/>Lade...</div> :
                                            participantsInThisRole.length > 0 ? (
                                            <>
                                                <p className="font-medium text-foreground/70 mb-0.5 text-xs flex items-center"><Users2 className="h-3 w-3 mr-1"/>Belegt durch:</p>
                                                <div className="flex flex-wrap gap-1 max-h-12 overflow-y-auto">
                                                    {participantsInThisRole.map(p => <Badge key={p.id} variant="secondary" className="text-xs font-normal">{p.displayName}</Badge>)}
                                                </div>
                                            </>
                                        ) : (
                                            <p className="text-xs italic text-green-600">Noch frei</p>
                                        )}
                                        </div>
                                        {isSelectedByCurrentUser && displayName.trim() && !participantsInThisRole.find(p=>p.userId === userId) && (
                                            <div className="mt-1 pt-1 border-t border-dashed">
                                                <Badge variant="default" className="text-xs bg-primary/20 text-primary-foreground border-primary/50 flex items-center gap-1">
                                                    <UserCheck className="h-3 w-3"/> Deine Auswahl: {displayName.trim()}
                                                </Badge>
                                            </div>
                                        )}
                                    </CardContent>
                                    {isSelectedByCurrentUser && (
                                    <CardFooter className="p-1.5 border-t bg-primary/5 dark:bg-primary/10">
                                        <p className="text-xs text-primary flex items-center w-full justify-center font-medium"><CheckIcon className="h-3.5 w-3.5 mr-1.5"/> Deine aktuelle Rolle</p>
                                    </CardFooter>
                                    )}
                                </Card>
                            );
                        })}
                    </div>
                </ScrollArea>
                 <Alert className="mt-4 border-primary/30 bg-primary/5">
                    <Eye className="h-4 w-4 text-primary/80" />
                    <ShadcnAlertTitle className="font-semibold text-primary/90">Warte auf Simulationsstart</ShadcnAlertTitle>
                    <AlertDescription className="text-sm text-primary/80">
                        Deine Rollenauswahl wird live gespeichert. Du bleibst auf dieser Seite, bis der Administrator die Simulation startet.
                    </AlertDescription>
                </Alert>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (joinStep === "waitingRoom") {
    const currentRoleForWaitingRoom = currentScenario?.humanRolesConfig?.find(r => r.id === currentParticipantDoc?.roleId);
    const roleNameForWaitingRoom = currentRoleForWaitingRoom?.name || currentParticipantDoc?.role || "Unbekannt";
    const roleDescForWaitingRoom = currentRoleForWaitingRoom?.description || "Keine Rollenbeschreibung verfügbar.";
    
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <Card className="w-full max-w-lg shadow-xl">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-3">
                {countdownSeconds !== null && countdownSeconds > 0 && sessionData?.simulationStartCountdownEndTime ? (
                    <div className="relative h-28 w-28 sm:h-32 sm:w-32">
                        <svg className="transform -rotate-90" viewBox="0 0 120 120">
                            <circle cx="60" cy="60" r="54" fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
                            <circle
                                cx="60"
                                cy="60"
                                r="54"
                                fill="none"
                                stroke="hsl(var(--primary))"
                                strokeWidth="8"
                                strokeDasharray={2 * Math.PI * 54}
                                strokeDashoffset={ (1 - (Math.max(0, countdownSeconds) / SIMULATION_START_COUNTDOWN_SECONDS_FOR_PARTICIPANTS)) * 2 * Math.PI * 54 }
                                strokeLinecap="round"
                                className="transition-all duration-1000 ease-linear"
                            />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center text-3xl sm:text-4xl font-bold text-primary">
                            {countdownSeconds}
                        </div>
                    </div>
                ) : (
                     <Clock className="h-24 w-24 sm:h-28 sm:w-28 text-primary/80 animate-pulse" />
                )}
            </div>
            <CardTitle className="text-xl sm:text-2xl text-primary">
              Simulation startet bald: {currentScenario?.title || "Szenario"}
            </CardTitle>
            <CardDescription className="text-sm sm:text-base">
              Du nimmst teil als <span className="font-semibold">{displayName || currentParticipantDoc?.displayName}</span> in der Rolle <span className="font-semibold text-foreground">{roleNameForWaitingRoom}</span>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-center">
            {roleDescForWaitingRoom && (
                <Card className="mt-1 p-3 bg-muted/30 text-sm text-left max-h-48">
                    <CardHeader className="p-0 pb-1">
                        <p className="text-xs font-medium text-muted-foreground">Deine Rollenbeschreibung:</p>
                    </CardHeader>
                    <CardContent className="p-0">
                        <ScrollArea className="max-h-[100px] sm:max-h-[120px] text-xs pr-2">
                            <pre className="whitespace-pre-wrap">{roleDescForWaitingRoom}</pre>
                        </ScrollArea>
                    </CardContent>
                </Card>
            )}
            <div className="pt-2 text-muted-foreground">
                {countdownSeconds !== null && countdownSeconds > 0 ? (
                    <p className="flex items-center justify-center text-sm"><Loader2 className="h-4 w-4 mr-2 animate-spin"/>Der Chat beginnt in {countdownSeconds} Sekunden...</p>
                ) : (
                     sessionData?.status === "active" ? 
                    <p className="flex items-center justify-center text-green-600 font-medium text-sm"><CheckCircle className="h-5 w-5 mr-2"/>Du wirst jetzt zum Chat weitergeleitet...</p>
                    :  <p className="flex items-center justify-center text-sm"><Loader2 className="h-4 w-4 mr-2 animate-spin"/>Warte auf Start durch Admin...</p>
                )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  return <LoadingScreen text="Seite wird initialisiert..." />;
}

const SIMULATION_START_COUNTDOWN_SECONDS_FOR_PARTICIPANTS = 10; // Should match admin dashboard
    
