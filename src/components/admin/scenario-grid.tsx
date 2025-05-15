
"use client";

import type { Scenario } from '@/lib/types';
import { ScenarioCard } from './scenario-card';

interface ScenarioGridProps {
  scenarios: Scenario[];
}

export function ScenarioGrid({ scenarios }: ScenarioGridProps) {
  if (!scenarios || scenarios.length === 0) {
    // This case should ideally be handled by the parent component (AdminScenariosPage)
    // but adding a fallback here just in case.
    return <p className="text-muted-foreground">Keine Szenarien zum Anzeigen vorhanden.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {scenarios.map((scenario) => (
        <ScenarioCard key={scenario.id} scenario={scenario} />
      ))}
    </div>
  );
}
