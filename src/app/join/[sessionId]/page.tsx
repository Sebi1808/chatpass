
"use client";

import { useState, useEffect, type FormEvent, useMemo, useCallback } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Scenario, SessionData, Participant, HumanRoleConfig } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, LogIn, AlertTriangle, Loader2, UserCheck, Info, Users2, CheckCircle, Clock, UserPlus, Check, Edit3 } from "lucide-react"; // Added Check, Edit3
import Link from "next/link";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, serverTimestamp, query, where, getDocs, Timestamp, onSnapshot, updateDoc, runTransaction, setDoc } from "firebase/firestore"; // Added setDoc
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useSessionData } from "@/hooks/use-session-data";
import { createDefaultScenario } from '@/app/admin/scenario-editor/[scenarioId]/page';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";


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
  let localId = localStorage.getItem('localUserId');
  if (!localId) {
    localId = `user-${Math.random().toString(36).substring(2, 9)}-${Date.now()}`;
    localStorage.setItem('localUserId', localId);
  }
  return localId;
};


export default function JoinSessionPage() {
  const router = useRouter();
  const params = useParams();
  const searchParamsHook = useSearchParams();
  const { toast } = useToast();

  const sessionId = params.sessionId as string;
  const urlToken = searchParamsHook.get("token");

  const [joinStep, setJoinStep] = useState<JoinStep>("nameInput");

  const [realName, setRealName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>("");
  const [participantDocId, setParticipantDocId] = useState<string | null>(null);
  const [hasConfirmedName, setHasConfirmedName] = useState(false);

  const [currentScenario, setCurrentScenario] = useState<Scenario | null>(null);
  const { sessionData, isLoading: isLoadingSessionData, error: sessionError } = useSessionData(sessionId);

  const [sessionParticipants, setSessionParticipants] = useState<Participant[]>([]);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(true);

  const [isLoadingScenario, setIsLoadingScenario] = useState(true);

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
    setParticipantDocId(localId);

    const storedRealName = localStorage.getItem(`chatUser_${sessionId}_${localId}_realName`);
    const storedDisplayName = localStorage.getItem(`chatUser_${sessionId}_${localId}_displayName`);
    const storedRoleId = localStorage.getItem(`chatUser_${sessionId}_${localId}_roleId`);

    if (storedRealName) setRealName(storedRealName);
    if (storedDisplayName) setDisplayName(storedDisplayName);
    // selectedRoleId will be set by Firestore listener or user interaction
    
    if (storedRealName && storedDisplayName) {
      setHasConfirmedName(true);
      // No automatic step change here, will be driven by sessionData.status and other logic
    }
  }, [sessionId]);

  useEffect(() => {
    if (sessionError) {
      setAccessError(sessionError);
    }
  }, [sessionError]);

  useEffect(() => {
    if (!sessionData || !sessionData.scenarioId) {
      if (!isLoadingSessionData && !sessionData?.scenarioId && !sessionError) {
        setAccessError(prev => prev || "Sitzungsdaten nicht gefunden oder ungültige Szenario-Referenz.");
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
          const scenario = { id: scenarioSnap.id, ...scenarioSnap.data() } as Scenario;
          setCurrentScenario(scenario);
          if(accessError === "Szenario-Details für diese Sitzung nicht gefunden." || accessError?.includes("Szenario-Referenz")){
            setAccessError(null); // Clear previous specific error if scenario now found
          }
        }
      })
      .catch(error => {
        console.error("Error fetching scenario details:", error);
        setAccessError(`Szenariodetails konnten nicht geladen werden: ${error.message}`);
        setCurrentScenario(null);
      })
      .finally(() => {
        setIsLoadingScenario(false);
      });
  }, [sessionData, isLoadingSessionData, sessionError, sessionId, accessError]);


  useEffect(() => {
    if (isLoadingSessionData || isLoadingScenario || !sessionData || !currentScenario) {
      // Still loading core data or core data is missing, so don't determine step yet.
      // Access error will be handled by the main return block.
      return;
    }
  
    if (!urlToken || sessionData.invitationToken !== urlToken) {
      if (!accessError?.includes("Einladungslink")) {
        setAccessError("Ungültiger oder abgelaufener Einladungslink.");
      }
      return;
    }
    
    // If core data is loaded and link is valid, clear general access errors if they were set before
    if (accessError === "Ungültiger oder abgelaufener Einladungslink." || accessError === "Sitzungsdaten nicht gefunden oder ungültige Szenario-Referenz." || accessError === "Szenariodetails konnten nicht geladen werden.") {
        // Only clear if it's one of these, to not override more specific errors like "session ended"
        setAccessError(null);
    }

    if (sessionData.status === "pending") {
      setAccessError("Der Administrator bereitet die Sitzung vor. Bitte warte einen Moment.");
      setJoinStep("nameInput");
    } else if (sessionData.status === "active") {
      const localRoleIdForActiveSession = localStorage.getItem(`chatUser_${sessionId}_${userId}_roleId`);
      const localRealNameForActiveSession = localStorage.getItem(`chatUser_${sessionId}_${userId}_realName`);
      const localDisplayNameForActiveSession = localStorage.getItem(`chatUser_${sessionId}_${userId}_displayName`);
      if (localRealNameForActiveSession && localDisplayNameForActiveSession && localRoleIdForActiveSession) {
          router.push(`/chat/${sessionId}`);
          return;
      }
      setAccessError("Diese Simulation läuft bereits. Ein neuer Beitritt ist nicht möglich.");
      setJoinStep("nameInput");
    } else if (sessionData.status === "ended") {
      setAccessError("Diese Sitzung wurde bereits beendet.");
      setJoinStep("nameInput");
    } else if (sessionData.status === "paused") {
      setAccessError("Diese Sitzung ist aktuell pausiert. Ein Beitritt ist momentan nicht möglich.");
      setJoinStep("nameInput");
    } else if (sessionData.status === "open") {
      setAccessError(null); // Clear previous status errors if now open
      if (hasConfirmedName) {
        setJoinStep("roleSelection");
      } else {
        setJoinStep("nameInput");
      }
    }
  }, [sessionId, sessionData, urlToken, userId, currentScenario, hasConfirmedName, router, accessError, isLoadingSessionData, isLoadingScenario]);


  // Listener for sessionParticipants for role selection display
  useEffect(() => {
    if (!sessionId || (joinStep !== 'roleSelection' && joinStep !== 'waitingRoom')) {
      setIsLoadingParticipants(false);
      if (joinStep !== 'roleSelection' && joinStep !== 'waitingRoom') setSessionParticipants([]);
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
      console.error("Error fetching session participants:", error);
      toast({ variant: "destructive", title: "Fehler", description: "Teilnehmerdaten für Rollenauswahl konnten nicht geladen werden." });
      setIsLoadingParticipants(false);
      setSessionParticipants([]);
    });
    return () => unsubscribe();
  }, [sessionId, toast, joinStep]);
  
  // Listener for own participant document to detect admin moves and set initial selectedRoleId
  useEffect(() => {
    if (!sessionId || !userId || !hasConfirmedName) return; // Only listen if userId and name are confirmed

    const participantDocRef = doc(db, "sessions", sessionId, "participants", userId);
    const unsubscribe = onSnapshot(participantDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const participantData = docSnap.data() as Participant;
        const currentRoleIdInDb = participantData.roleId || null;

        // Set initial selectedRoleId if not already set by user interaction this session
        if (selectedRoleId === null && currentRoleIdInDb) {
          setSelectedRoleId(currentRoleIdInDb);
          localStorage.setItem(`chatUser_${sessionId}_${userId}_roleId`, currentRoleIdInDb);
          if (currentScenario?.humanRolesConfig) {
            const roleName = currentScenario.humanRolesConfig.find(r => r.id === currentRoleIdInDb)?.name;
            if (roleName) localStorage.setItem(`chatUser_${sessionId}_${userId}_roleName`, roleName);
          }
        }
        
        // Check if admin moved the user
        if (previousRoleIdRef.current !== null && previousRoleIdRef.current !== currentRoleIdInDb && participantData.roleId !== selectedRoleId) {
           // This condition means Firestore changed, and it wasn't due to local user selecting it
           const newRole = currentScenario?.humanRolesConfig?.find(r => r.id === currentRoleIdInDb);
           if (newRole) {
             setAdminMovedToRoleName(newRole.name);
             setShowAdminMovedDialog(true);
             setSelectedRoleId(currentRoleIdInDb); // Sync local state with Firestore
             localStorage.setItem(`chatUser_${sessionId}_${userId}_roleId`, currentRoleIdInDb);
             localStorage.setItem(`chatUser_${sessionId}_${userId}_roleName`, newRole.name);
           }
        }
        previousRoleIdRef.current = currentRoleIdInDb; // Update previous role ID for next comparison
      }
    });
    return () => unsubscribe();
  }, [sessionId, userId, hasConfirmedName, currentScenario, selectedRoleId]); // Added selectedRoleId


  // Effect for countdown and redirection from waiting room
 useEffect(() => {
    if (joinStep !== "waitingRoom" || !sessionData?.simulationStartCountdownEndTime) {
      setCountdownSeconds(null);
      return;
    }

    const countdownTargetTime = (sessionData.simulationStartCountdownEndTime as Timestamp).toMillis();

    const interval = setInterval(() => {
      const now = Date.now();
      const remainingMillis = countdownTargetTime - now;
      if (remainingMillis <= 0) {
        setCountdownSeconds(0);
        clearInterval(interval);
        // Redirection to chat is now handled by the status listener below
      } else {
        setCountdownSeconds(Math.ceil(remainingMillis / 1000));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [joinStep, sessionData?.simulationStartCountdownEndTime]);

   // Effect to listen for session status change to "active"
  useEffect(() => {
    if ((joinStep === "waitingRoom" || (joinStep === "roleSelection" && selectedRoleId)) && sessionId && sessionData) {
      if (sessionData.status === "active") {
        const storedRealName = localStorage.getItem(`chatUser_${sessionId}_${userId}_realName`);
        const storedDisplayName = localStorage.getItem(`chatUser_${sessionId}_${userId}_displayName`);
        const storedRoleId = localStorage.getItem(`chatUser_${sessionId}_${userId}_roleId`);

        if (storedRealName && storedDisplayName && storedRoleId) {
             toast({title: "Simulation gestartet!", description: "Du wirst zum Chat weitergeleitet."});
             router.push(`/chat/${sessionId}`);
        } else if (joinStep === "waitingRoom") {
             console.error("Missing user details in localStorage before redirecting to chat from waiting room.");
             setAccessError("Fehler: Benutzerdetails nicht vollständig. Bitte versuche, erneut beizutreten.");
             setJoinStep("nameInput"); // Force back to name input
        }
      } else if (sessionData.status === "open" && joinStep === "waitingRoom" && !sessionData.simulationStartCountdownEndTime) {
        // Admin might have reset the start, move back to role selection
        setJoinStep("roleSelection");
        toast({ title: "Sitzungsstart zurückgesetzt", description: "Du kannst deine Rolle erneut wählen."});
      } else if ((sessionData.status === "ended" || sessionData.status === "paused") && (joinStep === "waitingRoom" || joinStep === "roleSelection")) {
        setAccessError(`Die Sitzung wurde vom Administrator ${sessionData.status === "ended" ? "beendet" : "pausiert"}.`);
        setJoinStep("nameInput"); // Force back to name input
      }
    }
  }, [joinStep, sessionId, sessionData, router, toast, userId, selectedRoleId]);


  const handleNameSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!realName.trim() || !displayName.trim()) {
      toast({ variant: "destructive", title: "Fehler", description: "Bitte beide Namen eingeben." });
      return;
    }
    setIsSubmittingName(true);

    localStorage.setItem(`chatUser_${sessionId}_${userId}_realName`, realName.trim());
    localStorage.setItem(`chatUser_${sessionId}_${userId}_displayName`, displayName.trim());
    // Ensure userId is set if it wasn't (should be by useEffect, but as a fallback)
    if (!userId) {
        const newId = generateLocalUserId();
        setUserId(newId);
        setParticipantDocId(newId);
    }

    try {
      const participantRef = doc(db, "sessions", sessionId, "participants", userId); // Use userId as doc ID
      const participantData: Partial<Participant> = {
        userId: userId,
        realName: realName.trim(),
        displayName: displayName.trim(),
        isBot: false,
        status: "Beigetreten - Wählt Rolle",
        role: "", // Initial empty role
        roleId: "", // Initial empty roleId
        joinedAt: serverTimestamp() as Timestamp // Set joinedAt on initial name confirmation
      };
      
      // Use setDoc with merge:true to create or update participant
      await setDoc(participantRef, participantData, { merge: true });
      
      setHasConfirmedName(true);
      setJoinStep("roleSelection");
      toast({ title: "Namen bestätigt", description: "Wähle nun deine Rolle."});
    } catch (error: any) {
      console.error("Error saving/updating participant name details:", error);
      toast({variant: "destructive", title: "Speicherfehler", description: `Namen konnten nicht gespeichert werden: ${error.message}`});
    } finally {
      setIsSubmittingName(false);
    }
  };

  const handleDisplayNameChangeInRoleSelection = async (newDisplayName: string) => {
    setDisplayName(newDisplayName);
    if (userId && newDisplayName.trim() && hasConfirmedName) {
        localStorage.setItem(`chatUser_${sessionId}_${userId}_displayName`, newDisplayName.trim());
        try {
            const participantRef = doc(db, "sessions", sessionId, "participants", userId);
            await updateDoc(participantRef, { displayName: newDisplayName.trim(), updatedAt: serverTimestamp() });
        } catch (error) {
            console.warn("Could not update displayName in Firestore immediately:", error);
        }
    }
  };

  const handleRoleSelection = async (newRoleId: string) => {
    if (!currentScenario || !currentScenario.humanRolesConfig || !userId ) {
      toast({ variant: "destructive", title: "Fehler", description: "Notwendige Daten für Rollenauswahl fehlen." });
      return;
    }

    const ownParticipantDoc = sessionParticipants.find(p => p.userId === userId);

    if (sessionData?.roleSelectionLocked && ownParticipantDoc?.roleId && ownParticipantDoc.roleId !== newRoleId) {
        toast({ variant: "default", title: "Rollenauswahl gesperrt", description: "Die Rollenauswahl wurde vom Administrator gesperrt. Du kannst deine aktuelle Rolle nicht ändern.", className: "bg-yellow-500/10 border-yellow-500"});
        return;
    }
    
    const selectedRoleConfig = currentScenario.humanRolesConfig.find(r => r.id === newRoleId);
    if (!selectedRoleConfig) {
        toast({ variant: "destructive", title: "Fehler", description: "Ausgewählte Rolle nicht gefunden." });
        return;
    }

    setIsUpdatingRole(true);
    try {
      const participantRef = doc(db, "sessions", sessionId, "participants", userId);
      await updateDoc(participantRef, {
        role: selectedRoleConfig.name,
        roleId: selectedRoleConfig.id,
        updatedAt: serverTimestamp()
      });
      setSelectedRoleId(newRoleId);
      localStorage.setItem(`chatUser_${sessionId}_${userId}_roleId`, newRoleId);
      localStorage.setItem(`chatUser_${sessionId}_${userId}_roleName`, selectedRoleConfig.name);
      previousRoleIdRef.current = newRoleId; // Update ref to prevent self-triggered move dialog
      toast({ title: "Rolle ausgewählt", description: `Du hast die Rolle "${selectedRoleConfig.name}" gewählt.` });
    } catch (error: any) {
      console.error("Error updating participant role:", error);
      toast({variant: "destructive", title: "Fehler", description: `Rolle konnte nicht aktualisiert werden: ${error.message}`});
    } finally {
      setIsUpdatingRole(false);
    }
  };
  
  const isLoadingPage = isLoadingSessionData || isLoadingScenario;

  if (isLoadingPage && !accessError && joinStep === 'nameInput' && !hasConfirmedName) { // More specific loading condition
    return <LoadingScreen text="Sitzungs- und Szenariodaten werden geladen..." />;
  }
  
  if (accessError && (joinStep !== 'waitingRoom' || (joinStep === 'waitingRoom' && accessError !== "Sitzung ist aktuell pausiert. Ein Beitritt ist momentan nicht möglich." && accessError !== "Diese Sitzung wurde bereits beendet." && accessError !== "Diese Simulation läuft bereits. Ein neuer Beitritt ist nicht möglich." ))) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center">
              <AlertTriangle className="h-6 w-6 mr-2" /> Zugang nicht möglich
            </CardTitle>
          </CardHeader>
          <CardContent>
             <Alert variant={accessError.includes("Vorbereitung") ? "default" : "destructive"} className={accessError.includes("Vorbereitung") ? "bg-blue-500/10 border-blue-500" : ""}>
                <Info className={`h-4 w-4 ${accessError.includes("Vorbereitung") ? "" : "text-destructive"}`} />
                <AlertTitle>{accessError.includes("Vorbereitung") ? "Information" : "Fehler"}</AlertTitle>
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
              <Button type="submit" className="w-full" disabled={isSubmittingName || !realName.trim() || !displayName.trim() || isLoadingPage}>
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
     return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
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

        <Button onClick={() => {setHasConfirmedName(false); setJoinStep("nameInput");}} variant="ghost" className="absolute top-4 left-4 sm:top-8 sm:left-8" aria-label="Zurück zur Namenseingabe">
            <ArrowLeft className="h-5 w-5 mr-2" /> Namen ändern
        </Button>
        <Card className="w-full max-w-4xl"> {/* Increased max-width for role cards */}
          <CardHeader>
            <CardTitle className="text-2xl text-primary">Rollenauswahl: {currentScenario?.title}</CardTitle>
            <CardDescription>
              Wähle deine Rolle für die Simulation. Klicke auf eine Karte, um sie auszuwählen. Deine Auswahl wird live gespeichert.
              {sessionData?.roleSelectionLocked && <span className="font-semibold text-destructive block mt-1"> Die Rollenauswahl wurde vom Administrator gesperrt.</span>}
            </CardDescription>
             <div className="mt-3">
                <Label htmlFor="displayNameChangeInRoleSelection" className="text-sm font-medium">Dein Nickname (im Chat sichtbar):</Label>
                <Input
                    id="displayNameChangeInRoleSelection"
                    type="text"
                    value={displayName}
                    onChange={(e) => handleDisplayNameChangeInRoleSelection(e.target.value)}
                    className="mt-1 h-9 text-base"
                    disabled={isUpdatingRole}
                    placeholder="Nickname"
                />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingParticipants && <div className="text-sm text-muted-foreground flex items-center py-4"><Loader2 className="h-4 w-4 animate-spin mr-2"/> Lade aktuelle Rollenbelegungen...</div>}
            {!currentScenario?.humanRolesConfig || currentScenario.humanRolesConfig.length === 0 && !isLoadingScenario && (
                <p className="text-sm text-muted-foreground py-4 text-center">Für dieses Szenario sind keine menschlichen Rollen definiert.</p>
            )}
            <ScrollArea className="h-[calc(100vh-450px)] min-h-[250px] pr-3">
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(currentScenario?.humanRolesConfig || []).map((role) => {
                        const participantsInThisRole = sessionParticipants.filter(p => p.roleId === role.id);
                        const isSelectedByCurrentUser = selectedRoleId === role.id;
                        const isEffectivelyLockedForSelection = sessionData?.roleSelectionLocked &&
                                                                sessionParticipants.find(p => p.userId === userId)?.roleId !== role.id && // User has a role
                                                                !!sessionParticipants.find(p => p.userId === userId)?.roleId; // and it's not this one

                        return (
                            <Card
                                key={role.id}
                                className={cn(
                                "transition-all hover:shadow-lg flex flex-col justify-between min-h-[180px]", // Increased min-height
                                isSelectedByCurrentUser ? "ring-2 ring-primary shadow-primary/30" : "ring-1 ring-border",
                                (isEffectivelyLockedForSelection)
                                  ? "opacity-60 cursor-not-allowed bg-muted/30"
                                  : "cursor-pointer hover:bg-muted/10"
                                )}
                                onClick={() => {
                                  if (!isEffectivelyLockedForSelection) {
                                    handleRoleSelection(role.id);
                                  } else if (sessionData?.roleSelectionLocked) {
                                    toast({ variant: "default", title: "Rollenauswahl gesperrt", description: "Die Rollenauswahl wurde vom Administrator gesperrt.", className: "bg-yellow-500/10 border-yellow-500"});
                                  }
                                }}
                            >
                                <CardHeader className="pb-2 pt-3 flex-row justify-between items-start">
                                    <CardTitle className="text-base">{role.name}</CardTitle>
                                    <Dialog>
                                        <DialogTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={(e) => e.stopPropagation()}><Info className="h-4 w-4"/></Button>
                                        </DialogTrigger>
                                        <DialogContent className="sm:max-w-md">
                                            <DialogHeader>
                                            <DialogTitle>Rollenbeschreibung: {role.name}</DialogTitle>
                                            </DialogHeader>
                                            <ScrollArea className="max-h-[60vh] mt-2 pr-2">
                                                <pre className="whitespace-pre-wrap text-sm text-muted-foreground p-1">{role.description}</pre>
                                            </ScrollArea>
                                            <DialogClose asChild><Button type="button" variant="secondary" className="mt-3 w-full">Schließen</Button></DialogClose>
                                        </DialogContent>
                                    </Dialog>
                                </CardHeader>
                                <CardContent className="text-xs text-muted-foreground space-y-1 flex-grow pb-2">
                                    {isLoadingParticipants ? <div className="flex items-center text-xs"><Loader2 className="h-3 w-3 animate-spin mr-1.5"/>Lade...</div> :
                                        participantsInThisRole.length > 0 ? (
                                        <>
                                            <p className="font-medium text-foreground/80 mb-1 flex items-center text-xs"><Users2 className="h-3 w-3 mr-1.5"/>Belegt durch:</p>
                                            <div className="flex flex-wrap gap-1 max-h-12 overflow-y-auto">
                                                {participantsInThisRole.map(p => <Badge key={p.id} variant="secondary" className="text-xs">{p.displayName}</Badge>)}
                                            </div>
                                        </>
                                    ) : (
                                        <p className="text-xs italic text-green-600">Noch frei</p>
                                    )}
                                    {isSelectedByCurrentUser && displayName.trim() && (
                                        <div className="mt-1 pt-1 border-t border-dashed">
                                            <Badge variant="default" className="text-xs bg-primary/20 text-primary border-primary/50">Du: {displayName.trim()}</Badge>
                                        </div>
                                    )}
                                </CardContent>
                                {isSelectedByCurrentUser && (
                                  <CardFooter className="p-2 border-t bg-primary/10">
                                    <p className="text-xs text-primary flex items-center w-full justify-center"><CheckCircle className="h-3.5 w-3.5 mr-1.5"/> Deine aktuelle Rolle</p>
                                  </CardFooter>
                                )}
                            </Card>
                        );
                    })}
                </div>
            </ScrollArea>
            <Alert className="mt-4">
                <Info className="h-4 w-4" />
                <AlertTitle>Warte auf Simulationsstart</AlertTitle>
                <AlertDescription>
                    Deine Rollenauswahl wird live gespeichert. Du bleibst auf dieser Seite, bis der Administrator die Simulation startet. Du kannst deinen Nicknamen oder deine Rolle (falls nicht gesperrt) noch ändern.
                </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (joinStep === "waitingRoom") {
    const roleNameForWaitingRoom = currentScenario?.humanRolesConfig?.find(r => r.id === selectedRoleId)?.name || "Unbekannt";
    const roleDescForWaitingRoom = currentScenario?.humanRolesConfig?.find(r => r.id === selectedRoleId)?.description || "Keine Rollenbeschreibung verfügbar.";
    const totalCountdownDuration = sessionData?.simulationStartCountdownEndTime ? 
                                  (sessionData.simulationStartCountdownEndTime.toMillis() - (sessionData.updatedAt?.toMillis() || Date.now())) / 1000 
                                  : 10; // Fallback to 10s if updatedAt is missing

    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
                {countdownSeconds !== null && countdownSeconds > 0 ? (
                    <div className="relative h-32 w-32">
                        <svg className="transform -rotate-90" viewBox="0 0 120 120">
                            <circle cx="60" cy="60" r="54" fill="none" stroke="hsl(var(--border))" strokeWidth="10" />
                            <circle
                                cx="60"
                                cy="60"
                                r="54"
                                fill="none"
                                stroke="hsl(var(--primary))"
                                strokeWidth="10"
                                strokeDasharray={2 * Math.PI * 54}
                                strokeDashoffset={ (1 - (countdownSeconds / Math.max(totalCountdownDuration,1))) * 2 * Math.PI * 54 }
                                strokeLinecap="round"
                                className="transition-all duration-1000 ease-linear"
                            />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center text-4xl font-bold text-primary">
                            {countdownSeconds}
                        </div>
                    </div>
                ) : (
                    <CheckCircle className="h-28 w-28 text-green-500" />
                )}
            </div>
            <CardTitle className="text-2xl text-primary">
              Simulation startet: {currentScenario?.title || "Szenario"}
            </CardTitle>
            <CardDescription>
              Du nimmst teil als <span className="font-semibold">{displayName}</span> in der Rolle <span className="font-semibold">{roleNameForWaitingRoom}</span>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-center">
            {roleDescForWaitingRoom && (
                <Card className="mt-2 p-3 bg-muted/50 text-sm text-left max-h-48">
                    <CardHeader className="p-0 pb-1"><CardTitle className="text-xs font-medium">Deine Rollenbeschreibung:</CardTitle></CardHeader>
                    <CardContent className="p-0">
                        <ScrollArea className="max-h-[120px] text-xs pr-2">
                            <pre className="whitespace-pre-wrap">{roleDescForWaitingRoom}</pre>
                        </ScrollArea>
                    </CardContent>
                </Card>
            )}
            <div className="pt-3 text-muted-foreground">
                {countdownSeconds !== null && countdownSeconds > 0 ? (
                    <p className="flex items-center justify-center"><Loader2 className="h-5 w-5 mr-2 animate-spin"/>Der Chat beginnt in {countdownSeconds} Sekunden...</p>
                ) : (
                    <p className="flex items-center justify-center text-green-600"><CheckCircle className="h-5 w-5 mr-2"/>Du wirst jetzt zum Chat weitergeleitet...</p>
                )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  return <LoadingScreen text="Lade Beitritts-Status..." />;
}
    