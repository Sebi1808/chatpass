
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
  id: string; // Eindeutige ID für den Bot innerhalb des Szenarios, z.B. "provokateur-01"
  personality: 'provokateur' | 'verteidiger' | 'informant' | 'standard';
  name?: string;
  avatarFallback?: string;
  currentEscalation?: number;
  isActive?: boolean;
  autoTimerEnabled?: boolean;
  currentMission?: string;
}

export interface SessionData {
  scenarioId: string;
  createdAt: Timestamp | Date; // Firestore serverTimestamp on creation
  invitationLink: string;
  invitationToken?: string;
  status: "active" | "paused" | "ended";
  messageCooldownSeconds: number;
}

export interface Participant {
  id: string; // Firestore document ID
  userId: string; // Eindeutige ID des Benutzers (kann generiert werden)
  name: string;
  role: string;
  avatarFallback: string;
  isBot: boolean;
  joinedAt?: Timestamp | Date; // Firestore serverTimestamp on join
  status?: "Aktiv" | "Inaktiv" | "Beigetreten" | "Nicht beigetreten";
  isMuted?: boolean;
  botConfig?: BotConfig; // Nur für Bot-Teilnehmer relevant
  botScenarioId?: string; // ID der Bot-Konfiguration aus dem Szenario
}

export interface DisplayParticipant extends Participant {
  // Vorerst keine zusätzlichen Felder benötigt
}

export interface Message {
  id: string; // Firestore document ID
  senderUserId: string;
  senderName: string;
  senderType: 'admin' | 'user' | 'bot';
  avatarFallback: string;
  content: string;
  timestamp: Timestamp | Date | null; // Kann null sein, bevor der Server-Timestamp gesetzt wird
  replyToMessageId?: string;
  replyToMessageContentSnippet?: string;
  replyToMessageSenderName?: string;
  botFlag?: boolean;
  imageUrl?: string;
  imageFileName?: string;
  reactions?: { [emoji: string]: string[] }; // Emoji-String als Key, Array von UserIDs als Value
}

export interface DisplayMessage extends Message {
  isOwn: boolean;
  timestampDisplay: string;
}
