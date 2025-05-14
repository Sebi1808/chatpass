"use client";

import type { Scenario } from '@/lib/types';
import { ScenarioCard } from './scenario-card';
import { useRouter } from 'next/navigation';
import { useToast } from "@/hooks/use-toast";

interface ScenarioGridProps {
  scenarios: Scenario[];
}

export function ScenarioGrid({ scenarios }: ScenarioGridProps) {
  const router = useRouter();
  const { toast } = useToast();

  const handleStartSimulation = (scenarioId: string) => {
    const selectedScenario = scenarios.find(s => s.id === scenarioId);
    // Placeholder action: In a real app, this would navigate to a session setup or dashboard.
    // For now, it will show a toast and log to console.
    // router.push(`/admin/session-config/${scenarioId}`);
    
    toast({
        title: "Simulation wird vorbereitet...",
        description: `Szenario "${selectedScenario?.title}" ausgewählt. Konfiguration demnächst verfügbar.`,
    });
    console.log(`Starte Simulation für Szenario ID: ${scenarioId}, Titel: ${selectedScenario?.title}`);
    // Example redirect to a placeholder session dashboard
    // router.push(`/admin/session-dashboard/${scenarioId}`);
  };

  if (!scenarios || scenarios.length === 0) {
    return <p className="text-muted-foreground">Keine Szenarien verfügbar.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {scenarios.map((scenario) => (
        <ScenarioCard key={scenario.id} scenario={scenario} onStartSimulation={handleStartSimulation} />
      ))}
    </div>
  );
}
