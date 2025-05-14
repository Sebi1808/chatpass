import type { LucideIcon } from 'lucide-react';

export interface Scenario {
  id: string;
  title: string;
  kurzbeschreibung: string;
  langbeschreibung: string;
  defaultBots: number;
  standardRollen: number;
  icon: LucideIcon | ((props: React.ComponentProps<'svg'>) => JSX.Element); // Allow LucideIcon or custom SVG component
  tags: string[];
}
