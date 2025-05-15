
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
  iconName: string; // Should match a key in iconMap in ScenarioCard
  tags: string[];
  defaultBotsConfig?: BotConfig[];
}

export interface BotConfig {
  id: string; // e.g., "szenario1-provokateur-0" - MUST be unique within scenario
  personality: 'provokateur' | 'verteidiger' | 'informant' | 'standard';
  name?: string; // Display name for the bot, e.g., "Bot Kevin"
  avatarFallback?: string; // e.g., "BK"
  currentEscalation?: number; // Default or initial escalation level (0-3)
  isActive?: boolean; // Whether the bot is active by default in a session
  autoTimerEnabled?: boolean; // For future auto-posting feature
  initialMission?: string; // An initial mission/prompt for the bot from scenario config
  currentMission?: string; // For admin to override or set a new mission during a session
}

export interface SessionData {
  scenarioId: string;
  createdAt: Timestamp | Date; // Firestore timestamp or JS Date for client-side creation
  invitationLink: string;
  invitationToken?: string;
  status: "active" | "paused" | "ended";
  messageCooldownSeconds: number;
}

export interface Participant {
  id: string; // Firestore document ID
  userId: string; // Unique identifier for the user/bot session (e.g. `user-${name}-${timestamp}` or `bot-${botScenarioId}`)
  name: string;
  role: string;
  avatarFallback: string;
  isBot: boolean;
  joinedAt?: Timestamp | Date | any; // Firestore timestamp or JS Date
  status?: "Aktiv" | "Inaktiv" | "Beigetreten" | "Nicht beigetreten";
  isMuted?: boolean;
  botConfig?: BotConfig; // If isBot is true, this contains the specific bot config
  botScenarioId?: string; // The unique ID from the Scenario's defaultBotsConfig
}

// For client-side display, potentially with additional UI-related properties
export interface DisplayParticipant extends Participant {
  // Potentially add UI-specific participant properties here if needed later
}

export interface Message {
  id: string; // Firestore document ID
  senderUserId: string;
  senderName: string;
  senderType: 'admin' | 'user' | 'bot';
  avatarFallback: string;
  content: string;
  timestamp: Timestamp | Date | null | any; // Firestore timestamp or ServerTimestamp or JS Date
  replyToMessageId?: string;
  replyToMessageContentSnippet?: string;
  replyToMessageSenderName?: string;
  botFlag?: boolean; // Optional flag for bot messages
  imageUrl?: string;
  imageFileName?: string;
  reactions?: { [emoji: string]: string[] }; // emoji_char: [userId1, userId2]
}

export interface DisplayMessage extends Message {
  isOwn: boolean;
  timestampDisplay: string;
}

    