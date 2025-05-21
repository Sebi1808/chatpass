"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AlertCircle, Bot, ChevronDown, ChevronUp, Download, MessageSquare, Play, Pause, QrCode, Users, Settings, Volume2, VolumeX, Copy, MessageCircle as MessageCircleIcon, Power, RotateCcw, RefreshCw, Eye, Brain, NotebookPen, Trash2, UserX, Loader2, ArrowLeft, Wand2, LayoutDashboard, Sparkles, AlertTriangle, CheckCircle, Users2, LogIn, PlayCircle as PlayCircleIcon, Clock, Lock, Unlock, UserPlus, Check, ArrowRightLeft, History, Info, Ban, Undo2, MicOff, Send, Edit2, MessageSquarePlus, BarChart2, CircleDollarSign, EyeOff, Filter, Flame, HelpCircle, Link as LinkIcon, LogOut, Mail, Mic, MoreVertical, PauseCircle, PlayCircle, PlusCircle, Repeat, Search, ShieldAlert, ShieldCheck, TrendingUp, UserCog, UserMinus, X, Zap, Hand, Megaphone, MessageSquare as MessageSquareIconLucide } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import type { Scenario, BotConfig, Participant, Message as MessageType, SessionData, ScenarioEvent, HumanRoleConfig } from "@/lib/types";
import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { db, storage } from "@/lib/firebase";
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
import NextImage from 'next/image'; // Renamed to avoid conflict
import { useRouter, useParams } from 'next/navigation'; // Added useParams
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";


interface AdminSessionDashboardPageProps {
  params: { sessionId: string };
}

interface AdminDashboardMessage extends MessageType {
  id: string;
  timestampDisplay: string;
}

const DEFAULT_COOLDOWN = 0; 
const SIMULATION_START_COUNTDOWN_SECONDS_FOR_PARTICIPANTS = 10; // For participants' view
const ADMIN_UI_LOCAL_COUNTDOWN_SECONDS_FOR_START = 5; // For admin's UI before setting status to 'active'


const generateToken = () => Math.random().toString(36).substring(2, 10);


