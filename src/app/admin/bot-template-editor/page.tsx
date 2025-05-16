
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bot, PlusCircle, Loader2, FileEdit, Trash2, ArrowUpDown, Filter, Search, ArrowUp, ArrowDown } from "lucide-react";
import Link from "next/link";
import React, { useState, useEffect, type FormEvent, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, onSnapshot, query, orderBy as firestoreOrderBy, doc, updateDoc, deleteDoc, Timestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import type { BotTemplate } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

type SortableBotTemplateKeys = keyof Pick<BotTemplate, 'templateId' | 'name' | 'personality'> | 'createdAt';

export default function BotTemplateEditorPage() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<BotTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const [editingTemplate, setEditingTemplate] = useState<BotTemplate | null>(null);

  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplatePersonality, setNewTemplatePersonality] = useState<'provokateur' | 'verteidiger' | 'informant' | 'standard'>('standard');
  const [newTemplateAvatarFallback, setNewTemplateAvatarFallback] = useState("");
  const [newTemplateInitialMission, setNewTemplateInitialMission] = useState("");

  const [searchTerm, setSearchTerm] = useState('');
  const [personalityFilter, setPersonalityFilter] = useState<'all' | BotTemplate['personality']>('all');
  const [sortConfig, setSortConfig] = useState<{ key: SortableBotTemplateKeys; direction: 'asc' | 'desc' } | null>({ key: 'name', direction: 'asc' });


  useEffect(() => {
    setIsLoadingTemplates(true);
    const templatesColRef = collection(db, "botTemplates");
    // Default Firestore query, client-side sorting will handle dynamic order
    const q = query(templatesColRef, firestoreOrderBy("name", "asc"));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const fetchedTemplates: BotTemplate[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        let createdAt: Timestamp | undefined = undefined;
        if (data.createdAt instanceof Timestamp) {
            createdAt = data.createdAt;
        } else if (data.createdAt && typeof (data.createdAt as any).seconds === 'number') {
            createdAt = new Timestamp((data.createdAt as any).seconds, (data.createdAt as any).nanoseconds);
        }

        fetchedTemplates.push({
          templateId: docSnap.id,
          name: data.name || "Unbenannte Vorlage",
          personality: data.personality || "standard",
          avatarFallback: data.avatarFallback || "",
          initialMission: data.initialMission || "",
          createdAt: createdAt,
        } as BotTemplate);
      });
      setTemplates(fetchedTemplates);
      setIsLoadingTemplates(false);
    }, (error) => {
      console.error("Error fetching bot templates: ", error);
      toast({ variant: "destructive", title: "Fehler", description: "Bot-Vorlagen konnten nicht geladen werden." });
      setIsLoadingTemplates(false);
    });

    return () => unsubscribe();
  }, [toast]);

  const requestSort = (key: SortableBotTemplateKeys) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedTemplates = useMemo(() => {
    let sortableItems = [...templates];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];
        let comparison = 0;

        if (valA instanceof Timestamp && valB instanceof Timestamp) {
          comparison = valA.toMillis() - valB.toMillis();
        } else if (typeof valA === 'string' && typeof valB === 'string') {
          comparison = valA.toLowerCase().localeCompare(valB.toLowerCase());
        } else if (typeof valA === 'number' && typeof valB === 'number') {
          comparison = valA - valB;
        } else {
          // Fallback for mixed types or other unhandled types
          if (valA > valB) comparison = 1;
          else if (valA < valB) comparison = -1;
        }
        return sortConfig.direction === 'asc' ? comparison : comparison * -1;
      });
    }
    return sortableItems
      .filter(template => {
        if (personalityFilter === 'all') return true;
        return template.personality === personalityFilter;
      })
      .filter(template => {
        if (!searchTerm.trim()) return true;
        const lowerSearchTerm = searchTerm.toLowerCase();
        return (
          template.name.toLowerCase().includes(lowerSearchTerm) ||
          (template.initialMission && template.initialMission.toLowerCase().includes(lowerSearchTerm))
        );
      });
  }, [templates, searchTerm, personalityFilter, sortConfig]);

  const getSortIcon = (key: SortableBotTemplateKeys) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ArrowUpDown className="inline-block ml-1 h-3 w-3 text-muted-foreground/70" />;
    }
    return sortConfig.direction === 'asc' ? <ArrowUp className="inline-block ml-1 h-3 w-3 text-primary" /> : <ArrowDown className="inline-block ml-1 h-3 w-3 text-primary" />;
  };


  const resetForm = () => {
    setNewTemplateName("");
    setNewTemplatePersonality("standard");
    setNewTemplateAvatarFallback("");
    setNewTemplateInitialMission("");
    setEditingTemplate(null);
  };

  const handleFormSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newTemplateName.trim() || !newTemplatePersonality) {
      toast({ variant: "destructive", title: "Fehlende Eingabe", description: "Name und Persönlichkeit sind erforderlich." });
      return;
    }
    setIsSavingTemplate(true);

    const templateData: Omit<BotTemplate, 'templateId' | 'createdAt' | 'updatedAt'> = {
      name: newTemplateName.trim(),
      personality: newTemplatePersonality,
      avatarFallback: newTemplateAvatarFallback.trim().substring(0, 2) || newTemplateName.substring(0,2).toUpperCase() || "BT",
      initialMission: newTemplateInitialMission.trim(),
    };

    try {
      if (editingTemplate) {
        const templateDocRef = doc(db, "botTemplates", editingTemplate.templateId);
        await updateDoc(templateDocRef, { ...templateData, updatedAt: serverTimestamp() });
        toast({ title: "Bot-Vorlage aktualisiert", description: `Vorlage "${templateData.name}" wurde gespeichert.` });
      } else {
        const newDocData: Omit<BotTemplate, 'templateId'> & { createdAt: Timestamp } = {
          ...templateData,
          createdAt: serverTimestamp() as Timestamp,
        }
        await addDoc(collection(db, "botTemplates"), newDocData );
        toast({ title: "Bot-Vorlage erstellt", description: `Vorlage "${templateData.name}" wurde gespeichert.` });
      }
      resetForm();
    } catch (error) {
      console.error("Error saving bot template: ", error);
      toast({ variant: "destructive", title: "Speicherfehler", description: "Bot-Vorlage konnte nicht gespeichert werden." });
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleEditTemplate = (template: BotTemplate) => {
    setEditingTemplate(template);
    setNewTemplateName(template.name);
    setNewTemplatePersonality(template.personality);
    setNewTemplateAvatarFallback(template.avatarFallback || "");
    setNewTemplateInitialMission(template.initialMission || "");
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteTemplate = async (templateId: string, templateName: string) => {
    setIsDeleting(templateId);
    try {
      await deleteDoc(doc(db, "botTemplates", templateId));
      toast({ title: "Bot-Vorlage gelöscht", description: `Vorlage "${templateName}" wurde entfernt.` });
      if (editingTemplate?.templateId === templateId) {
        resetForm();
      }
    } catch (error) {
      console.error("Error deleting bot template: ", error);
      toast({ variant: "destructive", title: "Fehler beim Löschen", description: "Bot-Vorlage konnte nicht gelöscht werden." });
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center">
            <Bot className="mr-3 h-8 w-8" /> Bot-Vorlagen Editor
          </h1>
          <p className="text-muted-foreground mt-2">
            Erstellen und verwalten Sie hier wiederverwendbare Bot-Vorlagen.
          </p>
        </div>
        <Link href="/admin/scenario-editor" passHref>
            <Button variant="outline">Zurück zum Editor Hub</Button>
        </Link>
      </div>
      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>{editingTemplate ? "Bot-Vorlage bearbeiten" : "Neue Bot-Vorlage erstellen"}</CardTitle>
        </CardHeader>
        <form onSubmit={handleFormSubmit}>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="newTemplateName">Vorlagenname</Label>
                <Input id="newTemplateName" value={newTemplateName} onChange={(e) => setNewTemplateName(e.target.value)} placeholder="z.B. Standard Provokateur" required disabled={isSavingTemplate} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="newTemplatePersonality">Persönlichkeit</Label>
                <Select value={newTemplatePersonality} onValueChange={(value) => setNewTemplatePersonality(value as any)} disabled={isSavingTemplate}>
                  <SelectTrigger id="newTemplatePersonality">
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
            </div>
            <div className="space-y-1.5">
                <Label htmlFor="newTemplateAvatarFallback">Avatar Kürzel (max. 2 Zeichen)</Label>
                <Input id="newTemplateAvatarFallback" value={newTemplateAvatarFallback} onChange={(e) => setNewTemplateAvatarFallback(e.target.value.substring(0,2))} placeholder="BK" maxLength={2} disabled={isSavingTemplate}/>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="newTemplateInitialMission">Initiale Mission/Anweisung</Label>
              <Textarea id="newTemplateInitialMission" value={newTemplateInitialMission} onChange={(e) => setNewTemplateInitialMission(e.target.value)} placeholder="Was soll der Bot standardmäßig tun?" rows={3} disabled={isSavingTemplate} />
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button type="submit" disabled={isSavingTemplate}>
              {isSavingTemplate ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (editingTemplate ? <FileEdit className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />)}
              {editingTemplate ? "Vorlage aktualisieren" : "Vorlage erstellen"}
            </Button>
            {editingTemplate && (
              <Button type="button" variant="outline" onClick={resetForm} disabled={isSavingTemplate}>
                Abbrechen
              </Button>
            )}
          </CardFooter>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vorhandene Bot-Vorlagen</CardTitle>
          <CardDescription>
            Übersicht der in der Datenbank gespeicherten Bot-Vorlagen.
          </CardDescription>
           <div className="flex flex-col sm:flex-row gap-2 mt-4">
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Vorlagen durchsuchen (Name, Mission)..."
                className="w-full pl-10 pr-4 py-2"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-muted-foreground"/>
                <Select value={personalityFilter} onValueChange={(value) => setPersonalityFilter(value as any)}>
                    <SelectTrigger className="w-full sm:w-[200px]">
                        <SelectValue placeholder="Persönlichkeit filtern" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Alle Persönlichkeiten</SelectItem>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="provokateur">Provokateur</SelectItem>
                        <SelectItem value="verteidiger">Verteidiger</SelectItem>
                        <SelectItem value="informant">Informant</SelectItem>
                    </SelectContent>
                </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingTemplates ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
              <p className="text-muted-foreground">Lade Vorlagen...</p>
            </div>
          ) : sortedTemplates.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[150px] cursor-pointer hover:text-primary" onClick={() => requestSort('templateId')}>ID {getSortIcon('templateId')}</TableHead>
                    <TableHead className="cursor-pointer hover:text-primary" onClick={() => requestSort('name')}>Name {getSortIcon('name')}</TableHead>
                    <TableHead className="cursor-pointer hover:text-primary" onClick={() => requestSort('personality')}>Persönlichkeit {getSortIcon('personality')}</TableHead>
                    <TableHead>Initiale Mission</TableHead>
                    <TableHead className="text-right w-[120px]">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedTemplates.map((template) => (
                    <TableRow key={template.templateId}>
                      <TableCell className="font-mono text-xs text-muted-foreground truncate" title={template.templateId}>{template.templateId.substring(0, 10)}...</TableCell>
                      <TableCell className="font-medium">
                          <button onClick={() => handleEditTemplate(template)} className="hover:text-primary hover:underline text-left">
                              {template.name}
                          </button>
                      </TableCell>
                      <TableCell>{template.personality}</TableCell>
                      <TableCell className="text-xs max-w-sm truncate" title={template.initialMission || "-"}>{template.initialMission || "-"}</TableCell>
                      <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                              <Button variant="outline" size="sm" onClick={() => handleEditTemplate(template)} title="Bearbeiten">
                                  <FileEdit className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                      <Button variant="destructive" size="sm" disabled={isDeleting === template.templateId} title="Löschen">
                                          {isDeleting === template.templateId ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4" />}
                                      </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                  <AlertDialogHeader>
                                      <AlertDialogTitle>Vorlage "{template.name}" wirklich löschen?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                      Diese Aktion kann nicht rückgängig gemacht werden. Die Vorlage wird dauerhaft entfernt.
                                      </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                      <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                      <AlertDialogAction
                                          onClick={() => handleDeleteTemplate(template.templateId, template.name)}
                                          className="bg-destructive hover:bg-destructive/90"
                                          disabled={isDeleting === template.templateId}
                                      >
                                      {isDeleting === template.templateId ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : "Ja, löschen"}
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
            <p className="text-muted-foreground text-center py-6">
              {searchTerm === '' && personalityFilter === 'all' ? "Keine Bot-Vorlagen in der Datenbank gefunden." : "Keine Bot-Vorlagen für Ihre Suche/Filterung gefunden."}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
