
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Bot } from "lucide-react";
import Link from "next/link";

export default function BotTemplateEditorPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center">
            <Bot className="mr-3 h-8 w-8" /> Bot-Vorlagen Editor
          </h1>
          <p className="text-muted-foreground mt-2">
            Erstellen, bearbeiten und verwalten Sie hier wiederverwendbare Bot-Vorlagen für Ihre Simulationen.
          </p>
        </div>
        <Link href="/admin/scenario-editor" passHref>
            <Button variant="outline">Zurück zum Editor Hub</Button>
        </Link>
      </div>
      <Separator />
      <Card>
        <CardHeader>
          <CardTitle>Funktionalität in Entwicklung</CardTitle>
          <CardDescription>
            Die Möglichkeit, Bot-Vorlagen direkt hier zu erstellen und zu verwalten, wird in einer zukünftigen Version implementiert.
            Aktuell werden Bot-Vorlagen aus der Datei `src/lib/bot-templates.ts` geladen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Zukünftige Features beinhalten:
          </p>
          <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
            <li>Erstellen neuer Bot-Vorlagen mit spezifischen Persönlichkeiten und Anweisungen.</li>
            <li>Bearbeiten bestehender Vorlagen.</li>
            <li>Speichern von Vorlagen in einer Datenbank.</li>
            <li>Import/Export von Vorlagen.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
