
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
          <CardTitle>Editor-Funktionen (Demnächst verfügbar)</CardTitle>
          <CardDescription>
            Diese Seite wird in Zukunft die Werkzeuge zur Verwaltung Ihrer Chat-Simulationsszenarien enthalten.
            Hier können Sie neue Szenarien erstellen, bestehende bearbeiten, Bot-Persönlichkeiten definieren,
            Standard-Rollen festlegen und vieles mehr.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Derzeit ist der Szenario-Editor noch nicht implementiert. Die Anzeige und Auswahl der Szenarien
            erfolgt über die statisch definierte Liste in <code>src/lib/scenarios.ts</code>.
          </p>
          <p className="text-muted-foreground mt-4">
            **Zukünftige Funktionen könnten umfassen:**
          </p>
          <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
            <li>Erstellen neuer Szenarien mit Titel, Beschreibung, Lernzielen und Tags.</li>
            <li>Definieren von Standardrollen für Teilnehmer.</li>
            <li>Konfigurieren von KI-Bots:
                <ul className="list-['-_'] list-inside ml-4">
                    <li>Auswahl der Persönlichkeit (Provokateur, Verteidiger, Informant, Standard).</li>
                    <li>Festlegen von spezifischen Startanweisungen oder Zielen für Bots.</li>
                    <li>Definieren von Schlüsselwörtern, auf die Bots reagieren.</li>
                    <li>Erstellen von Sets vorgefertigter Antworten oder Reaktionsmustern.</li>
                </ul>
            </li>
            <li>Speichern und Laden von Szenarien aus einer Datenbank.</li>
            <li>Duplizieren und Anpassen bestehender Szenarien.</li>
            <li>Verwalten von Medien (Bilder, Videos), die in Szenarien verwendet werden können.</li>
          </ul>
           <p className="text-muted-foreground mt-4">
            Die aktuelle Szenarienliste wird aus <code>src/lib/scenarios.ts</code> geladen. Änderungen dort wirken sich direkt auf die Auswahl im Admin-Dashboard aus.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
