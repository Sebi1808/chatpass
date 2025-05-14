
"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { scenarios } from "@/lib/scenarios";
import type { Scenario } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, LogIn } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";

export default function JoinSessionPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();

  const sessionId = params.sessionId as string;

  const [name, setName] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [currentScenario, setCurrentScenario] = useState<Scenario | undefined>(undefined);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);


  useEffect(() => {
    if (sessionId) {
      const scenario = scenarios.find(s => s.id === sessionId);
      setCurrentScenario(scenario);

      const fetchSessionDetails = async () => {
        setIsLoading(true);
        try {
          const sessionDocRef = doc(db, "sessions", sessionId);
          const sessionSnap = await getDoc(sessionDocRef);

          if (!sessionSnap.exists()) {
            toast({ variant: "destructive", title: "Fehler", description: "Sitzung nicht gefunden." });
            router.push("/"); // Redirect if session doesn't exist
            return;
          }
          // Scenario is already set from scenarios.ts, can be enriched with Firestore data if needed
          
          if (scenario) {
            const numParticipantRoles = scenario.standardRollen - scenario.defaultBots;
            const roles = Array.from({ length: numParticipantRoles }, (_, i) => `Teilnehmer ${String.fromCharCode(65 + i)}`); // Teilnehmer A, B, ...
            setAvailableRoles(roles);
            if (roles.length > 0) {
              setSelectedRole(roles[0]); // Pre-select first role
            }
          }
        } catch (error) {
          console.error("Error fetching session details: ", error);
          toast({ variant: "destructive", title: "Fehler", description: "Sitzungsdetails konnten nicht geladen werden." });
        } finally {
          setIsLoading(false);
        }
      };

      fetchSessionDetails();
    } else {
      setIsLoading(false);
    }
  }, [sessionId, router, toast]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) {
      toast({ variant: "destructive", title: "Fehler", description: "Bitte geben Sie Ihren Namen ein." });
      return;
    }
    if (!selectedRole) {
      toast({ variant: "destructive", title: "Fehler", description: "Bitte wählen Sie eine Rolle aus." });
      return;
    }
    if (!currentScenario) {
      toast({ variant: "destructive", title: "Fehler", description: "Szenario nicht geladen." });
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

  if (isLoading || !currentScenario) {
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

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
      <Link href="/" className="absolute top-4 left-4 sm:top-8 sm:left-8">
        <Button variant="ghost" size="icon" aria-label="Zurück zur Startseite">
          <ArrowLeft className="h-6 w-6" />
        </Button>
      </Link>
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-2xl text-primary">Simulation beitreten: {currentScenario.title}</CardTitle>
          <CardDescription>
            Geben Sie Ihren Namen ein und wählen Sie eine Rolle, um an der Simulation teilzunehmen.
            Die Sitzungs-ID lautet: {sessionId}
          </CardDescription>
        </CardHeader>
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
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Wählen Sie Ihre Rolle</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole} disabled={isSubmitting}>
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
                    <SelectItem value="" disabled>Keine freien Teilnehmerrollen verfügbar</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
             {currentScenario.langbeschreibung && (
              <div className="space-y-1 text-sm p-3 bg-muted/50 rounded-md">
                <Label className="font-semibold">Szenariobeschreibung:</Label>
                <p className="text-muted-foreground text-xs">{currentScenario.langbeschreibung.substring(0, 200)}{currentScenario.langbeschreibung.length > 200 ? "..." : ""}</p>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isSubmitting || availableRoles.length === 0}>
              {isSubmitting ? "Wird beigetreten..." : <><LogIn className="mr-2 h-5 w-5" /> Der Simulation beitreten</>}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
