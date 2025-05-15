
"use client";

import { useParams, useRouter } from 'next/navigation';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Save, PlusCircle, Trash2, NotebookPen, Tags as TagsIcon, ImageIcon as ImageIconLucide } from 'lucide-react';
import { scenarios } from '@/lib/scenarios';
import type { Scenario, BotConfig, HumanRoleConfig } from '@/lib/types';
import { botTemplates } from '@/lib/bot-templates';
import { humanRoleTemplates } from '@/lib/role-templates';
import { useEffect, useState, type FormEvent } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { tagTaxonomy } from '@/lib/tag-taxonomy';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import Image from 'next/image';


const availableIcons = [
    { value: 'ShieldAlert', label: '🛡️ ShieldAlert' },
    { value: 'Code2', label: '💻 Code2' },
    { value: 'Users', label: '👥 Users' },
    { value: 'MessageSquare', label: '💬 MessageSquare' },
    { value: 'Zap', label: '⚡ Zap' },
    { value: 'Film', label: '🎬 Film' },
    { value: 'ShoppingBag', label: '🛍️ ShoppingBag' },
    { value: 'Lock', label: '🔒 Lock' },
    { value: 'BotMessageSquare', label: '🤖 BotMessageSquare' },
    { value: 'ImageIcon', label: '🖼️ ImageIcon (Default)'}
];

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
  const [previewImageUrlInput, setPreviewImageUrlInput] = useState('');
  const [iconNameInput, setIconNameInput] = useState<string>(availableIcons[availableIcons.length -1].value); // Default to ImageIcon
  const [selectedTags, setSelectedTags] = useState<string[]>([]);


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
        setLernziele(foundScenario.lernziele?.join('\\n') || '');
        setPreviewImageUrlInput(foundScenario.previewImageUrl || '');
        setIconNameInput(foundScenario.iconName || availableIcons[availableIcons.length -1].value);
        setSelectedTags(foundScenario.tags || []);
        setEditableBotsConfig(JSON.parse(JSON.stringify(foundScenario.defaultBotsConfig || [])));
        setEditableHumanRoles(JSON.parse(JSON.stringify(foundScenario.humanRolesConfig || [])));
      } else {
        setCurrentScenario(null); // Scenario not found
      }
    }
    setIsLoading(false);
  }, [scenarioId]);

  const handleBotConfigChange = (index: number, field: keyof BotConfig, value: any) => {
    const updatedBots = [...editableBotsConfig];
    if (updatedBots[index]) {
        (updatedBots[index] as any)[field] = value;
        setEditableBotsConfig(updatedBots);
    }
  };

  const handleAddBot = () => {
    setEditableBotsConfig([...editableBotsConfig, {
        id: `bot-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        name: "Neuer Bot",
        personality: "standard",
        avatarFallback: "NB",
        currentEscalation: 0,
        isActive: true,
        initialMission: "",
        autoTimerEnabled: false,
    }]);
  };

  const handleAddBotFromTemplate = (templateId: string) => {
    const template = botTemplates.find(t => t.templateId === templateId);
    if (template) {
      setEditableBotsConfig([...editableBotsConfig, {
        ...template,
        id: `bot-tpl-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, // Ensure unique ID for scenario instance
      }]);
    }
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
        id: `role-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        name: "Neue Rolle",
        description: "Beschreibung der neuen Rolle..."
    }]);
  };

  const handleAddHumanRoleFromTemplate = (templateId: string) => {
    const template = humanRoleTemplates.find(t => t.templateId === templateId);
    if (template) {
      setEditableHumanRoles([...editableHumanRoles, {
        ...template,
        id: `role-tpl-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, // Ensure unique ID for scenario instance
      }]);
    }
  };

  const handleRemoveHumanRole = (index: number) => {
    const updatedRoles = editableHumanRoles.filter((_, i) => i !== index);
    setEditableHumanRoles(updatedRoles);
  };

  const handleTagToggle = (tagName: string) => {
    setSelectedTags(prevTags =>
      prevTags.includes(tagName)
        ? prevTags.filter(t => t !== tagName)
        : [...prevTags, tagName]
    );
  };


  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentScenario) return;
    setIsSaving(true);

    const updatedScenarioData: Scenario = {
      ...currentScenario, // Preserve other fields like id
      title,
      kurzbeschreibung,
      langbeschreibung,
      lernziele: lernziele.split('\\n').map(ziel => ziel.trim()).filter(ziel => ziel),
      previewImageUrl: previewImageUrlInput,
      iconName: iconNameInput,
      tags: selectedTags,
      defaultBotsConfig: editableBotsConfig,
      humanRolesConfig: editableHumanRoles,
      defaultBots: editableBotsConfig.length,
      standardRollen: editableBotsConfig.length + editableHumanRoles.length, // Ensure this is correctly calculated
    };

    console.log("Saving scenario (ID: ", currentScenario.id, "):");
    console.log(JSON.stringify(updatedScenarioData, null, 2));

    // Simulate saving to a database or updating a global state
    // For now, we just log to console and show a toast
    setTimeout(() => {
      toast({
        title: "Szenario gespeichert (Simulation)",
        description: `Änderungen für "${title}" wurden in der Konsole geloggt. In einer echten Anwendung würden sie in einer Datenbank gespeichert.`,
      });
      setIsSaving(false);
      // Optional: Update currentScenario state to reflect saved data if not redirecting
      // setCurrentScenario(updatedScenarioData);
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
            Zur Szenarienübersicht
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
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-primary truncate max-w-xs sm:max-w-md md:max-w-lg flex items-center">
            <NotebookPen className="mr-3 h-6 w-6" />
            Editor: <span className="text-foreground ml-2">{title || currentScenario.title}</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5 ml-9">
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

          {/* Linke Spalte: Basisinfos, Bots, Menschliche Rollen */}
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
                  <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ein prägnanter Titel" disabled={isSaving}/>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="kurzbeschreibung">Kurzbeschreibung (für Übersichtskarten)</Label>
                  <Textarea id="kurzbeschreibung" value={kurzbeschreibung} onChange={(e) => setKurzbeschreibung(e.target.value)} placeholder="Eine kurze Zusammenfassung (ca. 1-2 Sätze)." rows={3} disabled={isSaving}/>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="langbeschreibung">Langbeschreibung / Szenariokontext (für Simulation)</Label>
                  <Textarea id="langbeschreibung" value={langbeschreibung} onChange={(e) => setLangbeschreibung(e.target.value)} placeholder="Ausführliche Beschreibung der Ausgangslage, Thema, beteiligte Akteure etc. Dies ist der Hauptkontext für die Simulation und die Bots." rows={10} className="min-h-[200px] md:min-h-[250px]" disabled={isSaving}/>
                  <p className="text-xs text-muted-foreground">Markdown-Formatierung wird später unterstützt.</p>
                </div>
                 <div className="space-y-1.5">
                  <Label htmlFor="lernziele">Lernziele (ein Ziel pro Zeile)</Label>
                  <Textarea id="lernziele" value={lernziele} onChange={(e) => setLernziele(e.target.value)} placeholder="Was sollen die Teilnehmenden lernen?&#10;- Ziel 1&#10;- Ziel 2" rows={5} className="min-h-[100px]" disabled={isSaving}/>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Bot-Konfiguration</CardTitle>
                    <CardDescription>Standard-Bots für dieses Szenario. (ID: {currentScenario.id})</CardDescription>
                </div>
                <div className="flex gap-2">
                    <Select onValueChange={handleAddBotFromTemplate} disabled={isSaving}>
                        <SelectTrigger className="w-[230px] text-sm h-9">
                            <SelectValue placeholder="Bot aus Vorlage wählen..." />
                        </SelectTrigger>
                        <SelectContent>
                            {botTemplates.map(template => (
                                <SelectItem key={template.templateId} value={template.templateId!}>{template.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button type="button" size="sm" variant="outline" onClick={handleAddBot} disabled={isSaving}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Bot manuell
                    </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {editableBotsConfig.length > 0 ? (
                  editableBotsConfig.map((bot, index) => (
                    <Card key={bot.id || `bot-${index}`} className="p-4 bg-muted/20">
                      <CardHeader className="p-0 pb-4 flex flex-row items-center justify-between">
                        <CardTitle className="text-md">Bot {index + 1} (ID: <span className="font-mono text-xs">{bot.id}</span>)</CardTitle>
                        <Button type="button" variant="ghost" size="icon" className="text-destructive hover:text-destructive/80 h-7 w-7" onClick={() => handleRemoveBot(index)} disabled={isSaving}>
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
                          <Label htmlFor={`bot-avatar-${index}`}>Avatar Kürzel (max. 2 Zeichen)</Label>
                          <Input id={`bot-avatar-${index}`} value={bot.avatarFallback || ''} onChange={(e) => handleBotConfigChange(index, 'avatarFallback', e.target.value.substring(0,2))} placeholder="BK" maxLength={2} disabled={isSaving}/>
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
                  <p className="text-muted-foreground">Keine Bots für dieses Szenario konfiguriert. Fügen Sie einen Bot manuell oder aus einer Vorlage hinzu.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Rollen für menschliche Teilnehmer</CardTitle>
                    <CardDescription>Definition der Rollen, ihrer Ziele und Informationen.</CardDescription>
                </div>
                 <div className="flex gap-2">
                    <Select onValueChange={handleAddHumanRoleFromTemplate} disabled={isSaving}>
                        <SelectTrigger className="w-[230px] text-sm h-9">
                            <SelectValue placeholder="Rolle aus Vorlage wählen..." />
                        </SelectTrigger>
                        <SelectContent>
                            {humanRoleTemplates.map(template => (
                                <SelectItem key={template.templateId} value={template.templateId!}>{template.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button type="button" size="sm" variant="outline" onClick={handleAddHumanRole} disabled={isSaving}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Rolle manuell
                    </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {editableHumanRoles.length > 0 ? (
                  editableHumanRoles.map((role, index) => (
                    <Card key={role.id || `role-${index}`} className="p-4 bg-muted/20">
                       <CardHeader className="p-0 pb-4 flex flex-row items-center justify-between">
                        <CardTitle className="text-md">Rolle {index + 1} (ID: <span className="font-mono text-xs">{role.id}</span>)</CardTitle>
                        <Button type="button" variant="ghost" size="icon" className="text-destructive hover:text-destructive/80 h-7 w-7" onClick={() => handleRemoveHumanRole(index)} disabled={isSaving}>
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
                            <Textarea id={`role-description-${index}`} value={role.description} onChange={(e) => handleHumanRoleChange(index, 'description', e.target.value)} placeholder="Detailbeschreibung der Rolle, ihrer Ziele, Startinformationen, geheime Infos etc. Dies wird dem Teilnehmer angezeigt." rows={8} className="min-h-[150px]" disabled={isSaving}/>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                     <p className="text-muted-foreground">Keine menschlichen Rollen für dieses Szenario konfiguriert. Fügen Sie eine Rolle manuell oder aus einer Vorlage hinzu.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Rechte Spalte: Metadaten, Tags, Originaldaten */}
          <div className="space-y-6 lg:space-y-8">
              <Card>
                  <CardHeader>
                  <CardTitle>Szenario-Metadaten</CardTitle>
                  <CardDescription>Weitere Einstellungen wie Icon und Vorschaubild.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                      <div className="space-y-1.5">
                          <Label htmlFor="previewImageUrlInput">Vorschaubild URL</Label>
                          <Input id="previewImageUrlInput" value={previewImageUrlInput} onChange={(e) => setPreviewImageUrlInput(e.target.value)} placeholder="https://beispiel.com/bild.png" disabled={isSaving} className="mt-1"/>
                          <p className="text-xs text-muted-foreground mt-1">URL zu einem Bild, das in der Szenario-Übersicht angezeigt wird.</p>
                      </div>
                      <div className="space-y-1.5">
                          <Label htmlFor="iconNameInput">Icon Name (aus Lucide-React)</Label>
                          <Select value={iconNameInput} onValueChange={setIconNameInput} disabled={isSaving}>
                            <SelectTrigger id="iconNameInput" className="mt-1">
                                <SelectValue placeholder="Icon wählen..." />
                            </SelectTrigger>
                            <SelectContent>
                                {availableIcons.map(icon => (
                                    <SelectItem key={icon.value} value={icon.value}>{icon.label}</SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground mt-1">Wählen Sie ein passendes Icon für das Szenario.</p>
                      </div>
                       <div className="space-y-1.5">
                          <Label htmlFor="standardRollenGesamt">Standard-Rollenzahl (gesamt)</Label>
                          <Input id="standardRollenGesamt" type="number" value={editableBotsConfig.length + editableHumanRoles.length} disabled className="mt-1 bg-muted/80"/>
                          <p className="text-xs text-muted-foreground mt-1">Wird automatisch aus Bot-Anzahl und menschlichen Rollen berechnet.</p>
                      </div>
                  </CardContent>
              </Card>

              <Card>
                <CardHeader>
                    <CardTitle className="flex items-center"><TagsIcon className="mr-2 h-5 w-5" />Themen-Tags</CardTitle>
                    <CardDescription>Weisen Sie dem Szenario passende Tags zu.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="mb-4">
                        <Label>Ausgewählte Tags:</Label>
                        {selectedTags.length > 0 ? (
                            <div className="flex flex-wrap gap-2 mt-2">
                                {selectedTags.map(tag => (
                                    <Badge key={tag} variant="secondary" className="cursor-pointer hover:bg-destructive/80 hover:text-destructive-foreground" onClick={() => handleTagToggle(tag)}>
                                        {tag} <Trash2 className="ml-1.5 h-3 w-3" />
                                    </Badge>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-muted-foreground mt-1">Keine Tags ausgewählt.</p>
                        )}
                    </div>
                    <Separator className="my-4" />
                    <Label>Verfügbare Tags (Klicken zum Hinzufügen):</Label>
                    <Accordion type="multiple" className="w-full mt-2">
                        {tagTaxonomy.map((category, catIndex) => (
                            <AccordionItem value={`category-${catIndex}`} key={category.categoryName}>
                                <AccordionTrigger className="text-sm font-medium py-2">
                                    {category.emoji && <span className="mr-2">{category.emoji}</span>}
                                    {category.categoryName}
                                </AccordionTrigger>
                                <AccordionContent className="pt-1 pb-2 pl-2">
                                    <div className="flex flex-wrap gap-2">
                                        {category.tags.map(tag => (
                                            <>
                                                <Badge
                                                    key={tag.name}
                                                    variant={selectedTags.includes(tag.name) ? "default" : "outline"}
                                                    className="cursor-pointer hover:bg-primary/80"
                                                    onClick={() => handleTagToggle(tag.name)}
                                                >
                                                    {tag.emoji && <span className="mr-1.5">{tag.emoji}</span>}
                                                    {tag.name}
                                                </Badge>
                                                {/* For now, only display first-level subTags. Deeper nesting UI later. */}
                                                {tag.subTags && tag.subTags.slice(0,5).map(subTag => (
                                                     <Badge
                                                        key={subTag.name}
                                                        variant={selectedTags.includes(subTag.name) ? "default" : "outline"}
                                                        className="cursor-pointer hover:bg-primary/80 ml-2 text-xs"
                                                        onClick={() => handleTagToggle(subTag.name)}
                                                    >
                                                        {subTag.emoji && <span className="mr-1">{subTag.emoji}</span>}
                                                        {subTag.name}
                                                    </Badge>
                                                ))}
                                                {tag.subTags && tag.subTags.length > 5 && <span className="text-xs text-muted-foreground ml-2">...</span>}
                                            </>
                                        ))}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                    <p className="text-xs text-muted-foreground mt-3">Das Tag-System wird weiter ausgebaut (tiefere Verschachtelung, Suche etc.).</p>
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
