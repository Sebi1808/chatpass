
"use client";

import { useState, useEffect, type FormEvent, useMemo, useCallback } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Scenario, SessionData, Participant, HumanRoleConfig } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, LogIn, AlertTriangle, Loader2, UserCheck, Info, Users2, CheckCircle, Clock, UserPlus, Users as UsersIcon, Check, Eye, Edit3 } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, serverTimestamp, query, where, getDocs, Timestamp, onSnapshot, updateDoc, runTransaction, setDoc, Unsubscribe } from "firebase/firestore";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useSessionData } from "@/hooks/use-session-data";
import { createDefaultScenario } from '@/app/admin/scenario-editor/[scenarioId]/page'; 
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogClose } from "@/components/ui/dialog";

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
  const searchParamsHook = useSearchParams(); // Renamed to avoid conflict
  const { toast } = useToast();

  const sessionId = params.sessionId as string;
  const urlToken = searchParamsHook.get("token");
  
  const [joinStep, setJoinStep] = useState<JoinStep>("nameInput");
  
  const [realName, setRealName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>("");
  const [participantDocId, setParticipantDocId] = useState<string | null>(null); // Firestore doc ID for this user in this session

  const [currentScenario, setCurrentScenario] = useState<Scenario | null>(null);
  const { sessionData, isLoading: isLoadingSessionData, error: sessionError } = useSessionData(sessionId);
  
  const [sessionParticipants, setSessionParticipants] = useState<Participant[]>([]);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(false); // Default to false, true when fetching for role selection
  
  const [isLoadingScenario, setIsLoadingScenario] = useState(true); 
  
  const [isSubmittingName, setIsSubmittingName] = useState(false);
  const [isProcessingRole, setIsProcessingRole] = useState(false);

  const [accessError, setAccessError] = useState<string | null>(null);
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);
  const [hasConfirmedName, setHasConfirmedName] = useState(false);


  useEffect(() => {
    const localId = generateLocalUserId();
    setUserId(localId);
    setParticipantDocId(localId); // Assuming userId is the docId for simplicity in this context

    const storedRealName = localStorage.getItem(`chatUser_${sessionId}_${localId}_realName`);
    const storedDisplayName = localStorage.getItem(`chatUser_${sessionId}_${localId}_displayName`);
    const storedRoleId = localStorage.getItem(`chatUser_${sessionId}_${localId}_roleId`);

    if (storedRealName) setRealName(storedRealName);
    if (storedDisplayName) setDisplayName(storedDisplayName);
    if (storedRoleId) setSelectedRoleId(storedRoleId);

    // Determine initial step based on stored data
    if (storedRealName && storedDisplayName) {
      setHasConfirmedName(true); // User has entered names before
      // If role is also stored, they might be in waiting room or already joined
      // This logic will be further refined by sessionData.status checks
    }
  }, [sessionId]);

  useEffect(() => {
    if (sessionError) {
      setAccessError(sessionError);
    }
  }, [sessionError]);

  useEffect(() => {
    if (!sessionData || !sessionData.scenarioId) {
      if (!isLoadingSessionData && !sessionData && !sessionError) {
         setAccessError(prev => prev || "Sitzungsdaten nicht gefunden oder ungültige Szenario-Referenz.");
      }
      setCurrentScenario(null); // Ensure scenario is null if no sessionData or scenarioId
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
          setAccessError(null); 
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


  useEffect(() => {
    if (isLoadingSessionData || isLoadingScenario || !sessionData || !currentScenario) return;

    if (!urlToken || sessionData.invitationToken !== urlToken) {
      if (!accessError?.includes("Einladungslink")) {
         setAccessError("Ungültiger oder abgelaufener Einladungslink.");
      }
      return;
    }
    
    if (sessionData.status === "pending") {
        setAccessError("Der Administrator bereitet die Sitzung vor. Bitte warte einen Moment oder versuche es später erneut.");
        setJoinStep("nameInput"); // Or a specific "pending" screen
    } else if (sessionData.status === "active") {
        // If user has a participantDoc and selected a role, redirect to chat
        const localRoleId = localStorage.getItem(`chatUser_${sessionId}_${userId}_roleId`);
        if (hasConfirmedName && localRoleId) {
            router.push(`/chat/${sessionId}`);
            return;
        }
        setAccessError("Diese Simulation läuft bereits. Ein neuer Beitritt ist nicht möglich, wenn du nicht bereits teilgenommen hast.");
        setJoinStep("nameInput"); 
    } else if (sessionData.status === "ended") {
        setAccessError("Diese Sitzung wurde bereits beendet.");
        setJoinStep("nameInput");
    } else if (sessionData.status === "paused") {
        setAccessError("Diese Sitzung ist aktuell pausiert. Ein Beitritt ist momentan nicht möglich.");
        setJoinStep("nameInput");
    } else if (sessionData.status === "open") {
        // Allow progression if status is open
        setAccessError(null);
        if (hasConfirmedName) {
            setJoinStep("roleSelection");
        } else {
            setJoinStep("nameInput");
        }
    } else {
        setAccessError(null); 
        if (hasConfirmedName) {
            setJoinStep("roleSelection");
        } else {
            setJoinStep("nameInput");
        }
    }
  }, [sessionId, sessionData, urlToken, userId, currentScenario, hasConfirmedName, router, accessError, isLoadingSessionData, isLoadingScenario]);

  // Listener for sessionParticipants for role selection display
  useEffect(() => {
    if (!sessionId || joinStep !== 'roleSelection') {
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
      setSessionParticipants([]);
    });
    return () => unsubscribe();
  }, [sessionId, toast, joinStep]);

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
        // Redirection to chat will be handled by the status listener below
      } else {
        setCountdownSeconds(Math.ceil(remainingMillis / 1000));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [joinStep, sessionData?.simulationStartCountdownEndTime]);

   // Effect to listen for session status change to "active" while in waiting room or role selection
  useEffect(() => {
    if ((joinStep === "waitingRoom" || (joinStep === "roleSelection" && selectedRoleId)) && sessionId && sessionData) {
      if (sessionData.status === "active") {
        // Ensure role and name are in localStorage before redirecting
        const storedRealName = localStorage.getItem(`chatUser_${sessionId}_${userId}_realName`);
        const storedDisplayName = localStorage.getItem(`chatUser_${sessionId}_${userId}_displayName`);
        const storedRoleId = localStorage.getItem(`chatUser_${sessionId}_${userId}_roleId`);

        if (storedRealName && storedDisplayName && storedRoleId) {
             toast({title: "Simulation gestartet!", description: "Du wirst zum Chat weitergeleitet."});
             router.push(`/chat/${sessionId}`);
        } else if (joinStep === "waitingRoom") { // Only show error if truly in waiting room but data missing
             console.error("Missing user details in localStorage before redirecting to chat from waiting room.");
             setAccessError("Fehler: Benutzerdetails nicht vollständig. Bitte versuche, erneut beizutreten.");
        }
      } else if ((sessionData.status === "ended" || sessionData.status === "paused") && (joinStep === "waitingRoom" || joinStep === "roleSelection")) {
        setAccessError(`Die Sitzung wurde vom Administrator ${sessionData.status === "ended" ? "beendet" : "pausiert"}.`);
      }
    }
  }, [joinStep, sessionId, sessionData, router, toast, userId, selectedRoleId]);


  const handleNameSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmittingName(true);
    if (!realName.trim()) {
      toast({ variant: "destructive", title: "Fehler", description: "Bitte Klarnamen eingeben." });
      setIsSubmittingName(false); return;
    }
    if (!displayName.trim()) {
      toast({ variant: "destructive", title: "Fehler", description: "Bitte Nicknamen eingeben." });
      setIsSubmittingName(false); return;
    }

    localStorage.setItem(`chatUser_${sessionId}_${userId}_realName`, realName.trim());
    localStorage.setItem(`chatUser_${sessionId}_${userId}_displayName`, displayName.trim());
    setHasConfirmedName(true);

    try {
      if (!participantDocId) { // Should always be set by now
        toast({ variant: "destructive", title: "Fehler", description: "Teilnehmer-ID nicht initialisiert." });
        setIsSubmittingName(false);
        return;
      }
      const participantRef = doc(db, "sessions", sessionId, "participants", participantDocId);
      const participantSnap = await getDoc(participantRef);

      const participantData: Partial<Participant> = {
        userId: userId,
        realName: realName.trim(),
        displayName: displayName.trim(),
        isBot: false,
        status: "Beigetreten", 
        role: participantSnap.exists() ? participantSnap.data().role || "" : "", // Preserve existing role if any
        roleId: participantSnap.exists() ? participantSnap.data().roleId || null : null,
      };

      if (participantSnap.exists()) {
        await updateDoc(participantRef, {
            ...participantData,
            updatedAt: serverTimestamp() as Timestamp
        });
      } else {
        await setDoc(participantRef, {
            ...participantData,
            joinedAt: serverTimestamp() as Timestamp
        });
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

  const handleRoleSelection = async (newRoleId: string) => {
    if (!currentScenario || !currentScenario.humanRolesConfig || !userId || !participantDocId) {
      toast({ variant: "destructive", title: "Fehler", description: "Notwendige Daten für Rollenauswahl fehlen." });
      return;
    }
    
    const currentParticipantDoc = sessionParticipants.find(p => p.id === participantDocId);

    if (sessionData?.roleSelectionLocked && currentParticipantDoc?.roleId && currentParticipantDoc.roleId !== newRoleId) {
        toast({ variant: "default", title: "Rollenauswahl gesperrt", description: "Die Rollenauswahl wurde vom Administrator gesperrt. Du kannst deine aktuelle Rolle nicht ändern.", className: "bg-yellow-500/10 border-yellow-500"});
        return;
    }
    
    const selectedRoleConfig = currentScenario.humanRolesConfig.find(r => r.id === newRoleId);
    if (!selectedRoleConfig) {
        toast({ variant: "destructive", title: "Fehler", description: "Ausgewählte Rolle nicht gefunden." });
        return;
    }

    setIsProcessingRole(true);
    try {
      const participantRef = doc(db, "sessions", sessionId, "participants", participantDocId);
      await updateDoc(participantRef, {
        role: selectedRoleConfig.name,
        roleId: selectedRoleConfig.id,
        updatedAt: serverTimestamp()
      });
      setSelectedRoleId(newRoleId); // Update local state to reflect selection
      localStorage.setItem(`chatUser_${sessionId}_${userId}_roleId`, newRoleId);
      localStorage.setItem(`chatUser_${sessionId}_${userId}_roleName`, selectedRoleConfig.name);
      // No automatic transition to waitingRoom here; user stays on role selection
    } catch (error: any) {
      console.error("Error updating participant role:", error);
      toast({variant: "destructive", title: "Fehler", description: `Rolle konnte nicht aktualisiert werden: ${error.message}`});
    } finally {
      setIsProcessingRole(false);
    }
  };
  
  const handleConfirmRoleAndGoToWaitingRoom = () => {
    if (!selectedRoleId) {
      toast({variant: "destructive", title: "Keine Rolle gewählt", description: "Bitte wähle zuerst eine Rolle aus und bestätige sie."});
      return;
    }
     if (sessionData?.status !== "open") {
      toast({variant: "destructive", title: "Sitzung nicht offen", description: "Du kannst dem Wartebereich nur beitreten, wenn die Sitzung 'offen' ist."});
      return;
    }
    setJoinStep("waitingRoom");
  };

  const handleDisplayNameChangeInRoleSelection = async (newDisplayName: string) => {
    setDisplayName(newDisplayName); // Update local state for input field
    if (userId && participantDocId && newDisplayName.trim() && hasConfirmedName) {
        localStorage.setItem(`chatUser_${sessionId}_${userId}_displayName`, newDisplayName.trim());
        try {
            const participantRef = doc(db, "sessions", sessionId, "participants", participantDocId);
            await updateDoc(participantRef, { displayName: newDisplayName.trim(), updatedAt: serverTimestamp() });
        } catch (error) {
            console.warn("Could not update displayName in Firestore immediately during role selection:", error);
            // Optionally, queue this update or re-try, or just rely on localStorage for chat page
        }
    }
  };


  const allScenarioRoles = useMemo(() => {
    return currentScenario?.humanRolesConfig || [];
  }, [currentScenario]);
  
  const isLoadingPage = isLoadingSessionData || isLoadingScenario;


  if (isLoadingPage && !accessError) {
    return <LoadingScreen text="Sitzungs- und Szenariodaten werden geladen..." />;
  }
  
  if (accessError && joinStep !== 'waitingRoom') { // Allow waiting room to persist even if minor access errors occur once joined
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center">
              <AlertTriangle className="h-6 w-6 mr-2" /> Zugang nicht möglich
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant={accessError.includes("Vorbereitung") || accessError.includes("Sitzungsdokument nicht gefunden") ? "default" : "destructive"} className={accessError.includes("Vorbereitung") ? "bg-blue-500/10 border-blue-500" : ""}>
                <Info className={`h-4 w-4 ${accessError.includes("Vorbereitung") ? "" : "text-destructive"}`} />
                <AlertTitle>{accessError.includes("Vorbereitung") || accessError.includes("Sitzungsdokument nicht gefunden") ? "Information" : "Fehler"}</AlertTitle>
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
            <CardTitle className="text-2xl text-primary">Simulation beitreten: {currentScenario?.title || "Szenario lädt..."}</CardTitle>
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
              <Button type="submit" className="w-full" disabled={isSubmittingName || !realName.trim() || !displayName.trim()}>
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
         <Button onClick={() => setJoinStep("nameInput")} variant="ghost" className="absolute top-4 left-4 sm:top-8 sm:left-8" aria-label="Zurück zur Namenseingabe">
            <ArrowLeft className="h-5 w-5 mr-2" /> Namen ändern
        </Button>
        <Card className="w-full max-w-3xl">
          <CardHeader>
            <CardTitle className="text-2xl text-primary">Rollenauswahl: {currentScenario?.title}</CardTitle>
            <CardDescription>
              Wähle deine Rolle für die Simulation. Die Auswahl wird live aktualisiert.
            </CardDescription>
             <div className="mt-3">
                <Label htmlFor="displayNameChangeInRoleSelection" className="text-sm font-medium">Dein Nickname (im Chat sichtbar):</Label>
                <Input 
                    id="displayNameChangeInRoleSelection" 
                    type="text" 
                    value={displayName} 
                    onChange={(e) => handleDisplayNameChangeInRoleSelection(e.target.value)} 
                    className="mt-1 h-9 text-base" 
                    disabled={isProcessingRole}
                    placeholder="Nickname"
                />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {sessionData?.roleSelectionLocked && (
              <Alert variant="default" className="bg-yellow-500/10 border-yellow-500 text-yellow-700">
                <Info className="h-4 w-4 !text-yellow-700" />
                <AlertTitle>Rollenauswahl gesperrt</AlertTitle>
                <AlertDescription>Die Rollenauswahl wurde vom Administrator gesperrt. Wenn du bereits eine Rolle gewählt hattest, bleibt diese bestehen. Du kannst keine andere Rolle mehr wählen.</AlertDescription>
              </Alert>
            )}
            {isLoadingParticipants && joinStep === 'roleSelection' && <div className="text-sm text-muted-foreground flex items-center py-4"><Loader2 className="h-4 w-4 animate-spin mr-2"/> Lade aktuelle Rollenbelegungen...</div>}
            {!isLoadingParticipants && allScenarioRoles.length === 0 && <p className="text-sm text-muted-foreground py-4">Für dieses Szenario sind keine menschlichen Rollen definiert.</p>}
            
            <ScrollArea className="h-[calc(100vh-420px)] min-h-[250px] pr-3"> {/* Adjusted height */}
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {allScenarioRoles.map((role) => {
                        const participantsInThisRole = sessionParticipants.filter(p => p.roleId === role.id);
                        const isSelectedByCurrentUser = selectedRoleId === role.id;
                        const isLockedForCurrentUser = sessionData?.roleSelectionLocked && 
                                                      sessionParticipants.find(p=>p.id === participantDocId)?.roleId &&
                                                      sessionParticipants.find(p=>p.id === participantDocId)?.roleId !== role.id;

                        return (
                            <Card
                                key={role.id} 
                                className={cn(
                                "cursor-pointer transition-all hover:shadow-lg flex flex-col justify-between min-h-[150px]",
                                isSelectedByCurrentUser ? "ring-2 ring-primary shadow-primary/30" : "ring-1 ring-border",
                                isLockedForCurrentUser ? "opacity-60 cursor-not-allowed bg-muted/30" : "hover:bg-muted/10"
                                )}
                                onClick={() => !isLockedForCurrentUser && handleRoleSelection(role.id)}
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
                                            <p className="font-medium text-foreground/80 mb-1 flex items-center text-xs"><UsersIcon className="h-3 w-3 mr-1.5"/>Belegt durch:</p>
                                            <div className="flex flex-wrap gap-1 max-h-12 overflow-y-auto">
                                                {participantsInThisRole.map(p => <Badge key={p.id} variant="secondary" className="text-xs">{p.displayName}</Badge>)}
                                            </div>
                                        </>
                                    ) : (
                                        <p className="text-xs italic">Noch frei</p>
                                    )}
                                    {isSelectedByCurrentUser && displayName.trim() && !participantsInThisRole.some(p=>p.displayName === displayName.trim() && p.id !== participantDocId) && (
                                        <div className="mt-1 pt-1 border-t border-dashed">
                                            <Badge variant="default" className="text-xs bg-primary/20 text-primary border-primary/50">Du: {displayName.trim()}</Badge>
                                        </div>
                                    )}
                                </CardContent>
                                {isSelectedByCurrentUser && (
                                  <CardFooter className="p-2 border-t">
                                    <p className="text-xs text-green-600 flex items-center w-full justify-center"><CheckCircle className="h-3.5 w-3.5 mr-1.5"/> Deine Auswahl</p>
                                  </CardFooter>
                                )}
                            </Card>
                        );
                    })}
                </div>
            </ScrollArea>
          </CardContent>
          <CardFooter>
              <Button onClick={handleConfirmRoleAndGoToWaitingRoom} className="w-full" disabled={isProcessingRole || !selectedRoleId || !displayName.trim()}>
                {isProcessingRole ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <Check className="mr-2 h-5 w-5" />}
                Auswahl bestätigen & zum Wartebereich
              </Button>
            </CardFooter>
        </Card>
      </div>
    );
  }

  if (joinStep === "waitingRoom") {
    const roleNameForWaitingRoom = currentScenario?.humanRolesConfig?.find(r => r.id === selectedRoleId)?.name || "Unbekannt";
    const roleDescForWaitingRoom = currentScenario?.humanRolesConfig?.find(r => r.id === selectedRoleId)?.description || "Keine Rollenbeschreibung verfügbar.";

    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3">
                {countdownSeconds !== null && countdownSeconds > 0 && sessionData?.status !== 'active' ? (
                    <div className="relative h-28 w-28"> {/* Increased size */}
                        <svg className="transform -rotate-90" viewBox="0 0 120 120">
                            <circle cx="60" cy="60" r="54" fill="none" stroke="hsl(var(--border))" strokeWidth="10" /> {/* Thicker border */}
                            <circle
                                cx="60"
                                cy="60"
                                r="54"
                                fill="none"
                                stroke="hsl(var(--primary))"
                                strokeWidth="10" // Thicker border
                                strokeDasharray={`${(countdownSeconds / (sessionData?.simulationStartCountdownEndTime ? ((sessionData.simulationStartCountdownEndTime.toMillis() - (sessionData.createdAt?.toMillis() || sessionData.simulationStartCountdownEndTime.toMillis() - 10000) )/1000) : 10) ) * 2 * Math.PI * 54} ${2 * Math.PI * 54}`} // Dynamic total for progress
                                strokeLinecap="round"
                                className="transition-all duration-1000 ease-linear"
                            />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center text-4xl font-bold text-primary"> {/* Larger text */}
                            {countdownSeconds}
                        </div>
                    </div>
                ) : sessionData?.status === 'active' || countdownSeconds === 0 ? ( // Check if already active
                    <CheckCircle className="h-24 w-24 text-green-500" /> // Increased size
                ) : (
                    <Clock className="h-24 w-24 text-primary animate-pulse" /> // Increased size
                )}
            </div>
            <CardTitle className="text-2xl text-primary">
              Warteraum: {currentScenario?.title || "Szenario"}
            </CardTitle>
            <CardDescription>
              Du bist erfolgreich der Simulation beigetreten!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-center">
            <p>Dein Nickname: <span className="font-semibold">{displayName}</span></p>
            <p>Deine Rolle: <span className="font-semibold">{roleNameForWaitingRoom}</span></p>
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
                {sessionData?.status === 'active' || countdownSeconds === 0 ? (
                    <p className="flex items-center justify-center text-green-600"><CheckCircle className="h-5 w-5 mr-2"/>Simulation gestartet! Du wirst weitergeleitet...</p>
                ) : countdownSeconds !== null && countdownSeconds > 0 ? (
                    <p className="flex items-center justify-center"><Loader2 className="h-5 w-5 mr-2 animate-spin"/>Simulation startet in Kürze automatisch...</p>
                ) : (
                    <p className="flex items-center justify-center"><Loader2 className="h-5 w-5 mr-2 animate-spin"/>Bitte warte, bis der Administrator die Simulation startet...</p>
                )}
            </div>
          </CardContent>
           <CardFooter className="pt-4">
                <Button onClick={() => setJoinStep("roleSelection")} variant="outline" className="w-full" disabled={sessionData?.roleSelectionLocked || sessionData?.status === 'active' || countdownSeconds !== null}>
                    <Edit3 className="mr-2 h-4 w-4"/> Rolle ändern
                </Button>
           </CardFooter>
        </Card>
      </div>
    );
  }

  return <LoadingScreen text="Lade Beitritts-Status..." />;
}

