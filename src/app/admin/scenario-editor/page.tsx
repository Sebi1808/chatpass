
"use client";

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { Scenario } from '@/lib/types';
import { FileEdit, PlusCircle, Search, Bot, Users, ListChecks, NotebookPen, Trash2, Copy, Eye, ShieldCheck, Loader2, PlayCircle, Filter, ArrowUpDown } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy, Timestamp, deleteDoc, doc, addDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { createDefaultScenario } from '@/app/admin/scenario-editor/[scenarioId]/page';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


export default function ScenarioEditorHubPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'published'>('all');
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isDuplicating, setIsDuplicating] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    setIsLoading(true);
    const scenariosColRef = collection(db, "scenarios");
    const q = query(scenariosColRef, orderBy("title", "asc"));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const fetchedScenarios: Scenario[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const scenarioData: Scenario = {
          id: docSnap.id,
          title: data.title || "Unbenanntes Szenario",
          kurzbeschreibung: data.kurzbeschreibung || "",
          langbeschreibung: data.langbeschreibung || "",
          lernziele: data.lernziele || "", 
          iconName: data.iconName || "ImageIcon",
          tags: data.tags || [],
          previewImageUrl: data.previewImageUrl || "",
          status: data.status || "draft",
          defaultBotsConfig: data.defaultBotsConfig || [],
          humanRolesConfig: data.humanRolesConfig || [],
          initialPost: data.initialPost || createDefaultScenario().initialPost,
          events: data.events || [],
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        };
        fetchedScenarios.push(scenarioData);
      });
      setScenarios(fetchedScenarios);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching scenarios from Firestore: ", error);
      toast({
        variant: "destructive",
        title: "Fehler beim Laden der Szenarien",
        description: "Szenarien konnten nicht aus der Datenbank geladen werden.",
      });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [toast]);

  const filteredScenarios = useMemo(() => {
    return scenarios
      .filter(scenario => {
        if (statusFilter === 'all') return true;
        return scenario.status === statusFilter;
      })
      .filter(scenario => {
        if (!searchTerm.trim()) return true;
        const lowerSearchTerm = searchTerm.toLowerCase();
        return (
          scenario.title.toLowerCase().includes(lowerSearchTerm) ||
          (scenario.kurzbeschreibung && scenario.kurzbeschreibung.toLowerCase().includes(lowerSearchTerm)) ||
          (scenario.tags && scenario.tags.some(tag => typeof tag === 'string' && tag.toLowerCase().includes(lowerSearchTerm)))
        );
      });
  }, [searchTerm, scenarios, statusFilter]);

  const handleCreateNewScenario = async () => {
    setIsCreatingNew(true);
    try {
      const newScenarioData = createDefaultScenario(); // Get default structure
      const scenarioToSave: Omit<Scenario, 'id'> = {
        ...newScenarioData, // Spread default values
        title: "Neues Szenario (Entwurf)", // Overwrite specific fields
        status: 'draft',
        createdAt: serverTimestamp() as Timestamp, // Set server timestamp
        updatedAt: serverTimestamp() as Timestamp,
      };
      const docRef = await addDoc(collection(db, "scenarios"), scenarioToSave);
      toast({
        title: "Szenario erstellt",
        description: `Neues Szenario "${scenarioToSave.title}" wurde als Entwurf angelegt.`,
      });
      router.push(`/admin/scenario-editor/${docRef.id}`);
    } catch (error) {
      console.error("Error creating new scenario: ", error);
      toast({ variant: "destructive", title: "Fehler", description: "Neues Szenario konnte nicht erstellt werden." });
    } finally {
      setIsCreatingNew(false);
    }
  };

  const handleDeleteScenario = async (scenarioId: string, scenarioTitle: string) => {
    setIsDeleting(scenarioId);
    try {
      await deleteDoc(doc(db, "scenarios", scenarioId));
      toast({
        title: "Szenario gelöscht",
        description: `Das Szenario "${scenarioTitle}" wurde erfolgreich entfernt.`,
      });
    } catch (error) {
      console.error("Error deleting scenario: ", error);
      toast({
        variant: "destructive",
        title: "Fehler beim Löschen",
        description: `Das Szenario "${scenarioTitle}" konnte nicht gelöscht werden.`,
      });
    } finally {
      setIsDeleting(null);
    }
  };

  const handleDuplicateScenario = async (scenarioId: string) => {
    setIsDuplicating(scenarioId);
    try {
      const scenarioToDuplicateRef = doc(db, "scenarios", scenarioId);
      const scenarioSnap = await getDoc(scenarioToDuplicateRef);

      if (scenarioSnap.exists()) {
        const originalScenarioData = scenarioSnap.data() as Omit<Scenario, 'id' | 'createdAt' | 'updatedAt'>;
        const duplicatedScenarioData: Omit<Scenario, 'id'> = {
          ...originalScenarioData,
          title: `Kopie von ${originalScenarioData.title || 'Unbenanntes Szenario'}`,
          status: 'draft', // Duplicates are drafts
          createdAt: serverTimestamp() as Timestamp,
          updatedAt: serverTimestamp() as Timestamp,
        };
        const newDocRef = await addDoc(collection(db, "scenarios"), duplicatedScenarioData);
        toast({
          title: "Szenario dupliziert",
          description: `Eine Kopie von "${originalScenarioData.title}" wurde als Entwurf erstellt.`,
        });
        router.push(`/admin/scenario-editor/${newDocRef.id}`);
      } else {
        toast({ variant: "destructive", title: "Fehler", description: "Originalszenario nicht gefunden." });
      }
    } catch (error) {
      console.error("Error duplicating scenario: ", error);
      toast({ variant: "destructive", title: "Fehler beim Duplizieren", description: "Szenario konnte nicht dupliziert werden." });
    } finally {
      setIsDuplicating(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center">
            <NotebookPen className="mr-3 h-8 w-8"/>Szenario Editor Hub
          </h1>
          <p className="text-muted-foreground mt-2">
            Verwalten Sie Szenarien und Vorlagen für Chat-Simulationen.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
           <Link href="/admin" passHref legacyBehavior>
            <Button variant="outline" className="w-full sm:w-auto">
                <ListChecks className="mr-2 h-5 w-5" /> Zur Szenarienauswahl
            </Button>
          </Link>
          <Button onClick={handleCreateNewScenario} className="w-full sm:w-auto" disabled={isCreatingNew}>
            {isCreatingNew ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <PlusCircle className="mr-2 h-5 w-5" />}
            Neues Szenario erstellen
          </Button>
        </div>
      </div>

      <Tabs defaultValue="scenarios" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="scenarios" onClick={() => router.push('/admin/scenario-editor')}>
            <ListChecks className="mr-2 h-4 w-4" />Szenarien ({filteredScenarios.length})
          </TabsTrigger>
          <TabsTrigger value="bot-templates" onClick={() => router.push('/admin/bot-template-editor')}>
            <Bot className="mr-2 h-4 w-4" />Bot-Vorlagen
          </TabsTrigger>
          <TabsTrigger value="role-templates" onClick={() => router.push('/admin/role-template-editor')}>
            <Users className="mr-2 h-4 w-4" />Rollen-Vorlagen
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="scenarios" className="mt-4">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle>Vorhandene Szenarien</CardTitle>
              <CardDescription>
                Durchsuchen, bearbeiten, duplizieren oder löschen Sie die verfügbaren Szenarien.
              </CardDescription>
              <div className="flex flex-col sm:flex-row gap-2 mt-4">
                <div className="relative flex-grow">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Szenarien durchsuchen (Titel, Beschreibung, Tags)..."
                    className="w-full pl-10 pr-4 py-2"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                    <Filter className="h-5 w-5 text-muted-foreground"/>
                    <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}>
                        <SelectTrigger className="w-full sm:w-[180px]">
                            <SelectValue placeholder="Status filtern" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Alle Status</SelectItem>
                            <SelectItem value="draft">Entwurf</SelectItem>
                            <SelectItem value="published">Veröffentlicht</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                  <p className="text-center text-muted-foreground">Lade Szenarien...</p>
                </div>
              ) : filteredScenarios.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[150px]"><ArrowUpDown className="inline-block mr-1 h-4 w-4 cursor-pointer hover:text-primary" />ID</TableHead>
                        <TableHead><ArrowUpDown className="inline-block mr-1 h-4 w-4 cursor-pointer hover:text-primary" />Titel</TableHead>
                        <TableHead>Kurzbeschreibung</TableHead>
                        <TableHead><ArrowUpDown className="inline-block mr-1 h-4 w-4 cursor-pointer hover:text-primary" />Status</TableHead>
                        <TableHead>Tags</TableHead>
                        <TableHead className="text-right w-[250px]">Aktionen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredScenarios.map((scenario: Scenario) => (
                        <TableRow key={scenario.id}>
                          <TableCell className="font-mono text-xs text-muted-foreground truncate" title={scenario.id}>{scenario.id.substring(0, 10)}...</TableCell>
                          <TableCell className="font-medium">
                            <Link href={`/admin/scenario-editor/${scenario.id}`} passHref legacyBehavior>
                              <a className="hover:text-primary hover:underline">{scenario.title}</a>
                            </Link>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs max-w-xs truncate">{scenario.kurzbeschreibung}</TableCell>
                          <TableCell>
                            <Badge variant={scenario.status === 'published' ? 'default' : 'secondary'} 
                                   className={scenario.status === 'published' ? 'bg-green-500 hover:bg-green-600' : 'bg-amber-500 hover:bg-amber-600'}>
                              {scenario.status === 'published' ? <ShieldCheck className="mr-1.5 h-3.5 w-3.5"/> : <FileEdit className="mr-1.5 h-3.5 w-3.5"/>}
                              {scenario.status === 'published' ? 'Veröffentlicht' : 'Entwurf'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {(scenario.tags || []).slice(0, 3).map((tag) => (
                                <Badge key={tag} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                              {(scenario.tags || []).length > 3 && <Badge variant="outline" className="text-xs">...</Badge>}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Link href={`/admin/session-dashboard/${scenario.id}`} passHref legacyBehavior>
                                <Button variant="default" size="sm" className="bg-primary hover:bg-primary/90" title="Dashboard/Simulation starten" disabled={scenario.status !== 'published'}>
                                  <PlayCircle className="h-4 w-4" /> 
                                </Button>
                              </Link>
                              <Link href={`/admin/scenario-editor/${scenario.id}`} passHref legacyBehavior>
                                <Button variant="outline" size="sm" title="Bearbeiten">
                                  <FileEdit className="h-4 w-4" />
                                </Button>
                              </Link>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => handleDuplicateScenario(scenario.id)}
                                disabled={isDuplicating === scenario.id || isDeleting === scenario.id}
                                title="Duplizieren"
                              >
                                {isDuplicating === scenario.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="destructive" size="sm" disabled={isDeleting === scenario.id || isDuplicating === scenario.id} title="Löschen">
                                    {isDeleting === scenario.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Szenario "{scenario.title}" wirklich löschen?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Diese Aktion kann nicht rückgängig gemacht werden. Das Szenario wird dauerhaft aus der Datenbank entfernt.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                    <AlertDialogAction 
                                      onClick={() => handleDeleteScenario(scenario.id, scenario.title)}
                                      className="bg-destructive hover:bg-destructive/90"
                                      disabled={isDeleting === scenario.id}
                                    >
                                    {isDeleting === scenario.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : "Ja, löschen"}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  {searchTerm === '' && statusFilter === 'all' ? "Keine Szenarien in der Datenbank gefunden. Erstellen Sie ein neues Szenario." : "Keine Szenarien gefunden, die Ihrer Suche/Filterung entsprechen." }
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
