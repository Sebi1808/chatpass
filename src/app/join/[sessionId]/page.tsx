
"use client";

import { useState, useEffect, type FormEvent, useMemo } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Scenario, SessionData, Participant, HumanRoleConfig } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, LogIn, AlertTriangle, Loader2, UserCheck, Info, Users } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, addDoc, serverTimestamp, query, where, getDocs, Timestamp, onSnapshot } from "firebase/firestore";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useSessionData } from "@/hooks/use-session-data";
import { createDefaultScenario } from '@/app/admin/scenario-editor/[scenarioId]/page'; // Keep for type if needed, but don't use for loading

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
  const { sessionData, isLoading: isLoadingSessionHook, error: sessionErrorHook } = useSessionData(sessionId);
  
  const [sessionParticipants, setSessionParticipants] = useState<Participant[]>([]);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(true);
  const [isLoadingScenario, setIsLoadingScenario] = useState(true);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionErrorHook) {
      setAccessError(sessionErrorHook);
      setIsLoadingScenario(false); // No need to load scenario if session data failed
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

    if (isLoadingSessionHook) {
      return; // Wait for sessionData to load
    }

    if (!sessionData) {
      if (!sessionErrorHook) { // Only set accessError if sessionErrorHook hasn't already set one
        setAccessError("Sitzungsdaten konnten nicht geladen werden oder sind ungültig.");
      }
      setIsLoadingScenario(false);
      setIsLoadingParticipants(false);
      return;
    }

    if (!urlToken || !sessionData.invitationToken || sessionData.invitationToken !== urlToken) {
      setAccessError("Ungültiger oder abgelaufener Einladungslink.");
      setIsLoadingScenario(false);
      setIsLoadingParticipants(false);
      return;
    }
    if (sessionData.status === "ended") {
      setAccessError("Diese Sitzung wurde bereits beendet. Ein Beitritt ist nicht mehr möglich.");
      setIsLoadingScenario(false);
      setIsLoadingParticipants(false);
      return;
    }
    if (sessionData.status === "paused") {
      setAccessError("Diese Sitzung ist aktuell pausiert. Ein Beitritt ist momentan nicht möglich.");
      setIsLoadingScenario(false);
      setIsLoadingParticipants(false);
      return;
    }

    if (!sessionData.scenarioId) {
      setAccessError("Szenario-Referenz in Sitzungsdaten fehlt. Beitritt nicht möglich.");
      setCurrentScenario(null);
      setIsLoadingScenario(false);
      setIsLoadingParticipants(false);
      return;
    }

    setIsLoadingScenario(true);
    console.log("JoinPage: Attempting to load scenario from Firestore with ID:", sessionData.scenarioId);
    const scenarioDocRef = doc(db, "scenarios", sessionData.scenarioId);
    
    getDoc(scenarioDocRef)
      .then(scenarioSnap => {
        if (!scenarioSnap.exists()) {
          console.error("JoinPage: Scenario document not found in Firestore for ID:", sessionData.scenarioId);
          setAccessError("Szenario-Details für diese Sitzung nicht gefunden.");
          setCurrentScenario(null);
        } else {
          const scenario = { id: scenarioSnap.id, ...scenarioSnap.data() } as Scenario;
          console.log("JoinPage: Scenario loaded from Firestore:", scenario);
          setCurrentScenario(scenario);
          if (!scenario.humanRolesConfig || scenario.humanRolesConfig.length === 0) {
            setAccessError("Für dieses Szenario sind keine Teilnehmerrollen definiert.");
          } else {
            setAccessError(null); // Clear previous errors if scenario and roles are fine
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

  }, [sessionId, sessionData, urlToken, isLoadingSessionHook, sessionErrorHook]);


  useEffect(() => {
    if (!sessionId || accessError || !currentScenario) {
      setIsLoadingParticipants(false); // Don't load if there's an error or no scenario
      setSessionParticipants([]); // Clear participants if error or no scenario
      return;
    }
    
    setIsLoadingParticipants(true);
    const participantsColRef = collection(db, "sessions", sessionId, "participants");
    const q = query(participantsColRef, where("isBot", "==", false));

    console.log("JoinPage: Setting up listener for session participants for session:", sessionId);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedParticipants: Participant[] = [];
      snapshot.forEach(doc => fetchedParticipants.push({ id: doc.id, ...doc.data() } as Participant));
      console.log("JoinPage: Fetched session participants:", fetchedParticipants);
      setSessionParticipants(fetchedParticipants);
      setIsLoadingParticipants(false);
    }, (error) => {
      console.error("JoinPage: Error fetching session participants:", error);
      toast({ variant: "destructive", title: "Fehler", description: "Teilnehmerdaten konnten nicht geladen werden." });
      setIsLoadingParticipants(false);
      setSessionParticipants([]);
    });
    return () => {
      console.log("JoinPage: Cleaning up listener for session participants for session:", sessionId);
      unsubscribe();
    };
  }, [sessionId, toast, accessError, currentScenario]);


  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) {
      toast({ variant: "destructive", title: "Fehler", description: "Bitte geben Sie Ihren Klarnamen ein." });
      return;
    }
    if (!nickname.trim()) {
      toast({ variant: "destructive", title: "Fehler", description: "Bitte geben Sie Ihren Nicknamen ein." });
      return;
    }
    if (!selectedRoleId) {
      toast({ variant: "destructive", title: "Fehler", description: "Bitte wählen Sie eine Rolle aus." });
      return;
    }
    if (!sessionData || !currentScenario) {
      toast({ variant: "destructive", title: "Fehler", description: "Sitzungs- oder Szenariodaten nicht geladen." });
      return;
    }
     if (sessionData.status === "ended") {
        toast({ variant: "destructive", title: "Sitzung beendet", description: "Beitritt nicht möglich, die Sitzung ist beendet." });
        setAccessError("Diese Sitzung wurde bereits beendet.");
        return;
    }
    if (sessionData.status === "paused") {
        toast({ variant: "destructive", title: "Sitzung pausiert", description: "Beitritt nicht möglich, die Sitzung ist pausiert." });
        setAccessError("Diese Sitzung ist aktuell pausiert.");
        return;
    }

    setIsSubmitting(true);
    const userIdGenerated = `user-${nickname.replace(/\s+/g, '-').toLowerCase().substring(0,10)}-${Date.now().toString().slice(-5)}`;
    const avatarFallback = nickname.substring(0, 2).toUpperCase() || "XX";
    const selectedRoleConfig = currentScenario.humanRolesConfig?.find(role => role.id === selectedRoleId);

    if (!selectedRoleConfig) {
        toast({ variant: "destructive", title: "Fehler", description: "Ausgewählte Rolle nicht gefunden." });
        setIsSubmitting(false);
        return;
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
        status: "Beigetreten",
        joinedAt: serverTimestamp()
      };

      await addDoc(participantsColRef, newParticipantData);

      localStorage.setItem(`chatUser_${sessionId}_name`, name.trim());
      localStorage.setItem(`chatUser_${sessionId}_nickname`, nickname.trim());
      localStorage.setItem(`chatUser_${sessionId}_role`, selectedRoleConfig.name);
      localStorage.setItem(`chatUser_${sessionId}_userId`, userIdGenerated);
      localStorage.setItem(`chatUser_${sessionId}_avatarFallback`, avatarFallback);

      toast({
        title: "Beitritt erfolgreich",
        description: `Sie treten der Simulation als ${nickname.trim()} (${selectedRoleConfig.name}) bei.`,
      });
      router.push(`/chat/${sessionId}`);
    } catch (error) {
      console.error("Error adding participant to Firestore: ", error);
      toast({ variant: "destructive", title: "Fehler", description: "Beitritt fehlgeschlagen. Bitte versuchen Sie es erneut." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const allScenarioRoles = useMemo(() => {
    return currentScenario?.humanRolesConfig || [];
  }, [currentScenario]);

  const isLoadingPage = isLoadingSessionHook || isLoadingScenario || (!accessError && !currentScenario); // Simpler loading logic until scenario is loaded or error

  if (isLoadingPage && !accessError) { // Show loading only if no access error yet
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
  
  const disableForm = isSubmitting || !!accessError || !currentScenario || !allScenarioRoles.length;

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
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Beitritt nicht möglich</AlertTitle>
                    <AlertDescription>{accessError}</AlertDescription>
                </Alert>
            </CardContent>
        )}
        {!accessError && currentScenario && allScenarioRoles.length > 0 && (
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
                <Label>Wählen Sie Ihre Rolle</Label>
                <ScrollArea className="h-[300px] md:h-[350px] rounded-md border p-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-3">
                        {allScenarioRoles.map((role) => {
                            const participantsInThisRole = sessionParticipants.filter(p => p.role === role.name);
                            const isSelectedByCurrentUser = selectedRoleId === role.id;

                            return (
                                <Card
                                    key={role.id} 
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
                                        {(participantsInThisRole.length > 0 || (isSelectedByCurrentUser && nickname.trim())) && (
                                          <div className="mt-2 pt-2 border-t">
                                            <p className="text-xs font-medium text-foreground mb-1 flex items-center"><Users className="h-3 w-3 mr-1.5"/>Belegt durch:</p>
                                            <div className="flex flex-wrap gap-1">
                                                {participantsInThisRole.map(p => <Badge key={p.userId} variant="secondary" className="text-xs">{p.nickname || p.name}</Badge>)}
                                                {isSelectedByCurrentUser && nickname.trim() && !participantsInThisRole.find(p => p.nickname === nickname.trim()) && (
                                                    <Badge variant="default" className="text-xs bg-primary/20 text-primary border-primary/50">
                                                        Sie: {nickname.trim()}
                                                    </Badge>
                                                )}
                                            </div>
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
                <Alert>
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
                {isSubmitting ? <><Loader2 className="mr-2 h-5 w-5 animate-spin"/> Wird beigetreten...</> : <><LogIn className="mr-2 h-5 w-5" /> Der Simulation beitreten</>}
              </Button>
            </CardFooter>
          </form>
        )}
         {!accessError && !isLoadingPage && (!currentScenario || allScenarioRoles.length === 0) && ( 
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


    