export default function AdminSessionDashboardPage(props: AdminSessionDashboardPageProps) {
  const params = useParams(); // Use hook to get params
  const sessionIdFromUrl = params.sessionId as string; // Extract sessionId
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
  
  const isLoadingPage = isLoadingScenario || isLoadingSessionData; // Combined initial loading state

  const [isEndingSession, setIsEndingSession] = useState(false);
  const [isProcessingSessionAction, setIsProcessingSessionAction] = useState(false);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [showParticipantMirrorView, setShowParticipantMirrorView] = useState(false);
  const [isPostingForBot, setIsPostingForBot] = useState<string | null>(null);
  const [botMissions, setBotMissions] = useState<Record<string, string>>({});
  const [isRemovingParticipant, setIsRemovingParticipant] = useState<string | null>(null);
  const [isRemovingAllParticipants, setIsRemovingAllParticipants] = useState(false);
  const [adminUiCountdown, setAdminUiCountdown] = useState<number | null>(null);
  const [isMovingParticipant, setIsMovingParticipant] = useState<string | null>(null);
  const [isApplyingPenaltyOrMute, setIsApplyingPenaltyOrMute] = useState<string | null>(null);

  const [globalSettingsOpen, setGlobalSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("teilnehmer");

  // State for Admin Direct Message Modal
  const [showAdminDmModal, setShowAdminDmModal] = useState(false);
  const [adminDmRecipient, setAdminDmRecipient] = useState<Participant | null>(null);
  const [adminDmContent, setAdminDmContent] = useState("");
  const [isSendingAdminDm, setIsSendingAdminDm] = useState(false);

  // State for Admin Standard Direct Message Modal
  const [showAdminStandardDmModal, setShowAdminStandardDmModal] = useState(false);
  const [adminStandardDmRecipient, setAdminStandardDmRecipient] = useState<Participant | null>(null);
  const [adminStandardDmContent, setAdminStandardDmContent] = useState("");
  const [isSendingAdminStandardDm, setIsSendingAdminStandardDm] = useState(false);

  // State for Global Broadcast Modal
  const [showGlobalBroadcastModal, setShowGlobalBroadcastModal] = useState(false);
  const [globalBroadcastType, setGlobalBroadcastType] = useState<'all' | 'role'>('all');
  const [globalBroadcastTargetRoleId, setGlobalBroadcastTargetRoleId] = useState<string | null>(null);
  const [globalBroadcastContent, setGlobalBroadcastContent] = useState("");
  const [isSendingGlobalBroadcast, setIsSendingGlobalBroadcast] = useState(false);

  const adminCountdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [paceValue, setPaceValue] = useState<number>(DEFAULT_COOLDOWN);
  const adminChatPreviewEndRef = useRef<null | HTMLDivElement>(null);

  const getPenaltyTimeRemaining = (penalty: Participant['activePenalty']): string | null => {
    if (!penalty || !penalty.startedAt || !(penalty.startedAt instanceof Timestamp)) return null;
    const endTime = penalty.startedAt.toDate().getTime() + penalty.durationMinutes * 60 * 1000;
    const now = Date.now();
    const remainingMillis = endTime - now;

    if (remainingMillis <= 0) return null; // Return null if expired

    const remainingSeconds = Math.ceil(remainingMillis / 1000);
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;

    return `${minutes}m ${seconds < 10 ? '0' : ''}${seconds}s`;
  };

  // Effect 1: Load Scenario Details
  useEffect(() => {
    if (!sessionIdFromUrl) {
      setPageError("Keine Szenario-ID für das Dashboard vorhanden.");
      setIsLoadingScenario(false);
      return;
    }
    setIsLoadingScenario(true);
    setPageError(null);
    const scenarioDocRef = doc(db, "scenarios", sessionIdFromUrl);
    
    console.log(`AdminDashboard: Attempting to fetch scenario ${sessionIdFromUrl}`);
    const unsubscribeScenario = onSnapshot(scenarioDocRef, (docSnap) => {
      if (docSnap.exists()) {
        console.log(`AdminDashboard: Scenario ${sessionIdFromUrl} found.`);
        setCurrentScenario({ id: docSnap.id, ...docSnap.data() } as Scenario);
        setPageError(null);
      } else {
        console.error(`AdminDashboard: Scenario with ID ${sessionIdFromUrl} not found.`);
        setPageError(`Szenario mit ID ${sessionIdFromUrl} nicht gefunden. Bitte im Editor prüfen.`);
        setCurrentScenario(null);
      }
      setIsLoadingScenario(false);
    }, (error) => {
      console.error(`AdminDashboard: Error fetching scenario ${sessionIdFromUrl}:`, error);
      setPageError("Szenario konnte nicht geladen werden. Fehler: " + error.message);
      setCurrentScenario(null);
      setIsLoadingScenario(false);
    });
  
    return () => unsubscribeScenario();
  }, [sessionIdFromUrl]);

  // Effect 2: Ensure Session Document and Load Session Data (depends on sessionIdFromUrl)
   useEffect(() => {
    if (!sessionIdFromUrl) {
      setIsLoadingSessionData(false);
      return;
    }
    
    const sessionDocRef = doc(db, "sessions", sessionIdFromUrl);

    const ensureSessionDocument = async () => {
      console.log(`AdminDashboard: Ensuring session document for ${sessionIdFromUrl}`);
      try {
        const docSnap = await getDoc(sessionDocRef);
        const updates: Partial<SessionData> = { scenarioId: sessionIdFromUrl };
        let needsUpdateOrCreation = false;

        if (!docSnap.exists()) {
          needsUpdateOrCreation = true;
          updates.createdAt = serverTimestamp() as Timestamp;
          updates.status = "pending"; 
          updates.messageCooldownSeconds = DEFAULT_COOLDOWN;
          updates.invitationToken = generateToken();
          updates.roleSelectionLocked = false;
          updates.simulationStartCountdownEndTime = null;
          if (typeof window !== "undefined") {
            updates.invitationLink = `${window.location.origin}/join/${sessionIdFromUrl}`;
          } else {
             updates.invitationLink = `/join/${sessionIdFromUrl}`; 
          }
          console.log(`AdminDashboard: Session doc for ${sessionIdFromUrl} does not exist. Creating with:`, updates);
          await setDoc(sessionDocRef, updates);
          console.log(`AdminDashboard: Created new session document for ${sessionIdFromUrl}`);
        } else {
          const data = docSnap.data() as SessionData;
          console.log(`AdminDashboard: Session doc for ${sessionIdFromUrl} exists. Data:`, data);
          if (!data.invitationToken) { updates.invitationToken = generateToken(); needsUpdateOrCreation = true; }
          
          let baseLink = "";
           if (typeof window !== "undefined") {
            baseLink = `${window.location.origin}/join/${sessionIdFromUrl}`;
           } else {
             baseLink = `/join/${sessionIdFromUrl}`;
           }

          if (!data.invitationLink || !data.invitationLink.startsWith(baseLink.split('?')[0])) { 
            updates.invitationLink = baseLink; needsUpdateOrCreation = true; 
          }
          if (data.scenarioId !== sessionIdFromUrl) { updates.scenarioId = sessionIdFromUrl; needsUpdateOrCreation = true; }
          if (typeof data.roleSelectionLocked === 'undefined') { updates.roleSelectionLocked = false; needsUpdateOrCreation = true; }
          if (typeof data.simulationStartCountdownEndTime === 'undefined') { updates.simulationStartCountdownEndTime = null; needsUpdateOrCreation = true; } 
          if (data.status === undefined) { updates.status = "pending"; needsUpdateOrCreation = true;}
          
          if (needsUpdateOrCreation) {
            updates.updatedAt = serverTimestamp() as Timestamp;
            console.log(`AdminDashboard: Session doc for ${sessionIdFromUrl} needs update. Updating with:`, updates);
            await updateDoc(sessionDocRef, updates);
            console.log(`AdminDashboard: Updated session document for ${sessionIdFromUrl}`);
          }
        }
      } catch (error: any) {
        console.error(`AdminDashboard: Error ensuring session document for ${sessionIdFromUrl}:`, error);
        setPageError(prev => prev || `Sitzungsdokument konnte nicht initialisiert/aktualisiert werden: ${error.message}`);
      }
    };

    ensureSessionDocument(); 
    
    setIsLoadingSessionData(true);
    const unsubscribeSession = onSnapshot(sessionDocRef, (docSn) => {
      if (docSn.exists()) {
        const data = docSn.data() as SessionData;
        console.log(`AdminDashboard: onSnapshot for session ${sessionIdFromUrl} received data:`, data);
        setSessionData(data);
        setPaceValue(data.messageCooldownSeconds ?? DEFAULT_COOLDOWN);
         // Clear page error if session data is successfully loaded after a previous error
        if (pageError && pageError.includes("Sitzungsdokument konnte nicht initialisiert")) {
            setPageError(null);
        }
      } else {
         console.warn(`AdminDashboard: onSnapshot - Session document ${sessionIdFromUrl} does not exist (might be created shortly or there's an issue).`);
         // Don't set sessionData to null immediately, wait for ensureSessionDocument
         // setSessionData(null); 
         setPageError(prev => prev || "Sitzungsdokument konnte nicht gefunden werden. Versuchen Sie die Seite neu zu laden.");
      }
      setIsLoadingSessionData(false);
    }, (error: any) => {
      console.error(`AdminDashboard: Error listening to session data for ${sessionIdFromUrl}:`, error);
      setPageError(prev => prev || `Sitzungsstatus konnte nicht geladen werden: ${error.message}`);
      setSessionData(null);
      setIsLoadingSessionData(false);
    });
    
    return () => {
      console.log(`AdminDashboard: Unsubscribing from session data for ${sessionIdFromUrl}`);
      unsubscribeSession();
    };
  }, [sessionIdFromUrl, pageError]); // Added pageError to dependencies to potentially clear it


  const displayedInvitationLink = useMemo(() => {
    if (sessionData?.invitationLink && sessionData.invitationToken) {
      return `${sessionData.invitationLink}?token=${sessionData.invitationToken}`;
    }
    return "Wird generiert...";
  }, [sessionData]);


  const getBotDisplayName = useCallback((botConfig: BotConfig): string => {
    if (botConfig.name && botConfig.name.trim() !== "") return botConfig.name;
    const personality = botConfig.personality || 'standard';
    return `Bot ${personality.charAt(0).toUpperCase() + personality.slice(1).substring(0,3)} (${(botConfig.id || 'X').slice(-2)})`;
  }, []);

  const initializeBotsForSession = useCallback(async () => {
    if (!currentScenario || !sessionIdFromUrl || !sessionData ) {
      console.warn("AdminDashboard: initializeBotsForSession: Prerequisites missing. Scenario:", currentScenario, "SessionData:", sessionData);
      if (!currentScenario) {
         toast({variant: "destructive", title: "Bot Fehler", description: "Szenario-Daten nicht geladen, Bots können nicht initialisiert werden."});
      }
      return;
    }
    
    setIsProcessingSessionAction(true);
    const scenarioBotsConfig = currentScenario.defaultBotsConfig || [];
    if (!Array.isArray(scenarioBotsConfig)) {
      console.error("AdminDashboard: scenarioBotsConfig is not an array!", scenarioBotsConfig);
      toast({variant: "destructive", title: "Konfigurationsfehler", description: "Bot-Konfiguration im Szenario ist fehlerhaft."});
        setIsProcessingSessionAction(false);
        return;
    }

    const participantsColRef = collection(db, "sessions", sessionIdFromUrl, "participants");
    const existingParticipantsSnap = await getDocs(query(participantsColRef, where("isBot", "==", true)));
    const existingBotsData = existingParticipantsSnap.docs.map(d => ({docId: d.id, data: d.data() as Participant}));

    const batch = writeBatch(db);
    let operationsInBatch = 0;
        
        for (const botConfig of scenarioBotsConfig) {
            const botScenarioId = botConfig.id;
            if (!botScenarioId) {
            console.warn("AdminDashboard: Bot config missing ID, skipping bot:", botConfig);
                continue;
            }
            const botDisplayName = getBotDisplayName(botConfig);
        const existingBotDetails = existingBotsData.find(b => b.docId === `bot-${botScenarioId}`);
            
            const participantDataForBot: Omit<Participant, 'id' | 'joinedAt'> & { id?: string, joinedAt?: Timestamp, updatedAt?: Timestamp} = { 
                userId: `bot-${botScenarioId}`, 
            realName: "Bot",
            displayName: botDisplayName, 
            role: botConfig.name || "Bot", // Use botConfig.name as role, or default to "Bot"
            roleId: botConfig.id || "bot-role", // Use botConfig.id as roleId
            avatarFallback: botConfig.avatarFallback || botDisplayName.substring(0,1).toUpperCase() || "B",
                isBot: true,
            status: "Beigetreten", // Corrected status
            updatedAt: serverTimestamp() as Timestamp,
                botConfig: {
                    ...botConfig, 
                    name: botDisplayName, 
                    isActive: existingBotDetails?.data.botConfig?.isActive ?? botConfig.isActive ?? true,
                    currentEscalation: existingBotDetails?.data.botConfig?.currentEscalation ?? botConfig.currentEscalation ?? 0,
                    autoTimerEnabled: existingBotDetails?.data.botConfig?.autoTimerEnabled ?? botConfig.autoTimerEnabled ?? false,
                    initialMission: botConfig.initialMission || "",
                    currentMission: botMissions[existingBotDetails?.docId || `bot-${botScenarioId}`] || 
                                    (existingBotDetails?.data.botConfig?.currentMission && existingBotDetails.data.botConfig.currentMission !== botConfig.initialMission 
                                        ? existingBotDetails.data.botConfig.currentMission 
                                        : botConfig.initialMission || ""),
                },
            };

            const botDocRef = doc(participantsColRef, `bot-${botScenarioId}`); 
            
            if (!existingBotDetails) {
                console.log(`AdminDashboard: Creating new bot ${botDocRef.id} with data:`, participantDataForBot);
            batch.set(botDocRef, { ...participantDataForBot, id: botDocRef.id, status: "Beigetreten", joinedAt: serverTimestamp() as Timestamp });
            } else {
            const updateData: Partial<Participant> = { ...participantDataForBot, status: "Beigetreten", updatedAt: serverTimestamp() as Timestamp };
                delete updateData.id; 
                delete updateData.joinedAt;
                console.log(`AdminDashboard: Updating existing bot ${botDocRef.id} with data:`, updateData);
                batch.update(botDocRef, updateData);
            }
            operationsInBatch++;
        }
        
        if (operationsInBatch > 0) {
            await batch.commit();
            toast({ title: "Bots initialisiert/synchronisiert", description: `${operationsInBatch} Bot-Operationen durchgeführt.`});
        } else {
            toast({ title: "Bots", description: "Keine Änderungen an den Bots erforderlich."});
    }
  }, [sessionIdFromUrl, currentScenario, sessionData, getBotDisplayName, toast, botMissions]);

  // Effect 3: Load Participants (depends on sessionData)
  useEffect(() => {
    if (!sessionIdFromUrl || !sessionData) {
      setIsLoadingParticipants(false);
      setSessionParticipants([]);
      return;
    }
    setIsLoadingParticipants(true);
    const participantsColRef = collection(db, "sessions", sessionIdFromUrl, "participants");
    // Sort only by joinedAt for Firestore, secondary sort (bots first) will be client-side
    const q_participants = query(participantsColRef, orderBy("joinedAt", "asc"));
    
    console.log(`AdminDashboard: Setting up participants listener for session ${sessionIdFromUrl}`);
    const unsubscribeParticipants = onSnapshot(q_participants, (querySnapshot) => {
      console.log(`AdminDashboard: Participants snapshot received. Count: ${querySnapshot.docs.length}`);
      let fetchedParticipants: Participant[] = [];
      querySnapshot.forEach((docSn) => {
        fetchedParticipants.push({ id: docSn.id, ...docSn.data() } as Participant);
      });
      
      fetchedParticipants.sort((a, b) => {
        if (a.isBot && !b.isBot) return -1;
        if (!a.isBot && b.isBot) return 1;
        return 0; 
      });
      
      setSessionParticipants(fetchedParticipants);
      console.log("AdminDashboard: Updated sessionParticipants state:", fetchedParticipants.map(p => ({id: p.id, name: p.displayName, isBot: p.isBot})));
      
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
      console.error(`AdminDashboard: Error fetching participants for session ${sessionIdFromUrl}:`, error);
      setIsLoadingParticipants(false);
      setSessionParticipants([]);
      if (error.message.includes("firestore/permission-denied") || error.message.includes("Missing or insufficient permissions")) {
        setPageError(prevError => prevError || `Fehlende Berechtigung zum Laden der Teilnehmer. Bitte Firestore-Regeln prüfen.`);
      } else if (error.message.includes("query requires an index")) {
         // This should be handled by client-side sort, but if it still occurs, it's a Firestore config issue.
         setPageError(prevError => prevError || `Firestore-Index für Teilnehmerabfrage fehlt (sollte client-seitig sortiert sein). Details: ${error.message}`);
      }
      else {
        setPageError(prevError => prevError || `Teilnehmer konnten nicht geladen werden: ${error.message}`);
      }
    });
    return () => unsubscribeParticipants();
  }, [sessionIdFromUrl, sessionData]);

  // Effect 4: Load Chat Messages (depends on sessionData)
  useEffect(() => {
    if (!sessionIdFromUrl || showParticipantMirrorView || !sessionData ) { 
      setIsLoadingMessages(false);
      setChatMessages([]);
      return;
    }
    setIsLoadingMessages(true);
    const messagesColRef = collection(db, "sessions", sessionIdFromUrl, "messages");
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
      console.error(`AdminDashboard: Error fetching messages for session ${sessionIdFromUrl}:`, error);
      setChatMessages([]);
      setIsLoadingMessages(false);
      setPageError(prevError => prevError || "Nachrichten konnten nicht geladen werden.");
    });
    return () => unsubscribeMessages();
  }, [sessionIdFromUrl, showParticipantMirrorView, sessionData]); 

  // Effect 5: Cleanup for admin countdown interval
  useEffect(() => { 
    return () => {
      if (adminCountdownIntervalRef.current) {
        clearInterval(adminCountdownIntervalRef.current);
      }
    };
  }, []);


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
    if (!sessionIdFromUrl || !sessionData) return;
    setIsGeneratingLink(true);
    const newSessionToken = generateToken();
    const sessionDocRef = doc(db, "sessions", sessionIdFromUrl);
    try {
      await updateDoc(sessionDocRef, { invitationToken: newSessionToken, updatedAt: serverTimestamp() });
      toast({ title: "Neuer Einladungslink generiert", description: "Der Token wurde aktualisiert." });
    } catch (error: any) {
      console.error(`AdminDashboard: Error generating new invitation token for session ${sessionIdFromUrl}:`, error);
      toast({ variant: "destructive", title: "Fehler", description: `Neuer Link-Token konnte nicht generiert werden: ${error.message}` });
    } finally {
      setIsGeneratingLink(false);
    }
  }, [sessionIdFromUrl, sessionData, toast]);


  const handleOpenSessionForJoining = useCallback(async () => {
    if (!sessionIdFromUrl || !currentScenario || !sessionData) {
        toast({variant: "destructive", title: "Aktion fehlgeschlagen", description: "Sitzungs- oder Szenariodaten fehlen."});
        return;
    }
    if (sessionData.status !== "pending") {
        toast({variant: "default", title: "Information", description: `Sitzung ist bereits ${sessionData.status}. Keine Aktion durchgeführt.`});
        return;
    }
    setIsProcessingSessionAction(true);
    const sessionDocRef = doc(db, "sessions", sessionIdFromUrl);
    try {
        await updateDoc(sessionDocRef, { 
            status: "open", 
            roleSelectionLocked: false, 
            simulationStartCountdownEndTime: null, 
            updatedAt: serverTimestamp() 
        });
        await initializeBotsForSession(); 
        toast({ title: "Simulation geöffnet", description: "Teilnehmer können jetzt dem Wartebereich beitreten und Rollen wählen." });
    } catch (error: any) {
        console.error(`AdminDashboard: Error opening session ${sessionIdFromUrl} for joining:`, error);
        toast({ variant: "destructive", title: "Fehler", description: `Sitzung konnte nicht geöffnet werden: ${error.message}` });
    } finally {
        setIsProcessingSessionAction(false);
    }
  }, [sessionIdFromUrl, currentScenario, sessionData, initializeBotsForSession, toast]);


  const startChatSimulation = useCallback(async () => {
    if (!sessionIdFromUrl || !sessionData || sessionData.status !== "open") {
        toast({variant: "destructive", title: "Aktion fehlgeschlagen", description: "Sitzung ist nicht bereit zum Starten (Status muss 'open' sein)."});
        return;
    }
    setIsProcessingSessionAction(true);
    
    try {
        const sessionDocRef = doc(db, "sessions", sessionIdFromUrl);
        // Set roleSelectionLocked immediately when starting the countdown process
        await updateDoc(sessionDocRef, { 
            roleSelectionLocked: true,
            updatedAt: serverTimestamp() 
        });
        
        const targetTimeForParticipants = new Date(Date.now() + SIMULATION_START_COUNTDOWN_SECONDS_FOR_PARTICIPANTS * 1000);
        const countdownEndTimeForFirestore = Timestamp.fromDate(targetTimeForParticipants);

        // Set the countdown end time for participants
        await updateDoc(sessionDocRef, { 
            simulationStartCountdownEndTime: countdownEndTimeForFirestore,
            updatedAt: serverTimestamp() 
        });
        
        // Admin UI Countdown (shorter, just for admin's feedback before setting status to 'active')
        setAdminUiCountdown(ADMIN_UI_LOCAL_COUNTDOWN_SECONDS_FOR_START); 
        if (adminCountdownIntervalRef.current) clearInterval(adminCountdownIntervalRef.current);

        adminCountdownIntervalRef.current = setInterval(async () => {
            setAdminUiCountdown(prev => {
                if (prev === null || prev <= 1) { 
                    clearInterval(adminCountdownIntervalRef.current!);
                    // Only after admin's local countdown, set the session to active
                    updateDoc(sessionDocRef, { status: "active", updatedAt: serverTimestamp() })
                        .then(() => toast({ title: "Chat-Simulation gestartet!", description: "Der Chat ist jetzt aktiv." }))
                        .catch(err => {
                            console.error("AdminDashboard: Error setting session to active:", err);
                            toast({ variant: "destructive", title: "Startfehler", description: "Konnte Sitzung nicht auf 'active' setzen."});
                        });
                    setIsProcessingSessionAction(false);
                    return null;
                }
                return prev - 1;
            });
        }, 1000);

    } catch (error: any) {
        console.error(`AdminDashboard: Error initiating chat simulation start for session ${sessionIdFromUrl}:`, error);
        toast({ variant: "destructive", title: "Fehler", description: `Simulationsstart konnte nicht initiiert werden: ${error.message}` });
        setIsProcessingSessionAction(false);
        if (adminCountdownIntervalRef.current) clearInterval(adminCountdownIntervalRef.current); // Clear interval on error
        setAdminUiCountdown(null); // Reset countdown display on error
    }
  }, [sessionIdFromUrl, sessionData, toast]);


  const handleResetSession = useCallback(async () => {
    if (!sessionIdFromUrl || !currentScenario) {
        toast({variant: "destructive", title: "Aktion fehlgeschlagen", description: "Sitzungs- oder Szenariodaten fehlen."});
        return;
    }
    setIsProcessingSessionAction(true);
    const sessionDocRef = doc(db, "sessions", sessionIdFromUrl);
    const participantsColRef = collection(db, "sessions", sessionIdFromUrl, "participants");
    const messagesColRef = collection(db, "sessions", sessionIdFromUrl, "messages");

    try {
      const batchReset = writeBatch(db);
      const messagesSnap = await getDocs(messagesColRef);
      messagesSnap.forEach(messageDoc => batchReset.delete(messageDoc.ref));
      const participantsSnap = await getDocs(participantsColRef);
      participantsSnap.forEach(participantDoc => batchReset.delete(participantDoc.ref));
      await batchReset.commit();

      let baseLink = "";
      if (typeof window !== "undefined") {
        baseLink = `${window.location.origin}/join/${sessionIdFromUrl}`;
      } else {
        baseLink = `/join/${sessionIdFromUrl}`;
      }
      const newSessionToken = generateToken();
      const newSessionDataToSet: Partial<SessionData> = { 
        scenarioId: currentScenario.id,
        // createdAt should not be reset usually, but for a full reset:
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
      setBotMissions({});
      toast({ title: "Sitzung zurückgesetzt", description: "Alle Teilnehmer und Nachrichten wurden gelöscht. Sitzung ist im 'pending'-Status." });
    } catch (error: any) {
      console.error(`AdminDashboard: Error resetting session ${sessionIdFromUrl}:`, error);
      toast({ variant: "destructive", title: "Fehler", description: `Sitzung konnte nicht zurückgesetzt werden: ${error.message}` });
    } finally {
      setIsProcessingSessionAction(false);
    }
  }, [sessionIdFromUrl, currentScenario, toast]);


  const handleEndSession = useCallback(async () => {
    if (!sessionIdFromUrl) return;
    setIsEndingSession(true);
    setIsProcessingSessionAction(true);
    const sessionDocRef = doc(db, "sessions", sessionIdFromUrl);
    try {
      await updateDoc(sessionDocRef, { 
          status: "ended", 
          simulationStartCountdownEndTime: null, 
          updatedAt: serverTimestamp() 
        });
      toast({ title: "Sitzung beendet", description: "Die Sitzung wurde als beendet markiert." });
    } catch (error: any) {
      console.error(`AdminDashboard: Error ending session ${sessionIdFromUrl}:`, error);
      toast({ variant: "destructive", title: "Fehler", description: `Sitzung konnte nicht beendet werden: ${error.message}` });
    } finally {
        setIsEndingSession(false);
        setIsProcessingSessionAction(false);
    }
  }, [sessionIdFromUrl, toast]);

  const handleToggleSimulationActive = useCallback(async (isActive: boolean) => {
    if (!sessionIdFromUrl || !sessionData || (sessionData.status !== "active" && sessionData.status !== "paused")) return;
    const newStatus = isActive ? "active" : "paused";
    if (sessionData.status === newStatus) return; 

    setIsProcessingSessionAction(true);
    const sessionDocRef = doc(db, "sessions", sessionIdFromUrl);
    try {
      await updateDoc(sessionDocRef, { 
          status: newStatus, 
          simulationStartCountdownEndTime: null, // Pausing should clear countdown
          updatedAt: serverTimestamp() 
      });
      toast({ title: "Simulationsstatus geändert", description: `Simulation ist jetzt ${newStatus === 'active' ? 'aktiv' : 'pausiert'}.` });
    } catch (error: any) {
      console.error(`AdminDashboard: Error toggling simulation active for session ${sessionIdFromUrl}:`, error);
      toast({ variant: "destructive", title: "Fehler", description: `Simulationsstatus konnte nicht geändert werden: ${error.message}` });
    } finally {
      setIsProcessingSessionAction(false);
    }
  }, [sessionIdFromUrl, sessionData, toast]);

  const handlePaceChangeCommit = useCallback(async (newPaceValues: number[]) => {
    if (!sessionIdFromUrl || !sessionData || sessionData.status === "ended") return;
    const newCooldown = newPaceValues[0];
    setPaceValue(newCooldown); 
    const sessionDocRef = doc(db, "sessions", sessionIdFromUrl);
    try {
      await updateDoc(sessionDocRef, { messageCooldownSeconds: newCooldown, updatedAt: serverTimestamp() });
    } catch (error: any) {
      console.error(`AdminDashboard: Error updating pace for session ${sessionIdFromUrl}:`, error);
      toast({ variant: "destructive", title: "Fehler", description: `Pace konnte nicht angepasst werden: ${error.message}` });
    }
  }, [sessionIdFromUrl, sessionData, toast]);

  const handleMuteAllUsers = useCallback(async () => {
    if (!sessionIdFromUrl || !sessionData || sessionData.status === "ended") return;
    const participantsColRef = collection(db, "sessions", sessionIdFromUrl, "participants");
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
      console.error(`AdminDashboard: Error muting all users for session ${sessionIdFromUrl}:`, error);
      toast({ variant: "destructive", title: "Fehler", description: `Teilnehmer konnten nicht alle stummgeschaltet werden: ${error.message}` });
    }
  }, [sessionIdFromUrl, sessionData, toast]);

  const handleToggleMuteParticipant = useCallback(async (participantId: string, currentMuteStatus: boolean) => {
    if (!sessionIdFromUrl) return;
    setIsApplyingPenaltyOrMute(participantId); // Indicate loading for this specific participant
    console.log(`AdminDashboard: Toggling mute for participant ${participantId} from ${currentMuteStatus} to ${!currentMuteStatus}`);
    try {
      const participantRef = doc(db, "sessions", sessionIdFromUrl, "participants", participantId);
      await updateDoc(participantRef, { 
        isMuted: !currentMuteStatus,
        updatedAt: serverTimestamp() 
      });
      toast({ title: "Teilnehmer Stummschaltung geändert", description: `Teilnehmer ${participantId} ist jetzt ${!currentMuteStatus ? "stummgeschaltet" : "nicht mehr stummgeschaltet"}.` });
    } catch (error: any) {
      console.error("Error toggling participant mute status:", error);
      toast({ variant: "destructive", title: "Fehler", description: `Stummschaltung konnte nicht geändert werden: ${error.message}` });
    } finally {
      setIsApplyingPenaltyOrMute(null);
    }
  }, [sessionIdFromUrl, toast]);

  const handleToggleBotActive = useCallback(async (botParticipantId: string, currentActiveStatus: boolean | undefined) => {
    if (!sessionIdFromUrl || !sessionData || sessionData.status === "ended" || typeof currentActiveStatus === 'undefined') return;
    const botDocRef = doc(db, "sessions", sessionIdFromUrl, "participants", botParticipantId);
    try {
      await updateDoc(botDocRef, { "botConfig.isActive": !currentActiveStatus });
      toast({ title: `Bot ${!currentActiveStatus ? 'aktiviert' : 'deaktiviert'}` });
    } catch (error: any) {
      console.error(`AdminDashboard: Error toggling bot active state for bot ${botParticipantId} in session ${sessionIdFromUrl}:`, error);
      toast({ variant: "destructive", title: "Fehler", description: `Bot-Status konnte nicht geändert werden: ${error.message}` });
    }
  },[sessionIdFromUrl, sessionData, toast]);

  const handleBotEscalationChange = useCallback(async (botParticipantId: string, change: "increase" | "decrease") => {
    if (!sessionIdFromUrl || !sessionData || sessionData.status === "ended") return;
    const botDocRef = doc(db, "sessions", sessionIdFromUrl, "participants", botParticipantId);
    const botParticipant = sessionParticipants.find(p => p.id === botParticipantId);
    if (!botParticipant || !botParticipant.botConfig) return;

    let newEscalation = botParticipant.botConfig.currentEscalation ?? 0;
    if (change === "increase" && newEscalation < 3) newEscalation++;
    if (change === "decrease" && newEscalation > 0) newEscalation--;

    try {
      await updateDoc(botDocRef, { "botConfig.currentEscalation": newEscalation });
    } catch (error: any) {
      console.error(`AdminDashboard: Error changing bot escalation for bot ${botParticipantId} in session ${sessionIdFromUrl}:`, error);
      toast({ variant: "destructive", title: "Fehler", description: `Bot-Eskalation konnte nicht geändert werden: ${error.message}` });
    }
  }, [sessionIdFromUrl, sessionData, sessionParticipants, toast]);

  const handleBotAutoTimerToggle = useCallback(async (botParticipantId: string, currentAutoTimerStatus: boolean | undefined) => {
     if (!sessionIdFromUrl || !sessionData || sessionData.status === "ended" || typeof currentAutoTimerStatus === 'undefined') return;
    const botDocRef = doc(db, "sessions", sessionIdFromUrl, "participants", botParticipantId);
    try {
      await updateDoc(botDocRef, { "botConfig.autoTimerEnabled": !currentAutoTimerStatus });
      toast({ title: `Bot Auto-Timer ${!currentAutoTimerStatus ? 'aktiviert' : 'deaktiviert'}` });
    } catch (error: any) {
      console.error(`AdminDashboard: Error toggling bot auto-timer for bot ${botParticipantId} in session ${sessionIdFromUrl}:`, error);
      toast({ variant: "destructive", title: "Fehler", description: `Bot Auto-Timer konnte nicht geändert werden: ${error.message}` });
    }
  }, [sessionIdFromUrl, sessionData, toast]);

  const handleBotMissionChange = useCallback((botParticipantId: string, mission: string) => {
    setBotMissions(prev => ({ ...prev, [botParticipantId]: mission }));
  }, []);

  const handleUpdateBotMissionInFirestore = useCallback(async (botParticipantId: string) => {
    if (!sessionIdFromUrl) return;
    const missionToSave = botMissions[botParticipantId];
    if (typeof missionToSave === 'undefined') {
        return;
    }
    const botDocRef = doc(db, "sessions", sessionIdFromUrl, "participants", botParticipantId);
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
      console.error(`AdminDashboard: Error updating bot mission in Firestore for bot ${botParticipantId} in session ${sessionIdFromUrl}:`, error);
      toast({ variant: "destructive", title: "Fehler Bot-Mission", description: `Bot-Mission konnte nicht gespeichert werden: ${error.message}` });
    }
  }, [sessionIdFromUrl, toast, botMissions, sessionParticipants]);


  const handlePostForBot = useCallback(async (botParticipant: Participant) => {
    if (!sessionIdFromUrl || !currentScenario || !botParticipant.botConfig || !sessionData) {
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

      const messagesColRef = collection(db, "sessions", sessionIdFromUrl, "messages");
      const newMessageData: Omit<MessageType, 'id' | 'reactions'> = { 
        senderUserId: botParticipant.userId,
        senderName: botParticipant.displayName, 
        senderType: 'bot',
        avatarFallback: botParticipant.avatarFallback,
        content: botResponse.message,
        timestamp: serverTimestamp() as Timestamp,
        // botFlag: !!botResponse.bot_flag, // Removed botFlag
      };
      await addDoc(messagesColRef, {...newMessageData, reactions: {}}); 

      if (typeof botResponse.escalationLevel === 'number' && botParticipant.botConfig && botResponse.escalationLevel !== botParticipant.botConfig.currentEscalation) {
        const botDocRef = doc(db, "sessions", sessionIdFromUrl, "participants", botParticipant.id);
        const updatedBotConfig = {
          ...botParticipant.botConfig, // Spread the existing, defined botConfig
          currentEscalation: botResponse.escalationLevel
        };
        await updateDoc(botDocRef, { "botConfig": updatedBotConfig });
      }
      toast({ title: `Nachricht von ${botParticipant.displayName} gesendet.`});

    } catch (error: any) {
      console.error(`AdminDashboard: Error posting for bot ${botParticipant.displayName} in session ${sessionIdFromUrl}:`, error);
      toast({ variant: "destructive", title: "Fehler beim Posten für Bot", description: error.message || "Nachricht konnte nicht generiert oder gesendet werden." });
    } finally {
      setIsPostingForBot(null);
    }
  }, [sessionIdFromUrl, currentScenario, sessionData, chatMessages, toast ]);

  const handleRemoveParticipant = useCallback(async (participantId: string, participantDisplayName: string) => {
    if (!sessionIdFromUrl) return;
    setIsRemovingParticipant(participantId);
    try {
      const participantDocRef = doc(db, "sessions", sessionIdFromUrl, "participants", participantId);
      await deleteDoc(participantDocRef);
      toast({ title: "Teilnehmer entfernt", description: `Teilnehmer "${participantDisplayName}" wurde erfolgreich aus der Sitzung entfernt.` });
    } catch (error: any) {
      console.error(`AdminDashboard: Error removing participant ${participantId} from session ${sessionIdFromUrl}:`, error);
      toast({ variant: "destructive", title: "Fehler", description: `Teilnehmer "${participantDisplayName}" konnte nicht entfernt werden: ${error.message}` });
    } finally {
      setIsRemovingParticipant(null);
    }
  }, [sessionIdFromUrl, toast]);

  const handleRemoveAllParticipants = useCallback(async () => {
    if (!sessionIdFromUrl) return;
    setIsRemovingAllParticipants(true);
    try {
      const participantsColRef = collection(db, "sessions", sessionIdFromUrl, "participants");
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
      console.error(`AdminDashboard: Error removing all participants from session ${sessionIdFromUrl}:`, error);
      toast({ variant: "destructive", title: "Fehler", description: `Teilnehmer konnten nicht entfernt werden: ${error.message}` });
    } finally {
      setIsRemovingAllParticipants(false);
    }
  }, [sessionIdFromUrl, toast]);

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
      "Reactions" // Removed "Bot Flag"
    ];

    const rows = chatMessages.map(msg => {
      const sender = msg.senderUserId ? participantMap.get(msg.senderUserId) : undefined;
      const senderRole = sender ? sender.role : (msg.senderType === 'system' ? "System" : "Unbekannt");
      const senderRealName = sender ? sender.realName : (msg.senderType === 'system' ? msg.senderName : "Unbekannt");
      const senderDisplayName = sender ? sender.displayName : msg.senderName;

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
        escapeCsvField(senderRealName),
        escapeCsvField(senderDisplayName),
        escapeCsvField(senderRole),
        escapeCsvField(msg.senderType),
        escapeCsvField(msg.content),
        escapeCsvField(msg.imageUrl || ""),
        escapeCsvField(msg.imageFileName || ""),
        escapeCsvField(msg.replyToMessageId || ""),
        escapeCsvField(msg.replyToMessageSenderName || ""),
        escapeCsvField(msg.replyToMessageContentSnippet || ""),
        escapeCsvField(reactionsString),
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' }); 
    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `chatsim_session_${sessionIdFromUrl}_log_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: "CSV Export gestartet", description: "Der Download sollte in Kürze beginnen." });
    } else {
        toast({ variant: "destructive", title: "Export fehlgeschlagen", description: "Ihr Browser unterstützt diese Funktion nicht." });
    }
  }, [chatMessages, sessionParticipants, sessionIdFromUrl, toast]);

  const handleTriggerScenarioEvent = useCallback(async (event: ScenarioEvent) => {
    if (!currentScenario || !sessionIdFromUrl) return;

    toast({
      title: `Ereignis "${event.name}" ausgelöst.`,
      description: event.description || "Keine weitere Beschreibung.",
    });

    // Placeholder for more complex event actions
    if (event.id === "placeholder-bot-post-event") { 
        const firstActiveBot = sessionParticipants.find(p => p.isBot && p.botConfig?.isActive);
        if (firstActiveBot) {
            const messagesColRef = collection(db, "sessions", sessionIdFromUrl, "messages");
            const newMessageData: Omit<MessageType, 'id'|'reactions'> = {
                senderUserId: firstActiveBot.userId,
                senderName: firstActiveBot.displayName,
                senderType: 'bot',
                avatarFallback: firstActiveBot.avatarFallback,
                content: `Automatisierte Nachricht durch Ereignis: "${event.name}"`,
                timestamp: serverTimestamp() as Timestamp,
            };
            await addDoc(messagesColRef, newMessageData);
        } else {
            toast({variant: "destructive", title: "Ereignis-Fehler", description: "Kein aktiver Bot für dieses Ereignis gefunden."});
        }
    }
  }, [toast, sessionParticipants, currentScenario, sessionIdFromUrl]);

  const handleToggleRoleLock = useCallback(async () => {
    if (!sessionIdFromUrl || !sessionData) return;
    setIsProcessingSessionAction(true);
    const sessionDocRef = doc(db, "sessions", sessionIdFromUrl);
    try {
        await updateDoc(sessionDocRef, { 
            roleSelectionLocked: !sessionData.roleSelectionLocked,
            updatedAt: serverTimestamp() 
        });
        toast({ title: `Rollenauswahl ${!sessionData.roleSelectionLocked ? 'gesperrt' : 'freigegeben'}.`});
    } catch (error: any) {
        console.error("AdminDashboard: Error toggling role lock:", error);
        toast({ variant: "destructive", title: "Fehler", description: "Status der Rollenauswahl konnte nicht geändert werden."});
    } finally {
        setIsProcessingSessionAction(false);
    }
  }, [sessionIdFromUrl, sessionData, toast]);

  const handleMoveParticipant = async (participantId: string, newRoleId: string) => {
    if (!currentScenario || !currentScenario.humanRolesConfig || !sessionIdFromUrl || !participantId || !newRoleId) {
        toast({ variant: "destructive", title: "Fehler", description: "Notwendige Daten zum Verschieben fehlen." });
        return;
    }
    const targetParticipant = sessionParticipants.find(p => p.id === participantId);
    const newRoleConfig = currentScenario.humanRolesConfig.find(r => r.id === newRoleId);
    
    if (!targetParticipant) {
        toast({ variant: "destructive", title: "Fehler", description: "Teilnehmer nicht gefunden." });
        return;
    }
    if (!newRoleConfig) {
        toast({ variant: "destructive", title: "Fehler", description: "Zielrolle nicht gefunden." });
        return;
    }
     if (targetParticipant.roleId === newRoleId) {
        return; 
    }

    setIsMovingParticipant(participantId);
    try {
        const participantDocRef = doc(db, "sessions", sessionIdFromUrl, "participants", participantId);
        await updateDoc(participantDocRef, {
            roleId: newRoleConfig.id,
            role: newRoleConfig.name, 
            updatedAt: serverTimestamp()
        });
        toast({ title: "Teilnehmer verschoben", description: `${targetParticipant.displayName || 'Teilnehmer'} wurde zur Rolle "${newRoleConfig.name}" verschoben.` });
    } catch (error: any) {
        console.error("AdminDashboard: Error moving participant:", error);
        toast({ variant: "destructive", title: "Fehler beim Verschieben", description: error.message });
    } finally {
        setIsMovingParticipant(null);
    }
  };

  const handleToggleMuteRole = useCallback(async (roleId: string) => {
    if (!sessionIdFromUrl || !sessionData || !currentScenario?.humanRolesConfig) return;
    setIsApplyingPenaltyOrMute(roleId); // Use roleId to indicate this role is being processed
    const sessionDocRef = doc(db, "sessions", sessionIdFromUrl);
    const participantsColRef = collection(db, "sessions", sessionIdFromUrl, "participants");

    const roleToToggle = currentScenario.humanRolesConfig.find(r => r.id === roleId);
    if (!roleToToggle) {
      toast({ variant: "destructive", title: "Fehler", description: "Rolle nicht gefunden." });
      setIsApplyingPenaltyOrMute(null);
      return;
    }

    const currentMutedRoleIds = sessionData.mutedRoleIds || [];
    const isCurrentlyMuted = currentMutedRoleIds.includes(roleId);
    const newMutedRoleIds = isCurrentlyMuted
      ? currentMutedRoleIds.filter(id => id !== roleId)
      : [...currentMutedRoleIds, roleId];

    try {
      await updateDoc(sessionDocRef, { mutedRoleIds: newMutedRoleIds, updatedAt: serverTimestamp() });

      // Update all participants of this role
      const q = query(participantsColRef, where("roleId", "==", roleId), where("isBot", "==", false));
      const participantsSnapshot = await getDocs(q);
      const batch = writeBatch(db);
      participantsSnapshot.forEach(participantDoc => {
        batch.update(participantDoc.ref, { isMuted: !isCurrentlyMuted });
      });
      await batch.commit();

      toast({ title: `Rolle "${roleToToggle.name}" ${!isCurrentlyMuted ? "stummgeschaltet" : "Stummschaltung aufgehoben"}.`, description: `${participantsSnapshot.size} Teilnehmer aktualisiert.` });
    } catch (error: any) {
      console.error("Error toggling role mute state:", error);
      toast({ variant: "destructive", title: "Fehler", description: `Stummschaltung für Rolle konnte nicht geändert werden: ${error.message}` });
    }
    setIsApplyingPenaltyOrMute(null);
  }, [sessionIdFromUrl, sessionData, currentScenario, toast]);

  const handleApplyPenaltyToParticipant = useCallback(async (participantId: string, penaltyType: 'yellow' | 'red') => {
    if (!sessionIdFromUrl) return;
    setIsApplyingPenaltyOrMute(participantId); // Indicate loading for this participant

    const durationMinutes = penaltyType === 'yellow' ? 1 : 3;
    const description = penaltyType === 'yellow' ? "Gelbe Karte" : "Rote Karte";

    try {
      const participantRef = doc(db, "sessions", sessionIdFromUrl, "participants", participantId);
      await updateDoc(participantRef, {
        activePenalty: {
          type: penaltyType,
          startedAt: serverTimestamp(),
          durationMinutes: durationMinutes,
          description: description,
        },
        isMuted: true, // Mute participant when penalty is applied
        updatedAt: serverTimestamp()
      });
      toast({ title: `${description} für Teilnehmer ${participantId} angewendet.`, description: `Dauer: ${durationMinutes} Minute(n). Teilnehmer ist stummgeschaltet.` });
    } catch (error: any) {
      console.error(`Error applying penalty to participant ${participantId}:`, error);
      toast({ variant: "destructive", title: "Fehler", description: `Strafe konnte nicht angewendet werden: ${error.message}` });
    } finally {
      setIsApplyingPenaltyOrMute(null);
    }
  }, [sessionIdFromUrl, sessionData, currentScenario, toast]);

  const handleClearPenaltyForParticipant = useCallback(async (participantId: string) => {
    if (!sessionIdFromUrl) return;
    setIsApplyingPenaltyOrMute(participantId); // Indicate loading for this participant
    try {
      const participantRef = doc(db, "sessions", sessionIdFromUrl, "participants", participantId);
      await updateDoc(participantRef, {
        activePenalty: null,
        isMuted: false, // Unmute participant when penalty is cleared, consider if this is always desired
        updatedAt: serverTimestamp()
      });
      toast({ title: `Strafe für Teilnehmer ${participantId} aufgehoben.`, description: "Teilnehmer ist wieder freigeschaltet." });
    } catch (error: any) {
      console.error(`Error clearing penalty for participant ${participantId}:`, error);
      toast({ variant: "destructive", title: "Fehler", description: `Strafe konnte nicht aufgehoben werden: ${error.message}` });
    } finally {
      setIsApplyingPenaltyOrMute(null);
    }
  }, [sessionIdFromUrl, toast]);

  const handleApplyPenaltyToRole = useCallback(async (roleId: string, penaltyType: 'yellow' | 'red') => {
    if (!sessionIdFromUrl || !sessionData || !currentScenario?.humanRolesConfig) return;
    setIsApplyingPenaltyOrMute(roleId); // Use roleId to indicate this role is being processed

    const durationMinutes = penaltyType === 'yellow' ? 1 : 3;
    const description = penaltyType === 'yellow' ? "Gelbe Karte (Rolle)" : "Rote Karte (Rolle)";
    const roleToPenalize = currentScenario.humanRolesConfig.find(r => r.id === roleId);

    if (!roleToPenalize) {
      toast({ variant: "destructive", title: "Fehler", description: "Rolle nicht gefunden." });
      setIsApplyingPenaltyOrMute(null);
      return;
    }

    const participantsColRef = collection(db, "sessions", sessionIdFromUrl, "participants");
    const sessionDocRef = doc(db, "sessions", sessionIdFromUrl);

    try {
      const currentMutedRoleIds = sessionData.mutedRoleIds || [];
      const newMutedRoleIds = currentMutedRoleIds.includes(roleId) ? currentMutedRoleIds : [...currentMutedRoleIds, roleId];
      await updateDoc(sessionDocRef, { mutedRoleIds: newMutedRoleIds, updatedAt: serverTimestamp() });

      const q = query(participantsColRef, where("roleId", "==", roleId), where("isBot", "==", false));
      const participantsSnapshot = await getDocs(q);
      const batch = writeBatch(db);
      participantsSnapshot.forEach(participantDoc => {
        batch.update(participantDoc.ref, {
          activePenalty: {
            type: penaltyType,
            startedAt: serverTimestamp(),
            durationMinutes: durationMinutes,
            description: description,
          },
          isMuted: true,
          updatedAt: serverTimestamp()
        });
      });
      await batch.commit();

      toast({ title: `${description} für Rolle "${roleToPenalize.name}" angewendet.`, description: `${participantsSnapshot.size} Teilnehmer aktualisiert und stummgeschaltet.` });
    } catch (error: any) {
      console.error(`Error applying penalty to role ${roleId}:`, error);
      toast({ variant: "destructive", title: "Fehler", description: `Strafe konnte nicht auf Rolle angewendet werden: ${error.message}` });
    }
    setIsApplyingPenaltyOrMute(null);
  }, [sessionIdFromUrl, sessionData, currentScenario, toast]);

  const handleClearPenaltyFromRole = useCallback(async (roleId: string) => {
    if (!sessionIdFromUrl || !sessionData || !currentScenario?.humanRolesConfig) return;
    setIsApplyingPenaltyOrMute(roleId);

    const roleToClear = currentScenario.humanRolesConfig.find(r => r.id === roleId);
    if (!roleToClear) {
      toast({ variant: "destructive", title: "Fehler", description: "Rolle nicht gefunden." });
      setIsApplyingPenaltyOrMute(null);
      return;
    }

    const participantsColRef = collection(db, "sessions", sessionIdFromUrl, "participants");
    const sessionDocRef = doc(db, "sessions", sessionIdFromUrl);

    try {
      const currentMutedRoleIds = sessionData.mutedRoleIds || [];
      const newMutedRoleIds = currentMutedRoleIds.filter(id => id !== roleId);
      await updateDoc(sessionDocRef, { mutedRoleIds: newMutedRoleIds, updatedAt: serverTimestamp() });

      const q = query(participantsColRef, where("roleId", "==", roleId), where("isBot", "==", false));
      const participantsSnapshot = await getDocs(q);
      const batch = writeBatch(db);
      participantsSnapshot.forEach(participantDoc => {
        batch.update(participantDoc.ref, {
          activePenalty: null,
          isMuted: false,
          updatedAt: serverTimestamp()
        });
      });
      await batch.commit();

      toast({ title: `Strafe für Rolle "${roleToClear.name}" aufgehoben.`, description: `${participantsSnapshot.size} Teilnehmer aktualisiert und freigeschaltet.` });
    } catch (error: any) {
      console.error(`Error clearing penalty from role ${roleId}:`, error);
      toast({ variant: "destructive", title: "Fehler", description: `Strafe konnte von Rolle nicht aufgehoben werden: ${error.message}` });
    }
    setIsApplyingPenaltyOrMute(null);
  }, [sessionIdFromUrl, sessionData, currentScenario, toast]);

  const humanParticipantsCount = sessionParticipants.filter(p => !p.isBot).length;
  
  const isSessionEffectivelyEnded = sessionData?.status === "ended";
  const isSessionEffectivelyPaused = sessionData?.status === "paused";
  const isSessionPending = sessionData?.status === "pending";
  const isSessionOpenForJoin = sessionData?.status === "open";
  const isChatActive = sessionData?.status === "active";
  
  const combinedLoadingState = isLoadingScenario || isLoadingSessionData;

  const adminUserId = "ADMIN_USER_ID_FIXED"; // Placeholder for actual admin user ID, if you have auth
  const adminDisplayName = "Admin";
  const adminAvatarFallback = "AD";

  // Handler to open the Admin DM Modal
  const handleOpenAdminDmModal = (participant: Participant) => {
    setAdminDmRecipient(participant);
    setShowAdminDmModal(true);
    setAdminDmContent(""); // Clear previous message
  };

  // Handler to send the Admin DM
  const handleSendAdminDm = async () => {
    if (!sessionIdFromUrl || !adminDmRecipient || !adminDmContent.trim()) {
      toast({ variant: "destructive", title: "Fehler", description: "Empfänger oder Nachrichteninhalt fehlt." });
      return;
    }
    setIsSendingAdminDm(true);
    console.log("[Admin DM Send] Recipient:", adminDmRecipient);
    console.log("[Admin DM Send] Content:", adminDmContent.trim());
    try {
      const messageData: Partial<MessageType> = {
        senderUserId: adminUserId, 
        senderName: adminDisplayName,
        senderType: 'admin',
        avatarFallback: adminAvatarFallback,
        recipientId: adminDmRecipient.userId,
        content: adminDmContent.trim(),
        timestamp: serverTimestamp(),
        isRead: false, // Mark as unread initially
        isAdminBroadcast: true, // Crucial flag for special handling
      };
      console.log("[Admin DM Send] Data to Firestore:", JSON.parse(JSON.stringify(messageData))); // Log data before sending
      await addDoc(collection(db, "sessions", sessionIdFromUrl, "messages"), messageData);
      console.log("[Admin DM Send] Message successfully added to Firestore.");
      toast({ title: "Admin-Nachricht gesendet", description: `Nachricht an ${adminDmRecipient.displayName} wurde übermittelt.` });
      setShowAdminDmModal(false);
      setAdminDmContent("");
      setAdminDmRecipient(null);
    } catch (error: any) {
      console.error("Error sending admin DM:", error);
      toast({ variant: "destructive", title: "Admin-DM Senden Fehlgeschlagen", description: error.message });
    } finally {
      setIsSendingAdminDm(false);
    }
  };

  // Effect to automatically clear expired participant penalties
  useEffect(() => {
    if (!sessionIdFromUrl || sessionParticipants.length === 0 || isProcessingSessionAction) return;

    const now = Date.now();
    const participantsToClear: string[] = [];
    sessionParticipants.forEach(participant => {
      if (participant.activePenalty && participant.activePenalty.startedAt instanceof Timestamp) {
        const endTime = participant.activePenalty.startedAt.toDate().getTime() + participant.activePenalty.durationMinutes * 60 * 1000;
        if (now >= endTime) {
          participantsToClear.push(participant.id);
        }
      }
    });
    
    if (participantsToClear.length > 0) {
        participantsToClear.forEach(id => {
            if (isApplyingPenaltyOrMute !== id) { 
                console.log(`AdminDashboard: Penalty for participant ${id} has expired. Clearing...`);
                handleClearPenaltyForParticipant(id);
            }
        });
    }
  }, [sessionParticipants, sessionIdFromUrl, handleClearPenaltyForParticipant, isProcessingSessionAction, isApplyingPenaltyOrMute]);

  // Effect to automatically clear expired role penalties
  useEffect(() => {
    if (!sessionIdFromUrl || !sessionData?.activeRolePenalties || sessionData.activeRolePenalties.length === 0 || isProcessingSessionAction) return;

    const now = Date.now();
    const rolesToClear: string[] = [];
    sessionData.activeRolePenalties.forEach(rolePenalty => {
      if (rolePenalty.startedAt instanceof Timestamp) {
        const endTime = rolePenalty.startedAt.toDate().getTime() + rolePenalty.durationMinutes * 60 * 1000;
        if (now >= endTime) {
          rolesToClear.push(rolePenalty.roleId);
        }
      }
    });

    if (rolesToClear.length > 0) {
        rolesToClear.forEach(id => {
            if (isApplyingPenaltyOrMute !== id) { 
                console.log(`AdminDashboard: Penalty for role ${id} has expired. Clearing...`);
                handleClearPenaltyFromRole(id);
            }
        });
    }
  }, [sessionData?.activeRolePenalties, sessionIdFromUrl, handleClearPenaltyFromRole, sessionData?.status, isProcessingSessionAction, isApplyingPenaltyOrMute]);

  const handleOpenAdminStandardDmModal = (participant: Participant) => {
    setAdminStandardDmRecipient(participant);
    setAdminStandardDmContent("");
    setShowAdminStandardDmModal(true);
  };

  const handleSendAdminStandardDm = async () => {
    if (!adminStandardDmRecipient || !adminStandardDmContent.trim() || !sessionIdFromUrl) {
      toast({ variant: "destructive", title: "Fehler", description: "Empfänger oder Nachrichteninhalt fehlt." });
      return;
    }
    setIsSendingAdminStandardDm(true);
    try {
      const dmData: Partial<MessageType> = {
        senderUserId: `admin_user_for_session_${sessionIdFromUrl}`, // Or a more persistent admin ID if available
        senderName: "Admin-Team",
        avatarFallback: "AT",
        recipientId: adminStandardDmRecipient.userId,
        content: adminStandardDmContent.trim(),
        timestamp: serverTimestamp(),
        isRead: false,
        isAdminBroadcast: false, // Explicitly false for standard DMs
      };
      await addDoc(collection(db, "sessions", sessionIdFromUrl, "directMessages"), dmData);
      toast({ title: "DM gesendet", description: `Nachricht an ${adminStandardDmRecipient.displayName} wurde gesendet.` });
      setAdminStandardDmContent("");
      setShowAdminStandardDmModal(false);
      setAdminStandardDmRecipient(null);
    } catch (error: any) {      
      console.error("Error sending admin standard DM:", error);
      toast({ variant: "destructive", title: "Fehler beim Senden der DM", description: error.message });
    } finally {
      setIsSendingAdminStandardDm(false);
    }
  };

  const handleOpenGlobalBroadcastModal = (type: 'all' | 'role', roleId?: string) => {
    setGlobalBroadcastType(type);
    setGlobalBroadcastTargetRoleId(roleId || null);
    setGlobalBroadcastContent("");
    setShowGlobalBroadcastModal(true);
  };

  const handleSendGlobalBroadcast = async () => {
    if (!globalBroadcastContent.trim() || !sessionIdFromUrl) {
      toast({ variant: "destructive", title: "Fehler", description: "Nachrichteninhalt fehlt." });
      return;
    }
    setIsSendingGlobalBroadcast(true);
    try {
      const batch = writeBatch(db);
      let targetParticipants: Participant[] = [];

      if (globalBroadcastType === 'all') {
        targetParticipants = sessionParticipants.filter(p => !p.isBot); // Filter out bots
      } else if (globalBroadcastType === 'role' && globalBroadcastTargetRoleId) {
        targetParticipants = sessionParticipants.filter(p => p.roleId === globalBroadcastTargetRoleId && !p.isBot); // Filter out bots
      }

      if (targetParticipants.length === 0) {
        toast({ variant: "default", title: "Hinweis: Keine Ziele", description: "Keine passenden Teilnehmer für diesen Broadcast gefunden." });
        setIsSendingGlobalBroadcast(false);
        return;
      }

      const messageData: Partial<MessageType> = {
        senderUserId: `admin_global_broadcast_${sessionIdFromUrl}`,
        senderName: "Admin System-Nachricht",
        avatarFallback: "📢", 
        senderType: "system", // To differentiate from admin DMs
        content: globalBroadcastContent.trim(),
        timestamp: serverTimestamp(),
        isRead: false,
        isAdminBroadcast: true,
      };
      
      if (globalBroadcastType === 'role' && globalBroadcastTargetRoleId) {
        messageData.targetRoleIds = [globalBroadcastTargetRoleId];
      }

      targetParticipants.forEach(p => {
        const messageDocRef = doc(collection(db, "sessions", sessionIdFromUrl, "messages"));
        batch.set(messageDocRef, { ...messageData, recipientId: p.userId });
      });

      await batch.commit();
      toast({ title: "Globaler Broadcast gesendet", description: `Nachricht an ${targetParticipants.length} Teilnehmer gesendet.` });
      setGlobalBroadcastContent("");
      setShowGlobalBroadcastModal(false);
      setGlobalBroadcastTargetRoleId(null);
    } catch (error: any) {
      console.error("Error sending global broadcast:", error);
      toast({ variant: "destructive", title: "Fehler beim Senden des Broadcasts", description: error.message });
    } finally {
      setIsSendingGlobalBroadcast(false);
    }
  };

  if (combinedLoadingState) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="items-center">
            <CardTitle className="flex items-center"><Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />Dashboard wird geladen...</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground">Szenario- und Sitzungsdaten werden abgerufen.</p>
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
            <CardDescription className="text-center">{pageError}</CardDescription>
            </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
             <p className="text-sm text-muted-foreground text-center">
                Stellen Sie sicher, dass die Szenario-ID gültig ist und die Firestore-Regeln korrekt sind.
             </p>
            <Link href="/admin" passHref legacyBehavior>
              <Button variant="outline" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4"/> Zur Szenarienübersicht
              </Button>
            </Link>
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
            <CardDescription className="text-center">Das zugehörige Szenario konnte nicht geladen werden. Bitte überprüfen Sie die Szenario-ID.</CardDescription>
            </CardHeader>
          <CardContent className="flex justify-center">
            <Link href="/admin" passHref legacyBehavior>
              <Button variant="outline" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4"/> Zur Szenarienübersicht
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col h-screen bg-muted/40 p-4 md:p-6 lg:p-8 gap-4 md:gap-6 lg:gap-8 overflow-y-auto relative">
        {/* Header Row */}
       <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-primary">
              Dashboard: <span className="text-foreground">{currentScenario?.title || "Szenario nicht gefunden"}</span>
          </h1>
          <p className="text-muted-foreground text-xs md:text-sm">Sitzungs-ID: {sessionIdFromUrl}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
           <Link href={`/admin/scenario-editor/${sessionIdFromUrl}`} passHref legacyBehavior>
            <Button variant="outline">
                <NotebookPen className="mr-2 h-4 w-4" /> Szenario bearbeiten
            </Button>
          </Link>
          <Button
            variant={showParticipantMirrorView ? "secondary" : "default"}
            onClick={() => setShowParticipantMirrorView(!showParticipantMirrorView)}
            className={cn("text-sm",!showParticipantMirrorView ? "bg-primary hover:bg-primary/90" : "")}
          >
            <Eye className="mr-2 h-4 w-4" />
            {showParticipantMirrorView ? "Chat-Ansicht ausblenden" : "Chat-Ansicht einblenden"}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={isEndingSession || isSessionEffectivelyEnded || isProcessingSessionAction}>
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
                  {isEndingSession ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : "Ja, Sitzung beenden"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

        {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card className="w-full shadow-lg"> {/* Sitzungs-Steuerung Card */}
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
                              "ml-2 font-semibold",
                              sessionData?.status === 'active' ? 'bg-green-500 hover:bg-green-600 text-white' :
                              sessionData?.status === 'open' ? 'bg-blue-500 hover:bg-blue-600 text-white' :
                              sessionData?.status === 'pending' ? 'bg-yellow-500 hover:bg-yellow-600 text-black' :
                              sessionData?.status === 'paused' ? 'bg-orange-500 hover:bg-orange-600 text-white' :
                              sessionData?.status === 'ended' ? 'bg-red-600 hover:bg-red-700 text-white' : ''
                          )}
                      >
                          {sessionData?.status === 'pending' && <Clock className="mr-1.5 h-3.5 w-3.5"/>}
                          {sessionData?.status === 'open' && <LogIn className="mr-1.5 h-3.5 w-3.5"/>}
                          {sessionData?.status === 'active' && <PlayCircleIcon className="mr-1.5 h-3.5 w-3.5"/>}
                          {sessionData?.status === 'paused' && <Pause className="mr-1.5 h-3.5 w-3.5"/>}
                          {sessionData?.status === 'ended' && <Power className="mr-1.5 h-3.5 w-3.5"/>}
                          {sessionData?.status ? (sessionData.status.charAt(0).toUpperCase() + sessionData.status.slice(1)) : "Unbekannt"}
                      </Badge>
                  </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-stretch">
                     <Button
                        onClick={handleOpenSessionForJoining}
                        disabled={isProcessingSessionAction || !isSessionPending || isLoadingPage || !currentScenario}
                        variant="default"
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                        title="Öffnet die Sitzung, damit Teilnehmer dem Wartebereich beitreten können."
                    >
                        {isProcessingSessionAction && sessionData?.status === "pending" ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <UserPlus className="mr-2 h-4 w-4" />}
                        Simulation öffnen
                    </Button>
                    <Button
                        onClick={startChatSimulation}
                        disabled={isProcessingSessionAction || !isSessionOpenForJoin || isLoadingPage || !currentScenario || adminUiCountdown !== null}
                        variant="default"
                        className="bg-green-600 hover:bg-green-700 text-white"
                        title="Startet den Chat für alle Teilnehmer im Wartebereich."
                    >
                        {isProcessingSessionAction && adminUiCountdown === null && sessionData?.status === "open" ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlayCircleIcon className="mr-2 h-4 w-4" />}
                        {adminUiCountdown !== null ? `Chat startet in ${adminUiCountdown}s...` : "Chat starten"}
                    </Button>
                </div>
                <div className="flex items-center justify-start gap-3">
                    <div className="flex items-center space-x-2">
                        <Label htmlFor="simulation-active" className="text-sm whitespace-nowrap">Pausieren:</Label>
                        <Switch
                            id="simulation-active"
                            checked={isSessionEffectivelyPaused} 
                            onCheckedChange={(checked) => handleToggleSimulationActive(!checked)} 
                            disabled={isSessionEffectivelyEnded || isProcessingSessionAction || isSessionPending || isSessionOpenForJoin}
                        />
                    </div>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="outline" disabled={isProcessingSessionAction || isLoadingPage || !currentScenario} className="border-orange-500 text-orange-500 hover:bg-orange-500/10 hover:text-orange-600">
                                {isProcessingSessionAction && sessionData?.status !== "pending" && !isSessionEffectivelyEnded ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <History className="mr-2 h-4 w-4" />}
                                Sitzung zurücksetzen
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Sitzung wirklich komplett zurücksetzen?</AlertDialogTitle>
                            <AlertDialogDescription>
                            Alle Teilnehmer und Nachrichten dieser Sitzung werden dauerhaft gelöscht. Die Sitzung wird in den 'pending'-Status zurückgesetzt.
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
                     <Button variant="outline" onClick={initializeBotsForSession} disabled={isProcessingSessionAction || !sessionData || !currentScenario || isSessionPending || isSessionEffectivelyEnded}>
                        <Bot className="mr-2 h-4 w-4" /> Bots (Re)Initialisieren
                    </Button>
                </div>
                <div className="pt-3 border-t">
                    <Label htmlFor="pace-slider" className="mb-2 block text-sm">
                        Nachrichten Cooldown: <span className="font-bold text-primary">{paceValue}s</span>
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
            </CardContent>
        </Card>

        <Card className="w-full shadow-lg"> {/* Sitzungseinladung Card */}
            <CardHeader>
            <CardTitle className="flex items-center"><LayoutDashboard className="mr-2 h-5 w-5 text-primary" /> Sitzungseinladung & Infos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
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
                    <QrCode className="mr-2 h-4 w-4" /> QR-Code (Zukunft)
                </Button>
                <Button variant="default" onClick={handleGenerateNewInvitationToken} disabled={isLoadingSessionData || isGeneratingLink || !sessionData}>
                    {isGeneratingLink ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RefreshCw className="mr-2 h-4 w-4" />} Neuen Token
                </Button>
            </div>
            </CardContent>
        </Card>
      </div>

      {/* Teilnehmer & Rollenzuordnung - Volle Breite */}
      <Card className="w-full shadow-lg mb-6">
        <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <CardTitle className="flex items-center"><Users2 className="mr-2 h-5 w-5 text-primary" /> Teilnehmer & Rollenzuordnung (Live)</CardTitle>
                  <div className="flex flex-wrap gap-2 items-center">
                      {/* Global Broadcast Buttons */}
                      <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleOpenGlobalBroadcastModal('all')}
                          disabled={isProcessingSessionAction || isLoadingParticipants || sessionParticipants.filter(p => !p.isBot).length === 0}
                          title="Sendet eine Broadcast-Nachricht an alle menschlichen Teilnehmer."
                          className="border-orange-500 text-orange-600 hover:bg-orange-500/10 hover:text-orange-700"
                      >
                          <Megaphone className="mr-1.5 h-4 w-4"/> Broadcast an Alle
                      </Button>

                      {sessionParticipants.filter(p => !p.isBot).length > 0 && (
                          <Button 
                              variant="outline" 
                              size="sm"
                              onClick={handleMuteAllUsers} 
                              disabled={isProcessingSessionAction || isSessionEffectivelyEnded || (!isChatActive && !isSessionOpenForJoin && !isSessionEffectivelyPaused)}
                              title="Schaltet alle aktuell anwesenden menschlichen Teilnehmer stumm."
                              className="border-orange-500 text-orange-600 hover:bg-orange-500/10 hover:text-orange-700"
                          >
                              <VolumeX className="mr-1.5 h-4 w-4"/> Alle Stumm
                          </Button>
                      )}
                      {sessionParticipants.filter(p => !p.isBot).length > 0 && (
                          <AlertDialog>
                              <AlertDialogTrigger asChild>
                                  <Button 
                                      variant="destructive" 
                                      size="sm"
                                      disabled={isRemovingAllParticipants || isProcessingSessionAction || isSessionEffectivelyEnded || (!isChatActive && !isSessionOpenForJoin && !isSessionEffectivelyPaused)}
                                      className="bg-destructive hover:bg-destructive/90"
                                      title="Entfernt alle menschlichen Teilnehmer unwiderruflich aus der Sitzung."
                                  >
                                      {isRemovingAllParticipants ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin"/> : <UserX className="mr-1.5 h-4 w-4"/>}
                                      Alle Entfernen
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
                      )}
                <Button
                    onClick={handleToggleRoleLock}
                    variant={sessionData?.roleSelectionLocked ? "secondary" : "default"}
                          size="sm"
                    className={cn(
                              "transition-colors", 
                        sessionData?.roleSelectionLocked ? "bg-red-600 hover:bg-red-700 text-white" : "bg-green-600 hover:bg-green-700 text-white"
                    )}
                    disabled={isProcessingSessionAction || !sessionData || isSessionPending || isSessionEffectivelyEnded || isChatActive}
                >
                          {sessionData?.roleSelectionLocked ? <Lock className="mr-1.5 h-4 w-4"/> : <Unlock className="mr-1.5 h-4 w-4"/>}
                    {sessionData?.roleSelectionLocked ? 'Rollenauswahl gesperrt' : 'Rollenauswahl offen'}
                </Button>
                  </div>
            </div>
        </CardHeader>
        <CardContent className="space-y-4">
            {isLoadingParticipants && <div className="text-sm text-muted-foreground flex items-center"><Loader2 className="h-4 w-4 animate-spin mr-2"/> Lade Rollenzuordnungen...</div>}
            {!isLoadingParticipants && currentScenario?.humanRolesConfig && currentScenario.humanRolesConfig.length > 0 ? (
                  <ScrollArea className="border rounded-md p-1 md:p-2"> {/* Removed max-h-96 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                    {currentScenario.humanRolesConfig.map(roleConfig => {
                        const assignedParticipantsToThisRole = sessionParticipants.filter(p => !p.isBot && p.roleId === roleConfig.id);
                          const isRoleCurrentlyMuted = sessionData?.mutedRoleIds?.includes(roleConfig.id) ?? false;
                          const activeRolePenalty = sessionData?.activeRolePenalties?.find(p => p.roleId === roleConfig.id);

                          let rolePenaltyTimeRemaining: string | null = null;
                          if (activeRolePenalty && activeRolePenalty.startedAt instanceof Timestamp) {
                            const endTime = activeRolePenalty.startedAt.toDate().getTime() + activeRolePenalty.durationMinutes * 60 * 1000;
                            const now = Date.now();
                            const remainingMillis = endTime - now;
                            if (remainingMillis <= 0) {
                              rolePenaltyTimeRemaining = "(Abgelaufen)";
                            } else {
                              const remainingSecondsTotal = Math.ceil(remainingMillis / 1000);
                              const minutes = Math.floor(remainingSecondsTotal / 60);
                              const seconds = remainingSecondsTotal % 60;
                              rolePenaltyTimeRemaining = `(${minutes}m ${seconds < 10 ? '0' : ''}${seconds}s)`;
                            }
                          }

                        return (
                            <Card key={roleConfig.id} className="flex flex-col bg-muted/30">
                                <CardHeader className="pb-2 pt-3 px-3 md:px-4">
                                      <div className="flex justify-between items-center gap-2">
                                          <CardTitle className="text-base font-semibold text-primary truncate flex-grow">{roleConfig.name} <Badge variant="outline" className="ml-1 text-xs align-middle">({assignedParticipantsToThisRole.length})</Badge></CardTitle>
                                          <div className="flex items-center shrink-0 gap-1">
                                              {/* Role Broadcast Button - NOW ORANGE */}
                                              <Button
                                                  variant="outline"
                                                  size="icon"
                                                  onClick={() => handleOpenGlobalBroadcastModal('role', roleConfig.id)}
                                                  disabled={isApplyingPenaltyOrMute === roleConfig.id || isSessionEffectivelyEnded || isProcessingSessionAction || (!isChatActive && !isSessionOpenForJoin && !isSessionEffectivelyPaused)}
                                                  title={`Broadcast an Rolle "${roleConfig.name}" senden`}
                                                  className="h-7 w-7 border-orange-500 text-orange-600 hover:bg-orange-500/10 hover:text-orange-700"
                                              >
                                                  <Megaphone className="h-4 w-4" />
                                              </Button>
                                              {/* Role Penalty Icons & Countdown */}
                                              {activeRolePenalty && (
                                                  <div className="flex items-center gap-1 mr-1">
                                                      <Badge 
                                                          variant={activeRolePenalty.penaltyType === 'red' ? "destructive" : "default"} 
                                                          className={cn(
                                                              "text-xs h-7 px-2 py-1", 
                                                              activeRolePenalty.penaltyType === 'yellow' && "bg-yellow-500 text-black hover:bg-yellow-600"
                                                          )}
                                                          title={`${activeRolePenalty.penaltyType === 'yellow' ? "Gelbe Karte (Rolle)" : "Rote Karte (Rolle)"} aktiv`}
                                                      >
                                                          <Ban className="h-3 w-3 mr-1"/> {rolePenaltyTimeRemaining}
                                                      </Badge>
                                                      <Button
                                                          variant="outline"
                                                          size="icon"
                                                          onClick={() => handleClearPenaltyFromRole(roleConfig.id)}
                                                          disabled={isApplyingPenaltyOrMute === roleConfig.id || isSessionEffectivelyEnded || isProcessingSessionAction || (!isChatActive && !isSessionOpenForJoin && !isSessionEffectivelyPaused)}
                                                          title="Strafe für Rolle aufheben"
                                                          className="h-7 w-7 border-blue-500 text-blue-600 hover:bg-blue-500/10 hover:text-blue-700"
                                                      >
                                                          {isApplyingPenaltyOrMute === roleConfig.id && activeRolePenalty ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
                                                      </Button>
                                                  </div>
                                              )}
                                              {!activeRolePenalty && (assignedParticipantsToThisRole.length > 0 || (roleConfig.allowBotsToJoin && sessionParticipants.some(p => p.isBot && p.roleId === roleConfig.id))) && (
                                                  <>
                                                      <Button
                                                          variant="outline"
                                                          size="icon"
                                                          onClick={() => handleApplyPenaltyToRole(roleConfig.id, 'yellow')}
                                                          disabled={isApplyingPenaltyOrMute === roleConfig.id || isSessionEffectivelyEnded || isProcessingSessionAction || (!isChatActive && !isSessionOpenForJoin && !isSessionEffectivelyPaused)}
                                                          title="Gelbe Karte für ganze Rolle (1 Min. Pause + Stumm)"
                                                          className="h-7 w-7 border-yellow-500 text-yellow-600 hover:bg-yellow-500/10 hover:text-yellow-700"
                                                      >
                                                          {isApplyingPenaltyOrMute === roleConfig.id && !activeRolePenalty ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                                                      </Button>
                                                      <Button
                                                          variant="outline"
                                                          size="icon"
                                                          onClick={() => handleApplyPenaltyToRole(roleConfig.id, 'red')}
                                                          disabled={isApplyingPenaltyOrMute === roleConfig.id || isSessionEffectivelyEnded || isProcessingSessionAction || (!isChatActive && !isSessionOpenForJoin && !isSessionEffectivelyPaused)}
                                                          title="Rote Karte für ganze Rolle (3 Min. Pause + Stumm)"
                                                          className="h-7 w-7 border-red-500 text-red-600 hover:bg-red-500/10 hover:text-red-700"
                                                      >
                                                          {isApplyingPenaltyOrMute === roleConfig.id && !activeRolePenalty ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                                                      </Button>
                                                  </>
                                              )}
                                              {/* Mute Button */} 
                                              <Button
                                                  variant={isRoleCurrentlyMuted ? "destructive" : "outline"} 
                                                  size="icon" 
                                                  onClick={() => handleToggleMuteRole(roleConfig.id)}
                                                  disabled={isApplyingPenaltyOrMute === roleConfig.id || isSessionEffectivelyEnded || isProcessingSessionAction || (!isChatActive && !isSessionOpenForJoin && !isSessionEffectivelyPaused)}
                                                  title={isRoleCurrentlyMuted ? "Stummschaltung für Rolle aufheben" : "Rolle stummschalten"}
                                                  className={cn(
                                                      "h-7 w-7",
                                                      isRoleCurrentlyMuted ? "hover:bg-red-700" : "hover:bg-green-500/10 hover:text-green-600 border-green-500 text-green-500"
                                                  )}
                                              >
                                                  {isApplyingPenaltyOrMute === roleConfig.id && (isRoleCurrentlyMuted || !isRoleCurrentlyMuted) ? <Loader2 className="h-4 w-4 animate-spin" /> : (isRoleCurrentlyMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />)}
                                              </Button>
                                          </div>
                                      </div>
                                </CardHeader>
                                  {/* REMOVED Penalty Controls for Roles that were below Header */}
                                <CardContent className="text-xs text-muted-foreground space-y-1 flex-grow px-3 md:px-4 pb-3">
                                    {assignedParticipantsToThisRole.length > 0 ? (
                                          <ul className="space-y-2 pt-1">
                                              {assignedParticipantsToThisRole.map(p => {
                                                  const penaltyTimeRemaining = getPenaltyTimeRemaining(p.activePenalty);
                                                  const isLoadingThisParticipant = isApplyingPenaltyOrMute === p.id || isRemovingParticipant === p.id || isMovingParticipant === p.id;
                                                  
                                                  return (
                                                      <li key={p.id} className="text-xs flex flex-col gap-1.5 p-2 rounded bg-card shadow-sm border">
                                                          {/* Row 1: Name, Status, Badges & Action Icons aligned to the right */}
                                                          <div className="flex justify-between items-center">
                                                              <div className="flex-grow truncate mr-2">
                                                                  <span className="font-medium text-foreground truncate block" title={`${p.displayName} (${p.realName})`}>
                                                                      {p.displayName} <span className="text-xs text-muted-foreground">({p.realName || "N/A"})</span>
                                                    </span>
                                                                  <span className={cn(
                                                                      "text-xs",
                                                                      p.status === "Nicht beigetreten" ? "italic text-orange-500" :
                                                                      p.status === "Wählt Rolle" || p.status === "Im Wartebereich" ? "text-blue-500" :
                                                                      p.status === "Beigetreten" ? "text-green-500" : "text-gray-500"
                                                                  )}>
                                                                      {p.status ? (p.status.charAt(0).toUpperCase() + p.status.slice(1)) : "Unbekannt"}
                                                                  </span>
                                                              </div>
                                                              <div className="flex items-center gap-1 shrink-0">
                                                                  {/* Participant Standard DM Button */}
                                                                  {!p.isBot && (
                                                                      <Button
                                                                          variant="outline"
                                                                          size="icon"
                                                                          onClick={() => handleOpenAdminStandardDmModal(p)} 
                                                                          disabled={isLoadingThisParticipant || isSessionEffectivelyEnded || isProcessingSessionAction || (!isChatActive && !isSessionOpenForJoin && !isSessionEffectivelyPaused)}
                                                                          title={`Direktnachricht an ${p.displayName} senden`}
                                                                          className="h-7 w-7 text-foreground hover:bg-muted border-neutral-400"
                                                                      >
                                                                          <Send className="h-3.5 w-3.5" />
                                                                      </Button>
                                                                  )}
                                                                  {/* Admin Broadcast DM Button (Megaphone) */}
                                                                  {!p.isBot && (
                                                                      <Button
                                                                          variant="outline"
                                                                          size="icon"
                                                                          onClick={() => handleOpenAdminDmModal(p)}
                                                                          disabled={isLoadingThisParticipant || isSessionEffectivelyEnded || isProcessingSessionAction || (!isChatActive && !isSessionOpenForJoin && !isSessionEffectivelyPaused)}
                                                                          title={`Admin-Nachricht an ${p.displayName} senden (öffnet Overlay)`}
                                                                          className="h-7 w-7 text-orange-500 hover:bg-orange-500/10 border-orange-500"
                                                                      >
                                                                          <Megaphone className="h-3.5 w-3.5" />
                                                                      </Button>
                                                                  )}
                                                                  {/* Mute/Unmute Button */}
                                                                  <Button
                                                                      variant={(p.isMuted && !p.activePenalty) ? "destructive" : "outline"}
                                                                      size="icon"
                                                                      onClick={() => handleToggleMuteParticipant(p.id, p.isMuted || false)}
                                                                      disabled={isLoadingThisParticipant || !!p.activePenalty || isSessionEffectivelyEnded || isProcessingSessionAction || (!isChatActive && !isSessionOpenForJoin && !isSessionEffectivelyPaused)}
                                                                      className={cn(
                                                                          "h-7 w-7",
                                                                          !(p.isMuted && !p.activePenalty) && "border-green-500 text-green-500 hover:bg-green-500/10 hover:text-green-600"
                                                                      )}
                                                                      title={p.isMuted ? "Freischalten" : "Stummschalten"}
                                                                  >
                                                                      {isApplyingPenaltyOrMute === p.id && (p.isMuted || !p.isMuted) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : ((p.isMuted && !p.activePenalty) ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />)}
                                                                  </Button>

                                                                  {/* Penalty Buttons (Yellow/Red or Clear) */}
                                                                  {!p.activePenalty && (
                                                                      <>
                                                                          <Button size="icon" variant="outline" className="h-7 w-7 border-yellow-500 text-yellow-600 hover:bg-yellow-500/10 hover:text-yellow-700"
                                                                              onClick={() => handleApplyPenaltyToParticipant(p.id, 'yellow')}
                                                                              disabled={isLoadingThisParticipant || isSessionEffectivelyEnded || isProcessingSessionAction || (!isChatActive && !isSessionOpenForJoin && !isSessionEffectivelyPaused)}
                                                                              title="Gelbe Karte (1 Min. Pause + Stumm)"
                                                                          >
                                                                              {isApplyingPenaltyOrMute === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
                                                                          </Button>
                                                                          <Button size="icon" variant="outline" className="h-7 w-7 border-red-500 text-red-600 hover:bg-red-500/10 hover:text-red-700"
                                                                              onClick={() => handleApplyPenaltyToParticipant(p.id, 'red')}
                                                                              disabled={isLoadingThisParticipant || isSessionEffectivelyEnded || isProcessingSessionAction || (!isChatActive && !isSessionOpenForJoin && !isSessionEffectivelyPaused)}
                                                                              title="Rote Karte (3 Min. Pause + Stumm)"
                                                                          >
                                                                              {isApplyingPenaltyOrMute === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
                                                                          </Button>
                                                                      </>
                                                                  )}
                                                                  {p.activePenalty && (
                                                                      <Button size="icon" variant="outline" className="h-7 w-7 border-blue-500 text-blue-600 hover:bg-blue-500/10 hover:text-blue-700"
                                                                          onClick={() => handleClearPenaltyForParticipant(p.id)}
                                                                          disabled={isLoadingThisParticipant || isSessionEffectivelyEnded || isProcessingSessionAction || (!isChatActive && !isSessionOpenForJoin && !isSessionEffectivelyPaused)}
                                                                          title="Strafe vorzeitig aufheben"
                                                                      >
                                                                          {isApplyingPenaltyOrMute === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}
                                                                      </Button>
                                                                  )}
                                                                  {/* Role Change Select - Placed here for better alignment */}
                                                                  <div className="min-w-[100px] max-w-[150px]"> {/* Adjusted width constraints */}
                                                    <Select 
                                                        value={p.roleId || ""} 
                                                        onValueChange={(newRoleId) => handleMoveParticipant(p.id, newRoleId)}
                                                                          disabled={isMovingParticipant === p.id || isLoadingThisParticipant || isProcessingSessionAction || isSessionEffectivelyEnded || (!isSessionOpenForJoin && !isChatActive && !isSessionEffectivelyPaused)}
                                                    >
                                                                          <SelectTrigger className="h-7 text-xs w-full truncate border-dashed hover:border-primary hover:text-primary">
                                                                              <SelectValue placeholder="Rolle..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {currentScenario?.humanRolesConfig?.map(rOption => (
                                                                <SelectItem key={rOption.id} value={rOption.id} disabled={rOption.id === p.roleId}>
                                                                    {rOption.name}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                          </div>
                                                          
                                                          {/* Remove Participant Button */}
                                                          <AlertDialog>
                                                              <AlertDialogTrigger asChild>
                                                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                                                      disabled={isLoadingThisParticipant || isSessionEffectivelyEnded || isProcessingSessionAction || (!isChatActive && !isSessionOpenForJoin && !isSessionEffectivelyPaused)}>
                                                                      {isRemovingParticipant === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
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
                                                                      <AlertDialogAction onClick={() => handleRemoveParticipant(p.id, p.displayName || "Teilnehmer")} disabled={isRemovingParticipant === p.id} className="bg-destructive hover:bg-destructive/90">
                                                                          {isRemovingParticipant === p.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Ja, entfernen"}
                                                                      </AlertDialogAction>
                                                                  </AlertDialogFooter>
                                                              </AlertDialogContent>
                                                          </AlertDialog>
                                                      </div> {/* End of action icons div */}
                                                  </div>

                                                  {/* Row 2: Badges (Mute/Penalty) - shown below name/status if active */}
                                                  <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                                      {p.isMuted && !p.activePenalty && <Badge variant="destructive" className="text-xs px-1.5 py-0.5">🔇 Stumm</Badge>}
                                                      {p.activePenalty && (
                                                          <Badge variant={p.activePenalty.type === 'red' ? "destructive" : "default"} className={cn("text-xs px-1.5 py-0.5", p.activePenalty.type === 'yellow' && "bg-yellow-500 text-black hover:bg-yellow-600")}>
                                                              {p.activePenalty.description} {penaltyTimeRemaining && `(${penaltyTimeRemaining})`}
                                                          </Badge>
                                                      )}
                                                  </div>
                                                </li>
                                          );
                                      })} 
                                        </ul>
                                    ) : (
                                        <p className="text-xs text-muted-foreground italic py-2">Diese Rolle ist noch nicht besetzt.</p>
                                    )}
                                </CardContent>
                          {/* REMOVED Penalty Buttons from CardFooter */}
                            </Card>
                        );
                    })}
                    </div>
                </ScrollArea>
            ) : (
                !isLoadingParticipants && <p className="text-sm text-muted-foreground">Keine menschlichen Rollen im Szenario definiert oder Teilnehmer werden geladen.</p>
            )}
        </CardContent>
      </Card>
        
      {/* Bottom Row: Chat Preview, Participant Actions, Bot Control, etc. - Flexible Grid */}
      <div className={cn("grid grid-cols-1 gap-6 w-full", showParticipantMirrorView ? "hidden" : "lg:grid-cols-3")}>
         <Card className="lg:col-span-2 xl:col-span-2"> {/* Chat-Verlauf (Admin-Vorschau) - Nimmt mehr Platz */}
              <CardHeader>
              <CardTitle className="flex items-center"><MessageSquare className="mr-2 h-5 w-5 text-primary" /> Chat-Verlauf (Admin-Vorschau)</CardTitle>
              <CardDescription>Beobachten Sie die laufende Diskussion.</CardDescription>
              </CardHeader>
              <CardContent className="h-96 bg-muted/30 rounded-md p-2 md:p-4 space-y-2 overflow-y-auto" ref={adminChatPreviewEndRef}>
              {isLoadingMessages && <div className="flex items-center justify-center h-full text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mr-2"/> <p>Lade Chat...</p></div>}
              {!isLoadingMessages && chatMessages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <MessageCircleIcon className="w-12 h-12 mb-2 opacity-50" />
                  <p>Noch keine Nachrichten in dieser Sitzung.</p>
                  </div>
              )}
              {!isLoadingMessages && chatMessages.map(msg => (
                  <div key={msg.id} className="text-sm p-2 rounded bg-card/80 shadow-sm">
                  <span className={`font-semibold ${msg.senderType === 'bot' ? 'text-accent' : msg.senderType === 'admin' ? 'text-destructive' : (msg.senderType === 'system' ? 'text-muted-foreground' : 'text-foreground/80')}`}>
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
              {/* <div ref={adminChatPreviewEndRef} /> Removed as per request to stop auto-scroll */}
              </CardContent>
          </Card>

          {/* THIS ENTIRE CARD and its content (Teilnehmer-Aktionen) SHOULD BE DELETED if it still exists
             If the card starting with <Card className="lg:col-span-1 xl:col-span-1"> and containing 
             <CardTitle className="flex items-center"><Users className="mr-2 h-5 w-5 text-primary" /> Teilnehmer-Steuerung ... </CardTitle> 
             is present here, it will be removed. 
          */}
          
          <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1 xl:col-span-1"> {/* Bot-Steuerung */}
                <CardHeader>
                <CardTitle className="flex items-center"><Bot className="mr-2 h-5 w-5 text-primary" /> Bot-Steuerung ({sessionParticipants.filter(p=>p.isBot).length} / {currentScenario?.defaultBotsConfig?.length || 0})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 max-h-96 overflow-y-auto">
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
                    <div key={botParticipant.id} className="p-3 border rounded-lg space-y-3 bg-muted/20">
                        <div className="flex items-center justify-between">
                        <p className="font-semibold">{botName} <Badge variant={botIsActive ? "default" : "outline"} className={cn("ml-2", botIsActive ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-gray-400 hover:bg-gray-500 text-white')}>{botIsActive ? "Aktiv" : "Inaktiv"}</Badge> <span className="text-xs text-muted-foreground">(ID: {botConfig.id || 'N/A'})</span></p>
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
                            disabled={isSessionEffectivelyEnded || isProcessingSessionAction || !botIsActive || (!isChatActive && !isSessionOpenForJoin && !isSessionEffectivelyPaused) || true} 
                            onCheckedChange={() => {
                                handleBotAutoTimerToggle(botParticipant.id, botAutoTimer)
                                toast({title: "Auto-Timer (Zukunft)", description: `Auto-Timer für Bot ${botName} ${!botAutoTimer ? 'aktiviert' : 'deaktiviert'}. Die automatische Antwortfunktion ist noch nicht implementiert.`})
                            }}
                        />
                        </div>
                    </div>
                    );
                })}
                {(!currentScenario?.defaultBotsConfig || currentScenario.defaultBotsConfig.length === 0) && !isLoadingParticipants && (
                    <p className="text-sm text-muted-foreground">Keine Bots für dieses Szenario konfiguriert.</p>
                )}
                    {!isLoadingParticipants && sessionParticipants.filter(p=>p.isBot).length === 0 && currentScenario && (currentScenario.defaultBotsConfig?.length || 0) > 0 && (
                        <p className="text-sm text-muted-foreground">Bots werden initialisiert oder sind nicht konfiguriert.</p>
                    )}
                </CardContent>
            </Card>

            <Card className="lg:col-span-1 xl:col-span-1"> {/* Ereignis-Steuerung */}
                <CardHeader>
                    <CardTitle className="flex items-center"><Sparkles className="mr-2 h-5 w-5 text-primary" /> Ereignis-Steuerung</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 max-h-96 overflow-y-auto">
                    {isLoadingScenario || !currentScenario?.events || currentScenario.events.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            {isLoadingScenario ? "Lade Szenario-Ereignisse..." : "Keine manuellen Ereignisse für dieses Szenario definiert."}
                        </p>
                    ) : (
                        currentScenario.events.filter(event => event.triggerType === 'manual').map(event => (
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
                                        disabled={isSessionEffectivelyEnded || !isChatActive || isProcessingSessionAction}
                                    >
                                        <Wand2 className="mr-2 h-4 w-4"/> Auslösen
                                    </Button>
                                </div>
                            </Card>
                        ))
                    )}
                    {currentScenario?.events && currentScenario.events.filter(event => event.triggerType === 'manual').length === 0 && !isLoadingScenario && (
                            <p className="text-sm text-muted-foreground">Keine *manuellen* Ereignisse für dieses Szenario definiert.</p>
                    )}
                </CardContent>
            </Card>
            
            <Card className="lg:col-span-1 xl:col-span-1"> {/* Datenexport */}
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

      {showParticipantMirrorView && (
        <Card className="border-primary/50 shadow-lg w-full mt-6"> 
          <CardHeader>
            <CardTitle className="flex items-center text-primary"><Eye className="mr-2 h-5 w-5"/> Live Chat-Vollansicht (Als Admin)</CardTitle>
            <CardDescription>Hier sehen und interagieren Sie als "Admin" im Live-Chat der Sitzung.</CardDescription>
          </CardHeader>
          <CardContent className="h-[70vh] p-0">
            {sessionIdFromUrl && (
              <ChatPageContent
                sessionId={sessionIdFromUrl}
                initialUserDisplayName="Admin" 
                initialUserRole="Moderator" 
                initialUserId="ADMIN_USER_ID_FIXED" 
                initialUserAvatarFallback="AD"
                initialUserRealName="Administrator" // Klarname für Admin
                isAdminView={true}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* MODALS & DIALOGS should be grouped here at the end of the main layout structure */}

      {/* Global Settings Dialog */}
      {/* ... (Global Settings Dialog JSX) ... */}
      
      {/* Participant Mirror View Dialog */}
      {/* ... (Participant Mirror View Dialog JSX) ... */}

      {/* Confirmation Dialog for Ending Session */}
      {/* ... (End Session Dialog JSX) ... */}

      {/* Confirmation Dialog for Resetting Session */}
      {/* ... (Reset Session Dialog JSX) ... */}

      {/* Confirmation Dialog for Removing ALL Participants */}
      {/* ... (Remove All Participants Dialog JSX) ... */}

      {/* Admin Standard DM Modal - MOVED HERE */}
      {adminStandardDmRecipient && (
        <Dialog open={showAdminStandardDmModal} onOpenChange={(isOpen) => {
          if (!isOpen) {
            setAdminStandardDmRecipient(null);
            setAdminStandardDmContent("");
          }
          setShowAdminStandardDmModal(isOpen);
        }}>
          <DialogContent className="sm:max-w-[525px]">
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <MessageSquareIconLucide className="mr-2 h-5 w-5" /> Direktnachricht an {adminStandardDmRecipient.displayName}
              </DialogTitle>
              <DialogDescription>
                Verfassen Sie eine private Nachricht an {adminStandardDmRecipient.realName || adminStandardDmRecipient.displayName}.
                Diese Nachricht erscheint nur in der Inbox des Teilnehmers und nicht im Hauptchat.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <Textarea
                id="adminStandardDmContent"
                placeholder={`Deine Nachricht an ${adminStandardDmRecipient.displayName}...`}
                value={adminStandardDmContent}
                onChange={(e) => setAdminStandardDmContent(e.target.value)}
                className="min-h-[100px]"
                disabled={isSendingAdminStandardDm}
              />
    </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" disabled={isSendingAdminStandardDm}>Abbrechen</Button>
              </DialogClose>
              <Button onClick={handleSendAdminStandardDm} disabled={isSendingAdminStandardDm || !adminStandardDmContent.trim()}>
                {isSendingAdminStandardDm ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Senden
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Admin Broadcast DM Modal */}
      {adminDmRecipient && (
        <Dialog open={showAdminDmModal} onOpenChange={(isOpen) => {
          if (!isOpen) {
            setAdminDmRecipient(null);
            setAdminDmContent("");
          }
          setShowAdminDmModal(isOpen);
        }}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Admin-Nachricht an {adminDmRecipient?.displayName || "Teilnehmer"}</DialogTitle>
              <DialogDescription>
                Verfassen Sie eine wichtige Nachricht, die dem Teilnehmer direkt als Overlay angezeigt wird.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <Textarea
                id="admin-dm-content"
                value={adminDmContent}
                onChange={(e) => setAdminDmContent(e.target.value)}
                placeholder={`Ihre Nachricht an ${adminDmRecipient?.displayName}...`}
                className="min-h-[100px]"
                disabled={isSendingAdminDm}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAdminDmModal(false)} disabled={isSendingAdminDm}>Abbrechen</Button>
              <Button type="submit" onClick={handleSendAdminDm} disabled={!adminDmContent.trim() || isSendingAdminDm}>
                {isSendingAdminDm ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Senden
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Global Broadcast Modal */}
      {showGlobalBroadcastModal && (
        <Dialog open={showGlobalBroadcastModal} onOpenChange={(isOpen) => {
          if (!isOpen) {
            setGlobalBroadcastTargetRoleId(null);
            setGlobalBroadcastContent("");
          }
          setShowGlobalBroadcastModal(isOpen);
        }}>
          <DialogContent className="sm:max-w-[525px]">
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <Megaphone className="mr-2 h-5 w-5 text-orange-500" />
                Globaler Broadcast an {globalBroadcastType === 'all' ? 'alle Teilnehmer' : 
                  `Teilnehmer der Rolle "${currentScenario?.humanRolesConfig?.find(r => r.id === globalBroadcastTargetRoleId)?.name || globalBroadcastTargetRoleId}"`}
              </DialogTitle>
              <DialogDescription>
                Diese Nachricht wird allen ausgewählten Teilnehmern als Overlay angezeigt und in ihrer Inbox hervorgehoben.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <Textarea
                id="globalBroadcastContent"
                placeholder={`Deine Broadcast-Nachricht...`}
                value={globalBroadcastContent}
                onChange={(e) => setGlobalBroadcastContent(e.target.value)}
                className="min-h-[100px]"
                disabled={isSendingGlobalBroadcast}
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" disabled={isSendingGlobalBroadcast}>Abbrechen</Button>
              </DialogClose>
              <Button onClick={handleSendGlobalBroadcast} disabled={isSendingGlobalBroadcast || !globalBroadcastContent.trim()}>
                {isSendingGlobalBroadcast ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Broadcast Senden
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  </TooltipProvider>
  );
}

