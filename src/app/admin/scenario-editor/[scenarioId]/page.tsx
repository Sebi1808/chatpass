
"use client";

import { useParams, useRouter } from 'next/navigation';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Save, PlusCircle, Trash2, NotebookPen, Tags as TagsIcon, ImageIcon as ImageIconLucide, FileText, Bot as BotIconLucide, Users as UsersIconLucide, Settings as SettingsIcon, Database, X, Loader2, Eye, ShieldCheck, ArrowLeft, MessageSquareText, Image as ImageLucideIcon } from 'lucide-react';
import type { Scenario, BotConfig, HumanRoleConfig, BotTemplate, RoleTemplate, InitialPostConfig } from '@/lib/types';
import React, { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { tagTaxonomy } from '@/lib/tag-taxonomy';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, addDoc, collection, serverTimestamp, Timestamp, onSnapshot, query, orderBy, updateDoc } from 'firebase/firestore';

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
    { value: 'ImageIcon', label: '🖼️ ImageIcon (Standard)'}
];

const editorSections = [
  { id: "basisinfo", label: "Basisinfos", icon: <FileText className="mr-2 h-4 w-4" /> },
  { id: "initialpost", label: "Ausgangsposting", icon: <MessageSquareText className="mr-2 h-4 w-4" /> },
  { id: "botconfig", label: "Bot-Konfiguration", icon: <BotIconLucide className="mr-2 h-4 w-4" /> },
  { id: "humanroles", label: "Menschliche Rollen", icon: <UsersIconLucide className="mr-2 h-4 w-4" /> },
  { id: "metadaten", label: "Metadaten & Status", icon: <SettingsIcon className="mr-2 h-4 w-4" /> },
  { id: "tags", label: "Themen-Tags", icon: <TagsIcon className="mr-2 h-4 w-4" /> },
];

const createDefaultScenario = (): Omit<Scenario, 'id' | 'createdAt' | 'updatedAt'> => ({
  title: 'Neues Szenario',
  kurzbeschreibung: '',
  langbeschreibung: '',
  lernziele: [],
  iconName: availableIcons[availableIcons.length - 1].value,
  tags: [],
  previewImageUrl: '',
  status: 'draft',
  defaultBotsConfig: [],
  humanRolesConfig: [],
  initialPost: {
    authorName: 'System',
    authorAvatarFallback: 'SYS',
    content: '',
    imageUrl: '',
    platform: 'Generic',
  },
});


