
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AlertCircle, Bot, ChevronDown, ChevronUp, Download, MessageSquare, Play, Pause, QrCode, Users, Settings, Volume2, VolumeX, Copy, MessageCircle as MessageCircleIcon, Power, RotateCcw, RefreshCw, Eye, Brain, NotebookPen, Trash2, UserX, Loader2, ArrowLeft } from "lucide-react"; // Added ArrowLeft
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import type { Scenario, BotConfig, Participant, Message as MessageType, SessionData } from "@/lib/types";
import React, { useEffect, useState, useCallback, useRef } from "react";
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
import Image from 'next/image';


interface AdminSessionDashboardPageProps {
  params: { sessionId: string };
}

interface AdminDashboardMessage extends MessageType {
  id: string;
  timestampDisplay: string;
}

const DEFAULT_COOLDOWN = 0; 

const generateToken = () => Math.random().toString(36).substring(2, 10);


export default function AdminSessionDashboardPage({ params: { sessionId } }: AdminSessionDashboardPageProps) {
  const { toast } = useToast();
  const [currentScenario, setCurrentScenario] = useState<Scenario | undefined>(undefined);
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [sessionParticipants, setSessionParticipants] = useState<Participant[]>([]);
  const [chatMessages, setChatMessages] = useState<AdminDashboardMessage[]>([]);

  const [isLoadingScenario, setIsLoadingScenario] = useState(true);
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
  const [isRemovingParticipant, setIsRemovingParticipant] = useState<string | null>(null);
  const [isRemovingAllParticipants, setIsRemovingAllParticipants] = useState(false);

  const [paceValue, setPaceValue] = useState<number>(DEFAULT_COOLDOWN);
  const chatMessagesEndRef = useRef<null | HTMLDivElement>(null);

  const displayedInvitationLink = sessionData?.invitationLink && sessionData.invitationToken
    ? `${sessionData.invitationLink}?token=${sessionData.invitationToken}`
    : "Wird generiert...";

  // Effect to fetch current scenario from Firestore
  useEffect(() => {
    if (!sessionId) {
      console.error("AdminDashboard: No sessionId provided for scenario fetching.");
      setCurrentScenario(undefined);
      setIsLoadingScenario(false);
      return;
    }
    setIsLoadingScenario(true);
    console.log(`AdminDashboard: Attempting to fetch scenario with ID: ${sessionId}`);
    const scenarioDocRef = doc(db, "scenarios", sessionId);
    
    const unsubscribeScenario = onSnapshot(scenarioDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const foundScenario = { id: docSnap.id, ...docSnap.data() } as Scenario;
        console.log("AdminDashboard: Scenario found/updated in Firestore:", foundScenario);
        setCurrentScenario(foundScenario);
      } else {
        console.error(`AdminDashboard: Scenario with ID "${sessionId}" not found in Firestore during snapshot listener.`);
        toast({ variant: "destructive", title: "Szenario Fehler", description: `Szenario mit ID ${sessionId} nicht gefunden.` });
        setCurrentScenario(undefined);
      }
      setIsLoadingScenario(false);
    }, (error) => {
      console.error(`AdminDashboard: Error fetching scenario ${sessionId} via onSnapshot:`, error);
      toast({ variant: "destructive", title: "Ladefehler Szenario", description: "Szenario konnte nicht geladen werden." });
      setCurrentScenario(undefined);
      setIsLoadingScenario(false);
    });
    
    return () => unsubscribeScenario();
  }, [sessionId, toast]);

  // Effect to setup/ensure the session document in Firestore exists and has link/token
  useEffect(() => {
    if (!sessionId) {
      console.error("AdminDashboard: No sessionId for session document setup.");
      return;
    }
    
    console.log(`AdminDashboard: Running effect to setup session document for sessionId: ${sessionId}`);
    const sessionDocRef = doc(db, "sessions", sessionId);
    
    const ensureSessionDocument = async () => {
      try {
        const docSnap = await getDoc(sessionDocRef);
        let baseLink = "";
        if (typeof window !== "undefined") {
          baseLink = `${window.location.origin}/join/${sessionId}`;
        } else {
          console.warn("AdminDashboard: window is undefined, cannot form baseLink for invitation.");
        }

        if (!docSnap.exists()) {
          console.log(`AdminDashboard: Session document for ${sessionId} does not exist. Creating...`);
          const newSessionToken = generateToken();
          const newSessionData: SessionData = {
            scenarioId: sessionId, // Link to the scenario
            createdAt: serverTimestamp() as Timestamp,
            invitationLink: baseLink,
            invitationToken: newSessionToken,
            status: "active",
            messageCooldownSeconds: DEFAULT_COOLDOWN,
          };
          await setDoc(sessionDocRef, newSessionData);
          console.log(`AdminDashboard: New session document created for ${sessionId}.`);
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
           if (existingData.scenarioId !== sessionId) {
              updates.scenarioId = sessionId;
              needsDbUpdate = true;
          }
          if(typeof existingData.messageCooldownSeconds === 'undefined'){
              updates.messageCooldownSeconds = DEFAULT_COOLDOWN;
              needsDbUpdate = true;
          }

          if (needsDbUpdate) {
            console.log(`AdminDashboard: Updating session document for ${sessionId} with:`, updates);
            await updateDoc(sessionDocRef, updates);
          } else {
            // console.log(`AdminDashboard: Session document for ${sessionId} is up to date regarding link/token.`);
          }
        }
      } catch (error) {
        console.error(`AdminDashboard: Error managing session document for ${sessionId}:`, error);
        toast({ variant: "destructive", title: "Firestore Fehler", description: "Sitzungsdokument konnte nicht initialisiert werden." });
      }
    };
    
    ensureSessionDocument();
  }, [sessionId, toast]); // Runs when sessionId changes

  // Effect to listen for real-time sessionData changes from Firestore (e.g., status, cooldown, token)
  useEffect(() => {
    if (!sessionId) {
      console.log("AdminDashboard: No sessionId, skipping sessionData listener setup.");
      setSessionData(null);
      setIsLoadingSessionData(false);
      return;
    }
    setIsLoadingSessionData(true);
    const sessionDocRef = doc(db, "sessions", sessionId);
    console.log(`AdminDashboard: Setting up onSnapshot listener for sessionData: sessions/${sessionId}`);
    const unsubscribeSessionData = onSnapshot(sessionDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as SessionData;
        console.log("AdminDashboard: SessionData snapshot received:", data);
        setSessionData(data);
        setPaceValue(data.messageCooldownSeconds ?? DEFAULT_COOLDOWN);
      } else {
        console.log(`AdminDashboard: No session document found for ${sessionId} in onSnapshot. A new one might be created by another effect.`);
        setSessionData(null); 
      }
      setIsLoadingSessionData(false);
    }, (error) => {
      console.error("AdminDashboard: Error listening to session data: ", error);
      toast({ variant: "destructive", title: "Firestore Fehler", description: "Sitzungsstatus konnte nicht geladen werden." });
      setIsLoadingSessionData(false);
    });
    return () => {
      console.log(`AdminDashboard: Cleaning up onSnapshot listener for sessionData: sessions/${sessionId}`);
      unsubscribeSessionData();
    }
  }, [sessionId, toast]);
  
  const getBotDisplayName = useCallback((botConfig: BotConfig, scenarioBotsConfig: BotConfig[] = [], index?: number): string => {
    if (botConfig.name) return botConfig.name;
    const nameSuffix = scenarioBotsConfig.length > 1 && index !== undefined ? ` ${index + 1}` : "";
    // Default personalities if not provided in config (should not happen with proper scenario setup)
    const personality = botConfig.personality || 'standard';
    switch (personality) {
      case 'provokateur': return `Bot Provokateur${nameSuffix}`;
      case 'verteidiger': return `Bot Verteidiger${nameSuffix}`;
      case 'informant': return `Bot Informant${nameSuffix}`;
      default: return `Bot Standard${nameSuffix}`;
    }
  }, []);
  
  const initializeBotsForSession = useCallback(async (scenarioToInit: Scenario, sId: string) => {
    if (!scenarioToInit || !scenarioToInit.defaultBotsConfig) {
      console.log("AdminDashboard: initializeBotsForSession - Scenario data or bot config missing for scenario ID:", sId);
      return;
    }
    console.log(`AdminDashboard: Initializing bots for scenario: ${scenarioToInit.title} (ID: ${sId})`);
    const scenarioBotsConfig = scenarioToInit.defaultBotsConfig || [];
    const participantsColRef = collection(db, "sessions", sId, "participants");
    const batch = writeBatch(db);
  
    const existingBotsQuery = query(participantsColRef, where("isBot", "==", true));
    const existingBotsSnap = await getDocs(existingBotsQuery);
    const firestoreBotsMap = new Map(existingBotsSnap.docs.map(d => [d.data().botScenarioId, d.id]));
    const firestoreBotScenarioIdsOnDb = new Set(existingBotsSnap.docs.map(d => d.data().botScenarioId));
    const scenarioBotConfigIds = new Set(scenarioBotsConfig.map(bc => bc.id));
  
    firestoreBotScenarioIdsOnDb.forEach(dbBotScenarioId => {
      if (!scenarioBotConfigIds.has(dbBotScenarioId)) {
        const docIdToDelete = firestoreBotsMap.get(dbBotScenarioId);
        if (docIdToDelete) {
          const botDocRef = doc(participantsColRef, docIdToDelete);
          batch.delete(botDocRef);
          console.log(`AdminDashboard: Deleting bot with ScenarioID: ${dbBotScenarioId} (DocID: ${docIdToDelete}) as it's no longer in scenario config.`);
        }
      }
    });
  
    for (const [index, botConfig] of scenarioBotsConfig.entries()) {
      if (!botConfig || typeof botConfig !== 'object') {
        console.error("AdminDashboard: Invalid bot configuration found:", botConfig);
        continue;
      }
      
      const botScenarioId = botConfig.id; 
      if (!botScenarioId) {
        console.error("AdminDashboard: Bot config is missing a unique id:", botConfig);
        continue; 
      }
  
      const botDisplayName = getBotDisplayName(botConfig, scenarioBotsConfig, index);
      const botParticipantData: Omit<Participant, 'id' | 'joinedAt'> & { joinedAt?: any } = {
        userId: `bot-${botScenarioId}`, 
        name: botDisplayName,
        role: `Bot (${botConfig.personality || 'standard'})`,
        avatarFallback: botConfig.avatarFallback || (botConfig.personality || 'standard').substring(0, 2).toUpperCase(),
        isBot: true,
        status: "Aktiv",
        botConfig: {
          ...botConfig, 
          isActive: botConfig.isActive ?? true,
          currentEscalation: botConfig.currentEscalation ?? 0,
          autoTimerEnabled: botConfig.autoTimerEnabled ?? false,
          currentMission: botConfig.initialMission || "", 
          initialMission: botConfig.initialMission || "",
        },
        botScenarioId: botScenarioId, 
      };
  
      const existingBotDocId = firestoreBotsMap.get(botScenarioId);
  
      if (!existingBotDocId) {
        const newBotDocRef = doc(collection(db, "sessions", sId, "participants"));
        batch.set(newBotDocRef, { ...botParticipantData, id: newBotDocRef.id, joinedAt: serverTimestamp() });
        console.log(`AdminDashboard: Adding new bot: ${botParticipantData.name} (ScenarioID: ${botScenarioId}) to session ${sId}`);
      } else {
        const botDocRef = doc(participantsColRef, existingBotDocId);
        // Prepare update data carefully to avoid overwriting botConfig with partial data if not all fields are present in botConfig from scenario
        const updateData: Partial<Participant> & { [key: string]: any } = {
            name: botDisplayName,
            role: `Bot (${botConfig.personality || 'standard'})`,
            avatarFallback: botConfig.avatarFallback || (botConfig.personality || 'standard').substring(0, 2).toUpperCase(),
            'botConfig.personality': botConfig.personality || 'standard',
            'botConfig.isActive': botConfig.isActive ?? true,
            'botConfig.currentEscalation': botConfig.currentEscalation ?? 0,
            'botConfig.autoTimerEnabled': botConfig.autoTimerEnabled ?? false,
            'botConfig.initialMission': botConfig.initialMission || "",
            // Only update currentMission if it's explicitly in the scenario's botConfig,
            // otherwise, let the existing currentMission (potentially set by admin) persist.
            // However, for re-initialization, it's better to reset to initialMission.
            'botConfig.currentMission': botConfig.initialMission || "",
        };
        batch.update(botDocRef, updateData);
        console.log(`AdminDashboard: Updating existing bot: ${botParticipantData.name} (ScenarioID: ${botScenarioId}) in session ${sId}`);
      }
    }
    try {
        await batch.commit();
        console.log(`AdminDashboard: Bot initialization/update batch commit successful for session ${sId}.`);
    } catch (e) {
        console.error(`AdminDashboard: Error committing bot initialization batch for session ${sId}:`, e);
    }
  }, [getBotDisplayName]);

  // Effect to initialize bots when currentScenario is loaded and valid
  useEffect(() => {
    if (currentScenario && sessionId && !isLoadingScenario) {
      console.log("AdminDashboard: Scenario data available, initializing/updating bots for session:", sessionId);
      initializeBotsForSession(currentScenario, sessionId);
    } else if (!isLoadingScenario && !currentScenario) {
        console.log("AdminDashboard: Scenario not loaded or invalid, cannot initialize bots for session:", sessionId);
    }
  }, [currentScenario, sessionId, isLoadingScenario, initializeBotsForSession]);


  useEffect(() => {
    if (!sessionId) return;
    setIsLoadingParticipants(true);
    const participantsColRef = collection(db, "sessions", sessionId, "participants");
    // Sorting by isBot (desc) then joinedAt (asc) to show bots first, then users by join time
    const participantsQuery = query(participantsColRef, orderBy("isBot", "desc"), orderBy("joinedAt", "asc")); 
    const unsubscribeParticipants = onSnapshot(participantsQuery, (querySnapshot) => {
      let fetchedParticipants: Participant[] = [];
      querySnapshot.forEach((docSn) => {
        fetchedParticipants.push({ id: docSn.id, ...docSn.data() } as Participant);
      });
      setSessionParticipants(fetchedParticipants);
      setIsLoadingParticipants(false);
    }, (error) => {
      console.error("AdminDashboard: Error fetching participants: ", error);
      setIsLoadingParticipants(false);
      toast({ variant: "destructive", title: "Fehler Teilnehmerliste", description: "Teilnehmer konnten nicht geladen werden." });
    });
    return () => unsubscribeParticipants();
  }, [sessionId, toast]);

  useEffect(() => {
    if (!sessionId || showParticipantMirrorView) { 
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
      console.error("AdminDashboard: Error fetching messages: ", error);
      setIsLoadingMessages(false);
      toast({ variant: "destructive", title: "Fehler Chatverlauf", description: "Nachrichten konnten nicht geladen werden." });
    });
    return () => unsubscribeMessages();
  }, [sessionId, showParticipantMirrorView, toast]);


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
      console.error("AdminDashboard: Error generating new invitation token: ", error);
      toast({ variant: "destructive", title: "Fehler", description: "Neuer Link-Token konnte nicht generiert werden." });
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const handleStartRestartSession = async () => {
    if (!sessionId || !currentScenario) { 
        toast({variant: "destructive", title: "Aktion fehlgeschlagen", description: "Szenarioinformationen sind noch nicht geladen."});
        return;
    }
    setIsStartingOrRestartingSession(true);
    const sessionDocRef = doc(db, "sessions", sessionId);
    let baseLink = "";
     if (typeof window !== "undefined") {
        baseLink = `${window.location.origin}/join/${sessionId}`;
    }
    const newSessionToken = generateToken();

    const sessionUpdateData: Partial<SessionData> = {
        status: "active",
        messageCooldownSeconds: DEFAULT_COOLDOWN,
        scenarioId: sessionId, 
        invitationLink: baseLink,
        invitationToken: newSessionToken,
        createdAt: serverTimestamp() as Timestamp, 
    };

    try {
        await setDoc(sessionDocRef, sessionUpdateData, { merge: true }); 
        await initializeBotsForSession(currentScenario, sessionId);
        toast({ title: "Sitzung gestartet/aktualisiert", description: "Die Sitzung ist jetzt aktiv mit neuem Link-Token." });
    } catch (error) {
        console.error("AdminDashboard: Error starting/restarting session: ", error);
        toast({ variant: "destructive", title: "Fehler", description: "Sitzung konnte nicht gestartet/aktualisiert werden." });
    } finally {
        setIsStartingOrRestartingSession(false);
    }
  };

  const handleResetSession = async () => {
    if (!sessionId || !currentScenario) { 
        toast({variant: "destructive", title: "Aktion fehlgeschlagen", description: "Szenarioinformationen sind noch nicht geladen."});
        return;
    }
    setIsResettingSession(true);
    const sessionDocRef = doc(db, "sessions", sessionId);
    const participantsColRef = collection(db, "sessions", sessionId, "participants");
    const messagesColRef = collection(db, "sessions", sessionId, "messages");

    try {
      const messagesSnap = await getDocs(messagesColRef);
      if (!messagesSnap.empty) {
          const batchMessages = writeBatch(db);
          messagesSnap.forEach(messageDoc => batchMessages.delete(messageDoc.ref));
          await batchMessages.commit();
          console.log("AdminDashboard: All messages deleted for session reset.");
      }
      
      const participantsSnap = await getDocs(participantsColRef);
      if (!participantsSnap.empty) {
          const batchParticipants = writeBatch(db);
          participantsSnap.forEach(participantDoc => batchParticipants.delete(participantDoc.ref));
          await batchParticipants.commit();
          console.log("AdminDashboard: All participants deleted for session reset.");
      }

      let baseLink = "";
      if (typeof window !== "undefined") {
        baseLink = `${window.location.origin}/join/${sessionId}`;
      }
      const newSessionToken = generateToken();
      const newSessionData: SessionData = {
        scenarioId: sessionId,
        createdAt: serverTimestamp() as Timestamp,
        invitationLink: baseLink,
        invitationToken: newSessionToken,
        status: "active",
        messageCooldownSeconds: DEFAULT_COOLDOWN,
      };
      await setDoc(sessionDocRef, newSessionData); 
      await initializeBotsForSession(currentScenario, sessionId); 

      toast({ title: "Sitzung zurückgesetzt", description: "Alle Teilnehmer und Nachrichten wurden gelöscht. Neuer Link-Token generiert." });
    } catch (error) {
      console.error("AdminDashboard: Error resetting session: ", error);
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
      console.error("AdminDashboard: Error ending session: ", error);
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
      console.error("AdminDashboard: Error toggling simulation active: ", error);
      toast({ variant: "destructive", title: "Fehler", description: "Simulationsstatus konnte nicht geändert werden." });
    }
  };

  const handlePaceChange = async (newPaceValues: number[]) => {
    if (!sessionId || !sessionData || sessionData.status === "ended") return;
    const newCooldown = newPaceValues[0];
    const sessionDocRef = doc(db, "sessions", sessionId);
    try {
      await updateDoc(sessionDocRef, { messageCooldownSeconds: newCooldown });
    } catch (error) {
      console.error("AdminDashboard: Error updating pace: ", error);
      toast({ variant: "destructive", title: "Fehler", description: "Pace konnte nicht angepasst werden." });
    }
  };
  

  const handleMuteAllUsers = async () => {
    if (!sessionId || !sessionData || sessionData.status === "ended") return;
    const participantsColRef = collection(db, "sessions", sessionId, "participants");
    const q = query(participantsColRef, where("isBot", "==", false)); 
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
      console.error("AdminDashboard: Error muting all users: ", error);
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
      console.error("AdminDashboard: Error toggling mute for participant: ", error);
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
      console.error("AdminDashboard: Error toggling bot active state: ", error);
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
      console.error("AdminDashboard: Error changing bot escalation: ", error);
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
      console.error("AdminDashboard: Error toggling bot auto-timer: ", error);
      toast({ variant: "destructive", title: "Fehler", description: "Bot Auto-Timer konnte nicht geändert werden." });
    }
  };

  const handleBotMissionChange = (botParticipantId: string, mission: string) => {
    setBotMissions(prev => ({ ...prev, [botParticipantId]: mission }));
  };
  
  const handleUpdateBotMissionInFirestore = async (botParticipantId: string, mission: string) => {
    if (!sessionId) return;
    const botDocRef = doc(db, "sessions", sessionId, "participants", botParticipantId);
    try {
      await updateDoc(botDocRef, { "botConfig.currentMission": mission });
    } catch (error) {
      console.error("AdminDashboard: Error updating bot mission in Firestore: ", error);
      toast({ variant: "destructive", title: "Fehler", description: "Bot-Mission konnte nicht gespeichert werden." });
    }
  };


  const handlePostForBot = async (botParticipant: Participant) => {
    if (!sessionId || !currentScenario || !botParticipant.botConfig || !sessionData) {
        toast({variant: "destructive", title: "Aktion fehlgeschlagen", description: "Notwendige Daten für Bot-Post fehlen."});
        return;
    }
    setIsPostingForBot(botParticipant.id);
    
    const missionForThisPost = botMissions[botParticipant.id] || botParticipant.botConfig.currentMission || "";
    if (botMissions[botParticipant.id] && botMissions[botParticipant.id] !== botParticipant.botConfig.currentMission) {
        await handleUpdateBotMissionInFirestore(botParticipant.id, botMissions[botParticipant.id]);
    }

    try {
      const chatHistoryMessages = chatMessages
        .slice(-10) 
        .map(msg => `${msg.senderName}: ${msg.content}`)
        .join('\n');

      const botMessageInput = {
        scenarioContext: currentScenario.langbeschreibung || "Allgemeiner Chat.", // Fallback
        botPersonality: botParticipant.botConfig.personality || 'standard', // Fallback
        chatHistory: chatHistoryMessages,
        escalationLevel: botParticipant.botConfig.currentEscalation ?? 0,
        currentMission: missionForThisPost,
      };

      console.log("AdminDashboard: Generating bot message with input:", JSON.stringify(botMessageInput, null, 2));
      const botResponse = await generateBotMessage(botMessageInput);
      console.log("AdminDashboard: Bot response received:", botResponse);

      const messagesColRef = collection(db, "sessions", sessionId, "messages");
      const newMessageData: MessageType = {
        id: '', 
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

      if (typeof botResponse.escalationLevel === 'number' && botResponse.escalationLevel !== botParticipant.botConfig.currentEscalation) {
        const botDocRef = doc(db, "sessions", sessionId, "participants", botParticipant.id);
        await updateDoc(botDocRef, { "botConfig.currentEscalation": botResponse.escalationLevel });
      }
      toast({ title: `Nachricht von ${botParticipant.name} gesendet.`});

    } catch (error: any) {
      console.error("AdminDashboard: Error posting for bot:", error);
      toast({ variant: "destructive", title: "Fehler beim Posten für Bot", description: error.message || "Nachricht konnte nicht generiert oder gesendet werden." });
    } finally {
      setIsPostingForBot(null);
    }
  };


  const handleRemoveParticipant = async (participantId: string) => {
    if (!sessionId) return;
    setIsRemovingParticipant(participantId);
    try {
      const participantDocRef = doc(db, "sessions", sessionId, "participants", participantId);
      await deleteDoc(participantDocRef);
      toast({ title: "Teilnehmer entfernt", description: "Der Teilnehmer wurde erfolgreich aus der Sitzung entfernt." });
    } catch (error) {
      console.error("AdminDashboard: Error removing participant: ", error);
      toast({ variant: "destructive", title: "Fehler", description: "Teilnehmer konnte nicht entfernt werden." });
    } finally {
      setIsRemovingParticipant(null);
    }
  };

  const handleRemoveAllParticipants = async () => {
    if (!sessionId) return;
    setIsRemovingAllParticipants(true);
    try {
      const participantsColRef = collection(db, "sessions", sessionId, "participants");
      const q = query(participantsColRef, where("isBot", "==", false));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        toast({ title: "Keine Teilnehmer", description: "Es sind keine menschlichen Teilnehmer zum Entfernen vorhanden." });
        setIsRemovingAllParticipants(false);
        return;
      }
      const batch = writeBatch(db);
      querySnapshot.forEach((docSnapshot) => {
        batch.delete(docSnapshot.ref);
      });
      await batch.commit();
      toast({ title: "Alle Teilnehmer entfernt", description: "Alle menschlichen Teilnehmer wurden aus der Sitzung entfernt." });
    } catch (error) {
      console.error("AdminDashboard: Error removing all participants: ", error);
      toast({ variant: "destructive", title: "Fehler", description: "Teilnehmer konnten nicht entfernt werden." });
    } finally {
      setIsRemovingAllParticipants(false);
    }
  };


  const handleDownloadCsv = () => {
    if (!chatMessages.length) {
      toast({ title: "Keine Daten", description: "Es gibt keine Nachrichten zum Exportieren." });
      return;
    }

    const participantMap = new Map(sessionParticipants.map(p => [p.userId, p]));

    const headers = [
      "Message ID", "Timestamp", "Sender UserID", "Sender Name", "Sender Role", "Sender Type",
      "Content", "Image URL", "Image File Name",
      "ReplyToMessageID", "ReplyToMessageSenderName", "ReplyToMessageContentSnippet",
      "Reactions", "Bot Flag"
    ];

    const rows = chatMessages.map(msg => {
      const sender = participantMap.get(msg.senderUserId);
      const senderRole = sender ? sender.role : "Unbekannt";
      
      const reactionsArray = msg.reactions ? Object.entries(msg.reactions).map(([emoji, userIds]) => `${emoji}:${userIds.length}`) : [];
      const reactionsString = reactionsArray.join(", ");

      const escapeCsvField = (field: any): string => {
        if (field === null || typeof field === 'undefined') return "";
        let stringField = String(field);
        if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
          stringField = `"${stringField.replace(/"/g, '""')}"`;
        }
        return stringField;
      };

      return [
        escapeCsvField(msg.id),
        escapeCsvField(msg.timestamp instanceof Timestamp ? msg.timestamp.toDate().toLocaleString('de-DE') : String(msg.timestamp)),
        escapeCsvField(msg.senderUserId),
        escapeCsvField(msg.senderName),
        escapeCsvField(senderRole),
        escapeCsvField(msg.senderType),
        escapeCsvField(msg.content),
        escapeCsvField(msg.imageUrl || ""),
        escapeCsvField(msg.imageFileName || ""),
        escapeCsvField(msg.replyToMessageId || ""),
        escapeCsvField(msg.replyToMessageSenderName || ""),
        escapeCsvField(msg.replyToMessageContentSnippet || ""),
        escapeCsvField(reactionsString),
        escapeCsvField(msg.botFlag ? "Ja" : "Nein")
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `chatsim_session_${sessionId}_log_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: "CSV Export gestartet", description: "Der Download sollte in Kürze beginnen." });
    } else {
        toast({ variant: "destructive", title: "Export fehlgeschlagen", description: "Ihr Browser unterstützt diese Funktion nicht." });
    }
  };


  const scenarioTitle = currentScenario?.title || "Szenario wird geladen...";
  const expectedStudentRoles = currentScenario ? (currentScenario.humanRolesConfig?.length || 0) : 0;


  const displayParticipantsList: Participant[] = [...sessionParticipants];
  if (currentScenario && !isLoadingParticipants && displayParticipantsList.filter(p => !p.isBot).length < expectedStudentRoles) {
    const placeholdersToAdd = expectedStudentRoles - displayParticipantsList.filter(p => !p.isBot).length;
    const existingRoleNames = new Set(sessionParticipants.filter(p => !p.isBot).map(p => p.role));

    let placeholderIndex = 0;
    (currentScenario.humanRolesConfig || []).forEach(roleConfig => {
        if (placeholderIndex < placeholdersToAdd && !existingRoleNames.has(roleConfig.name)) {
             displayParticipantsList.push({
                id: `student-placeholder-${roleConfig.id || placeholderIndex}`,
                userId: `student-placeholder-${roleConfig.id || placeholderIndex}`,
                name: roleConfig.name, 
                role: roleConfig.name,
                isBot: false,
                status: "Nicht beigetreten",
                avatarFallback: roleConfig.name.substring(0,2).toUpperCase(),
                joinedAt: new Date(0), 
            });
            placeholderIndex++;
        }
    });
  }


  const isSessionEnded = sessionData?.status === "ended";
  const isSessionActive = sessionData?.status === "active";
  const isSessionInteractable = !isSessionEnded;

  const getStartRestartButtonText = () => {
    if (isStartingOrRestartingSession) return "Wird ausgeführt...";
    if (!sessionData || sessionData.status === 'ended') return "Sitzung starten";
    if (sessionData.status === 'paused') return "Fortsetzen & Initialisieren";
    return "Neu initialisieren";
  };

  if (isLoadingScenario) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <Card className="w-full max-w-md">
          <CardHeader><CardTitle>Lade Szenariodaten...</CardTitle></CardHeader>
          <CardContent className="flex items-center justify-center py-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary mr-3" />
            <p>Szenario wird geladen...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isLoadingScenario && !currentScenario) {
     return (
      <div className="flex flex-col items-center justify-center h-full p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center"><AlertCircle className="mr-2"/> Szenario nicht geladen</CardTitle>
            <CardDescription>Das Szenario mit der ID "{sessionId}" konnte nicht aus der Datenbank geladen werden oder existiert nicht. Bitte überprüfen Sie die ID oder wählen Sie ein anderes Szenario.</CardDescription>
            </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/admin')} variant="outline"> {/* Changed to router.push */}
              <ArrowLeft className="mr-2 h-4 w-4"/> Zurück zur Szenarienübersicht
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }


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
              <Button variant="destructive" disabled={isEndingSession || (!sessionData?.status || sessionData.status === 'ended')}>
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
                  {isEndingSession ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : "Beenden"}
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
                initialUserId="ADMIN_USER_ID_FIXED" 
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
                      <Input id="invitation-link" type="text" value={isLoadingSessionData ? "Lade Sitzungsdaten..." : displayedInvitationLink} readOnly className="bg-muted" />
                      <Button variant="outline" size="icon" onClick={copyToClipboard} aria-label="Link kopieren" disabled={isLoadingSessionData || displayedInvitationLink.includes("Wird generiert...") || displayedInvitationLink.includes("Lade")}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => alert("QR-Code Anzeige ist noch nicht implementiert.")} disabled={isLoadingSessionData || displayedInvitationLink.includes("Wird generiert...") || displayedInvitationLink.includes("Lade")}>
                        <QrCode className="mr-2 h-4 w-4" /> QR-Code anzeigen
                    </Button>
                    <Button variant="default" onClick={handleGenerateNewInvitationToken} disabled={isLoadingSessionData || isGeneratingLink || !sessionData}>
                        <RefreshCw className="mr-2 h-4 w-4" /> {isGeneratingLink ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : "Neuen Einladungslink generieren"}
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
                  {isLoadingMessages && <div className="flex items-center justify-center h-full text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mr-2"/> <p>Lade Chat...</p></div>}
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
                      {msg.imageUrl && 
                        <div className="mt-1">
                            <Image src={msg.imageUrl} alt="Bild im Chat" width={200} height={150} className="rounded max-w-xs max-h-32 object-contain" data-ai-hint="chat image"/>
                        </div>
                      }
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
                            disabled={isStartingOrRestartingSession || isResettingSession || isLoadingScenario || !currentScenario}
                            variant={(!sessionData || sessionData.status === 'ended' || sessionData.status === 'paused') ? "default" : "outline"}
                        >
                            {isStartingOrRestartingSession ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : 
                                ((!sessionData || sessionData.status === 'ended' || sessionData.status === 'paused') ?
                                <Play className="mr-2 h-4 w-4" /> : <RefreshCw className="mr-2 h-4 w-4" />)
                            }
                            {getStartRestartButtonText()}
                        </Button>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" disabled={isStartingOrRestartingSession || isResettingSession || isLoadingSessionData || isLoadingScenario || !currentScenario} className="bg-red-700 hover:bg-red-800">
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
                                    {isResettingSession ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : "Ja, zurücksetzen"}
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
                            Simulation Aktiv <Badge variant={sessionData?.status === 'active' ? 'default' : (sessionData?.status === "paused" ? "secondary" : "destructive")} 
                                                className={sessionData?.status === 'active' ? 'bg-green-500 hover:bg-green-600' : (sessionData?.status === "paused" ? 'bg-amber-500 hover:bg-amber-600' : 'bg-red-500 hover:bg-red-600')}
                                            >
                                            {sessionData?.status === 'active' ? <Play className="mr-1.5 h-3.5 w-3.5"/> : (sessionData?.status === "paused" ? <Pause className="mr-1.5 h-3.5 w-3.5"/> : <Power className="mr-1.5 h-3.5 w-3.5"/>)}
                                            {sessionData?.status || (isLoadingSessionData ? "Laden..." : "Unbekannt")}
                                        </Badge>
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
                         <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" className="bg-orange-600 hover:bg-orange-700" disabled={!isSessionInteractable || isRemovingAllParticipants || isLoadingParticipants}>
                                    <UserX className="mr-2 h-4 w-4" /> Alle Teilnehmer entfernen
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Alle Teilnehmer wirklich entfernen?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Alle menschlichen Teilnehmer werden aus dieser Sitzung entfernt. Bots bleiben bestehen. Diese Aktion kann nicht rückgängig gemacht werden.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel disabled={isRemovingAllParticipants}>Abbrechen</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleRemoveAllParticipants} disabled={isRemovingAllParticipants} className="bg-destructive hover:bg-destructive/90">
                                        {isRemovingAllParticipants ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : "Ja, alle entfernen"}
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
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
                  {isLoadingParticipants && <div className="flex items-center justify-center h-full text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mr-2"/> <p>Lade Teilnehmer...</p></div>}
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
                      <div className="flex items-center gap-1">
                        <Button
                            variant={p.isMuted ? "secondary" : "outline"}
                            size="sm"
                            onClick={() => handleToggleMuteParticipant(p.id, p.isMuted)}
                            disabled={!isSessionInteractable || p.id.startsWith("student-placeholder") || isStartingOrRestartingSession || isResettingSession}
                        >
                            {p.isMuted ? <Volume2 className="mr-1 h-4 w-4" /> : <VolumeX className="mr-1 h-4 w-4" />}
                            {p.isMuted ? "Frei" : "Stumm"}
                        </Button>
                        {!p.id.startsWith("student-placeholder") && (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 h-8 w-8" 
                                 disabled={!isSessionInteractable || isRemovingParticipant === p.id || isStartingOrRestartingSession || isResettingSession}>
                                    {isRemovingParticipant === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Teilnehmer "{p.name}" wirklich entfernen?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Diese Aktion kann nicht rückgängig gemacht werden. Der Teilnehmer wird aus der Sitzung entfernt.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel disabled={isRemovingParticipant === p.id}>Abbrechen</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleRemoveParticipant(p.id)} disabled={isRemovingParticipant === p.id} className="bg-destructive hover:bg-destructive/90">
                                        {isRemovingParticipant === p.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : "Ja, entfernen"}
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                        )}
                      </div>
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
                  {isLoadingParticipants && <div className="flex items-center justify-center h-full text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mr-2"/> <p>Lade Bots...</p></div>}
                  {!isLoadingParticipants && sessionParticipants.filter(p => p.isBot).map((botParticipant) => {
                     const botConfig = botParticipant.botConfig;
                     if (!botConfig) return <p key={botParticipant.id} className="text-xs text-red-500">Bot-Konfiguration für {botParticipant.name} fehlt!</p>;

                     const botName = botParticipant.name;
                     const botIsActive = botConfig.isActive ?? true;
                     const botEscalation = botConfig.currentEscalation ?? 0;
                     const botAutoTimer = botConfig.autoTimerEnabled ?? false;
                     const currentBotMission = botMissions[botParticipant.id] || botConfig.currentMission || "";

                    return (
                      <div key={botParticipant.id} className="p-3 border rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold">{botName} <Badge variant={botIsActive ? "default" : "outline"} className={botIsActive ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-400 hover:bg-gray-500'}>{botIsActive ? "Aktiv" : "Inaktiv"}</Badge> <span className="text-xs text-muted-foreground">(ID: {botParticipant.botScenarioId || 'N/A'})</span></p>
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
                            {isPostingForBot === botParticipant.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <><Brain className="mr-2 h-4 w-4" /> Posten</>}
                          </Button>
                        </div>
                        <div>
                          <Label htmlFor={`mission-${botParticipant.id}`} className="text-xs">Spezifische Anweisung/Mission für nächsten Post:</Label>
                          <Input
                            id={`mission-${botParticipant.id}`}
                            type="text"
                            value={currentBotMission}
                            onChange={(e) => handleBotMissionChange(botParticipant.id, e.target.value)}
                            onBlur={() => handleUpdateBotMissionInFirestore(botParticipant.id, currentBotMission)} 
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
                    <Button className="w-full" onClick={handleDownloadCsv} disabled={chatMessages.length === 0}>
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

    