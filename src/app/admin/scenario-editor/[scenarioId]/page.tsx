
// This new file creates the dynamic route for editing a specific scenario.
"use client";

import { useParams, useRouter } from 'next/navigation';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area'; // Added import
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
  const [lernziele, setLernziele] = useState('');
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
        setLernziele(foundScenario.lernziele?.join('\n') || '');
        setTagsInput(foundScenario.tags.join(', '));
        // Placeholder for more complex role data structure in the future
        setRollenInput(`Rollen für "${foundScenario.title}" hier definieren... (aktuell nur Textarea)\n\nBeispiel:\nRolle: Angegriffene Person\nBeschreibung: Du postest folgendes Bild...\nZiel: Standhaft bleiben.`);
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
      lernziele: lernziele.split('\n').map(ziel => ziel.trim()).filter(ziel => ziel),
      tags: tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag),
      // Keep other properties from original scenario for now
      defaultBots: currentScenario.defaultBots,
      standardRollen: currentScenario.standardRollen, 
      iconName: currentScenario.iconName,
      defaultBotsConfig: currentScenario.defaultBotsConfig,
      // RollenInput would be processed here in a real app
      rawRollenInput: rollenInput,
    });

    setTimeout(() => {
      toast({
        title: "Szenario gespeichert (Simulation)",
        description: `Änderungen für "${title}" wurden in der Konsole geloggt.`,
      });
      setIsSaving(false);
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
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-destructive">Szenario nicht gefunden</h1>
            <p className="text-muted-foreground mt-2">
              Das Szenario mit der ID &quot;{scenarioId}&quot; konnte nicht gefunden werden.
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
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b px-4 py-3 sm:px-6 flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-primary truncate max-w-xs sm:max-w-md md:max-w-lg">
            Editor: <span className="text-foreground">{currentScenario.title}</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            ID: {currentScenario.id}
          </p>
        </div>
        <div className="flex gap-2 md:gap-3">
          <Button variant="outline" type="button" onClick={() => router.push('/admin')} disabled={isSaving}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Abbrechen
          </Button>
          <Button type="submit" disabled={isSaving} className="min-w-[150px]">
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? "Speichert..." : "Änderungen speichern"}
          </Button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
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
                    disabled={isSaving}
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
                    disabled={isSaving}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="langbeschreibung">Langbeschreibung / Szenariokontext (für Simulation)</Label>
                  <Textarea 
                    id="langbeschreibung" 
                    value={langbeschreibung} 
                    onChange={(e) => setLangbeschreibung(e.target.value)} 
                    placeholder="Ausführliche Beschreibung der Ausgangslage, Thema, beteiligte Akteure etc. Dies ist der Hauptkontext für die Simulation und die Bots."
                    rows={10}
                    className="min-h-[200px] md:min-h-[250px]"
                    disabled={isSaving}
                  />
                  <p className="text-xs text-muted-foreground">Markdown-Formatierung wird später unterstützt.</p>
                </div>
                 <div className="space-y-1.5">
                  <Label htmlFor="lernziele">Lernziele (ein Ziel pro Zeile)</Label>
                  <Textarea 
                    id="lernziele" 
                    value={lernziele} 
                    onChange={(e) => setLernziele(e.target.value)} 
                    placeholder="Was sollen die Teilnehmenden lernen?&#10;- Ziel 1&#10;- Ziel 2"
                    rows={5}
                    className="min-h-[100px]"
                    disabled={isSaving}
                  />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Bot-Konfiguration</CardTitle>
                <CardDescription>
                  Standard-Bots für dieses Szenario. (Aktuell nur Anzeige)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {currentScenario.defaultBotsConfig && currentScenario.defaultBotsConfig.length > 0 ? (
                  <div className="space-y-4">
                    {currentScenario.defaultBotsConfig.map((bot, index) => (
                      <div key={bot.id || `bot-${index}`} className="p-3 border rounded-md bg-muted/30 text-sm">
                        <p className="font-semibold text-foreground/90">Bot {index + 1}: ID <span className="font-mono text-xs bg-background/70 p-0.5 rounded">{bot.id}</span></p>
                        <p>Persönlichkeit: <span className="font-medium">{bot.personality}</span></p>
                        {bot.name && <p>Anzeigename: <span className="font-medium">{bot.name}</span></p>}
                        {bot.avatarFallback && <p>Avatar Kürzel: <span className="font-medium">{bot.avatarFallback}</span></p>}
                        {typeof bot.currentEscalation === 'number' && <p>Initiale Eskalation: <span className="font-medium">{bot.currentEscalation}</span></p>}
                        {typeof bot.isActive === 'boolean' && <p>Standardmäßig aktiv: <span className="font-medium">{bot.isActive ? 'Ja' : 'Nein'}</span></p>}
                        {bot.initialMission && <p>Initiale Mission: <span className="font-medium truncate w-full block" title={bot.initialMission}>{bot.initialMission}</span></p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">Keine Standard-Bots für dieses Szenario konfiguriert.</p>
                )}
                <p className="mt-4 text-xs text-accent">Die detaillierte Bearbeitung von Bots (Hinzufügen, Ändern, Löschen, Vordefinierte Antworten) wird in einem zukünftigen Schritt implementiert.</p>
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
                      className="min-h-[200px] md:min-h-[250px]"
                      disabled={isSaving}
                      />
                  </div>
                  <p className="mt-4 text-xs text-accent">Eine strukturierte Eingabe und Verwaltung von multiplen Rollen mit spezifischen Feldern (Name, Ziele, geheime Infos etc.) wird in einem zukünftigen Schritt implementiert.</p>
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-6 lg:space-y-8">
              <Card>
                  <CardHeader>
                  <CardTitle>Szenario-Metadaten</CardTitle>
                  <CardDescription>
                      Weitere Einstellungen wie Icon, Tags und Standard-Rollenzahlen.
                  </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                      <div className="space-y-1.5">
                          <Label htmlFor="iconName">Icon Name (aus Lucide-React)</Label>
                          <Input id="iconName" value={currentScenario.iconName} disabled className="mt-1 bg-muted/80"/>
                          <p className="text-xs text-muted-foreground mt-1">Bearbeitung/Auswahl des Icons folgt später.</p>
                      </div>
                      <div className="space-y-1.5">
                          <Label htmlFor="standardRollenGesamt">Standard-Rollenzahl (gesamt inkl. Bots)</Label>
                          <Input id="standardRollenGesamt" type="number" value={currentScenario.standardRollen} disabled className="mt-1 bg-muted/80"/>
                          <p className="text-xs text-muted-foreground mt-1">Wird später basierend auf Bot-Anzahl und menschlichen Rollen berechnet.</p>
                      </div>
                      <div className="space-y-1.5">
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
                              disabled={isSaving}
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
                      <ScrollArea className="max-h-[300px] md:max-h-[400px]">
                          <pre className="mt-2 p-3 bg-muted/50 rounded-md text-xs overflow-x-auto">
                              {JSON.stringify(currentScenario, null, 2)}
                          </pre>
                      </ScrollArea>
                  </CardContent>
              </Card>
          </div>
        </div>
      </div>
    </form>
  );
}


    