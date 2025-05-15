
import type { LucideIcon } from 'lucide-react';
import type { Timestamp } from 'firebase/firestore';

export interface HumanRoleConfig {
  id: string; // Unique ID for the role instance within the scenario
  name: string;
  description: string;
  templateId?: string; // Optional: ID of the template this role was created from
}

export interface Scenario {
  id: string;
  title: string;
  kurzbeschreibung: string;
  langbeschreibung: string;
  lernziele?: string[];
  defaultBots: number;
  standardRollen: number;
  iconName: string;
  tags: string[];
  previewImageUrl?: string; // Added for scenario preview image
  defaultBotsConfig?: BotConfig[];
  humanRolesConfig?: HumanRoleConfig[];
}

export interface BotConfig {
  id: string; // Unique ID for the bot instance within the scenario
  personality: 'provokateur' | 'verteidiger' | 'informant' | 'standard';
  name?: string;
  avatarFallback?: string;
  currentEscalation?: number;
  isActive?: boolean;
  autoTimerEnabled?: boolean;
  initialMission?: string;
  currentMission?: string; // For admin override during session
  templateId?: string; // Optional: ID of the template this bot was created from
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
  id: string; // Firestore document ID
  userId: string;
  name: string;
  role: string;
  avatarFallback: string;
  isBot: boolean;
  joinedAt?: Timestamp | Date | any;
  status?: "Aktiv" | "Inaktiv" | "Beigetreten" | "Nicht beigetreten";
  isMuted?: boolean;
  botConfig?: BotConfig;
  botScenarioId?: string; // The unique ID from the Scenario's defaultBotsConfig (BotConfig.id)
}

export interface DisplayParticipant extends Participant {}

export interface Message {
  id: string; // Firestore document ID
  senderUserId: string;
  senderName: string;
  senderType: 'admin' | 'user' | 'bot';
  avatarFallback: string;
  content: string;
  timestamp: Timestamp | Date | null | any;
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
