
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
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    if (scenarioId) {
      const foundScenario = scenarios.find(s => s.id === scenarioId);
      setCurrentScenario(foundScenario);
      if (foundScenario) {
        setTitle(foundScenario.title);
        setKurzbeschreibung(foundScenario.kurzbeschreibung);
        setLangbeschreibung(foundScenario.langbeschreibung);
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
      // Keep other properties from original scenario for now
      defaultBots: currentScenario.defaultBots,
      standardRollen: currentScenario.standardRollen,
      iconName: currentScenario.iconName,
      tags: currentScenario.tags,
      defaultBotsConfig: currentScenario.defaultBotsConfig,
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
              Das Szenario mit der ID &quot;{scenarioId}&quot; konnte nicht gefunden werden.
            </p>
          </div>
          <Button variant="outline" onClick={() => router.push('/admin')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Zurück zu den Szenarien
          </Button>
        </div>
        <Separator />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">
            Szenario bearbeiten: <span className="text-foreground">{currentScenario.title}</span>
          </h1>
          <p className="text-muted-foreground mt-2">
            ID: {currentScenario.id}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" type="button" onClick={() => router.push('/admin')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Zurück zu den Szenarien
          </Button>
          <Button type="submit" disabled={isSaving}>
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? "Speichert..." : "Änderungen speichern"}
          </Button>
        </div>
      </div>
      <Separator />
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Basisinformationen</CardTitle>
              <CardDescription>
                Grundlegende Details des Szenarios.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="title">Titel</Label>
                <Input 
                  id="title" 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)} 
                  placeholder="Titel des Szenarios"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="kurzbeschreibung">Kurzbeschreibung</Label>
                <Textarea 
                  id="kurzbeschreibung" 
                  value={kurzbeschreibung} 
                  onChange={(e) => setKurzbeschreibung(e.target.value)} 
                  placeholder="Eine kurze Zusammenfassung für die Übersichtskarten."
                  rows={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="langbeschreibung">Langbeschreibung / Szenariokontext</Label>
                <Textarea 
                  id="langbeschreibung" 
                  value={langbeschreibung} 
                  onChange={(e) => setLangbeschreibung(e.target.value)} 
                  placeholder="Ausführliche Beschreibung der Ausgangslage, Thema, Lernziele etc."
                  rows={8}
                  className="min-h-[200px]"
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
                <ul className="space-y-3">
                  {currentScenario.defaultBotsConfig.map((bot, index) => (
                    <li key={bot.id || `bot-${index}`} className="p-3 border rounded-md bg-muted/50">
                      <p className="font-semibold">Bot {index + 1}: ID <span className="font-mono text-xs bg-background p-0.5 rounded">{bot.id}</span></p>
                      <p className="text-sm">Persönlichkeit: <span className="font-medium">{bot.personality}</span></p>
                      {bot.name && <p className="text-sm">Name: <span className="font-medium">{bot.name}</span></p>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">Keine Standard-Bots für dieses Szenario konfiguriert.</p>
              )}
              <p className="mt-4 text-sm text-orange-500">Die Bearbeitung von Bot-Konfigurationen ist hier noch nicht implementiert.</p>
            </CardContent>
          </Card>

        </div>

        <div className="space-y-6">
            <Card>
                <CardHeader>
                <CardTitle>Weitere Einstellungen</CardTitle>
                <CardDescription>
                    Parameter wie Rollen, Tags etc. (Aktuell nur Anzeige)
                </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div>
                        <Label>Icon Name</Label>
                        <Input value={currentScenario.iconName} disabled className="mt-1 bg-muted"/>
                    </div>
                    <div>
                        <Label>Standard Rollen (gesamt)</Label>
                        <Input type="number" value={currentScenario.standardRollen} disabled className="mt-1 bg-muted"/>
                    </div>
                    <div>
                        <Label>Anzahl Default Bots</Label>
                        <Input type="number" value={currentScenario.defaultBots} disabled className="mt-1 bg-muted"/>
                    </div>
                    <div>
                        <Label>Tags</Label>
                        <div className="mt-1 p-2 border rounded-md bg-muted min-h-[40px]">
                        {currentScenario.tags.join(', ')}
                        </div>
                    </div>
                    <p className="mt-4 text-sm text-orange-500">Die Bearbeitung dieser Einstellungen ist hier noch nicht implementiert.</p>
                </CardContent>
            </Card>
             <Card>
                <CardHeader>
                    <CardTitle>Originaldaten (aus `scenarios.ts`)</CardTitle>
                </CardHeader>
                <CardContent>
                    <pre className="mt-2 p-3 bg-muted rounded-md text-sm overflow-x-auto max-h-96">
                        {JSON.stringify(currentScenario, null, 2)}
                    </pre>
                </CardContent>
            </Card>
        </div>
      </div>
    </form>
  );
}
