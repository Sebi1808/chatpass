
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
  name?: string; 
  avatarFallback?: string; 
  currentEscalation?: number;
  isActive?: boolean; 
  autoTimerEnabled?: boolean;
  id?: string; // Eindeutige ID für den Bot innerhalb des Szenarios
  currentMission?: string; // Für die Missionseingabe
}

export interface SessionData {
  scenarioId: string;
  createdAt: Timestamp | Date;
  invitationLink: string; 
  invitationToken?: string; 
  status: "active" | "paused" | "ended"; 
  messageCooldownSeconds: number; 
}

export interface Participant {
  id: string; 
  userId: string; 
  name: string;
  role: string; 
  avatarFallback: string;
  isBot: boolean;
  joinedAt?: Timestamp | Date; 
  status?: "Aktiv" | "Inaktiv" | "Beigetreten" | "Nicht beigetreten"; 
  isMuted?: boolean; 
  botConfig?: BotConfig; // Wird für Bot-Teilnehmer verwendet
  botScenarioId?: string; // ID der Bot-Konfiguration aus dem Szenario
}

export interface DisplayParticipant extends Participant {
  // Keine zusätzlichen Felder für DisplayParticipant in diesem Fall
}

export interface Message {
  id: string; 
  senderUserId: string; 
  senderName: string;
  senderType: 'admin' | 'user' | 'bot';
  avatarFallback: string;
  content: string;
  timestamp: Timestamp | Date; 
  replyToMessageId?: string; 
  replyToMessageContentSnippet?: string;
  replyToMessageSenderName?: string;
  botFlag?: boolean; 
  imageUrl?: string; 
  imageFileName?: string;
  reactions?: { [emoji: string]: string[] }; 
}

export interface DisplayMessage extends Message {
  isOwn: boolean;
  timestampDisplay: string;
}
