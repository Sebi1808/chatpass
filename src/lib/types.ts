
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
  currentEscalation?: number; // Added for bot state
  isActive?: boolean; // Added for bot state
  autoTimerEnabled?: boolean; // Added for bot state
}

export interface SessionData {
  scenarioId: string;
  createdAt: Timestamp | Date;
  invitationLink: string;
  status: "active" | "paused" | "ended"; // Overall session status
  messageCooldownSeconds: number; // Cooldown for messages
  // Potentially add global simulation pace settings here
}

export interface Participant {
  id: string; // Firestore document ID
  userId: string; 
  name: string;
  role: string; 
  avatarFallback: string;
  isBot: boolean;
  joinedAt?: Timestamp | Date; 
  status?: "Aktiv" | "Inaktiv" | "Beigetreten" | "Nicht beigetreten"; 
  isMuted?: boolean; // Individual mute status, controlled by admin
  // botConfig if isBot true, for individual bot state like escalation level
  botConfig?: BotConfig 
}

export interface Message {
  id: string; // Firestore document ID
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
}
