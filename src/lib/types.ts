
import type { LucideIcon } from 'lucide-react';
import type { Timestamp } from 'firebase/firestore';

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
  iconName: string;
  tags: string[];
  previewImageUrl?: string;
  defaultBotsConfig?: BotConfig[]; 
  humanRolesConfig?: HumanRoleConfig[]; 
  status?: 'draft' | 'published';
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface BotConfig {
  id: string; // Unique ID for the bot instance within the scenario
  name: string; 
  personality: 'provokateur' | 'verteidiger' | 'informant' | 'standard';
  avatarFallback?: string;
  currentEscalation?: number; 
  isActive?: boolean;         
  autoTimerEnabled?: boolean; 
  initialMission?: string;    
  templateOriginId?: string; // Optional: ID of the template this bot instance was created from
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
  joinedAt?: Timestamp | Date | any;
  status?: "Aktiv" | "Inaktiv" | "Beigetreten" | "Nicht beigetreten";
  isMuted?: boolean;
  botConfig?: { 
    personality: 'provokateur' | 'verteidiger' | 'informant' | 'standard';
    currentEscalation: number;
    isActive: boolean; 
    autoTimerEnabled: boolean; 
    initialMission?: string; 
    currentMission?: string; 
  };
  botScenarioId?: string; 
}

export interface DisplayParticipant extends Participant {}

export interface Message {
  id: string; 
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

    