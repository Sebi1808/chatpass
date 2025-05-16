
"use client";

import { useParams, useRouter } from 'next/navigation';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Save, PlusCircle, Trash2, NotebookPen, Tags as TagsIcon, FileText, Bot as BotIconLucide, Users as UsersIconLucideReal, Settings as SettingsIconReal, Database as DatabaseIcon, X, Loader2, Eye, ShieldCheck, ArrowLeft, MessageSquareText as MessageSquareTextIcon, Image as ImageIconReal, Users, BotMessageSquare as BotMessageSquareIcon, Film as FilmIcon, ShoppingBag as ShoppingBagIcon, Lock as LockIcon, ListChecks as ListChecksIcon, MessageCircle as MessageCircleIcon, ShieldAlert as ShieldAlertIcon, Code2 as Code2Icon, Zap as ZapIcon, ArrowUp, ArrowDown, Sparkles, Palette } from 'lucide-react';
import type { Scenario, BotConfig, HumanRoleConfig, InitialPostConfig, ScenarioEvent, BotTemplate, RoleTemplate } from '@/lib/types';
import React, { useEffect, useState, type FormEvent, type KeyboardEvent, type ChangeEvent, type ReactNode, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { tagTaxonomy, type TagCategory as TaxonomyCategoryType, type Tag as TaxonomyTagType } from '@/lib/tag-taxonomy';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { db, storage } from '@/lib/firebase';
import { doc, getDoc, setDoc, addDoc, collection, serverTimestamp, Timestamp, updateDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import Image from 'next/image';
import { availableIcons, lucideIconMap } from '@/lib/config';

const editorSections = [
  { id: "basisinfo", label: "Basis", icon: <FileText className="mr-2 h-4 w-4" /> },
  { id: "initialpost", label: "Startpost", icon: <MessageSquareTextIcon className="mr-2 h-4 w-4" /> },
  { id: "botconfig", label: "Bots", icon: <BotIconLucide className="mr-2 h-4 w-4" /> },
  { id: "humanroles", label: "Rollen", icon: <UsersIconLucideReal className="mr-2 h-4 w-4" /> },
  { id: "events", label: "Events", icon: <Sparkles className="mr-2 h-4 w-4" /> },
  { id: "metadaten", label: "Meta", icon: <ImageIconReal className="mr-2 h-4 w-4" /> },
  { id: "tags", label: "Tags", icon: <TagsIcon className="mr-2 h-4 w-4" /> },
  // { id: "originaldaten", label: "DB-Daten", icon: <DatabaseIcon className="mr-2 h-4 w-4" /> },
];


export function createDefaultScenario(): Omit<Scenario, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    title: 'Neues Szenario',
    kurzbeschreibung: '',
    langbeschreibung: '',
    lernziele: '',
    iconName: availableIcons[0]?.value || 'ImageIconReal',
    tags: [],
    previewImageUrl: '',
    status: 'draft',
    defaultBotsConfig: [],
    humanRolesConfig: [],
    initialPost: {
      authorName: 'System',
      authorAvatarFallback: 'SY',
      content: '',
      imageUrl: '',
      platform: 'Generic',
    },
    events: [],
  };
}

