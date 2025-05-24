import type { LucideIcon } from 'lucide-react';
import type { Timestamp, FieldValue } from 'firebase/firestore';

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
  iconName?: string; 
  goals?: string[];
  isRoleMuted?: boolean;
  maxParticipants: number; // 0 for unlimited
  isDefault: boolean; // Is this the default role assigned?
  allowBotsToJoin?: boolean; // Can bots be assigned to this role?
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
  id?: string; // Usually the same as scenarioId for the primary session
  scenarioId: string;
  status: "pending" | "open" | "active" | "paused" | "ended";
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  startedAt?: Timestamp;
  endedAt?: Timestamp;
  messageCooldownSeconds: number;
  invitationToken: string;
  invitationLink: string;
  roleSelectionLocked: boolean;
  simulationStartCountdownEndTime: Timestamp | null;
  currentAdmin?: string; // UID of the admin who last interacted
  mutedRoleIds?: string[]; // IDs of roles that are currently muted by admin
  activeRolePenalties?: RolePenalty[];
  // NEU: Feature-Toggles für Admin-Dashboard
  enableReporting?: boolean; // Meldefunktion aktivieren/deaktivieren
  enableBlocking?: boolean; // Blockieren aktivieren/deaktivieren
  enableDirectMessages?: boolean; // Direktnachrichten aktivieren/deaktivieren
}

export interface RolePenalty {
  roleId: string;
  penaltyType: 'yellow' | 'red';
  startedAt: Timestamp;
  durationMinutes: number;
  description?: string;
}

export interface Participant {
  id: string;
  userId: string; // Firebase Auth UID or unique ID for bots/anon
  realName?: string | null; // Real name, optional
  displayName: string;
  role: string;
  roleId: string; // ID of the role from ScenarioConfig
  avatarUrl?: string | null;
  avatarFallback: string;
  isBot?: boolean;
  botConfig?: BotConfig; // Only if isBot is true
  joinedAt: Timestamp;
  updatedAt?: Timestamp;
  status: "Nicht beigetreten" | "Wählt Rolle" | "Im Wartebereich" | "Beigetreten" | "Verlassen";
  isMuted?: boolean;
  activePenalty?: {
    type: 'yellow' | 'red';
    startedAt: Timestamp;
    durationMinutes: number;
    description?: string;
  } | null;
  assignedBadges?: ('admin' | 'moderator')[]; // NEU: Für Admin/Moderator-Badges
  lastInteractionTimestamp?: Timestamp; // For AFK checks or other timings
  currentEmoji?: string | null; // Currently selected emoji reaction for user
  blockedUserIds?: string[]; // NEU: Array von User-IDs, die dieser Teilnehmer blockiert hat
  colorSeed?: number; // NEU: Für konsistente Farbzuweisung
}

export interface DisplayParticipant extends Participant {}

export interface Message {
  id: string; 
  sessionId?: string; // Optional, falls die Nachricht in einer Subkollektion ist, wo sessionId implizit ist
  scenarioId?: string; // Für Szenario-basierte Nachrichten
  senderUserId?: string; // ID des Senders (kann auch "system" oder "bot" sein)
  senderName: string; // Anzeigename des Senders
  senderType?: 'admin' | 'user' | 'bot' | 'system';
  avatarFallback?: string;
  recipientId?: string; // Für Direktnachrichten: ID des Empfängers
  targetRoleIds?: string[]; // Für Nachrichten an spezifische Rollen (Admin Broadcast)
  content: string;
  imageUrl?: string;
  imageFileName?: string;
  voiceMessageUrl?: string; // NEU: URL zur Sprachnachricht in Firebase Storage
  voiceMessageFileName?: string; // NEU: Dateiname der Sprachnachricht
  voiceMessageDuration?: number; // NEU: Dauer der Sprachnachricht in Sekunden
  timestamp: Timestamp | FieldValue; // Firestore Timestamp oder ServerTimestamp
  platform?: string; // z.B. 'Twitter', 'Instagram'
  reactions?: { [emoji: string]: string[] }; // Emoji -> Array von UserIDs
  isPinned?: boolean;
  replyToMessageId?: string;
  replyToMessageContentSnippet?: string;
  replyToMessageSenderName?: string;
  isRead?: boolean; // Für DMs: Wurde die Nachricht vom Empfänger gelesen?
  isAdminBroadcast?: boolean; // Ist dies eine spezielle Admin-Nachricht, die ein Overlay triggern soll?
  blurredBy?: string | null; // NEU: UserId des Moderators/Admins, der die Nachricht geblurrt hat
  isBlurred?: boolean; // NEU: Gibt an, ob die Nachricht aktuell geblurrt ist
  reportedBy?: {
    userId: string;
    reason: string;
    timestamp: Timestamp;
  }[]; // NEU: Meldungen von Nutzern
}

export interface DisplayMessage extends Message {
  isOwn: boolean;
  timestampDisplay: string;
  isFromBlockedUser?: boolean; // NEU: Kennzeichnung, dass die Nachricht von einem blockierten Benutzer stammt
}

export interface DirectMessage {
  id: string;
  senderId: string;
  senderName: string; // For easier display
  receiverId: string;
  content: string;
  timestamp: Timestamp;
  isRead: boolean;
}
