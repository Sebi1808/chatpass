
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Users } from "lucide-react";
import Link from "next/link";

export default function RoleTemplateEditorPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center">
            <Users className="mr-3 h-8 w-8" /> Rollen-Vorlagen Editor
          </h1>
          <p className="text-muted-foreground mt-2">
            Erstellen, bearbeiten und verwalten Sie hier wiederverwendbare Rollen-Vorlagen für menschliche Teilnehmer.
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
            Die Möglichkeit, Rollen-Vorlagen direkt hier zu erstellen und zu verwalten, wird in einer zukünftigen Version implementiert.
            Aktuell werden Rollen-Vorlagen aus der Datei `src/lib/role-templates.ts` geladen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Zukünftige Features beinhalten:
          </p>
          <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
            <li>Erstellen neuer Rollen-Vorlagen mit spezifischen Beschreibungen, Zielen und Informationen.</li>
            <li>Bearbeiten bestehender Vorlagen.</li>
            <li>Speichern von Vorlagen in einer Datenbank.</li>
            <li>Kategorisierung von Rollen.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
