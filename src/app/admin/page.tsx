
"use client";

import { useState, useEffect } from 'react';
import { ScenarioGrid } from '@/components/admin/scenario-grid';
import { Separator } from '@/components/ui/separator';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import type { Scenario } from '@/lib/types';
import { Loader2 } from 'lucide-react';

export default function AdminScenariosPage() {
  const [publishedScenarios, setPublishedScenarios] = useState<Scenario[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    const scenariosColRef = collection(db, "scenarios");
    // Query for published scenarios, ordered by title
    const q = query(scenariosColRef, where("status", "==", "published"), orderBy("title", "asc"));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const fetchedScenarios: Scenario[] = [];
      querySnapshot.forEach((doc) => {
        fetchedScenarios.push({ id: doc.id, ...doc.data() } as Scenario);
      });
      setPublishedScenarios(fetchedScenarios);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching published scenarios: ", error);
      // It's good practice to provide user feedback here, e.g., using a toast
      setIsLoading(false);
    });

    return () => unsubscribe(); // Cleanup listener on component unmount
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary">Szenario auswählen</h1>
        <p className="text-muted-foreground mt-2">
          Wählen Sie ein veröffentlichtes Szenario aus, um eine neue Chat-Simulation zu starten oder zu konfigurieren.
        </p>
      </div>
      <Separator />
      {isLoading ? (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-3 text-muted-foreground">Lade veröffentlichte Szenarien...</p>
        </div>
      ) : publishedScenarios.length > 0 ? (
        <ScenarioGrid scenarios={publishedScenarios} />
      ) : (
        <p className="text-muted-foreground py-10 text-center">
          Aktuell sind keine Szenarien veröffentlicht. Sie können Szenarien im Editor erstellen und veröffentlichen.
        </p>
      )}
    </div>
  );
}
