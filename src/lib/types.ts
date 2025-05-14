import type { LucideIcon } from 'lucide-react';

export interface Scenario {
  id: string;
  title: string;
  kurzbeschreibung: string;
  langbeschreibung: string;
  defaultBots: number;
  standardRollen: number;
  iconName: string; // Changed from 'icon' to 'iconName' and type to string
  tags: string[];
}
