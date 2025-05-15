
import type { LucideIcon } from 'lucide-react';
import type { Timestamp } from 'firebase/firestore';

export interface HumanRoleConfig {
  id: string; // Unique ID for the role instance within the scenario
  name: string;
  description: string;
  templateId?: string; // ID of the template in the 'roleTemplates' collection if this role is a template itself
  templateOriginId?: string; // Optional: ID of the template this role instance was created from
}

export interface Scenario {
  id: string; // Firestore document ID for the scenario
  title: string;
  kurzbeschreibung: string;
  langbeschreibung: string;
  lernziele?: string[];
  iconName: string;
  tags: string[];
  previewImageUrl?: string;
  defaultBotsConfig?: BotConfig[]; // Array of BotConfig instances for this scenario
  humanRolesConfig?: HumanRoleConfig[]; // Array of HumanRoleConfig instances for this scenario
  status?: 'draft' | 'published';
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  // defaultBots and standardRollen are derived dynamically or on save, not typically stored directly unless for denormalization.
}

export interface BotConfig {
  id: string; // Unique ID for the bot instance within the scenario
  templateId?: string; // ID of the template in the 'botTemplates' collection if this bot is a template itself
  name: string; // Made mandatory for clarity
  personality: 'provokateur' | 'verteidiger' | 'informant' | 'standard';
  avatarFallback?: string;
  currentEscalation?: number; // Current escalation level in a running session (part of Participant.botConfig)
  isActive?: boolean;         // Whether this bot is active by default in a scenario
  autoTimerEnabled?: boolean; // Whether auto-timer is enabled by default
  initialMission?: string;    // Initial mission for the bot in a scenario
  templateOriginId?: string; // Optional: ID of the template this bot instance was created from
}


// Specific types for templates stored in Firestore
export interface BotTemplate extends Omit<BotConfig, 'id' | 'templateOriginId' | 'currentEscalation' | 'isActive' | 'autoTimerEnabled'> {
  templateId: string; // This is the primary ID for documents in botTemplates collection
  // Includes name, personality, avatarFallback, initialMission
}

export interface RoleTemplate extends Omit<HumanRoleConfig, 'id' | 'templateOriginId'> {
  templateId: string; // This is the primary ID for documents in roleTemplates collection
  // Includes name, description
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
  id: string; // Firestore document ID for the participant in a session
  userId: string; // Unique user identifier (can be Firebase Auth UID or custom)
  name: string;
  role: string; // Role name taken by the human participant or assigned to bot
  avatarFallback: string;
  isBot: boolean;
  joinedAt?: Timestamp | Date | any;
  status?: "Aktiv" | "Inaktiv" | "Beigetreten" | "Nicht beigetreten";
  isMuted?: boolean;
  botConfig?: { // Specific runtime config for a bot participant in a session
    personality: 'provokateur' | 'verteidiger' | 'informant' | 'standard';
    currentEscalation: number;
    isActive: boolean; // Runtime active state in session
    autoTimerEnabled: boolean; // Runtime auto-timer state in session
    initialMission?: string; // From scenario's BotConfig
    currentMission?: string; // Admin override for next post
  };
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
