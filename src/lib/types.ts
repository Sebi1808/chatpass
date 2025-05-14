
import type { LucideIcon } from 'lucide-react';

export interface Scenario {
  id: string;
  title: string;
  kurzbeschreibung: string;
  langbeschreibung: string;
  defaultBots: number;
  standardRollen: number; // Gesamtzahl der Rollen inkl. Bots
  iconName: string; 
  tags: string[];
  // Optional: Spezifische Konfiguration für jeden Bot, falls benötigt
  defaultBotsConfig?: BotConfig[]; 
}

export interface BotConfig {
  personality: 'provokateur' | 'verteidiger' | 'informant' | 'standard';
  // Weitere bot-spezifische Einstellungen hier
}
