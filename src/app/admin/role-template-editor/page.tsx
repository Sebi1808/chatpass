
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Users, PlusCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import React, { useState, useEffect, type FormEvent } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, onSnapshot, query, orderBy } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import type { RoleTemplate } from "@/lib/types"; // Using specific RoleTemplate type
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";


export default function RoleTemplateEditorPage() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<RoleTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  // Form state for new template
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateDescription, setNewTemplateDescription] = useState("");

  useEffect(() => {
    setIsLoadingTemplates(true);
    const templatesColRef = collection(db, "roleTemplates");
    const q = query(templatesColRef, orderBy("name", "asc"));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const fetchedTemplates: RoleTemplate[] = [];
      querySnapshot.forEach((doc) => {
        fetchedTemplates.push({ templateId: doc.id, ...doc.data() } as RoleTemplate);
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

  const handleCreateNewTemplate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newTemplateName.trim() || !newTemplateDescription.trim()) {
      toast({ variant: "destructive", title: "Fehlende Eingabe", description: "Name und Beschreibung sind erforderlich." });
      return;
    }
    setIsSavingTemplate(true);

    const newTemplateData: Omit<RoleTemplate, 'templateId'> = {
      name: newTemplateName.trim(),
      description: newTemplateDescription.trim(),
    };

    try {
      const docRef = await addDoc(collection(db, "roleTemplates"), {
        ...newTemplateData,
        createdAt: serverTimestamp(),
      });
      toast({ title: "Rollen-Vorlage erstellt", description: `Vorlage "${newTemplateName}" wurde gespeichert.` });
      // Reset form
      setNewTemplateName("");
      setNewTemplateDescription("");
    } catch (error) {
      console.error("Error creating role template: ", error);
      toast({ variant: "destructive", title: "Speicherfehler", description: "Rollen-Vorlage konnte nicht erstellt werden." });
    } finally {
      setIsSavingTemplate(false);
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
          <CardTitle>Neue Rollen-Vorlage erstellen</CardTitle>
        </CardHeader>
        <form onSubmit={handleCreateNewTemplate}>
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
          <CardFooter>
            <Button type="submit" disabled={isSavingTemplate}>
              {isSavingTemplate ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
              Vorlage erstellen
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vorhandene Rollen-Vorlagen</CardTitle>
          <CardDescription>
            Übersicht der in der Datenbank gespeicherten Rollen-Vorlagen.
            (Bearbeiten und Löschen wird später implementiert)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingTemplates ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
              <p className="text-muted-foreground">Lade Vorlagen...</p>
            </div>
          ) : templates.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Beschreibung</TableHead>
                  <TableHead>Template ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.templateId}>
                    <TableCell className="font-medium">{template.name}</TableCell>
                    <TableCell className="text-xs max-w-md truncate">{template.description}</TableCell>
                    <TableCell className="text-xs font-mono">{template.templateId}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-center py-6">Keine Rollen-Vorlagen in der Datenbank gefunden.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
