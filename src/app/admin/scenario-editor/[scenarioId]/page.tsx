
"use client";

import { useParams, useRouter } from 'next/navigation';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Save, PlusCircle, Trash2, NotebookPen, Tags as TagsIcon, ImageIcon as ImageIconLucide, FileText, Bot as BotIconLucide, Users as UsersIconLucide, Settings as SettingsIcon, Database, X } from 'lucide-react';
import { scenarios } from '@/lib/scenarios';
import type { Scenario, BotConfig, HumanRoleConfig } from '@/lib/types';
import { botTemplates } from '@/lib/bot-templates';
import { humanRoleTemplates } from '@/lib/role-templates';
import React, { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { tagTaxonomy } from '@/lib/tag-taxonomy';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

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

const editorSections = [
  { id: "basisinfo", label: "Basisinfos", icon: <FileText className="mr-2 h-4 w-4" /> },
  { id: "botconfig", label: "Bot-Konfiguration", icon: <BotIconLucide className="mr-2 h-4 w-4" /> },
  { id: "humanroles", label: "Menschliche Rollen", icon: <UsersIconLucide className="mr-2 h-4 w-4" /> },
  { id: "metadaten", label: "Metadaten", icon: <SettingsIcon className="mr-2 h-4 w-4" /> },
  { id: "tags", label: "Themen-Tags", icon: <TagsIcon className="mr-2 h-4 w-4" /> },
  { id: "originaldaten", label: "Originaldaten", icon: <Database className="mr-2 h-4 w-4" /> },
];

const createDefaultScenario = (): Scenario => ({
  id: `new-${Date.now()}`, // Temporary ID for new scenarios
  title: '',
  kurzbeschreibung: '',
  langbeschreibung: '',
  lernziele: [],
  iconName: availableIcons[availableIcons.length - 1].value, // Default icon
  tags: [],
  previewImageUrl: '',
  defaultBots: 0, // Will be derived
  standardRollen: 0, // Will be derived
  defaultBotsConfig: [],
  humanRolesConfig: [],
});


export default function EditScenarioPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const scenarioId = params.scenarioId as string;

  const [isNewScenario, setIsNewScenario] = useState(false);
  const [currentScenario, setCurrentScenario] = useState<Scenario | null>(null);
  const [originalScenarioData, setOriginalScenarioData] = useState<Scenario | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [kurzbeschreibung, setKurzbeschreibung] = useState('');
  const [langbeschreibung, setLangbeschreibung] = useState('');
  const [lernziele, setLernziele] = useState(''); // Joined by \n for textarea
  const [previewImageUrlInput, setPreviewImageUrlInput] = useState('');
  const [iconNameInput, setIconNameInput] = useState<string>(availableIcons[availableIcons.length -1].value);
  
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [manualTagInput, setManualTagInput] = useState('');
  
  const [editableBotsConfig, setEditableBotsConfig] = useState<BotConfig[]>([]);
  const [editableHumanRoles, setEditableHumanRoles] = useState<HumanRoleConfig[]>([]);
  const [botSaveAsTemplateFlags, setBotSaveAsTemplateFlags] = useState<Record<string, boolean>>({});
  const [roleSaveAsTemplateFlags, setRoleSaveAsTemplateFlags] = useState<Record<string, boolean>>({});

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    if (scenarioId) {
      if (scenarioId === 'new') {
        const newScenario = createDefaultScenario();
        setCurrentScenario(newScenario);
        setOriginalScenarioData(JSON.parse(JSON.stringify(newScenario))); // Store a copy
        setTitle(newScenario.title);
        setKurzbeschreibung(newScenario.kurzbeschreibung);
        setLangbeschreibung(newScenario.langbeschreibung);
        setLernziele((newScenario.lernziele || []).join('\n'));
        setPreviewImageUrlInput(newScenario.previewImageUrl || '');
        setIconNameInput(newScenario.iconName || availableIcons[availableIcons.length - 1].value);
        setSelectedTags(newScenario.tags || []);
        setEditableBotsConfig(JSON.parse(JSON.stringify(newScenario.defaultBotsConfig || [])));
        setEditableHumanRoles(JSON.parse(JSON.stringify(newScenario.humanRolesConfig || [])));
        setIsNewScenario(true);
      } else {
        const foundScenario = scenarios.find(s => s.id === scenarioId);
        if (foundScenario) {
          setCurrentScenario(foundScenario);
          setOriginalScenarioData(JSON.parse(JSON.stringify(foundScenario))); // Store a copy
          setTitle(foundScenario.title);
          setKurzbeschreibung(foundScenario.kurzbeschreibung);
          setLangbeschreibung(foundScenario.langbeschreibung);
          setLernziele(foundScenario.lernziele?.join('\n') || '');
          setPreviewImageUrlInput(foundScenario.previewImageUrl || '');
          setIconNameInput(foundScenario.iconName || availableIcons[availableIcons.length -1].value);
          setSelectedTags(foundScenario.tags || []);
          
          const initialBotFlags: Record<string, boolean> = {};
          (foundScenario.defaultBotsConfig || []).forEach(bot => initialBotFlags[bot.id] = false);
          setBotSaveAsTemplateFlags(initialBotFlags);

          const initialRoleFlags: Record<string, boolean> = {};
          (foundScenario.humanRolesConfig || []).forEach(role => initialRoleFlags[role.id] = false);
          setRoleSaveAsTemplateFlags(initialRoleFlags);

          setEditableBotsConfig(JSON.parse(JSON.stringify(foundScenario.defaultBotsConfig || [])));
          setEditableHumanRoles(JSON.parse(JSON.stringify(foundScenario.humanRolesConfig || [])));
          setIsNewScenario(false);
        } else {
          setCurrentScenario(null);
          setOriginalScenarioData(null);
           toast({
            variant: "destructive",
            title: "Fehler: Szenario nicht gefunden",
            description: `Das Szenario mit der ID "${scenarioId}" konnte nicht geladen werden.`,
          });
        }
      }
    }
    setIsLoading(false);
  }, [scenarioId, toast]);

  const handleBotConfigChange = (index: number, field: keyof BotConfig, value: any) => {
    const updatedBots = [...editableBotsConfig];
    if (updatedBots[index]) {
        (updatedBots[index] as any)[field] = value;
        setEditableBotsConfig(updatedBots);
    }
  };

  const handleAddBot = () => {
    const newBotId = `bot-man-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    setEditableBotsConfig([...editableBotsConfig, {
        id: newBotId, 
        name: "Neuer Bot",
        personality: "standard",
        avatarFallback: "NB",
        currentEscalation: 0,
        isActive: true,
        initialMission: "",
        autoTimerEnabled: false,
    }]);
    setBotSaveAsTemplateFlags(prev => ({ ...prev, [newBotId]: false }));
  };

  const handleAddBotFromTemplate = (templateId: string) => {
    const template = botTemplates.find(t => t.templateId === templateId);
    if (template) {
      const newBotId = `bot-tpl-${template.templateId}-${Date.now()}`; // More unique ID
      setEditableBotsConfig([...editableBotsConfig, {
        ...template, 
        id: newBotId, 
        templateId: template.templateId, 
      }]);
      setBotSaveAsTemplateFlags(prev => ({ ...prev, [newBotId]: false }));
    }
  };

  const handleRemoveBot = (index: number) => {
    const botToRemoveId = editableBotsConfig[index]?.id;
    const updatedBots = editableBotsConfig.filter((_, i) => i !== index);
    setEditableBotsConfig(updatedBots);
    if (botToRemoveId) {
        setBotSaveAsTemplateFlags(prev => {
            const newFlags = {...prev};
            delete newFlags[botToRemoveId];
            return newFlags;
        });
    }
  };

  const handleBotSaveAsTemplateToggle = (botId: string) => {
    setBotSaveAsTemplateFlags(prev => ({ ...prev, [botId]: !prev[botId] }));
  };

  const handleHumanRoleChange = (index: number, field: keyof HumanRoleConfig, value: string) => {
    const updatedRoles = [...editableHumanRoles];
    if (updatedRoles[index]) {
        (updatedRoles[index] as any)[field] = value;
        setEditableHumanRoles(updatedRoles);
    }
  };

  const handleAddHumanRole = () => {
    const newRoleId = `role-man-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    setEditableHumanRoles([...editableHumanRoles, {
        id: newRoleId, 
        name: "Neue Rolle",
        description: "Beschreibung der neuen Rolle..."
    }]);
    setRoleSaveAsTemplateFlags(prev => ({ ...prev, [newRoleId]: false }));
  };

  const handleAddHumanRoleFromTemplate = (templateId: string) => {
    const template = humanRoleTemplates.find(t => t.templateId === templateId);
    if (template) {
      const newRoleId = `role-tpl-${template.templateId}-${Date.now()}`; // More unique ID
      setEditableHumanRoles([...editableHumanRoles, {
        ...template, 
        id: newRoleId, 
        templateId: template.templateId, 
      }]);
      setRoleSaveAsTemplateFlags(prev => ({ ...prev, [newRoleId]: false }));
    }
  };

  const handleRemoveHumanRole = (index: number) => {
    const roleToRemoveId = editableHumanRoles[index]?.id;
    const updatedRoles = editableHumanRoles.filter((_, i) => i !== index);
    setEditableHumanRoles(updatedRoles);
     if (roleToRemoveId) {
        setRoleSaveAsTemplateFlags(prev => {
            const newFlags = {...prev};
            delete newFlags[roleToRemoveId];
            return newFlags;
        });
    }
  };

  const handleRoleSaveAsTemplateToggle = (roleId: string) => {
    setRoleSaveAsTemplateFlags(prev => ({ ...prev, [roleId]: !prev[roleId] }));
  };


  const handleTagToggle = (tagName: string) => {
    setSelectedTags(prevTags =>
      prevTags.includes(tagName)
        ? prevTags.filter(t => t !== tagName)
        : [...prevTags, tagName]
    );
  };

  const processManualTagInput = () => {
    if (!manualTagInput.trim()) return;
    const newTags = manualTagInput
      .split(',')
      .map(tag => tag.trim().toLowerCase()) // Standardize to lowercase
      .filter(tag => tag !== '' && !selectedTags.includes(tag)); 
    
    if (newTags.length > 0) {
      setSelectedTags(prevTags => [...prevTags, ...newTags]);
    }
    setManualTagInput('');
  };

  const handleManualTagInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value.endsWith(',')) {
      processManualTagInput(); // Add tags if comma is typed
    } else {
      setManualTagInput(value);
    }
  };

  const handleManualTagInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // Prevent form submission
      processManualTagInput();
    }
  };

  const handleRemoveSelectedTag = (tagToRemove: string) => {
    setSelectedTags(prevTags => prevTags.filter(tag => tag !== tagToRemove));
  };


  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentScenario) return;
    setIsSaving(true);

    const updatedScenarioData: Scenario = {
      ...currentScenario,
      title,
      kurzbeschreibung,
      langbeschreibung,
      lernziele: lernziele.split('\n').map(ziel => ziel.trim()).filter(ziel => ziel),
      previewImageUrl: previewImageUrlInput,
      iconName: iconNameInput,
      tags: selectedTags,
      defaultBotsConfig: editableBotsConfig,
      humanRolesConfig: editableHumanRoles,
      defaultBots: editableBotsConfig.length, 
      standardRollen: editableBotsConfig.length + editableHumanRoles.length, 
    };

    console.log("Szenario Daten zum Speichern (ID: ", currentScenario.id, "):");
    console.log(JSON.stringify(updatedScenarioData, null, 2));
    
    const botsToSaveAsTemplate = editableBotsConfig.filter(bot => botSaveAsTemplateFlags[bot.id]);
    if (botsToSaveAsTemplate.length > 0) {
        console.log("Bots, die als Vorlage gespeichert werden sollen:", botsToSaveAsTemplate);
    }
    const rolesToSaveAsTemplate = editableHumanRoles.filter(role => roleSaveAsTemplateFlags[role.id]);
    if (rolesToSaveAsTemplate.length > 0) {
        console.log("Rollen, die als Vorlage gespeichert werden sollen:", rolesToSaveAsTemplate);
    }


    setTimeout(() => {
      toast({
        title: `Szenario ${isNewScenario ? 'erstellt' : 'gespeichert'} (Simulation)`,
        description: `Änderungen für "${title}" wurden in der Konsole geloggt. In einer echten Anwendung würden sie in einer Datenbank gespeichert.`,
      });
      setIsSaving(false);
      if (isNewScenario) {
        // Potentially redirect or update UI after creating a new scenario
        // For now, we stay on the page, but the ID would need to be updated if we were truly saving
      }
    }, 1000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p>Lade Szenariodaten...</p>
      </div>
    );
  }

  if (!currentScenario && !isNewScenario) { // Allow rendering for new scenario even if currentScenario is initially the default blank one
    return (
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-destructive">Szenario nicht gefunden</h1>
            <p className="text-muted-foreground mt-2">
              Das Szenario mit der ID &quot;{scenarioId}&quot; konnte nicht gefunden werden.
            </p>
          </div>
          <Button variant="outline" onClick={() => router.push('/admin/scenario-editor')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Zur Szenarienübersicht
          </Button>
        </div>
        <Separator />
      </div>
    );
  }
  
  const displayedTitle = isNewScenario ? (title || "Neues Szenario") : (title || currentScenario?.title || "Szenario laden...");


  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b px-4 py-3 sm:px-6 flex items-center justify-between mb-2">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-primary truncate max-w-xs sm:max-w-md md:max-w-lg flex items-center">
            <NotebookPen className="mr-3 h-6 w-6" />
            Editor: <span className="text-foreground ml-2">{displayedTitle}</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5 ml-9">
            ID: {currentScenario?.id || "Wird generiert"}
          </p>
        </div>
        <div className="flex gap-2 md:gap-3">
          <Button variant="outline" type="button" onClick={() => router.push('/admin/scenario-editor')} disabled={isSaving}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Abbrechen
          </Button>
          <Button type="submit" disabled={isSaving} className="min-w-[150px]">
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? "Speichert..." : (isNewScenario ? "Szenario erstellen" : "Änderungen speichern")}
          </Button>
        </div>
      </div>

      <div className="sticky top-[calc(theme(spacing.16)_-_45px)] md:top-[calc(theme(spacing.16)_-_49px)] lg:top-[calc(theme(spacing.16)_-_49px)] z-10 bg-background/90 backdrop-blur-sm border-b px-2 sm:px-4 py-2 mb-6">
         <div className="flex items-center space-x-1 max-w-full overflow-x-auto whitespace-nowrap">
          {editorSections.map(section => (
            <Button key={section.id} asChild variant="ghost" size="sm" className="px-2 sm:px-3 text-muted-foreground hover:text-primary hover:bg-primary/10">
              <a href={`#${section.id}`}>
                {section.icon}
                <span className="hidden sm:inline ml-1">{section.label}</span>
              </a>
            </Button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-8">
        <Accordion type="multiple" defaultValue={["basisinfo"]} className="w-full">

            <AccordionItem value="basisinfo" id="basisinfo">
              <AccordionTrigger className="py-3 px-0 hover:no-underline border-b">
                <CardTitle className="text-lg flex items-center"><FileText className="mr-2 h-5 w-5 text-primary"/>Basisinformationen</CardTitle>
              </AccordionTrigger>
              <AccordionContent className="pt-4 pb-2">
                <Card className="border-none shadow-none">
                  <CardHeader className="p-0 pb-4">
                    <CardDescription>
                      Grundlegende Details und Beschreibungen des Szenarios.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6 p-0">
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
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="botconfig" id="botconfig">
              <AccordionTrigger className="py-3 px-0 hover:no-underline border-b">
                <CardTitle className="text-lg flex items-center"><BotIconLucide className="mr-2 h-5 w-5 text-primary"/>Bot-Konfiguration</CardTitle>
              </AccordionTrigger>
              <AccordionContent className="pt-4 pb-2">
                <Card className="border-none shadow-none">
                  <CardHeader className="p-0 pb-4 flex flex-row items-center justify-between">
                    <div>
                        <CardDescription>Standard-Bots für dieses Szenario.</CardDescription>
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
                  <CardContent className="space-y-6 p-0">
                    {editableBotsConfig.length > 0 ? (
                      editableBotsConfig.map((bot, index) => (
                        <Card key={bot.id || `bot-${index}`} className="p-4 bg-muted/20">
                          <CardHeader className="p-0 pb-4 flex flex-row items-center justify-between">
                            <CardTitle className="text-md">Bot {index + 1} (ID: <span className="font-mono text-xs">{bot.id}</span>)</CardTitle>
                             <div className="flex items-center gap-2">
                                <Switch id={`bot-saveAsTemplate-${bot.id}`} 
                                        checked={botSaveAsTemplateFlags[bot.id] || false} 
                                        onCheckedChange={() => handleBotSaveAsTemplateToggle(bot.id)}
                                        disabled={isSaving} />
                                <Label htmlFor={`bot-saveAsTemplate-${bot.id}`} className="text-xs text-muted-foreground">Als Vorlage speichern</Label>
                                <Button type="button" variant="ghost" size="icon" className="text-destructive hover:text-destructive/80 h-7 w-7" onClick={() => handleRemoveBot(index)} disabled={isSaving}>
                                    <Trash2 className="h-4 w-4"/>
                                </Button>
                            </div>
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
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="humanroles" id="humanroles">
              <AccordionTrigger className="py-3 px-0 hover:no-underline border-b">
                 <CardTitle className="text-lg flex items-center"><UsersIconLucide className="mr-2 h-5 w-5 text-primary"/>Rollen für menschliche Teilnehmer</CardTitle>
              </AccordionTrigger>
              <AccordionContent className="pt-4 pb-2">
                <Card className="border-none shadow-none">
                    <CardHeader className="p-0 pb-4 flex flex-row items-center justify-between">
                        <div>
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
                    <CardContent className="space-y-6 p-0">
                        {editableHumanRoles.length > 0 ? (
                        editableHumanRoles.map((role, index) => (
                            <Card key={role.id || `role-${index}`} className="p-4 bg-muted/20">
                            <CardHeader className="p-0 pb-4 flex flex-row items-center justify-between">
                                <CardTitle className="text-md">Rolle {index + 1} (ID: <span className="font-mono text-xs">{role.id}</span>)</CardTitle>
                                <div className="flex items-center gap-2">
                                    <Switch id={`role-saveAsTemplate-${role.id}`}
                                            checked={roleSaveAsTemplateFlags[role.id] || false}
                                            onCheckedChange={() => handleRoleSaveAsTemplateToggle(role.id)}
                                            disabled={isSaving} />
                                    <Label htmlFor={`role-saveAsTemplate-${role.id}`} className="text-xs text-muted-foreground">Als Vorlage speichern</Label>
                                    <Button type="button" variant="ghost" size="icon" className="text-destructive hover:text-destructive/80 h-7 w-7" onClick={() => handleRemoveHumanRole(index)} disabled={isSaving}>
                                        <Trash2 className="h-4 w-4"/>
                                    </Button>
                                </div>
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
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="metadaten" id="metadaten">
                <AccordionTrigger className="py-3 px-0 hover:no-underline border-b">
                    <CardTitle className="text-lg flex items-center"><SettingsIcon className="mr-2 h-5 w-5 text-primary"/>Szenario-Metadaten</CardTitle>
                </AccordionTrigger>
                <AccordionContent className="pt-4 pb-2">
                    <Card className="border-none shadow-none">
                        <CardHeader className="p-0 pb-4">
                            <CardDescription>Weitere Einstellungen wie Icon und Vorschaubild.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6 p-0">
                            <div className="space-y-1.5">
                                <Label htmlFor="previewImageUrlInput">Vorschaubild URL</Label>
                                <Input id="previewImageUrlInput" value={previewImageUrlInput} onChange={(e) => setPreviewImageUrlInput(e.target.value)} placeholder="https://beispiel.com/bild.png" disabled={isSaving} className="mt-1"/>
                                <p className="text-xs text-muted-foreground mt-1">URL zu einem Bild, das in der Szenario-Übersicht angezeigt wird.</p>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="previewImageUpload">Oder Bild hochladen (Platzhalter)</Label>
                                <Input id="previewImageUpload" type="file" disabled={true} className="mt-1"/>
                                <p className="text-xs text-muted-foreground mt-1">Funktion zum Hochladen von Vorschaubildern wird später implementiert.</p>
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
                        </CardContent>
                    </Card>
                </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="tags" id="tags" className="w-full">
                <AccordionTrigger className="py-3 px-0 hover:no-underline border-b">
                    <CardTitle className="text-lg flex items-center"><TagsIcon className="mr-2 h-5 w-5 text-primary"/>Themen-Tags</CardTitle>
                </AccordionTrigger>
                <AccordionContent className="pt-4 pb-2">
                     <Card className="border-none shadow-none w-full">
                        <CardHeader className="p-0 pb-4">
                            <CardDescription>Weisen Sie dem Szenario passende Tags zu, um es besser kategorisieren zu können.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="mb-4 flex items-center gap-2">
                                <Input 
                                    placeholder="Tag manuell hinzufügen (kommagetrennt oder Enter)..." 
                                    className="flex-grow text-sm"
                                    value={manualTagInput}
                                    onChange={handleManualTagInputChange}
                                    onKeyDown={handleManualTagInputKeyDown}
                                    disabled={isSaving} 
                                />
                                <Button type="button" size="sm" variant="outline" onClick={processManualTagInput} disabled={isSaving || !manualTagInput.trim()}>
                                    <PlusCircle className="mr-2 h-4 w-4" /> Hinzufügen
                                </Button>
                            </div>
                            <div className="mb-4">
                                <Label>Ausgewählte Tags:</Label>
                                {selectedTags.length > 0 ? (
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {selectedTags.map(tag => (
                                            <Badge 
                                                key={tag} 
                                                variant="secondary" 
                                                className="cursor-pointer group/tag relative hover:bg-destructive/80 hover:text-destructive-foreground text-xs pr-6" // Added pr-6 for X space
                                                onClick={() => handleRemoveSelectedTag(tag)}
                                            >
                                                {tag} 
                                                <X className="absolute right-1 top-1/2 -translate-y-1/2 ml-1.5 h-3 w-3 opacity-50 group-hover/tag:opacity-100" />
                                            </Badge>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-muted-foreground mt-1">Keine Tags ausgewählt.</p>
                                )}
                            </div>
                            <Separator className="my-4" />
                            <Label>Verfügbare Tags (Klicken zum Hinzufügen):</Label>
                            <ScrollArea className="h-[400px] mt-2 pr-3 border rounded-md">
                                <Accordion type="multiple" className="w-full px-2" defaultValue={[]}>
                                    {tagTaxonomy.map((category, catIndex) => (
                                        <AccordionItem value={`category-${catIndex}`} key={category.categoryName}>
                                            <AccordionTrigger className="text-sm font-medium py-2 hover:no-underline">
                                                <span className="flex items-center">
                                                    {category.emoji && <span className="mr-2 text-base">{category.emoji}</span>}
                                                    {category.categoryName}
                                                </span>
                                            </AccordionTrigger>
                                            <AccordionContent className="pt-1 pb-2 pl-2">
                                                <div className="flex flex-wrap gap-2">
                                                    {category.tags.map(tag => (
                                                        <React.Fragment key={tag.name}> 
                                                            <Badge
                                                                variant={selectedTags.includes(tag.name.toLowerCase()) ? "default" : "outline"}
                                                                className="cursor-pointer hover:bg-primary/80 text-xs"
                                                                onClick={() => handleTagToggle(tag.name.toLowerCase())}
                                                            >
                                                                {tag.emoji && <span className="mr-1.5">{tag.emoji}</span>}
                                                                {tag.name}
                                                            </Badge>
                                                            {tag.subTags && tag.subTags.map(subTag => (
                                                                <Badge
                                                                    key={subTag.name}
                                                                    variant={selectedTags.includes(subTag.name.toLowerCase()) ? "default" : "outline"}
                                                                    className="cursor-pointer hover:bg-primary/80 ml-1 text-xs bg-muted/50"
                                                                    onClick={() => handleTagToggle(subTag.name.toLowerCase())}
                                                                >
                                                                    {subTag.emoji && <span className="mr-1">{subTag.emoji}</span>}
                                                                    {subTag.name}
                                                                </Badge>
                                                            ))}
                                                        </React.Fragment>
                                                    ))}
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    ))}
                                </Accordion>
                            </ScrollArea>
                            <p className="text-xs text-muted-foreground mt-3">Das Tag-System wird weiter ausgebaut (tiefere Verschachtelung, Suche etc.).</p>
                        </CardContent>
                    </Card>
                </AccordionContent>
            </AccordionItem>

           {(!isNewScenario && originalScenarioData) && (
            <AccordionItem value="originaldaten" id="originaldaten">
              <AccordionTrigger className="py-3 px-0 hover:no-underline border-b">
                <CardTitle className="text-lg flex items-center"><Database className="mr-2 h-5 w-5 text-primary"/>Originaldaten (aus `scenarios.ts`)</CardTitle>
              </AccordionTrigger>
              <AccordionContent className="pt-4 pb-2">
                <Card className="border-none shadow-none">
                  <CardHeader className="p-0 pb-4">
                    <CardDescription>Nur zur Referenz während der Entwicklung.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="w-[200px] h-[200px]" orientation="both">
                      <pre className="mt-2 p-3 bg-muted/50 rounded-md text-xs">
                        {JSON.stringify(originalScenarioData, null, 2)}
                      </pre>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </AccordionContent>
            </AccordionItem>
           )}
        </Accordion>
      </div>
    </form>
  );
}
