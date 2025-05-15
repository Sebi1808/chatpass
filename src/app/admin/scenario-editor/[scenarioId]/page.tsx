
"use client";

import { useParams, useRouter } from 'next/navigation';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Save, PlusCircle, Trash2 } from 'lucide-react';
import { scenarios } from '@/lib/scenarios';
import type { Scenario, BotConfig, HumanRoleConfig } from '@/lib/types';
import { useEffect, useState, type FormEvent, type ChangeEvent } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function EditScenarioPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const scenarioId = params.scenarioId as string;

  const [currentScenario, setCurrentScenario] = useState<Scenario | null>(null);
  const [title, setTitle] = useState('');
  const [kurzbeschreibung, setKurzbeschreibung] = useState('');
  const [langbeschreibung, setLangbeschreibung] = useState('');
  const [lernziele, setLernziele] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  
  const [editableBotsConfig, setEditableBotsConfig] = useState<BotConfig[]>([]);
  const [editableHumanRoles, setEditableHumanRoles] = useState<HumanRoleConfig[]>([]);


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
        setEditableBotsConfig(JSON.parse(JSON.stringify(foundScenario.defaultBotsConfig || []))); // Deep copy
        setEditableHumanRoles(JSON.parse(JSON.stringify(foundScenario.humanRolesConfig || []))); // Deep copy
      } else {
        setCurrentScenario(null); // Scenario not found
      }
    }
    setIsLoading(false);
  }, [scenarioId]);

  const handleBotConfigChange = (index: number, field: keyof BotConfig, value: any) => {
    const updatedBots = [...editableBotsConfig];
    // Ensure the bot object and the field exist
    if (updatedBots[index]) {
        (updatedBots[index] as any)[field] = value;
        setEditableBotsConfig(updatedBots);
    }
  };

  const handleAddBot = () => {
    setEditableBotsConfig([...editableBotsConfig, {
        id: `new-bot-${Date.now()}`, // Simple unique ID for now
        name: "Neuer Bot",
        personality: "standard",
        avatarFallback: "NB",
        currentEscalation: 0,
        isActive: true,
        initialMission: ""
    }]);
  };

  const handleRemoveBot = (index: number) => {
    const updatedBots = editableBotsConfig.filter((_, i) => i !== index);
    setEditableBotsConfig(updatedBots);
  };
  
  const handleHumanRoleChange = (index: number, field: keyof HumanRoleConfig, value: string) => {
    const updatedRoles = [...editableHumanRoles];
    if (updatedRoles[index]) {
        (updatedRoles[index] as any)[field] = value;
        setEditableHumanRoles(updatedRoles);
    }
  };

  const handleAddHumanRole = () => {
    setEditableHumanRoles([...editableHumanRoles, {
        id: `new-role-${Date.now()}`,
        name: "Neue Rolle",
        description: "Beschreibung der neuen Rolle..."
    }]);
  };

  const handleRemoveHumanRole = (index: number) => {
    const updatedRoles = editableHumanRoles.filter((_, i) => i !== index);
    setEditableHumanRoles(updatedRoles);
  };


  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentScenario) return;
    setIsSaving(true);

    const updatedScenarioData = {
      id: currentScenario.id,
      title,
      kurzbeschreibung,
      langbeschreibung,
      lernziele: lernziele.split('\n').map(ziel => ziel.trim()).filter(ziel => ziel),
      tags: tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag),
      iconName: currentScenario.iconName, // Not editable for now
      // Calculate defaultBots and standardRollen based on editable configs if needed, or keep static for now
      defaultBots: editableBotsConfig.length, 
      standardRollen: currentScenario.standardRollen, // This might need adjustment based on human roles count
      defaultBotsConfig: editableBotsConfig,
      humanRolesConfig: editableHumanRoles,
    };

    console.log("Saving scenario (ID: ", currentScenario.id, "):");
    console.log(JSON.stringify(updatedScenarioData, null, 2));

    setTimeout(() => {
      toast({
        title: "Szenario gespeichert (Simulation)",
        description: `Änderungen für "${title}" wurden in der Konsole geloggt. In einer echten Anwendung würden sie in einer Datenbank gespeichert.`,
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
            Editor: <span className="text-foreground">{title || currentScenario.title}</span>
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
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Bot-Konfiguration</CardTitle>
                    <CardDescription>
                    Standard-Bots für dieses Szenario.
                    </CardDescription>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={handleAddBot} disabled={isSaving}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Bot hinzufügen
                </Button>
              </CardHeader>
              <CardContent className="space-y-6">
                {editableBotsConfig.length > 0 ? (
                  editableBotsConfig.map((bot, index) => (
                    <Card key={bot.id || `bot-${index}`} className="p-4 bg-muted/20">
                      <CardHeader className="p-0 pb-4 flex flex-row items-center justify-between">
                        <CardTitle className="text-md">Bot {index + 1} (ID: <span className="font-mono text-xs">{bot.id}</span>)</CardTitle>
                        <Button type="button" variant="ghost" size="icon" className="text-destructive h-7 w-7" onClick={() => handleRemoveBot(index)} disabled={isSaving}>
                            <Trash2 className="h-4 w-4"/>
                        </Button>
                      </CardHeader>
                      <CardContent className="p-0 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label htmlFor={`bot-name-${index}`}>Anzeigename</Label>
                          <Input id={`bot-name-${index}`} value={bot.name || ''} onChange={(e) => handleBotConfigChange(index, 'name', e.target.value)} placeholder="z.B. Bot Kevin" disabled={isSaving}/>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`bot-personality-${index}`}>Persönlichkeit</Label>
                          <Select value={bot.personality} onValueChange={(value) => handleBotConfigChange(index, 'personality', value)} disabled={isSaving}>
                            <SelectTrigger id={`bot-personality-${index}`}>
                              <SelectValue placeholder="Persönlichkeit wählen" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="standard">Standard</SelectItem>
                              <SelectItem value="provokateur">Provokateur</SelectItem>
                              <SelectItem value="verteidiger">Verteidiger</SelectItem>
                              <SelectItem value="informant">Informant</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`bot-avatar-${index}`}>Avatar Kürzel (2 Zeichen)</Label>
                          <Input id={`bot-avatar-${index}`} value={bot.avatarFallback || ''} onChange={(e) => handleBotConfigChange(index, 'avatarFallback', e.target.value)} placeholder="BK" maxLength={2} disabled={isSaving}/>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`bot-escalation-${index}`}>Initiale Eskalation (0-3)</Label>
                          <Input id={`bot-escalation-${index}`} type="number" min="0" max="3" value={bot.currentEscalation ?? 0} onChange={(e) => handleBotConfigChange(index, 'currentEscalation', parseInt(e.target.value, 10))} disabled={isSaving}/>
                        </div>
                        <div className="space-y-1.5 md:col-span-2">
                           <Label htmlFor={`bot-initialMission-${index}`}>Initiale Mission/Anweisung</Label>
                           <Textarea id={`bot-initialMission-${index}`} value={bot.initialMission || ''} onChange={(e) => handleBotConfigChange(index, 'initialMission', e.target.value)} placeholder="Was soll der Bot zu Beginn tun oder sagen?" rows={3} disabled={isSaving}/>
                        </div>
                        <div className="flex items-center space-x-2 pt-2">
                          <Switch id={`bot-isActive-${index}`} checked={bot.isActive ?? true} onCheckedChange={(checked) => handleBotConfigChange(index, 'isActive', checked)} disabled={isSaving}/>
                          <Label htmlFor={`bot-isActive-${index}`}>Standardmäßig aktiv</Label>
                        </div>
                        <div className="flex items-center space-x-2 pt-2">
                          <Switch id={`bot-autoTimer-${index}`} checked={bot.autoTimerEnabled ?? false} onCheckedChange={(checked) => handleBotConfigChange(index, 'autoTimerEnabled', checked)} disabled={isSaving}/>
                          <Label htmlFor={`bot-autoTimer-${index}`}>Auto-Timer aktiviert (Zukunft)</Label>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <p className="text-muted-foreground">Keine Bots für dieses Szenario konfiguriert. Klicken Sie auf "Bot hinzufügen".</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Rollen für menschliche Teilnehmer</CardTitle>
                    <CardDescription>
                    Definition der Rollen, ihrer Ziele und Informationen.
                    </CardDescription>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={handleAddHumanRole} disabled={isSaving}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Rolle hinzufügen
                </Button>
              </CardHeader>
              <CardContent className="space-y-6">
                {editableHumanRoles.length > 0 ? (
                  editableHumanRoles.map((role, index) => (
                    <Card key={role.id || `role-${index}`} className="p-4 bg-muted/20">
                       <CardHeader className="p-0 pb-4 flex flex-row items-center justify-between">
                        <CardTitle className="text-md">Rolle {index + 1} (ID: <span className="font-mono text-xs">{role.id}</span>)</CardTitle>
                        <Button type="button" variant="ghost" size="icon" className="text-destructive h-7 w-7" onClick={() => handleRemoveHumanRole(index)} disabled={isSaving}>
                            <Trash2 className="h-4 w-4"/>
                        </Button>
                      </CardHeader>
                      <CardContent className="p-0 space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor={`role-name-${index}`}>Rollenname</Label>
                            <Input id={`role-name-${index}`} value={role.name} onChange={(e) => handleHumanRoleChange(index, 'name', e.target.value)} placeholder="z.B. Angegriffene Person" disabled={isSaving}/>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor={`role-description-${index}`}>Rollenbeschreibung (Ziele, Infos etc.)</Label>
                            <Textarea 
                                id={`role-description-${index}`} 
                                value={role.description} 
                                onChange={(e) => handleHumanRoleChange(index, 'description', e.target.value)} 
                                placeholder="Detailbeschreibung der Rolle, ihrer Ziele, Startinformationen, geheime Infos etc. Dies wird dem Teilnehmer angezeigt."
                                rows={8}
                                className="min-h-[150px]"
                                disabled={isSaving}
                            />
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                     <p className="text-muted-foreground">Keine menschlichen Rollen für dieses Szenario konfiguriert. Klicken Sie auf "Rolle hinzufügen".</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6 lg:space-y-8">
              <Card>
                  <CardHeader>
                  <CardTitle>Szenario-Metadaten</CardTitle>
                  <CardDescription>
                      Weitere Einstellungen wie Icon und Tags.
                  </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                      <div className="space-y-1.5">
                          <Label htmlFor="iconName">Icon Name (aus Lucide-React)</Label>
                          <Input id="iconName" value={currentScenario.iconName || ''} disabled className="mt-1 bg-muted/80"/>
                          <p className="text-xs text-muted-foreground mt-1">Bearbeitung/Auswahl des Icons folgt später.</p>
                      </div>
                       <div className="space-y-1.5">
                          <Label htmlFor="standardRollenGesamt">Standard-Rollenzahl (gesamt)</Label>
                          <Input id="standardRollenGesamt" type="number" value={currentScenario.standardRollen} disabled className="mt-1 bg-muted/80"/>
                          <p className="text-xs text-muted-foreground mt-1">Wird später basierend auf Bot-Anzahl und menschlichen Rollen berechnet.</p>
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
    