export default function EditScenarioPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const scenarioIdFromUrl = params.scenarioId as string;

  const [isNewScenario, setIsNewScenario] = useState(scenarioIdFromUrl === 'new');
  const [currentScenarioId, setCurrentScenarioId] = useState<string | null>(isNewScenario ? null : scenarioIdFromUrl);

  const [title, setTitle] = useState('');
  const [kurzbeschreibung, setKurzbeschreibung] = useState('');
  const [langbeschreibung, setLangbeschreibung] = useState('');
  const [lernzieleInput, setLernzieleInput] = useState('');
  const [previewImageUrlInput, setPreviewImageUrlInput] = useState('');
  const [iconNameInput, setIconNameInput] = useState<string>(availableIcons[availableIcons.length - 1].value);
  const [status, setStatus] = useState<'draft' | 'published'>('draft');

  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [manualTagInput, setManualTagInput] = useState('');

  const [editableBotsConfig, setEditableBotsConfig] = useState<BotConfig[]>([]);
  const [editableHumanRoles, setEditableHumanRoles] = useState<HumanRoleConfig[]>([]);
  const [botSaveAsTemplateFlags, setBotSaveAsTemplateFlags] = useState<Record<string, boolean>>({});
  const [roleSaveAsTemplateFlags, setRoleSaveAsTemplateFlags] = useState<Record<string, boolean>>({});

  const [editableInitialPost, setEditableInitialPost] = useState<InitialPostConfig>({
    authorName: 'System',
    authorAvatarFallback: 'SYS',
    content: '',
    imageUrl: '',
    platform: 'Generic',
  });

  const [botTemplates, setBotTemplates] = useState<BotTemplate[]>([]);
  const [roleTemplates, setRoleTemplates] = useState<RoleTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);

  const [isLoading, setIsLoading] = useState(!isNewScenario);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [originalScenarioData, setOriginalScenarioData] = useState<Scenario | null>(null);

  useEffect(() => {
    setIsLoadingTemplates(true);
    const botTemplatesColRef = collection(db, "botTemplates");
    const qBot = query(botTemplatesColRef, orderBy("name", "asc"));
    const unsubscribeBots = onSnapshot(qBot, (querySnapshot) => {
      const fetchedBotTemplates: BotTemplate[] = [];
      querySnapshot.forEach((doc) => {
        fetchedBotTemplates.push({ templateId: doc.id, ...doc.data() } as BotTemplate);
      });
      setBotTemplates(fetchedBotTemplates);
    }, (err) => {
      console.error("Error fetching bot templates:", err);
      toast({ variant: "destructive", title: "Fehler", description: "Bot-Vorlagen konnten nicht geladen werden."});
    });

    const roleTemplatesColRef = collection(db, "roleTemplates");
    const qRole = query(roleTemplatesColRef, orderBy("name", "asc"));
    const unsubscribeRoles = onSnapshot(qRole, (querySnapshot) => {
      const fetchedRoleTemplates: RoleTemplate[] = [];
      querySnapshot.forEach((doc) => {
        fetchedRoleTemplates.push({ templateId: doc.id, ...doc.data() } as RoleTemplate);
      });
      setRoleTemplates(fetchedRoleTemplates);
    }, (err) => {
      console.error("Error fetching role templates:", err);
      toast({ variant: "destructive", title: "Fehler", description: "Rollen-Vorlagen konnten nicht geladen werden."});
    });

     const timer = setTimeout(() => setIsLoadingTemplates(false), 1500);

    return () => {
      unsubscribeBots();
      unsubscribeRoles();
      clearTimeout(timer);
    };
  }, [toast]);

  useEffect(() => {
    const loadScenario = async () => {
      if (isNewScenario || !currentScenarioId) {
        const newScenarioData = createDefaultScenario();
        setTitle(newScenarioData.title);
        setKurzbeschreibung(newScenarioData.kurzbeschreibung);
        setLangbeschreibung(newScenarioData.langbeschreibung);
        setLernzieleInput((newScenarioData.lernziele || []).join('\n'));
        setPreviewImageUrlInput(newScenarioData.previewImageUrl || '');
        setIconNameInput(newScenarioData.iconName || availableIcons[availableIcons.length - 1].value);
        setStatus(newScenarioData.status || 'draft');
        setSelectedTags(newScenarioData.tags || []);
        setEditableBotsConfig(JSON.parse(JSON.stringify(newScenarioData.defaultBotsConfig || [])));
        setEditableHumanRoles(JSON.parse(JSON.stringify(newScenarioData.humanRolesConfig || [])));
        setEditableInitialPost(JSON.parse(JSON.stringify(newScenarioData.initialPost || { authorName: 'System', authorAvatarFallback: 'SYS', content: '', imageUrl: '', platform: 'Generic' })));
        setOriginalScenarioData(null);
        setBotSaveAsTemplateFlags({});
        setRoleSaveAsTemplateFlags({});
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const scenarioDocRef = doc(db, "scenarios", currentScenarioId);
        const scenarioSnap = await getDoc(scenarioDocRef);

        if (scenarioSnap.exists()) {
          const foundScenario = { id: scenarioSnap.id, ...scenarioSnap.data() } as Scenario;
          setOriginalScenarioData(JSON.parse(JSON.stringify(foundScenario)));
          setTitle(foundScenario.title || '');
          setKurzbeschreibung(foundScenario.kurzbeschreibung || '');
          setLangbeschreibung(foundScenario.langbeschreibung || '');
          setLernzieleInput(foundScenario.lernziele?.join('\n') || '');
          setPreviewImageUrlInput(foundScenario.previewImageUrl || '');
          setIconNameInput(foundScenario.iconName || availableIcons[availableIcons.length -1].value);
          setStatus(foundScenario.status || 'draft');
          setSelectedTags(foundScenario.tags || []);

          setEditableBotsConfig(JSON.parse(JSON.stringify(foundScenario.defaultBotsConfig || [])));
          setEditableHumanRoles(JSON.parse(JSON.stringify(foundScenario.humanRolesConfig || [])));
          setEditableInitialPost(JSON.parse(JSON.stringify(foundScenario.initialPost || { authorName: 'System', authorAvatarFallback: 'SYS', content: '', imageUrl: '', platform: 'Generic' })));

          const initialBotFlags: Record<string, boolean> = {};
          (foundScenario.defaultBotsConfig || []).forEach(bot => initialBotFlags[bot.id] = false);
          setBotSaveAsTemplateFlags(initialBotFlags);

          const initialRoleFlags: Record<string, boolean> = {};
          (foundScenario.humanRolesConfig || []).forEach(role => initialRoleFlags[role.id] = false);
          setRoleSaveAsTemplateFlags(initialRoleFlags);

        } else {
          setError(`Szenario mit der ID "${currentScenarioId}" nicht in der Datenbank gefunden.`);
           toast({
            variant: "destructive",
            title: "Fehler: Szenario nicht gefunden",
            description: `Das Szenario mit der ID "${currentScenarioId}" konnte nicht geladen werden. Sie werden zum Hub weitergeleitet.`,
          });
          router.push('/admin/scenario-editor');
        }
      } catch (err) {
        console.error("Error loading scenario from Firestore: ", err);
        setError("Fehler beim Laden des Szenarios aus der Datenbank.");
        toast({ variant: "destructive", title: "Ladefehler", description: "Szenario konnte nicht geladen werden."});
      } finally {
        setIsLoading(false);
      }
    };

    if (!isLoadingTemplates || isNewScenario) {
        loadScenario();
    }

  }, [currentScenarioId, isNewScenario, toast, isLoadingTemplates, router]);

  const handleBotConfigChange = (index: number, field: keyof BotConfig, value: any) => {
    const updatedBots = [...editableBotsConfig];
    if (updatedBots[index]) {
      (updatedBots[index] as any)[field] = value;
      setEditableBotsConfig(updatedBots);
    }
  };

  const handleAddBot = () => {
    const newBotId = `bot-inst-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    setEditableBotsConfig([...editableBotsConfig, {
        id: newBotId,
        name: "Neuer Bot",
        personality: "standard",
        avatarFallback: "NB",
        currentEscalation: 0,
        isActive: true,
        autoTimerEnabled: false,
        initialMission: "",
    }]);
    setBotSaveAsTemplateFlags(prev => ({ ...prev, [newBotId]: false }));
  };

  const handleAddBotFromTemplate = (templateId: string) => {
    const template = botTemplates.find(t => t.templateId === templateId);
    if (template) {
      const newBotId = `bot-inst-tpl-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const newBotFromTemplate: BotConfig = {
        id: newBotId,
        name: template.name || "Bot aus Vorlage",
        personality: template.personality,
        avatarFallback: template.avatarFallback || (template.name || "BT").substring(0,2).toUpperCase(),
        initialMission: template.initialMission || "",
        isActive: true,
        autoTimerEnabled: false,
        currentEscalation: 0,
        templateOriginId: template.templateId,
      };
      setEditableBotsConfig([...editableBotsConfig, newBotFromTemplate]);
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
    const newRoleId = `role-inst-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    setEditableHumanRoles([...editableHumanRoles, {
        id: newRoleId,
        name: "Neue Rolle",
        description: "Beschreibung der neuen Rolle..."
    }]);
    setRoleSaveAsTemplateFlags(prev => ({ ...prev, [newRoleId]: false }));
  };

  const handleAddHumanRoleFromTemplate = (templateId: string) => {
    const template = roleTemplates.find(t => t.templateId === templateId);
    if (template) {
      const newRoleId = `role-inst-tpl-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const newRoleFromTemplate: HumanRoleConfig = {
        id: newRoleId,
        name: template.name || "Rolle aus Vorlage",
        description: template.description || "",
        templateOriginId: template.templateId,
      };
      setEditableHumanRoles([...editableHumanRoles, newRoleFromTemplate]);
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

  const handleInitialPostChange = (field: keyof InitialPostConfig, value: string | undefined) => {
    setEditableInitialPost(prev => ({ ...prev, [field]: value || '' }));
  };

  const handleTagToggle = (tagName: string) => {
    const lowerTagName = tagName.toLowerCase();
    setSelectedTags(prevTags =>
      prevTags.map(t=>t.toLowerCase()).includes(lowerTagName)
        ? prevTags.filter(t => t.toLowerCase() !== lowerTagName)
        : [...prevTags, tagName]
    );
  };

  const processManualTagInput = () => {
    if (!manualTagInput.trim()) return;
    const newTags = manualTagInput
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag !== '' && !selectedTags.some(st => st.toLowerCase() === tag.toLowerCase()));

    if (newTags.length > 0) {
      setSelectedTags(prevTags => [...prevTags, ...newTags]);
    }
    setManualTagInput('');
  };

  const handleManualTagInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setManualTagInput(e.target.value);
  };

  const handleManualTagInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === ',' || e.key === 'Enter') {
      e.preventDefault();
      processManualTagInput();
    }
  };

  const handleRemoveSelectedTag = (tagToRemove: string) => {
    setSelectedTags(prevTags => prevTags.filter(tag => tag.toLowerCase() !== tagToRemove.toLowerCase()));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setError(null);

    const scenarioDataToSave: Omit<Scenario, 'id' | 'createdAt' | 'updatedAt'> & { updatedAt: Timestamp, createdAt?: Timestamp } = {
      title: title || 'Unbenanntes Szenario',
      kurzbeschreibung: kurzbeschreibung || '',
      langbeschreibung: langbeschreibung || '',
      lernziele: lernzieleInput.split('\n').map(ziel => ziel.trim()).filter(ziel => ziel) || [],
      previewImageUrl: previewImageUrlInput || '',
      iconName: iconNameInput || availableIcons[availableIcons.length - 1].value,
      status: status || 'draft',
      tags: selectedTags.map(t => t.toLowerCase()) || [],
      defaultBotsConfig: editableBotsConfig.map(b => ({
        id: b.id,
        name: b.name || 'Bot',
        personality: b.personality,
        avatarFallback: b.avatarFallback || (b.name || 'BT').substring(0,2).toUpperCase(),
        initialMission: b.initialMission || '',
        isActive: b.isActive ?? true,
        autoTimerEnabled: b.autoTimerEnabled ?? false,
        currentEscalation: b.currentEscalation ?? 0,
        templateOriginId: b.templateOriginId,
      })) || [],
      humanRolesConfig: editableHumanRoles.map(r => ({
        id: r.id,
        name: r.name || 'Rolle',
        description: r.description || '',
        templateOriginId: r.templateOriginId,
      })) || [],
      initialPost: {
        authorName: editableInitialPost.authorName || 'System',
        authorAvatarFallback: editableInitialPost.authorAvatarFallback || 'SYS',
        content: editableInitialPost.content || '',
        imageUrl: editableInitialPost.imageUrl || '',
        platform: editableInitialPost.platform || 'Generic',
      },
      updatedAt: Timestamp.now(),
    };

    try {
      for (const bot of editableBotsConfig) {
        if (botSaveAsTemplateFlags[bot.id]) {
          const newBotTemplateData: Omit<BotTemplate, 'templateId' | 'createdAt'> = {
            name: bot.name || 'Unbenannter Bot',
            personality: bot.personality,
            avatarFallback: bot.avatarFallback || (bot.name || 'BT').substring(0,2).toUpperCase(),
            initialMission: bot.initialMission || '',
          };
          const docRef = await addDoc(collection(db, "botTemplates"), {...newBotTemplateData, createdAt: serverTimestamp()});
          toast({ title: "Bot-Vorlage gespeichert", description: `Bot "${newBotTemplateData.name}" wurde als neue Vorlage (ID: ${docRef.id}) gesichert.` });
          setBotSaveAsTemplateFlags(prev => ({ ...prev, [bot.id]: false }));
        }
      }

      for (const role of editableHumanRoles) {
        if (roleSaveAsTemplateFlags[role.id]) {
          const newRoleTemplateData: Omit<RoleTemplate, 'templateId' | 'createdAt'> = {
            name: role.name || 'Unbenannte Rolle',
            description: role.description || '',
          };
          const docRef = await addDoc(collection(db, "roleTemplates"), {...newRoleTemplateData, createdAt: serverTimestamp()});
          toast({ title: "Rollen-Vorlage gespeichert", description: `Rolle "${newRoleTemplateData.name}" wurde als neue Vorlage (ID: ${docRef.id}) gesichert.` });
          setRoleSaveAsTemplateFlags(prev => ({ ...prev, [role.id]: false }));
        }
      }

      if (isNewScenario) {
        const dataWithCreationTimestamp = { ...scenarioDataToSave, createdAt: Timestamp.now() };
        const docRef = await addDoc(collection(db, "scenarios"), dataWithCreationTimestamp);
        toast({
          title: "Szenario erstellt",
          description: `Das Szenario "${scenarioDataToSave.title}" wurde erfolgreich in der Datenbank gespeichert.`,
        });
        router.push(`/admin/scenario-editor/${docRef.id}`);
      } else if (currentScenarioId) {
        const scenarioDocRef = doc(db, "scenarios", currentScenarioId);
        // Ensure all fields from scenarioDataToSave are present, even if empty strings or arrays, to prevent undefined issues.
        const sanitizedData = {
            ...scenarioDataToSave,
            title: scenarioDataToSave.title || '',
            kurzbeschreibung: scenarioDataToSave.kurzbeschreibung || '',
            langbeschreibung: scenarioDataToSave.langbeschreibung || '',
            lernziele: scenarioDataToSave.lernziele || [],
            previewImageUrl: scenarioDataToSave.previewImageUrl || '',
            iconName: scenarioDataToSave.iconName || availableIcons[availableIcons.length - 1].value,
            status: scenarioDataToSave.status || 'draft',
            tags: scenarioDataToSave.tags || [],
            defaultBotsConfig: scenarioDataToSave.defaultBotsConfig || [],
            humanRolesConfig: scenarioDataToSave.humanRolesConfig || [],
            initialPost: scenarioDataToSave.initialPost ? {
                authorName: scenarioDataToSave.initialPost.authorName || 'System',
                authorAvatarFallback: scenarioDataToSave.initialPost.authorAvatarFallback || 'SYS',
                content: scenarioDataToSave.initialPost.content || '',
                imageUrl: scenarioDataToSave.initialPost.imageUrl || '',
                platform: scenarioDataToSave.initialPost.platform || 'Generic',
            } : { authorName: 'System', authorAvatarFallback: 'SYS', content: '', imageUrl: '', platform: 'Generic' },
        };
        await setDoc(scenarioDocRef, sanitizedData, { merge: true });
        toast({
          title: "Szenario gespeichert",
          description: `Änderungen für "${sanitizedData.title}" wurden erfolgreich in der Datenbank gespeichert.`,
        });
      } else {
        throw new Error("Keine Szenario-ID zum Speichern vorhanden.");
      }
    } catch (err: any) {
      console.error("Error saving scenario/templates to Firestore: ", err);
      setError("Fehler beim Speichern des Szenarios oder der Vorlagen in der Datenbank.");
      toast({ variant: "destructive", title: "Speicherfehler", description: err.message || "Szenario/Vorlagen konnten nicht gespeichert werden."});
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading && !isNewScenario) {
    return (
      <div className="flex items-center justify-center min-h-screen p-6">
        <Card className="w-full max-w-md">
          <CardHeader><CardTitle>Lade Szenariodaten...</CardTitle></CardHeader>
          <CardContent className="flex items-center justify-center py-4"><Loader2 className="h-8 w-8 animate-spin text-primary" /></CardContent>
        </Card>
      </div>
    );
  }

  if (error && !isNewScenario) {
     return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Fehler beim Laden</CardTitle>
            <CardDescription>{error}</CardDescription>
            </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/admin/scenario-editor')} variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4"/> Zurück zur Szenarienübersicht
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const displayedTitle = isNewScenario ? (title || "Neues Szenario") : (title || "Szenario laden...");
  const currentIdForDisplay = isNewScenario ? "Wird nach Speichern generiert" : currentScenarioId;

  const defaultAccordionValues = ["basisinfo", "initialpost"];

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b px-4 py-3 sm:px-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-primary truncate max-w-xs sm:max-w-md md:max-w-lg flex items-center">
            <NotebookPen className="mr-3 h-6 w-6" />
            Editor: <span className="text-foreground ml-2">{displayedTitle}</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5 ml-9">
            ID: {currentIdForDisplay}
          </p>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
           <div className="flex items-center space-x-2">
            <Switch
                id="publish-status"
                checked={status === 'published'}
                onCheckedChange={(checked) => setStatus(checked ? 'published' : 'draft')}
                disabled={isSaving}
            />
            <Label htmlFor="publish-status" className="text-sm whitespace-nowrap">
                {status === 'published' ? <span className="text-green-500 flex items-center"><ShieldCheck className="mr-1.5 h-4 w-4"/>Veröffentlicht</span> : <span className="text-amber-500 flex items-center"><FileText className="mr-1.5 h-4 w-4"/>Entwurf</span>}
            </Label>
          </div>
          <Separator orientation="vertical" className="h-8 mx-1"/>
          <Button variant="outline" type="button" onClick={() => router.push('/admin/scenario-editor')} disabled={isSaving}>
            <X className="mr-2 h-4 w-4" />
            Abbrechen
          </Button>
          <Button type="submit" disabled={isSaving || (isLoading && !isNewScenario)} className="min-w-[150px]">
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {isSaving ? "Speichert..." : (isNewScenario ? "Szenario erstellen" : "Änderungen speichern")}
          </Button>
        </div>
      </div>

      <div className="sticky top-[var(--header-height,65px)] z-10 bg-background/90 backdrop-blur-sm border-b mb-1">
        <ScrollArea orientation="horizontal" className="max-w-full px-2 sm:px-4 py-2">
            <div className="flex items-center space-x-1 whitespace-nowrap">
            {editorSections.map(section => (
                <Button key={section.id} asChild variant="ghost" size="sm" className="px-2 sm:px-3 text-muted-foreground hover:text-primary hover:bg-primary/10">
                <a href={`#${section.id}`}>
                    {section.icon}
                    <span className="hidden sm:inline ml-1">{section.label}</span>
                </a>
                </Button>
            ))}
             {(!isNewScenario && currentScenarioId && originalScenarioData) && (
                <Button asChild variant="ghost" size="sm" className="px-2 sm:px-3 text-muted-foreground hover:text-primary hover:bg-primary/10">
                    <a href="#originaldaten">
                        <Database className="mr-2 h-4 w-4" />
                        <span className="hidden sm:inline ml-1">DB-Daten</span>
                    </a>
                </Button>
             )}
            </div>
         </ScrollArea>
      </div>

      <style jsx global>{`
        :root {
          --header-height: 65px; /* Adjust if your header height is different */
        }
      `}</style>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-8 pt-3">
        <Accordion type="multiple" defaultValue={defaultAccordionValues} className="w-full space-y-4">

            <AccordionItem value="basisinfo" id="basisinfo" className="border-none">
              <Card className="shadow-md">
                <AccordionTrigger className="py-3 px-4 hover:no-underline text-left border-b">
                  <CardTitle className="text-lg flex items-center"><FileText className="mr-2 h-5 w-5 text-primary"/>Basisinformationen</CardTitle>
                </AccordionTrigger>
                <AccordionContent className="pt-0 pb-2">
                  <CardHeader className="p-4 pb-2">
                    <CardDescription>
                      Grundlegende Details und Beschreibungen des Szenarios.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 p-4 pt-2">
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
                      <Textarea id="langbeschreibung" value={langbeschreibung} onChange={(e) => setLangbeschreibung(e.target.value)} placeholder="Ausführliche Beschreibung der Ausgangslage, Thema, beteiligte Akteure etc. Dies ist der Hauptkontext für die Simulation und die Bots." rows={8} className="min-h-[150px] md:min-h-[200px]" disabled={isSaving}/>
                      <p className="text-xs text-muted-foreground">Markdown-Formatierung wird später unterstützt.</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="lernzieleInput">Lernziele (ein Ziel pro Zeile)</Label>
                      <Textarea id="lernzieleInput" value={lernzieleInput} onChange={(e) => setLernzieleInput(e.target.value)} placeholder={"Was sollen die Teilnehmenden lernen?\n- Ziel 1\n- Ziel 2"} rows={4} className="min-h-[80px]" disabled={isSaving}/>
                    </div>
                  </CardContent>
                </AccordionContent>
              </Card>
            </AccordionItem>

            <AccordionItem value="initialpost" id="initialpost" className="border-none">
             <Card className="shadow-md">
              <AccordionTrigger className="py-3 px-4 hover:no-underline border-b text-left">
                <CardTitle className="text-lg flex items-center"><MessageSquareText className="mr-2 h-5 w-5 text-primary"/>Ausgangsposting (1. Chatbeitrag)</CardTitle>
              </AccordionTrigger>
              <AccordionContent className="pt-0 pb-2">
                <CardHeader className="p-4 pb-2">
                  <CardDescription>
                    Dieser Beitrag wird als erste Nachricht im Chat angezeigt und startet die Simulation.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 p-4 pt-2">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                        <Label htmlFor="initialPostAuthorName">Autor Name</Label>
                        <Input id="initialPostAuthorName" value={editableInitialPost.authorName} onChange={(e) => handleInitialPostChange('authorName', e.target.value)} placeholder="z.B. System, Klassen-Admin" disabled={isSaving}/>
                        </div>
                        <div className="space-y-1.5">
                        <Label htmlFor="initialPostAuthorAvatar">Autor Avatar Kürzel (max. 2)</Label>
                        <Input id="initialPostAuthorAvatar" value={editableInitialPost.authorAvatarFallback} onChange={(e) => handleInitialPostChange('authorAvatarFallback', e.target.value.substring(0,2))} placeholder="SA" maxLength={2} disabled={isSaving}/>
                        </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="initialPostPlatform">Plattform des Posts</Label>
                      <Select value={editableInitialPost.platform || 'Generic'} onValueChange={(value) => handleInitialPostChange('platform', value as any)} disabled={isSaving}>
                        <SelectTrigger id="initialPostPlatform">
                          <SelectValue placeholder="Plattform wählen" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Generic">Generisch / Unbekannt</SelectItem>
                          <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                          <SelectItem value="Instagram">Instagram</SelectItem>
                          <SelectItem value="TikTok">TikTok</SelectItem>
                          <SelectItem value="TwitterX">Twitter/X</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="initialPostContent">Inhalt des Posts</Label>
                      <Textarea id="initialPostContent" value={editableInitialPost.content} onChange={(e) => handleInitialPostChange('content', e.target.value)} placeholder="Der Text des ersten Beitrags..." rows={5} className="min-h-[100px]" disabled={isSaving}/>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="initialPostImageUrl">Bild-URL für Post (optional)</Label>
                      <Input id="initialPostImageUrl" value={editableInitialPost.imageUrl || ''} onChange={(e) => handleInitialPostChange('imageUrl', e.target.value)} placeholder="https://beispiel.com/bild.png" disabled={isSaving}/>
                       <p className="text-xs text-muted-foreground mt-1">Direkte URL zu einem Bild.</p>
                    </div>
                     <div className="space-y-1.5">
                        <Label htmlFor="initialPostImageUpload">Oder Bild für Post hochladen (optional, Zukunft)</Label>
                        <Input id="initialPostImageUpload" type="file" disabled={true} className="mt-1"/>
                        <p className="text-xs text-muted-foreground mt-1">Funktion zum Hochladen von Bildern für den Post wird später implementiert.</p>
                    </div>
                  </CardContent>
                </AccordionContent>
              </Card>
            </AccordionItem>

            <AccordionItem value="botconfig" id="botconfig" className="border-none">
             <Card className="shadow-md">
              <AccordionTrigger className="py-3 px-4 hover:no-underline border-b text-left">
                <CardTitle className="text-lg flex items-center"><BotIconLucide className="mr-2 h-5 w-5 text-primary"/>Bot-Konfiguration</CardTitle>
              </AccordionTrigger>
              <AccordionContent className="pt-0 pb-2">
                  <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                    <div>
                        <CardDescription>Standard-Bots für dieses Szenario.</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Select onValueChange={handleAddBotFromTemplate} disabled={isSaving || isLoadingTemplates}>
                            <SelectTrigger className="w-[230px] text-sm h-9">
                                <SelectValue placeholder={isLoadingTemplates ? "Lade Vorlagen..." : "Bot aus Vorlage wählen..."} />
                            </SelectTrigger>
                            <SelectContent>
                                {botTemplates.map(template => (
                                    <SelectItem key={template.templateId} value={template.templateId!}>{template.name}</SelectItem>
                                ))}
                                {botTemplates.length === 0 && !isLoadingTemplates && <p className="p-2 text-xs text-muted-foreground">Keine Bot-Vorlagen.</p>}
                            </SelectContent>
                        </Select>
                        <Button type="button" size="sm" variant="outline" onClick={handleAddBot} disabled={isSaving}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Bot manuell
                        </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 p-4 pt-2">
                    {editableBotsConfig.length > 0 ? (
                      editableBotsConfig.map((bot, index) => (
                        <Card key={bot.id || `bot-${index}`} className="p-4 bg-muted/20">
                          <CardHeader className="p-0 pb-3 flex flex-row items-center justify-between">
                            <CardTitle className="text-md">Bot {index + 1}: <span className="font-normal">{bot.name || "Unbenannter Bot"}</span> <span className="font-mono text-xs text-muted-foreground"> (ID: {bot.id})</span></CardTitle>
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
                              <Select value={bot.personality} onValueChange={(value) => handleBotConfigChange(index, 'personality', value as any)} disabled={isSaving}>
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
                                <Input id={`bot-escalation-${index}`} type="number" min="0" max="3" value={bot.currentEscalation ?? 0} onChange={(e) => handleBotConfigChange(index, 'currentEscalation', parseInt(e.target.value))} disabled={isSaving}/>
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
                      <p className="text-muted-foreground p-4 text-center">Keine Bots für dieses Szenario konfiguriert.</p>
                    )}
                  </CardContent>
                </AccordionContent>
              </Card>
            </AccordionItem>

            <AccordionItem value="humanroles" id="humanroles" className="border-none">
             <Card className="shadow-md">
              <AccordionTrigger className="py-3 px-4 hover:no-underline border-b text-left">
                 <CardTitle className="text-lg flex items-center"><UsersIconLucide className="mr-2 h-5 w-5 text-primary"/>Rollen für menschliche Teilnehmer</CardTitle>
              </AccordionTrigger>
              <AccordionContent className="pt-0 pb-2">
                    <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                        <div>
                            <CardDescription>Definition der Rollen, ihrer Ziele und Informationen.</CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <Select onValueChange={handleAddHumanRoleFromTemplate} disabled={isSaving || isLoadingTemplates}>
                                <SelectTrigger className="w-[230px] text-sm h-9">
                                    <SelectValue placeholder={isLoadingTemplates ? "Lade Vorlagen..." : "Rolle aus Vorlage wählen..."} />
                                </SelectTrigger>
                                <SelectContent>
                                    {roleTemplates.map(template => (
                                        <SelectItem key={template.templateId} value={template.templateId!}>{template.name}</SelectItem>
                                    ))}
                                    {roleTemplates.length === 0 && !isLoadingTemplates && <p className="p-2 text-xs text-muted-foreground">Keine Rollen-Vorlagen.</p>}
                                </SelectContent>
                            </Select>
                            <Button type="button" size="sm" variant="outline" onClick={handleAddHumanRole} disabled={isSaving}>
                                <PlusCircle className="mr-2 h-4 w-4" /> Rolle manuell
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4 p-4 pt-2">
                        {editableHumanRoles.length > 0 ? (
                        editableHumanRoles.map((role, index) => (
                            <Card key={role.id || `role-${index}`} className="p-4 bg-muted/20">
                            <CardHeader className="p-0 pb-3 flex flex-row items-center justify-between">
                                <CardTitle className="text-md">Rolle {index + 1}: <span className="font-normal">{role.name || "Unbenannte Rolle"}</span> <span className="font-mono text-xs text-muted-foreground">(ID: {role.id})</span></CardTitle>
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
                            <CardContent className="p-0 space-y-3">
                                <div className="space-y-1.5">
                                    <Label htmlFor={`role-name-${index}`}>Rollenname</Label>
                                    <Input id={`role-name-${index}`} value={role.name} onChange={(e) => handleHumanRoleChange(index, 'name', e.target.value)} placeholder="z.B. Angegriffene Person" disabled={isSaving}/>
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor={`role-description-${index}`}>Rollenbeschreibung (Ziele, Infos etc.)</Label>
                                    <Textarea id={`role-description-${index}`} value={role.description} onChange={(e) => handleHumanRoleChange(index, 'description', e.target.value)} placeholder="Detailbeschreibung der Rolle, ihrer Ziele, Startinformationen, geheime Infos etc. Dies wird dem Teilnehmer angezeigt." rows={6} className="min-h-[120px]" disabled={isSaving}/>
                                </div>
                            </CardContent>
                            </Card>
                        ))
                        ) : (
                            <p className="text-muted-foreground p-4 text-center">Keine menschlichen Rollen für dieses Szenario konfiguriert.</p>
                        )}
                    </CardContent>
                </AccordionContent>
              </Card>
            </AccordionItem>

            <AccordionItem value="metadaten" id="metadaten" className="border-none">
             <Card className="shadow-md">
                <AccordionTrigger className="py-3 px-4 hover:no-underline border-b text-left">
                    <CardTitle className="text-lg flex items-center"><SettingsIcon className="mr-2 h-5 w-5 text-primary"/>Szenario-Metadaten</CardTitle>
                </AccordionTrigger>
                <AccordionContent className="pt-0 pb-2">
                    <CardHeader className="p-4 pb-2">
                        <CardDescription>Weitere Einstellungen wie Icon und Vorschaubild.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 p-4 pt-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="previewImageUrlInput">Vorschaubild URL</Label>
                            <Input id="previewImageUrlInput" value={previewImageUrlInput} onChange={(e) => setPreviewImageUrlInput(e.target.value)} placeholder="https://beispiel.com/bild.png" disabled={isSaving} className="mt-1"/>
                            <p className="text-xs text-muted-foreground mt-1">URL zu einem Bild, das in der Szenario-Übersicht angezeigt wird.</p>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="previewImageUpload">Oder Vorschaubild hochladen (Platzhalter)</Label>
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
                </AccordionContent>
              </Card>
            </AccordionItem>

            <AccordionItem value="tags" id="tags" className="border-none">
              <Card className="shadow-md">
                <AccordionTrigger className="py-3 px-4 hover:no-underline border-b text-left">
                    <CardTitle className="text-lg flex items-center"><TagsIcon className="mr-2 h-5 w-5 text-primary"/>Themen-Tags</CardTitle>
                </AccordionTrigger>
                <AccordionContent className="pt-0 pb-2">
                    <CardHeader className="p-4 pb-2">
                        <CardDescription>Weisen Sie dem Szenario passende Tags zu, um es besser kategorisieren zu können.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 pt-2">
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
                                            className="cursor-pointer group/tag relative hover:bg-destructive/80 hover:text-destructive-foreground text-xs pr-6"
                                            onClick={() => handleRemoveSelectedTag(tag)}
                                            title={`Tag "${tag}" entfernen`}
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
                                    <AccordionItem value={`category-${catIndex}`} key={category.categoryName} className="border-b-0">
                                        <AccordionTrigger className="text-sm font-medium py-2 hover:no-underline text-left">
                                            <span className="flex items-center">
                                                {category.emoji && <span className="mr-2 text-base">{category.emoji}</span>}
                                                {category.categoryName}
                                            </span>
                                        </AccordionTrigger>
                                        <AccordionContent className="pt-1 pb-2 pl-2">
                                            <div className="flex flex-wrap gap-2">
                                                {category.tags.map(tag => (
                                                    // Using React.Fragment because key needs to be on the outermost element
                                                    <React.Fragment key={tag.name}>
                                                        <Badge
                                                            variant={selectedTags.map(st=>st.toLowerCase()).includes(tag.name.toLowerCase()) ? "default" : "outline"}
                                                            className="cursor-pointer hover:bg-primary/80 text-xs"
                                                            onClick={() => handleTagToggle(tag.name)}
                                                        >
                                                            {tag.emoji && <span className="mr-1.5">{tag.emoji}</span>}
                                                            {tag.name}
                                                        </Badge>
                                                        {tag.subTags && tag.subTags.map(subTag => (
                                                            <Badge
                                                                key={subTag.name}
                                                                variant={selectedTags.map(st=>st.toLowerCase()).includes(subTag.name.toLowerCase()) ? "default" : "outline"}
                                                                className="cursor-pointer hover:bg-primary/80 ml-1 text-xs bg-muted/50"
                                                                onClick={() => handleTagToggle(subTag.name)}
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
                        <p className="text-xs text-muted-foreground mt-3">Das Tag-System wird weiter ausgebaut.</p>
                    </CardContent>
                </AccordionContent>
              </Card>
            </AccordionItem>

           {(!isNewScenario && currentScenarioId && originalScenarioData) && (
            <AccordionItem value="originaldaten" id="originaldaten" className="border-none">
             <Card className="shadow-md">
              <AccordionTrigger className="py-3 px-4 hover:no-underline border-b text-left">
                <CardTitle className="text-lg flex items-center"><Database className="mr-2 h-5 w-5 text-primary"/>Originaldaten (aus Datenbank)</CardTitle>
              </AccordionTrigger>
              <AccordionContent className="pt-0 pb-2">
                <CardHeader className="p-4 pb-2">
                  <CardDescription>Nur zur Referenz während der Entwicklung: So ist das Szenario aktuell in der Datenbank gespeichert.</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-2">
                  <ScrollArea className="w-[200px] h-[200px] max-w-full" orientation="both">
                    <pre className="mt-2 p-3 bg-muted/50 rounded-md text-xs">
                      {isLoading ? "Lade Originaldaten..." : JSON.stringify(originalScenarioData, null, 2)}
                    </pre>
                  </ScrollArea>
                </CardContent>
                </AccordionContent>
              </Card>
            </AccordionItem>
           )}
        </Accordion>
      </div>
    </form>
  );
}
