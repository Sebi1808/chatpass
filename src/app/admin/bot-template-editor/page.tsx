
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bot, PlusCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import React, { useState, useEffect, type FormEvent } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, onSnapshot, query, orderBy } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import type { BotTemplate } from "@/lib/types"; // Using specific BotTemplate type
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function BotTemplateEditorPage() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<BotTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  // Form state for new template
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplatePersonality, setNewTemplatePersonality] = useState<'provokateur' | 'verteidiger' | 'informant' | 'standard'>('standard');
  const [newTemplateAvatarFallback, setNewTemplateAvatarFallback] = useState("");
  const [newTemplateInitialMission, setNewTemplateInitialMission] = useState("");

  useEffect(() => {
    setIsLoadingTemplates(true);
    const templatesColRef = collection(db, "botTemplates");
    const q = query(templatesColRef, orderBy("name", "asc"));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const fetchedTemplates: BotTemplate[] = [];
      querySnapshot.forEach((doc) => {
        // The document ID is the templateId
        fetchedTemplates.push({ templateId: doc.id, ...doc.data() } as BotTemplate);
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

  const handleCreateNewTemplate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newTemplateName.trim() || !newTemplatePersonality) {
      toast({ variant: "destructive", title: "Fehlende Eingabe", description: "Name und Persönlichkeit sind erforderlich." });
      return;
    }
    setIsSavingTemplate(true);

    const newTemplateData: Omit<BotTemplate, 'templateId'> = {
      name: newTemplateName.trim(),
      personality: newTemplatePersonality,
      avatarFallback: newTemplateAvatarFallback.trim().substring(0, 2) || newTemplateName.substring(0,2).toUpperCase() || "BT",
      initialMission: newTemplateInitialMission.trim(),
      // Note: We don't set a templateId here, Firestore will generate one or we can use a custom ID strategy if needed.
      // For simplicity, we'll let Firestore generate the document ID which we'll then use as templateId.
    };

    try {
      const docRef = await addDoc(collection(db, "botTemplates"), {
        ...newTemplateData,
        createdAt: serverTimestamp(), // Optional: for tracking when template was created
      });
      toast({ title: "Bot-Vorlage erstellt", description: `Vorlage "${newTemplateName}" wurde gespeichert.` });
      // Reset form
      setNewTemplateName("");
      setNewTemplatePersonality("standard");
      setNewTemplateAvatarFallback("");
      setNewTemplateInitialMission("");
    } catch (error) {
      console.error("Error creating bot template: ", error);
      toast({ variant: "destructive", title: "Speicherfehler", description: "Bot-Vorlage konnte nicht erstellt werden." });
    } finally {
      setIsSavingTemplate(false);
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
          <CardTitle>Neue Bot-Vorlage erstellen</CardTitle>
        </CardHeader>
        <form onSubmit={handleCreateNewTemplate}>
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
          <CardTitle>Vorhandene Bot-Vorlagen</CardTitle>
          <CardDescription>
            Übersicht der in der Datenbank gespeicherten Bot-Vorlagen.
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
                  <TableHead>Persönlichkeit</TableHead>
                  <TableHead>Initiale Mission</TableHead>
                  <TableHead>Template ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.templateId}>
                    <TableCell className="font-medium">{template.name}</TableCell>
                    <TableCell>{template.personality}</TableCell>
                    <TableCell className="text-xs max-w-sm truncate">{template.initialMission || "-"}</TableCell>
                    <TableCell className="text-xs font-mono">{template.templateId}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-center py-6">Keine Bot-Vorlagen in der Datenbank gefunden.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
