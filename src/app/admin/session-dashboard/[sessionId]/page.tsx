
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AlertCircle, Bot, ChevronDown, ChevronUp, Download, MessageSquare, Play, Pause, QrCode, Users, Settings, Volume2, VolumeX, Copy, MessageCircle as MessageCircleIcon, Power, RotateCcw, RefreshCw, Eye, Brain, NotebookPen, Trash2, UserX, Loader2, ArrowLeft, Wand2, LayoutDashboard } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import type { Scenario, BotConfig, Participant, Message as MessageType, SessionData } from "@/lib/types";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/firebase";
import { doc, setDoc, getDoc, serverTimestamp, collection, onSnapshot, query, orderBy, Timestamp, updateDoc, writeBatch, getDocs, where, deleteDoc, addDoc } from "firebase/firestore";
import Link from 'next/link'; // Added Link import
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
import NextImage from 'next/image'; // Renamed to NextImage to avoid conflict if any
import { useRouter } from 'next/navigation';


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
  const sessionId = props.params.sessionId;
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
  
  // Combined loading state
  const isLoadingPage = isLoadingScenario || isLoadingSessionData;


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
  const adminChatPreviewEndRef = useRef<null | HTMLDivElement>(null);

  const displayedInvitationLink = sessionData?.invitationLink && sessionData.invitationToken
    ? `${sessionData.invitationLink}?token=${sessionData.invitationToken}`
    : "Wird generiert...";

  // Effect to load the scenario
  useEffect(() => {
    if (!sessionId) {
      console.error("AdminDashboard: No sessionId provided.");
      setPageError("Keine Szenario-ID für das Dashboard vorhanden.");
      setIsLoadingScenario(false);
      setIsLoadingSessionData(false); // Prevent further loading if no session ID
      return;
    }
    console.log(`AdminDashboard: Attempting to load scenario with ID: ${sessionId}`);
    setIsLoadingScenario(true);
    setPageError(null);
    const scenarioDocRef = doc(db, "scenarios", sessionId);

    getDoc(scenarioDocRef).then(docSnap => {
      if (docSnap.exists()) {
        console.log(`AdminDashboard: Scenario ${sessionId} found in Firestore.`);
        setCurrentScenario({ id: docSnap.id, ...docSnap.data() } as Scenario);
      } else {
        console.error(`AdminDashboard: Scenario ${sessionId} NOT found in Firestore.`);
        setPageError(`Szenario mit ID ${sessionId} nicht gefunden.`);
        setCurrentScenario(null);
        toast({ variant: "destructive", title: "Szenario Fehler", description: `Szenario mit ID ${sessionId} konnte nicht geladen werden.` });
      }
    }).catch(err => {
      console.error(`AdminDashboard: Error fetching scenario ${sessionId}:`, err);
      setPageError("Szenario konnte nicht geladen werden. Fehler: " + err.message);
      setCurrentScenario(null);
      toast({ variant: "destructive", title: "Ladefehler", description: "Szenario konnte nicht geladen werden." });
    }).finally(() => {
      setIsLoadingScenario(false);
    });
  }, [sessionId, toast]);


  // Effect to ensure session document exists and to listen for its changes
  useEffect(() => {
    if (!sessionId) {
      console.log("AdminDashboard: No sessionId, skipping session document management.");
      setIsLoadingSessionData(false);
      return;
    }

    console.log(`AdminDashboard: Managing session document for ID: ${sessionId}`);
    setIsLoadingSessionData(true);
    const sessionDocRef = doc(db, "sessions", sessionId);

    const ensureAndListenSessionDocument = async () => {
      let operationsDone = false;
      try {
        let baseLink = "";
        if (typeof window !== "undefined") {
          baseLink = `${window.location.origin}/join/${sessionId}`;
        }

        const docSnap = await getDoc(sessionDocRef);
        if (!docSnap.exists()) {
          console.log(`AdminDashboard: Session doc for ${sessionId} does not exist, creating...`);
          // Scenario ID must be available to create a meaningful session
          if (!currentScenario && !isLoadingScenario) { // If scenario loading is finished and it's null
            console.warn(`AdminDashboard: Cannot create session for ${sessionId} as currentScenario is not loaded or does not exist.`);
            setPageError(prevError => prevError || "Sitzungsdokument kann nicht erstellt werden, da Szenariodaten fehlen.");
            setIsLoadingSessionData(false);
            return; // Stop if no scenario to link to
          } else if (isLoadingScenario) {
            console.log(`AdminDashboard: Waiting for scenario to load before creating session for ${sessionId}.`);
            // This effect will re-run when isLoadingScenario changes.
            return;
          }
          
          const newSessionToken = generateToken();
          const newSessionData: SessionData = {
            scenarioId: currentScenario!.id, 
            createdAt: serverTimestamp(),
            invitationLink: baseLink,
            invitationToken: newSessionToken,
            status: "active", // Default to active when created
            messageCooldownSeconds: DEFAULT_COOLDOWN,
          };
          await setDoc(sessionDocRef, newSessionData);
          console.log(`AdminDashboard: Session doc for ${sessionId} created.`);
          operationsDone = true;
        } else {
          const existingData = docSnap.data() as SessionData;
          const updates: Partial<SessionData> = {};
          if (existingData.invitationLink !== baseLink && baseLink) updates.invitationLink = baseLink;
          if (!existingData.invitationToken) updates.invitationToken = generateToken();
          // Ensure scenarioId is set if currentScenario is loaded and differs
          if (currentScenario && existingData.scenarioId !== currentScenario.id) {
            console.warn(`AdminDashboard: Session ${sessionId} has scenarioId ${existingData.scenarioId}, but currentScenario is ${currentScenario.id}. Updating.`);
            updates.scenarioId = currentScenario.id;
          } else if (!existingData.scenarioId && currentScenario) {
             updates.scenarioId = currentScenario.id;
          }
          if (typeof existingData.messageCooldownSeconds === 'undefined') updates.messageCooldownSeconds = DEFAULT_COOLDOWN;
          
          if (Object.keys(updates).length > 0) {
            await updateDoc(sessionDocRef, updates);
            console.log(`AdminDashboard: Session doc for ${sessionId} updated with:`, updates);
            operationsDone = true;
          }
        }
      } catch (error) {
        console.error(`AdminDashboard: Error managing session document for ${sessionId}:`, error);
        setPageError(prevError => prevError || "Sitzungsdokument konnte nicht initialisiert/geladen werden.");
      } finally {
        if (operationsDone) {
          // If we created/updated, the listener below will pick it up.
        }
      }

      console.log(`AdminDashboard: Setting up onSnapshot listener for session ${sessionId}.`);
      const unsubscribe = onSnapshot(sessionDocRef, (docSn) => {
        if (docSn.exists()) {
          const data = docSn.data() as SessionData;
          console.log(`AdminDashboard: Session data snapshot for ${sessionId} received:`, data);
          setSessionData(data);
          setPaceValue(data.messageCooldownSeconds ?? DEFAULT_COOLDOWN);
        } else {
          console.warn(`AdminDashboard: Session document for ${sessionId} disappeared or does not exist in snapshot listener.`);
          setSessionData(null); 
        }
        setIsLoadingSessionData(false); // Set loading to false once snapshot is processed
      }, (error) => {
        console.error(`AdminDashboard: Error listening to session data for ${sessionId}:`, error);
        setPageError(prevError => prevError || "Sitzungsstatus konnte nicht geladen werden.");
        setIsLoadingSessionData(false);
      });
      return unsubscribe;
    };
    
    // Only run if sessionId is present. Dependency on currentScenario ensures it re-runs if scenario loads later.
    // isLoadingScenario dependency ensures it re-runs after scenario loading attempt.
    if (sessionId) {
       ensureAndListenSessionDocument();
    } else {
       setIsLoadingSessionData(false);
    }

  }, [sessionId, currentScenario, isLoadingScenario]);


  const getBotDisplayName = useCallback((botConfig: BotConfig, scenarioBotsCount: number, index: number): string => {
    if (botConfig.name) return botConfig.name;
    const nameSuffix = scenarioBotsCount > 1 ? ` ${index + 1}` : "";
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
      console.warn(`initializeBotsForSession: Scenario data or bot config missing for scenario ID: ${sId}. Scenario:`, scenarioToInit);
      return;
    }
    console.log(`AdminDashboard: Initializing/syncing bots for scenario: ${scenarioToInit.title} (ID: ${sId})`);
    const scenarioBotsConfig = scenarioToInit.defaultBotsConfig || [];
    const participantsColRef = collection(db, "sessions", sId, "participants");
    const batch = writeBatch(db);
    let operationsInBatch = 0;

    const existingBotsQuery = query(participantsColRef, where("isBot", "==", true));
    const existingBotsSnap = await getDocs(existingBotsQuery);
    const firestoreBotsMap = new Map(existingBotsSnap.docs.map(d => [d.data().botScenarioId, {docId: d.id, data: d.data() as Participant}]));
    const configBotScenarioIds = new Set(scenarioBotsConfig.map(bc => bc.id));

    // Delete bots from Firestore that are no longer in the scenario config
    firestoreBotsMap.forEach((botDetails, botScenarioIdInDb) => {
      if (!configBotScenarioIds.has(botScenarioIdInDb)) {
        batch.delete(doc(participantsColRef, botDetails.docId));
        operationsInBatch++;
        console.log(`AdminDashboard: Deleting bot with ScenarioID: ${botScenarioIdInDb} (DocID: ${botDetails.docId}) as it's no longer in scenario config.`);
      }
    });

    // Add or update bots based on scenario config
    for (const [index, botConfig] of scenarioBotsConfig.entries()) {
      const botScenarioId = botConfig.id;
      if (!botScenarioId) {
        console.error("AdminDashboard: Bot config is missing a unique id (from scenario.defaultBotsConfig):", botConfig);
        continue; 
      }
      const botDisplayName = getBotDisplayName(botConfig, scenarioBotsConfig.length, index);
      
      const botDataForFirestore: Omit<Participant, 'id' | 'joinedAt'> & { joinedAt?: any, botConfig: BotConfig } = {
        userId: `bot-${botScenarioId}`, // Unique based on scenario bot ID
        name: botDisplayName,
        role: `Bot (${botConfig.personality || 'standard'})`,
        avatarFallback: botConfig.avatarFallback || (botConfig.name || botConfig.personality.substring(0,1) + botConfig.id.substring(0,1)).substring(0, 2).toUpperCase() || "BT",
        isBot: true,
        status: "Aktiv", 
        botConfig: { 
          ...botConfig, 
          isActive: botConfig.isActive ?? true,
          currentEscalation: botConfig.currentEscalation ?? 0,
          autoTimerEnabled: botConfig.autoTimerEnabled ?? false,
          initialMission: botConfig.initialMission || "",
          currentMission: botConfig.initialMission || "", 
        },
        botScenarioId: botScenarioId, 
      };

      const existingBotDetails = firestoreBotsMap.get(botScenarioId);
      if (!existingBotDetails) {
        const newBotDocRef = doc(collection(db, "sessions", sId, "participants")); 
        batch.set(newBotDocRef, { ...botDataForFirestore, id: newBotDocRef.id, joinedAt: serverTimestamp() });
        operationsInBatch++;
        console.log(`AdminDashboard: Adding new bot: ${botDataForFirestore.name} (ScenarioID: ${botScenarioId}) to session ${sId}`);
      } else {
        const botDocRef = doc(participantsColRef, existingBotDetails.docId);
        const existingBotData = existingBotDetails.data;
        
        const updatedBotConfig: BotConfig = {
            ...(existingBotData?.botConfig || {} as BotConfig), // Start with existing or empty
            ...botConfig, // Overlay with scenario config
            // Explicitly carry over runtime states or default from scenario if not present
            isActive: existingBotData?.botConfig?.isActive ?? botConfig.isActive ?? true,
            currentEscalation: existingBotData?.botConfig?.currentEscalation ?? botConfig.currentEscalation ?? 0,
            autoTimerEnabled: existingBotData?.botConfig?.autoTimerEnabled ?? botConfig.autoTimerEnabled ?? false,
            currentMission: existingBotData?.botConfig?.currentMission ?? botConfig.initialMission ?? "",
            id: botScenarioId, // Ensure scenario ID is primary
        };

        const updateData: Partial<Participant> & { [key: string]: any } = {
            name: botDisplayName,
            role: `Bot (${botConfig.personality || 'standard'})`,
            avatarFallback: botDataForFirestore.avatarFallback,
            botConfig: updatedBotConfig,
            botScenarioId: botScenarioId, 
        };
        batch.update(botDocRef, updateData);
        operationsInBatch++;
        console.log(`AdminDashboard: Updating existing bot: ${botDataForFirestore.name} (ScenarioID: ${botScenarioId}) in session ${sId}`);
      }
    }
    if (operationsInBatch > 0) {
        try {
            await batch.commit();
            console.log(`AdminDashboard: Bot initialization/sync batch commit successful for session ${sId}. Operations: ${operationsInBatch}`);
        } catch (e) {
            console.error(`AdminDashboard: Error committing bot initialization/sync batch for session ${sId}:`, e);
            toast({ variant: "destructive", title: "Bot Fehler", description: "Bots konnten nicht initialisiert/synchronisiert werden."});
        }
    } else {
        console.log(`AdminDashboard: No bot changes needed for session ${sId}.`);
    }
  }, [getBotDisplayName, toast]);

  // Effect to initialize bots when scenario and session are ready and active/paused
  useEffect(() => {
    if (currentScenario && sessionData && (sessionData.status === 'active' || sessionData.status === 'paused') && !isLoadingScenario && !isLoadingSessionData) {
      console.log("AdminDashboard: Conditions met for initializing bots. Scenario:", currentScenario.title, "Session Status:", sessionData.status);
      initializeBotsForSession(currentScenario, sessionId);
    } else {
      console.log("AdminDashboard: Conditions NOT met for initializing bots.", {isLoadingScenario, isLoadingSessionData, currentScenarioExists: !!currentScenario, sessionDataExists: !!sessionData, sessionStatus: sessionData?.status});
    }
  }, [currentScenario, sessionData, sessionId, isLoadingScenario, isLoadingSessionData, initializeBotsForSession]);


  // Effect to listen for participants
  useEffect(() => {
    if (!sessionId || pageError) { // Don't setup if there's already a page error
      setIsLoadingParticipants(false);
      return;
    }
    setIsLoadingParticipants(true);
    console.log(`AdminDashboard: Setting up participant listener for session ${sessionId}`);
    const participantsColRef = collection(db, "sessions", sessionId, "participants");
    // Sort by joinedAt on Firestore side to simplify client-side logic, then further sort client-side
    const participantsQuery = query(participantsColRef, orderBy("joinedAt", "asc")); 
    
    const unsubscribeParticipants = onSnapshot(participantsQuery, (querySnapshot) => {
      console.log(`AdminDashboard: Participant snapshot received. Docs count: ${querySnapshot.docs.length}`);
      let fetchedParticipants: Participant[] = [];
      querySnapshot.forEach((docSn) => {
        fetchedParticipants.push({ id: docSn.id, ...docSn.data() } as Participant);
      });

      // Client-side sorting: Bots first, then by join time (which is already Firestore's primary sort)
      fetchedParticipants.sort((a, b) => {
        if (a.isBot && !b.isBot) return -1;
        if (!a.isBot && b.isBot) return 1;
        return 0; 
      });
      
      setSessionParticipants(fetchedParticipants);
      console.log("AdminDashboard: Updated sessionParticipants state:", fetchedParticipants.map(p => ({name: p.name, isBot: p.isBot, id: p.id}) ));
      
      const newBotMissionsState: Record<string, string> = {};
      fetchedParticipants.filter(p => p.isBot && p.botConfig).forEach(bot => {
        newBotMissionsState[bot.id] = bot.botConfig!.currentMission || bot.botConfig!.initialMission || "";
      });
      setBotMissions(prevMissions => ({...prevMissions, ...newBotMissionsState}));


      setIsLoadingParticipants(false);
    }, (error) => {
      console.error(`AdminDashboard: Error fetching participants for session ${sessionId}:`, error);
      setIsLoadingParticipants(false);
      setPageError(prevError => prevError || `Teilnehmer konnten nicht geladen werden: ${error.message}`);
      toast({ variant: "destructive", title: "Fehler Teilnehmerliste", description: `Teilnehmer konnten nicht geladen werden: ${error.message}` });
    });
    return () => {
      console.log(`AdminDashboard: Cleaning up participant listener for session ${sessionId}`);
      unsubscribeParticipants();
    };
  }, [sessionId, toast, pageError]); // Re-run if pageError changes (e.g., gets cleared)

  // Effect to listen for messages (simplified admin preview)
  useEffect(() => {
    if (!sessionId || showParticipantMirrorView || pageError) { // Only load if not showing full mirror and no page error
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
      console.error(`AdminDashboard: Error fetching messages for session ${sessionId}:`, error);
      setIsLoadingMessages(false);
      setPageError(prevError => prevError || "Nachrichten konnten nicht geladen werden.");
      toast({ variant: "destructive", title: "Fehler Chatverlauf", description: "Nachrichten konnten nicht geladen werden." });
    });
    return () => unsubscribeMessages();
  }, [sessionId, showParticipantMirrorView, toast, pageError]);

  // Auto-scroll for admin chat preview
  useEffect(() => {
    if (!showParticipantMirrorView && adminChatPreviewEndRef.current) {
      adminChatPreviewEndRef.current.scrollIntoView({ behavior: "smooth" });
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
    if (!sessionId || !sessionData) {
       console.warn("AdminDashboard: Cannot generate new token, session ID or data missing.");
       return;
    }
    setIsGeneratingLink(true);
    const newSessionToken = generateToken();
    const sessionDocRef = doc(db, "sessions", sessionId);
    try {
      await updateDoc(sessionDocRef, { invitationToken: newSessionToken, updatedAt: serverTimestamp() });
      toast({ title: "Neuer Einladungslink generiert", description: "Der Token wurde aktualisiert." });
    } catch (error) {
      console.error(`AdminDashboard: Error generating new invitation token for session ${sessionId}:`, error);
      toast({ variant: "destructive", title: "Fehler", description: "Neuer Link-Token konnte nicht generiert werden." });
    } finally {
      setIsGeneratingLink(false);
    }
  }, [sessionId, sessionData, toast]);

  const handleStartRestartSession = useCallback(async () => {
    if (!sessionId) {
        toast({variant: "destructive", title: "Aktion fehlgeschlagen", description: "Sitzungs-ID fehlt."});
        return;
    }
    if (!currentScenario) {
        toast({variant: "destructive", title: "Aktion fehlgeschlagen", description: "Szenarioinformationen sind noch nicht geladen oder fehlen."});
        console.error("AdminDashboard: Cannot start/restart session, currentScenario is null or undefined.");
        setIsStartingOrRestartingSession(false);
        return;
    }
    setIsStartingOrRestartingSession(true);
    console.log(`AdminDashboard: Attempting to start/restart session ${sessionId} for scenario ${currentScenario.title}`);
    const sessionDocRef = doc(db, "sessions", sessionId);
    let baseLink = "";
     if (typeof window !== "undefined") {
        baseLink = `${window.location.origin}/join/${sessionId}`;
    }
    const newSessionToken = generateToken();

    const sessionUpdateData: Partial<SessionData> = {
        status: "active",
        messageCooldownSeconds: sessionData?.messageCooldownSeconds ?? DEFAULT_COOLDOWN,
        scenarioId: currentScenario.id, 
        invitationLink: baseLink,
        invitationToken: newSessionToken,
        updatedAt: serverTimestamp(),
    };
    if (sessionData?.status === "ended" || !sessionData) { 
        sessionUpdateData.createdAt = serverTimestamp();
        sessionUpdateData.messageCooldownSeconds = DEFAULT_COOLDOWN;
    }

    try {
        await setDoc(sessionDocRef, sessionUpdateData, { merge: true });
        console.log(`AdminDashboard: Session ${sessionId} started/restarted. Calling initializeBotsForSession.`);
        await initializeBotsForSession(currentScenario, sessionId); 
        toast({ title: "Sitzung gestartet/aktualisiert", description: "Die Sitzung ist jetzt aktiv." });
    } catch (error) {
        console.error(`AdminDashboard: Error starting/restarting session ${sessionId}:`, error);
        toast({ variant: "destructive", title: "Fehler", description: "Sitzung konnte nicht gestartet/aktualisiert werden." });
    } finally {
        setIsStartingOrRestartingSession(false);
    }
  }, [sessionId, currentScenario, sessionData, toast, initializeBotsForSession]);

  const handleResetSession = useCallback(async () => {
    if (!sessionId) {
        toast({variant: "destructive", title: "Aktion fehlgeschlagen", description: "Sitzungs-ID fehlt."});
        return;
    }
    if (!currentScenario) {
        toast({variant: "destructive", title: "Aktion fehlgeschlagen", description: "Szenarioinformationen sind noch nicht geladen oder fehlen."});
        console.error("AdminDashboard: Cannot reset session, currentScenario is null or undefined.");
        setIsResettingSession(false);
        return;
    }
    setIsResettingSession(true);
    console.log(`AdminDashboard: Attempting to reset session ${sessionId} for scenario ${currentScenario.title}`);
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
      console.log(`AdminDashboard: All messages and participants deleted for session ${sessionId} reset.`);

      let baseLink = "";
      if (typeof window !== "undefined") {
        baseLink = `${window.location.origin}/join/${sessionId}`;
      }
      const newSessionToken = generateToken();
      const newSessionData: SessionData = {
        scenarioId: currentScenario.id,
        createdAt: serverTimestamp(),
        invitationLink: baseLink,
        invitationToken: newSessionToken,
        status: "active",
        messageCooldownSeconds: DEFAULT_COOLDOWN,
      };
      await setDoc(sessionDocRef, newSessionData); 
      console.log(`AdminDashboard: New session document created for ${sessionId} after reset. Calling initializeBotsForSession.`);
      await initializeBotsForSession(currentScenario, sessionId); 

      toast({ title: "Sitzung zurückgesetzt", description: "Alle Teilnehmer und Nachrichten wurden gelöscht. Sitzung neu gestartet." });
    } catch (error) {
      console.error(`AdminDashboard: Error resetting session ${sessionId}:`, error);
      toast({ variant: "destructive", title: "Fehler", description: "Sitzung konnte nicht zurückgesetzt werden." });
    } finally {
      setIsResettingSession(false);
    }
  }, [sessionId, currentScenario, toast, initializeBotsForSession]);


  const handleEndSession = useCallback(async () => {
    if (!sessionId) return;
    setIsEndingSession(true);
    const sessionDocRef = doc(db, "sessions", sessionId);
    try {
      await updateDoc(sessionDocRef, { status: "ended", updatedAt: serverTimestamp() });
      toast({ title: "Sitzung beendet", description: "Die Sitzung wurde als beendet markiert." });
    } catch (error) {
      console.error(`AdminDashboard: Error ending session ${sessionId}:`, error);
      toast({ variant: "destructive", title: "Fehler", description: "Sitzung konnte nicht beendet werden." });
    } finally {
        setIsEndingSession(false);
    }
  }, [sessionId, toast]);

  const handleToggleSimulationActive = useCallback(async (isActive: boolean) => {
    if (!sessionId || !sessionData || sessionData.status === "ended") return;
    const newStatus = isActive ? "active" : "paused";
    const sessionDocRef = doc(db, "sessions", sessionId);
    try {
      await updateDoc(sessionDocRef, { status: newStatus, updatedAt: serverTimestamp() });
      toast({ title: "Simulationsstatus geändert", description: `Simulation ist jetzt ${newStatus === 'active' ? 'aktiv' : 'pausiert'}.` });
    } catch (error) {
      console.error(`AdminDashboard: Error toggling simulation active for session ${sessionId}:`, error);
      toast({ variant: "destructive", title: "Fehler", description: "Simulationsstatus konnte nicht geändert werden." });
    }
  }, [sessionId, sessionData, toast]);

  const handlePaceChangeCommit = useCallback(async (newPaceValues: number[]) => {
    if (!sessionId || !sessionData || sessionData.status === "ended") return;
    const newCooldown = newPaceValues[0];
    setPaceValue(newCooldown); // Optimistically update local state for slider feel
    const sessionDocRef = doc(db, "sessions", sessionId);
    try {
      await updateDoc(sessionDocRef, { messageCooldownSeconds: newCooldown, updatedAt: serverTimestamp() });
      // paceValue state will update from onSnapshot listener to sessionData eventually
    } catch (error) {
      console.error(`AdminDashboard: Error updating pace for session ${sessionId}:`, error);
      toast({ variant: "destructive", title: "Fehler", description: "Pace konnte nicht angepasst werden." });
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
    } catch (error) {
      console.error(`AdminDashboard: Error muting all users for session ${sessionId}:`, error);
      toast({ variant: "destructive", title: "Fehler", description: "Teilnehmer konnten nicht alle stummgeschaltet werden." });
    }
  }, [sessionId, sessionData, toast]);

  const handleToggleMuteParticipant = useCallback(async (participantId: string, currentMuteStatus: boolean | undefined) => {
    if (!sessionId || !sessionData || sessionData.status === "ended") return;
    const participantDocRef = doc(db, "sessions", sessionId, "participants", participantId);
    try {
      await updateDoc(participantDocRef, { isMuted: !currentMuteStatus });
      toast({ title: `Teilnehmer ${!currentMuteStatus ? 'stummgeschaltet' : 'freigeschaltet'}` });
    } catch (error) {
      console.error(`AdminDashboard: Error toggling mute for participant ${participantId} in session ${sessionId}:`, error);
      toast({ variant: "destructive", title: "Fehler", description: "Stummschaltung konnte nicht geändert werden." });
    }
  }, [sessionId, sessionData, toast]);

  const handleToggleBotActive = useCallback(async (botParticipantId: string, currentActiveStatus: boolean) => {
    if (!sessionId || !sessionData || sessionData.status === "ended") return;
    const botDocRef = doc(db, "sessions", sessionId, "participants", botParticipantId);
    try {
      await updateDoc(botDocRef, { "botConfig.isActive": !currentActiveStatus });
      toast({ title: `Bot ${!currentActiveStatus ? 'aktiviert' : 'deaktiviert'}` });
    } catch (error: any) {
      console.error(`AdminDashboard: Error toggling bot active state for bot ${botParticipantId} in session ${sessionId}:`, error);
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
      console.error(`AdminDashboard: Error changing bot escalation for bot ${botParticipantId} in session ${sessionId}:`, error);
      toast({ variant: "destructive", title: "Fehler", description: `Bot-Eskalation konnte nicht geändert werden: ${error.message}` });
    }
  }, [sessionId, sessionData, sessionParticipants, toast]);

  const handleBotAutoTimerToggle = useCallback(async (botParticipantId: string, currentAutoTimerStatus: boolean) => {
     if (!sessionId || !sessionData || sessionData.status === "ended") return;
    const botDocRef = doc(db, "sessions", sessionId, "participants", botParticipantId);
    try {
      await updateDoc(botDocRef, { "botConfig.autoTimerEnabled": !currentAutoTimerStatus });
      toast({ title: `Bot Auto-Timer ${!currentAutoTimerStatus ? 'aktiviert' : 'deaktiviert'}` });
    } catch (error: any) {
      console.error(`AdminDashboard: Error toggling bot auto-timer for bot ${botParticipantId} in session ${sessionId}:`, error);
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
        console.log(`AdminDashboard: No mission in local state for bot ${botParticipantId} to save to Firestore.`);
        return;
    }
    console.log(`AdminDashboard: Attempting to update mission for bot ${botParticipantId} in session ${sessionId} to: "${missionToSave}"`);
    const botDocRef = doc(db, "sessions", sessionId, "participants", botParticipantId);
    try {
      await updateDoc(botDocRef, { "botConfig.currentMission": missionToSave });
      toast({ title: "Bot-Mission aktualisiert."});
    } catch (error: any) {
      console.error(`AdminDashboard: Error updating bot mission in Firestore for bot ${botParticipantId} in session ${sessionId}:`, error);
      toast({ variant: "destructive", title: "Fehler Bot-Mission", description: `Bot-Mission konnte nicht gespeichert werden: ${error.message}` });
    }
  }, [sessionId, toast, botMissions]);


  const handlePostForBot = useCallback(async (botParticipant: Participant) => {
    if (!sessionId || !currentScenario || !botParticipant.botConfig || !sessionData) {
        toast({variant: "destructive", title: "Aktion fehlgeschlagen", description: "Notwendige Daten für Bot-Post fehlen."});
        return;
    }
    setIsPostingForBot(botParticipant.id);
    
    const missionForThisPost = botMissions[botParticipant.id] ?? botParticipant.botConfig.currentMission ?? botParticipant.botConfig.initialMission ?? "";
    console.log(`AdminDashboard: Posting for bot ${botParticipant.name} with mission: "${missionForThisPost}"`);

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
      console.error(`AdminDashboard: Error posting for bot ${botParticipant.name} in session ${sessionId}:`, error);
      toast({ variant: "destructive", title: "Fehler beim Posten für Bot", description: error.message || "Nachricht konnte nicht generiert oder gesendet werden." });
    } finally {
      setIsPostingForBot(null);
    }
  }, [sessionId, currentScenario, sessionData, chatMessages, toast, botMissions]);


  const handleRemoveParticipant = useCallback(async (participantId: string) => {
    if (!sessionId) return;
    setIsRemovingParticipant(participantId);
    try {
      const participantDocRef = doc(db, "sessions", sessionId, "participants", participantId);
      await deleteDoc(participantDocRef);
      toast({ title: "Teilnehmer entfernt", description: "Der Teilnehmer wurde erfolgreich aus der Sitzung entfernt." });
    } catch (error) {
      console.error(`AdminDashboard: Error removing participant ${participantId} from session ${sessionId}:`, error);
      toast({ variant: "destructive", title: "Fehler", description: "Teilnehmer konnte nicht entfernt werden." });
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
    } catch (error) {
      console.error(`AdminDashboard: Error removing all participants from session ${sessionId}:`, error);
      toast({ variant: "destructive", title: "Fehler", description: "Teilnehmer konnten nicht entfernt werden." });
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
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' }); // Added BOM for Excel
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


  const scenarioTitle = currentScenario?.title || (isLoadingScenario ? "Szenario lädt..." : "Szenario nicht gefunden");
  const expectedStudentRoles = currentScenario?.humanRolesConfig?.length || 0;


  const displayParticipantsList: Participant[] = [...sessionParticipants];
  if (currentScenario && !isLoadingParticipants && !isLoadingScenario && displayParticipantsList.filter(p => !p.isBot).length < expectedStudentRoles) {
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
                joinedAt: new Timestamp(0,0), 
            });
            placeholderIndex++;
        }
    });
  }


  const isSessionEnded = sessionData?.status === "ended";
  const getStartRestartButtonText = () => {
    if (isStartingOrRestartingSession) return "Wird ausgeführt...";
    if (!sessionData || sessionData.status === 'ended') return "Sitzung starten";
    if (sessionData.status === 'paused') return "Fortsetzen & Initialisieren";
    return "Neu initialisieren";
  };

  if (isLoadingPage) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="items-center">
            <CardTitle className="flex items-center"><Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />Lade Dashboard...</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground">Szenario- und Sitzungsdaten werden abgerufen...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (pageError && !currentScenario) { // Show critical page error if scenario couldn't be loaded
     return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6">
        <Card className="w-full max-w-lg">
          <CardHeader className="items-center">
            <CardTitle className="text-destructive flex items-center"><AlertCircle className="mr-2 h-6 w-6"/> Fehler beim Laden des Dashboards</CardTitle>
            <CardDescription>{pageError}</CardDescription>
            </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
             <p className="text-sm text-muted-foreground">
                Stellen Sie sicher, dass die Szenario-ID gültig ist und das Szenario in der Datenbank existiert.
                Überprüfen Sie auch Ihre Netzwerkverbindung und Firestore-Sicherheitsregeln.
             </p>
            <Button onClick={() => router.push('/admin')} variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4"/> Zurück zur Szenarienübersicht
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  if (!currentScenario) { 
     return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="items-center">
            <CardTitle className="text-destructive flex items-center"><AlertCircle className="mr-2 h-6 w-6"/> Szenario nicht geladen</CardTitle>
            <CardDescription>Das zugehörige Szenario konnte nicht geladen werden. Bitte überprüfen Sie die Szenario-ID oder wählen Sie ein anderes Szenario.</CardDescription>
            </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={() => router.push('/admin')} variant="outline">
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
          <p className="text-muted-foreground text-xs md:text-sm">Sitzungs-ID: {sessionId}</p>
        </div>
        <div className="flex items-center gap-2">
           <Link href={`/admin/scenario-editor/${sessionId}`} passHref legacyBehavior>
            <Button variant="outline">
                <NotebookPen className="mr-2 h-4 w-4" /> Szenario bearbeiten
            </Button>
          </Link>
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
                <AlertDialogAction onClick={handleEndSession} disabled={isEndingSession} className="bg-red-600 hover:bg-red-700">
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
                initialUserId="ADMIN_USER_ID_FIXED" // Ensure this is a unique and fixed ID for the admin user
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
                  <CardTitle className="flex items-center"><LayoutDashboard className="mr-2 h-5 w-5 text-primary" /> Sitzungseinstellungen & Einladung</CardTitle>
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
                            <NextImage src={msg.imageUrl} alt="Bild im Chat" width={200} height={150} className="rounded max-w-xs max-h-32 object-contain" data-ai-hint="chat image"/>
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
                    <CardTitle className="flex items-center"><Wand2 className="mr-2 h-5 w-5 text-primary" /> Ereignis-Steuerung (Zukunft)</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        Hier können Sie bald vordefinierte oder spontane Ereignisse in die laufende Simulation einfügen,
                        um die Dynamik zu beeinflussen oder spezifische Lernziele zu testen.
                        (z.B. "Neue Fake News posten", "Account eines Teilnehmers wird 'gehackt'", "Plötzliche positive Wendung").
                    </p>
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
                                    {isResettingSession ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RotateCcw className="mr-2 h-4 w-4" />}
                                     Sitzung zurücksetzen
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
                            onValueCommit={handlePaceChangeCommit} 
                            disabled={isSessionEnded || isStartingOrRestartingSession || isResettingSession || !sessionData || sessionData.status !== 'active'}
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <Label htmlFor="simulation-active" className="text-base">
                            Simulation Aktiv <Badge variant={sessionData?.status === 'active' ? 'default' : (sessionData?.status === "paused" ? "secondary" : "destructive")}
                                                className={sessionData?.status === 'active' ? 'bg-green-500 hover:bg-green-600' : (sessionData?.status === "paused" ? 'bg-amber-500 hover:bg-amber-600' : 'bg-red-500 hover:bg-red-500')}
                                            >
                                            {sessionData?.status === 'active' ? <Play className="mr-1.5 h-3.5 w-3.5"/> : (sessionData?.status === "paused" ? <Pause className="mr-1.5 h-3.5 w-3.5"/> : <Power className="mr-1.5 h-3.5 w-3.5"/>)}
                                            {sessionData?.status || (isLoadingSessionData ? "Laden..." : "Unbekannt")}
                                        </Badge>
                        </Label>
                        <Switch
                            id="simulation-active"
                            checked={sessionData?.status === "active"}
                            onCheckedChange={handleToggleSimulationActive}
                            disabled={isSessionEnded || isStartingOrRestartingSession || isResettingSession || !sessionData}
                        />
                    </div>
                     <div className="flex items-center space-x-2">
                        <Button variant="outline" onClick={handleMuteAllUsers} disabled={isSessionEnded || isStartingOrRestartingSession || isResettingSession || !sessionData || sessionData.status !== 'active'}>
                            <VolumeX className="mr-2 h-4 w-4" /> Alle Stummschalten
                        </Button>
                         <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" className="bg-orange-600 hover:bg-orange-700" disabled={isSessionEnded || isRemovingAllParticipants || isLoadingParticipants || !sessionData || sessionData.status !== 'active'}>
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
                            disabled={isSessionEnded || p.id.startsWith("student-placeholder") || isStartingOrRestartingSession || isResettingSession || !sessionData || sessionData.status !== 'active'}
                        >
                            {p.isMuted ? <Volume2 className="mr-1 h-4 w-4" /> : <VolumeX className="mr-1 h-4 w-4" />}
                            {p.isMuted ? "Frei" : "Stumm"}
                        </Button>
                        {!p.id.startsWith("student-placeholder") && (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 h-8 w-8"
                                 disabled={isSessionEnded || isRemovingParticipant === p.id || isStartingOrRestartingSession || isResettingSession || !sessionData || sessionData.status !== 'active'}>
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
                     const currentBotMissionForInput = botMissions[botParticipant.id] ?? botConfig.currentMission ?? botConfig.initialMission ?? "";

                    return (
                      <div key={botParticipant.id} className="p-3 border rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold">{botName} <Badge variant={botIsActive ? "default" : "outline"} className={botIsActive ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-400 hover:bg-gray-500'}>{botIsActive ? "Aktiv" : "Inaktiv"}</Badge> <span className="text-xs text-muted-foreground">(ID: {botParticipant.botScenarioId || 'N/A'})</span></p>
                          <Switch
                            checked={botIsActive}
                            onCheckedChange={() => handleToggleBotActive(botParticipant.id, botIsActive)}
                            disabled={isSessionEnded || isStartingOrRestartingSession || isResettingSession || !sessionData || sessionData.status !== 'active'}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Eskalationslevel: {botEscalation}</Label>
                          <Progress value={botEscalation * 33.33} className="h-2" />
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleBotEscalationChange(botParticipant.id, "increase")} disabled={isSessionEnded || isStartingOrRestartingSession || isResettingSession || botEscalation >= 3 || !botIsActive || !sessionData || sessionData.status !== 'active'}><ChevronUp className="h-4 w-4" /></Button>
                          <Button variant="outline" size="sm" onClick={() => handleBotEscalationChange(botParticipant.id, "decrease")} disabled={isSessionEnded || isStartingOrRestartingSession || isResettingSession || botEscalation <= 0 || !botIsActive || !sessionData || sessionData.status !== 'active'}><ChevronDown className="h-4 w-4" /></Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="flex-1"
                            onClick={() => handlePostForBot(botParticipant)}
                            disabled={isSessionEnded || isStartingOrRestartingSession || isResettingSession || isPostingForBot === botParticipant.id || !botIsActive || !sessionData || sessionData.status !== 'active'}
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
                            disabled={isSessionEnded || isStartingOrRestartingSession || isResettingSession || !botIsActive || !sessionData || sessionData.status !== 'active'}
                          />
                        </div>
                        <div className="flex items-center space-x-2 pt-1">
                          <Label htmlFor={`autotimer-bot-${botParticipant.id}`} className="text-xs">Auto-Timer</Label>
                          <Switch 
                            id={`autotimer-bot-${botParticipant.id}`} 
                            checked={botAutoTimer} 
                            disabled={isSessionEnded || isStartingOrRestartingSession || isResettingSession || !botIsActive || !sessionData || sessionData.status !== 'active'} 
                            onCheckedChange={() => handleBotAutoTimerToggle(botParticipant.id, botAutoTimer)}
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
          </>
        )}
      </div>
    </div>
  );
}

    
