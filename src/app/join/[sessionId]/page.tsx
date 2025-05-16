
"use client";

import { useState, useEffect, type FormEvent, useMemo, useCallback } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Scenario, SessionData, Participant, HumanRoleConfig } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, LogIn, AlertTriangle, Loader2, UserCheck, Info, Users, CheckCircle, Clock } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, addDoc, serverTimestamp, query, where, getDocs, Timestamp, onSnapshot, updateDoc } from "firebase/firestore";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useSessionData } from "@/hooks/use-session-data";
// Helper function (can be moved to utils if used elsewhere)
export function createDefaultScenario(): Omit<Scenario, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    title: 'Neues Szenario',
    kurzbeschreibung: '',
    langbeschreibung: '',
    lernziele: '', // Changed from [] to ''
    iconName: 'ImageIconLucide', // Default icon
    tags: [],
    previewImageUrl: '',
    status: 'draft',
    defaultBotsConfig: [],
    humanRolesConfig: [],
    initialPost: {
      authorName: 'System',
      authorAvatarFallback: 'SY',
      content: '',
      imageUrl: '',
      platform: 'Generic',
    },
    events: [],
  };
}


export default function JoinSessionPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const sessionId = params.sessionId as string;
  const urlToken = searchParams.get("token");

  const [name, setName] = useState(""); // Klarname
  const [nickname, setNickname] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);

  const [currentScenario, setCurrentScenario] = useState<Scenario | null>(null);
  const { sessionData, isLoading: isLoadingSession, error: sessionErrorHook } = useSessionData(sessionId);
  
  const [sessionParticipants, setSessionParticipants] = useState<Participant[]>([]);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(true);
  const [isLoadingScenario, setIsLoadingScenario] = useState(true);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [hasJoined, setHasJoined] = useState(false); // New state for waiting room

  useEffect(() => {
    if (sessionErrorHook) {
      setAccessError(sessionErrorHook);
      setIsLoadingScenario(false);
      setIsLoadingParticipants(false);
    }
  }, [sessionErrorHook]);

  useEffect(() => {
    if (!sessionId) {
      setAccessError("Keine Sitzungs-ID im Link gefunden.");
      setIsLoadingScenario(false);
      setIsLoadingParticipants(false);
      return;
    }

    if (isLoadingSession) return;

    if (!sessionData) {
      if (!sessionErrorHook) {
        setAccessError("Sitzungsdaten konnten nicht geladen werden oder sind ungültig.");
      }
      setIsLoadingScenario(false);
      setIsLoadingParticipants(false);
      return;
    }
    
    if (!urlToken || sessionData.invitationToken !== urlToken) {
        setAccessError("Ungültiger oder abgelaufener Einladungslink.");
        setIsLoadingScenario(false); setIsLoadingParticipants(false); return;
    }

    // Specific status checks for joining
    if (sessionData.status === "pending") {
        setAccessError("Der Administrator bereitet die Sitzung vor. Bitte warte einen Moment.");
        setIsLoadingScenario(false); setIsLoadingParticipants(false); return;
    }
    if (sessionData.status === "active") {
        // Check if user has already joined THIS session, if so, redirect to chat
        const storedUserId = localStorage.getItem(`chatUser_${sessionId}_userId`);
        const storedRole = localStorage.getItem(`chatUser_${sessionId}_role`);
        if (storedUserId && storedRole) {
             // User has joined before, session is active, redirect to chat
            router.push(`/chat/${sessionId}`);
            return; // Prevent further rendering of join page
        }
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

    // Only proceed to load scenario if session status is 'open'
    if (sessionData.status !== "open") {
        setAccessError(`Sitzungsstatus "${sessionData.status}" erlaubt keinen Beitritt.`);
        setIsLoadingScenario(false); setIsLoadingParticipants(false); return;
    }

    // Scenario loading
    if (!sessionData.scenarioId) {
      setAccessError("Szenario-Referenz in Sitzungsdaten fehlt.");
      setCurrentScenario(null); setIsLoadingScenario(false); setIsLoadingParticipants(false);
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
          if (!scenario.humanRolesConfig || scenario.humanRolesConfig.length === 0) {
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

  }, [sessionId, sessionData, urlToken, isLoadingSession, sessionErrorHook, router]);


  useEffect(() => {
    if (!sessionId || accessError || !currentScenario || sessionData?.status !== "open") {
      setIsLoadingParticipants(false);
      setSessionParticipants([]);
      return;
    }
    
    setIsLoadingParticipants(true);
    const participantsColRef = collection(db, "sessions", sessionId, "participants");
    const q = query(participantsColRef, where("isBot", "==", false));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedParticipants: Participant[] = [];
      snapshot.forEach(doc => fetchedParticipants.push({ id: doc.id, ...doc.data() } as Participant));
      setSessionParticipants(fetchedParticipants);
      setIsLoadingParticipants(false);
    }, (error) => {
      console.error("Error fetching session participants:", error);
      toast({ variant: "destructive", title: "Fehler", description: "Teilnehmerdaten konnten nicht geladen werden." });
      setIsLoadingParticipants(false);
      setSessionParticipants([]);
    });
    return () => unsubscribe();
  }, [sessionId, toast, accessError, currentScenario, sessionData?.status]);

  // Listener for session status change when in waiting room
  useEffect(() => {
    if (hasJoined && sessionId) {
      const sessionDocRef = doc(db, "sessions", sessionId);
      const unsubscribe = onSnapshot(sessionDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const updatedSessionData = docSnap.data() as SessionData;
          if (updatedSessionData.status === "active") {
            toast({title: "Simulation gestartet!", description: "Du wirst zum Chat weitergeleitet."});
            router.push(`/chat/${sessionId}`);
          } else if (updatedSessionData.status === "ended" || updatedSessionData.status === "paused") {
            // Handle if admin ends/pauses session while user is waiting
            setAccessError(`Die Sitzung wurde vom Administrator ${updatedSessionData.status === "ended" ? "beendet" : "pausiert"}.`);
            setHasJoined(false); // Exit waiting room state
          }
        }
      });
      return () => unsubscribe();
    }
  }, [hasJoined, sessionId, router, toast]);


  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) {
      toast({ variant: "destructive", title: "Fehler", description: "Bitte Klarnamen eingeben." }); return;
    }
    if (!nickname.trim()) {
      toast({ variant: "destructive", title: "Fehler", description: "Bitte Nicknamen eingeben." }); return;
    }
    if (!selectedRoleId) {
      toast({ variant: "destructive", title: "Fehler", description: "Bitte Rolle wählen." }); return;
    }
    if (!sessionData || !currentScenario || sessionData.status !== "open") {
      toast({ variant: "destructive", title: "Fehler", description: "Beitritt nicht möglich (Sitzungsstatus nicht 'open')." });
      return;
    }
    
    setIsSubmitting(true);
    const userIdGenerated = `user-${nickname.replace(/\s+/g, '-').toLowerCase().substring(0,10)}-${Date.now().toString().slice(-5)}`;
    const avatarFallback = nickname.substring(0, 2).toUpperCase() || "XX";
    const selectedRoleConfig = currentScenario.humanRolesConfig?.find(role => role.id === selectedRoleId);

    if (!selectedRoleConfig) {
        toast({ variant: "destructive", title: "Fehler", description: "Ausgewählte Rolle nicht gefunden." });
        setIsSubmitting(false); return;
    }

    try {
      const participantsColRef = collection(db, "sessions", sessionId, "participants");
      const newParticipantData: Omit<Participant, 'id' | 'botConfig' | 'botScenarioId'> = {
        name: name.trim(), 
        nickname: nickname.trim(),
        role: selectedRoleConfig.name,
        userId: userIdGenerated,
        avatarFallback: avatarFallback,
        isBot: false,
        isMuted: false, 
        status: "Beigetreten", // Or "Wartet auf Start"
        joinedAt: serverTimestamp()
      };

      await addDoc(participantsColRef, newParticipantData);

      localStorage.setItem(`chatUser_${sessionId}_name`, name.trim());
      localStorage.setItem(`chatUser_${sessionId}_nickname`, nickname.trim());
      localStorage.setItem(`chatUser_${sessionId}_role`, selectedRoleConfig.name); // Store role name
      localStorage.setItem(`chatUser_${sessionId}_userId`, userIdGenerated);
      localStorage.setItem(`chatUser_${sessionId}_avatarFallback`, avatarFallback);
      localStorage.setItem(`chatUser_${sessionId}_roleId`, selectedRoleId); // Store role ID

      setHasJoined(true); // Enter waiting room state
      // No router.push here, useEffect will handle redirection when session becomes active
      toast({
        title: "Wartebereich beigetreten",
        description: `Du bist als ${nickname.trim()} (${selectedRoleConfig.name}) beigetreten. Warte auf den Start der Simulation.`,
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

  const isLoadingPage = isLoadingSession || isLoadingScenario;
  
  const selectedRoleDetails = useMemo(() => {
    if (!selectedRoleId || !currentScenario?.humanRolesConfig) return null;
    return currentScenario.humanRolesConfig.find(r => r.id === selectedRoleId);
  }, [selectedRoleId, currentScenario?.humanRolesConfig]);


  if (hasJoined) {
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
            <p>Dein Nickname: <span className="font-semibold">{nickname}</span></p>
            <p>Deine Rolle: <span className="font-semibold">{selectedRoleDetails?.name || "Wird geladen..."}</span></p>
            {selectedRoleDetails?.description && (
                <div className="mt-2 p-3 bg-muted/50 rounded-md text-sm text-left">
                    <p className="font-medium mb-1">Rollenbeschreibung:</p>
                    <ScrollArea className="h-[100px]"><p>{selectedRoleDetails.description}</p></ScrollArea>
                </div>
            )}
            <div className="flex items-center justify-center text-muted-foreground pt-4">
                <Clock className="h-5 w-5 mr-2 animate-spin"/>
                <p>Bitte warte, bis der Administrator die Simulation startet...</p>
            </div>
            {accessError && (
                 <Alert variant="destructive" className="mt-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Fehler</AlertTitle>
                    <AlertDescription>{accessError}</AlertDescription>
                </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }


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
  
  const disableForm = isSubmitting || !!accessError || !currentScenario || allScenarioRoles.length === 0 || sessionData?.status !== "open";

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
      <Link href="/" className="absolute top-4 left-4 sm:top-8 sm:left-8">
        <Button variant="ghost" size="icon" aria-label="Zurück zur Startseite">
          <ArrowLeft className="h-6 w-6" />
        </Button>
      </Link>
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl text-primary">
            Simulation beitreten: {currentScenario?.title || (isLoadingScenario ? "Szenario-Titel lädt..." : (accessError ? "Fehler" : "Unbekanntes Szenario"))}
          </CardTitle>
          <CardDescription>
            {currentScenario ? "Geben Sie Ihre Namen ein und wählen Sie eine Rolle, um an der Simulation teilzunehmen." : (isLoadingScenario ? "Szenario-Informationen werden geladen..." : "Szenario-Informationen nicht verfügbar.")}
            <br/>Sitzungs-ID: <span className="font-mono text-xs">{sessionId}</span>
          </CardDescription>
        </CardHeader>
        {accessError && (
            <CardContent>
                <Alert variant={accessError.includes("Vorbereitung") ? "default" : "destructive"} className={accessError.includes("Vorbereitung") ? "bg-blue-500/10 border-blue-500" : ""}>
                    {accessError.includes("Vorbereitung") ? <Info className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                    <AlertTitle>{accessError.includes("Vorbereitung") ? "Information" : "Beitritt nicht möglich"}</AlertTitle>
                    <AlertDescription>{accessError}</AlertDescription>
                </Alert>
            </CardContent>
        )}
        {!accessError && currentScenario && allScenarioRoles.length > 0 && sessionData?.status === "open" && (
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Ihr Klarname (für Admin sichtbar)</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Max Mustermann"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    disabled={disableForm}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nickname">Ihr Nickname (im Chat sichtbar)</Label>
                  <Input
                    id="nickname"
                    type="text"
                    placeholder="MaxPower99"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    required
                    disabled={disableForm}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Wählen Sie Ihre Rolle (aktuell {isLoadingParticipants ? 'lade Teilnehmer...' : sessionParticipants.length} von unbegrenzt beigetreten)</Label>
                <ScrollArea className="h-[300px] md:h-[350px] rounded-md border p-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-3">
                        {allScenarioRoles.map((role) => {
                            const participantsInThisRole = sessionParticipants.filter(p => p.role === role.name);
                            const isSelectedByCurrentUser = selectedRoleId === role.id;

                            return (
                                <Card
                                    key={role.id} // Using role.id as key
                                    className={cn(
                                    "cursor-pointer transition-all hover:shadow-lg flex flex-col",
                                    isSelectedByCurrentUser ? "ring-2 ring-primary shadow-primary/30" : "ring-1 ring-border"
                                    )}
                                    onClick={() => !disableForm && setSelectedRoleId(role.id)}
                                >
                                    <CardHeader className="pb-2 pt-3">
                                        <CardTitle className="text-base flex items-center justify-between">
                                            {role.name}
                                            {isSelectedByCurrentUser && <UserCheck className="h-5 w-5 text-primary" />}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="text-xs text-muted-foreground space-y-1 flex-grow pb-3">
                                        <ScrollArea className="h-[60px] pr-2">
                                            <p>{role.description}</p>
                                        </ScrollArea>
                                        {participantsInThisRole.length > 0 && (
                                          <div className="mt-2 pt-2 border-t">
                                            <p className="text-xs font-medium text-foreground mb-1 flex items-center"><Users className="h-3 w-3 mr-1.5"/>Belegt durch:</p>
                                            <div className="flex flex-wrap gap-1">
                                                {participantsInThisRole.map(p => <Badge key={p.userId} variant="secondary" className="text-xs">{p.nickname || p.name}</Badge>)}
                                            </div>
                                          </div>
                                        )}
                                         {isSelectedByCurrentUser && nickname.trim() && (
                                            <div className="mt-1 pt-1 border-t border-dashed">
                                                <Badge variant="default" className="text-xs bg-primary/20 text-primary border-primary/50">
                                                    Du: {nickname.trim()}
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
              
              {currentScenario.langbeschreibung && (
                <Alert className="bg-muted/30">
                  <Info className="h-4 w-4" />
                  <AlertTitle>Szenariobeschreibung</AlertTitle>
                  <AlertDescription className="text-xs max-h-20 overflow-y-auto">
                    {currentScenario.langbeschreibung}
                  </AlertDescription>
                </Alert>
              )}

            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={disableForm || !selectedRoleId || !name.trim() || !nickname.trim()}>
                {isSubmitting ? <><Loader2 className="mr-2 h-5 w-5 animate-spin"/> Wird beigetreten...</> : <><LogIn className="mr-2 h-5 w-5" /> Dem Wartebereich beitreten</>}
              </Button>
            </CardFooter>
          </form>
        )}
         {!accessError && !isLoadingPage && (!currentScenario || allScenarioRoles.length === 0) && sessionData?.status === "open" && ( 
             <CardContent>
                <Alert variant="default">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Szenario-Informationen unvollständig</AlertTitle>
                    <AlertDescription>
                        { !currentScenario 
                            ? "Die Details für dieses Szenario konnten nicht vollständig geladen werden." 
                            : "Für dieses Szenario sind keine Teilnehmerrollen definiert. Bitte kontaktieren Sie den Administrator."
                        }
                    </AlertDescription>
                </Alert>
            </CardContent>
        )}
      </Card>
    </div>
  );
}
