
import type { LucideIcon } from 'lucide-react';
import type { Timestamp } from 'firebase/firestore';

export interface InitialPostConfig {
  authorName: string;
  authorAvatarFallback: string; 
  content: string;
  imageUrl?: string;
  platform?: 'Generic' | 'WhatsApp' | 'Instagram' | 'TikTok' | 'TwitterX';
}

export interface HumanRoleConfig {
  id: string; 
  name: string;
  description: string;
  templateOriginId?: string;
}

export interface ScenarioEvent {
  id: string;
  name: string;
  description: string;
  triggerType: 'manual';
}

export interface Scenario {
  id: string; 
  title: string;
  kurzbeschreibung: string;
  langbeschreibung: string;
  lernziele: string; 
  iconName: string;
  tags: string[];
  previewImageUrl?: string;
  defaultBotsConfig?: BotConfig[];
  humanRolesConfig?: HumanRoleConfig[];
  initialPost?: InitialPostConfig;
  status?: 'draft' | 'published';
  events?: ScenarioEvent[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface BotConfig {
  id: string; 
  name: string;
  personality: 'provokateur' | 'verteidiger' | 'informant' | 'standard';
  avatarFallback?: string;
  currentEscalation?: number;
  isActive?: boolean;
  autoTimerEnabled?: boolean;
  initialMission?: string;
  templateOriginId?: string; 
  currentMission?: string; 
}

export interface BotTemplate {
  templateId: string; 
  name: string;
  personality: 'provokateur' | 'verteidiger' | 'informant' | 'standard';
  avatarFallback?: string;
  initialMission?: string;
  createdAt?: Timestamp;
}

export interface RoleTemplate {
  templateId: string; 
  name: string;
  description: string;
  createdAt?: Timestamp;
}

export interface SessionData {
  scenarioId: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  invitationLink: string;
  invitationToken?: string;
  status: "pending" | "open" | "active" | "paused" | "ended";
  messageCooldownSeconds: number;
  roleSelectionLocked?: boolean;
  simulationStartCountdownEndTime?: Timestamp | null;
}

export interface Participant {
  id: string; 
  userId: string; 
  realName: string; // Klarname
  displayName: string; // Nickname, im Chat sichtbar
  role: string; 
  roleId?: string; // ID der Rolle aus humanRolesConfig
  avatarFallback: string;
  isBot: boolean;
  joinedAt?: Timestamp;
  status?: "Aktiv" | "Inaktiv" | "Beigetreten" | "Nicht beigetreten"; // "Beigetreten" ist der Status im Wartebereich
  isMuted?: boolean;
  botConfig?: BotConfig; 
  botScenarioId?: string; 
}

export interface DisplayParticipant extends Participant {}

export interface Message {
  id: string; 
  senderUserId: string;
  senderName: string; // This will be the displayName (nickname)
  senderType: 'admin' | 'user' | 'bot' | 'system';
  avatarFallback: string;
  content: string;
  timestamp: Timestamp | null;
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