export default function EditScenarioPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const scenarioIdFromUrl = params.scenarioId as string;

  const [isNewScenario, setIsNewScenario] = useState(scenarioIdFromUrl === 'new');
  const [currentScenarioId, setCurrentScenarioId] = useState<string | null>(isNewScenario ? null : scenarioIdFromUrl);

  // Form States
  const [title, setTitle] = useState('');
  const [kurzbeschreibung, setKurzbeschreibung] = useState('');
  const [langbeschreibung, setLangbeschreibung] = useState('');
  const [lernzieleContent, setLernzieleContent] = useState('');
  
  const [previewImageUrlInput, setPreviewImageUrlInput] = useState('');
  const [previewImageFile, setPreviewImageFile] = useState<File | null>(null);
  const [isUploadingPreviewImage, setIsUploadingPreviewImage] = useState(false);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);

  const [iconNameInput, setIconNameInput] = useState<string>(availableIcons[0]?.value || 'ImageIconReal');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [manualTagInput, setManualTagInput] = useState('');
  const [tagSearchTerm, setTagSearchTerm] = useState('');

  const [editableBotsConfig, setEditableBotsConfig] = useState<BotConfig[]>([]);
  const [editableHumanRoles, setEditableHumanRoles] = useState<HumanRoleConfig[]>([]);
  const [botSaveAsTemplateFlags, setBotSaveAsTemplateFlags] = useState<Record<string, boolean>>({});
  const [roleSaveAsTemplateFlags, setRoleSaveAsTemplateFlags] = useState<Record<string, boolean>>({});

  const [editableInitialPost, setEditableInitialPost] = useState<InitialPostConfig>(createDefaultScenario().initialPost!);
  const [editableEvents, setEditableEvents] = useState<ScenarioEvent[]>([]);
  const [newEventName, setNewEventName] = useState('');
  const [newEventDescription, setNewEventDescription] = useState('');

  const [dbBotTemplates, setDbBotTemplates] = useState<BotTemplate[]>([]);
  const [dbRoleTemplates, setDbRoleTemplates] = useState<RoleTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [originalScenarioData, setOriginalScenarioData] = useState<Scenario | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const loadScenario = useCallback(async () => {
    console.log("loadScenario called. isNewScenario:", isNewScenario, "currentScenarioId:", currentScenarioId);
    setIsLoading(true);
    setError(null);
  
    if (isNewScenario || !currentScenarioId || currentScenarioId === 'new') {
      console.log("Setting up for new scenario.");
      const newScenarioData = createDefaultScenario();
      setTitle(newScenarioData.title);
      setKurzbeschreibung(newScenarioData.kurzbeschreibung);
      setLangbeschreibung(newScenarioData.langbeschreibung);
      setLernzieleContent(newScenarioData.lernziele || '');
      setPreviewImageUrlInput(newScenarioData.previewImageUrl || '');
      setLocalPreviewUrl(newScenarioData.previewImageUrl || null);
      setIconNameInput(newScenarioData.iconName || availableIcons[0]?.value || 'ImageIconReal');
      setStatus(newScenarioData.status || 'draft');
      setSelectedTags(newScenarioData.tags || []);
      setEditableBotsConfig(JSON.parse(JSON.stringify(newScenarioData.defaultBotsConfig || [])));
      setEditableHumanRoles(JSON.parse(JSON.stringify(newScenarioData.humanRolesConfig || [])));
      setEditableInitialPost(JSON.parse(JSON.stringify(newScenarioData.initialPost || createDefaultScenario().initialPost!)));
      setEditableEvents(JSON.parse(JSON.stringify(newScenarioData.events || [])));
      setOriginalScenarioData(null);
      setBotSaveAsTemplateFlags({});
      setRoleSaveAsTemplateFlags({});
      setIsLoading(false);
      return;
    }
  
    console.log(`Attempting to load scenario with ID: ${currentScenarioId}`);
    try {
      const scenarioDocRef = doc(db, "scenarios", currentScenarioId);
      const scenarioSnap = await getDoc(scenarioDocRef);
  
      if (scenarioSnap.exists()) {
        console.log("Scenario found in Firestore:", scenarioSnap.data());
        const foundScenario = { id: scenarioSnap.id, ...scenarioSnap.data() } as Scenario;
        setOriginalScenarioData(JSON.parse(JSON.stringify(foundScenario)));
        setTitle(foundScenario.title || '');
        setKurzbeschreibung(foundScenario.kurzbeschreibung || '');
        setLangbeschreibung(foundScenario.langbeschreibung || '');
        setLernzieleContent(foundScenario.lernziele || '');
        setPreviewImageUrlInput(foundScenario.previewImageUrl || '');
        setLocalPreviewUrl(foundScenario.previewImageUrl || null);
        setIconNameInput(foundScenario.iconName || (availableIcons[0]?.value || 'ImageIconReal'));
        setStatus(foundScenario.status || 'draft');
        setSelectedTags(foundScenario.tags || []);
        setEditableBotsConfig(JSON.parse(JSON.stringify(foundScenario.defaultBotsConfig || [])));
        setEditableHumanRoles(JSON.parse(JSON.stringify(foundScenario.humanRolesConfig || [])));
        
        const defaultInitialPostData = createDefaultScenario().initialPost!;
        setEditableInitialPost(JSON.parse(JSON.stringify({
          ...defaultInitialPostData, 
          ...(foundScenario.initialPost || {}), 
        })));
        setEditableEvents(JSON.parse(JSON.stringify(foundScenario.events || [])));
  
        const initialBotFlags: Record<string, boolean> = {};
        (foundScenario.defaultBotsConfig || []).forEach(bot => {
            if (bot && bot.id) initialBotFlags[bot.id] = false;
        });
        setBotSaveAsTemplateFlags(initialBotFlags);
  
        const initialRoleFlags: Record<string, boolean> = {};
        (foundScenario.humanRolesConfig || []).forEach(role => {
             if (role && role.id) initialRoleFlags[role.id] = false;
        });
        setRoleSaveAsTemplateFlags(initialRoleFlags);
      } else {
        console.error(`Scenario with ID "${currentScenarioId}" not found in Firestore.`);
        setError(`Szenario mit der ID "${currentScenarioId}" nicht in der Datenbank gefunden.`);
        toast({
          variant: "destructive",
          title: "Fehler: Szenario nicht gefunden",
          description: `Das Szenario mit der ID "${currentScenarioId}" konnte nicht geladen werden. Sie werden zum Hub weitergeleitet.`,
        });
        router.push('/admin/scenario-editor');
      }
    } catch (err: any) {
      console.error("Error loading scenario from Firestore: ", err);
      setError(`Fehler beim Laden des Szenarios: ${err.message || "Unbekannter Fehler"}.`);
      toast({ variant: "destructive", title: "Ladefehler", description: "Szenario konnte nicht geladen werden."});
    } finally {
      console.log("loadScenario finished. Setting isLoading to false.");
      setIsLoading(false);
    }
  }, [currentScenarioId, isNewScenario, router, toast]);

  useEffect(() => {
    // Load scenario data if currentScenarioId is set and not 'new'
    // or if it's a new scenario (isNewScenario is true)
    if ((currentScenarioId && currentScenarioId !== 'new') || isNewScenario) {
      loadScenario();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentScenarioId, isNewScenario]); // loadScenario is memoized

  useEffect(() => {
    setIsLoadingTemplates(true);
    let botTemplatesLoaded = false;
    let roleTemplatesLoaded = false;

    const checkAndSetLoadingFalse = () => {
      if (botTemplatesLoaded && roleTemplatesLoaded) {
        setIsLoadingTemplates(false);
      }
    };

    const botTemplatesColRef = collection(db, "botTemplates");
    const qBot = query(botTemplatesColRef, orderBy("name", "asc"));
    const unsubscribeBots = onSnapshot(qBot, (querySnapshot) => {
      const fetchedBotTemplates: BotTemplate[] = [];
      querySnapshot.forEach((docSnap) => {
        fetchedBotTemplates.push({ templateId: docSnap.id, ...docSnap.data() } as BotTemplate);
      });
      setDbBotTemplates(fetchedBotTemplates);
      botTemplatesLoaded = true;
      checkAndSetLoadingFalse();
    }, (err) => {
      console.error("Error fetching bot templates:", err);
      toast({ variant: "destructive", title: "Fehler", description: "Bot-Vorlagen konnten nicht geladen werden."});
      botTemplatesLoaded = true; 
      checkAndSetLoadingFalse();
    });

    const roleTemplatesColRef = collection(db, "roleTemplates");
    const qRole = query(roleTemplatesColRef, orderBy("name", "asc"));
    const unsubscribeRoles = onSnapshot(qRole, (querySnapshot) => {
      const fetchedRoleTemplates: RoleTemplate[] = [];
      querySnapshot.forEach((docSnap) => {
        fetchedRoleTemplates.push({ templateId: docSnap.id, ...docSnap.data() } as RoleTemplate);
      });
      setDbRoleTemplates(fetchedRoleTemplates);
      roleTemplatesLoaded = true;
      checkAndSetLoadingFalse();
    }, (err) => {
      console.error("Error fetching role templates:", err);
      toast({ variant: "destructive", title: "Fehler", description: "Rollen-Vorlagen konnten nicht geladen werden."});
      roleTemplatesLoaded = true; 
      checkAndSetLoadingFalse();
    });

    return () => {
      unsubscribeBots();
      unsubscribeRoles();
    };
  }, [toast]); 

  const handlePreviewImageFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({ variant: "destructive", title: "Datei zu groß", description: "Bild darf maximal 5MB groß sein." });
        setPreviewImageFile(null);
        setLocalPreviewUrl(originalScenarioData?.previewImageUrl || previewImageUrlInput || null); // Revert to old or input URL
        if (fileInputRef.current) fileInputRef.current.value = ""; // Clear file input
        return;
      }
      setPreviewImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLocalPreviewUrl(reader.result as string);
        setPreviewImageUrlInput(''); // Clear URL input if file is selected
      };
      reader.readAsDataURL(file);
    } else {
      // No file selected or selection cleared
      setPreviewImageFile(null);
      // Revert local preview based on whether a URL was input or existed
      setLocalPreviewUrl(previewImageUrlInput || originalScenarioData?.previewImageUrl || null);
    }
  };

  const handlePreviewImageUrlInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setPreviewImageUrlInput(url);
    if (url) {
        setLocalPreviewUrl(url); // Show preview from URL
        if (previewImageFile) { // If a file was selected, clear it
            setPreviewImageFile(null);
            if (fileInputRef.current) fileInputRef.current.value = ""; // Clear file input
        }
    } else {
       // URL input cleared
       if (!previewImageFile) { // If no file is selected either, revert to original or show nothing
         setLocalPreviewUrl(originalScenarioData?.previewImageUrl || null);
       }
       // If a file IS selected, its local preview (already set) should remain.
    }
  };

  const handleBotConfigChange = (index: number, field: keyof Omit<BotConfig, 'id' | 'templateOriginId'>, value: any) => {
    const updatedBots = [...editableBotsConfig];
    if (updatedBots[index]) {
      const botToUpdate = { ...updatedBots[index] };
      (botToUpdate as any)[field] = value;
      // Ensure avatarFallback is max 2 chars or defaults
      if (field === 'name' && !botToUpdate.avatarFallback?.trim()) {
          botToUpdate.avatarFallback = (value || 'BT').substring(0,2).toUpperCase();
      }
      if (field === 'avatarFallback') {
          botToUpdate.avatarFallback = value.substring(0,2).toUpperCase();
      }
      updatedBots[index] = botToUpdate;
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
        templateOriginId: '', // Manually added bots don't have a template origin
    }]);
    setBotSaveAsTemplateFlags(prev => ({ ...prev, [newBotId]: false }));
  };

  const handleAddBotFromTemplate = (templateId: string) => {
    const template = dbBotTemplates.find(t => t.templateId === templateId);
    if (template) {
      const newBotId = `bot-inst-tpl-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const newBotFromTemplate: BotConfig = {
        id: newBotId, 
        name: template.name || "Bot aus Vorlage",
        personality: template.personality,
        avatarFallback: template.avatarFallback || (template.name || "BT").substring(0,2).toUpperCase() || "BT",
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

  const handleMoveBot = (index: number, direction: 'up' | 'down') => {
    const newBotsConfig = [...editableBotsConfig];
    const botToMove = newBotsConfig[index];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;

    if (swapIndex < 0 || swapIndex >= newBotsConfig.length) {
      return; 
    }

    newBotsConfig[index] = newBotsConfig[swapIndex];
    newBotsConfig[swapIndex] = botToMove;
    setEditableBotsConfig(newBotsConfig);
  };


  const handleHumanRoleChange = (index: number, field: keyof Omit<HumanRoleConfig, 'id' | 'templateOriginId'>, value: string) => {
    const updatedRoles = [...editableHumanRoles];
    if (updatedRoles[index]) {
        const roleToUpdate = { ...updatedRoles[index] };
        (roleToUpdate as any)[field] = value;
        updatedRoles[index] = roleToUpdate;
        setEditableHumanRoles(updatedRoles);
    }
  };

  const handleAddHumanRole = () => {
    const newRoleId = `role-inst-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    setEditableHumanRoles([...editableHumanRoles, {
        id: newRoleId, 
        name: "Neue Rolle",
        description: "Beschreibung der neuen Rolle...",
        templateOriginId: '', // Manually added roles don't have a template origin
    }]);
    setRoleSaveAsTemplateFlags(prev => ({ ...prev, [newRoleId]: false }));
  };

  const handleAddHumanRoleFromTemplate = (templateId: string) => {
    const template = dbRoleTemplates.find(t => t.templateId === templateId);
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

  const handleMoveHumanRole = (index: number, direction: 'up' | 'down') => {
    const newRolesConfig = [...editableHumanRoles];
    const roleToMove = newRolesConfig[index];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;

    if (swapIndex < 0 || swapIndex >= newRolesConfig.length) {
      return; 
    }
    newRolesConfig[index] = newRolesConfig[swapIndex];
    newRolesConfig[swapIndex] = roleToMove;
    setEditableHumanRoles(newRolesConfig);
  };

  const handleInitialPostChange = (field: keyof InitialPostConfig, value: string | undefined) => {
    setEditableInitialPost(prev => ({ 
        ...prev, 
        [field]: value === undefined ? '' : value 
    }));
  };

  const handleAddEvent = () => {
    if (!newEventName.trim()) {
      toast({ variant: "destructive", title: "Ereignisname fehlt", description: "Bitte geben Sie einen Namen für das Ereignis ein." });
      return;
    }
    const newEvent: ScenarioEvent = {
      id: `event-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: newEventName.trim(),
      description: newEventDescription.trim(),
      triggerType: 'manual', 
    };
    setEditableEvents(prev => [...prev, newEvent]);
    setNewEventName('');
    setNewEventDescription('');
  };

  const handleRemoveEvent = (eventId: string) => {
    setEditableEvents(prev => prev.filter(event => event.id !== eventId));
  };

  const handleTagToggle = (tagName: string) => {
    const lowerTagName = tagName.toLowerCase();
    setSelectedTags(prevTags =>
      (prevTags || []).map(t=>t.toLowerCase()).includes(lowerTagName)
        ? (prevTags || []).filter(t => t.toLowerCase() !== lowerTagName)
        : [...(prevTags || []), tagName] 
    );
  };

  const processManualTagInput = () => {
    if (!manualTagInput.trim()) return;
    const currentSelectedLower = (selectedTags || []).map(st => st.toLowerCase());
    const newTags = manualTagInput
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag !== '' && !currentSelectedLower.includes(tag.toLowerCase()));

    if (newTags.length > 0) {
      setSelectedTags(prevTags => [...(prevTags || []), ...newTags.map(tag => tag.charAt(0).toUpperCase() + tag.slice(1).toLowerCase())]);
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
    setSelectedTags(prevTags => (prevTags || []).filter(tag => tag.toLowerCase() !== tagToRemove.toLowerCase()));
  };

  const filteredTagTaxonomy = React.useMemo(() => {
    if (!tagSearchTerm.trim()) {
      return tagTaxonomy;
    }
    const lowerSearchTerm = tagSearchTerm.toLowerCase();
    return tagTaxonomy
      .map(category => {
        const categoryMatches = category.categoryName.toLowerCase().includes(lowerSearchTerm) || 
                                (category.emoji && category.emoji.includes(tagSearchTerm)); // Check emoji
        const filteredTags = category.tags.filter(tag =>
          tag.name.toLowerCase().includes(lowerSearchTerm) ||
          (tag.emoji && tag.emoji.includes(tagSearchTerm)) || // Check tag emoji
          (tag.subTags && tag.subTags.some(subTag => 
            subTag.name.toLowerCase().includes(lowerSearchTerm) || 
            (subTag.emoji && subTag.emoji.includes(tagSearchTerm)) // Check subTag emoji
          ))
        );
        
        if (categoryMatches || filteredTags.length > 0) {
          return { 
            ...category, 
            tags: categoryMatches 
              ? category.tags // If category matches, show all its tags
              : filteredTags.map(tag => ({ // Else, show only filtered tags and their relevant subTags
                  ...tag,
                  subTags: tag.subTags?.filter(subTag => 
                      subTag.name.toLowerCase().includes(lowerSearchTerm) ||
                      (subTag.emoji && subTag.emoji.includes(tagSearchTerm))
                    )
                }))
          };
        }
        return null;
      })
      .filter(category => category !== null) as TaxonomyCategoryType[];
  }, [tagSearchTerm]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setError(null);

    let finalPreviewImageUrl = previewImageUrlInput || originalScenarioData?.previewImageUrl || '';

    if (previewImageFile) {
      setIsUploadingPreviewImage(true);
      const idForPath = currentScenarioId || `new-${Date.now()}`;
      const imageFileNameForPath = `preview_${idForPath}_${Date.now()}_${previewImageFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const imagePath = `scenario_previews/${imageFileNameForPath}`;
      const sRef = storageRef(storage, imagePath);
      try {
        const uploadTaskSnapshot = await uploadBytesResumable(sRef, previewImageFile);
        finalPreviewImageUrl = await getDownloadURL(uploadTaskSnapshot.ref);
        toast({ title: "Vorschaubild hochgeladen", description: "Das neue Vorschaubild wurde gespeichert." });
      } catch (uploadError: any) {
        console.error("Error uploading preview image:", uploadError);
        toast({ variant: "destructive", title: "Uploadfehler Vorschaubild", description: uploadError.message || "Vorschaubild konnte nicht hochgeladen werden." });
        setIsUploadingPreviewImage(false);
        setIsSaving(false);
        return; 
      }
      setIsUploadingPreviewImage(false);
    }
    
    const scenarioDataToSave: Omit<Scenario, 'id' | 'createdAt' | 'updatedAt'> = {
      title: title || 'Unbenanntes Szenario',
      kurzbeschreibung: kurzbeschreibung || '',
      langbeschreibung: langbeschreibung || '',
      lernziele: lernzieleContent || '',
      previewImageUrl: finalPreviewImageUrl,
      iconName: iconNameInput || (availableIcons[0]?.value || 'ImageIconReal'),
      status: status || 'draft',
      tags: (selectedTags || []).map(t => String(t || '').toLowerCase()),
      defaultBotsConfig: (editableBotsConfig || []).map(b => ({ 
        ...b, 
        id: b.id || `bot-${Date.now()}-${Math.random().toString(36).substring(2,5)}`,
        avatarFallback: b.avatarFallback?.substring(0,2).toUpperCase() || (b.name || "B").substring(0,2).toUpperCase() || "BT",
        currentEscalation: b.currentEscalation ?? 0,
        isActive: b.isActive ?? true,
        autoTimerEnabled: b.autoTimerEnabled ?? false,
      })),
      humanRolesConfig: (editableHumanRoles || []).map(r => ({ 
        ...r, 
        id: r.id || `role-${Date.now()}-${Math.random().toString(36).substring(2,5)}` 
      })),
      initialPost: {
        authorName: editableInitialPost?.authorName || 'System',
        authorAvatarFallback: editableInitialPost?.authorAvatarFallback?.substring(0,2).toUpperCase() || (editableInitialPost?.authorName || 'SYS').substring(0,2).toUpperCase() || 'SY',
        content: editableInitialPost?.content || '',
        imageUrl: editableInitialPost?.imageUrl || '',
        platform: editableInitialPost?.platform || 'Generic',
      },
      events: (editableEvents || []).map(e => ({ 
        ...e, 
        id: e.id || `event-${Date.now()}-${Math.random().toString(36).substring(2,5)}`
      })),
    };
    
    const dataForFirestore: Partial<Scenario> & {updatedAt: Timestamp; createdAt?: Timestamp} = {
      ...scenarioDataToSave,
      updatedAt: Timestamp.now(),
    };
    
    try {
      for (const bot of editableBotsConfig) { 
        if (bot && bot.id && botSaveAsTemplateFlags[bot.id]) {
          const newBotTemplateData: Omit<BotTemplate, 'templateId' | 'createdAt'> = {
            name: bot.name || 'Unbenannter Bot',
            personality: bot.personality,
            avatarFallback: bot.avatarFallback || (bot.name || 'BT').substring(0,2).toUpperCase() || 'BT',
            initialMission: bot.initialMission || '',
          };
          const docRef = await addDoc(collection(db, "botTemplates"), {...newBotTemplateData, createdAt: serverTimestamp()});
          toast({ title: "Bot-Vorlage gespeichert", description: `Bot "${newBotTemplateData.name}" wurde als neue Vorlage (ID: ${docRef.id}) gesichert.` });
          
          const botIndex = editableBotsConfig.findIndex(b => b && b.id === bot.id);
          if(botIndex !== -1) {
            const updatedBots = [...editableBotsConfig]; 
            updatedBots[botIndex] = {...updatedBots[botIndex], templateOriginId: docRef.id};
            setEditableBotsConfig(updatedBots); 
            if(dataForFirestore.defaultBotsConfig && dataForFirestore.defaultBotsConfig[botIndex]) {
                 (dataForFirestore.defaultBotsConfig[botIndex] as BotConfig).templateOriginId = docRef.id;
            }
          }
          setBotSaveAsTemplateFlags(prev => ({ ...prev, [bot.id!]: false })); 
        }
      }

      for (const role of editableHumanRoles) { 
        if (role && role.id && roleSaveAsTemplateFlags[role.id]) {
          const newRoleTemplateData: Omit<RoleTemplate, 'templateId' | 'createdAt'> = {
            name: role.name || 'Unbenannte Rolle',
            description: role.description || '',
          };
          const docRef = await addDoc(collection(db, "roleTemplates"), {...newRoleTemplateData, createdAt: serverTimestamp()});
          toast({ title: "Rollen-Vorlage gespeichert", description: `Rolle "${newRoleTemplateData.name}" wurde als neue Vorlage (ID: ${docRef.id}) gesichert.` });
          
          const roleIndex = editableHumanRoles.findIndex(r => r && r.id === role.id);
           if(roleIndex !== -1) {
            const updatedRoles = [...editableHumanRoles]; 
            updatedRoles[roleIndex] = {...updatedRoles[roleIndex], templateOriginId: docRef.id};
            setEditableHumanRoles(updatedRoles); 
            if(dataForFirestore.humanRolesConfig && dataForFirestore.humanRolesConfig[roleIndex]) {
                 (dataForFirestore.humanRolesConfig[roleIndex] as HumanRoleConfig).templateOriginId = docRef.id;
            }
          }
          setRoleSaveAsTemplateFlags(prev => ({ ...prev, [role.id!]: false })); 
        }
      }

      if (isNewScenario) {
        const dataWithCreationTimestamp = { ...dataForFirestore, createdAt: Timestamp.now() };
        const docRef = await addDoc(collection(db, "scenarios"), dataWithCreationTimestamp);
        toast({
          title: "Szenario erstellt",
          description: `Das Szenario "${dataWithCreationTimestamp.title}" wurde erfolgreich gespeichert.`,
        });
        setIsNewScenario(false); 
        setCurrentScenarioId(docRef.id); 
        router.replace(`/admin/scenario-editor/${docRef.id}`, { scroll: false }); 
      } else if (currentScenarioId) {
        const scenarioDocRef = doc(db, "scenarios", currentScenarioId);
        await setDoc(scenarioDocRef, dataForFirestore, { merge: true }); 
        toast({
          title: "Szenario gespeichert",
          description: `Änderungen für "${dataForFirestore.title}" wurden erfolgreich gespeichert.`,
        });
        const updatedSnap = await getDoc(scenarioDocRef);
         if (updatedSnap.exists()) {
            const updatedScenario = { id: updatedSnap.id, ...updatedSnap.data() } as Scenario;
            setOriginalScenarioData(JSON.parse(JSON.stringify(updatedScenario))); // Update original data
            if (previewImageFile && finalPreviewImageUrl && finalPreviewImageUrl !== (originalScenarioData?.previewImageUrl || previewImageUrlInput)) {
                 setPreviewImageUrlInput(finalPreviewImageUrl); // Update input to reflect the uploaded URL
                 setLocalPreviewUrl(finalPreviewImageUrl); // Update local preview to uploaded image
                 setPreviewImageFile(null); // Clear the file buffer
                 if (fileInputRef.current) fileInputRef.current.value = "";
            } else if (!finalPreviewImageUrl && !previewImageUrlInput && (!originalScenarioData || !originalScenarioData.previewImageUrl)) { 
                 setLocalPreviewUrl(null);
            }
        }
      } else {
        throw new Error("Keine Szenario-ID zum Speichern vorhanden.");
      }
    } catch (err: any) {
      console.error("Error saving scenario/templates to Firestore: ", err, "Data sent:", JSON.stringify(dataForFirestore, null, 2));
      setError(`Speicherfehler: ${err.message}. Überprüfen Sie die Konsole für Details und die gesendeten Daten.`);
      toast({ variant: "destructive", title: "Speicherfehler", description: err.message || "Szenario/Vorlagen konnten nicht gespeichert werden."});
    } finally {
      setIsSaving(false);
    }
  };


  if (isLoading && !isNewScenario) {
    return (
      <div className="flex items-center justify-center min-h-screen p-6">
        <Card className="w-full max-w-md">
          <CardHeader><CardTitle className="flex items-center"><Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" /> Lade Szenariodaten...</CardTitle></CardHeader>
          <CardContent className="flex items-center justify-center py-4"><p className="text-muted-foreground">Bitte einen Moment Geduld.</p></CardContent>
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

  const displayedTitle = isNewScenario ? (title || "Neues Szenario erstellen") : (title || "Szenario laden...");
  const currentIdForDisplay = isNewScenario ? "Wird nach erstem Speichern generiert" : currentScenarioId;
  const defaultAccordionValues = editorSections.map(s => s.id); 

  const renderIcon = (iconNameSelected: string | undefined): ReactNode => {
    if (!iconNameSelected || !lucideIconMap[iconNameSelected]) return <ImageIconReal className="mr-2 h-4 w-4" />; 
    const IconComponent = lucideIconMap[iconNameSelected];
    return <IconComponent className="mr-2 h-4 w-4" />;
  };


  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      {/* Combined Sticky Header */}
      <div className="sticky top-16 bg-background z-20 border-b"> 
        <div className="px-4 py-3 sm:px-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-primary truncate max-w-xs sm:max-w-md md:max-w-lg flex items-center">
              {renderIcon(iconNameInput)}
              Editor: <span className="text-foreground ml-2">{displayedTitle}</span>
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5 ml-8">
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
            <Button type="submit" disabled={isSaving || (isLoading && !isNewScenario) || isUploadingPreviewImage} className="min-w-[150px]">
              {isUploadingPreviewImage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />)}
              {isUploadingPreviewImage ? "Bild lädt hoch..." : (isSaving ? "Speichert..." : (isNewScenario ? "Szenario erstellen" : "Änderungen speichern"))}
            </Button>
          </div>
        </div>

        <ScrollArea orientation="horizontal" className="max-w-full border-t bg-background/90 backdrop-blur-sm">
           <div className="flex items-center space-x-1 whitespace-nowrap px-2 sm:px-4 py-2">
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
                  <DatabaseIcon className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline ml-1">DB-Daten</span>
                </a>
              </Button>
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-8 pt-3"> 
        <div className="max-w-[1000px] mx-auto"> 
            <Accordion type="multiple" defaultValue={defaultAccordionValues} className="w-full space-y-4">

                <AccordionItem value="basisinfo" id="basisinfo" className="border-none scroll-mt-32"> 
                <Card className="shadow-md w-full">
                    <AccordionTrigger className="py-3 px-4 hover:no-underline text-left border-b">
                    <CardTitle className="text-lg flex items-center"><FileText className="mr-2 h-5 w-5 text-primary"/>Basisinformationen</CardTitle>
                    </AccordionTrigger>
                    <AccordionContent className="accordion-content-wrapper">
                    <CardHeader className="p-4 pb-2">
                        <CardDescription>
                        Grundlegende Details und Beschreibungen des Szenarios.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 p-4 accordion-card-content">
                        <div className="space-y-1.5">
                        <Label htmlFor="title">Titel des Szenarios</Label>
                        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ein prägnanter Titel" disabled={isSaving} className="w-full"/>
                        </div>
                        <div className="space-y-1.5">
                        <Label htmlFor="kurzbeschreibung">Kurzbeschreibung (für Übersichtskarten)</Label>
                        <Textarea id="kurzbeschreibung" value={kurzbeschreibung} onChange={(e) => setKurzbeschreibung(e.target.value)} placeholder="Eine kurze Zusammenfassung (ca. 1-2 Sätze)." rows={3} disabled={isSaving} className="w-full"/>
                        </div>
                        <div className="space-y-1.5">
                        <Label htmlFor="langbeschreibung">Langbeschreibung / Szenariokontext (für Simulation)</Label>
                        <Textarea id="langbeschreibung" value={langbeschreibung} onChange={(e) => setLangbeschreibung(e.target.value)} placeholder="Ausführliche Beschreibung der Ausgangslage, Thema, beteiligte Akteure etc. Dies ist der Hauptkontext für die Simulation und die Bots." rows={8} className="min-h-[150px] md:min-h-[200px] w-full" disabled={isSaving}/>
                         <p className="text-xs text-muted-foreground mt-1">Hinweis: WYSIWYG-Editor für Rich-Text-Formatierung ist für eine zukünftige Version geplant.</p>
                        </div>
                        <div className="space-y-1.5">
                        <Label htmlFor="lernzieleContent">Lernziele</Label>
                        <Textarea id="lernzieleContent" value={lernzieleContent} onChange={(e) => setLernzieleContent(e.target.value)} placeholder={"Was sollen die Teilnehmenden lernen?\n- Ziel 1\n- Ziel 2"} rows={4} className="min-h-[80px] w-full" disabled={isSaving}/>
                         <p className="text-xs text-muted-foreground mt-1">Hinweis: WYSIWYG-Editor für Rich-Text-Formatierung ist für eine zukünftige Version geplant. Jedes Lernziel in eine neue Zeile.</p>
                        </div>
                    </CardContent>
                    </AccordionContent>
                </Card>
                </AccordionItem>

                <AccordionItem value="initialpost" id="initialpost" className="border-none scroll-mt-32">
                <Card className="shadow-md w-full">
                <AccordionTrigger className="py-3 px-4 hover:no-underline border-b text-left">
                    <CardTitle className="text-lg flex items-center"><MessageSquareTextIcon className="mr-2 h-5 w-5 text-primary"/>Ausgangsposting (1. Chatbeitrag)</CardTitle>
                </AccordionTrigger>
                <AccordionContent className="accordion-content-wrapper">
                    <CardHeader className="p-4 pb-2">
                    <CardDescription>
                        Dieser Beitrag wird als erste Nachricht im Chat angezeigt und startet die Simulation.
                    </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 p-4 accordion-card-content">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                            <Label htmlFor="initialPostAuthorName">Autor Name</Label>
                            <Input id="initialPostAuthorName" value={editableInitialPost.authorName} onChange={(e) => handleInitialPostChange('authorName', e.target.value)} placeholder="z.B. System, Klassen-Admin" disabled={isSaving} className="w-full"/>
                            </div>
                            <div className="space-y-1.5">
                            <Label htmlFor="initialPostAuthorAvatar">Autor Avatar Kürzel (max. 2)</Label>
                            <Input id="initialPostAuthorAvatar" value={editableInitialPost.authorAvatarFallback} onChange={(e) => handleInitialPostChange('authorAvatarFallback', e.target.value.substring(0,2))} placeholder="SA" maxLength={2} disabled={isSaving} className="w-full"/>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                        <Label htmlFor="initialPostPlatform">Plattform des Posts</Label>
                        <Select value={editableInitialPost.platform || 'Generic'} onValueChange={(value) => handleInitialPostChange('platform', value as any)} disabled={isSaving}>
                            <SelectTrigger id="initialPostPlatform" className="w-full">
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
                        <Textarea id="initialPostContent" value={editableInitialPost.content} onChange={(e) => handleInitialPostChange('content', e.target.value)} placeholder="Der Text des ersten Beitrags..." rows={5} className="min-h-[100px] w-full" disabled={isSaving}/>
                        </div>
                        <div className="space-y-1.5">
                        <Label htmlFor="initialPostImageUrl">Bild-URL für Post (optional)</Label>
                        <Input id="initialPostImageUrl" value={editableInitialPost.imageUrl || ''} onChange={(e) => handleInitialPostChange('imageUrl', e.target.value)} placeholder="https://beispiel.com/bild.png" disabled={isSaving} className="w-full"/>
                        <p className="text-xs text-muted-foreground mt-1">Direkte URL zu einem Bild.</p>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="initialPostImageUpload">Oder Bild für Post hochladen (optional)</Label>
                            <Input id="initialPostImageUpload" type="file" accept="image/*" onChange={(e) => { /* Logic for handling file upload to initialPost.imageUrl needs to be implemented with Firebase Storage */}} disabled={isSaving || true} className="w-full mt-1"/>
                            <p className="text-xs text-muted-foreground mt-1">Funktion zum Hochladen von Bildern für den initialen Post (zu Firebase Storage) wird später implementiert.</p>
                        </div>
                    </CardContent>
                    </AccordionContent>
                </Card>
                </AccordionItem>

                <AccordionItem value="botconfig" id="botconfig" className="border-none scroll-mt-32">
                <Card className="shadow-md w-full">
                <AccordionTrigger className="py-3 px-4 hover:no-underline border-b text-left">
                    <CardTitle className="text-lg flex items-center"><BotIconLucide className="mr-2 h-5 w-5 text-primary"/>Bot-Konfiguration ({editableBotsConfig.length})</CardTitle>
                </AccordionTrigger>
                <AccordionContent className="accordion-content-wrapper">
                    <CardHeader className="p-4 pb-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                        <div><CardDescription>Standard-Bots für dieses Szenario. Bearbeiten, hinzufügen oder aus Vorlagen wählen.</CardDescription></div>
                        <div className="flex gap-2 w-full sm:w-auto">
                            <Select onValueChange={handleAddBotFromTemplate} value="" disabled={isSaving || isLoadingTemplates}>
                                <SelectTrigger className="flex-1 sm:w-[230px] text-sm h-9">
                                    <SelectValue placeholder={isLoadingTemplates ? "Lade Vorlagen..." : "Bot aus Vorlage..."} />
                                </SelectTrigger>
                                <SelectContent>
                                    {dbBotTemplates.map(template => (
                                        <SelectItem key={template.templateId} value={template.templateId!}>{template.name}</SelectItem>
                                    ))}
                                    {dbBotTemplates.length === 0 && !isLoadingTemplates && <p className="p-2 text-xs text-muted-foreground">Keine Bot-Vorlagen.</p>}
                                </SelectContent>
                            </Select>
                            <Button type="button" size="sm" variant="outline" onClick={handleAddBot} disabled={isSaving} className="h-9">
                                <PlusCircle className="mr-2 h-4 w-4" /> Manuell
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4 p-4 accordion-card-content">
                        {editableBotsConfig.length > 0 ? (
                        editableBotsConfig.map((bot, index) => (
                            <Card key={bot.id || `bot-${index}`} className="p-4 bg-muted/20 w-full">
                            <CardHeader className="p-0 pb-3 flex flex-row items-start justify-between">
                                <div>
                                    <CardTitle className="text-md">Bot {index + 1}: <span className="font-normal">{bot.name || "Unbenannter Bot"}</span></CardTitle>
                                    <span className="font-mono text-xs text-muted-foreground">(ID: {bot.id?.substring(0,10) || 'neu'})</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="flex flex-col items-center gap-1">
                                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleMoveBot(index, 'up')} disabled={isSaving || index === 0}>
                                            <ArrowUp className="h-4 w-4"/>
                                        </Button>
                                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleMoveBot(index, 'down')} disabled={isSaving || index === editableBotsConfig.length - 1}>
                                            <ArrowDown className="h-4 w-4"/>
                                        </Button>
                                    </div>
                                    <Switch id={`bot-saveAsTemplate-${bot.id}`}
                                            checked={botSaveAsTemplateFlags[bot.id!] || false}
                                            onCheckedChange={() => handleBotSaveAsTemplateToggle(bot.id!)}
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
                                <Input id={`bot-name-${index}`} value={bot.name || ''} onChange={(e) => handleBotConfigChange(index, 'name', e.target.value)} placeholder="z.B. Bot Kevin" disabled={isSaving} className="w-full"/>
                                </div>
                                <div className="space-y-1.5">
                                <Label htmlFor={`bot-personality-${index}`}>Persönlichkeit</Label>
                                <Select value={bot.personality} onValueChange={(value) => handleBotConfigChange(index, 'personality', value as any)} disabled={isSaving}>
                                    <SelectTrigger id={`bot-personality-${index}`} className="w-full">
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
                                <Input id={`bot-avatar-${index}`} value={bot.avatarFallback || ''} onChange={(e) => handleBotConfigChange(index, 'avatarFallback', e.target.value)} placeholder="BK" maxLength={2} disabled={isSaving} className="w-full"/>
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor={`bot-escalation-${index}`}>Initiale Eskalation (0-3)</Label>
                                    <Input id={`bot-escalation-${index}`} type="number" min="0" max="3" value={bot.currentEscalation ?? 0} onChange={(e) => handleBotConfigChange(index, 'currentEscalation', parseInt(e.target.value))} disabled={isSaving} className="w-full"/>
                                </div>
                                <div className="space-y-1.5 md:col-span-2">
                                <Label htmlFor={`bot-initialMission-${index}`}>Initiale Mission/Anweisung</Label>
                                <Textarea id={`bot-initialMission-${index}`} value={bot.initialMission || ''} onChange={(e) => handleBotConfigChange(index, 'initialMission', e.target.value)} placeholder="Was soll der Bot zu Beginn tun oder sagen?" rows={3} disabled={isSaving} className="w-full"/>
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

                <AccordionItem value="humanroles" id="humanroles" className="border-none scroll-mt-32">
                <Card className="shadow-md w-full">
                <AccordionTrigger className="py-3 px-4 hover:no-underline border-b text-left">
                    <CardTitle className="text-lg flex items-center"><UsersIconLucideReal className="mr-2 h-5 w-5 text-primary"/>Rollen für menschliche Teilnehmer ({editableHumanRoles.length})</CardTitle>
                </AccordionTrigger>
                <AccordionContent className="accordion-content-wrapper">
                        <CardHeader className="p-4 pb-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                            <div><CardDescription>Definition der Rollen, ihrer Ziele und Informationen.</CardDescription></div>
                            <div className="flex gap-2 w-full sm:w-auto">
                                <Select onValueChange={handleAddHumanRoleFromTemplate} value="" disabled={isSaving || isLoadingTemplates}>
                                    <SelectTrigger className="flex-1 sm:w-[230px] text-sm h-9">
                                        <SelectValue placeholder={isLoadingTemplates ? "Lade Vorlagen..." : "Rolle aus Vorlage..."} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {dbRoleTemplates.map(template => (
                                            <SelectItem key={template.templateId} value={template.templateId!}>{template.name}</SelectItem>
                                        ))}
                                        {dbRoleTemplates.length === 0 && !isLoadingTemplates && <p className="p-2 text-xs text-muted-foreground">Keine Rollen-Vorlagen.</p>}
                                    </SelectContent>
                                </Select>
                                <Button type="button" size="sm" variant="outline" onClick={handleAddHumanRole} disabled={isSaving} className="h-9">
                                    <PlusCircle className="mr-2 h-4 w-4" /> Rolle manuell
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4 p-4 accordion-card-content">
                            {editableHumanRoles.length > 0 ? (
                            editableHumanRoles.map((role, index) => (
                                <Card key={role.id || `role-${index}`} className="p-4 bg-muted/20 w-full">
                                <CardHeader className="p-0 pb-3 flex flex-row items-start justify-between">
                                    <div>
                                        <CardTitle className="text-md">Rolle {index + 1}: <span className="font-normal">{role.name || "Unbenannte Rolle"}</span></CardTitle>
                                        <span className="font-mono text-xs text-muted-foreground">(ID: {role.id?.substring(0,10) || 'neu'})</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex flex-col items-center gap-1">
                                            <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleMoveHumanRole(index, 'up')} disabled={isSaving || index === 0}>
                                                <ArrowUp className="h-4 w-4"/>
                                            </Button>
                                            <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleMoveHumanRole(index, 'down')} disabled={isSaving || index === editableHumanRoles.length - 1}>
                                                <ArrowDown className="h-4 w-4"/>
                                            </Button>
                                        </div>
                                        <Switch id={`role-saveAsTemplate-${role.id}`}
                                                checked={roleSaveAsTemplateFlags[role.id!] || false}
                                                onCheckedChange={() => handleRoleSaveAsTemplateToggle(role.id!)}
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
                                        <Input id={`role-name-${index}`} value={role.name} onChange={(e) => handleHumanRoleChange(index, 'name', e.target.value)} placeholder="z.B. Angegriffene Person" disabled={isSaving} className="w-full"/>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor={`role-description-${index}`}>Rollenbeschreibung (Ziele, Infos etc.)</Label>
                                        <Textarea id={`role-description-${index}`} value={role.description} onChange={(e) => handleHumanRoleChange(index, 'description', e.target.value)} placeholder="Detailbeschreibung der Rolle, ihrer Ziele, Startinformationen, geheime Infos etc. Dies wird dem Teilnehmer angezeigt." rows={6} className="min-h-[120px] w-full" disabled={isSaving}/>
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

                 <AccordionItem value="events" id="events" className="border-none scroll-mt-32">
                  <Card className="shadow-md w-full">
                    <AccordionTrigger className="py-3 px-4 hover:no-underline border-b text-left">
                      <CardTitle className="text-lg flex items-center"><Sparkles className="mr-2 h-5 w-5 text-primary"/>Szenario-Ereignisse ({editableEvents.length})</CardTitle>
                    </AccordionTrigger>
                    <AccordionContent className="accordion-content-wrapper">
                      <CardHeader className="p-4 pb-2">
                        <CardDescription>
                          Definieren Sie hier Ereignisse, die später im Admin-Dashboard manuell ausgelöst werden können, um die Simulation zu beeinflussen.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4 p-4 accordion-card-content">
                        <div className="space-y-3 p-3 border rounded-md">
                          <Label className="text-base font-medium">Neues Ereignis erstellen</Label>
                          <div className="space-y-1.5">
                            <Label htmlFor="newEventName">Ereignisname</Label>
                            <Input id="newEventName" value={newEventName} onChange={(e) => setNewEventName(e.target.value)} placeholder="z.B. Plötzliche Wendung" disabled={isSaving} />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="newEventDescription">Ereignisbeschreibung</Label>
                            <Textarea id="newEventDescription" value={newEventDescription} onChange={(e) => setNewEventDescription(e.target.value)} placeholder="Was passiert bei diesem Ereignis?" rows={3} disabled={isSaving} />
                          </div>
                          <Button type="button" size="sm" onClick={handleAddEvent} disabled={isSaving || !newEventName.trim()}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Ereignis hinzufügen
                          </Button>
                        </div>
                        {editableEvents.length > 0 && <Separator className="my-4" />}
                        {editableEvents.length > 0 ? (
                          editableEvents.map((event) => (
                            <Card key={event.id} className="p-3 bg-muted/20">
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-medium">{event.name}</p>
                                  <p className="text-xs text-muted-foreground max-w-prose">{event.description || "Keine Beschreibung."}</p>
                                </div>
                                <Button type="button" variant="ghost" size="icon" className="text-destructive hover:text-destructive/80 h-7 w-7" onClick={() => handleRemoveEvent(event.id)} disabled={isSaving}>
                                  <Trash2 className="h-4 w-4"/>
                                </Button>
                              </div>
                            </Card>
                          ))
                        ) : (
                          <p className="text-muted-foreground text-sm text-center py-3">Keine Ereignisse für dieses Szenario definiert.</p>
                        )}
                      </CardContent>
                    </AccordionContent>
                  </Card>
                </AccordionItem>
                
                <AccordionItem value="metadaten" id="metadaten" className="border-none scroll-mt-32">
                <Card className="shadow-md w-full">
                    <AccordionTrigger className="py-3 px-4 hover:no-underline border-b text-left">
                        <CardTitle className="text-lg flex items-center"><ImageIconReal className="mr-2 h-5 w-5 text-primary"/>Szenario-Metadaten & Bild</CardTitle>
                    </AccordionTrigger>
                    <AccordionContent className="accordion-content-wrapper">
                        <CardHeader className="p-4 pb-2">
                            <CardDescription>Weitere Einstellungen wie Icon und Vorschaubild.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 p-4 accordion-card-content">
                            <div className="space-y-1.5">
                                <Label htmlFor="previewImageUrlInput">Vorschaubild URL</Label>
                                <Input 
                                  id="previewImageUrlInput" 
                                  value={previewImageUrlInput} 
                                  onChange={handlePreviewImageUrlInputChange}
                                  placeholder="https://beispiel.com/bild.png oder leer lassen" 
                                  disabled={isSaving || isUploadingPreviewImage} 
                                  className="w-full mt-1"
                                />
                                {localPreviewUrl && (
                                  <div className="mt-2 relative w-full max-w-xs h-auto aspect-video rounded-md overflow-hidden border">
                                    <Image src={localPreviewUrl} alt="Vorschaubild Vorschau" fill style={{objectFit:"cover"}} data-ai-hint="preview image" priority={false}/>
                                  </div>
                                )}
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="previewImageUpload">Oder Vorschaubild hochladen (max. 5MB)</Label>
                                <Input 
                                  ref={fileInputRef}
                                  id="previewImageUpload" 
                                  type="file" 
                                  accept="image/*" 
                                  onChange={handlePreviewImageFileChange} 
                                  disabled={isSaving || isUploadingPreviewImage} 
                                  className="w-full mt-1"
                                />
                                {isUploadingPreviewImage && <p className="text-xs text-primary mt-1 flex items-center"><Loader2 className="h-3 w-3 mr-1 animate-spin"/>Bild wird hochgeladen...</p>}
                                <p className="text-xs text-muted-foreground mt-1">Wählen Sie eine URL oben ODER laden Sie ein neues Bild hoch.</p>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="iconNameInput">Icon für Szenariokarte</Label>
                                <Select value={iconNameInput} onValueChange={setIconNameInput} disabled={isSaving}>
                                <SelectTrigger id="iconNameInput" className="w-full mt-1">
                                    <SelectValue placeholder="Icon wählen..." >
                                      <span className="flex items-center">
                                        {renderIcon(iconNameInput)}
                                        {availableIcons.find(i => i.value === iconNameInput)?.label || iconNameInput}
                                      </span>
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    {availableIcons.map(iconOpt => (
                                        <SelectItem key={iconOpt.value} value={iconOpt.value}>
                                          <span className="flex items-center">
                                            {React.createElement(lucideIconMap[iconOpt.value] || ImageIconReal, { className: "mr-2 h-4 w-4" })}
                                            {iconOpt.label}
                                          </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground mt-1">Wählen Sie ein passendes Icon.</p>
                            </div>
                        </CardContent>
                    </AccordionContent>
                </Card>
                </AccordionItem>

                <AccordionItem value="tags" id="tags" className="border-none scroll-mt-32">
                <Card className="shadow-md w-full">
                    <AccordionTrigger className="py-3 px-4 hover:no-underline border-b text-left">
                        <CardTitle className="text-lg flex items-center"><TagsIcon className="mr-2 h-5 w-5 text-primary"/>Themen-Tags ({selectedTags.length})</CardTitle>
                    </AccordionTrigger>
                    <AccordionContent className="accordion-content-wrapper">
                        <CardHeader className="p-4 pb-2">
                            <CardDescription>Weisen Sie dem Szenario passende Tags zu, um es besser kategorisieren zu können.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 accordion-card-content">
                            <div className="mb-4">
                                <Label htmlFor="manualTagInput">Tags manuell hinzufügen (kommagetrennt):</Label>
                                <div className="flex items-center gap-2 mt-1">
                                    <Input
                                        id="manualTagInput"
                                        placeholder="z.B. Cybermobbing, soziale medien, ..."
                                        className="flex-grow text-sm w-full"
                                        value={manualTagInput}
                                        onChange={handleManualTagInputChange}
                                        onKeyDown={handleManualTagInputKeyDown}
                                        onBlur={processManualTagInput} 
                                        disabled={isSaving || true} // Temporarily disable manual input until logic is complete
                                    />
                                    <Button type="button" size="sm" variant="outline" onClick={processManualTagInput} disabled={isSaving || !manualTagInput.trim() || true}>
                                        <PlusCircle className="mr-2 h-4 w-4" /> Hinzufügen
                                    </Button>
                                </div>
                                 <p className="text-xs text-muted-foreground mt-1">Hinweis: Die manuelle Tag-Eingabe und die Suchfunktion werden bald überarbeitet.</p>
                            </div>
                            <div className="mb-4">
                                <Label htmlFor="filterTagTaxonomyInput">Tag-Taxonomie filtern/suchen:</Label>
                                <Input 
                                    id="filterTagTaxonomyInput"
                                    placeholder="Taxonomie durchsuchen (Kategorie, Tag, Emoji)..."
                                    value={tagSearchTerm}
                                    onChange={(e) => setTagSearchTerm(e.target.value)}
                                    className="mt-1 text-sm w-full"
                                    disabled={isSaving}
                                />
                            </div>
                             <div className="mb-4">
                                <Label>Ausgewählte Tags ({selectedTags.length}):</Label>
                                {selectedTags && selectedTags.length > 0 ? (
                                    <div className="flex flex-wrap gap-2 mt-2 p-2 border rounded-md min-h-[40px]">
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
                                    <p className="text-xs text-muted-foreground mt-1 border rounded-md p-2 text-center">Keine Tags ausgewählt.</p>
                                )}
                            </div>
                            <Separator className="my-4" />
                            <Label>Verfügbare Tags (Klicken zum Hinzufügen/Entfernen):</Label>
                             <ScrollArea className="h-[400px] mt-2 pr-3 border rounded-md">
                                <Accordion type="multiple" className="w-full px-2" defaultValue={[]}>
                                    {filteredTagTaxonomy.map((category, catIndex) => (
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
                                                        <React.Fragment key={tag.name}>
                                                            <Badge
                                                                variant={(selectedTags || []).map(st => st.toLowerCase()).includes(tag.name.toLowerCase()) ? "default" : "outline"}
                                                                className="cursor-pointer hover:bg-primary/80 text-xs"
                                                                onClick={() => handleTagToggle(tag.name)}
                                                            >
                                                                {tag.emoji && <span className="mr-1.5">{tag.emoji}</span>}
                                                                {tag.name}
                                                            </Badge>
                                                            {tag.subTags && tag.subTags.filter(subTag => !tagSearchTerm.trim() || subTag.name.toLowerCase().includes(tagSearchTerm.toLowerCase()) || (subTag.emoji && subTag.emoji.includes(tagSearchTerm))).map(subTag => ( 
                                                                <Badge
                                                                    key={subTag.name}
                                                                    variant={(selectedTags || []).map(st=>st.toLowerCase()).includes(subTag.name.toLowerCase()) ? "default" : "outline"}
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
                                     {filteredTagTaxonomy.length === 0 && <p className="text-xs text-muted-foreground p-2">Keine Tags für Ihre Suche gefunden.</p>}
                                </Accordion>
                            </ScrollArea>
                        </CardContent>
                    </AccordionContent>
                </Card>
                </AccordionItem>
                

            {(!isNewScenario && currentScenarioId && originalScenarioData) && (
                <AccordionItem value="originaldaten" id="originaldaten" className="border-none scroll-mt-32">
                <Card className="shadow-md w-full">
                <AccordionTrigger className="py-3 px-4 hover:no-underline border-b text-left">
                    <CardTitle className="text-lg flex items-center"><DatabaseIcon className="mr-2 h-5 w-5 text-primary"/>Originaldaten (aus Datenbank)</CardTitle>
                </AccordionTrigger>
                <AccordionContent className="accordion-content-wrapper"> 
                    <CardHeader className="p-4 pb-2">
                    <CardDescription>Nur zur Referenz während der Entwicklung: So ist das Szenario aktuell in der Datenbank gespeichert.</CardDescription>
                    </CardHeader>
                    <CardContent className="accordion-card-content p-4">
                    <ScrollArea className="w-[200px] h-[200px]" orientation="both">
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
      </div>
    </form>
  );
}


    