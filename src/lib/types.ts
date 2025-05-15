
import type { LucideIcon } from 'lucide-react';
import type { Timestamp } from 'firebase/firestore';

export interface Scenario {
  id: string;
  title: string;
  kurzbeschreibung: string;
  langbeschreibung: string;
  lernziele?: string[]; // Added for scenario editor
  defaultBots: number;
  standardRollen: number; // Gesamtzahl der Rollen inkl. Bots
  iconName: string;
  tags: string[];
  defaultBotsConfig?: BotConfig[];
}

export interface BotConfig {
  id: string; 
  personality: 'provokateur' | 'verteidiger' | 'informant' | 'standard';
  name?: string;
  avatarFallback?: string;
  currentEscalation?: number; // Default or initial escalation level
  isActive?: boolean; // Whether the bot is active by default in a session
  autoTimerEnabled?: boolean; // For future auto-posting feature
  initialMission?: string; // An initial mission/prompt for the bot from scenario config
  currentMission?: string; // For admin to override or set a new mission during a session
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
  botConfig?: BotConfig; 
  botScenarioId?: string; 
}

export interface DisplayParticipant extends Participant {
  // Potentially add UI-specific participant properties here if needed later
}

export interface Message {
  id: string; 
  senderUserId: string;
  senderName: string;
  senderType: 'admin' | 'user' | 'bot';
  avatarFallback: string;
  content: string;
  timestamp: Timestamp | Date | null; 
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
