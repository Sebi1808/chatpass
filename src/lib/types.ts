
import type { LucideIcon } from 'lucide-react';
import type { Timestamp } from 'firebase/firestore';

export interface InitialPostConfig {
  authorName: string;
  authorAvatarFallback: string; // z.B. "SYS" für System
  content: string;
  imageUrl?: string; // Optional, für direkte URL-Eingabe
  platform?: 'Generic' | 'WhatsApp' | 'Instagram' | 'TikTok' | 'TwitterX'; // Neu
  // imageFile?: File; // Für späteren Datei-Upload
}

export interface HumanRoleConfig {
  id: string; // Unique ID for the role instance within the scenario
  name: string;
  description: string;
  templateOriginId?: string; // Optional: ID of the template this role instance was created from
}

export interface Scenario {
  id: string; // Firestore document ID for the scenario
  title: string;
  kurzbeschreibung: string;
  langbeschreibung: string;
  lernziele?: string[];
  iconName: string; // Name of the Lucide icon
  tags: string[];
  previewImageUrl?: string;
  defaultBotsConfig?: BotConfig[];
  humanRolesConfig?: HumanRoleConfig[];
  initialPost?: InitialPostConfig;
  status?: 'draft' | 'published'; // Neu für Veröffentlichungsstatus
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface BotConfig {
  id: string; // Unique ID for the bot instance within the scenario, or for the template
  name: string;
  personality: 'provokateur' | 'verteidiger' | 'informant' | 'standard';
  avatarFallback?: string;
  currentEscalation?: number;
  isActive?: boolean;
  autoTimerEnabled?: boolean;
  initialMission?: string;
  templateOriginId?: string; // Optional: ID of the template this bot instance was created from
  // templateId?: string; // Used if this BotConfig itself is a template in the botTemplates collection
}

// Firestore document structure for Bot Templates
export interface BotTemplate {
  templateId: string; // This will be the Firestore document ID
  name: string;
  personality: 'provokateur' | 'verteidiger' | 'informant' | 'standard';
  avatarFallback?: string;
  initialMission?: string;
  createdAt?: Timestamp;
}

// Firestore document structure for Role Templates
export interface RoleTemplate {
  templateId: string; // This will be the Firestore document ID
  name: string;
  description: string;
  createdAt?: Timestamp;
}


export interface SessionData {
  scenarioId: string;
  createdAt: Timestamp | Date | any; // Allow any for serverTimestamp()
  invitationLink: string;
  invitationToken?: string;
  status: "active" | "paused" | "ended";
  messageCooldownSeconds: number;
}

export interface Participant {
  id: string; // Firestore document ID for this participant in the session
  userId: string; // A unique identifier for the user/bot instance
  name: string;
  role: string; // The role name (e.g., "Zielperson der Angriffe", "Bot Provokateur")
  avatarFallback: string;
  isBot: boolean;
  joinedAt?: Timestamp | Date | any; // Allow any for serverTimestamp()
  status?: "Aktiv" | "Inaktiv" | "Beigetreten" | "Nicht beigetreten"; // For display in admin dashboard
  isMuted?: boolean;
  botConfig?: { // Only if isBot is true, specific runtime config for this bot in this session
    id: string; // The original ID from the scenario's defaultBotsConfig
    personality: 'provokateur' | 'verteidiger' | 'informant' | 'standard';
    currentEscalation: number;
    isActive: boolean;
    autoTimerEnabled: boolean;
    initialMission?: string;
    currentMission?: string; // Mission for the next post, can be set by admin
    templateOriginId?: string;
  };
  botScenarioId?: string; // ID linking back to the BotConfig in the Scenario document
}

export interface DisplayParticipant extends Participant {} // For client-side display, might include additional temporary fields

export interface Message {
  id: string; // Firestore document ID
  senderUserId: string;
  senderName: string;
  senderType: 'admin' | 'user' | 'bot' | 'system';
  avatarFallback: string;
  content: string;
  timestamp: Timestamp | Date | null | any; // Allow any for serverTimestamp() before it's converted
  replyToMessageId?: string;
  replyToMessageContentSnippet?: string;
  replyToMessageSenderName?: string;
  botFlag?: boolean;
  imageUrl?: string;
  imageFileName?: string;
  reactions?: { [emoji: string]: string[] }; // emoji: array of userIds
}

export interface DisplayMessage extends Message {
  isOwn: boolean;
  timestampDisplay: string;
}
