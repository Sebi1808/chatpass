
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AlertCircle, Bot, ChevronDown, ChevronUp, Download, MessageSquare, Play, Pause, QrCode, Users, Settings, Volume2, VolumeX, Copy, MessageCircle as MessageCircleIcon, Power, RotateCcw, RefreshCw, Eye, Brain, NotebookPen, Trash2, UserX, Loader2, ArrowLeft, Wand2, LayoutDashboard, Sparkles, AlertTriangle, CheckCircle, Users2, LogIn, PlayCircle, History, Clock, Lock, Unlock } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import type { Scenario, BotConfig, Participant, Message as MessageType, SessionData, ScenarioEvent, HumanRoleConfig } from "@/lib/types";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/firebase";
import { doc, setDoc, getDoc, serverTimestamp, collection, onSnapshot, query, orderBy, Timestamp, updateDoc, writeBatch, getDocs, where, deleteDoc, addDoc } from "firebase/firestore";
import Link from 'next/link';
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
import { useRouter } from 'next/navigation';
import { cn } from "@/lib/utils";


interface AdminSessionDashboardPageProps {
  params: { sessionId: string };
}

interface AdminDashboardMessage extends MessageType {
  id: string;
  timestampDisplay: string;
}

const DEFAULT_COOLDOWN = 0; 

const generateToken = () => Math.random().toString(36).substring(2, 10);


