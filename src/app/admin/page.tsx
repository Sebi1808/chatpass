import { ScenarioGrid } from '@/components/admin/scenario-grid';
import { scenarios } from '@/lib/scenarios';
import { Separator } from '@/components/ui/separator';

export default function AdminScenariosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary">Szenario auswählen</h1>
        <p className="text-muted-foreground mt-2">
          Wählen Sie ein Szenario aus, um eine neue Chat-Simulation zu starten oder zu konfigurieren.
        </p>
      </div>
      <Separator />
      <ScenarioGrid scenarios={scenarios} />
    </div>
  );
}
