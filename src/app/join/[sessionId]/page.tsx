
"use client";

import { useState, useEffect, type FormEvent, useMemo, useCallback } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Scenario, SessionData, Participant, HumanRoleConfig } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, LogIn, AlertTriangle, Loader2, UserCheck, Info, Users2, CheckCircle, Clock, UserPlus, Users as UsersIcon, Check } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, addDoc, serverTimestamp, query, where, getDocs, Timestamp, onSnapshot, updateDoc, runTransaction, setDoc } from "firebase/firestore";
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

// Helper to generate a simple unique enough ID for local use
const generateLocalUserId = () => {
  let userId = localStorage.getItem('localUserId');
  if (!userId) {
    userId = `localUser-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    localStorage.setItem('localUserId', userId);
  }
  return userId;
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
  const [displayName, setDisplayName] = useState(""); // Nickname
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>("");

  const [currentScenario, setCurrentScenario] = useState<Scenario | null>(null);
  const { sessionData, isLoading: isLoadingSessionData, error: sessionError } = useSessionData(sessionId);
  
  const [sessionParticipants, setSessionParticipants] = useState<Participant[]>([]);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(true);
  const [isLoadingScenario, setIsLoadingScenario] = useState(true); 
  
  const [isSubmittingName, setIsSubmittingName] = useState(false);
  const [isProcessingRole, setIsProcessingRole] = useState(false);

  const [accessError, setAccessError] = useState<string | null>(null);
  const [userHasJoinedBefore, setUserHasJoinedBefore] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);
  const [participantDocId, setParticipantDocId] = useState<string | null>(null);


  useEffect(() => {
    if (sessionError) {
      setAccessError(sessionError);
    }
  }, [sessionError]);

  useEffect(() => {
    const localId = generateLocalUserId();
    setUserId(localId);
    const storedRealName = localStorage.getItem(`chatUser_${sessionId}_${localId}_realName`);
    const storedDisplayName = localStorage.getItem(`chatUser_${sessionId}_${localId}_displayName`);
    const storedRoleId = localStorage.getItem(`chatUser_${sessionId}_${localId}_roleId`);

    if (storedRealName && storedDisplayName) {
      setRealName(storedRealName);
      setDisplayName(storedDisplayName);
      setUserHasJoinedBefore(true); // Indicates this browser/user combo has entered names before
      if (storedRoleId) {
        setSelectedRoleId(storedRoleId);
      }
      // Potentially advance step if names are already there
      // setJoinStep("roleSelection"); // Consider if this is desired UX
    }
  }, [sessionId]);


  useEffect(() => {
    if (!sessionData || !sessionData.scenarioId) {
      if (!isLoadingSessionData && !sessionData && !sessionError) {
         setAccessError(prev => prev || "Sitzungsdaten nicht gefunden oder ungültige Szenario-Referenz.");
      }
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
          if (accessError === "Sitzungsdaten nicht gefunden oder ungültige Szenario-Referenz." || accessError?.startsWith("Szenariodetails konnten nicht geladen werden")) {
             setAccessError(null); 
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
  }, [sessionData, isLoadingSessionData, sessionError, accessError]);


  useEffect(() => {
    if (isLoadingSessionData || isLoadingScenario) return;

    if (!sessionData || !urlToken || sessionData.invitationToken !== urlToken) {
      if (!accessError) {
           setAccessError("Ungültiger oder abgelaufener Einladungslink.");
      }
      return;
    }
    
    if (userHasJoinedBefore && participantDocId) { // If user has already completed name step and has a participant doc ID
        if (sessionData.status === "active") {
            router.push(`/chat/${sessionId}`);
            return;
        } else if (sessionData.status === "open" && joinStep !== "waitingRoom") {
             if (selectedRoleId) { // if they have a role, they are in waiting room
                setJoinStep("waitingRoom");
             } else if (joinStep !== "roleSelection") { // if no role yet, go to role selection
                setJoinStep("roleSelection");
             }
        }
    }
    
    if (sessionData.status === "pending") {
        setAccessError("Der Administrator bereitet die Sitzung vor. Bitte warte einen Moment oder versuche es später erneut.");
    } else if (sessionData.status === "active" && !participantDocId) { 
        setAccessError("Diese Simulation läuft bereits. Ein neuer Beitritt ist nicht möglich.");
    } else if (sessionData.status === "ended") {
        setAccessError("Diese Sitzung wurde bereits beendet.");
    } else if (sessionData.status === "paused") {
        setAccessError("Diese Sitzung ist aktuell pausiert. Ein Beitritt ist momentan nicht möglich.");
    } else {
       if (accessError && (accessError.includes("Ungültiger oder abgelaufener Einladungslink."))) {
         // Don't clear these specific errors
       } else {
         setAccessError(null); 
       }
    }
  }, [sessionId, sessionData, urlToken, userHasJoinedBefore, participantDocId, currentScenario, joinStep, router, accessError, isLoadingSessionData, isLoadingScenario]);

  // Listener for sessionParticipants for role selection display
  useEffect(() => {
    if (!sessionId || joinStep !== 'roleSelection') {
      setIsLoadingParticipants(false);
      if (joinStep !== 'roleSelection') setSessionParticipants([]); // Clear if not in role selection step
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
        // Redirection is handled by status listener now
      } else {
        setCountdownSeconds(Math.ceil(remainingMillis / 1000));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [joinStep, sessionData?.simulationStartCountdownEndTime]);

   // Effect to listen for session status change to "active" while in waiting room
  useEffect(() => {
    if (joinStep === "waitingRoom" && sessionId && sessionData) {
      if (sessionData.status === "active") {
        toast({title: "Simulation gestartet!", description: "Du wirst zum Chat weitergeleitet."});
        router.push(`/chat/${sessionId}`);
      } else if ((sessionData.status === "ended" || sessionData.status === "paused") && joinStep === "waitingRoom") {
        setAccessError(`Die Sitzung wurde vom Administrator ${sessionData.status === "ended" ? "beendet" : "pausiert"}.`);
      }
    }
  }, [joinStep, sessionId, sessionData, router, toast]);

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

    try {
      const participantRef = doc(db, "sessions", sessionId, "participants", userId);
      const participantSnap = await getDoc(participantRef);

      const participantData: Partial<Participant> = {
        userId: userId,
        realName: realName.trim(),
        displayName: displayName.trim(),
        isBot: false,
        status: "Beigetreten", // Initial status when names are set
        // role and roleId will be set in the next step or if already set
      };

      if (participantSnap.exists()) {
        await updateDoc(participantRef, {
            ...participantData,
            role: participantSnap.data().role || "", // keep existing role if any
            roleId: participantSnap.data().roleId || null,
            updatedAt: serverTimestamp()
        });
      } else {
        await setDoc(participantRef, {
            ...participantData,
            role: "", // No role selected yet
            roleId: null,
            joinedAt: serverTimestamp()
        });
      }
      setParticipantDocId(userId); // Store the doc ID which is our userId
      setUserHasJoinedBefore(true);
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
    if (sessionData?.roleSelectionLocked && selectedRoleId && selectedRoleId !== newRoleId) {
        toast({ variant: "default", title: "Rollenauswahl gesperrt", description: "Die Rollenauswahl wurde vom Administrator gesperrt.", className: "bg-yellow-500/10 border-yellow-500"});
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
      setSelectedRoleId(newRoleId);
      localStorage.setItem(`chatUser_${sessionId}_${userId}_roleId`, newRoleId);
      localStorage.setItem(`chatUser_${sessionId}_${userId}_roleName`, selectedRoleConfig.name); // Store role name for chat page
      // toast({ title: "Rolle ausgewählt", description: `Du hast die Rolle "${selectedRoleConfig.name}" gewählt.` });
    } catch (error: any) {
      console.error("Error updating participant role:", error);
      toast({variant: "destructive", title: "Fehler", description: `Rolle konnte nicht aktualisiert werden: ${error.message}`});
    } finally {
      setIsProcessingRole(false);
    }
  };
  
  const handleConfirmRoleAndGoToWaitingRoom = () => {
    if (!selectedRoleId) {
      toast({variant: "destructive", title: "Keine Rolle gewählt", description: "Bitte wähle zuerst eine Rolle aus."});
      return;
    }
    setJoinStep("waitingRoom");
  };

  const handleDisplayNameChange = async (newDisplayName: string) => {
    setDisplayName(newDisplayName);
    if (userId && participantDocId && newDisplayName.trim()) {
        localStorage.setItem(`chatUser_${sessionId}_${userId}_displayName`, newDisplayName.trim());
        try {
            const participantRef = doc(db, "sessions", sessionId, "participants", participantDocId);
            await updateDoc(participantRef, { displayName: newDisplayName.trim(), updatedAt: serverTimestamp() });
        } catch (error) {
            console.warn("Could not update displayName in Firestore immediately:", error);
        }
    }
  };


  const allScenarioRoles = useMemo(() => {
    return currentScenario?.humanRolesConfig || [];
  }, [currentScenario]);
  
  const isLoadingInitialPageData = isLoadingSessionData || isLoadingScenario;

  if (isLoadingInitialPageData && !accessError) {
    return <LoadingScreen text="Sitzungs- und Szenariodaten werden geladen..." />;
  }
  
  if (accessError) {
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
            <CardDescription>Schritt 1: Gib deine Namen ein.</CardDescription>
          </CardHeader>
          <form onSubmit={handleNameSubmit}>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="realName">Dein Klarname (nur für Admin sichtbar)</Label>
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
         <Link href={`/join/${sessionId}?token=${urlToken}`} onClick={(e)=>{e.preventDefault(); setJoinStep("nameInput");}} className="absolute top-4 left-4 sm:top-8 sm:left-8" aria-label="Zurück zur Namenseingabe">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-6 w-6" /></Button>
        </Link>
        <Card className="w-full max-w-3xl">
          <CardHeader>
            <CardTitle className="text-2xl text-primary">Rollenauswahl: {currentScenario?.title}</CardTitle>
            <CardDescription>Schritt 2: Wähle deine Rolle für die Simulation. Dein Nickname ist <span className="font-semibold">{displayName}</span>.</CardDescription>
             <div className="mt-2">
                <Label htmlFor="displayNameChange" className="text-xs">Nickname ändern:</Label>
                <Input id="displayNameChange" type="text" value={displayName} onChange={(e) => handleDisplayNameChange(e.target.value)} className="h-8 text-sm" disabled={isProcessingRole}/>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {sessionData?.roleSelectionLocked && (
              <Alert variant="default" className="bg-yellow-500/10 border-yellow-500 text-yellow-700">
                <Info className="h-4 w-4 !text-yellow-700" />
                <AlertTitle>Rollenauswahl gesperrt</AlertTitle>
                <AlertDescription>Die Rollenauswahl wurde vom Administrator gesperrt. Deine aktuelle Auswahl (falls vorhanden) bleibt bestehen.</AlertDescription>
              </Alert>
            )}
            {isLoadingParticipants && <div className="text-sm text-muted-foreground flex items-center py-4"><Loader2 className="h-4 w-4 animate-spin mr-2"/> Lade aktuelle Rollenbelegungen...</div>}
            {!isLoadingParticipants && allScenarioRoles.length === 0 && <p className="text-sm text-muted-foreground py-4">Für dieses Szenario sind keine Rollen definiert.</p>}
            
            <ScrollArea className="h-[calc(100vh-350px)] min-h-[200px] pr-3">
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {allScenarioRoles.map((role) => {
                        const participantsInThisRole = sessionParticipants.filter(p => p.roleId === role.id);
                        const isSelectedByCurrentUser = selectedRoleId === role.id;

                        return (
                            <Card
                                key={role.id} // Use unique role.id as key
                                className={cn(
                                "cursor-pointer transition-all hover:shadow-lg flex flex-col justify-between",
                                isSelectedByCurrentUser ? "ring-2 ring-primary shadow-primary/30" : "ring-1 ring-border",
                                (sessionData?.roleSelectionLocked && selectedRoleId && selectedRoleId !== role.id) ? "opacity-60 cursor-not-allowed" : ""
                                )}
                                onClick={() => handleRoleSelection(role.id)}
                            >
                                <CardHeader className="pb-2 pt-3">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-base">{role.name}</CardTitle>
                                        {isSelectedByCurrentUser && <UserCheck className="h-5 w-5 text-primary" />}
                                         <Dialog>
                                            <DialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => e.stopPropagation()}><Info className="h-4 w-4"/></Button>
                                            </DialogTrigger>
                                            <DialogContent className="sm:max-w-md">
                                                <DialogHeader>
                                                <DialogTitle>{role.name} - Rollenbeschreibung</DialogTitle>
                                                <DialogDescription className="max-h-[60vh] overflow-y-auto py-2">
                                                    <ScrollArea className="max-h-[55vh]">
                                                        <pre className="whitespace-pre-wrap text-sm">{role.description}</pre>
                                                    </ScrollArea>
                                                </DialogDescription>
                                                </DialogHeader>
                                                <DialogClose asChild><Button type="button" variant="secondary" className="mt-2">Schließen</Button></DialogClose>
                                            </DialogContent>
                                        </Dialog>
                                    </div>
                                </CardHeader>
                                <CardContent className="text-xs text-muted-foreground space-y-1 flex-grow pb-2">
                                    <p className="font-medium text-foreground mb-1 flex items-center text-xs"><UsersIcon className="h-3 w-3 mr-1.5"/>Belegt durch:</p>
                                    {isLoadingParticipants ? <Loader2 className="h-3 w-3 animate-spin"/> : 
                                        participantsInThisRole.length > 0 ? (
                                        <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                                            {participantsInThisRole.map(p => <Badge key={p.id} variant="secondary" className="text-xs">{p.displayName}</Badge>)}
                                        </div>
                                    ) : (
                                        <p className="text-xs italic">Noch frei</p>
                                    )}
                                    {isSelectedByCurrentUser && displayName.trim() && !participantsInThisRole.find(p => p.displayName === displayName.trim()) && (
                                        <div className="mt-1 pt-1 border-t border-dashed">
                                            <Badge variant="default" className="text-xs bg-primary/20 text-primary border-primary/50">Du: {displayName.trim()}</Badge>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </ScrollArea>
          </CardContent>
          <CardFooter>
              <Button onClick={handleConfirmRoleAndGoToWaitingRoom} className="w-full" disabled={isProcessingRole || !selectedRoleId}>
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
                    <div className="relative h-24 w-24">
                        <svg className="transform -rotate-90" viewBox="0 0 120 120">
                            <circle cx="60" cy="60" r="54" fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
                            <circle
                            cx="60"
                            cy="60"
                            r="54"
                            fill="none"
                            stroke="hsl(var(--primary))"
                            strokeWidth="8"
                            strokeDasharray={`${(countdownSeconds / 10) * 2 * Math.PI * 54} ${2 * Math.PI * 54}`} 
                            strokeLinecap="round"
                            className="transition-all duration-1000 ease-linear"
                            />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center text-3xl font-bold text-primary">
                            {countdownSeconds}
                        </div>
                    </div>
                ) : countdownSeconds === 0 || sessionData?.status === 'active' ? (
                    <CheckCircle className="h-20 w-20 text-green-500" />
                ) : (
                    <Clock className="h-20 w-20 text-primary animate-pulse" />
                )}
            </div>
            <CardTitle className="text-2xl text-primary">
              Wartebereich: {currentScenario?.title || "Szenario"}
            </CardTitle>
            <CardDescription>
              Du bist erfolgreich der Simulation beigetreten!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-center">
            <p>Dein Nickname: <span className="font-semibold">{displayName}</span></p>
            <p>Deine Rolle: <span className="font-semibold">{roleNameForWaitingRoom}</span></p>
            {roleDescForWaitingRoom && (
                <div className="mt-2 p-3 bg-muted/50 rounded-md text-sm text-left max-h-40 overflow-y-auto">
                    <p className="font-medium mb-1">Rollenbeschreibung:</p>
                    <ScrollArea className="max-h-[100px] text-xs"><p className="whitespace-pre-wrap">{roleDescForWaitingRoom}</p></ScrollArea>
                </div>
            )}
            <div className="pt-3 text-muted-foreground">
                {countdownSeconds !== null && countdownSeconds > 0 && sessionData?.status !== 'active' ? (
                    <p>Simulation startet in Kürze automatisch...</p>
                ) : countdownSeconds === 0 || sessionData?.status === 'active' ? (
                    <p className="flex items-center justify-center"><Loader2 className="h-5 w-5 mr-2 animate-spin text-green-500"/>Simulation startet jetzt oder läuft bereits. Du wirst weitergeleitet...</p>
                ) : (
                    <p className="flex items-center justify-center"><Loader2 className="h-5 w-5 mr-2 animate-spin"/>Bitte warte, bis der Administrator die Simulation startet...</p>
                )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fallback, sollte nicht erreicht werden, wenn Logik stimmt
  return <LoadingScreen text="Lade Beitritts-Status..." />;
}
