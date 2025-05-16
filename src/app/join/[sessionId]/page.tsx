
"use client";

import { useState, useEffect, type FormEvent, useMemo } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Scenario, SessionData, Participant, HumanRoleConfig } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, LogIn, AlertTriangle, Loader2, UserCheck, Info } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, addDoc, serverTimestamp, query, where, getDocs, Timestamp, onSnapshot } from "firebase/firestore";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function JoinSessionPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const sessionId = params.sessionId as string;
  const urlToken = searchParams.get("token");

  const [name, setName] = useState(""); // Klarname
  const [nickname, setNickname] = useState(""); // Nickname
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null); // Store ID of the selected role
  
  const [currentScenario, setCurrentScenario] = useState<Scenario | null>(null);
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [allScenarioRoles, setAllScenarioRoles] = useState<HumanRoleConfig[]>([]);
  
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [isLoadingScenario, setIsLoadingScenario] = useState(true);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);

  const isLoading = isLoadingSession || isLoadingScenario;

  useEffect(() => {
    if (!sessionId) {
      setAccessError("Keine Sitzungs-ID im Link gefunden.");
      setIsLoadingSession(false);
      setIsLoadingScenario(false);
      return;
    }
    setIsLoadingSession(true);

    const sessionDocRef = doc(db, "sessions", sessionId);
    const unsubscribeSession = onSnapshot(sessionDocRef, (sessionSnap) => {
      if (!sessionSnap.exists()) {
        setAccessError("Sitzung nicht gefunden. Bitte überprüfen Sie den Link.");
        setSessionData(null);
      } else {
        const fetchedSessionData = sessionSnap.data() as SessionData;
        setSessionData(fetchedSessionData);

        if (!urlToken || !fetchedSessionData.invitationToken || fetchedSessionData.invitationToken !== urlToken) {
          setAccessError("Ungültiger oder abgelaufener Einladungslink. Bitte fordern Sie einen neuen Link an.");
        } else if (fetchedSessionData.status === "ended") {
          setAccessError("Diese Sitzung wurde bereits beendet. Ein Beitritt ist nicht mehr möglich.");
        } else if (fetchedSessionData.status === "paused") {
          setAccessError("Diese Sitzung ist aktuell pausiert. Ein Beitritt ist momentan nicht möglich.");
        } else {
          setAccessError(null); 
        }
      }
      setIsLoadingSession(false);
    }, (error) => {
      console.error("Error fetching session data:", error);
      setAccessError("Sitzungsdaten konnten nicht geladen werden.");
      setIsLoadingSession(false);
    });

    return () => unsubscribeSession();
  }, [sessionId, urlToken]);

  useEffect(() => {
    if (!sessionData || accessError) {
      setIsLoadingScenario(false);
      setCurrentScenario(null);
      return;
    }
    if (!sessionData.scenarioId) {
      setAccessError(prevError => prevError || "Szenario-Referenz in Sitzungsdaten fehlt. Beitritt nicht möglich.");
      setCurrentScenario(null);
      setIsLoadingScenario(false);
      return;
    }

    setIsLoadingScenario(true);
    const scenarioDocRef = doc(db, "scenarios", sessionData.scenarioId);

    getDoc(scenarioDocRef).then(scenarioSnap => {
      if (!scenarioSnap.exists()) {
        setAccessError(prevError => prevError || "Szenariodetails nicht gefunden. Beitritt nicht möglich.");
        setCurrentScenario(null);
      } else {
        const scenario = { id: scenarioSnap.id, ...scenarioSnap.data() } as Scenario;
        setCurrentScenario(scenario);
        setAllScenarioRoles(scenario.humanRolesConfig || []);
        if (!scenario.humanRolesConfig || scenario.humanRolesConfig.length === 0) {
            setAccessError(prevError => prevError || "Für dieses Szenario sind keine Teilnehmerrollen definiert.");
        }
      }
      setIsLoadingScenario(false);
    }).catch(error => {
      console.error("Error fetching scenario details:", error);
      setAccessError(prevError => prevError || "Szenariodetails konnten nicht geladen werden.");
      setCurrentScenario(null);
      setIsLoadingScenario(false);
    });

  }, [sessionData, accessError]);

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
        return;
    }
    if (sessionData.status === "paused") {
        toast({ variant: "destructive", title: "Sitzung pausiert", description: "Beitritt nicht möglich, die Sitzung ist pausiert. Bitte warten Sie." });
        return;
    }

    setIsSubmitting(true);
    const userId = `user-${nickname.replace(/\s+/g, '-').toLowerCase().substring(0,10)}-${Date.now().toString().slice(-5)}`;
    const avatarFallback = nickname.substring(0, 2).toUpperCase() || "XX";
    const selectedRoleConfig = allScenarioRoles.find(role => role.id === selectedRoleId);

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
        role: selectedRoleConfig.name, // Use the name of the selected role
        userId: userId,
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
      localStorage.setItem(`chatUser_${sessionId}_userId`, userId);
      localStorage.setItem(`chatUser_${sessionId}_avatarFallback`, avatarFallback);

      toast({
        title: "Beitritt erfolgreich",
        description: `Sie treten der Simulation als ${nickname} (${selectedRoleConfig.name}) bei.`,
      });
      router.push(`/chat/${sessionId}`);
    } catch (error) {
      console.error("Error adding participant to Firestore: ", error);
      toast({ variant: "destructive", title: "Fehler", description: "Beitritt fehlgeschlagen. Bitte versuchen Sie es erneut." });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
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
  
  const disableForm = isSubmitting || !!accessError || (allScenarioRoles.length === 0 && !isLoading);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
      <Link href="/" className="absolute top-4 left-4 sm:top-8 sm:left-8">
        <Button variant="ghost" size="icon" aria-label="Zurück zur Startseite">
          <ArrowLeft className="h-6 w-6" />
        </Button>
      </Link>
      <Card className="w-full max-w-2xl"> {/* Increased max-width for better role card display */}
        <CardHeader>
          <CardTitle className="text-2xl text-primary">Simulation beitreten: {currentScenario?.title || (isLoadingScenario ? "Lade Titel..." : "Szenario-Titel nicht verfügbar")}</CardTitle>
          <CardDescription>
            {currentScenario ? "Geben Sie Ihre Namen ein und wählen Sie eine Rolle, um an der Simulation teilzunehmen." : "Szenario-Informationen werden geladen oder sind nicht verfügbar."}
            <br/>Sitzungs-ID: {sessionId}
          </CardDescription>
        </CardHeader>
        {accessError && (
            <CardContent>
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>{disableForm && !(allScenarioRoles.length > 0) ? "Beitritt nicht möglich" : "Hinweis"}</AlertTitle>
                    <AlertDescription>{accessError}</AlertDescription>
                </Alert>
            </CardContent>
        )}
        {!accessError && currentScenario && (
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
                {allScenarioRoles.length === 0 && !isLoadingScenario && (
                  <p className="text-muted-foreground">Für dieses Szenario sind keine Rollen definiert.</p>
                )}
                <ScrollArea className="h-[300px] md:h-[350px] rounded-md border p-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-3">
                        {allScenarioRoles.map((role) => (
                        <Card
                            key={role.id} // Use unique role.id as key
                            className={cn(
                            "cursor-pointer transition-all hover:shadow-lg",
                            selectedRoleId === role.id ? "ring-2 ring-primary shadow-primary/30" : "ring-1 ring-border"
                            )}
                            onClick={() => !disableForm && setSelectedRoleId(role.id)}
                        >
                            <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center justify-between">
                                {role.name}
                                {selectedRoleId === role.id && <UserCheck className="h-5 w-5 text-primary" />}
                            </CardTitle>
                            </CardHeader>
                            <CardContent className="text-xs text-muted-foreground space-y-1">
                                <ScrollArea className="h-[60px] pr-2">
                                    <p>{role.description}</p>
                                </ScrollArea>
                                {selectedRoleId === role.id && nickname.trim() && (
                                    <Badge variant="secondary" className="mt-2">
                                        Zugewiesen an: {nickname.trim()}
                                    </Badge>
                                )}
                            </CardContent>
                        </Card>
                        ))}
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
         {!accessError && !currentScenario && !isLoading && ( 
             <CardContent>
                <Alert variant="default">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Szenario-Informationen fehlen</AlertTitle>
                    <AlertDescription>Die Details für dieses Szenario konnten nicht geladen werden. Möglicherweise wurde es gelöscht oder die Sitzungs-ID ist ungültig.</AlertDescription>
                </Alert>
            </CardContent>
        )}
      </Card>
    </div>
  );
}
