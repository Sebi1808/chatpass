
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
import { doc, getDoc, collection, addDoc, serverTimestamp, query, where, getDocs, Timestamp, onSnapshot, updateDoc } from "firebase/firestore";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useSessionData } from "@/hooks/use-session-data";
import { createDefaultScenario } from '@/app/admin/scenario-editor/[scenarioId]/page';

type JoinStep = "nameInput" | "roleSelection" | "waitingRoom";

export default function JoinSessionPage() {
  const router = useRouter();
  const params = useParams();
  const searchParamsHook = useSearchParams(); // Renamed to avoid conflict with window.searchParams
  const { toast } = useToast();

  const sessionId = params.sessionId as string;
  const urlToken = searchParamsHook.get("token");

  const [step, setStep] = useState<JoinStep>("nameInput");
  const [realName, setRealName] = useState(""); // Klarname
  const [displayName, setDisplayName] = useState(""); // Nickname
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);

  const [currentScenario, setCurrentScenario] = useState<Scenario | null>(null);
  const { sessionData, isLoading: isLoadingSession, error: sessionErrorHook } = useSessionData(sessionId);
  
  const [sessionParticipants, setSessionParticipants] = useState<Participant[]>([]);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(true);
  const [isLoadingScenario, setIsLoadingScenario] = useState(true);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [userHasJoined, setUserHasJoined] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);
  const [joinedParticipantData, setJoinedParticipantData] = useState<Participant | null>(null);


  useEffect(() => {
    if (sessionErrorHook) {
      setAccessError(sessionErrorHook);
      setIsLoadingScenario(false);
      setIsLoadingParticipants(false);
    }
  }, [sessionErrorHook]);

  // Effect to load session data and scenario, and validate access
  useEffect(() => {
    if (!sessionId) {
      setAccessError("Keine Sitzungs-ID im Link gefunden.");
      setIsLoadingScenario(false);
      setIsLoadingParticipants(false);
      return;
    }

    if (isLoadingSession) return;

    if (!sessionData) {
      if (!sessionErrorHook) { // Only set generic error if no specific hook error
        setAccessError("Sitzungsdaten konnten nicht geladen werden oder Sitzung ist ungültig.");
      }
      setIsLoadingScenario(false);
      setIsLoadingParticipants(false);
      return;
    }
    
    if (!urlToken || sessionData.invitationToken !== urlToken) {
        setAccessError("Ungültiger oder abgelaufener Einladungslink.");
        setIsLoadingScenario(false); setIsLoadingParticipants(false); return;
    }

    // Check if user has already joined this session
    const storedUserId = localStorage.getItem(`chatUser_${sessionId}_userId`);
    const storedRoleName = localStorage.getItem(`chatUser_${sessionId}_role`);
    if (storedUserId && storedRoleName && sessionData.status === "active") {
        // User has joined before, session is active, redirect to chat
        router.push(`/chat/${sessionId}`);
        return; 
    }
     if (storedUserId && storedRoleName && sessionData.status === "open" && step !== "waitingRoom") {
        // User has joined, session is open, should be in waiting room
        setRealName(localStorage.getItem(`chatUser_${sessionId}_realName`) || "");
        setDisplayName(localStorage.getItem(`chatUser_${sessionId}_displayName`) || "");
        const roleConfig = currentScenario?.humanRolesConfig?.find(r => r.name === storedRoleName);
        if (roleConfig) setSelectedRoleId(roleConfig.id);
        setStep("waitingRoom");
        setUserHasJoined(true); 
    }


    if (sessionData.status === "pending") {
        setAccessError("Der Administrator bereitet die Sitzung vor. Bitte warte einen Moment.");
        setIsLoadingScenario(false); setIsLoadingParticipants(false); return;
    }
    if (sessionData.status === "active" && !storedUserId) { // New user trying to join active session
        setAccessError("Diese Simulation läuft bereits. Ein neuer Beitritt ist nicht möglich.");
        setIsLoadingScenario(false); setIsLoadingParticipants(false); return;
    }
     if (sessionData.status === "ended") {
        setAccessError("Diese Sitzung wurde bereits beendet.");
        setIsLoadingScenario(false); setIsLoadingParticipants(false); return;
    }
    if (sessionData.status === "paused") {
        setAccessError("Diese Sitzung ist aktuell pausiert. Ein Beitritt ist momentan nicht möglich.");
        setIsLoadingScenario(false); setIsLoadingParticipants(false); return;
    }

    // Load scenario only if session status is 'open' (or user has already joined and is in waiting room)
    if (sessionData.status !== "open" && !(userHasJoined && step === 'waitingRoom')) {
        if (sessionData.status !== "pending" && sessionData.status !== "active") { // Avoid error if already handled
            setAccessError(`Sitzungsstatus "${sessionData.status}" erlaubt keinen Beitritt oder Wartebereich.`);
        }
        setIsLoadingScenario(false); setIsLoadingParticipants(false); return;
    }

    if (!sessionData.scenarioId) {
      setAccessError("Szenario-Referenz in Sitzungsdaten fehlt.");
      setCurrentScenario(null); setIsLoadingScenario(false);
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
          if ((!scenario.humanRolesConfig || scenario.humanRolesConfig.length === 0) && step === 'roleSelection') {
            setAccessError("Für dieses Szenario sind keine Teilnehmerrollen definiert.");
          } else {
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
  }, [sessionId, sessionData, urlToken, isLoadingSession, sessionErrorHook, router, userHasJoined, step, currentScenario?.humanRolesConfig]);


  // Effect to load participants for role selection and waiting room
  useEffect(() => {
    if (!sessionId || accessError || !currentScenario || (step !== 'roleSelection' && step !== 'waitingRoom')) {
      setIsLoadingParticipants(false);
      if(step !== 'nameInput') setSessionParticipants([]); // Clear if not in name input and prerequisites fail
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
  }, [sessionId, toast, accessError, currentScenario, step]);

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
        if (sessionData.status === "active" || remainingMillis <= -3000) { // Allow a bit of leeway for status update
            toast({ title: "Simulation gestartet!", description: "Du wirst zum Chat weitergeleitet." });
            router.push(`/chat/${sessionId}`);
        } else {
            // Still waiting for admin to fully set status to active
            // console.log("Countdown ended, but session not yet active by admin. Waiting...");
        }
      } else {
        setCountdownSeconds(Math.ceil(remainingMillis / 1000));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [step, sessionData, sessionId, router, toast]);

   // Effect to listen for direct session status change to "active" while in waiting room
  useEffect(() => {
    if (step === "waitingRoom" && sessionId) {
      const sessionDocRef = doc(db, "sessions", sessionId);
      const unsubscribe = onSnapshot(sessionDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const updatedSessionData = docSnap.data() as SessionData;
          if (updatedSessionData.status === "active") {
            if (countdownSeconds !== 0) { // Avoid double toast if countdown already handled it
                 toast({title: "Simulation gestartet!", description: "Du wirst zum Chat weitergeleitet."});
            }
            router.push(`/chat/${sessionId}`);
          } else if (updatedSessionData.status === "ended" || updatedSessionData.status === "paused") {
            setAccessError(`Die Sitzung wurde vom Administrator ${updatedSessionData.status === "ended" ? "beendet" : "pausiert"}.`);
            setStep("nameInput"); // Or some other appropriate step
            setUserHasJoined(false);
          }
        }
      });
      return () => unsubscribe();
    }
  }, [step, sessionId, router, toast, countdownSeconds]);


  const handleNameSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!realName.trim()) {
      toast({ variant: "destructive", title: "Fehler", description: "Bitte Klarnamen eingeben." }); return;
    }
    if (!displayName.trim()) {
      toast({ variant: "destructive", title: "Fehler", description: "Bitte Nicknamen eingeben." }); return;
    }
    localStorage.setItem(`chatUser_${sessionId}_realName`, realName.trim());
    localStorage.setItem(`chatUser_${sessionId}_displayName`, displayName.trim());
    setStep("roleSelection");
  };

  const handleRoleSelectionSubmit = async () => {
    if (!selectedRoleId) {
      toast({ variant: "destructive", title: "Fehler", description: "Bitte Rolle wählen." }); return;
    }
    if (!sessionData || !currentScenario || sessionData.status !== "open") {
      toast({ variant: "destructive", title: "Fehler", description: "Beitritt nicht möglich (Sitzungsstatus nicht 'open')." });
      setAccessError("Beitritt nicht möglich. Die Sitzung ist möglicherweise nicht mehr für den Beitritt geöffnet.");
      return;
    }
    if (sessionData.roleSelectionLocked) {
        toast({ variant: "destructive", title: "Rollenauswahl gesperrt", description: "Die Rollenauswahl wurde vom Administrator gesperrt." });
        setAccessError("Die Rollenauswahl wurde vom Administrator gesperrt.");
        return;
    }
    
    setIsSubmitting(true);
    const storedRealName = localStorage.getItem(`chatUser_${sessionId}_realName`) || realName;
    const storedDisplayName = localStorage.getItem(`chatUser_${sessionId}_displayName`) || displayName;

    if (!storedRealName || !storedDisplayName) {
        toast({ variant: "destructive", title: "Fehler", description: "Namen nicht gefunden. Bitte kehre zum ersten Schritt zurück." });
        setStep("nameInput");
        setIsSubmitting(false);
        return;
    }

    const userIdGenerated = `user-${storedDisplayName.replace(/\s+/g, '-').toLowerCase().substring(0,10)}-${Date.now().toString().slice(-5)}`;
    const avatarFallback = storedDisplayName.substring(0, 2).toUpperCase() || "XX";
    const selectedRoleConfig = currentScenario.humanRolesConfig?.find(role => role.id === selectedRoleId);

    if (!selectedRoleConfig) {
        toast({ variant: "destructive", title: "Fehler", description: "Ausgewählte Rolle nicht gefunden." });
        setIsSubmitting(false); return;
    }

    try {
      const participantsColRef = collection(db, "sessions", sessionId, "participants");
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
      setJoinedParticipantData({ ...newParticipantData, id: participantDocRef.id });

      localStorage.setItem(`chatUser_${sessionId}_role`, selectedRoleConfig.name);
      localStorage.setItem(`chatUser_${sessionId}_userId`, userIdGenerated);
      localStorage.setItem(`chatUser_${sessionId}_avatarFallback`, avatarFallback);
      
      setUserHasJoined(true);
      setStep("waitingRoom");
      toast({
        title: "Wartebereich beigetreten",
        description: `Du bist als ${storedDisplayName} (${selectedRoleConfig.name}) beigetreten. Warte auf den Start der Simulation.`,
      });

    } catch (error) {
      console.error("Error adding participant to Firestore: ", error);
      toast({ variant: "destructive", title: "Fehler", description: "Beitritt fehlgeschlagen." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const allScenarioRoles = useMemo(() => {
    return currentScenario?.humanRolesConfig || [];
  }, [currentScenario]);
  
  const selectedRoleDetails = useMemo(() => {
    if (!selectedRoleId || !currentScenario?.humanRolesConfig) return null;
    return currentScenario.humanRolesConfig.find(r => r.id === selectedRoleId);
  }, [selectedRoleId, currentScenario?.humanRolesConfig]);


  const isLoadingPage = isLoadingSession || isLoadingScenario || (step === "roleSelection" && isLoadingParticipants);
  
  const disableForm = isSubmitting || !!accessError || !currentScenario || (step === "roleSelection" && (!allScenarioRoles || allScenarioRoles.length === 0)) || sessionData?.status !== "open";

  if (isLoadingPage && !accessError) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="flex items-center"><Loader2 className="h-5 w-5 animate-spin mr-2 text-primary"/> Sitzung wird geladen...</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">Die Details zur Sitzung werden abgerufen. Bitte haben Sie einen Moment Geduld.</p>
                    <Progress value={50} className="w-full mt-4 h-2" />
                </CardContent>
            </Card>
        </div>
    );
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
            <p>Dein Nickname: <span className="font-semibold">{displayName || localStorage.getItem(`chatUser_${sessionId}_displayName`)}</span></p>
            <p>Deine Rolle: <span className="font-semibold">{selectedRoleDetails?.name || localStorage.getItem(`chatUser_${sessionId}_role`)}</span></p>
            {selectedRoleDetails?.description && (
                <div className="mt-2 p-3 bg-muted/50 rounded-md text-sm text-left">
                    <p className="font-medium mb-1">Rollenbeschreibung:</p>
                    <ScrollArea className="h-[100px]"><p>{selectedRoleDetails.description}</p></ScrollArea>
                </div>
            )}
            <div className="flex items-center justify-center text-muted-foreground pt-4">
                {countdownSeconds !== null && countdownSeconds > 0 ? (
                    <>
                        <Clock className="h-5 w-5 mr-2 text-primary"/>
                        <p>Simulation startet in <span className="font-bold text-primary">{countdownSeconds}</span> Sekunden...</p>
                    </>
                ) : countdownSeconds === 0 ? (
                     <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin text-primary"/>
                        <p>Simulation startet jetzt...</p>
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
            {step === "nameInput" && " Bitte gib zuerst deinen Namen und Nickname ein."}
            {step === "roleSelection" && currentScenario && " Wähle nun eine Rolle für die Simulation."}
          </CardDescription>
        </CardHeader>
        
        {step === "nameInput" && (
          <form onSubmit={handleNameSubmit}>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="realName">Ihr Klarname (für Admin sichtbar)</Label>
                <Input
                  id="realName" type="text" placeholder="Max Mustermann"
                  value={realName} onChange={(e) => setRealName(e.target.value)}
                  required disabled={isSubmitting || sessionData?.status !== 'open'}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="displayName">Ihr Nickname (im Chat sichtbar)</Label>
                <Input
                  id="displayName" type="text" placeholder="MaxPower99"
                  value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                  required disabled={isSubmitting || sessionData?.status !== 'open'}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={isSubmitting || !realName.trim() || !displayName.trim() || sessionData?.status !== 'open'}>
                {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <LogIn className="mr-2 h-5 w-5" />}
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
                      <AlertDescription>Die Rollenauswahl wurde vom Administrator gesperrt. Deine aktuelle Auswahl (falls vorhanden) bleibt bestehen.</AlertDescription>
                  </Alert>
              )}
              <div className="space-y-2">
                <Label>Wähle deine Rolle (Klarname: {realName}, Nickname: {displayName})</Label>
                {isLoadingParticipants && <div className="text-sm text-muted-foreground flex items-center"><Loader2 className="h-4 w-4 animate-spin mr-2"/> Lade aktuelle Teilnehmer...</div>}
                {!isLoadingParticipants && allScenarioRoles.length === 0 && (
                    <p className="text-sm text-muted-foreground">Für dieses Szenario sind keine Rollen definiert.</p>
                )}
                <ScrollArea className="h-[350px] md:h-[400px] rounded-md border p-1">
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
                                    sessionData?.roleSelectionLocked && !isSelectedByCurrentUser ? "opacity-50 cursor-not-allowed" : ""
                                    )}
                                    onClick={() => !(sessionData?.roleSelectionLocked && !isSelectedByCurrentUser) && setSelectedRoleId(role.id)}
                                >
                                    <CardHeader className="pb-2 pt-3">
                                        <CardTitle className="text-base flex items-center justify-between">
                                            {role.name}
                                            {isSelectedByCurrentUser && <UserCheck className="h-5 w-5 text-primary" />}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="text-xs text-muted-foreground space-y-1 flex-grow pb-3">
                                        <ScrollArea className="h-[60px] pr-2"><p>{role.description}</p></ScrollArea>
                                        
                                        {participantsInThisRole.length > 0 && (
                                          <div className="mt-2 pt-2 border-t">
                                            <p className="text-xs font-medium text-foreground mb-1 flex items-center"><Users2 className="h-3 w-3 mr-1.5"/>Belegt durch:</p>
                                            <div className="flex flex-wrap gap-1">
                                                {participantsInThisRole.map(p => <Badge key={p.userId} variant="secondary" className="text-xs">{p.displayName}</Badge>)}
                                            </div>
                                          </div>
                                        )}
                                         {isSelectedByCurrentUser && displayName.trim() && (
                                            <div className="mt-1 pt-1 border-t border-dashed">
                                                <Badge variant="default" className="text-xs bg-primary/20 text-primary border-primary/50">
                                                    Du: {displayName.trim()}
                                                </Badge>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </ScrollArea>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleRoleSelectionSubmit} className="w-full" disabled={disableForm || !selectedRoleId || sessionData?.roleSelectionLocked}>
                {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <LogIn className="mr-2 h-5 w-5" />}
                Bestätigen und zum Wartebereich
              </Button>
            </CardFooter>
          </>
        )}
      </Card>
    </div>
  );
}
