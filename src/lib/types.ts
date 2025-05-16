
import type { LucideIcon } from 'lucide-react';
import type { Timestamp } from 'firebase/firestore';

export interface InitialPostConfig {
  authorName: string;
  authorAvatarFallback: string; // z.B. "SYS" für System
  content: string;
  imageUrl?: string; // Optional, für direkte URL-Eingabe
  platform?: 'Generic' | 'WhatsApp' | 'Instagram' | 'TikTok' | 'TwitterX';
}

export interface HumanRoleConfig {
  id: string; // Unique ID for the role instance within the scenario
  name: string;
  description: string;
  templateOriginId?: string; // Optional: ID of the template this role instance was created from
}

export interface ScenarioEvent {
  id: string; // Eindeutige ID für das Ereignis
  name: string; // Kurzer Name/Titel des Ereignisses
  description: string; // Kurze Beschreibung, was passiert
  // Weitere Felder für die Aktionsdefinition folgen später, z.B.
  // actionType: 'BOT_POST' | 'SYSTEM_MESSAGE' | 'CHANGE_COOLDOWN';
  // actionDetails: any;
}

export interface Scenario {
  id: string; // Firestore document ID for the scenario
  title: string;
  kurzbeschreibung: string;
  langbeschreibung: string;
  lernziele: string; // Statt string[], da WYSIWYG HTML speichert oder Textarea mit Zeilenumbrüchen
  iconName: string; // Name of the Lucide icon
  tags: string[];
  previewImageUrl?: string;
  defaultBotsConfig?: BotConfig[];
  humanRolesConfig?: HumanRoleConfig[];
  initialPost?: InitialPostConfig;
  status?: 'draft' | 'published';
  events?: ScenarioEvent[]; // NEU
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface BotConfig {
  id: string; // Unique ID for the bot instance within the scenario
  name: string;
  personality: 'provokateur' | 'verteidiger' | 'informant' | 'standard';
  avatarFallback?: string;
  currentEscalation?: number; // Wird im Szenario-Editor als "Initiale Eskalation" gesetzt
  isActive?: boolean; // Wird im Szenario-Editor als "Standardmäßig aktiv" gesetzt
  autoTimerEnabled?: boolean;
  initialMission?: string;
  templateOriginId?: string; // ID der Vorlage, falls davon erstellt
}

export interface BotTemplate {
  templateId: string; // This will be the Firestore document ID
  name: string;
  personality: 'provokateur' | 'verteidiger' | 'informant' | 'standard';
  avatarFallback?: string;
  initialMission?: string;
  createdAt?: Timestamp;
}

export interface RoleTemplate {
  templateId: string; // This will be the Firestore document ID
  name: string;
  description: string;
  createdAt?: Timestamp;
}


export interface SessionData {
  scenarioId: string;
  createdAt: Timestamp | Date | any;
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
  joinedAt?: Timestamp | Date | any;
  status?: "Aktiv" | "Inaktiv" | "Beigetreten" | "Nicht beigetreten";
  isMuted?: boolean;
  botConfig?: {
    id: string; // Original ID from scenario's defaultBotsConfig
    personality: 'provokateur' | 'verteidiger' | 'informant' | 'standard';
    currentEscalation: number;
    isActive: boolean;
    autoTimerEnabled: boolean;
    initialMission?: string;
    currentMission?: string; // Mission for next post, set by admin
    templateOriginId?: string;
  };
  botScenarioId?: string; // ID linking back to the BotConfig in the Scenario document
}

export interface DisplayParticipant extends Participant {}

export interface Message {
  id: string;
  senderUserId: string;
  senderName: string;
  senderType: 'admin' | 'user' | 'bot' | 'system';
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
  platform?: 'Generic' | 'WhatsApp' | 'Instagram' | 'TikTok' | 'TwitterX';
}

export interface DisplayMessage extends Message {
  isOwn: boolean;
  timestampDisplay: string;
}
