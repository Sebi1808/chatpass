
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Users, PlusCircle, Loader2, FileEdit, Trash2, ArrowUpDown, Filter } from "lucide-react";
import Link from "next/link";
import React, { useState, useEffect, type FormEvent, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc, Timestamp } from "firebase/firestore";
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

  useEffect(() => {
    setIsLoadingTemplates(true);
    const templatesColRef = collection(db, "roleTemplates");
    const q = query(templatesColRef, orderBy("name", "asc"));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const fetchedTemplates: RoleTemplate[] = [];
      querySnapshot.forEach((docSnap) => {
        fetchedTemplates.push({ templateId: docSnap.id, ...docSnap.data() } as RoleTemplate);
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

  const filteredTemplates = useMemo(() => {
    return templates.filter(template => {
        if (!searchTerm.trim()) return true;
        const lowerSearchTerm = searchTerm.toLowerCase();
        return (
          template.name.toLowerCase().includes(lowerSearchTerm) ||
          template.description.toLowerCase().includes(lowerSearchTerm)
        );
      });
  }, [templates, searchTerm]);


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

    const templateData: Omit<RoleTemplate, 'templateId' | 'createdAt'> = {
      name: newTemplateName.trim(),
      description: newTemplateDescription.trim(),
    };

    try {
      if (editingTemplate) {
        // Update existing template
        const templateDocRef = doc(db, "roleTemplates", editingTemplate.templateId);
        await updateDoc(templateDocRef, { ...templateData, updatedAt: serverTimestamp() });
        toast({ title: "Rollen-Vorlage aktualisiert", description: `Vorlage "${templateData.name}" wurde gespeichert.` });
      } else {
        // Create new template
        await addDoc(collection(db, "roleTemplates"), {
          ...templateData,
          createdAt: serverTimestamp(),
        });
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
    window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll to form
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
              {isSavingTemplate ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
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
          ) : filteredTemplates.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-1/12"><ArrowUpDown className="inline-block mr-1 h-4 w-4 cursor-pointer hover:text-primary" />ID</TableHead>
                  <TableHead className="w-3/12"><ArrowUpDown className="inline-block mr-1 h-4 w-4 cursor-pointer hover:text-primary" />Name</TableHead>
                  <TableHead className="w-6/12">Beschreibung</TableHead>
                  <TableHead className="w-2/12 text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTemplates.map((template) => (
                  <TableRow key={template.templateId}>
                    <TableCell className="font-mono text-xs text-muted-foreground truncate max-w-[80px]">{template.templateId}</TableCell>
                    <TableCell className="font-medium">
                        <button onClick={() => handleEditTemplate(template)} className="hover:text-primary hover:underline text-left">
                            {template.name}
                        </button>
                    </TableCell>
                    <TableCell className="text-xs max-w-md truncate">{template.description}</TableCell>
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
