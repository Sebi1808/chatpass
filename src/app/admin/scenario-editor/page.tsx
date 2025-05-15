
// This file is no longer used directly as the main editor page.
// It's replaced by the dynamic route /admin/scenario-editor/[scenarioId]/page.tsx
// However, the sidebar link might still point here, so we can keep a generic placeholder or redirect.

import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function ScenarioEditorLandingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary">Szenario Editor</h1>
        <p className="text-muted-foreground mt-2">
          Wählen Sie ein Szenario aus der Szenarienübersicht aus, um es zu bearbeiten, oder erstellen Sie ein neues Szenario.
        </p>
      </div>
      <Separator />
      <Card>
        <CardHeader>
          <CardTitle>Willkommen im Szenario Editor</CardTitle>
          <CardDescription>
            Diese Seite dient als Einstiegspunkt für den Szenario-Editor.
            Die eigentliche Bearbeitung findet statt, nachdem ein spezifisches Szenario ausgewählt wurde (Klick auf &quot;Bearbeiten&quot; bei einem Szenario).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Um ein Szenario zu bearbeiten, gehen Sie bitte zur <Link href="/admin" className="text-primary hover:underline">Szenarienübersicht</Link> und klicken Sie bei einem Szenario auf &quot;Bearbeiten&quot;.
          </p>
          <p className="text-muted-foreground mt-4">
            Die Funktion zum Erstellen neuer Szenarien und die Speicherung in einer Datenbank wird hier in Zukunft verfügbar sein. Aktuell werden Änderungen nur in der Konsole geloggt und nicht persistent gespeichert.
          </p>
        </CardContent>
      </Card>
       <div className="mt-8 flex justify-center">
          <Link href="/admin" legacyBehavior passHref>
            <Button variant="outline">
              Zurück zur Szenarienübersicht
            </Button>
          </Link>
        </div>
    </div>
  );
}
