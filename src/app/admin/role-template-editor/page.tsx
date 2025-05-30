
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Users, PlusCircle, Loader2, FileEdit, Trash2, ArrowUpDown, Search, ArrowUp, ArrowDown } from "lucide-react";
import Link from "next/link";
import React, { useState, useEffect, type FormEvent, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, onSnapshot, query, orderBy as firestoreOrderBy, doc, updateDoc, deleteDoc, Timestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import type { RoleTemplate } from "@/lib/types";
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

type SortableRoleTemplateKeys = keyof Pick<RoleTemplate, 'templateId' | 'name'> | 'createdAt';

export default function RoleTemplateEditorPage() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<RoleTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const [editingTemplate, setEditingTemplate] = useState<RoleTemplate | null>(null);

  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateDescription, setNewTemplateDescription] = useState("");

  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortableRoleTemplateKeys; direction: 'asc' | 'desc' } | null>({ key: 'name', direction: 'asc' });


  useEffect(() => {
    setIsLoadingTemplates(true);
    const templatesColRef = collection(db, "roleTemplates");
    const q = query(templatesColRef, firestoreOrderBy("name", "asc"));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const fetchedTemplates: RoleTemplate[] = [];
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
          description: data.description || "",
          createdAt: createdAt,
        } as RoleTemplate);
      });
      setTemplates(fetchedTemplates);
      setIsLoadingTemplates(false);
    }, (error) => {
      console.error("Error fetching role templates: ", error);
      toast({ variant: "destructive", title: "Fehler", description: "Rollen-Vorlagen konnten nicht geladen werden." });
      setIsLoadingTemplates(false);
    });

    return () => unsubscribe();
  }, [toast]);

  const requestSort = (key: SortableRoleTemplateKeys) => {
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
          if (valA > valB) comparison = 1;
          else if (valA < valB) comparison = -1;
        }
        return sortConfig.direction === 'asc' ? comparison : comparison * -1;
      });
    }
    return sortableItems.filter(template => {
        if (!searchTerm.trim()) return true;
        const lowerSearchTerm = searchTerm.toLowerCase();
        return (
          template.name.toLowerCase().includes(lowerSearchTerm) ||
          template.description.toLowerCase().includes(lowerSearchTerm)
        );
      });
  }, [templates, searchTerm, sortConfig]);

  const getSortIcon = (key: SortableRoleTemplateKeys) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ArrowUpDown className="inline-block ml-1 h-3 w-3 text-muted-foreground/70" />;
    }
    return sortConfig.direction === 'asc' ? <ArrowUp className="inline-block ml-1 h-3 w-3 text-primary" /> : <ArrowDown className="inline-block ml-1 h-3 w-3 text-primary" />;
  };


  const resetForm = () => {
    setNewTemplateName("");
    setNewTemplateDescription("");
    setEditingTemplate(null);
  };

  const handleFormSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newTemplateName.trim() || !newTemplateDescription.trim()) {
      toast({ variant: "destructive", title: "Fehlende Eingabe", description: "Name und Beschreibung sind erforderlich." });
      return;
    }
    setIsSavingTemplate(true);

    const templateData: Omit<RoleTemplate, 'templateId' | 'createdAt'| 'updatedAt'> = {
      name: newTemplateName.trim(),
      description: newTemplateDescription.trim(),
    };

    try {
      if (editingTemplate) {
        const templateDocRef = doc(db, "roleTemplates", editingTemplate.templateId);
        await updateDoc(templateDocRef, { ...templateData, updatedAt: serverTimestamp() });
        toast({ title: "Rollen-Vorlage aktualisiert", description: `Vorlage "${templateData.name}" wurde gespeichert.` });
      } else {
        const newDocData: Omit<RoleTemplate, 'templateId'> & { createdAt: Timestamp } = {
            ...templateData,
            createdAt: serverTimestamp() as Timestamp,
        }
        await addDoc(collection(db, "roleTemplates"), newDocData);
        toast({ title: "Rollen-Vorlage erstellt", description: `Vorlage "${templateData.name}" wurde gespeichert.` });
      }
      resetForm();
    } catch (error) {
      console.error("Error saving role template: ", error);
      toast({ variant: "destructive", title: "Speicherfehler", description: "Rollen-Vorlage konnte nicht gespeichert werden." });
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleEditTemplate = (template: RoleTemplate) => {
    setEditingTemplate(template);
    setNewTemplateName(template.name);
    setNewTemplateDescription(template.description);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteTemplate = async (templateId: string, templateName: string) => {
    setIsDeleting(templateId);
    try {
      await deleteDoc(doc(db, "roleTemplates", templateId));
      toast({ title: "Rollen-Vorlage gelöscht", description: `Vorlage "${templateName}" wurde entfernt.` });
      if (editingTemplate?.templateId === templateId) {
        resetForm();
      }
    } catch (error) {
      console.error("Error deleting role template: ", error);
      toast({ variant: "destructive", title: "Fehler beim Löschen", description: "Rollen-Vorlage konnte nicht gelöscht werden." });
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center">
            <Users className="mr-3 h-8 w-8" /> Rollen-Vorlagen Editor
          </h1>
          <p className="text-muted-foreground mt-2">
            Erstellen und verwalten Sie hier wiederverwendbare Rollen-Vorlagen für menschliche Teilnehmer.
          </p>
        </div>
         <Link href="/admin/scenario-editor" passHref>
            <Button variant="outline">Zurück zum Editor Hub</Button>
        </Link>
      </div>
      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>{editingTemplate ? "Rollen-Vorlage bearbeiten" : "Neue Rollen-Vorlage erstellen"}</CardTitle>
        </CardHeader>
        <form onSubmit={handleFormSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="newTemplateName">Vorlagenname</Label>
              <Input id="newTemplateName" value={newTemplateName} onChange={(e) => setNewTemplateName(e.target.value)} placeholder="z.B. Standard Opferrolle" required disabled={isSavingTemplate} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="newTemplateDescription">Rollenbeschreibung (Ziele, Infos etc.)</Label>
              <Textarea id="newTemplateDescription" value={newTemplateDescription} onChange={(e) => setNewTemplateDescription(e.target.value)} placeholder="Detaillierte Beschreibung der Standardrolle..." rows={5} required disabled={isSavingTemplate} />
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button type="submit" disabled={isSavingTemplate}>
              {isSavingTemplate ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (editingTemplate ? <FileEdit className="mr-2 h-4 w-4" /> :<PlusCircle className="mr-2 h-4 w-4" />)}
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
          <CardTitle>Vorhandene Rollen-Vorlagen</CardTitle>
          <CardDescription>
            Übersicht der in der Datenbank gespeicherten Rollen-Vorlagen.
          </CardDescription>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
                type="search"
                placeholder="Vorlagen durchsuchen (Name, Beschreibung)..."
                className="w-full pl-10 pr-4 py-2"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
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
                    <TableHead>Beschreibung</TableHead>
                    <TableHead className="text-right w-[120px]">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedTemplates.map((template) => (
                    <TableRow key={template.templateId}>
                      <TableCell className="font-mono text-xs text-muted-foreground truncate" title={template.templateId}>{template.templateId.substring(0,10)}...</TableCell>
                      <TableCell className="font-medium">
                          <button onClick={() => handleEditTemplate(template)} className="hover:text-primary hover:underline text-left">
                              {template.name}
                          </button>
                      </TableCell>
                      <TableCell className="text-xs max-w-md truncate" title={template.description}>{template.description}</TableCell>
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
              {searchTerm === '' ? "Keine Rollen-Vorlagen in der Datenbank gefunden." : "Keine Rollen-Vorlagen für Ihre Suche gefunden."}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
