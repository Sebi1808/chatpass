
"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Scenario, SessionData, Participant, HumanRoleConfig } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, LogIn, AlertTriangle, Loader2 } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, addDoc, serverTimestamp, query, where, getDocs, Timestamp, onSnapshot } from "firebase/firestore";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function JoinSessionPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const sessionId = params.sessionId as string;
  const urlToken = searchParams.get("token");

  const [name, setName] = useState("");
  const [selectedRoleName, setSelectedRoleName] = useState("");
  const [currentScenario, setCurrentScenario] = useState<Scenario | undefined>(undefined);
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [allScenarioRoles, setAllScenarioRoles] = useState<HumanRoleConfig[]>([]); // Renamed from availableRoles
  
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [isLoadingScenario, setIsLoadingScenario] = useState(true);
  const [isLoadingRolesInfo, setIsLoadingRolesInfo] = useState(true); // Used to track if all roles have been determined
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);

  const isLoading = isLoadingSession || isLoadingScenario || isLoadingRolesInfo;

  useEffect(() => {
    if (!sessionId) {
      setAccessError("Keine Sitzungs-ID im Link gefunden.");
      setIsLoadingSession(false);
      setIsLoadingScenario(false);
      setIsLoadingRolesInfo(false);
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
      setCurrentScenario(undefined);
      return;
    }
    setIsLoadingScenario(true);
    const scenarioIdToFetch = sessionData.scenarioId; 
    const scenarioDocRef = doc(db, "scenarios", scenarioIdToFetch);

    getDoc(scenarioDocRef).then(scenarioSnap => {
      if (!scenarioSnap.exists()) {
        setAccessError(prevError => prevError || "Szenariodetails nicht gefunden. Beitritt nicht möglich.");
        setCurrentScenario(undefined);
      } else {
        const scenario = { id: scenarioSnap.id, ...scenarioSnap.data() } as Scenario;
        setCurrentScenario(scenario);
      }
      setIsLoadingScenario(false);
    }).catch(error => {
      console.error("Error fetching scenario details:", error);
      setAccessError(prevError => prevError || "Szenariodetails konnten nicht geladen werden.");
      setCurrentScenario(undefined);
      setIsLoadingScenario(false);
    });

  }, [sessionData, accessError]);


  useEffect(() => {
    if (!currentScenario || accessError) {
      setAllScenarioRoles([]);
      setIsLoadingRolesInfo(false);
      if (currentScenario && (!currentScenario.humanRolesConfig || currentScenario.humanRolesConfig.length === 0) && !accessError) {
        setAccessError(prevError => prevError || "Für dieses Szenario sind keine Teilnehmerrollen definiert.");
      }
      return;
    }
    setIsLoadingRolesInfo(true);
    console.log("JoinPage: Current scenario humanRolesConfig:", currentScenario.humanRolesConfig);

    const rolesFromScenario = currentScenario.humanRolesConfig || [];
    setAllScenarioRoles(rolesFromScenario);
    
    if (rolesFromScenario.length > 0) {
      setSelectedRoleName(rolesFromScenario[0].name); // Default to the first role
      if (accessError === "Alle Teilnehmerrollen in dieser Sitzung sind bereits besetzt.") { // Clear specific error if roles are now "available"
          setAccessError(null);
      }
    } else if (!accessError) { // Only set error if no other critical error exists
      setAccessError(prevError => prevError || "Für dieses Szenario sind keine Teilnehmerrollen definiert.");
    }
    setIsLoadingRolesInfo(false);

  }, [currentScenario, sessionId, accessError]);


  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (accessError && allScenarioRoles.length === 0 && !isLoading) { 
        toast({ variant: "destructive", title: "Beitritt nicht möglich", description: accessError || "Keine Rollen verfügbar oder anderer Fehler." });
        return;
    }
    if (!name.trim()) {
      toast({ variant: "destructive", title: "Fehler", description: "Bitte geben Sie Ihren Namen ein." });
      return;
    }
    if (!selectedRoleName) {
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
    const userId = `user-${name.replace(/\s+/g, '-').toLowerCase().substring(0,10)}-${Date.now().toString().slice(-5)}`;
    const avatarFallback = name.substring(0, 2).toUpperCase() || "XX";

    try {
      const participantsColRef = collection(db, "sessions", sessionId, "participants");
      const newParticipantData: Omit<Participant, 'id' | 'joinedAt' | 'botConfig' | 'botScenarioId'> & { joinedAt: any } = {
        name: name.trim(),
        role: selectedRoleName,
        userId: userId,
        avatarFallback: avatarFallback,
        isBot: false,
        isMuted: false, 
        status: "Beigetreten",
        joinedAt: serverTimestamp()
      };

      await addDoc(participantsColRef, newParticipantData);

      localStorage.setItem(`chatUser_${sessionId}_name`, name.trim());
      localStorage.setItem(`chatUser_${sessionId}_role`, selectedRoleName);
      localStorage.setItem(`chatUser_${sessionId}_userId`, userId);
      localStorage.setItem(`chatUser_${sessionId}_avatarFallback`, avatarFallback);

      toast({
        title: "Beitritt erfolgreich",
        description: `Sie treten der Simulation als ${name} (${selectedRoleName}) bei.`,
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
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-2xl text-primary">Simulation beitreten: {currentScenario?.title || (isLoadingScenario ? "Lade Titel..." : "Szenario-Titel nicht verfügbar")}</CardTitle>
          <CardDescription>
            {currentScenario ? "Geben Sie Ihren Namen ein und wählen Sie eine Rolle, um an der Simulation teilzunehmen." : "Szenario-Informationen werden geladen oder sind nicht verfügbar."}
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
              <div className="space-y-2">
                <Label htmlFor="name">Ihr Name</Label>
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
                <Label htmlFor="role">Wählen Sie Ihre Rolle</Label>
                <Select value={selectedRoleName} onValueChange={setSelectedRoleName} disabled={disableForm || allScenarioRoles.length === 0}>
                  <SelectTrigger id="role">
                    <SelectValue placeholder={allScenarioRoles.length === 0 && !isLoadingRolesInfo ? "Keine Rollen definiert" : "Rolle auswählen"} />
                  </SelectTrigger>
                  <SelectContent>
                    {allScenarioRoles.length > 0 ? (
                      allScenarioRoles.map((role) => (
                        <SelectItem key={role.id || role.name} value={role.name}>
                          {role.name}
                        </SelectItem>
                      ))
                    ) : (
                       <SelectItem value="no-roles" disabled>
                          {isLoadingRolesInfo ? "Lade Rollen..." : (currentScenario?.humanRolesConfig && currentScenario.humanRolesConfig.length > 0 ? "Keine freien Teilnehmerrollen" : "Keine Teilnehmerrollen für dieses Szenario definiert")}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              {currentScenario.langbeschreibung && (
                <div className="space-y-1 text-sm p-3 bg-muted/50 rounded-md max-h-32 overflow-y-auto">
                  <Label className="font-semibold">Szenariobeschreibung:</Label>
                  <p className="text-muted-foreground text-xs">{currentScenario.langbeschreibung}</p>
                </div>
              )}
              {selectedRoleName && currentScenario.humanRolesConfig &&
                (() => {
                  const roleDetails = currentScenario.humanRolesConfig.find(r => r.name === selectedRoleName);
                  return roleDetails && roleDetails.description ? (
                    <div className="space-y-1 text-sm p-3 bg-primary/10 rounded-md max-h-32 overflow-y-auto">
                      <Label className="font-semibold text-primary">Ihre Rollenbeschreibung:</Label>
                      <p className="text-foreground/90 text-xs">{roleDetails.description}</p>
                    </div>
                  ) : null;
                })()
              }
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={disableForm || !selectedRoleName || allScenarioRoles.length === 0}>
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
    