export default function AdminSessionDashboardPage(props: AdminSessionDashboardPageProps) {
  const { sessionId } = props.params;
  const { toast } = useToast();
  const router = useRouter();

  const [currentScenario, setCurrentScenario] = useState<Scenario | null>(null);
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [sessionParticipants, setSessionParticipants] = useState<Participant[]>([]);
  const [chatMessages, setChatMessages] = useState<AdminDashboardMessage[]>([]);

  const [isLoadingScenario, setIsLoadingScenario] = useState(true);
  const [isLoadingSessionData, setIsLoadingSessionData] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(true);
  
  const [pageError, setPageError] = useState<string | null>(null);
  
  const isLoadingPage = isLoadingScenario || isLoadingSessionData; 

  const [isEndingSession, setIsEndingSession] = useState(false);
  const [isProcessingSessionAction, setIsProcessingSessionAction] = useState(false);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [showParticipantMirrorView, setShowParticipantMirrorView] = useState(false);
  const [isPostingForBot, setIsPostingForBot] = useState<string | null>(null);
  const [botMissions, setBotMissions] = useState<Record<string, string>>({});
  const [isRemovingParticipant, setIsRemovingParticipant] = useState<string | null>(null);
  const [isRemovingAllParticipants, setIsRemovingAllParticipants] = useState(false);
  const [simulationStartingCountdown, setSimulationStartingCountdown] = useState<number | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [paceValue, setPaceValue] = useState<number>(DEFAULT_COOLDOWN);
  const adminChatPreviewEndRef = useRef<null | HTMLDivElement>(null);


  // Load Scenario
  useEffect(() => {
    if (!sessionId) {
      setPageError("Keine Szenario-ID für das Dashboard vorhanden.");
      setIsLoadingScenario(false);
      return;
    }
    setIsLoadingScenario(true);
    setPageError(null);
    const scenarioDocRef = doc(db, "scenarios", sessionId);

    console.log("AdminDashboard: Attempting to load scenario:", sessionId);
    getDoc(scenarioDocRef).then(docSnap => {
      if (docSnap.exists()) {
        console.log("AdminDashboard: Scenario found:", docSnap.data());
        setCurrentScenario({ id: docSnap.id, ...docSnap.data() } as Scenario);
      } else {
        console.error(`AdminDashboard: Scenario with ID ${sessionId} not found.`);
        setPageError(`Szenario mit ID ${sessionId} nicht gefunden. Bitte überprüfen Sie die ID oder erstellen Sie das Szenario neu.`);
        setCurrentScenario(null);
      }
    }).catch(error => {
      console.error(`AdminDashboard: Error fetching scenario ${sessionId}:`, error);
      setPageError("Szenario konnte nicht geladen werden. Fehler: " + error.message);
      setCurrentScenario(null);
    }).finally(() => {
      setIsLoadingScenario(false);
    });
  }, [sessionId]);

  // Ensure and Listen to Session Document
  useEffect(() => {
    if (!sessionId || !currentScenario) { // Wait for scenario to be loaded
        setIsLoadingSessionData(false);
        if (!currentScenario && !isLoadingScenario) { // If scenario loading finished and it's null
            // Error already set by scenario loading effect
        }
        return;
    }
    setIsLoadingSessionData(true);
    const sessionDocRef = doc(db, "sessions", sessionId);

    const ensureSessionDocument = async () => {
      try {
        const docSnap = await getDoc(sessionDocRef);
        const updates: Partial<SessionData> = { scenarioId: currentScenario.id };
        let needsUpdate = false;
        let isNewDoc = false;

        if (!docSnap.exists()) {
          isNewDoc = true;
          updates.createdAt = serverTimestamp() as Timestamp;
          updates.status = "pending"; 
          updates.messageCooldownSeconds = DEFAULT_COOLDOWN;
          updates.invitationToken = generateToken();
          if (typeof window !== "undefined") {
            updates.invitationLink = `${window.location.origin}/join/${sessionId}`;
          } else {
            updates.invitationLink = `/join/${sessionId}`; // Fallback for server-side
          }
          updates.roleSelectionLocked = false;
          updates.simulationStartCountdownEndTime = null;
          needsUpdate = true;
          console.log(`AdminDashboard: Session document for ${sessionId} does not exist. Creating new one with status 'pending'.`);
        } else {
          const data = docSnap.data() as SessionData;
          if (!data.invitationToken) {
            updates.invitationToken = generateToken();
            needsUpdate = true;
          }
          let baseLink = "";
           if (typeof window !== "undefined") {
            baseLink = `${window.location.origin}/join/${sessionId}`;
          } else {
            baseLink = `/join/${sessionId}`;
          }
          if (!data.invitationLink || data.invitationLink !== baseLink) {
            updates.invitationLink = baseLink;
            needsUpdate = true;
          }
           if (data.scenarioId !== currentScenario.id) { // Ensure scenarioId is correct
            updates.scenarioId = currentScenario.id;
            needsUpdate = true;
          }
          if (typeof data.roleSelectionLocked === 'undefined') {
            updates.roleSelectionLocked = false;
            needsUpdate = true;
          }
           if (typeof data.simulationStartCountdownEndTime === 'undefined') {
            updates.simulationStartCountdownEndTime = null;
            needsUpdate = true;
          }
        }

        if (needsUpdate) {
          updates.updatedAt = serverTimestamp() as Timestamp;
          if (isNewDoc) {
             await setDoc(sessionDocRef, updates);
          } else {
             await updateDoc(sessionDocRef, updates);
          }
          console.log(`AdminDashboard: ${isNewDoc ? 'New session document created' : 'Session document updated'} for ${sessionId}.`);
        }
      } catch (error: any) {
        console.error(`AdminDashboard: Error managing session document for ${sessionId}:`, error);
        setPageError(prev => prev || `Sitzungsdokument konnte nicht initialisiert/aktualisiert werden: ${error.message}`);
        toast({variant: "destructive", title: "Sitzungsfehler", description: `Sitzungsdokument konnte nicht erstellt/aktualisiert werden.`});
      }
    };

    ensureSessionDocument(); 

    const unsubscribe = onSnapshot(sessionDocRef, (docSn) => {
      if (docSn.exists()) {
        const data = docSn.data() as SessionData;
        setSessionData(data);
        setPaceValue(data.messageCooldownSeconds ?? DEFAULT_COOLDOWN);
      } else {
        setSessionData(null); 
        if (!isLoadingSessionData) { 
            // console.warn(`AdminDashboard: Session document ${sessionId} still does not exist after attempt to create/update.`);
        }
      }
      setIsLoadingSessionData(false);
    }, (error: any) => {
      console.error(`AdminDashboard: Error listening to session data for ${sessionId}:`, error);
      setPageError(prev => prev || `Sitzungsstatus konnte nicht geladen werden: ${error.message}`);
      setIsLoadingSessionData(false);
    });
    
    return () => unsubscribe();
  }, [sessionId, currentScenario, isLoadingScenario]); 

  const displayedInvitationLink = sessionData?.invitationLink && sessionData.invitationToken
    ? `${sessionData.invitationLink}?token=${sessionData.invitationToken}`
    : "Wird generiert...";

  const getBotDisplayName = useCallback((botConfig: BotConfig, index: number): string => {
    if (botConfig.name && botConfig.name.trim() !== "") return botConfig.name;
    const scenarioBotsCount = currentScenario?.defaultBotsConfig?.length || 1;
    const nameSuffix = scenarioBotsCount > 1 ? ` ${index + 1}` : "";
    const personality = botConfig.personality || 'standard';
    switch (personality) {
      case 'provokateur': return `Bot Provokateur${nameSuffix}`;
      case 'verteidiger': return `Bot Verteidiger${nameSuffix}`;
      case 'informant': return `Bot Informant${nameSuffix}`;
      default: return `Bot Standard${nameSuffix}`;
    }
  }, [currentScenario?.defaultBotsConfig?.length]);

  const initializeBotsForSession = useCallback(async () => {
    if (!currentScenario || !currentScenario.defaultBotsConfig || !sessionId || !sessionData) {
      console.warn(`AdminDashboard: initializeBotsForSession: Prerequisites missing for session ID: ${sessionId}. Scenario or sessionData not loaded.`);
      return;
    }
    console.log(`AdminDashboard: Initializing/syncing bots for scenario: ${currentScenario.title} (Session ID: ${sessionId})`);
    setIsProcessingSessionAction(true);
    
    const scenarioBotsConfig = currentScenario.defaultBotsConfig || [];
    const participantsColRef = collection(db, "sessions", sessionId, "participants");
    const batch = writeBatch(db);
    let operationsInBatch = 0;

    const existingBotsQuery = query(participantsColRef, where("isBot", "==", true));
    const existingBotsSnap = await getDocs(existingBotsQuery);
    const firestoreBotsMap = new Map(existingBotsSnap.docs.map(d => [d.data().botScenarioId, {docId: d.id, data: d.data() as Participant}]));
    const configBotScenarioIds = new Set(scenarioBotsConfig.map(bc => bc.id));

    // Delete bots from Firestore that are no longer in scenario config
    firestoreBotsMap.forEach((botDetails, botScenarioIdInDb) => {
      if (!configBotScenarioIds.has(botScenarioIdInDb)) {
        console.log(`AdminDashboard: Deleting bot (Firestore ID: ${botDetails.docId}, Scenario Bot ID: ${botScenarioIdInDb}) as it's not in current config.`);
        batch.delete(doc(participantsColRef, botDetails.docId));
        operationsInBatch++;
      }
    });

    for (const [index, botConfig] of scenarioBotsConfig.entries()) {
      const botScenarioId = botConfig.id; 
      if (!botScenarioId) {
        console.error("AdminDashboard: Bot config is missing a unique id (from scenario.defaultBotsConfig):", botConfig);
        continue; 
      }
      const botDisplayName = getBotDisplayName(botConfig, index);
      
      const botDataForFirestoreBase: Omit<Participant, 'id' | 'joinedAt' | 'botConfig'> & { botConfig: BotConfig } = {
        userId: `bot-${botScenarioId}`, 
        realName: botDisplayName, // Using realName for bot's actual name
        displayName: botDisplayName, // Nickname is the same for bots
        role: `Bot (${botConfig.personality || 'standard'})`,
        avatarFallback: botConfig.avatarFallback || (botConfig.name || botConfig.personality.substring(0,1) + (botConfig.id || 'X').substring(0,1)).substring(0, 2).toUpperCase() || "BT",
        isBot: true,
        status: "Aktiv", 
        botScenarioId: botScenarioId,
        botConfig: { 
          ...botConfig, 
          name: botDisplayName, 
          isActive: botConfig.isActive ?? true,
          currentEscalation: botConfig.currentEscalation ?? 0,
          autoTimerEnabled: botConfig.autoTimerEnabled ?? false,
          initialMission: botConfig.initialMission || "",
          currentMission: botConfig.currentMission || botConfig.initialMission || "", 
        },
      };

      const existingBotDetails = firestoreBotsMap.get(botScenarioId);
      if (!existingBotDetails) {
        console.log(`AdminDashboard: Adding new bot (Scenario Bot ID: ${botScenarioId}) to session.`);
        const newBotDocRef = doc(collection(db, "sessions", sessionId, "participants")); 
        batch.set(newBotDocRef, { ...botDataForFirestoreBase, id: newBotDocRef.id, joinedAt: serverTimestamp() as Timestamp });
        operationsInBatch++;
      } else {
        console.log(`AdminDashboard: Updating existing bot (Scenario Bot ID: ${botScenarioId}, Firestore ID: ${existingBotDetails.docId}).`);
        const botDocRef = doc(participantsColRef, existingBotDetails.docId);
        const existingBotData = existingBotDetails.data;
        
        const currentMissionToPreserve = botMissions[existingBotDetails.docId] || existingBotData?.botConfig?.currentMission || botConfig.initialMission || "";
        
        const updatedBotConfig: BotConfig = {
            ...botConfig, 
            name: botDisplayName, 
            isActive: botConfig.isActive ?? existingBotData?.botConfig?.isActive ?? true, 
            currentEscalation: botConfig.currentEscalation ?? existingBotData?.botConfig?.currentEscalation ?? 0,
            autoTimerEnabled: botConfig.autoTimerEnabled ?? existingBotData?.botConfig?.autoTimerEnabled ?? false,
            initialMission: botConfig.initialMission || "",
            currentMission: currentMissionToPreserve, 
            id: botScenarioId, 
        };
        batch.update(botDocRef, { 
            realName: botDisplayName,
            displayName: botDisplayName, 
            role: `Bot (${botConfig.personality || 'standard'})`, 
            avatarFallback: botDataForFirestoreBase.avatarFallback, 
            botConfig: updatedBotConfig, 
            botScenarioId: botScenarioId 
        });
        operationsInBatch++;
      }
    }
    if (operationsInBatch > 0) {
        try {
            await batch.commit();
            console.log(`AdminDashboard: Bot initialization/sync batch committed for session ${sessionId} with ${operationsInBatch} operations.`);
            toast({ title: "Bots initialisiert/synchronisiert", description: `${operationsInBatch} Bot-Operationen durchgeführt.`});
        } catch (e: any) {
            console.error(`AdminDashboard: Error committing bot initialization/sync batch for session ${sessionId}:`, e);
            toast({ variant: "destructive", title: "Bot Fehler", description: `Bots konnten nicht initialisiert/synchronisiert werden: ${e.message}`});
        }
    } else {
        console.log(`AdminDashboard: No bot changes needed for session ${sessionId}.`);
    }
    setIsProcessingSessionAction(false);
  }, [sessionId, currentScenario, sessionData, getBotDisplayName, toast, botMissions]);

  // Load Participants
  useEffect(() => {
    if (!sessionId || pageError || isLoadingScenario || isLoadingSessionData) {
      setIsLoadingParticipants(false);
      return;
    }
    setIsLoadingParticipants(true);
    const participantsColRef = collection(db, "sessions", sessionId, "participants");
    // Sort client-side after fetch
    const q_participants = query(participantsColRef, orderBy("joinedAt", "asc"));
    
    const unsubscribeParticipants = onSnapshot(q_participants, (querySnapshot) => {
      let fetchedParticipants: Participant[] = [];
      querySnapshot.forEach((docSn) => {
        fetchedParticipants.push({ id: docSn.id, ...docSn.data() } as Participant);
      });

      // Client-side sort: bots first, then humans by joinedAt
      fetchedParticipants.sort((a, b) => {
        if (a.isBot && !b.isBot) return -1;
        if (!a.isBot && b.isBot) return 1;
        const timeA = a.joinedAt instanceof Timestamp ? a.joinedAt.toMillis() : (a.joinedAt && typeof (a.joinedAt as any).seconds === 'number' ? (a.joinedAt as any).seconds * 1000 : 0);
        const timeB = b.joinedAt instanceof Timestamp ? b.joinedAt.toMillis() : (b.joinedAt && typeof (b.joinedAt as any).seconds === 'number' ? (b.joinedAt as any).seconds * 1000 : 0);
        return timeA - timeB;
      });
      
      setSessionParticipants(fetchedParticipants);
      
      const newBotMissionsState: Record<string, string> = {};
      fetchedParticipants.filter(p => p.isBot && p.botConfig).forEach(bot => {
        newBotMissionsState[bot.id] = bot.botConfig!.currentMission || bot.botConfig!.initialMission || "";
      });
      setBotMissions(prevMissions => {
        const updatedMissions = {...prevMissions};
        for (const botId in newBotMissionsState) {
            if (!updatedMissions[botId] || updatedMissions[botId] === (fetchedParticipants.find(p=>p.id===botId)?.botConfig?.initialMission || "")) {
                 updatedMissions[botId] = newBotMissionsState[botId];
            }
        }
        return updatedMissions;
      });

      setIsLoadingParticipants(false);
    }, (error) => {
      console.error(`Error fetching participants for session ${sessionId}:`, error);
      setIsLoadingParticipants(false);
      setPageError(prevError => prevError || `Teilnehmer konnten nicht geladen werden: ${error.message}`);
    });
    return () => unsubscribeParticipants();
  }, [sessionId, pageError, isLoadingScenario, isLoadingSessionData]);

  // Load Messages
  useEffect(() => {
    if (!sessionId || showParticipantMirrorView || pageError || isLoadingScenario || isLoadingSessionData) { 
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
      console.error(`Error fetching messages for session ${sessionId}:`, error);
      setIsLoadingMessages(false);
      setPageError(prevError => prevError || "Nachrichten konnten nicht geladen werden.");
    });
    return () => unsubscribeMessages();
  }, [sessionId, showParticipantMirrorView, pageError, isLoadingScenario, isLoadingSessionData]); 

  useEffect(() => {
    if (!showParticipantMirrorView && adminChatPreviewEndRef.current) {
      adminChatPreviewEndRef.current.scrollIntoView({ behavior: "auto" }); 
    }
  }, [chatMessages, showParticipantMirrorView]);

  const copyToClipboard = useCallback(() => {
    if (displayedInvitationLink && !displayedInvitationLink.includes("Wird generiert...")) {
      navigator.clipboard.writeText(displayedInvitationLink).then(() => {
        toast({ title: "Link kopiert!", description: "Der Einladungslink wurde in die Zwischenablage kopiert." });
      }).catch(err => {
        toast({ variant: "destructive", title: "Fehler", description: "Link konnte nicht kopiert werden." });
      });
    } else {
        toast({ variant: "destructive", title: "Fehler", description: "Einladungslink ist noch nicht bereit."});
    }
  }, [displayedInvitationLink, toast]);

  const handleGenerateNewInvitationToken = useCallback(async () => {
    if (!sessionId || !sessionData) return;
    setIsGeneratingLink(true);
    const newSessionToken = generateToken();
    const sessionDocRef = doc(db, "sessions", sessionId);
    try {
      await updateDoc(sessionDocRef, { invitationToken: newSessionToken, updatedAt: serverTimestamp() });
      toast({ title: "Neuer Einladungslink generiert", description: "Der Token wurde aktualisiert." });
    } catch (error: any) {
      console.error(`Error generating new invitation token for session ${sessionId}:`, error);
      toast({ variant: "destructive", title: "Fehler", description: `Neuer Link-Token konnte nicht generiert werden: ${error.message}` });
    } finally {
      setIsGeneratingLink(false);
    }
  }, [sessionId, sessionData, toast]);


  const handleOpenSessionForJoining = useCallback(async () => {
    if (!sessionId || !currentScenario || !sessionData) {
        toast({variant: "destructive", title: "Aktion fehlgeschlagen", description: "Sitzungs- oder Szenariodaten fehlen."});
        return;
    }
    if (sessionData.status !== "pending") {
        toast({variant: "destructive", title: "Aktion nicht möglich", description: `Sitzung ist bereits ${sessionData.status}.`});
        return;
    }
    setIsProcessingSessionAction(true);
    const sessionDocRef = doc(db, "sessions", sessionId);
    try {
        await updateDoc(sessionDocRef, { status: "open", updatedAt: serverTimestamp() });
        await initializeBotsForSession(); 
        toast({ title: "Sitzung für Beitritt geöffnet", description: "Teilnehmer können jetzt dem Wartebereich beitreten." });
    } catch (error: any) {
        console.error(`Error opening session ${sessionId} for joining:`, error);
        toast({ variant: "destructive", title: "Fehler", description: `Sitzung konnte nicht geöffnet werden: ${error.message}` });
    } finally {
        setIsProcessingSessionAction(false);
    }
  }, [sessionId, currentScenario, sessionData, initializeBotsForSession, toast]);


  const handleStartChatSimulation = useCallback(async () => {
    if (!sessionId || !sessionData || sessionData.status !== "open") {
        toast({variant: "destructive", title: "Aktion fehlgeschlagen", description: "Sitzung ist nicht bereit zum Starten (Status muss 'open' sein)."});
        return;
    }
    setIsProcessingSessionAction(true);
    
    try {
        const sessionDocRef = doc(db, "sessions", sessionId);
        const countdownDurationSeconds = 10;
        const targetTime = new Date();
        targetTime.setSeconds(targetTime.getSeconds() + countdownDurationSeconds);
        const countdownEndTime = Timestamp.fromDate(targetTime);

        await updateDoc(sessionDocRef, { 
            roleSelectionLocked: true, 
            simulationStartCountdownEndTime: countdownEndTime,
            updatedAt: serverTimestamp() 
        });
        
        setSimulationStartingCountdown(countdownDurationSeconds);
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

        countdownIntervalRef.current = setInterval(async () => {
            setSimulationStartingCountdown(prev => {
                if (prev === null || prev <= 1) {
                    clearInterval(countdownIntervalRef.current!);
                    // Final action: Set session to active
                    updateDoc(sessionDocRef, { status: "active", updatedAt: serverTimestamp() })
                        .then(() => toast({ title: "Chat-Simulation gestartet!", description: "Der Chat ist jetzt aktiv." }))
                        .catch(err => {
                            console.error("Error setting session to active:", err);
                            toast({ variant: "destructive", title: "Startfehler", description: "Konnte Sitzung nicht auf 'active' setzen."});
                        });
                    setIsProcessingSessionAction(false);
                    return null;
                }
                return prev - 1;
            });
        }, 1000);

    } catch (error: any) {
        console.error(`Error initiating chat simulation start for session ${sessionId}:`, error);
        toast({ variant: "destructive", title: "Fehler", description: `Simulationsstart konnte nicht initiiert werden: ${error.message}` });
        setIsProcessingSessionAction(false);
    }
  }, [sessionId, sessionData, toast]);


  useEffect(() => { 
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, []);


  const handleResetSession = useCallback(async () => {
    if (!sessionId || !currentScenario) {
        toast({variant: "destructive", title: "Aktion fehlgeschlagen", description: "Sitzungs- oder Szenariodaten fehlen."});
        return;
    }
    setIsProcessingSessionAction(true);
    const sessionDocRef = doc(db, "sessions", sessionId);
    const participantsColRef = collection(db, "sessions", sessionId, "participants");
    const messagesColRef = collection(db, "sessions", sessionId, "messages");

    try {
      const batchReset = writeBatch(db);
      const messagesSnap = await getDocs(messagesColRef);
      messagesSnap.forEach(messageDoc => batchReset.delete(messageDoc.ref));
      const participantsSnap = await getDocs(participantsColRef);
      participantsSnap.forEach(participantDoc => batchReset.delete(participantDoc.ref));
      await batchReset.commit();

      let baseLink = "";
      if (typeof window !== "undefined") {
        baseLink = `${window.location.origin}/join/${sessionId}`;
      }
      const newSessionToken = generateToken();
      const newSessionDataToSet: Partial<SessionData> = { // Use partial for setDoc with merge:true or full for setDoc overwrite
        scenarioId: currentScenario.id,
        createdAt: serverTimestamp() as Timestamp,
        invitationLink: baseLink,
        invitationToken: newSessionToken,
        status: "pending", // Reset to pending
        messageCooldownSeconds: DEFAULT_COOLDOWN,
        updatedAt: serverTimestamp() as Timestamp,
        roleSelectionLocked: false,
        simulationStartCountdownEndTime: null,
      };
      await setDoc(sessionDocRef, newSessionDataToSet); 
      setSessionParticipants([]); 
      setChatMessages([]); 
      toast({ title: "Sitzung zurückgesetzt", description: "Alle Teilnehmer und Nachrichten wurden gelöscht. Sitzung ist im 'pending'-Status." });
    } catch (error: any) {
      console.error(`Error resetting session ${sessionId}:`, error);
      toast({ variant: "destructive", title: "Fehler", description: `Sitzung konnte nicht zurückgesetzt werden: ${error.message}` });
    } finally {
      setIsProcessingSessionAction(false);
    }
  }, [sessionId, currentScenario, toast]);


  const handleEndSession = useCallback(async () => {
    if (!sessionId) return;
    setIsEndingSession(true);
    setIsProcessingSessionAction(true);
    const sessionDocRef = doc(db, "sessions", sessionId);
    try {
      await updateDoc(sessionDocRef, { status: "ended", updatedAt: serverTimestamp() });
      toast({ title: "Sitzung beendet", description: "Die Sitzung wurde als beendet markiert." });
    } catch (error: any) {
      console.error(`Error ending session ${sessionId}:`, error);
      toast({ variant: "destructive", title: "Fehler", description: `Sitzung konnte nicht beendet werden: ${error.message}` });
    } finally {
        setIsEndingSession(false);
        setIsProcessingSessionAction(false);
    }
  }, [sessionId, toast]);

  const handleToggleSimulationActive = useCallback(async (isActive: boolean) => {
    if (!sessionId || !sessionData || (sessionData.status !== "active" && sessionData.status !== "paused")) return;
    const newStatus = isActive ? "active" : "paused";
    if (sessionData.status === newStatus) return; 

    setIsProcessingSessionAction(true);
    const sessionDocRef = doc(db, "sessions", sessionId);
    try {
      await updateDoc(sessionDocRef, { status: newStatus, updatedAt: serverTimestamp() });
      toast({ title: "Simulationsstatus geändert", description: `Simulation ist jetzt ${newStatus === 'active' ? 'aktiv' : 'pausiert'}.` });
    } catch (error: any) {
      console.error(`Error toggling simulation active for session ${sessionId}:`, error);
      toast({ variant: "destructive", title: "Fehler", description: `Simulationsstatus konnte nicht geändert werden: ${error.message}` });
    } finally {
      setIsProcessingSessionAction(false);
    }
  }, [sessionId, sessionData, toast]);

  const handlePaceChangeCommit = useCallback(async (newPaceValues: number[]) => {
    if (!sessionId || !sessionData || sessionData.status === "ended") return;
    const newCooldown = newPaceValues[0];
    setPaceValue(newCooldown); 
    const sessionDocRef = doc(db, "sessions", sessionId);
    try {
      await updateDoc(sessionDocRef, { messageCooldownSeconds: newCooldown, updatedAt: serverTimestamp() });
    } catch (error: any) {
      console.error(`Error updating pace for session ${sessionId}:`, error);
      toast({ variant: "destructive", title: "Fehler", description: `Pace konnte nicht angepasst werden: ${error.message}` });
    }
  }, [sessionId, sessionData, toast]);


  const handleMuteAllUsers = useCallback(async () => {
    if (!sessionId || !sessionData || sessionData.status === "ended") return;
    const participantsColRef = collection(db, "sessions", sessionId, "participants");
    const q = query(participantsColRef, where("isBot", "==", false));
    try {
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
          toast({ title: "Keine Teilnehmer zum Stummschalten", description: "Es sind keine menschlichen Teilnehmer in der Sitzung." });
          return;
      }
      const batchMute = writeBatch(db);
      querySnapshot.forEach((docSnap) => {
        batchMute.update(docSnap.ref, { isMuted: true });
      });
      await batchMute.commit();
      toast({ title: "Alle Teilnehmer stummgeschaltet" });
    } catch (error: any) {
      console.error(`Error muting all users for session ${sessionId}:`, error);
      toast({ variant: "destructive", title: "Fehler", description: `Teilnehmer konnten nicht alle stummgeschaltet werden: ${error.message}` });
    }
  }, [sessionId, sessionData, toast]);

  const handleToggleMuteParticipant = useCallback(async (participantId: string, currentMuteStatus: boolean | undefined) => {
    if (!sessionId || !sessionData || sessionData.status === "ended") return;
    const participantDocRef = doc(db, "sessions", sessionId, "participants", participantId);
    try {
      await updateDoc(participantDocRef, { isMuted: !currentMuteStatus });
      toast({ title: `Teilnehmer ${!currentMuteStatus ? 'stummgeschaltet' : 'freigeschaltet'}` });
    } catch (error: any) {
      console.error(`Error toggling mute for participant ${participantId} in session ${sessionId}:`, error);
      toast({ variant: "destructive", title: "Fehler", description: `Stummschaltung konnte nicht geändert werden: ${error.message}` });
    }
  }, [sessionId, sessionData, toast]);

  const handleToggleBotActive = useCallback(async (botParticipantId: string, currentActiveStatus: boolean | undefined) => {
    if (!sessionId || !sessionData || sessionData.status === "ended" || typeof currentActiveStatus === 'undefined') return;
    const botDocRef = doc(db, "sessions", sessionId, "participants", botParticipantId);
    try {
      await updateDoc(botDocRef, { "botConfig.isActive": !currentActiveStatus });
      toast({ title: `Bot ${!currentActiveStatus ? 'aktiviert' : 'deaktiviert'}` });
    } catch (error: any) {
      console.error(`Error toggling bot active state for bot ${botParticipantId} in session ${sessionId}:`, error);
      toast({ variant: "destructive", title: "Fehler", description: `Bot-Status konnte nicht geändert werden: ${error.message}` });
    }
  },[sessionId, sessionData, toast]);

  const handleBotEscalationChange = useCallback(async (botParticipantId: string, change: "increase" | "decrease") => {
    if (!sessionId || !sessionData || sessionData.status === "ended") return;
    const botDocRef = doc(db, "sessions", sessionId, "participants", botParticipantId);
    const botParticipant = sessionParticipants.find(p => p.id === botParticipantId);
    if (!botParticipant || !botParticipant.botConfig) return;

    let newEscalation = botParticipant.botConfig.currentEscalation ?? 0;
    if (change === "increase" && newEscalation < 3) newEscalation++;
    if (change === "decrease" && newEscalation > 0) newEscalation--;

    try {
      await updateDoc(botDocRef, { "botConfig.currentEscalation": newEscalation });
    } catch (error: any) {
      console.error(`Error changing bot escalation for bot ${botParticipantId} in session ${sessionId}:`, error);
      toast({ variant: "destructive", title: "Fehler", description: `Bot-Eskalation konnte nicht geändert werden: ${error.message}` });
    }
  }, [sessionId, sessionData, sessionParticipants, toast]);

  const handleBotAutoTimerToggle = useCallback(async (botParticipantId: string, currentAutoTimerStatus: boolean | undefined) => {
     if (!sessionId || !sessionData || sessionData.status === "ended" || typeof currentAutoTimerStatus === 'undefined') return;
    const botDocRef = doc(db, "sessions", sessionId, "participants", botParticipantId);
    try {
      await updateDoc(botDocRef, { "botConfig.autoTimerEnabled": !currentAutoTimerStatus });
      toast({ title: `Bot Auto-Timer ${!currentAutoTimerStatus ? 'aktiviert' : 'deaktiviert'}` });
    } catch (error: any) {
      console.error(`Error toggling bot auto-timer for bot ${botParticipantId} in session ${sessionId}:`, error);
      toast({ variant: "destructive", title: "Fehler", description: `Bot Auto-Timer konnte nicht geändert werden: ${error.message}` });
    }
  }, [sessionId, sessionData, toast]);

  const handleBotMissionChange = useCallback((botParticipantId: string, mission: string) => {
    setBotMissions(prev => ({ ...prev, [botParticipantId]: mission }));
  }, []);

  const handleUpdateBotMissionInFirestore = useCallback(async (botParticipantId: string) => {
    if (!sessionId) return;
    const missionToSave = botMissions[botParticipantId];
    if (typeof missionToSave === 'undefined') {
        console.warn("AdminDashboard: Mission to save for bot " + botParticipantId + " is undefined.");
        return;
    }
    const botDocRef = doc(db, "sessions", sessionId, "participants", botParticipantId);
    const botParticipant = sessionParticipants.find(p => p.id === botParticipantId);

    try {
      if (botParticipant && botParticipant.botConfig) {
        const updatedBotConfig = { ...botParticipant.botConfig, currentMission: missionToSave };
        await updateDoc(botDocRef, { "botConfig": updatedBotConfig });
        toast({ title: "Bot-Mission aktualisiert."});
      } else {
         toast({ variant: "destructive", title: "Fehler Bot-Mission", description: "Bot-Konfiguration nicht gefunden." });
      }
    } catch (error: any) {
      console.error(`Error updating bot mission in Firestore for bot ${botParticipantId} in session ${sessionId}:`, error);
      toast({ variant: "destructive", title: "Fehler Bot-Mission", description: `Bot-Mission konnte nicht gespeichert werden: ${error.message}` });
    }
  }, [sessionId, toast, botMissions, sessionParticipants]);


  const handlePostForBot = useCallback(async (botParticipant: Participant) => {
    if (!sessionId || !currentScenario || !botParticipant.botConfig || !sessionData) {
        toast({variant: "destructive", title: "Aktion fehlgeschlagen", description: "Notwendige Daten für Bot-Post fehlen."});
        return;
    }
    setIsPostingForBot(botParticipant.id);
    
    const missionForThisPost = botParticipant.botConfig.currentMission || botParticipant.botConfig.initialMission || "";

    try {
      const chatHistoryMessages = chatMessages
        .slice(-10) 
        .map(msg => `${msg.senderName}: ${msg.content}`)
        .join('\n');

      const botMessageInput = {
        scenarioContext: currentScenario.langbeschreibung || "Allgemeiner Chat.",
        botPersonality: botParticipant.botConfig.personality || 'standard',
        chatHistory: chatHistoryMessages,
        escalationLevel: botParticipant.botConfig.currentEscalation ?? 0,
        currentMission: missionForThisPost,
      };

      const botResponse = await generateBotMessage(botMessageInput);

      const messagesColRef = collection(db, "sessions", sessionId, "messages");
      const newMessageData: Omit<MessageType, 'id'> = { 
        senderUserId: botParticipant.userId,
        senderName: botParticipant.displayName, // Use displayName
        senderType: 'bot',
        avatarFallback: botParticipant.avatarFallback,
        content: botResponse.message,
        timestamp: serverTimestamp() as Timestamp,
        botFlag: !!botResponse.bot_flag, 
        reactions: {},
      };
      await addDoc(messagesColRef, newMessageData);

      if (typeof botResponse.escalationLevel === 'number' && botResponse.escalationLevel !== botParticipant.botConfig.currentEscalation) {
        const botDocRef = doc(db, "sessions", sessionId, "participants", botParticipant.id);
        const updatedBotConfig = botParticipant.botConfig 
            ? { ...botParticipant.botConfig, currentEscalation: botResponse.escalationLevel }
            : { currentEscalation: botResponse.escalationLevel, id: botParticipant.botScenarioId || "", name: botParticipant.displayName, personality: 'standard' }; 
        await updateDoc(botDocRef, { "botConfig": updatedBotConfig });
      }
      toast({ title: `Nachricht von ${botParticipant.displayName} gesendet.`});

    } catch (error: any) {
      console.error(`Error posting for bot ${botParticipant.displayName} in session ${sessionId}:`, error);
      toast({ variant: "destructive", title: "Fehler beim Posten für Bot", description: error.message || "Nachricht konnte nicht generiert oder gesendet werden." });
    } finally {
      setIsPostingForBot(null);
    }
  }, [sessionId, currentScenario, sessionData, chatMessages, toast ]);


  const handleRemoveParticipant = useCallback(async (participantId: string, participantName: string) => {
    if (!sessionId) return;
    setIsRemovingParticipant(participantId);
    try {
      const participantDocRef = doc(db, "sessions", sessionId, "participants", participantId);
      await deleteDoc(participantDocRef);
      toast({ title: "Teilnehmer entfernt", description: `Teilnehmer "${participantName}" wurde erfolgreich aus der Sitzung entfernt.` });
    } catch (error: any) {
      console.error(`Error removing participant ${participantId} from session ${sessionId}:`, error);
      toast({ variant: "destructive", title: "Fehler", description: `Teilnehmer "${participantName}" konnte nicht entfernt werden: ${error.message}` });
    } finally {
      setIsRemovingParticipant(null);
    }
  }, [sessionId, toast]);

  const handleRemoveAllParticipants = useCallback(async () => {
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
    } catch (error: any) {
      console.error(`Error removing all participants from session ${sessionId}:`, error);
      toast({ variant: "destructive", title: "Fehler", description: `Teilnehmer konnten nicht entfernt werden: ${error.message}` });
    } finally {
      setIsRemovingAllParticipants(false);
    }
  }, [sessionId, toast]);


  const handleDownloadCsv = useCallback(() => {
    if (!chatMessages.length) {
      toast({ title: "Keine Daten", description: "Es gibt keine Nachrichten zum Exportieren." });
      return;
    }

    const participantMap = new Map(sessionParticipants.map(p => [p.userId, p]));

    const headers = [
      "Message ID", "Timestamp", "Sender UserID", "Sender Klarname", "Sender Nickname", "Sender Rolle", "Sender Typ",
      "Content", "Image URL", "Image File Name",
      "ReplyToMessageID", "ReplyToMessageSenderName", "ReplyToMessageContentSnippet",
      "Reactions", "Bot Flag"
    ];

    const rows = chatMessages.map(msg => {
      const sender = participantMap.get(msg.senderUserId);
      const senderRole = sender ? sender.role : (msg.senderType === 'system' ? "System" : "Unbekannt");
      const senderKlarname = sender ? sender.realName : (msg.senderType === 'system' ? msg.senderName : "Unbekannt");
      const senderNickname = sender ? sender.displayName : msg.senderName;


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
        escapeCsvField(msg.timestamp instanceof Timestamp ? msg.timestamp.toDate().toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'medium'}) : String(msg.timestamp)),
        escapeCsvField(msg.senderUserId),
        escapeCsvField(senderKlarname),
        escapeCsvField(senderNickname),
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
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' }); 
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
  }, [chatMessages, sessionParticipants, sessionId, toast]);

  const handleTriggerScenarioEvent = useCallback(async (event: ScenarioEvent) => {
    console.log("AdminDashboard: Triggering event:", event);
    toast({
      title: `Ereignis "${event.name}" ausgelöst (Platzhalter)`,
      description: event.description || "Die Aktion für dieses Ereignis ist noch nicht implementiert.",
    });
  }, [toast]);

  const handleToggleRoleLock = useCallback(async () => {
    if (!sessionId || !sessionData) return;
    setIsProcessingSessionAction(true);
    const sessionDocRef = doc(db, "sessions", sessionId);
    try {
        await updateDoc(sessionDocRef, { 
            roleSelectionLocked: !sessionData.roleSelectionLocked,
            updatedAt: serverTimestamp() 
        });
        toast({ title: `Rollenauswahl ${!sessionData.roleSelectionLocked ? 'fixiert' : 'freigegeben'}.`});
    } catch (error: any) {
        console.error("Error toggling role lock:", error);
        toast({ variant: "destructive", title: "Fehler", description: "Status der Rollenauswahl konnte nicht geändert werden."});
    } finally {
        setIsProcessingSessionAction(false);
    }
  }, [sessionId, sessionData, toast]);


  const scenarioTitle = currentScenario?.title || (isLoadingScenario ? "Szenario lädt..." : "Szenario nicht gefunden");
  const humanParticipantsCount = sessionParticipants.filter(p => !p.isBot).length;
  
  const isSessionEffectivelyEnded = sessionData?.status === "ended";
  const isSessionEffectivelyPaused = sessionData?.status === "paused";
  const isSessionPending = sessionData?.status === "pending";
  const isSessionOpenForJoin = sessionData?.status === "open";
  const isChatActive = sessionData?.status === "active";
  

  if (isLoadingPage) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="items-center">
            <CardTitle className="flex items-center"><Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />Lade Dashboard...</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground">Szenario- und Sitzungsdaten werden abgerufen...</p>
            {isLoadingScenario && <p className="text-xs mt-1">Lade Szenario...</p>}
            {isLoadingSessionData && <p className="text-xs mt-1">Lade Sitzungsstatus...</p>}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (pageError) { 
     return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6">
        <Card className="w-full max-w-lg">
          <CardHeader className="items-center">
            <CardTitle className="text-destructive flex items-center"><AlertTriangle className="mr-2 h-6 w-6"/> Fehler beim Laden des Dashboards</CardTitle>
            <CardDescription>{pageError}</CardDescription>
            </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
             <p className="text-sm text-muted-foreground">
                Stellen Sie sicher, dass die Szenario-ID gültig ist und das Szenario in der Datenbank existiert.
             </p>
            <Button onClick={() => router.push('/admin')} variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4"/> Zur Szenarienübersicht
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  if (!currentScenario && !isLoadingScenario && !pageError) { 
     return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="items-center">
            <CardTitle className="text-destructive flex items-center"><AlertTriangle className="mr-2 h-6 w-6"/> Szenario nicht geladen</CardTitle>
            <CardDescription>Das zugehörige Szenario konnte nicht geladen werden. Bitte überprüfen Sie die Szenario-ID oder wählen Sie ein anderes Szenario.</CardDescription>
            </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={() => router.push('/admin')} variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4"/> Zur Szenarienübersicht
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }


  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      {/* Header Section */}
       <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-primary">
            Dashboard: <span className="text-foreground">{scenarioTitle}</span>
          </h1>
          <p className="text-muted-foreground text-xs md:text-sm">Sitzungs-ID: {sessionId}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
           <Link href={`/admin/scenario-editor/${sessionId}`} passHref legacyBehavior>
            <Button variant="outline" size="sm">
                <NotebookPen className="mr-2 h-4 w-4" /> Szenario bearbeiten
            </Button>
          </Link>
          <Button
            variant={showParticipantMirrorView ? "secondary" : "default"}
            onClick={() => setShowParticipantMirrorView(!showParticipantMirrorView)}
            className={cn("text-sm",!showParticipantMirrorView ? "bg-primary hover:bg-primary/90" : "")}
            size="sm"
          >
            <Eye className="mr-2 h-4 w-4" />
            {showParticipantMirrorView ? "Chat-Ansicht ausblenden" : "Chat-Ansicht einblenden"}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={isEndingSession || isSessionEffectivelyEnded || isProcessingSessionAction}>
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
                <AlertDialogAction onClick={handleEndSession} disabled={isEndingSession} className="bg-red-600 hover:bg-red-700">
                  {isEndingSession ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : "Beenden"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      <Separator />

      {/* Session Ended Alert */}
      {isSessionEffectivelyEnded && (
        <Card className="border-destructive bg-destructive/10">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center"><AlertCircle className="mr-2"/> Sitzung Beendet</CardTitle>
            <CardDescription className="text-destructive/80">Diese Sitzung wurde beendet. Sie können sie unten neu starten oder zurücksetzen.</CardDescription>
          </CardHeader>
        </Card>
      )}
       {isSessionEffectivelyPaused && !isSessionEffectivelyEnded && (
        <Card className="border-yellow-500 bg-yellow-500/10">
          <CardHeader>
            <CardTitle className="text-yellow-600 flex items-center"><Pause className="mr-2"/> Sitzung Pausiert</CardTitle>
            <CardDescription className="text-yellow-700/80">Diese Sitzung ist aktuell pausiert. Teilnehmer können keine Nachrichten senden.</CardDescription>
          </CardHeader>
        </Card>
      )}


      {/* Main Content Area */}
      <div className="flex flex-col gap-6">
          <Card className="w-full">
              <CardHeader>
                  <CardTitle className="flex items-center"><Settings className="mr-2 h-5 w-5 text-primary" /> Sitzungs-Steuerung</CardTitle>
                  <CardDescription>
                    Aktueller Status: <Badge 
                        variant={
                            sessionData?.status === 'active' ? 'default' :
                            sessionData?.status === 'open' ? 'secondary' :
                            sessionData?.status === 'pending' ? 'outline' :
                            sessionData?.status === 'paused' ? 'destructive' : 
                            sessionData?.status === 'ended' ? 'destructive' : 'outline'
                        }
                        className={cn(
                            "ml-2",
                            sessionData?.status === 'active' ? 'bg-green-500 hover:bg-green-600 text-white' :
                            sessionData?.status === 'open' ? 'bg-blue-500 hover:bg-blue-600 text-white' :
                            sessionData?.status === 'pending' ? 'bg-yellow-500 hover:bg-yellow-600 text-black' :
                            sessionData?.status === 'paused' ? 'bg-orange-500 hover:bg-orange-600 text-white' :
                            sessionData?.status === 'ended' ? 'bg-red-600 hover:bg-red-700 text-white' : ''
                        )}
                    >
                        {sessionData?.status === 'pending' && <Clock className="mr-1.5 h-3.5 w-3.5"/>}
                        {sessionData?.status === 'open' && <LogIn className="mr-1.5 h-3.5 w-3.5"/>}
                        {sessionData?.status === 'active' && <Play className="mr-1.5 h-3.5 w-3.5"/>}
                        {sessionData?.status === 'paused' && <Pause className="mr-1.5 h-3.5 w-3.5"/>}
                        {sessionData?.status === 'ended' && <Power className="mr-1.5 h-3.5 w-3.5"/>}
                        {sessionData?.status ? (sessionData.status.charAt(0).toUpperCase() + sessionData.status.slice(1)) : "Unbekannt"}
                    </Badge>
                  </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
                        <Button
                          onClick={handleOpenSessionForJoining}
                          disabled={isProcessingSessionAction || !isSessionPending || isLoadingScenario || !currentScenario}
                          variant="default"
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                          {isProcessingSessionAction && sessionData?.status === "pending" ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <LogIn className="mr-2 h-4 w-4" />}
                          Sitzung für Beitritt öffnen
                      </Button>
                      <Button
                          onClick={handleStartChatSimulation}
                          disabled={isProcessingSessionAction || !isSessionOpenForJoin || isLoadingScenario || !currentScenario || simulationStartingCountdown !== null}
                          variant="default"
                          className="bg-green-600 hover:bg-green-700 text-white"
                      >
                          {isProcessingSessionAction && simulationStartingCountdown === null && sessionData?.status === "open" ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlayCircle className="mr-2 h-4 w-4" />}
                          {simulationStartingCountdown !== null ? `Start in ${simulationStartingCountdown}s...` : "Chat-Simulation starten"}
                      </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                              <Button variant="destructive" disabled={isProcessingSessionAction || isLoadingSessionData || isLoadingScenario || !currentScenario} className="bg-red-700 hover:bg-red-800 text-white">
                                  {isProcessingSessionAction && sessionData?.status !== "pending" && sessionData?.status !== "ended" ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <History className="mr-2 h-4 w-4" />}
                                    Sitzung zurücksetzen
                              </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                          <AlertDialogHeader>
                              <AlertDialogTitle>Sitzung wirklich komplett zurücksetzen?</AlertDialogTitle>
                              <AlertDialogDescription>
                              Alle Teilnehmer und Nachrichten dieser Sitzung werden dauerhaft gelöscht. Die Sitzung wird in den 'pending'-Status zurückgesetzt (inkl. neuem Einladungslink-Token). Diese Aktion kann nicht rückgängig gemacht werden.
                              </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                              <AlertDialogCancel disabled={isProcessingSessionAction}>Abbrechen</AlertDialogCancel>
                              <AlertDialogAction onClick={handleResetSession} disabled={isProcessingSessionAction} className="bg-destructive hover:bg-destructive/90">
                                  {isProcessingSessionAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : "Ja, zurücksetzen"}
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
                          onValueCommit={handlePaceChangeCommit} 
                          disabled={isSessionEffectivelyEnded || isProcessingSessionAction || (!isChatActive && !isSessionEffectivelyPaused)}
                      />
                  </div>
                  <div className="flex items-center justify-between">
                      <Label htmlFor="simulation-active" className="text-base">
                          Simulation aktiv (Pausieren/Fortsetzen)
                      </Label>
                      <Switch
                          id="simulation-active"
                          checked={isChatActive} 
                          onCheckedChange={handleToggleSimulationActive} 
                          disabled={isSessionEffectivelyEnded || isProcessingSessionAction || isSessionPending || isSessionOpenForJoin}
                      />
                  </div>
              </CardContent>
          </Card>

          {showParticipantMirrorView && (
            <Card className="border-primary/50 shadow-lg w-full"> 
              <CardHeader>
                <CardTitle className="flex items-center text-primary"><Eye className="mr-2 h-5 w-5"/> Live Chat-Spiegelung (Als Admin)</CardTitle>
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
                    initialUserRealName="Administrator"
                    isAdminView={true}
                  />
                )}
              </CardContent>
            </Card>
          )}

          <div className={cn("grid grid-cols-1 gap-6 w-full", showParticipantMirrorView ? "hidden" : "lg:grid-cols-3")}>
              <div className="lg:col-span-2 space-y-6">
                <Card>
                    <CardHeader>
                    <CardTitle className="flex items-center"><LayoutDashboard className="mr-2 h-5 w-5 text-primary" /> Sitzungseinladung & Infos</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                    <div>
                        <Label className="font-semibold">Definierte Rollen im Szenario:</Label>
                        <p className="text-sm text-muted-foreground">
                        {currentScenario?.humanRolesConfig?.length || 0} {currentScenario?.humanRolesConfig?.length === 1 ? "Rolle" : "Rollen"}
                        </p>
                        <Label className="font-semibold mt-2 block">Definierte Bots im Szenario:</Label>
                        <p className="text-sm text-muted-foreground">
                        {currentScenario?.defaultBotsConfig?.length || 0} {currentScenario?.defaultBotsConfig?.length === 1 ? "Bot" : "Bots"}
                        </p>
                    </div>
                    <div>
                        <Label htmlFor="invitation-link" className="font-semibold">Einladungslink:</Label>
                        <div className="flex items-center gap-2 mt-1">
                        <Input id="invitation-link" type="text" value={isLoadingSessionData || !sessionData ? "Lade Sitzungsdaten..." : displayedInvitationLink} readOnly className="bg-muted" />
                        <Button variant="outline" size="icon" onClick={copyToClipboard} aria-label="Link kopieren" disabled={isLoadingSessionData || !sessionData || displayedInvitationLink.includes("Wird generiert...") || displayedInvitationLink.includes("Lade")}>
                            <Copy className="h-4 w-4" />
                        </Button>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => toast({title: "QR-Code (Platzhalter)", description:"QR-Code Anzeige ist noch nicht implementiert."})} disabled={isLoadingSessionData || !sessionData || displayedInvitationLink.includes("Wird generiert...") || displayedInvitationLink.includes("Lade")}>
                            <QrCode className="mr-2 h-4 w-4" /> QR-Code anzeigen
                        </Button>
                        <Button variant="default" onClick={handleGenerateNewInvitationToken} disabled={isLoadingSessionData || isGeneratingLink || !sessionData}>
                            {isGeneratingLink ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RefreshCw className="mr-2 h-4 w-4" />} Neuen Einladungslink generieren
                        </Button>
                    </div>
                    </CardContent>
                </Card>

                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center"><Users2 className="mr-2 h-5 w-5 text-primary" /> Teilnehmer & Rollenzuordnung (Live)</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="role-lock" className="text-sm">
                                Rollenauswahl für neue Teilnehmer sperren
                            </Label>
                            <Switch
                                id="role-lock"
                                checked={sessionData?.roleSelectionLocked ?? false}
                                onCheckedChange={handleToggleRoleLock}
                                disabled={isProcessingSessionAction || !sessionData || sessionData.status === 'pending' || sessionData.status === 'ended'}
                            />
                        </div>
                         <Separator />
                        {isLoadingParticipants && <div className="text-sm text-muted-foreground flex items-center"><Loader2 className="h-4 w-4 animate-spin mr-2"/> Lade Rollenzuordnungen...</div>}
                        {!isLoadingParticipants && currentScenario?.humanRolesConfig && currentScenario.humanRolesConfig.length > 0 ? (
                            currentScenario.humanRolesConfig.map(role => {
                                const assignedParticipants = sessionParticipants.filter(p => !p.isBot && p.role === role.name);
                                return (
                                    <div key={role.id} className="p-2 border-b">
                                        <h4 className="font-semibold text-sm">{role.name}</h4>
                                        {assignedParticipants.length > 0 ? (
                                            <ul className="list-disc list-inside pl-4 text-xs text-muted-foreground">
                                                {assignedParticipants.map(p => (
                                                    <li key={p.id}>{p.displayName} <span className="text-xs opacity-70">({p.realName})</span></li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <p className="text-xs text-muted-foreground italic">Noch nicht besetzt.</p>
                                        )}
                                    </div>
                                );
                            })
                        ) : (
                            !isLoadingParticipants && <p className="text-sm text-muted-foreground">Keine Rollen im Szenario definiert oder Teilnehmer werden geladen.</p>
                        )}
                        <CardDescription className="text-xs pt-2">Admins können Teilnehmer später hier zwischen Rollen verschieben (Zukunftsfunktion).</CardDescription>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                    <CardTitle className="flex items-center"><MessageSquare className="mr-2 h-5 w-5 text-primary" /> Chat-Verlauf (Admin-Vorschau)</CardTitle>
                    <CardDescription>Beobachten Sie die laufende Diskussion (vereinfachte Ansicht).</CardDescription>
                    </CardHeader>
                    <CardContent className="h-96 bg-muted/30 rounded-md p-4 overflow-y-auto space-y-2">
                    {isLoadingMessages && <div className="flex items-center justify-center h-full text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mr-2"/> <p>Lade Chat...</p></div>}
                    {!isLoadingMessages && chatMessages.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        <MessageCircleIcon className="w-12 h-12 mb-2 opacity-50" />
                        <p>Noch keine Nachrichten in dieser Sitzung.</p>
                        {isSessionEffectivelyEnded && <p className="mt-1 text-xs">Die Sitzung ist beendet.</p>}
                        {currentScenario?.initialPost?.content && !isSessionEffectivelyEnded && sessionData?.status !== 'active' && (
                            <p className="mt-2 text-xs italic">Der Ausgangspost wird im Chat der Teilnehmer angezeigt, sobald die Simulation aktiv ist.</p>
                        )}
                        </div>
                    )}
                    {!isLoadingMessages && chatMessages.map(msg => (
                        <div key={msg.id} className="text-sm p-2 rounded bg-card/50 shadow-sm">
                        <span className={`font-semibold ${msg.senderType === 'bot' ? 'text-accent' : msg.senderType === 'admin' ? 'text-destructive' : (msg.senderType === 'system' ? 'text-muted-foreground' : 'text-foreground/80')}`}>
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
                    <div ref={adminChatPreviewEndRef} />
                    </CardContent>
                </Card>
                
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center"><Sparkles className="mr-2 h-5 w-5 text-primary" /> Manuelle Ereignisse auslösen</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {isLoadingScenario || !currentScenario?.events || currentScenario.events.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                {isLoadingScenario ? "Lade Szenario-Ereignisse..." : "Für dieses Szenario sind keine manuellen Ereignisse definiert."}
                            </p>
                        ) : (
                            currentScenario.events.map(event => (
                                <Card key={event.id} className="p-3 bg-muted/20">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-medium">{event.name}</p>
                                            <p className="text-xs text-muted-foreground">{event.description}</p>
                                        </div>
                                        <Button 
                                            size="sm" 
                                            variant="outline"
                                            onClick={() => handleTriggerScenarioEvent(event)}
                                            disabled={isSessionEffectivelyEnded || !isChatActive}
                                        >
                                            <Wand2 className="mr-2 h-4 w-4"/> Auslösen
                                        </Button>
                                    </div>
                                </Card>
                            ))
                        )}
                    </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-1 space-y-6">
                <Card>
                    <CardHeader>
                    <CardTitle className="flex items-center">
                        <Users className="mr-2 h-5 w-5 text-primary" />
                        Teilnehmende ({humanParticipantsCount} Menschliche)
                    </CardTitle>
                    </CardHeader>
                    <CardContent className="max-h-96 overflow-y-auto space-y-3">
                    {isLoadingParticipants && <div className="flex items-center justify-center h-full text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mr-2"/> <p>Lade Teilnehmer...</p></div>}
                    {!isLoadingParticipants && sessionParticipants.filter(p => !p.isBot).map(p => (
                        <div key={p.id || p.userId} className="flex items-center justify-between p-2 bg-muted/20 rounded-md">
                        <div>
                            <p className="font-medium">{p.displayName} <span className="text-sm text-muted-foreground">({p.realName || 'N/A'})</span></p>
                            <p className="text-xs text-muted-foreground">
                                {p.role} -
                                <span className={cn(
                                    "ml-1",
                                    p.status === "Nicht beigetreten" || p.id.startsWith("student-placeholder") ? "italic text-orange-500" : "text-green-500"
                                )}>
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
                                disabled={isSessionEffectivelyEnded || p.id.startsWith("student-placeholder") || isProcessingSessionAction || (!isChatActive && !isSessionOpenForJoin && !isSessionEffectivelyPaused)}
                            >
                                {p.isMuted ? <Volume2 className="mr-1 h-4 w-4" /> : <VolumeX className="mr-1 h-4 w-4" />}
                                {p.isMuted ? "Frei" : "Stumm"}
                            </Button>
                            {!p.id.startsWith("student-placeholder") && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 h-8 w-8"
                                    disabled={isSessionEffectivelyEnded || isRemovingParticipant === p.id || isProcessingSessionAction || (!isChatActive && !isSessionOpenForJoin && !isSessionEffectivelyPaused) }>
                                        {isRemovingParticipant === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Teilnehmer "{p.displayName}" wirklich entfernen?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Diese Aktion kann nicht rückgängig gemacht werden. Der Teilnehmer wird aus der Sitzung entfernt.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel disabled={isRemovingParticipant === p.id}>Abbrechen</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleRemoveParticipant(p.id, p.displayName)} disabled={isRemovingParticipant === p.id} className="bg-destructive hover:bg-destructive/90">
                                            {isRemovingParticipant === p.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : "Ja, entfernen"}
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                            )}
                        </div>
                        </div>
                    ))}
                    {!isLoadingParticipants && humanParticipantsCount === 0 && (
                        <p className="text-sm text-muted-foreground">Noch keine menschlichen Teilnehmer beigetreten.</p>
                    )}
                     {!isLoadingParticipants && (
                        <div className="flex items-center space-x-2 pt-4 border-t mt-4">
                            <Button variant="outline" onClick={handleMuteAllUsers} disabled={isSessionEffectivelyEnded || isProcessingSessionAction || (!isChatActive && !isSessionOpenForJoin && !isSessionEffectivelyPaused) || humanParticipantsCount === 0}>
                                <VolumeX className="mr-2 h-4 w-4" /> Alle Stummschalten
                            </Button>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" className="bg-orange-600 hover:bg-orange-700" disabled={isSessionEffectivelyEnded || isRemovingAllParticipants || isLoadingParticipants || isProcessingSessionAction || (!isChatActive && !isSessionOpenForJoin && !isSessionEffectivelyPaused) || humanParticipantsCount === 0}>
                                        {isRemovingAllParticipants ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <UserX className="mr-2 h-4 w-4" />} Alle Teilnehmer entfernen
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
                        if (!botConfig) return <p key={botParticipant.id} className="text-xs text-red-500">Bot-Konfiguration für {botParticipant.displayName} fehlt!</p>;

                        const botName = botConfig.name || botParticipant.displayName; 
                        const botIsActive = botConfig.isActive ?? true;
                        const botEscalation = botConfig.currentEscalation ?? 0;
                        const botAutoTimer = botConfig.autoTimerEnabled ?? false;
                        const currentBotMissionForInput = botMissions[botParticipant.id] ?? botConfig.currentMission ?? botConfig.initialMission ?? "";

                        return (
                        <div key={botParticipant.id} className="p-3 border rounded-lg space-y-3">
                            <div className="flex items-center justify-between">
                            <p className="font-semibold">{botName} <Badge variant={botIsActive ? "default" : "outline"} className={cn("ml-2", botIsActive ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-gray-400 hover:bg-gray-500 text-white')}>{botIsActive ? "Aktiv" : "Inaktiv"}</Badge> <span className="text-xs text-muted-foreground">(ID: {botParticipant.botScenarioId || 'N/A'})</span></p>
                            <Switch
                                checked={botIsActive}
                                onCheckedChange={() => handleToggleBotActive(botParticipant.id, botIsActive)}
                                disabled={isSessionEffectivelyEnded || isProcessingSessionAction || (!isChatActive && !isSessionOpenForJoin && !isSessionEffectivelyPaused)}
                            />
                            </div>
                            <div className="space-y-1">
                            <Label className="text-xs">Eskalationslevel: {botEscalation}</Label>
                            <Progress value={botEscalation * 33.33} className="h-2" />
                            </div>
                            <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleBotEscalationChange(botParticipant.id, "increase")} disabled={isSessionEffectivelyEnded || isProcessingSessionAction || botEscalation >= 3 || !botIsActive || (!isChatActive && !isSessionOpenForJoin && !isSessionEffectivelyPaused)}><ChevronUp className="h-4 w-4" /></Button>
                            <Button variant="outline" size="sm" onClick={() => handleBotEscalationChange(botParticipant.id, "decrease")} disabled={isSessionEffectivelyEnded || isProcessingSessionAction || botEscalation <= 0 || !botIsActive || (!isChatActive && !isSessionOpenForJoin && !isSessionEffectivelyPaused)}><ChevronDown className="h-4 w-4" /></Button>
                            <Button
                                variant="secondary"
                                size="sm"
                                className="flex-1"
                                onClick={() => handlePostForBot(botParticipant)}
                                disabled={isSessionEffectivelyEnded || isProcessingSessionAction || isPostingForBot === botParticipant.id || !botIsActive || (!isChatActive && !isSessionOpenForJoin && !isSessionEffectivelyPaused)}
                            >
                                {isPostingForBot === botParticipant.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <><Brain className="mr-2 h-4 w-4" /> Posten</>}
                            </Button>
                            </div>
                            <div>
                            <Label htmlFor={`mission-${botParticipant.id}`} className="text-xs">Spezifische Anweisung/Mission für nächsten Post:</Label>
                            <Input
                                id={`mission-${botParticipant.id}`}
                                type="text"
                                value={currentBotMissionForInput}
                                onChange={(e) => handleBotMissionChange(botParticipant.id, e.target.value)}
                                onBlur={() => handleUpdateBotMissionInFirestore(botParticipant.id)}
                                placeholder="z.B. Frage nach Quellen..."
                                className="mt-1 text-xs h-8"
                                disabled={isSessionEffectivelyEnded || isProcessingSessionAction || !botIsActive || (!isChatActive && !isSessionOpenForJoin && !isSessionEffectivelyPaused)}
                            />
                            </div>
                            <div className="flex items-center space-x-2 pt-1">
                            <Label htmlFor={`autotimer-bot-${botParticipant.id}`} className="text-xs">Auto-Timer</Label>
                            <Switch 
                                id={`autotimer-bot-${botParticipant.id}`} 
                                checked={botAutoTimer} 
                                disabled={isSessionEffectivelyEnded || isProcessingSessionAction || !botIsActive || (!isChatActive && !isSessionOpenForJoin && !isSessionEffectivelyPaused) || true} // Temporarily disable auto-timer functionality
                                onCheckedChange={() => {
                                    // handleBotAutoTimerToggle(botParticipant.id, botAutoTimer)
                                    toast({title: "Auto-Timer (Zukunft)", description: "Die automatische Bot-Antwort Funktion ist noch nicht implementiert."})
                                }}
                            />
                            </div>
                        </div>
                        );
                    })}
                    {(!currentScenario?.defaultBotsConfig || currentScenario.defaultBotsConfig.length === 0) && !isLoadingParticipants && (
                        <p className="text-sm text-muted-foreground">Für dieses Szenario sind keine Bots konfiguriert.</p>
                    )}
                        {!isLoadingParticipants && sessionParticipants.filter(p=>p.isBot).length === 0 && currentScenario && (currentScenario.defaultBotsConfig?.length || 0) > 0 && (
                            <p className="text-sm text-muted-foreground">Bots werden initialisiert oder sind nicht konfiguriert.</p>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center"><Download className="mr-2 h-5 w-5 text-primary" /> Datenexport</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Button className="w-full" onClick={handleDownloadCsv} disabled={chatMessages.length === 0 || isLoadingMessages}>
                            Chat-Protokoll als CSV herunterladen
                        </Button>
                    </CardContent>
                </Card>
              </div>
          </div>
      </div>
    </div>
  );
}
