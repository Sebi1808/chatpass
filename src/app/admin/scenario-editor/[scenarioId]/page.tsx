
// This new file creates the dynamic route for editing a specific scenario.
"use client";

import { useParams, useRouter } from 'next/navigation';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';
import { scenarios } from '@/lib/scenarios'; // Assuming scenarios are statically defined for now
import type { Scenario, BotConfig } from '@/lib/types';
import { useEffect, useState, type FormEvent } from 'react';
import { useToast } from '@/hooks/use-toast';

export default function EditScenarioPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const scenarioId = params.scenarioId as string;

  const [currentScenario, setCurrentScenario] = useState<Scenario | undefined>(undefined);
  const [title, setTitle] = useState('');
  const [kurzbeschreibung, setKurzbeschreibung] = useState('');
  const [langbeschreibung, setLangbeschreibung] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [rollenInput, setRollenInput] = useState('');


  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    if (scenarioId) {
      const foundScenario = scenarios.find(s => s.id === scenarioId);
      if (foundScenario) {
        setCurrentScenario(foundScenario);
        setTitle(foundScenario.title);
        setKurzbeschreibung(foundScenario.kurzbeschreibung);
        setLangbeschreibung(foundScenario.langbeschreibung);
        setTagsInput(foundScenario.tags.join(', '));
        // Placeholder for more complex role data structure in the future
        setRollenInput(`Rollen für "${foundScenario.title}" hier definieren... (aktuell nur Textarea)`);
      } else {
        setCurrentScenario(undefined); // Scenario not found
      }
    }
    setIsLoading(false);
  }, [scenarioId]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentScenario) return;
    setIsSaving(true);

    // TODO: Implement actual saving logic to a database
    console.log("Saving scenario (ID: ", currentScenario.id, "):");
    console.log({
      id: currentScenario.id,
      title,
      kurzbeschreibung,
      langbeschreibung,
      tags: tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag),
      // Keep other properties from original scenario for now
      defaultBots: currentScenario.defaultBots,
      standardRollen: currentScenario.standardRollen, // This is total roles, not human roles
      iconName: currentScenario.iconName,
      defaultBotsConfig: currentScenario.defaultBotsConfig,
      // RollenInput would be processed here in a real app
    });

    // Simulate saving
    setTimeout(() => {
      toast({
        title: "Szenario gespeichert (Simulation)",
        description: `Änderungen für "${title}" wurden in der Konsole geloggt.`,
      });
      setIsSaving(false);
      // In a real app, you might want to update the static scenarios array or re-fetch
    }, 1000);
  };

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
              Das Szenario mit der ID &quot;{scenarioId}&quot; konnte nicht gefunden werden oder existiert nicht in `scenarios.ts`.
            </p>
          </div>
          <Button variant="outline" onClick={() => router.push('/admin')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Zurück zur Szenarienübersicht
          </Button>
        </div>
        <Separator />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="flex items-center justify-between sticky top-0 z-10 bg-background/80 py-4 backdrop-blur-md -mx-4 sm:-mx-6 px-4 sm:px-6 border-b mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">
            Szenario bearbeiten: <span className="text-foreground">{currentScenario.title}</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            ID: {currentScenario.id}
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" type="button" onClick={() => router.push('/admin')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Abbrechen
          </Button>
          <Button type="submit" disabled={isSaving}>
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? "Speichert..." : "Änderungen speichern"}
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 px-1">
        <div className="lg:col-span-2 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Basisinformationen</CardTitle>
              <CardDescription>
                Grundlegende Details und Beschreibungen des Szenarios.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-1.5">
                <Label htmlFor="title">Titel des Szenarios</Label>
                <Input 
                  id="title" 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)} 
                  placeholder="Ein prägnanter Titel"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="kurzbeschreibung">Kurzbeschreibung (für Übersichtskarten)</Label>
                <Textarea 
                  id="kurzbeschreibung" 
                  value={kurzbeschreibung} 
                  onChange={(e) => setKurzbeschreibung(e.target.value)} 
                  placeholder="Eine kurze Zusammenfassung (ca. 1-2 Sätze)."
                  rows={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="langbeschreibung">Langbeschreibung / Szenariokontext</Label>
                <Textarea 
                  id="langbeschreibung" 
                  value={langbeschreibung} 
                  onChange={(e) => setLangbeschreibung(e.target.value)} 
                  placeholder="Ausführliche Beschreibung der Ausgangslage, Thema, Lernziele, beteiligte Akteure etc. Dies ist der Hauptkontext für die Simulation."
                  rows={10}
                  className="min-h-[250px]"
                />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Bot-Konfiguration</CardTitle>
              <CardDescription>
                Standard-Bots für dieses Szenario. (Aktuell nur Anzeige - Bearbeitung folgt)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {currentScenario.defaultBotsConfig && currentScenario.defaultBotsConfig.length > 0 ? (
                <div className="space-y-4">
                  {currentScenario.defaultBotsConfig.map((bot, index) => (
                    <div key={bot.id || `bot-${index}`} className="p-4 border rounded-md bg-muted/50">
                      <p className="font-semibold text-sm">Bot {index + 1}: ID <span className="font-mono text-xs bg-background p-0.5 rounded">{bot.id}</span></p>
                      <p className="text-sm">Persönlichkeit: <span className="font-medium">{bot.personality}</span></p>
                      {bot.name && <p className="text-sm">Angezeigter Name: <span className="font-medium">{bot.name}</span></p>}
                       {bot.avatarFallback && <p className="text-sm">Avatar Kürzel: <span className="font-medium">{bot.avatarFallback}</span></p>}
                       {typeof bot.currentEscalation === 'number' && <p className="text-sm">Initiale Eskalation: <span className="font-medium">{bot.currentEscalation}</span></p>}
                       {typeof bot.isActive === 'boolean' && <p className="text-sm">Standardmäßig aktiv: <span className="font-medium">{bot.isActive ? 'Ja' : 'Nein'}</span></p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">Keine Standard-Bots für dieses Szenario konfiguriert.</p>
              )}
              <p className="mt-4 text-xs text-orange-500">Die detaillierte Bearbeitung von Bots (Hinzufügen, Ändern, Löschen) wird in einem zukünftigen Schritt implementiert.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Rollen für menschliche Teilnehmer</CardTitle>
              <CardDescription>
                Definition der Rollen, ihrer Ziele und Informationen. (Aktuell Platzhalter)
              </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-1.5">
                    <Label htmlFor="rollenInput">Rollenbeschreibungen und -konfiguration</Label>
                    <Textarea 
                    id="rollenInput" 
                    value={rollenInput} 
                    onChange={(e) => setRollenInput(e.target.value)} 
                    placeholder="Definieren Sie hier die Rollen, z.B.:&#10;Rolle: Angegriffene Person&#10;Beschreibung: Du postest folgendes Bild...&#10;---&#10;Rolle: Hater*in&#10;Beschreibung: Deine Aufgabe ist es..."
                    rows={12}
                    className="min-h-[200px]"
                    />
                </div>
                 <p className="mt-4 text-xs text-orange-500">Eine strukturierte Eingabe und Verwaltung von multiplen Rollen mit spezifischen Feldern (Name, Ziele, geheime Infos etc.) wird in einem zukünftigen Schritt implementiert.</p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
            <Card>
                <CardHeader>
                <CardTitle>Szenario-Metadaten</CardTitle>
                <CardDescription>
                    Weitere Einstellungen wie Icon, Tags und Standard-Rollenzahlen.
                </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <Label htmlFor="iconName">Icon Name (aus Lucide-React)</Label>
                        <Input id="iconName" value={currentScenario.iconName} disabled className="mt-1 bg-muted/80"/>
                         <p className="text-xs text-muted-foreground mt-1">Bearbeitung des Icons folgt später.</p>
                    </div>
                    <div>
                        <Label htmlFor="standardRollenGesamt">Standard-Rollenzahl (gesamt inkl. Bots)</Label>
                        <Input id="standardRollenGesamt" type="number" value={currentScenario.standardRollen} disabled className="mt-1 bg-muted/80"/>
                         <p className="text-xs text-muted-foreground mt-1">Wird später basierend auf Bot-Anzahl und menschlichen Rollen berechnet.</p>
                    </div>
                     <div>
                        <Label htmlFor="defaultBotsAnzahl">Anzahl Default Bots</Label>
                        <Input id="defaultBotsAnzahl" type="number" value={currentScenario.defaultBots} disabled className="mt-1 bg-muted/80"/>
                         <p className="text-xs text-muted-foreground mt-1">Wird aus der Bot-Konfiguration abgeleitet.</p>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="tagsInput">Tags (kommagetrennt)</Label>
                        <Input 
                            id="tagsInput" 
                            value={tagsInput} 
                            onChange={(e) => setTagsInput(e.target.value)} 
                            placeholder="Konflikt, Social Media, Fake News"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Ein Klick-basiertes Tag-System aus der Taxonomie folgt.</p>
                    </div>
                </CardContent>
            </Card>
             <Card>
                <CardHeader>
                    <CardTitle>Originaldaten (aus `scenarios.ts`)</CardTitle>
                     <CardDescription>Nur zur Referenz während der Entwicklung.</CardDescription>
                </CardHeader>
                <CardContent>
                    <pre className="mt-2 p-3 bg-muted rounded-md text-xs overflow-x-auto max-h-[400px]">
                        {JSON.stringify(currentScenario, null, 2)}
                    </pre>
                </CardContent>
            </Card>
        </div>
      </div>
    </form>
  );
}
