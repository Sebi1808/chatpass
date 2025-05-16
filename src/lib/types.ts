
import type { LucideIcon } from 'lucide-react';
import type { Timestamp } from 'firebase/firestore';

export interface InitialPostConfig {
  authorName: string;
  authorAvatarFallback: string; // z.B. "SYS" für System
  content: string;
  imageUrl?: string;
  platform?: 'Generic' | 'WhatsApp' | 'Instagram' | 'TikTok' | 'TwitterX';
}

export interface HumanRoleConfig {
  id: string; // Unique ID for the role definition within the scenario
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
  id: string; // Firestore document ID for the scenario
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
  id: string; // Unique ID for the bot definition within the scenario
  name: string;
  personality: 'provokateur' | 'verteidiger' | 'informant' | 'standard';
  avatarFallback?: string;
  currentEscalation?: number;
  isActive?: boolean;
  autoTimerEnabled?: boolean;
  initialMission?: string;
  templateOriginId?: string; // ID der Vorlage, falls davon erstellt
  currentMission?: string; // Von Admin im Dashboard gesetzt
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
  createdAt: Timestamp | Date | any; // Firestore Timestamp oder JS Date für Flexibilität mit ServerTimestamp
  updatedAt?: Timestamp | Date | any;
  invitationLink: string;
  invitationToken?: string;
  status: "active" | "paused" | "ended";
  messageCooldownSeconds: number;
}

export interface Participant {
  id: string; // Firestore document ID for this participant in this session
  userId: string; // A unique identifier for the user across sessions if possible, or generated per session
  name: string; // Klarname
  nickname?: string; // Nickname for chat display
  role: string; // Name der Rolle
  avatarFallback: string;
  isBot: boolean;
  joinedAt?: Timestamp | Date | any;
  status?: "Aktiv" | "Inaktiv" | "Beigetreten" | "Nicht beigetreten";
  isMuted?: boolean;
  botConfig?: BotConfig; // Wird direkt aus scenario.defaultBotsConfig übernommen und ggf. für die Sitzung angepasst
  botScenarioId?: string; // ID linking back to the BotConfig in the Scenario document's defaultBotsConfig array
}

export interface DisplayParticipant extends Participant {}

export interface Message {
  id: string; // Firestore document ID
  senderUserId: string;
  senderName: string; // Nickname, wenn vorhanden, sonst Klarname für User; Bot-Name für Bots; "Admin" für Admins
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
  reactions?: { [emoji: string]: string[] }; // emoji: userId[]
  platform?: 'Generic' | 'WhatsApp' | 'Instagram' | 'TikTok' | 'TwitterX';
}

export interface DisplayMessage extends Message {
  isOwn: boolean;
  timestampDisplay: string;
}
