
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function ScenarioEditorPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Szenario Editor</h1>
          <p className="text-muted-foreground mt-2">
            Erstellen und bearbeiten Sie hier Ihre Chat-Simulationsszenarien.
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
          <CardTitle>Editor-Funktionen</CardTitle>
          <CardDescription>
            Diese Seite wird in Zukunft die Werkzeuge zur Verwaltung Ihrer Szenarien enthalten.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Derzeit ist der Szenario-Editor noch nicht implementiert. Die Anzeige und Auswahl der Szenarien
            erfolgt über die statisch definierte Liste in <code>src/lib/scenarios.ts</code>.
          </p>
          <p className="text-muted-foreground mt-4">
            Zukünftige Funktionen könnten umfassen:
          </p>
          <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
            <li>Erstellen neuer Szenarien mit Titel, Beschreibung, Tags.</li>
            <li>Definieren von Standardrollen und Bot-Konfigurationen pro Szenario.</li>
            <li>Zuweisen von spezifischen Fähigkeiten oder Startbedingungen für Bots.</li>
            <li>Speichern und Laden von Szenarien aus einer Datenbank.</li>
            <li>Verwalten von vordefinierten Bot-Antworten oder Ereignissen.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
