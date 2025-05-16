
"use client";

import { useState, useEffect, type FormEvent, useMemo, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Scenario, SessionData, Participant, HumanRoleConfig } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, LogIn, AlertTriangle, Loader2, UserCheck, Info, Users2, CheckCircle, Clock, UserPlus, Check, Edit3, Lock, Unlock } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, serverTimestamp, query, where, getDocs, Timestamp, onSnapshot, updateDoc, runTransaction, setDoc, writeBatch } from "firebase/firestore";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useSessionData } from "@/hooks/use-session-data";
import { createDefaultScenario } from '@/app/admin/scenario-editor/[scenarioId]/page';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader } from "@/components/ui/alert-dialog";


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
  const { toast } = useToast();

  const sessionId = params.sessionId as string;
  const searchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const urlToken = searchParams.get("token");

  const [joinStep, setJoinStep] = useState<JoinStep>("nameInput");

  const [realName, setRealName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>("");
  const [participantDocId, setParticipantDocId] = useState<string | null>(null); // This might be redundant if userId is the docId
  
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
    setParticipantDocId(localId); // Assuming participant doc ID is the same as userId

    const storedRealName = localStorage.getItem(`chatUser_${sessionId}_${localId}_realName`);
    const storedDisplayName = localStorage.getItem(`chatUser_${sessionId}_${localId}_displayName`);
    
    if (storedRealName) setRealName(storedRealName);
    if (storedDisplayName) setDisplayName(storedDisplayName);

    if (storedRealName && storedDisplayName && joinStep === 'nameInput') {
      // If names are in localStorage, try to create/update participant doc immediately
      // and potentially move to role selection if session is open.
      // This logic is complex and needs to be tied to session status checks.
      // For now, we just prefill. The user still needs to click "continue".
    }
  }, [sessionId, joinStep]);


  useEffect(() => {
    if (sessionError) {
      setAccessError(sessionError);
    }
  }, [sessionError]);

  // Effect to load scenario details once sessionData (and thus scenarioId) is available
  useEffect(() => {
    if (!sessionData || !sessionData.scenarioId) {
      if (!isLoadingSessionData && !sessionError) {
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
          setAccessError(null); // Clear previous general errors if scenario is found
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
  }, [sessionData, isLoadingSessionData, sessionError]);


  // Effect to handle access logic based on session status and token
  useEffect(() => {
    if (isLoadingSessionData || isLoadingScenario) return; // Wait for core data

    if (!sessionData || !currentScenario) {
       // accessError should already be set by previous effects if data is missing
       if (!accessError) setAccessError("Sitzungs- oder Szenariodaten konnten nicht geladen werden.");
      return;
    }

    if (!urlToken || sessionData.invitationToken !== urlToken) {
      setAccessError("Ungültiger oder abgelaufener Einladungslink.");
      return;
    }
    
    // Clear general link/data errors if we reached here
    if (accessError === "Ungültiger oder abgelaufener Einladungslink." || accessError?.includes("Sitzungs- oder Szenariodaten")) {
        setAccessError(null);
    }

    // Handle redirection or state changes based on session status
    if (sessionData.status === "pending") {
      setAccessError("Der Administrator bereitet die Sitzung vor. Bitte warte einen Moment.");
      setJoinStep("nameInput"); // Stay on name input or show this message more prominently
    } else if (sessionData.status === "active") {
      // If session is active, try to redirect to chat if user has already joined (details in localStorage)
      const localRoleId = localStorage.getItem(`chatUser_${sessionId}_${userId}_roleId`);
      const localRealName = localStorage.getItem(`chatUser_${sessionId}_${userId}_realName`);
      const localDisplayName = localStorage.getItem(`chatUser_${sessionId}_${userId}_displayName`);
      if (localRealName && localDisplayName && localRoleId) {
        router.push(`/chat/${sessionId}`);
        return;
      }
      setAccessError("Diese Simulation läuft bereits. Ein späterer Beitritt ist für neue Teilnehmer nicht möglich.");
      // Consider if already joined participants should be redirected or allowed to re-select role if they fell out
    } else if (sessionData.status === "ended") {
      setAccessError("Diese Sitzung wurde bereits beendet.");
    } else if (sessionData.status === "paused") {
      setAccessError("Diese Sitzung ist aktuell pausiert. Ein Beitritt ist momentan nicht möglich.");
    } else if (sessionData.status === "open") {
      if (joinStep === 'nameInput' && localStorage.getItem(`chatUser_${sessionId}_${userId}_realName`) && localStorage.getItem(`chatUser_${sessionId}_${userId}_displayName`)) {
         // If names are confirmed and session is open, move to role selection
         // This implies participant document might exist or will be created/updated in handleNameSubmit
      } else if (joinStep !== 'roleSelection' && joinStep !== 'waitingRoom') {
        // If no names confirmed yet, stay on nameInput
      }
      // If already in roleSelection or waitingRoom, other effects will handle it
    }
  }, [sessionId, sessionData, urlToken, userId, currentScenario, isLoadingSessionData, isLoadingScenario, router, accessError, joinStep]);


  // Listener for sessionParticipants for role selection display
  useEffect(() => {
    if (!sessionId || !currentScenario || (joinStep !== 'roleSelection' && joinStep !== 'waitingRoom') || accessError) {
      setIsLoadingParticipants(false);
      if (joinStep !== 'roleSelection') setSessionParticipants([]);
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
    });
    return () => unsubscribe();
  }, [sessionId, toast, joinStep, currentScenario, accessError]);


  // Listener for own participant document to detect admin moves and set initial selectedRoleId
  useEffect(() => {
    if (!sessionId || !userId || joinStep !== 'roleSelection' || accessError) return;

    const participantDocRef = doc(db, "sessions", sessionId, "participants", userId);
    const unsubscribe = onSnapshot(participantDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const participantData = docSnap.data() as Participant;
        const currentRoleIdInDb = participantData.roleId || null;

        if (selectedRoleId === null && currentRoleIdInDb) {
          setSelectedRoleId(currentRoleIdInDb); // Sync local state if not yet set by user action
        }
        
        if (previousRoleIdRef.current !== null && previousRoleIdRef.current !== currentRoleIdInDb && currentRoleIdInDb !== selectedRoleId) {
           const newRole = currentScenario?.humanRolesConfig?.find(r => r.id === currentRoleIdInDb);
           if (newRole) {
             setAdminMovedToRoleName(newRole.name);
             setShowAdminMovedDialog(true);
             setSelectedRoleId(currentRoleIdInDb); // Crucially update local selectedRoleId
           }
        }
        previousRoleIdRef.current = currentRoleIdInDb;
      }
    });
    return () => unsubscribe();
  }, [sessionId, userId, joinStep, currentScenario, accessError, selectedRoleId]);


  // Effect for countdown and redirection from waiting room
 useEffect(() => {
    if (joinStep !== "waitingRoom" || !sessionData?.simulationStartCountdownEndTime || accessError) {
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
        // Redirection is now handled by the status listener below
      } else {
        setCountdownSeconds(Math.ceil(remainingMillis / 1000));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [joinStep, sessionData?.simulationStartCountdownEndTime, accessError]);

   // Effect to listen for session status change to "active" to trigger redirect from roleSelection or waitingRoom
  useEffect(() => {
    if ((joinStep === "waitingRoom" || (joinStep === "roleSelection" && selectedRoleId)) && sessionId && sessionData && !accessError) {
      if (sessionData.status === "active") {
        // Ensure all necessary details are in localStorage before redirecting
        const storedRealName = localStorage.getItem(`chatUser_${sessionId}_${userId}_realName`);
        const storedDisplayName = localStorage.getItem(`chatUser_${sessionId}_${userId}_displayName`);
        const storedRoleId = localStorage.getItem(`chatUser_${sessionId}_${userId}_roleId`);

        if (storedRealName && storedDisplayName && storedRoleId) {
             toast({title: "Simulation gestartet!", description: "Du wirst zum Chat weitergeleitet."});
             router.push(`/chat/${sessionId}`);
        } else {
             console.error("Missing user details in localStorage before redirecting to chat.");
             setAccessError("Fehler: Benutzerdetails nicht vollständig gespeichert. Bitte versuche, Namen und Rolle erneut zu bestätigen.");
             setJoinStep("nameInput"); 
        }
      } else if (sessionData.status === "open" && joinStep === "waitingRoom" && !sessionData.simulationStartCountdownEndTime) {
        setJoinStep("roleSelection");
        toast({ title: "Sitzungsstart zurückgesetzt", description: "Du kannst deine Rolle erneut wählen."});
      }
    }
  }, [joinStep, sessionId, sessionData, router, toast, userId, selectedRoleId, accessError]);


  const handleNameSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!realName.trim() || !displayName.trim()) {
      toast({ variant: "destructive", title: "Fehler", description: "Bitte beide Namen eingeben." });
      return;
    }
    if (!userId) { // Should be set by useEffect, but as a fallback
        toast({variant: "destructive", title: "Fehler", description: "Benutzer-ID nicht initialisiert. Bitte Seite neu laden."});
        return;
    }
    setIsSubmittingName(true);

    localStorage.setItem(`chatUser_${sessionId}_${userId}_realName`, realName.trim());
    localStorage.setItem(`chatUser_${sessionId}_${userId}_displayName`, displayName.trim());
    
    try {
      const participantRef = doc(db, "sessions", sessionId, "participants", userId);
      const participantData: Partial<Participant> = {
        userId: userId,
        realName: realName.trim(),
        displayName: displayName.trim(),
        isBot: false,
        status: "Wählt Rolle", // New status
        role: "", 
        roleId: "",
        // joinedAt will be set on initial doc creation or can be updated here if needed
      };
      
      const participantSnap = await getDoc(participantRef);
      if (!participantSnap.exists()) {
        await setDoc(participantRef, { ...participantData, joinedAt: serverTimestamp() as Timestamp });
      } else {
        await updateDoc(participantRef, { ...participantData, updatedAt: serverTimestamp() as Timestamp });
      }
      
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
    setDisplayName(newDisplayName); // Update local state for input field
    if (userId && newDisplayName.trim() && joinStep === 'roleSelection') {
        localStorage.setItem(`chatUser_${sessionId}_${userId}_displayName`, newDisplayName.trim());
        try {
            const participantRef = doc(db, "sessions", sessionId, "participants", userId);
            await updateDoc(participantRef, { displayName: newDisplayName.trim(), updatedAt: serverTimestamp() });
            // No toast needed for every keystroke, it updates on blur or when role is selected.
        } catch (error) {
            console.warn("Could not update displayName in Firestore immediately:", error);
            // Optionally, show a small, non-intrusive saving indicator
        }
    }
  };


  const handleRoleSelection = async (newRoleId: string) => {
    if (!currentScenario || !currentScenario.humanRolesConfig || !userId || !displayName.trim()) {
      toast({ variant: "destructive", title: "Fehler", description: "Benutzername oder Szenariodaten fehlen für Rollenauswahl." });
      return;
    }

    const participantDocRef = doc(db, "sessions", sessionId, "participants", userId);
    const participantSnap = await getDoc(participantDocRef);

    if (sessionData?.roleSelectionLocked && participantSnap.exists() && participantSnap.data()?.roleId && participantSnap.data()?.roleId !== newRoleId) {
        toast({ variant: "default", title: "Rollenauswahl gesperrt", description: "Die Rollenauswahl wurde vom Administrator gesperrt.", className: "bg-yellow-500/10 border-yellow-500"});
        return;
    }
    
    const selectedRoleConfig = currentScenario.humanRolesConfig.find(r => r.id === newRoleId);
    if (!selectedRoleConfig) {
        toast({ variant: "destructive", title: "Fehler", description: "Ausgewählte Rolle nicht gefunden." });
        return;
    }

    setIsUpdatingRole(true);
    try {
      const updateData: Partial<Participant> = {
        role: selectedRoleConfig.name,
        roleId: selectedRoleConfig.id,
        displayName: displayName.trim(), // Ensure latest displayName is saved
        status: "Im Wartebereich",
        updatedAt: serverTimestamp() as Timestamp
      };
      if (!participantSnap.exists()) { // Should not happen if name submission worked
         await setDoc(participantDocRef, {
            ...updateData,
            userId: userId,
            realName: realName.trim() || "Unbekannt", // Fallback, should be set from nameInput
            isBot: false,
            joinedAt: serverTimestamp() as Timestamp
         });
      } else {
        await updateDoc(participantDocRef, updateData);
      }
      
      setSelectedRoleId(newRoleId);
      localStorage.setItem(`chatUser_${sessionId}_${userId}_roleId`, newRoleId);
      localStorage.setItem(`chatUser_${sessionId}_${userId}_roleName`, selectedRoleConfig.name);
      previousRoleIdRef.current = newRoleId; 
      // User stays on roleSelection page. Transition to waitingRoom happens when admin starts countdown.
      toast({ title: "Rolle ausgewählt", description: `Du hast die Rolle "${selectedRoleConfig.name}" gewählt. Warte auf Start...` });

    } catch (error: any) {
      console.error("Error updating participant role:", error);
      toast({variant: "destructive", title: "Fehler", description: `Rolle konnte nicht aktualisiert werden: ${error.message}`});
    } finally {
      setIsUpdatingRole(false);
    }
  };
  
  const isLoadingPage = isLoadingSessionData || isLoadingScenario;

  if (isLoadingPage && !accessError) { 
    return <LoadingScreen text="Sitzungs- und Szenariodaten werden geladen..." />;
  }
  
  if (accessError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center">
              <AlertTriangle className="h-6 w-6 mr-2" /> Zugangsproblem
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

        <Button onClick={() => setJoinStep("nameInput")} variant="ghost" className="absolute top-4 left-4 sm:top-8 sm:left-8" aria-label="Zurück zur Namenseingabe">
            <ArrowLeft className="h-5 w-5 mr-2" /> Namen ändern
        </Button>
        <Card className="w-full max-w-4xl">
          <CardHeader>
            <CardTitle className="text-2xl text-primary">Rollenauswahl für: {currentScenario?.title}</CardTitle>
            <CardDescription>
              Wähle deine Rolle für die Simulation. Klicke auf eine Karte, um sie auszuwählen. Deine Auswahl wird live gespeichert.
              {sessionData?.roleSelectionLocked && <span className="font-semibold text-destructive block mt-1"> Die Rollenauswahl wurde vom Administrator gesperrt. Du kannst deine aktuelle Rolle nicht mehr ändern.</span>}
            </CardDescription>
             <div className="mt-3">
                <Label htmlFor="displayNameChangeInRoleSelection" className="text-sm font-medium">Dein Nickname (im Chat sichtbar):</Label>
                <Input
                    id="displayNameChangeInRoleSelection"
                    type="text"
                    value={displayName}
                    onChange={(e) => handleDisplayNameChangeInRoleSelection(e.target.value)}
                    onBlur={() => { // Save on blur as well
                        if (userId && displayName.trim() && joinStep === 'roleSelection') {
                            localStorage.setItem(`chatUser_${sessionId}_${userId}_displayName`, displayName.trim());
                             updateDoc(doc(db, "sessions", sessionId, "participants", userId), { displayName: displayName.trim(), updatedAt: serverTimestamp() }).catch(console.warn);
                        }
                    }}
                    className="mt-1 h-9 text-base"
                    disabled={isUpdatingRole || sessionData?.roleSelectionLocked}
                    placeholder="Nickname"
                />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingParticipants && <div className="text-sm text-muted-foreground flex items-center py-4"><Loader2 className="h-4 w-4 animate-spin mr-2"/> Lade aktuelle Rollenbelegungen...</div>}
            {!currentScenario?.humanRolesConfig || currentScenario.humanRolesConfig.length === 0 && !isLoadingScenario && (
                <p className="text-sm text-muted-foreground py-4 text-center">Für dieses Szenario sind keine menschlichen Rollen definiert.</p>
            )}
            <ScrollArea className="h-[calc(100vh-480px)] min-h-[250px] pr-3">
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(currentScenario?.humanRolesConfig || []).map((role) => {
                        const participantsInThisRole = sessionParticipants.filter(p => p.roleId === role.id);
                        const isSelectedByCurrentUser = selectedRoleId === role.id;
                        
                        const isEffectivelyLockedForSelection = sessionData?.roleSelectionLocked && 
                                                                selectedRoleId !== null && // User has made a selection
                                                                selectedRoleId !== role.id; // And it's not this role

                        return (
                            <Card
                                key={role.id}
                                className={cn(
                                "transition-all hover:shadow-lg flex flex-col justify-between min-h-[200px]", 
                                isSelectedByCurrentUser ? "ring-2 ring-primary shadow-primary/30" : "ring-1 ring-border",
                                (isEffectivelyLockedForSelection)
                                  ? "opacity-70 cursor-not-allowed bg-muted/30"
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
                                    <div className="min-h-[30px]"> {/* Ensure space for names */}
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
                                    </div>
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
                <Clock className="h-4 w-4" />
                <AlertTitle>Warte auf Simulationsstart</AlertTitle>
                <AlertDescription>
                    Deine Rollenauswahl wird live gespeichert. Du bleibst auf dieser Seite, bis der Administrator die Simulation startet.
                    Du kannst deinen Nicknamen oder deine Rolle (falls nicht vom Admin gesperrt) noch ändern.
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
    
    // Calculate initial total duration for progress bar based on when countdown was set
    const initialTotalCountdownDuration = useMemo(() => {
        if (sessionData?.simulationStartCountdownEndTime && sessionData?.updatedAt) {
            const targetMillis = (sessionData.simulationStartCountdownEndTime as Timestamp).toMillis();
            const setAtMillis = (sessionData.updatedAt as Timestamp).toMillis(); // Time when countdown was likely set
            return Math.max(1, Math.round((targetMillis - setAtMillis) / 1000)); // Ensure at least 1s
        }
        return 10; // Fallback if timestamps are weird
    }, [sessionData?.simulationStartCountdownEndTime, sessionData?.updatedAt]);


    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
                {countdownSeconds !== null && countdownSeconds > 0 && sessionData?.simulationStartCountdownEndTime ? (
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
                                strokeDashoffset={ (1 - (Math.max(0, countdownSeconds) / initialTotalCountdownDuration)) * 2 * Math.PI * 54 }
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
              Du nimmst teil als <span className="font-semibold">{displayName}</span> in der Rolle <span className="font-semibold text-foreground">{roleNameForWaitingRoom}</span>.
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
