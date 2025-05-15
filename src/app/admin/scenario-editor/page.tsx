
"use client";

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { Scenario } from '@/lib/types';
import { FileEdit, PlusCircle, Search, Bot, Users, ListChecks, Settings2, NotebookPen } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

export default function ScenarioEditorHubPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    setIsLoading(true);
    const scenariosColRef = collection(db, "scenarios");
    const q = query(scenariosColRef, orderBy("title", "asc")); // Order by title for consistent listing

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const fetchedScenarios: Scenario[] = [];
      querySnapshot.forEach((doc) => {
        // Convert Firestore Timestamps to Dates or strings if necessary
        const data = doc.data() as Omit<Scenario, 'id'>; // Firestore data doesn't include id
        const scenario: Scenario = {
          id: doc.id,
          ...data,
          // Ensure any Timestamp fields are handled if they exist on Scenario directly
          // For example, if Scenario had createdAt: Timestamp | Date;
          // createdAt: (data.createdAt as Timestamp)?.toDate ? (data.createdAt as Timestamp).toDate() : data.createdAt,
        };
        fetchedScenarios.push(scenario);
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
    if (!searchTerm.trim()) {
      return scenarios;
    }
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    return scenarios.filter(
      (scenario) =>
        scenario.title.toLowerCase().includes(lowerCaseSearchTerm) ||
        (scenario.kurzbeschreibung && scenario.kurzbeschreibung.toLowerCase().includes(lowerCaseSearchTerm)) ||
        (scenario.tags && scenario.tags.some(tag => typeof tag === 'string' && tag.toLowerCase().includes(lowerCaseSearchTerm)))
    );
  }, [searchTerm, scenarios]);

  const handleCreateNewScenario = () => {
    router.push('/admin/scenario-editor/new');
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
        <Button onClick={handleCreateNewScenario} className="w-full sm:w-auto">
          <PlusCircle className="mr-2 h-5 w-5" />
          Neues Szenario erstellen
        </Button>
      </div>

      <Tabs defaultValue="scenarios" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="scenarios" onClick={() => router.push('/admin/scenario-editor')}>
            <ListChecks className="mr-2 h-4 w-4" />Szenarien
          </TabsTrigger>
          <TabsTrigger value="bot-templates" onClick={() => router.push('/admin/bot-template-editor')}>
            <Bot className="mr-2 h-4 w-4" />Bot-Vorlagen
          </TabsTrigger>
          <TabsTrigger value="role-templates" onClick={() => router.push('/admin/role-template-editor')}>
            <Users className="mr-2 h-4 w-4" />Rollen-Vorlagen
          </TabsTrigger>
        </TabsList>
        
        <Card className="mt-4">
            <CardHeader className="pb-4">
              <CardTitle>Vorhandene Szenarien</CardTitle>
              <CardDescription>
                Durchsuchen und bearbeiten Sie die aktuell verfügbaren Szenarien.
              </CardDescription>
              <div className="relative mt-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Szenarien durchsuchen (Titel, Beschreibung, Tags)..."
                  className="w-full pl-10 pr-4 py-2 text-base"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-center text-muted-foreground py-8">Lade Szenarien...</p>
              ) : filteredScenarios.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[250px]">Titel</TableHead>
                        <TableHead>Kurzbeschreibung</TableHead>
                        <TableHead className="w-[200px]">Tags</TableHead>
                        <TableHead className="w-[120px] text-right">Aktionen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredScenarios.map((scenario: Scenario) => (
                        <TableRow key={scenario.id}>
                          <TableCell className="font-medium">{scenario.title}</TableCell>
                          <TableCell className="text-muted-foreground">{scenario.kurzbeschreibung}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {scenario.tags && scenario.tags.slice(0, 3).map((tag) => (
                                <Badge key={tag} variant="secondary" className="text-xs">
                                  {typeof tag === 'string' ? tag : 'Invalid Tag'}
                                </Badge>
                              ))}
                              {scenario.tags && scenario.tags.length > 3 && <Badge variant="outline" className="text-xs">...</Badge>}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Link href={`/admin/scenario-editor/${scenario.id}`} passHref legacyBehavior>
                              <Button variant="outline" size="sm">
                                <FileEdit className="mr-2 h-4 w-4" />
                                Bearbeiten
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  {searchTerm === '' ? "Keine Szenarien in der Datenbank gefunden. Erstellen Sie ein neues Szenario." : "Keine Szenarien gefunden, die Ihrer Suche entsprechen." }
                </p>
              )}
            </CardContent>
          </Card>
      </Tabs>
    </div>
  );
}
