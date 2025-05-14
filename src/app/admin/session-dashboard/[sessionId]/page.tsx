
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AlertCircle, Bot, ChevronDown, ChevronUp, Download, MessageSquare, Play, Pause, QrCode, Users, Settings, Volume2, VolumeX, Copy, MessageCircle as MessageCircleIcon, Power, RotateCcw, RefreshCw, Eye, Brain, NotebookPen } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { scenarios } from "@/lib/scenarios";
import type { Scenario, BotConfig, Participant, Message as MessageType, SessionData } from "@/lib/types";
import { useEffect, useState, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/firebase";
import { doc, setDoc, getDoc, serverTimestamp, collection, onSnapshot, query, orderBy, Timestamp, updateDoc, writeBatch, getDocs, where, deleteDoc, addDoc } from "firebase/firestore";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { ChatPageContent } from "@/app/chat/[sessionId]/page";
import { generateBotMessage } from "@/ai/flows/bot-message-generator";


interface AdminSessionDashboardPageProps {
  params: { sessionId: string };
}

interface AdminDashboardMessage extends MessageType {
  id: string;
  timestampDisplay: string;
}

const DEFAULT_COOLDOWN = 0;

const generateToken = () => Math.random().toString(36).substring(2, 10);
const generateBotId = (scenarioBotId: string) => `bot-${scenarioBotId}-${Date.now()}`;


export default function AdminSessionDashboardPage(props: AdminSessionDashboardPageProps) {
  const sessionId = props.params.sessionId; 
  const { toast } = useToast();
  const [currentScenario, setCurrentScenario] = useState<Scenario | undefined>(undefined);
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [sessionParticipants, setSessionParticipants] = useState<Participant[]>([]);
  const [chatMessages, setChatMessages] = useState<AdminDashboardMessage[]>([]);

  const [isLoadingSessionData, setIsLoadingSessionData] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(true);
  const [isEndingSession, setIsEndingSession] = useState(false);
  const [isStartingOrRestartingSession, setIsStartingOrRestartingSession] = useState(false);
  const [isResettingSession, setIsResettingSession] = useState(false);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [showParticipantMirrorView, setShowParticipantMirrorView] = useState(false);
  const [isPostingForBot, setIsPostingForBot] = useState<string | null>(null);
  const [botMissions, setBotMissions] = useState<Record<string, string>>({});


  const [paceValue, setPaceValue] = useState<number>(DEFAULT_COOLDOWN);
  const chatMessagesEndRef = useRef<null | HTMLDivElement>(null);
  const mirroredChatMessagesEndRef = useRef<null | HTMLDivElement>(null);


  const displayedInvitationLink = sessionData?.invitationLink && sessionData.invitationToken
    ? `${sessionData.invitationLink}?token=${sessionData.invitationToken}`
    : "Wird generiert...";

  const getBotDisplayName = (botConfig: BotConfig, index?: number): string => {
    if (botConfig.name) return botConfig.name;
    let nameSuffix = index !== undefined ? ` ${index + 1}` : "";
    switch (botConfig.personality) {
      case 'provokateur': return `Bot Provokateur${nameSuffix}`;
      case 'verteidiger': return `Bot Verteidiger${nameSuffix}`;
      case 'informant': return `Bot Informant${nameSuffix}`;
      default: return `Bot Standard${nameSuffix}`;
    }
  };

  const initializeBotsForSession = async (scenario: Scenario, currentSessionId: string) => {
    if (!scenario.defaultBotsConfig || scenario.defaultBotsConfig.length === 0) {
         // If no bots are defined in scenario, delete any existing bots for this session
        const participantsColRef = collection(db, "sessions", currentSessionId, "participants");
        const botQuery = query(participantsColRef, where("isBot", "==", true));
        const botSnap = await getDocs(botQuery);
        if (!botSnap.empty) {
            const batch = writeBatch(db);
            botSnap.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            console.log("Deleted existing bots as none are defined in current scenario config.");
        }
        return;
    }

    const batch = writeBatch(db);
    const participantsColRef = collection(db, "sessions", currentSessionId, "participants");
    const existingBotsSnap = await getDocs(query(participantsColRef, where("isBot", "==", true)));
    const existingBotScenarioIds = new Set(existingBotsSnap.docs.map(doc => doc.data().botScenarioId));
    const scenarioBotIds = new Set(scenario.defaultBotsConfig.map(bc => bc.id));

    // Delete bots from Firestore that are no longer in the scenario config
    existingBotsSnap.docs.forEach(botDoc => {
        const botData = botDoc.data();
        if (!scenarioBotIds.has(botData.botScenarioId)) {
            batch.delete(botDoc.ref);
            console.log(`Deleting bot ${botData.name} (ID: ${botData.botScenarioId}) as it's no longer in scenario config.`);
        }
    });

    // Add or update bots based on scenario config
    for (const [index, botConfig] of scenario.defaultBotsConfig.entries()) {
      const botScenarioId = botConfig.id || `${botConfig.personality}-${index}`; // Ensure botConfig has an id
      const botQuery = query(participantsColRef, where("isBot", "==", true), where("botScenarioId", "==", botScenarioId));
      const botSnap = await getDocs(botQuery);

      const botParticipantData: Participant = {
        id: '', // Will be set by Firestore for new docs, or existing id
        userId: '', // Will be set
        name: getBotDisplayName(botConfig, index),
        role: `Bot (${botConfig.personality})`,
        avatarFallback: botConfig.avatarFallback || botConfig.personality.substring(0,2).toUpperCase(),
        isBot: true,
        joinedAt: serverTimestamp(),
        status: "Aktiv",
        botConfig: {
          ...botConfig,
          isActive: botConfig.isActive ?? true,
          currentEscalation: botConfig.currentEscalation ?? 0,
          autoTimerEnabled: botConfig.autoTimerEnabled ?? false,
          currentMission: botConfig.currentMission || "", 
        },
        botScenarioId: botScenarioId,
      };

      if (botSnap.empty) {
        const botId = generateBotId(botScenarioId);
        botParticipantData.id = botId;
        botParticipantData.userId = botId;
        batch.set(doc(participantsColRef, botId), botParticipantData);
        console.log(`Adding new bot: ${botParticipantData.name} (ID: ${botScenarioId})`);
      } else {
        const existingBotDoc = botSnap.docs[0];
        const existingBotData = existingBotDoc.data() as Participant;
        // Preserve existing mission if new mission is empty and there was an existing one
        const missionToSet = botConfig.currentMission || existingBotData.botConfig?.currentMission || "";

        batch.update(existingBotDoc.ref, {
            name: getBotDisplayName(botConfig, index),
            role: `Bot (${botConfig.personality})`,
            avatarFallback: botConfig.avatarFallback || botConfig.personality.substring(0,2).toUpperCase(),
            "botConfig.personality": botConfig.personality,
            "botConfig.isActive": botConfig.isActive ?? existingBotData.botConfig?.isActive ?? true,
            "botConfig.currentEscalation": botConfig.currentEscalation ?? existingBotData.botConfig?.currentEscalation ?? 0,
            "botConfig.autoTimerEnabled": botConfig.autoTimerEnabled ?? existingBotData.botConfig?.autoTimerEnabled ?? false,
            "botConfig.currentMission": missionToSet,
            botScenarioId: botScenarioId, // Ensure this is always set/updated
        });
        console.log(`Updating existing bot: ${botParticipantData.name} (ID: ${botScenarioId})`);
      }
    }
    await batch.commit();
    console.log("Bot initialization/update complete.");
  };


  useEffect(() => {
    const scenario = scenarios.find(s => s.id === sessionId);
    setCurrentScenario(scenario);

    if (scenario) {
      const sessionDocRef = doc(db, "sessions", sessionId);
      const setupSession = async () => {
        setIsLoadingSessionData(true);
        try {
          const docSnap = await getDoc(sessionDocRef);
          let baseLink = "";
          if (typeof window !== "undefined") {
            baseLink = `${window.location.origin}/join/${sessionId}`;
          }

          if (!docSnap.exists()) {
            const newSessionToken = generateToken();
            const newSessionData: SessionData = {
              scenarioId: sessionId,
              createdAt: serverTimestamp(),
              invitationLink: baseLink,
              invitationToken: newSessionToken,
              status: "active",
              messageCooldownSeconds: DEFAULT_COOLDOWN,
            };
            await setDoc(sessionDocRef, newSessionData);
            setPaceValue(DEFAULT_COOLDOWN);
            await initializeBotsForSession(scenario, sessionId);
          } else {
            const existingData = docSnap.data() as SessionData;
            const updates: Partial<SessionData> = {};
            let needsDbUpdate = false;

            if (existingData.invitationLink !== baseLink && baseLink) {
              updates.invitationLink = baseLink;
              needsDbUpdate = true;
            }
            if (!existingData.invitationToken) {
              updates.invitationToken = generateToken();
              needsDbUpdate = true;
            }

            if (needsDbUpdate) {
              await updateDoc(sessionDocRef, updates);
            }

            setSessionData(prev => ({...prev, ...existingData, ...updates})); // Ensure previous data is spread correctly
            setPaceValue(existingData.messageCooldownSeconds ?? DEFAULT_COOLDOWN);
            await initializeBotsForSession(scenario, sessionId);
          }
        } catch (error) {
          console.error("Error managing session document: ", error);
          toast({ variant: "destructive", title: "Firestore Fehler", description: "Sitzung konnte nicht erstellt/geladen werden." });
        } finally {
          setIsLoadingSessionData(false);
        }
      };
      setupSession();
    } else {
      setIsLoadingSessionData(false);
      setSessionData(null);
      toast({ variant: "destructive", title: "Szenario Fehler", description: `Szenario mit ID ${sessionId} nicht gefunden.`})
    }
  }, [sessionId, toast]); // Removed currentScenario from deps as it's derived from sessionId


  useEffect(() => {
    if (!sessionId) return;
    const sessionDocRef = doc(db, "sessions", sessionId);
    const unsubscribeSessionData = onSnapshot(sessionDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as SessionData;
        setSessionData(data);
        setPaceValue(data.messageCooldownSeconds ?? DEFAULT_COOLDOWN);
      } else {
        setSessionData(null);
      }
      setIsLoadingSessionData(false);
    }, (error) => {
      console.error("Error listening to session data: ", error);
      setIsLoadingSessionData(false);
    });
    return () => unsubscribeSessionData();
  }, [sessionId]);


  useEffect(() => {
    if (!sessionId) return;
    setIsLoadingParticipants(true);
    const participantsColRef = collection(db, "sessions", sessionId, "participants");
    const participantsQuery = query(participantsColRef, orderBy("joinedAt", "asc"));
    const unsubscribeParticipants = onSnapshot(participantsQuery, (querySnapshot) => {
      const fetchedParticipants: Participant[] = [];
      querySnapshot.forEach((docSn) => {
        fetchedParticipants.push({ id: docSn.id, ...docSn.data() } as Participant);
      });
      setSessionParticipants(fetchedParticipants);
      setIsLoadingParticipants(false);
    }, (error) => {
      console.error("Error fetching participants: ", error);
      setIsLoadingParticipants(false);
    });
    return () => unsubscribeParticipants();
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || showParticipantMirrorView) { // Dont load admin messages if mirror view is active
      setIsLoadingMessages(false);
      return;
    }
    setIsLoadingMessages(true);
    const messagesColRef = collection(db, "sessions", sessionId, "messages");
    const messagesQuery = query(messagesColRef, orderBy("timestamp", "asc"));
    const unsubscribeMessages = onSnapshot(messagesQuery, (querySnapshot) => {
      const fetchedMessages: AdminDashboardMessage[] = [];
      querySnapshot.forEach((docSn) => {
        const data = docSn.data() as MessageType;
        const timestamp = data.timestamp as Timestamp | null;
        fetchedMessages.push({
          ...data,
          id: docSn.id,
          timestampDisplay: timestamp ? new Date(timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Senden...'
        });
      });
      setChatMessages(fetchedMessages);
      setIsLoadingMessages(false);
    }, (error) => {
      console.error("Error fetching messages: ", error);
      setIsLoadingMessages(false);
    });
    return () => unsubscribeMessages();
  }, [sessionId, showParticipantMirrorView]);

 useEffect(() => {
    if (!showParticipantMirrorView && chatMessagesEndRef.current) {
      chatMessagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, showParticipantMirrorView]);

  // Separate useEffect for mirrored chat view scroll
  useEffect(() => {
    if (showParticipantMirrorView && mirroredChatMessagesEndRef.current) {
      // This depends on the ChatPageContent having its own scroll mechanism and ref
      // For now, we can't directly control its internal scroll.
      // Consider passing a prop to ChatPageContent to trigger scroll if needed.
    }
  }, [showParticipantMirrorView]);


  const copyToClipboard = () => {
    if (displayedInvitationLink && !displayedInvitationLink.includes("Wird generiert...")) {
      navigator.clipboard.writeText(displayedInvitationLink).then(() => {
        toast({ title: "Link kopiert!", description: "Der Einladungslink wurde in die Zwischenablage kopiert." });
      }).catch(err => {
        toast({ variant: "destructive", title: "Fehler", description: "Link konnte nicht kopiert werden." });
      });
    } else {
        toast({ variant: "destructive", title: "Fehler", description: "Einladungslink ist noch nicht bereit."});
    }
  };

  const handleGenerateNewInvitationToken = async () => {
    if (!sessionId || !sessionData) return;
    setIsGeneratingLink(true);
    const newSessionToken = generateToken();
    const sessionDocRef = doc(db, "sessions", sessionId);
    try {
      await updateDoc(sessionDocRef, { invitationToken: newSessionToken });
      toast({ title: "Neuer Einladungslink generiert", description: "Der Token wurde aktualisiert." });
    } catch (error) {
      console.error("Error generating new invitation token: ", error);
      toast({ variant: "destructive", title: "Fehler", description: "Neuer Link-Token konnte nicht generiert werden." });
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const handleStartRestartSession = async () => {
    if (!sessionId || !currentScenario) return;
    setIsStartingOrRestartingSession(true);
    const sessionDocRef = doc(db, "sessions", sessionId);
    let baseLink = sessionData?.invitationLink || "";
    if (typeof window !== "undefined" && !baseLink) {
        baseLink = `${window.location.origin}/join/${sessionId}`;
    }
    const newSessionToken = generateToken();

    const sessionUpdateData: Partial<SessionData> = {
        status: "active",
        messageCooldownSeconds: DEFAULT_COOLDOWN,
        scenarioId: sessionId,
        invitationLink: baseLink,
        invitationToken: newSessionToken,
        createdAt: serverTimestamp(), // Explicitly set new creation/restart time
    };

    try {
        await setDoc(sessionDocRef, sessionUpdateData, { merge: true }); // Use merge to update or create if not exists
        await initializeBotsForSession(currentScenario, sessionId);
        toast({ title: "Sitzung gestartet/aktualisiert", description: "Die Sitzung ist jetzt aktiv mit neuem Link-Token." });
    } catch (error) {
        console.error("Error starting/restarting session: ", error);
        toast({ variant: "destructive", title: "Fehler", description: "Sitzung konnte nicht gestartet/aktualisiert werden." });
    } finally {
        setIsStartingOrRestartingSession(false);
    }
  };

  const handleResetSession = async () => {
    if (!sessionId || !currentScenario) return;
    setIsResettingSession(true);
    const sessionDocRef = doc(db, "sessions", sessionId);
    const participantsColRef = collection(db, "sessions", sessionId, "participants");
    const messagesColRef = collection(db, "sessions", sessionId, "messages");

    try {
      // Delete all messages
      const messagesSnap = await getDocs(messagesColRef);
      if (!messagesSnap.empty) {
          const batchMessages = writeBatch(db);
          messagesSnap.forEach(doc => batchMessages.delete(doc.ref));
          await batchMessages.commit();
      }
      
      // Delete all participants (including bots)
      const participantsSnap = await getDocs(participantsColRef);
      if (!participantsSnap.empty) {
          const batchParticipants = writeBatch(db);
          participantsSnap.forEach(doc => batchParticipants.delete(doc.ref));
          await batchParticipants.commit();
      }

      // Reset session data
      let baseLink = "";
      if (typeof window !== "undefined") {
        baseLink = `${window.location.origin}/join/${sessionId}`;
      }
      const newSessionToken = generateToken();
      const newSessionData: SessionData = {
        scenarioId: sessionId,
        createdAt: serverTimestamp(),
        invitationLink: baseLink,
        invitationToken: newSessionToken,
        status: "active",
        messageCooldownSeconds: DEFAULT_COOLDOWN,
      };
      await setDoc(sessionDocRef, newSessionData); // Overwrite existing session data
      await initializeBotsForSession(currentScenario, sessionId); // Re-initialize bots

      toast({ title: "Sitzung zurückgesetzt", description: "Alle Teilnehmer und Nachrichten wurden gelöscht. Neuer Link-Token generiert." });
    } catch (error) {
      console.error("Error resetting session: ", error);
      toast({ variant: "destructive", title: "Fehler", description: "Sitzung konnte nicht zurückgesetzt werden." });
    } finally {
      setIsResettingSession(false);
    }
  };


  const handleEndSession = async () => {
    if (!sessionId) return;
    setIsEndingSession(true);
    const sessionDocRef = doc(db, "sessions", sessionId);
    try {
      await updateDoc(sessionDocRef, { status: "ended" });
      toast({ title: "Sitzung beendet", description: "Die Sitzung wurde als beendet markiert." });
    } catch (error) {
      console.error("Error ending session: ", error);
      toast({ variant: "destructive", title: "Fehler", description: "Sitzung konnte nicht beendet werden." });
    } finally {
        setIsEndingSession(false);
    }
  };

  const handleToggleSimulationActive = async (isActive: boolean) => {
    if (!sessionId || !sessionData || sessionData.status === "ended") return;
    const newStatus = isActive ? "active" : "paused";
    const sessionDocRef = doc(db, "sessions", sessionId);
    try {
      await updateDoc(sessionDocRef, { status: newStatus });
      toast({ title: "Simulationsstatus geändert", description: `Simulation ist jetzt ${newStatus === 'active' ? 'aktiv' : 'pausiert'}.` });
    } catch (error) {
      console.error("Error toggling simulation active: ", error);
      toast({ variant: "destructive", title: "Fehler", description: "Simulationsstatus konnte nicht geändert werden." });
    }
  };

  const handlePaceChange = async (newPace: number[]) => {
    if (!sessionId || !sessionData || sessionData.status === "ended") return;
    const newCooldown = newPace[0];
    setPaceValue(newCooldown); // Update local state immediately for responsiveness
    const sessionDocRef = doc(db, "sessions", sessionId);
    try {
      await updateDoc(sessionDocRef, { messageCooldownSeconds: newCooldown });
    } catch (error) {
      console.error("Error updating pace: ", error);
      // Optionally revert local state if DB update fails
      // setPaceValue(sessionData.messageCooldownSeconds ?? DEFAULT_COOLDOWN); 
      toast({ variant: "destructive", title: "Fehler", description: "Pace konnte nicht angepasst werden." });
    }
  };

  const handleMuteAllUsers = async () => {
    if (!sessionId || !sessionData || sessionData.status === "ended") return;
    const participantsColRef = collection(db, "sessions", sessionId, "participants");
    const q = query(participantsColRef, where("isBot", "==", false)); // Only mute human participants
    try {
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
          toast({ title: "Keine Teilnehmer zum Stummschalten", description: "Es sind keine menschlichen Teilnehmer in der Sitzung." });
          return;
      }
      const batch = writeBatch(db);
      querySnapshot.forEach((docSnap) => {
        batch.update(docSnap.ref, { isMuted: true });
      });
      await batch.commit();
      toast({ title: "Alle Teilnehmer stummgeschaltet" });
    } catch (error) {
      console.error("Error muting all users: ", error);
      toast({ variant: "destructive", title: "Fehler", description: "Teilnehmer konnten nicht alle stummgeschaltet werden." });
    }
  };

  const handleToggleMuteParticipant = async (participantId: string, currentMuteStatus: boolean | undefined) => {
    if (!sessionId || !sessionData || sessionData.status === "ended") return;
    const participantDocRef = doc(db, "sessions", sessionId, "participants", participantId);
    try {
      await updateDoc(participantDocRef, { isMuted: !currentMuteStatus });
      toast({ title: `Teilnehmer ${!currentMuteStatus ? 'stummgeschaltet' : 'freigeschaltet'}` });
    } catch (error) {
      console.error("Error toggling mute for participant: ", error);
      toast({ variant: "destructive", title: "Fehler", description: "Stummschaltung konnte nicht geändert werden." });
    }
  };

  const handleToggleBotActive = async (botParticipantId: string, currentActiveStatus: boolean) => {
    if (!sessionId || !sessionData || sessionData.status === "ended") return;
    const botDocRef = doc(db, "sessions", sessionId, "participants", botParticipantId);
    try {
      await updateDoc(botDocRef, { "botConfig.isActive": !currentActiveStatus });
      toast({ title: `Bot ${!currentActiveStatus ? 'aktiviert' : 'deaktiviert'}` });
    } catch (error) {
      console.error("Error toggling bot active state: ", error);
      toast({ variant: "destructive", title: "Fehler", description: "Bot-Status konnte nicht geändert werden." });
    }
  };

  const handleBotEscalationChange = async (botParticipantId: string, change: "increase" | "decrease") => {
    if (!sessionId || !sessionData || sessionData.status === "ended") return;
    const botDocRef = doc(db, "sessions", sessionId, "participants", botParticipantId);
    const botParticipant = sessionParticipants.find(p => p.id === botParticipantId);
    if (!botParticipant || !botParticipant.botConfig) return;

    let newEscalation = botParticipant.botConfig.currentEscalation ?? 0;
    if (change === "increase" && newEscalation < 3) newEscalation++;
    if (change === "decrease" && newEscalation > 0) newEscalation--;

    try {
      await updateDoc(botDocRef, { "botConfig.currentEscalation": newEscalation });
    } catch (error) {
      console.error("Error changing bot escalation: ", error);
      toast({ variant: "destructive", title: "Fehler", description: "Bot-Eskalation konnte nicht geändert werden." });
    }
  };

  const handleBotAutoTimerToggle = async (botParticipantId: string, currentAutoTimerStatus: boolean) => {
     if (!sessionId || !sessionData || sessionData.status === "ended") return;
    const botDocRef = doc(db, "sessions", sessionId, "participants", botParticipantId);
    try {
      await updateDoc(botDocRef, { "botConfig.autoTimerEnabled": !currentAutoTimerStatus });
      toast({ title: `Bot Auto-Timer ${!currentAutoTimerStatus ? 'aktiviert' : 'deaktiviert'}` });
    } catch (error) {
      console.error("Error toggling bot auto-timer: ", error);
      toast({ variant: "destructive", title: "Fehler", description: "Bot Auto-Timer konnte nicht geändert werden." });
    }
  };

  const handleBotMissionChange = (botParticipantId: string, mission: string) => {
    setBotMissions(prev => ({ ...prev, [botParticipantId]: mission }));
  };

  const handlePostForBot = async (botParticipant: Participant) => {
    if (!sessionId || !currentScenario || !botParticipant.botConfig || !sessionData) return;
    setIsPostingForBot(botParticipant.id);
    try {
      const chatHistoryMessages = chatMessages
        .slice(-10) // Get last 10 messages for context
        .map(msg => `${msg.senderName}: ${msg.content}`)
        .join('\n');

      const botMessageInput = {
        scenarioContext: currentScenario.langbeschreibung,
        botPersonality: botParticipant.botConfig.personality,
        chatHistory: chatHistoryMessages,
        escalationLevel: botParticipant.botConfig.currentEscalation ?? 0,
        currentMission: botMissions[botParticipant.id] || botParticipant.botConfig.currentMission || "",
      };

      const botResponse = await generateBotMessage(botMessageInput);

      const messagesColRef = collection(db, "sessions", sessionId, "messages");
      const newMessageData: MessageType = {
        id: '', // Firestore will generate ID
        senderUserId: botParticipant.userId,
        senderName: botParticipant.name,
        senderType: 'bot',
        avatarFallback: botParticipant.avatarFallback,
        content: botResponse.message,
        timestamp: serverTimestamp(),
        botFlag: !!botResponse.bot_flag, 
        reactions: {},
      };
      await addDoc(messagesColRef, newMessageData);

      if (botResponse.escalationLevel !== botParticipant.botConfig.currentEscalation) {
        const botDocRef = doc(db, "sessions", sessionId, "participants", botParticipant.id);
        await updateDoc(botDocRef, { "botConfig.currentEscalation": botResponse.escalationLevel });
      }
      // Clear mission for this bot after posting, if desired
      // setBotMissions(prev => ({ ...prev, [botParticipant.id]: "" }));
      toast({ title: `Nachricht von ${botParticipant.name} gesendet.`});

    } catch (error) {
      console.error("Error posting for bot:", error);
      toast({ variant: "destructive", title: "Fehler beim Posten für Bot", description: "Nachricht konnte nicht generiert oder gesendet werden." });
    } finally {
      setIsPostingForBot(null);
    }
  };


  const scenarioTitle = currentScenario?.title || "Szenario wird geladen...";
  // Calculate expected human roles based on scenario.standardRollen and number of defined bots
  const expectedStudentRoles = currentScenario ? currentScenario.standardRollen - (currentScenario.defaultBotsConfig?.length || 0) : 0;


  const displayParticipantsList: Participant[] = [...sessionParticipants];
  if (currentScenario && !isLoadingParticipants && displayParticipantsList.filter(p => !p.isBot).length < expectedStudentRoles) {
    const placeholdersToAdd = expectedStudentRoles - displayParticipantsList.filter(p => !p.isBot).length;

    let placeholderIndex = 0;
    for (let i = 0; i < expectedStudentRoles && placeholderIndex < placeholdersToAdd; i++) {
        const potentialPlaceholderId = `student-placeholder-${String.fromCharCode(65 + i)}`;
        const roleName = `Teilnehmer ${String.fromCharCode(65 + i)}`;
        const isRoleTakenByRealUser = sessionParticipants.some(p => !p.isBot && p.role === roleName);

        if (!isRoleTakenByRealUser) {
             displayParticipantsList.push({
                id: potentialPlaceholderId,
                userId: potentialPlaceholderId,
                name: roleName,
                role: roleName,
                isBot: false,
                status: "Nicht beigetreten",
                avatarFallback: `T${String.fromCharCode(65 + i)}`,
                joinedAt: new Date(0), // Ensure a default joinedAt for sorting if needed
            });
            placeholderIndex++;
        }
    }
  }

  const isSessionEnded = sessionData?.status === "ended";
  const isSessionPaused = sessionData?.status === "paused";
  const isSessionActive = sessionData?.status === "active";
  const isSessionInteractable = !isSessionEnded;

  const getStartRestartButtonText = () => {
    if (isStartingOrRestartingSession) return "Wird ausgeführt...";
    if (!sessionData || sessionData.status === 'ended') return "Sitzung starten";
    if (sessionData.status === 'paused') return "Fortsetzen & Initialisieren";
    return "Neu initialisieren";
  };


  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-2 md:space-y-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-primary">
            Live Dashboard: <span className="text-foreground">{scenarioTitle}</span>
          </h1>
          <p className="text-muted-foreground">Sitzungs-ID: {sessionId}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            onClick={() => setShowParticipantMirrorView(!showParticipantMirrorView)}
            className="bg-primary hover:bg-primary/90"
          >
            <Eye className="mr-2 h-4 w-4" />
            {showParticipantMirrorView ? "Chat-Ansicht ausblenden" : "Chat-Ansicht einblenden"}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={isEndingSession || (!isSessionActive && !isSessionPaused)}>
                <Power className="mr-2 h-4 w-4" /> Sitzung beenden
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Sitzung wirklich beenden?</AlertDialogTitle>
                <AlertDialogDescription>
                  Wenn Sie die Sitzung beenden, können keine weiteren Nachrichten gesendet werden und niemand kann mehr beitreten. Die Daten bleiben erhalten.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                <AlertDialogAction onClick={handleEndSession} disabled={isEndingSession}>
                  {isEndingSession ? "Wird beendet..." : "Beenden"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      <Separator />

      {isSessionEnded && (
        <Card className="border-destructive bg-destructive/10">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center"><AlertCircle className="mr-2"/> Sitzung Beendet</CardTitle>
            <CardDescription className="text-destructive/80">Diese Sitzung wurde beendet. Sie können sie unten neu starten oder zurücksetzen.</CardDescription>
          </CardHeader>
        </Card>
      )}

      {showParticipantMirrorView && (
        <Card className="mt-6 border-primary/50 shadow-lg col-span-1 lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center text-primary"><Eye className="mr-2 h-5 w-5"/> Live Chat-Spiegelung</CardTitle>
            <CardDescription>Hier sehen und interagieren Sie als "Admin" im Live-Chat der Sitzung.</CardDescription>
          </CardHeader>
          <CardContent className="h-[70vh] p-0">
            {sessionId && (
              <ChatPageContent
                sessionId={sessionId}
                initialUserName="Admin"
                initialUserRole="Moderator"
                initialUserId="ADMIN_USER_ID_FIXED" // Ensure this ID is unique and does not clash
                initialUserAvatarFallback="AD"
                isAdminView={true}
              />
            )}
          </CardContent>
        </Card>
      )}


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {!showParticipantMirrorView && (
          <>
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center"><Settings className="mr-2 h-5 w-5 text-primary" /> Sitzungseinstellungen & Einladung</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="font-semibold">Vordefinierte Rollen für dieses Szenario:</Label>
                    <p className="text-sm text-muted-foreground">
                      {currentScenario ? `${expectedStudentRoles} Teilnehmer, ${currentScenario.defaultBotsConfig?.length || 0} Bot(s)` : 'Laden...'}
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="invitation-link" className="font-semibold">Einladungslink:</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input id="invitation-link" type="text" value={isLoadingSessionData ? "Wird geladen..." : displayedInvitationLink} readOnly className="bg-muted" />
                      <Button variant="outline" size="icon" onClick={copyToClipboard} aria-label="Link kopieren" disabled={isLoadingSessionData || displayedInvitationLink.includes("Wird generiert...")}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => alert("QR-Code Anzeige ist noch nicht implementiert.")} disabled={isLoadingSessionData || displayedInvitationLink.includes("Wird generiert...")}>
                        <QrCode className="mr-2 h-4 w-4" /> QR-Code anzeigen
                    </Button>
                    <Button variant="default" onClick={handleGenerateNewInvitationToken} disabled={isLoadingSessionData || isGeneratingLink || !sessionData}>
                        <RefreshCw className="mr-2 h-4 w-4" /> {isGeneratingLink ? "Generiere..." : "Neuen Einladungslink generieren"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center"><MessageSquare className="mr-2 h-5 w-5 text-primary" /> Chat-Verlauf (Admin-Ansicht)</CardTitle>
                  <CardDescription>Beobachten Sie die laufende Diskussion (vereinfachte Ansicht).</CardDescription>
                </CardHeader>
                <CardContent className="h-96 bg-muted/30 rounded-md p-4 overflow-y-auto space-y-2">
                  {isLoadingMessages && <p className="text-sm text-muted-foreground">Chat-Nachrichten werden geladen...</p>}
                  {!isLoadingMessages && chatMessages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <MessageCircleIcon className="w-12 h-12 mb-2 opacity-50" />
                      <p>Noch keine Nachrichten in dieser Sitzung.</p>
                      {isSessionEnded && <p className="mt-1 text-xs">Die Sitzung ist beendet.</p>}
                    </div>
                  )}
                  {!isLoadingMessages && chatMessages.map(msg => (
                    <div key={msg.id} className="text-sm p-2 rounded bg-card/50 shadow-sm">
                      <span className={`font-semibold ${msg.senderType === 'bot' ? 'text-accent' : msg.senderType === 'admin' ? 'text-primary' : 'text-foreground/80'}`}>
                        {msg.senderName}:
                      </span>
                      <span className="ml-1">{msg.content}</span>
                      {msg.imageUrl && <img src={msg.imageUrl} alt="Bild" className="max-w-xs max-h-32 rounded mt-1" data-ai-hint="chat image" />}
                      <span className="text-xs text-muted-foreground/70 float-right pt-1">{msg.timestampDisplay}</span>
                    </div>
                  ))}
                  <div ref={chatMessagesEndRef} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                    <CardTitle className="flex items-center"><Settings className="mr-2 h-5 w-5 text-primary" /> Pace & Allgemeine Steuerung</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Button
                            onClick={handleStartRestartSession}
                            disabled={isStartingOrRestartingSession || isResettingSession}
                            variant={(!sessionData || sessionData.status === 'ended' || sessionData.status === 'paused') ? "default" : "outline"}
                        >
                            {(isStartingOrRestartingSession || isResettingSession) ? null : 
                                ((!sessionData || sessionData.status === 'ended' || sessionData.status === 'paused') ?
                                <Play className="mr-2 h-4 w-4" /> : <RefreshCw className="mr-2 h-4 w-4" />)
                            }
                            {getStartRestartButtonText()}
                        </Button>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" disabled={isStartingOrRestartingSession || isResettingSession || isLoadingSessionData} className="bg-red-700 hover:bg-red-800">
                                    <RotateCcw className="mr-2 h-4 w-4" /> Sitzung zurücksetzen
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Sitzung wirklich komplett zurücksetzen?</AlertDialogTitle>
                                <AlertDialogDescription>
                                Alle Teilnehmer und Nachrichten dieser Sitzung werden dauerhaft gelöscht. Die Sitzung wird mit Standardeinstellungen neu gestartet (inkl. neuem Einladungslink-Token). Diese Aktion kann nicht rückgängig gemacht werden.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel disabled={isResettingSession}>Abbrechen</AlertDialogCancel>
                                <AlertDialogAction onClick={handleResetSession} disabled={isResettingSession} className="bg-destructive hover:bg-destructive/90">
                                    {isResettingSession ? "Wird zurückgesetzt..." : "Ja, zurücksetzen"}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                    <Separator />
                    <div>
                        <Label htmlFor="pace-slider" className="mb-2 block">
                          Nachrichten Cooldown (Verzögerung): <span className="font-bold text-primary">{paceValue}s</span>
                        </Label>
                        <Slider
                            value={[paceValue]}
                            max={30} step={1}
                            id="pace-slider"
                            onValueChange={(value) => setPaceValue(value[0])}
                            onValueCommit={handlePaceChange}
                            disabled={!isSessionInteractable || isStartingOrRestartingSession || isResettingSession}
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <Label htmlFor="simulation-active" className="text-base">
                            Simulation Aktiv <Badge variant={sessionData?.status === 'active' ? "default" : (sessionData?.status === "paused" ? "secondary" : "destructive")}>{sessionData?.status || "Laden..."}</Badge>
                        </Label>
                        <Switch
                            id="simulation-active"
                            checked={sessionData?.status === "active"}
                            onCheckedChange={handleToggleSimulationActive}
                            disabled={!isSessionInteractable || isStartingOrRestartingSession || isResettingSession}
                        />
                    </div>
                     <div className="flex items-center space-x-2">
                        <Button variant="outline" onClick={handleMuteAllUsers} disabled={!isSessionInteractable || isStartingOrRestartingSession || isResettingSession}>
                            <VolumeX className="mr-2 h-4 w-4" /> Alle Stummschalten
                        </Button>
                    </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Users className="mr-2 h-5 w-5 text-primary" />
                    Teilnehmende ({sessionParticipants.filter(p => !p.isBot).length} / {expectedStudentRoles})
                  </CardTitle>
                </CardHeader>
                <CardContent className="max-h-96 overflow-y-auto space-y-3">
                  {isLoadingParticipants && <p className="text-sm text-muted-foreground">Lade Teilnehmer...</p>}
                  {!isLoadingParticipants && displayParticipantsList.filter(p => !p.isBot).map(p => (
                    <div key={p.id || p.userId} className="flex items-center justify-between p-2 bg-muted/20 rounded-md">
                      <div>
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">
                            {p.role} -
                            <span className={p.status === "Nicht beigetreten" ? "italic text-orange-500" : (p.id.startsWith("student-placeholder") ? "italic text-orange-500" : "text-green-500")}>
                                {p.id.startsWith("student-placeholder") ? "Nicht beigetreten" : (p.status || "Beigetreten")}
                            </span>
                             {p.isMuted && <Badge variant="destructive" className="ml-2 text-xs">🔇 Stumm</Badge>}
                        </p>
                      </div>
                      <Button
                        variant={p.isMuted ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => handleToggleMuteParticipant(p.id, p.isMuted)}
                        disabled={!isSessionInteractable || p.id.startsWith("student-placeholder") || isStartingOrRestartingSession || isResettingSession}
                      >
                        {p.isMuted ? <Volume2 className="mr-1 h-4 w-4" /> : <VolumeX className="mr-1 h-4 w-4" />}
                        {p.isMuted ? "Freischalten" : "Stummschalten"}
                      </Button>
                    </div>
                  ))}
                  {!isLoadingParticipants && expectedStudentRoles === 0 && sessionParticipants.filter(p => !p.isBot).length === 0 && (
                    <p className="text-sm text-muted-foreground">Keine Teilnehmer für dieses Szenario vorgesehen.</p>
                  )}
                   {!isLoadingParticipants && displayParticipantsList.filter(p => !p.isBot).length === 0 && expectedStudentRoles > 0 && (
                     <p className="text-sm text-muted-foreground">Noch keine Teilnehmer beigetreten.</p>
                   )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center"><Bot className="mr-2 h-5 w-5 text-primary" /> Bot-Steuerung ({sessionParticipants.filter(p=>p.isBot).length} / {currentScenario?.defaultBotsConfig?.length || 0})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isLoadingParticipants && <p className="text-sm text-muted-foreground">Lade Bot-Konfigurationen...</p>}
                  {!isLoadingParticipants && sessionParticipants.filter(p => p.isBot).map((botParticipant) => {
                     const botConfig = botParticipant.botConfig;
                     if (!botConfig) return null;

                     const botName = botParticipant.name;
                     const botIsActive = botConfig.isActive ?? true;
                     const botEscalation = botConfig.currentEscalation ?? 0;
                     const botAutoTimer = botConfig.autoTimerEnabled ?? false;
                     const currentBotMission = botMissions[botParticipant.id] || botConfig.currentMission || '';

                    return (
                      <div key={botParticipant.id} className="p-3 border rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold">{botName} <Badge variant={botIsActive ? "default" : "outline"}>{botIsActive ? "Aktiv" : "Inaktiv"}</Badge> <span className="text-xs text-muted-foreground">(ID: {botParticipant.botScenarioId || 'N/A'})</span></p>
                          <Switch
                            checked={botIsActive}
                            onCheckedChange={() => handleToggleBotActive(botParticipant.id, botIsActive)}
                            disabled={!isSessionInteractable || isStartingOrRestartingSession || isResettingSession}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Eskalationslevel: {botEscalation}</Label>
                          <Progress value={botEscalation * 33.33} className="h-2" />
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleBotEscalationChange(botParticipant.id, "increase")} disabled={!isSessionInteractable || isStartingOrRestartingSession || isResettingSession || botEscalation >= 3 || !botIsActive}><ChevronUp className="h-4 w-4" /></Button>
                          <Button variant="outline" size="sm" onClick={() => handleBotEscalationChange(botParticipant.id, "decrease")} disabled={!isSessionInteractable || isStartingOrRestartingSession || isResettingSession || botEscalation <= 0 || !botIsActive}><ChevronDown className="h-4 w-4" /></Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="flex-1"
                            onClick={() => handlePostForBot(botParticipant)}
                            disabled={!isSessionInteractable || isStartingOrRestartingSession || isResettingSession || isPostingForBot === botParticipant.id || !botIsActive}
                          >
                            {isPostingForBot === botParticipant.id ? "Postet..." : <><Brain className="mr-2 h-4 w-4" /> Posten</>}
                          </Button>
                        </div>
                        <div>
                          <Label htmlFor={`mission-${botParticipant.id}`} className="text-xs">Spezifische Anweisung/Mission für nächsten Post:</Label>
                          <Input
                            id={`mission-${botParticipant.id}`}
                            type="text"
                            value={currentBotMission}
                            onChange={(e) => handleBotMissionChange(botParticipant.id, e.target.value)}
                            placeholder="z.B. Frage nach Quellen..."
                            className="mt-1 text-xs h-8"
                            disabled={!isSessionInteractable || isStartingOrRestartingSession || isResettingSession || !botIsActive}
                          />
                        </div>
                        <div className="flex items-center space-x-2 pt-1">
                          <Label htmlFor={`autotimer-bot-${botParticipant.id}`} className="text-xs">Auto-Timer</Label>
                          <Switch id={`autotimer-bot-${botParticipant.id}`} checked={botAutoTimer} disabled={!isSessionInteractable || isStartingOrRestartingSession || isResettingSession || !botIsActive} onCheckedChange={() => handleBotAutoTimerToggle(botParticipant.id, botAutoTimer)}/>
                        </div>
                      </div>
                    );
                  })}
                   {(!currentScenario?.defaultBotsConfig || currentScenario.defaultBotsConfig.length === 0) && !isLoadingParticipants && (
                     <p className="text-sm text-muted-foreground">Für dieses Szenario sind keine Bots konfiguriert.</p>
                   )}
                    {!isLoadingParticipants && sessionParticipants.filter(p=>p.isBot).length === 0 && currentScenario && (currentScenario.defaultBotsConfig?.length || 0) > 0 && (
                         <p className="text-sm text-muted-foreground">Bots werden initialisiert...</p>
                    )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                    <CardTitle className="flex items-center"><Download className="mr-2 h-5 w-5 text-primary" /> Datenexport</CardTitle>
                </CardHeader>
                <CardContent>
                    <Button className="w-full" onClick={() => alert("CSV Export gestartet...")} >
                        Chat-Protokoll als CSV herunterladen
                    </Button>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

    