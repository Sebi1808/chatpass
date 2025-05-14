
"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { scenarios } from "@/lib/scenarios";
import type { Scenario, SessionData } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, LogIn, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, addDoc, serverTimestamp, query, where, getDocs } from "firebase/firestore";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function JoinSessionPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams(); // For reading URL query parameters
  const { toast } = useToast();

  const sessionId = params.sessionId as string;
  const urlToken = searchParams.get("token"); // Get token from URL

  const [name, setName] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [currentScenario, setCurrentScenario] = useState<Scenario | undefined>(undefined);
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);


  useEffect(() => {
    if (sessionId) {
      const scenario = scenarios.find(s => s.id === sessionId);
      setCurrentScenario(scenario);

      const fetchSessionDetails = async () => {
        setIsLoading(true);
        setAccessError(null);
        try {
          const sessionDocRef = doc(db, "sessions", sessionId);
          const sessionSnap = await getDoc(sessionDocRef);

          if (!sessionSnap.exists()) {
            setAccessError("Sitzung nicht gefunden. Bitte überprüfen Sie den Link.");
            setIsLoading(false);
            return;
          }
          const fetchedSessionData = sessionSnap.data() as SessionData;
          

          // Validate invitation token
          if (!fetchedSessionData.invitationToken || fetchedSessionData.invitationToken !== urlToken) {
            setAccessError("Ungültiger oder abgelaufener Einladungslink. Bitte fordern Sie einen neuen Link an.");
            setIsLoading(false);
            return;
          }
          setSessionData(fetchedSessionData); // Set sessionData only after token validation

          if (fetchedSessionData.status === "ended") {
             setAccessError("Diese Sitzung wurde bereits beendet. Ein Beitritt ist nicht mehr möglich.");
             setIsLoading(false);
             return;
          }
           if (fetchedSessionData.status === "paused") {
             setAccessError("Diese Sitzung ist aktuell pausiert. Ein Beitritt ist momentan nicht möglich.");
             setIsLoading(false);
             return;
          }
          
          if (scenario) {
            const numParticipantRoles = scenario.standardRollen - scenario.defaultBots;
            const baseRoles = Array.from({ length: numParticipantRoles }, (_, i) => `Teilnehmer ${String.fromCharCode(65 + i)}`);
            
            const participantsColRef = collection(db, "sessions", sessionId, "participants");
            const participantsQuery = query(participantsColRef, where("isBot", "==", false));
            const participantsSnap = await getDocs(participantsQuery);
            const takenRoles = new Set(participantsSnap.docs.map(d => d.data().role));
            
            const freeRoles = baseRoles.filter(r => !takenRoles.has(r));
            setAvailableRoles(freeRoles);

            if (freeRoles.length > 0) {
              setSelectedRole(freeRoles[0]); 
            } else {
              setAccessError("Alle Teilnehmerrollen in dieser Sitzung sind bereits besetzt.");
            }
          }
        } catch (error) {
          console.error("Error fetching session details: ", error);
          setAccessError("Sitzungsdetails konnten nicht geladen werden. Versuchen Sie es später erneut.");
        } finally {
          setIsLoading(false);
        }
      };

      fetchSessionDetails();
    } else {
      setIsLoading(false);
      setAccessError("Keine Sitzungs-ID im Link gefunden.");
    }
  }, [sessionId, urlToken, toast]); // router removed as it's stable, added urlToken

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (accessError) { // Prevent submission if there's an access error
        toast({ variant: "destructive", title: "Beitritt nicht möglich", description: accessError });
        return;
    }
    if (!name.trim()) {
      toast({ variant: "destructive", title: "Fehler", description: "Bitte geben Sie Ihren Namen ein." });
      return;
    }
    if (!selectedRole) {
      toast({ variant: "destructive", title: "Fehler", description: "Bitte wählen Sie eine Rolle aus." });
      return;
    }
    if (!currentScenario || !sessionData) {
      toast({ variant: "destructive", title: "Fehler", description: "Szenario- oder Sitzungsdaten nicht geladen." });
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
    const userId = `user-${name.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`;
    const avatarFallback = name.substring(0, 2).toUpperCase();

    try {
      const participantsColRef = collection(db, "sessions", sessionId, "participants");
      await addDoc(participantsColRef, {
        name: name.trim(),
        role: selectedRole,
        userId: userId,
        avatarFallback: avatarFallback,
        isBot: false,
        isMuted: false, 
        joinedAt: serverTimestamp(),
        status: "Beigetreten"
      });

      localStorage.setItem(`chatUser_${sessionId}_name`, name.trim());
      localStorage.setItem(`chatUser_${sessionId}_role`, selectedRole);
      localStorage.setItem(`chatUser_${sessionId}_userId`, userId);
      localStorage.setItem(`chatUser_${sessionId}_avatarFallback`, avatarFallback);

      toast({
        title: "Beitritt erfolgreich",
        description: `Sie treten der Simulation als ${name} (${selectedRole}) bei.`,
      });
      router.push(`/chat/${sessionId}`);
    } catch (error) {
      console.error("Error adding participant to Firestore: ", error);
      toast({ variant: "destructive", title: "Fehler", description: "Beitritt fehlgeschlagen. Bitte versuchen Sie es erneut." });
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>Sitzung wird geladen...</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>Die Details zur Sitzung werden abgerufen. Bitte haben Sie einen Moment Geduld.</p>
                     {isLoading && <Progress value={50} className="w-full mt-4 h-2" />}
                </CardContent>
            </Card>
        </div>
    );
  }
  
  const disableForm = isSubmitting || !!accessError || availableRoles.length === 0;


  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
      <Link href="/" className="absolute top-4 left-4 sm:top-8 sm:left-8">
        <Button variant="ghost" size="icon" aria-label="Zurück zur Startseite">
          <ArrowLeft className="h-6 w-6" />
        </Button>
      </Link>
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-2xl text-primary">Simulation beitreten: {currentScenario?.title || "Unbekanntes Szenario"}</CardTitle>
          <CardDescription>
            {currentScenario ? "Geben Sie Ihren Namen ein und wählen Sie eine Rolle, um an der Simulation teilzunehmen." : "Szenario-Informationen werden geladen..."}
            <br/>Sitzungs-ID: {sessionId}
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
                <Select value={selectedRole} onValueChange={setSelectedRole} disabled={disableForm}>
                  <SelectTrigger id="role">
                    <SelectValue placeholder="Rolle auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRoles.length > 0 ? (
                      availableRoles.map((role) => (
                        <SelectItem key={role} value={role}>
                          {role}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-roles" disabled>
                          {sessionData?.status === "ended" ? "Sitzung beendet" : (sessionData?.status === "paused" ? "Sitzung pausiert" : "Keine freien Teilnehmerrollen")}
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
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={disableForm}>
                {isSubmitting ? "Wird beigetreten..." : <><LogIn className="mr-2 h-5 w-5" /> Der Simulation beitreten</>}
              </Button>
            </CardFooter>
          </form>
        )}
         {!accessError && !currentScenario && !isLoading && (
             <CardContent>
                <Alert variant="default">
                    <AlertTitle>Szenario nicht gefunden</AlertTitle>
                    <AlertDescription>Die Informationen für dieses Szenario konnten nicht geladen werden.</AlertDescription>
                </Alert>
            </CardContent>
        )}
      </Card>
    </div>
  );
}
