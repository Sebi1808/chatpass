
import type { LucideIcon } from 'lucide-react';
import type { Timestamp } from 'firebase/firestore';

export interface Scenario {
  id: string;
  title: string;
  kurzbeschreibung: string;
  langbeschreibung: string;
  defaultBots: number;
  standardRollen: number; // Gesamtzahl der Rollen inkl. Bots
  iconName: string; 
  tags: string[];
  defaultBotsConfig?: BotConfig[]; 
}

export interface BotConfig {
  personality: 'provokateur' | 'verteidiger' | 'informant' | 'standard';
  // Weitere bot-spezifische Einstellungen hier
  name?: string; // Name, der im Chat angezeigt wird
  avatarFallback?: string; // Für Avatar-Anzeige
}

export interface Participant {
  id: string; // Firestore document ID
  userId: string; // Eindeutige ID des Benutzers (kann client-generiert sein)
  name: string;
  role: string; // z.B. "Teilnehmer A", "Bot Provokateur"
  avatarFallback: string;
  isBot: boolean;
  joinedAt?: Timestamp | Date; // Firestore Timestamp oder JS Date
  status?: "Aktiv" | "Inaktiv" | "Beigetreten" | "Nicht beigetreten"; // Für Admin-Dashboard Anzeige
  isMuted?: boolean; // Für Admin-Dashboard Steuerung
  escalation?: number; // Für Bot-Steuerung
}

export interface Message {
  id: string; // Firestore document ID
  senderUserId: string; // ID des Senders (kann userId von Participant oder eine Bot-ID sein)
  senderName: string;
  senderType: 'admin' | 'user' | 'bot';
  avatarFallback: string;
  content: string;
  timestamp: Timestamp | Date; // Firestore Timestamp oder JS Date
  replyTo?: string; // ID der Nachricht, auf die geantwortet wird
  botFlag?: boolean; // Spezielles Flag für Bot-Nachrichten
}
