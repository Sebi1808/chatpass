
"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter, useParams }
from "next/navigation";
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

export default function JoinSessionPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();

  const sessionId = params.sessionId as string;

  const [name, setName] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [currentScenario, setCurrentScenario] = useState<Scenario | undefined>(undefined);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);

  useEffect(() => {
    if (sessionId) {
      const scenario = scenarios.find(s => s.id === sessionId);
      setCurrentScenario(scenario);
      if (scenario) {
        const numParticipantRoles = scenario.standardRollen - scenario.defaultBots;
        const roles = Array.from({ length: numParticipantRoles }, (_, i) => `Teilnehmer ${i + 1}`);
        setAvailableRoles(roles);
        if (roles.length > 0) {
          setSelectedRole(roles[0]); // Pre-select first role
        }
      }
    }
  }, [sessionId]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) {
      toast({ variant: "destructive", title: "Fehler", description: "Bitte geben Sie Ihren Namen ein." });
      return;
    }
    if (!selectedRole) {
      toast({ variant: "destructive", title: "Fehler", description: "Bitte wählen Sie eine Rolle aus." });
      return;
    }

    // For now, pass name and role via query parameters
    // In a real app, this would involve backend registration or more robust state management
    localStorage.setItem(`chatUser_${sessionId}_name`, name);
    localStorage.setItem(`chatUser_${sessionId}_role`, selectedRole);


    toast({
      title: "Beitritt erfolgreich",
      description: `Sie treten der Simulation als ${name} (${selectedRole}) bei.`,
    });
    router.push(`/chat/${sessionId}?name=${encodeURIComponent(name)}&role=${encodeURIComponent(selectedRole)}`);
  };

  if (!currentScenario) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>Sitzung wird geladen...</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>Die Details zur Sitzung werden abgerufen.</p>
                </CardContent>
            </Card>
        </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
      <Link href="/" className="absolute top-4 left-4 sm:top-8 sm:left-8">
        <Button variant="ghost" size="icon">
          <ArrowLeft className="h-6 w-6" />
          <span className="sr-only">Zurück zur Startseite</span>
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
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Wählen Sie Ihre Rolle</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
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
                    <SelectItem value="" disabled>Keine Rollen verfügbar</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full">
              <LogIn className="mr-2 h-5 w-5" />
              Der Simulation beitreten
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
