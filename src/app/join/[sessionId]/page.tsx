
"use client";

import { useState, useEffect, type FormEvent, useMemo, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Scenario, SessionData, Participant, HumanRoleConfig } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, LogIn, AlertTriangle, Loader2, UserCheck, Info, Users2, CheckCircle, Clock, UserPlus, Check, Edit3, Lock, Unlock, Eye } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, serverTimestamp, query, where, getDocs, Timestamp, onSnapshot, updateDoc, runTransaction, setDoc, writeBatch, addDoc } from "firebase/firestore";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle as ShadcnAlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useSessionData } from "@/hooks/use-session-data";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle as ShadcnDialogTitle, // Renamed to avoid conflict
  DialogDescription as ShadcnDialogDescription, // Renamed to avoid conflict
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
  AlertDialogTitle,
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
  return `server-user-${Date.now()}`; // Fallback for SSR or non-browser env
};


export default function JoinSessionPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();

  const sessionId = params.sessionId as string;
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const urlToken = searchParams?.get("token");

  const [joinStep, setJoinStep] = useState<JoinStep>("nameInput");

  const [realName, setRealName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>("");
  
  const [currentScenario, setCurrentScenario] = useState<Scenario | null>(null);
  const { sessionData, isLoading: isLoadingSessionHook, error: sessionErrorHook } = useSessionData(sessionId);

  const [sessionParticipants, setSessionParticipants] = useState<Participant[]>([]);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(true);
  const [isLoadingScenario, setIsLoadingScenario] = useState(true);
  const [currentParticipantDoc, setCurrentParticipantDoc] = useState<Participant | null>(null);


  const [isSubmittingName, setIsSubmittingName] = useState(false);
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);
  
  const [showAdminMovedDialog, setShowAdminMovedDialog] = useState(false);
  const [adminMovedToRoleName, setAdminMovedToRoleName] = useState<string | null>(null);
  const previousRoleIdRef = useRef<string | null>(null);


  useEffect(() => {
    const localId = generateLocalUserId();
    setUserId(localId);

    const storedRealName = localStorage.getItem(`chatUser_${sessionId}_${localId}_realName`);
    const storedDisplayName = localStorage.getItem(`chatUser_${sessionId}_${localId}_displayName`);
    const storedRoleId = localStorage.getItem(`chatUser_${sessionId}_${localId}_roleId`);
    
    if (storedRealName) setRealName(storedRealName);
    if (storedDisplayName) setDisplayName(storedDisplayName);
    // selectedRoleId will be set from Firestore participant doc later if user already joined
  }, [sessionId]);


  useEffect(() => {
    if (sessionErrorHook) {
      setAccessError(sessionErrorHook);
      console.error("JoinPage: SessionData error from hook:", sessionErrorHook);
    }
  }, [sessionErrorHook]);

  // Load Current Scenario
  useEffect(() => {
    if (!sessionData?.scenarioId) {
      if (!isLoadingSessionHook && !sessionErrorHook && !sessionData?.scenarioId) {
        // Only set access error if session data is loaded but no scenarioId
        setAccessError(prev => prev || "Keine Szenario-ID in Sitzungsdaten gefunden. Sitzung möglicherweise fehlerhaft.");
      }
      setCurrentScenario(null);
      setIsLoadingScenario(false);
      return;
    }
    setIsLoadingScenario(true);
    const scenarioDocRef = doc(db, "scenarios", sessionData.scenarioId);
    getDoc(scenarioDocRef)
      .then(scenarioSnap => {
        if (!scenarioSnap.exists()) {
          setAccessError("Szenario-Details für diese Sitzung nicht gefunden.");
          setCurrentScenario(null);
        } else {
          setCurrentScenario({ id: scenarioSnap.id, ...scenarioSnap.data() } as Scenario);
           if (accessError === "Szenario-Details für diese Sitzung nicht gefunden." || accessError?.includes("Keine Szenario-ID")) {
            setAccessError(null); 
          }
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
  }, [sessionId, sessionData, accessError, isLoadingSessionHook, sessionErrorHook]);


  // Session Status and Token Validation / Step Management
  useEffect(() => {
    if (isLoadingSessionHook || isLoadingScenario) return; // Wait for critical data

    if (!sessionData || !currentScenario) {
      if (!accessError) { // if no specific error yet, set a generic one
        setAccessError("Sitzungs- oder Szenariodaten konnten nicht vollständig geladen werden.");
      }
      return;
    }

    if (!urlToken || sessionData.invitationToken !== urlToken) {
      setAccessError("Ungültiger oder abgelaufener Einladungslink.");
      return;
    }
     if (accessError && accessError.includes("Einladungslink")) {
        setAccessError(null); // Clear token error if it was set before sessionData loaded
    }


    const localRealName = localStorage.getItem(`chatUser_${sessionId}_${userId}_realName`);
    const localDisplayName = localStorage.getItem(`chatUser_${sessionId}_${userId}_displayName`);
    const localRoleId = localStorage.getItem(`chatUser_${sessionId}_${userId}_roleId`);

    if (sessionData.status === "pending") {
      setAccessError("Der Administrator bereitet die Sitzung vor. Bitte warte einen Moment.");
      setJoinStep("nameInput"); // Force back to name input if session is pending
    } else if (sessionData.status === "active") {
      if (localRealName && localDisplayName && localRoleId && currentParticipantDoc) { // Ensure participant doc exists
        router.push(`/chat/${sessionId}`);
        return;
      }
      // If trying to join an active session without prior localStorage data or participant doc, block.
      setAccessError("Diese Simulation läuft bereits. Ein späterer Beitritt ist für neue Teilnehmer nicht möglich.");
      setJoinStep("nameInput"); 
    } else if (sessionData.status === "ended") {
      setAccessError("Diese Sitzung wurde bereits beendet.");
       setJoinStep("nameInput"); 
    } else if (sessionData.status === "paused") {
      setAccessError("Diese Sitzung ist aktuell pausiert. Ein Beitritt ist momentan nicht möglich.");
       setJoinStep("nameInput"); 
    } else if (sessionData.status === "open") {
      if (accessError && (accessError.includes("Vorbereitung") || accessError.includes("pausiert") || accessError.includes("beendet") || accessError.includes("läuft bereits"))) {
        setAccessError(null); // Clear previous status errors if now open
      }
      // Proceed to nameInput or roleSelection based on localStorage
      if (localRealName && localDisplayName) {
        if (joinStep !== "waitingRoom") { // Don't regress from waiting room
          setJoinStep("roleSelection");
        }
      } else {
        setJoinStep("nameInput");
      }
    }
  }, [sessionId, sessionData, urlToken, userId, currentScenario, isLoadingSessionHook, isLoadingScenario, router, accessError, joinStep, currentParticipantDoc]);


  // Listener for current session participants (for role selection display)
  useEffect(() => {
    if (!sessionId || !currentScenario || (joinStep !== 'roleSelection') || accessError) {
      setIsLoadingParticipants(false);
      // Do not clear sessionParticipants here if joinStep changes, let it persist for brief moments
      return;
    }

    setIsLoadingParticipants(true);
    const participantsColRef = collection(db, "sessions", sessionId, "participants");
    const q = query(participantsColRef, where("isBot", "==", false)); 

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedParticipants: Participant[] = [];
      snapshot.forEach(docSn => fetchedParticipants.push({ id: docSn.id, ...docSn.data() } as Participant));
      setSessionParticipants(fetchedParticipants);
      setIsLoadingParticipants(false);
    }, (error) => {
      console.error("JoinPage: Error fetching session participants:", error);
      toast({ variant: "destructive", title: "Fehler", description: "Teilnehmerdaten für Rollenauswahl konnten nicht geladen werden." });
      setIsLoadingParticipants(false);
    });
    return () => unsubscribe();
  }, [sessionId, toast, joinStep, currentScenario, accessError]);


  // Listener for own participant document
  useEffect(() => {
    if (!sessionId || !userId || accessError) {
      setCurrentParticipantDoc(null); // Clear if no session/user or access error
      return;
    }

    const participantDocRef = doc(db, "sessions", sessionId, "participants", userId);
    const unsubscribe = onSnapshot(participantDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const participantData = docSnap.data() as Participant;
        setCurrentParticipantDoc(participantData);
        const currentRoleIdInDb = participantData.roleId || null;

        // Auto-select role if it's already set in Firestore (e.g., on page refresh)
        if (selectedRoleId === null && currentRoleIdInDb && joinStep === 'roleSelection') {
          setSelectedRoleId(currentRoleIdInDb);
        }
        
        // Detect admin move
        if (previousRoleIdRef.current !== null && 
            currentRoleIdInDb !== null && 
            previousRoleIdRef.current !== currentRoleIdInDb && 
            currentRoleIdInDb !== selectedRoleId // Ensure it's not the user's own selection change
        ) {
           const newRole = currentScenario?.humanRolesConfig?.find(r => r.id === currentRoleIdInDb);
           if (newRole) {
             setAdminMovedToRoleName(newRole.name);
             setShowAdminMovedDialog(true);
             setSelectedRoleId(currentRoleIdInDb); // Reflect the admin's change
             localStorage.setItem(`chatUser_${sessionId}_${userId}_roleId`, newRole.id);
             localStorage.setItem(`chatUser_${sessionId}_${userId}_roleName`, newRole.name);
           }
        }
        previousRoleIdRef.current = currentRoleIdInDb;

      } else {
        setCurrentParticipantDoc(null);
        // If user is supposed to be in roleSelection but doc is gone, maybe revert to nameInput
        if (joinStep === 'roleSelection' && realName && displayName) {
           console.warn("Participant document not found, but name exists. User might need to re-confirm name/role.");
           // Potentially setJoinStep("nameInput"); if this state is problematic
        }
      }
    }, (error) => {
      console.error("JoinPage: Error listening to own participant data:", error);
      toast({ variant: "destructive", title: "Verbindungsfehler", description: "Eigene Teilnehmerdaten konnten nicht synchronisiert werden."});
      setCurrentParticipantDoc(null);
    });
    return () => unsubscribe();
  }, [sessionId, userId, accessError, currentScenario, joinStep, selectedRoleId, realName, displayName, toast]);


  // Effect for countdown and redirection from waiting room
 useEffect(() => {
    if (joinStep !== "waitingRoom" || !sessionData?.simulationStartCountdownEndTime || accessError) {
      setCountdownSeconds(null);
      return;
    }
    const countdownTargetTime = (sessionData.simulationStartCountdownEndTime as Timestamp).toMillis();
    
    const updateCountdown = () => {
        const now = Date.now();
        const remainingMillis = countdownTargetTime - now;
        if (remainingMillis <= 0) {
          setCountdownSeconds(0);
          // Redirection will be handled by the status listener if status changes to "active"
          // Or, if countdown ends but status isn't active yet, it means admin cancelled/paused.
          // We might need a more robust check here or rely on sessionData.status listener.
        } else {
          setCountdownSeconds(Math.ceil(remainingMillis / 1000));
        }
    };
    
    updateCountdown(); // Initial call
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [joinStep, sessionData?.simulationStartCountdownEndTime, accessError]);

   // Effect to listen for session status change to "active" to trigger redirect from roleSelection or waitingRoom
  useEffect(() => {
    if (userId && sessionId && sessionData && !accessError) {
      if (sessionData.status === "active") {
        // If user is in role selection or waiting room and session becomes active, redirect to chat
        if (joinStep === "roleSelection" || joinStep === "waitingRoom") {
            const storedRealName = localStorage.getItem(`chatUser_${sessionId}_${userId}_realName`);
            const storedDisplayName = localStorage.getItem(`chatUser_${sessionId}_${userId}_displayName`);
            const storedRoleId = localStorage.getItem(`chatUser_${sessionId}_${userId}_roleId`);

            if (storedRealName && storedDisplayName && storedRoleId && currentParticipantDoc) { // Check currentParticipantDoc too
                toast({title: "Simulation gestartet!", description: "Du wirst zum Chat weitergeleitet."});
                router.push(`/chat/${sessionId}`);
            } else {
                console.error("JoinPage: Missing user details in localStorage/participantDoc before redirecting to chat.");
                setAccessError("Fehler: Benutzerdetails nicht vollständig. Bitte versuche, Namen erneut einzugeben.");
                setJoinStep("nameInput"); 
            }
        }
      } else if (sessionData.status === "open" && joinStep === "waitingRoom" && !sessionData.simulationStartCountdownEndTime) {
        // Admin might have cancelled the countdown or reset the session to "open" while user was in waiting room
        setJoinStep("roleSelection");
        toast({ title: "Sitzungsstart aktualisiert", description: "Du kannst deine Rolle erneut wählen oder warten."});
      }
    }
  }, [joinStep, sessionId, sessionData, router, toast, userId, accessError, currentParticipantDoc]);


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
    // Avatar will be set based on displayName when role is selected or on re-entry
    
    try {
      const participantRef = doc(db, "sessions", sessionId, "participants", userId);
      const participantData: Partial<Participant> = { // Use Partial for update
        userId: userId,
        realName: realName.trim(),
        displayName: displayName.trim(),
        // Preserve existing role if any, or set defaults if creating
        role: currentParticipantDoc?.role || "", 
        roleId: currentParticipantDoc?.roleId || "",
        avatarFallback: (displayName.trim().substring(0,1) + (realName.trim().substring(0,1) || displayName.trim().substring(1,2) || 'U')).toUpperCase(),
        isBot: false,
        status: "Wählt Rolle", // Status after name submission
      };

      const docSnap = await getDoc(participantRef);
      if (!docSnap.exists()) {
        (participantData as Participant).joinedAt = serverTimestamp() as Timestamp;
      } else {
        participantData.updatedAt = serverTimestamp() as Timestamp;
      }
      
      await setDoc(participantRef, participantData, { merge: true });
      
      setJoinStep("roleSelection");
      // toast({ title: "Namen bestätigt", description: "Wähle nun deine Rolle."});
    } catch (error: any) {
      console.error("JoinPage: Error saving/updating participant name details:", error);
      toast({variant: "destructive", title: "Speicherfehler", description: `Namen konnten nicht gespeichert werden: ${error.message}`});
    } finally {
      setIsSubmittingName(false);
    }
  };

  const handleDisplayNameChangeInRoleSelection = async (newDisplayName: string) => {
    setDisplayName(newDisplayName); // Update local state immediately for responsiveness
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
            // Optionally show a small error toast or rely on eventual consistency
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

    // Check if role selection is locked by admin AND user is trying to change from an existing role
    if (sessionData?.roleSelectionLocked && currentParticipantDoc?.roleId && currentParticipantDoc.roleId !== newRoleId) {
        toast({ variant: "default", title: "Rollenauswahl gesperrt", description: "Die Rollenauswahl wurde vom Administrator gesperrt.", className: "bg-yellow-500/10 border-yellow-500"});
        return;
    }
    
    setIsUpdatingRole(true);
    setSelectedRoleId(newRoleId); // Optimistic UI update for selection highlight

    try {
      const participantRef = doc(db, "sessions", sessionId, "participants", userId);
      const currentAvatarFallback = localStorage.getItem(`chatUser_${sessionId}_${userId}_avatarFallback`) || (displayName.trim().substring(0,1) + (realName.trim().substring(0,1) || displayName.trim().substring(1,2) || 'U')).toUpperCase();

      const updateData: Partial<Participant> = {
        role: selectedRoleConfig.name,
        roleId: selectedRoleConfig.id,
        displayName: displayName.trim(), 
        avatarFallback: currentAvatarFallback,
        status: "Im Wartebereich", 
        updatedAt: serverTimestamp() as Timestamp
      };
      
      await updateDoc(participantRef, updateData);
      
      localStorage.setItem(`chatUser_${sessionId}_${userId}_roleId`, newRoleId);
      localStorage.setItem(`chatUser_${sessionId}_${userId}_roleName`, selectedRoleConfig.name);
      localStorage.setItem(`chatUser_${sessionId}_${userId}_avatarFallback`, currentAvatarFallback);
      
      previousRoleIdRef.current = newRoleId; 
      
      // If admin has already started the countdown, user directly goes to waiting room with countdown
      if (sessionData?.simulationStartCountdownEndTime) {
        setJoinStep("waitingRoom");
      } else {
        // Otherwise, user stays in roleSelection view, which now acts as the "waiting for admin start" area.
        // toast({ title: "Rolle ausgewählt", description: `Du hast die Rolle "${selectedRoleConfig.name}" gewählt. Warte auf Simulationsstart durch den Admin.` });
      }

    } catch (error: any) {
      console.error("JoinPage: Error updating participant role:", error);
      toast({variant: "destructive", title: "Fehler", description: `Rolle konnte nicht aktualisiert werden: ${error.message}`});
      setSelectedRoleId(currentParticipantDoc?.roleId || null); // Revert optimistic UI on error
    } finally {
      setIsUpdatingRole(false);
    }
  };

  const isLoadingInitialData = isLoadingSessionHook || isLoadingScenario;
  
  if (isLoadingInitialData && !accessError) { 
    return <LoadingScreen text={isLoadingSessionHook ? "Sitzungsdaten werden geladen..." : "Szenario-Details werden geladen..."} />;
  }
  
  if (accessError) {
    const isInformationalError = accessError.includes("Vorbereitung") || accessError.includes("Warte") || accessError.includes("pausiert") || accessError.includes("beendet") || accessError.includes("läuft bereits");
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
                {/* <Info className={cn("h-4 w-4", isInformationalError ? "" : "text-destructive")} /> */}
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

  if (!currentScenario || !sessionData) { // Should be caught by isLoadingInitialData or accessError, but as a fallback
      return <LoadingScreen text="Wichtige Daten fehlen..." />;
  }


  // Render logic based on joinStep
  if (joinStep === "nameInput") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <Link href="/" className="absolute top-4 left-4 sm:top-8 sm:left-8" aria-label="Zur Startseite">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-6 w-6" /></Button>
        </Link>
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl text-primary">Simulation beitreten: {currentScenario?.title || "..."}</CardTitle>
            <CardDescription>Schritt 1: Gib deine Namen ein, um fortzufahren.</CardDescription>
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
              <Button type="submit" className="w-full" disabled={isSubmittingName || !realName.trim() || !displayName.trim() || isLoadingInitialData}>
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
                  Wähle deine Rolle. Dein Nickname ist <span className="font-semibold text-foreground">{displayName}</span>.
                  {sessionData?.roleSelectionLocked && <Badge variant="destructive" className="ml-2"><Lock className="mr-1.5 h-3 w-3"/> Auswahl gesperrt</Badge>}
                  {!sessionData?.roleSelectionLocked && <Badge variant="secondary" className="ml-2"><Unlock className="mr-1.5 h-3 w-3"/> Auswahl offen</Badge>}
                </CardDescription>
                 <div className="mt-3 max-w-sm mx-auto">
                    <Label htmlFor="displayNameChangeInRoleSelection" className="text-xs font-medium text-muted-foreground">Nickname im Chat:</Label>
                    <Input
                        id="displayNameChangeInRoleSelection"
                        type="text"
                        value={displayName}
                        onChange={(e) => handleDisplayNameChangeInRoleSelection(e.target.value)}
                        className="mt-1 h-9 text-sm text-center"
                        disabled={isUpdatingRole}
                        placeholder="Dein Nickname"
                    />
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {isLoadingParticipants && !sessionParticipants.length && <div className="text-sm text-muted-foreground flex items-center justify-center py-4"><Loader2 className="h-4 w-4 animate-spin mr-2"/> Lade aktuelle Rollenbelegungen...</div>}
                {!humanRoles || humanRoles.length === 0 && !isLoadingScenario && (
                    <p className="text-sm text-muted-foreground py-4 text-center">Für dieses Szenario sind keine menschlichen Rollen definiert.</p>
                )}
                <ScrollArea className="h-[calc(100vh-420px)] sm:h-[calc(100vh-380px)] min-h-[250px] pr-3 -mr-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                        {humanRoles.map((role) => {
                            const participantsInThisRole = sessionParticipants.filter(p => p.roleId === role.id && p.userId !== userId);
                            const isSelectedByCurrentUser = selectedRoleId === role.id;
                            const isEffectivelyLockedForSelection = sessionData?.roleSelectionLocked && selectedRoleId !== null && selectedRoleId !== role.id;

                            return (
                                <Card
                                    key={role.id} // Use role.id as key
                                    className={cn(
                                    "transition-all hover:shadow-lg flex flex-col justify-between min-h-[180px] sm:min-h-[200px]", 
                                    isSelectedByCurrentUser ? "ring-2 ring-primary shadow-primary/30" : "ring-1 ring-border",
                                    (isEffectivelyLockedForSelection)
                                    ? "opacity-70 cursor-not-allowed bg-muted/30"
                                    : "cursor-pointer hover:bg-muted/5 dark:hover:bg-muted/10"
                                    )}
                                    onClick={() => {
                                      if (!isEffectivelyLockedForSelection) {
                                          handleRoleSelection(role.id);
                                      } else if (sessionData?.roleSelectionLocked) {
                                          toast({ variant: "default", title: "Rollenauswahl gesperrt", description: "Die Rollenauswahl wurde vom Administrator gesperrt.", className: "bg-yellow-500/10 border-yellow-500"});
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
                                        <div className="min-h-[30px]"> 
                                        {isLoadingParticipants && !participantsInThisRole.length ? <div className="flex items-center text-xs"><Loader2 className="h-3 w-3 animate-spin mr-1.5"/>Lade Belegung...</div> :
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
                                        {isSelectedByCurrentUser && displayName.trim() && (
                                            <div className="mt-1 pt-1 border-t border-dashed">
                                                <Badge variant="default" className="text-xs bg-primary/20 text-primary-foreground border-primary/50 flex items-center gap-1">
                                                    <UserCheck className="h-3 w-3"/> Du: {displayName.trim()}
                                                </Badge>
                                            </div>
                                        )}
                                    </CardContent>
                                    {isSelectedByCurrentUser && (
                                    <CardFooter className="p-1.5 border-t bg-primary/5 dark:bg-primary/10">
                                        <p className="text-xs text-primary flex items-center w-full justify-center font-medium"><CheckCircle className="h-3.5 w-3.5 mr-1.5"/> Deine aktuelle Rolle</p>
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
                        Deine Rollenauswahl wird live gespeichert. Du bleibst auf dieser Seite, bis der Administrator die Simulation startet. Du kannst deinen Nicknamen oder deine Rolle (falls nicht vom Admin gesperrt) noch ändern.
                    </AlertDescription>
                </Alert>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (joinStep === "waitingRoom") {
    const selectedRoleConfig = currentScenario?.humanRolesConfig?.find(r => r.id === selectedRoleId);
    const roleNameForWaitingRoom = selectedRoleConfig?.name || currentParticipantDoc?.role || "Unbekannt";
    const roleDescForWaitingRoom = selectedRoleConfig?.description || "Keine Rollenbeschreibung verfügbar.";
    
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
                    <CardHeader className="p-0 pb-1"><ShadcnDialogTitle className="text-xs font-medium text-muted-foreground">Deine Rollenbeschreibung:</ShadcnDialogTitle></CardHeader>
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
                    <p className="flex items-center justify-center text-green-600 font-medium text-sm"><CheckCircle className="h-5 w-5 mr-2"/>Du wirst jetzt zum Chat weitergeleitet...</p>
                )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  // Fallback loading screen if no specific step matches or still loading initial critical data
  return <LoadingScreen text={ accessError ? "Fehler..." : (isLoadingInitialData ? "Sitzungsstatus wird geladen..." : "Szenario wird geladen...")} />;
}

    