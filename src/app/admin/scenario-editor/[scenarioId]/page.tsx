
// This new file creates the dynamic route for editing a specific scenario.
"use client";

import { useParams } from 'next/navigation';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { scenarios } from '@/lib/scenarios'; // Assuming scenarios are statically defined for now
import type { Scenario } from '@/lib/types';
import { useEffect, useState } from 'react';

export default function EditScenarioPage() {
  const params = useParams();
  const scenarioId = params.scenarioId as string;
  const [currentScenario, setCurrentScenario] = useState<Scenario | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (scenarioId) {
      const foundScenario = scenarios.find(s => s.id === scenarioId);
      setCurrentScenario(foundScenario);
    }
    setIsLoading(false);
  }, [scenarioId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p>Lade Szenariodaten...</p>
      </div>
    );
  }

  if (!currentScenario) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-destructive">Szenario nicht gefunden</h1>
            <p className="text-muted-foreground mt-2">
              Das Szenario mit der ID &quot;{scenarioId}&quot; konnte nicht gefunden werden.
            </p>
          </div>
          <Link href="/admin" legacyBehavior passHref>
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Zurück zu den Szenarien
            </Button>
          </Link>
        </div>
        <Separator />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">
            Szenario bearbeiten: <span className="text-foreground">{currentScenario.title}</span>
          </h1>
          <p className="text-muted-foreground mt-2">
            ID: {currentScenario.id}
          </p>
        </div>
        <Link href="/admin" legacyBehavior passHref>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Zurück zu den Szenarien
          </Button>
        </Link>
      </div>
      <Separator />
      <Card>
        <CardHeader>
          <CardTitle>Editor-Platzhalter</CardTitle>
          <CardDescription>
            Hier werden in Zukunft die Bearbeitungsfunktionen für das Szenario &quot;{currentScenario.title}&quot; implementiert.
            Sie können Details wie Titel, Beschreibungen, Standardrollen, Bot-Konfigurationen und Lernziele anpassen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Aktuell werden die Szenariodaten noch aus der statischen Datei <code>src/lib/scenarios.ts</code> geladen.
            Eine Datenbankanbindung und Speicherfunktion für Änderungen ist für die Zukunft geplant.
          </p>
          <div className="mt-6 space-y-4">
            <div>
              <h3 className="font-semibold text-lg">Aktuelle Daten (aus <code>scenarios.ts</code>):</h3>
              <pre className="mt-2 p-3 bg-muted rounded-md text-sm overflow-x-auto">
                {JSON.stringify(currentScenario, null, 2)}
              </pre>
            </div>
            <p className="text-orange-500 font-semibold">
              Hinweis: Dies ist nur eine Anzeige. Änderungen hier haben noch keine Auswirkungen.
            </p>
            {/* Placeholder for form fields */}
            <Button disabled>Änderungen speichern (Noch nicht aktiv)</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

