
"use client";

import { useState, useEffect, type FormEvent, useMemo, useCallback } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Scenario, SessionData, Participant, HumanRoleConfig } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, LogIn, AlertTriangle, Loader2, UserCheck, Info, Users, CheckCircle, Clock, Users2 } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, addDoc, serverTimestamp, query, where, getDocs, Timestamp, onSnapshot, updateDoc, runTransaction } from "firebase/firestore";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useSessionData } from "@/hooks/use-session-data";
import { createDefaultScenario } from '@/app/admin/scenario-editor/[scenarioId]/page'; // Import helper

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


export default function JoinSessionPage() {
  const router = useRouter();
  const params = useParams();
  const searchParamsHook = useSearchParams();
  const { toast } = useToast();

  const sessionId = params.sessionId as string;
  const urlToken = searchParamsHook.get("token");
  const initialStep = (searchParamsHook.get("step") as JoinStep) || "nameInput";

  const [step, setStep] = useState<JoinStep>(initialStep);
  
  const [realName, setRealName] = useState("");
  const [displayName, setDisplayName] = useState(""); // Nickname
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);

  const [currentScenario, setCurrentScenario] = useState<Scenario | null>(null);
  const { sessionData, isLoading: isLoadingSessionHook, error: sessionErrorHook } = useSessionData(sessionId);
  
  const [sessionParticipants, setSessionParticipants] = useState<Participant[]>([]);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(true);
  const [isLoadingScenario, setIsLoadingScenario] = useState(true); 
  
  const [isSubmittingName, setIsSubmittingName] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const [accessError, setAccessError] = useState<string | null>(null);
  const [userHasJoined, setUserHasJoined] = useState(false); // Tracks if current browser session has joined this Firestore session
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);
  const [joinedParticipantData, setJoinedParticipantData] = useState<Participant | null>(null);


  useEffect(() => {
    if (sessionErrorHook) {
      setAccessError(sessionErrorHook);
    }
  }, [sessionErrorHook]);

  // Effect to load scenario details once sessionData is available
  useEffect(() => {
    if (!sessionData || !sessionData.scenarioId) {
      if (!isLoadingSessionHook && !sessionData && !sessionErrorHook) {
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
  }, [sessionData, isLoadingSessionHook, sessionErrorHook]);

  // Check if user already joined this session (from localStorage)
  useEffect(() => {
    if (!sessionId) return;
    const storedUserId = localStorage.getItem(`chatUser_${sessionId}_userId`);
    const storedRoleName = localStorage.getItem(`chatUser_${sessionId}_role`);
    const storedDisplayName = localStorage.getItem(`chatUser_${sessionId}_displayName`);
    const storedRealName = localStorage.getItem(`chatUser_${sessionId}_realName`);

    if (storedUserId && storedRoleName && storedDisplayName && storedRealName) {
      setUserHasJoined(true); // Indicates this browser has credentials
      setRealName(storedRealName);
      setDisplayName(storedDisplayName);
      setJoinedParticipantData(prev => prev || { // Keep existing if already set by join logic
          id: storedUserId, // This is actually the participant doc ID if we had it, using userId for now
          userId: storedUserId,
          realName: storedRealName,
          displayName: storedDisplayName,
          role: storedRoleName,
          avatarFallback: storedDisplayName.substring(0,2).toUpperCase() || "XX",
          isBot: false,
      });
      // If user has joined and is not in nameInput step, try to find their role in current scenario
      if (step !== "nameInput" && currentScenario?.humanRolesConfig) {
        const roleConfig = currentScenario.humanRolesConfig.find(r => r.name === storedRoleName);
        if (roleConfig) setSelectedRoleId(roleConfig.id);
      }
    }
  }, [sessionId, currentScenario, step]);


  // Effect to validate access based on session status and token
  useEffect(() => {
    if (isLoadingSessionHook || isLoadingScenario) return; // Wait for initial data

    if (!sessionData || !urlToken || sessionData.invitationToken !== urlToken) {
      if (!accessError) { // Only set if no more specific error exists
           setAccessError("Ungültiger oder abgelaufener Einladungslink.");
      }
      return;
    }
    
    // Check if a user from this browser has already joined this session
    // If so, and the session is open, they should go to/stay in the waiting room
    // If the session is active, they should be redirected to chat
    if (userHasJoined) {
        if (sessionData.status === "active") {
            router.push(`/chat/${sessionId}`);
            return;
        } else if (sessionData.status === "open" && step !== "waitingRoom") {
             if (step !== 'nameInput' || (localStorage.getItem(`chatUser_${sessionId}_role`) && selectedRoleId)) {
                setStep("waitingRoom");
             } // else stay in name input or role selection if they backed out
        }
    }
    
    if (sessionData.status === "pending") {
        setAccessError("Der Administrator bereitet die Sitzung vor. Bitte warte einen Moment oder versuche es später erneut.");
    } else if (sessionData.status === "active" && !userHasJoined) { 
        setAccessError("Diese Simulation läuft bereits. Ein neuer Beitritt ist nicht möglich.");
    } else if (sessionData.status === "ended") {
        setAccessError("Diese Sitzung wurde bereits beendet.");
    } else if (sessionData.status === "paused") {
        setAccessError("Diese Sitzung ist aktuell pausiert. Ein Beitritt ist momentan nicht möglich.");
    } else if (sessionData.status === "open" && !currentScenario?.humanRolesConfig?.length && step === 'roleSelection') {
        setAccessError("Für dieses Szenario sind keine Teilnehmerrollen definiert.");
    } else {
       if (accessError && (accessError.includes("Ungültiger oder abgelaufener Einladungslink.") || accessError.includes("Sitzungsdaten nicht gefunden")) ) {
         // Don't clear these specific errors
       } else {
         setAccessError(null); // Clear other errors if conditions are met for join
       }
    }
  }, [sessionId, sessionData, urlToken, userHasJoined, currentScenario, step, router, accessError, isLoadingSessionHook, isLoadingScenario]);


  // Effect to load participants for role selection and waiting room
  useEffect(() => {
    if (!sessionId || !currentScenario || (step !== 'roleSelection' && step !== 'waitingRoom')) {
      setIsLoadingParticipants(false);
      if (step !== 'nameInput' && step !== 'waitingRoom') setSessionParticipants([]);
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
      toast({ variant: "destructive", title: "Fehler", description: "Teilnehmerdaten konnten nicht geladen werden." });
      setIsLoadingParticipants(false);
      setSessionParticipants([]);
    });
    return () => unsubscribe();
  }, [sessionId, toast, currentScenario, step]);


  // Effect for countdown and redirection from waiting room
  useEffect(() => {
    if (step !== "waitingRoom" || !sessionData?.simulationStartCountdownEndTime) {
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
         // The redirection to chat is now handled by the session status listener below
      } else {
        setCountdownSeconds(Math.ceil(remainingMillis / 1000));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [step, sessionData, sessionId, router, toast]);

   // Effect to listen for session status change to "active" while in waiting room (or any step if already joined)
  useEffect(() => {
    if ((step === "waitingRoom" || userHasJoined) && sessionId && sessionData) {
      if (sessionData.status === "active") {
        if (countdownSeconds !== 0 && step === "waitingRoom") { 
            toast({title: "Simulation gestartet!", description: "Du wirst zum Chat weitergeleitet."});
        } else if (step !== "waitingRoom" && userHasJoined) { // User re-opened join page while session became active
             toast({title: "Simulation läuft bereits!", description: "Du wirst zum Chat weitergeleitet."});
        }
        router.push(`/chat/${sessionId}`);
      } else if ((sessionData.status === "ended" || sessionData.status === "paused") && step === "waitingRoom") {
        setAccessError(`Die Sitzung wurde vom Administrator ${sessionData.status === "ended" ? "beendet" : "pausiert"}.`);
        // Consider resetting step to 'nameInput' or showing a specific "session ended/paused" message
        // For now, accessError will be displayed.
      }
    }
  }, [step, sessionId, sessionData, userHasJoined, router, toast, countdownSeconds]);


  const handleNameSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmittingName(true);
    if (!realName.trim()) {
      toast({ variant: "destructive", title: "Fehler", description: "Bitte Klarnamen eingeben." });
      setIsSubmittingName(false);
      return;
    }
    if (!displayName.trim()) {
      toast({ variant: "destructive", title: "Fehler", description: "Bitte Nicknamen eingeben." });
      setIsSubmittingName(false);
      return;
    }
    localStorage.setItem(`chatUser_${sessionId}_realName`, realName.trim());
    localStorage.setItem(`chatUser_${sessionId}_displayName`, displayName.trim());
    router.push(`/join/${sessionId}?token=${urlToken}&step=roleSelection`, { scroll: false });
    setStep("roleSelection");
    setIsSubmittingName(false);
  };

  const handleRoleSelection = (roleId: string) => {
    if (sessionData?.roleSelectionLocked) {
        toast({ variant: "default", title: "Rollenauswahl gesperrt", description: "Die Rollenauswahl wurde vom Administrator gesperrt.", className: "bg-yellow-500/10 border-yellow-500"});
        return;
    }
    setSelectedRoleId(roleId);
  };
  
  const handleJoinSession = async () => {
    if (!selectedRoleId) {
      toast({ variant: "destructive", title: "Fehler", description: "Bitte eine Rolle wählen." }); return;
    }
    if (!sessionData || !currentScenario || sessionData.status !== "open") {
      toast({ variant: "destructive", title: "Fehler", description: "Beitritt nicht möglich (Sitzungsstatus nicht 'open' oder Szenario nicht geladen)." });
      setAccessError("Beitritt nicht möglich. Die Sitzung ist möglicherweise nicht mehr für den Beitritt geöffnet oder das Szenario fehlt.");
      return;
    }
     if (sessionData.roleSelectionLocked) {
        toast({ variant: "default", title: "Rollenauswahl gesperrt", description: "Die Rollenauswahl wurde vom Administrator gesperrt. Deine aktuelle Auswahl kann nicht geändert werden.", className: "bg-yellow-500/10 border-yellow-500"});
        // Allow proceeding if they already selected a role before lock.
        // This needs careful handling if they somehow get to this point without selectedRoleId set.
        // For now, if they have a selectedRoleId, they can try to join.
        // More robust logic would be to disable the "Confirm and Join" button if locked and no role selected.
    }
    
    setIsJoining(true);
    const storedRealName = localStorage.getItem(`chatUser_${sessionId}_realName`) || realName;
    const storedDisplayName = localStorage.getItem(`chatUser_${sessionId}_displayName`) || displayName;

    if (!storedRealName || !storedDisplayName) {
        toast({ variant: "destructive", title: "Fehler", description: "Namen nicht im Speicher gefunden. Bitte kehre zum ersten Schritt zurück." });
        router.push(`/join/${sessionId}?token=${urlToken}&step=nameInput`, { scroll: false });
        setStep("nameInput");
        setIsJoining(false);
        return;
    }

    const userIdGenerated = localStorage.getItem(`chatUser_${sessionId}_userId`) || `user-${storedDisplayName.replace(/\s+/g, '-').toLowerCase().substring(0,10)}-${Date.now().toString().slice(-5)}`;
    const avatarFallback = storedDisplayName.substring(0, 2).toUpperCase() || "XX";
    const selectedRoleConfig = currentScenario.humanRolesConfig?.find(role => role.id === selectedRoleId);

    if (!selectedRoleConfig) {
        toast({ variant: "destructive", title: "Fehler", description: "Ausgewählte Rolle nicht gefunden." });
        setIsJoining(false); return;
    }

    try {
      // Check if user with this userId already exists in this session's participants
      const participantsColRef = collection(db, "sessions", sessionId, "participants");
      const qUser = query(participantsColRef, where("userId", "==", userIdGenerated));
      const userSnap = await getDocs(qUser);

      let participantDocId: string;

      if (!userSnap.empty) { // User already exists, update their role if different
        participantDocId = userSnap.docs[0].id;
        const existingParticipantData = userSnap.docs[0].data() as Participant;
        if (existingParticipantData.role !== selectedRoleConfig.name || existingParticipantData.displayName !== storedDisplayName || existingParticipantData.realName !== storedRealName) {
          await updateDoc(doc(participantsColRef, participantDocId), {
            role: selectedRoleConfig.name,
            displayName: storedDisplayName,
            realName: storedRealName,
            avatarFallback: avatarFallback,
            status: "Beigetreten", // Update status
            updatedAt: serverTimestamp() // Add an updated timestamp
          });
        }
         toast({ title: "Rollenauswahl aktualisiert", description: "Du bist nun im Wartebereich." });
      } else { // User does not exist, add new participant
        const newParticipantData: Omit<Participant, 'id' | 'botConfig' | 'botScenarioId'> = {
          realName: storedRealName, 
          displayName: storedDisplayName,
          role: selectedRoleConfig.name,
          userId: userIdGenerated,
          avatarFallback: avatarFallback,
          isBot: false,
          isMuted: false, 
          status: "Beigetreten",
          joinedAt: serverTimestamp() as Timestamp
        };
        const participantDocRef = await addDoc(participantsColRef, newParticipantData);
        participantDocId = participantDocRef.id;
        toast({ title: "Wartebereich beigetreten", description: `Du bist als ${storedDisplayName} (${selectedRoleConfig.name}) beigetreten.`});
      }
      
      setJoinedParticipantData({ 
          id: participantDocId, 
          userId: userIdGenerated, 
          realName: storedRealName, 
          displayName: storedDisplayName, 
          role: selectedRoleConfig.name, 
          avatarFallback, 
          isBot: false 
      });
      localStorage.setItem(`chatUser_${sessionId}_role`, selectedRoleConfig.name);
      localStorage.setItem(`chatUser_${sessionId}_userId`, userIdGenerated); // Ensure userId is stored
      localStorage.setItem(`chatUser_${sessionId}_avatarFallback`, avatarFallback);
      
      setUserHasJoined(true);
      router.push(`/join/${sessionId}?token=${urlToken}&step=waitingRoom`, { scroll: false });
      setStep("waitingRoom");

    } catch (error) {
      console.error("Error adding/updating participant in Firestore: ", error);
      toast({ variant: "destructive", title: "Fehler", description: "Beitritt fehlgeschlagen. Bitte versuche es erneut." });
    } finally {
      setIsJoining(false);
    }
  };

  const allScenarioRoles = useMemo(() => {
    return currentScenario?.humanRolesConfig || [];
  }, [currentScenario]);
  
  const selectedRoleDetails = useMemo(() => {
    if (!selectedRoleId || !currentScenario?.humanRolesConfig) return null;
    return currentScenario.humanRolesConfig.find(r => r.id === selectedRoleId);
  }, [selectedRoleId, currentScenario?.humanRolesConfig]);


  const isLoadingPage = isLoadingSessionHook || isLoadingScenario;

  if (isLoadingPage && !accessError) { // Only show main loading if no access error yet
    return <LoadingScreen text="Sitzung wird geladen..." />;
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

  if (step === "waitingRoom") {
    const roleNameToDisplay = joinedParticipantData?.role || localStorage.getItem(`chatUser_${sessionId}_role`) || "Unbekannt";
    const displayNameForWaitingRoom = joinedParticipantData?.displayName || localStorage.getItem(`chatUser_${sessionId}_displayName`) || "Teilnehmer";
    const roleDesc = currentScenario?.humanRolesConfig?.find(r => r.name === roleNameToDisplay)?.description || "Keine Rollenbeschreibung verfügbar.";

    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center text-primary">
              <CheckCircle className="h-6 w-6 mr-2" />
              Wartebereich: {currentScenario?.title || "Szenario"}
            </CardTitle>
            <CardDescription>
              Du bist erfolgreich der Simulation beigetreten!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p>Dein Nickname: <span className="font-semibold">{displayNameForWaitingRoom}</span></p>
            <p>Deine Rolle: <span className="font-semibold">{roleNameToDisplay}</span></p>
            {roleDesc && (
                <div className="mt-2 p-3 bg-muted/50 rounded-md text-sm text-left">
                    <p className="font-medium mb-1">Rollenbeschreibung:</p>
                    <ScrollArea className="h-[100px]"><p className="whitespace-pre-wrap">{roleDesc}</p></ScrollArea>
                </div>
            )}
            <div className="flex items-center justify-center text-muted-foreground pt-4">
                {countdownSeconds !== null && countdownSeconds > 0 && sessionData?.status !== 'active' ? (
                    <>
                        <Clock className="h-5 w-5 mr-2 text-primary"/>
                        <p>Simulation startet in <span className="font-bold text-primary">{countdownSeconds}</span> Sekunden...</p>
                    </>
                ) : countdownSeconds === 0 || sessionData?.status === 'active' ? (
                     <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin text-primary"/>
                        <p>Simulation startet jetzt oder läuft bereits. Du wirst weitergeleitet...</p>
                    </>
                ) : (
                    <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin"/>
                        <p>Bitte warte, bis der Administrator die Simulation startet...</p>
                    </>
                )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }


  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
      <Link href="/" className="absolute top-4 left-4 sm:top-8 sm:left-8" aria-label="Zur Startseite">
        <Button variant="ghost" size="icon">
          <ArrowLeft className="h-6 w-6" />
        </Button>
      </Link>
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl text-primary">
            Simulation beitreten: {currentScenario?.title || (isLoadingScenario ? "Szenario-Titel lädt..." : "Unbekanntes Szenario")}
          </CardTitle>
          <CardDescription>
            Sitzungs-ID: <span className="font-mono text-xs">{sessionId}</span>
            {step === "nameInput" && " Bitte gib zuerst deinen Klarnamen und Nicknamen ein."}
            {step === "roleSelection" && currentScenario && " Wähle nun eine Rolle für die Simulation."}
          </CardDescription>
        </CardHeader>
        
        {step === "nameInput" && (
          <form onSubmit={handleNameSubmit}>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="realName">Ihr Klarname (nur für Admin sichtbar)</Label>
                <Input
                  id="realName" type="text" placeholder="Max Mustermann"
                  value={realName} onChange={(e) => setRealName(e.target.value)}
                  required disabled={isSubmittingName || sessionData?.status !== 'open'}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="displayName">Ihr Nickname (im Chat sichtbar)</Label>
                <Input
                  id="displayName" type="text" placeholder="MaxPower99"
                  value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                  required disabled={isSubmittingName || sessionData?.status !== 'open'}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={isSubmittingName || !realName.trim() || !displayName.trim() || sessionData?.status !== 'open'}>
                {isSubmittingName ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <LogIn className="mr-2 h-5 w-5" />}
                Weiter zur Rollenauswahl
              </Button>
            </CardFooter>
          </form>
        )}

        {step === "roleSelection" && currentScenario && (
          <>
            <CardContent className="space-y-6">
              {sessionData?.roleSelectionLocked && (
                  <Alert variant="default" className="bg-yellow-500/10 border-yellow-500">
                      <Info className="h-4 w-4" />
                      <AlertTitle>Rollenauswahl gesperrt</AlertTitle>
                      <AlertDescription>Die Rollenauswahl wurde vom Administrator gesperrt. Deine aktuell ausgewählte Rolle (falls vorhanden) bleibt bestehen.</AlertDescription>
                  </Alert>
              )}
              <div>
                <Label className="block mb-2">Wähle deine Rolle:</Label>
                 <p className="text-sm text-muted-foreground mb-1">Klarname: <span className="font-medium">{realName}</span>, Nickname: <span className="font-medium">{displayName}</span></p>
                {isLoadingParticipants && <div className="text-sm text-muted-foreground flex items-center py-4"><Loader2 className="h-4 w-4 animate-spin mr-2"/> Lade aktuelle Teilnehmerbelegungen...</div>}
                {!isLoadingParticipants && allScenarioRoles.length === 0 && (
                    <p className="text-sm text-muted-foreground py-4">Für dieses Szenario sind keine Rollen definiert.</p>
                )}
                <ScrollArea className="h-[350px] md:h-[400px] rounded-md border p-1 -mx-1"> {/* Negative margin to counter CardContent padding */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-3">
                        {allScenarioRoles.map((role) => {
                            const participantsInThisRole = sessionParticipants.filter(p => p.role === role.name);
                            const isSelectedByCurrentUser = selectedRoleId === role.id;

                            return (
                                <Card
                                    key={role.id}
                                    className={cn(
                                    "cursor-pointer transition-all hover:shadow-lg flex flex-col",
                                    isSelectedByCurrentUser ? "ring-2 ring-primary shadow-primary/30" : "ring-1 ring-border",
                                    sessionData?.roleSelectionLocked && !isSelectedByCurrentUser ? "opacity-60 cursor-not-allowed" : ""
                                    )}
                                    onClick={() => handleRoleSelection(role.id)}
                                >
                                    <CardHeader className="pb-2 pt-3">
                                        <CardTitle className="text-base flex items-center justify-between">
                                            {role.name}
                                            {isSelectedByCurrentUser && <UserCheck className="h-5 w-5 text-primary" />}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="text-xs text-muted-foreground space-y-1 flex-grow pb-3">
                                        <ScrollArea className="h-[60px] pr-2"><p className="whitespace-pre-wrap">{role.description}</p></ScrollArea>
                                        
                                        <div className="mt-2 pt-2 border-t h-16 overflow-y-auto"> {/* Fixed height for taken by section */}
                                            <p className="text-xs font-medium text-foreground mb-1 flex items-center"><Users2 className="h-3 w-3 mr-1.5"/>Belegt durch:</p>
                                            {participantsInThisRole.length > 0 ? (
                                                <div className="flex flex-wrap gap-1">
                                                    {participantsInThisRole.map(p => <Badge key={p.id} variant="secondary" className="text-xs">{p.displayName}</Badge>)}
                                                </div>
                                            ) : (
                                                <p className="text-xs italic">Noch frei</p>
                                            )}
                                            {isSelectedByCurrentUser && displayName.trim() && !participantsInThisRole.find(p=>p.displayName === displayName) && ( // Only show if not already listed
                                                <div className="mt-1 pt-1 border-t border-dashed">
                                                    <Badge variant="default" className="text-xs bg-primary/20 text-primary border-primary/50">
                                                        Du: {displayName.trim()}
                                                    </Badge>
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </ScrollArea>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleJoinSession} className="w-full" disabled={isJoining || !selectedRoleId || (sessionData?.roleSelectionLocked && !selectedRoleDetails) || sessionData?.status !== 'open'}>
                {isJoining ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <LogIn className="mr-2 h-5 w-5" />}
                Bestätigen und zum Wartebereich
              </Button>
            </CardFooter>
          </>
        )}
      </Card>
    </div>
  );
}

