
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AlertCircle, Bot, ChevronDown, ChevronUp, Download, MessageSquare, Play, Pause, QrCode, Users, Settings, Volume2, VolumeX, Copy, MessageCircle as MessageCircleIcon, Power, RotateCcw, RefreshCw, Eye } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { scenarios } from "@/lib/scenarios";
import type { Scenario, BotConfig, Participant, Message as MessageType, SessionData } from "@/lib/types";
import { useEffect, useState, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/firebase";
import { doc, setDoc, getDoc, serverTimestamp, collection, onSnapshot, query, orderBy, Timestamp, updateDoc, writeBatch, getDocs, where, deleteDoc } from "firebase/firestore";
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
import { ChatPageContent } from "@/app/chat/[sessionId]/page"; // Import der refaktorierten Komponente

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
  const [currentScenario, setCurrentScenario] = useState<Scenario | undefined>(undefined);
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [sessionParticipants, setSessionParticipants] = useState<Participant[]>([]);
  const [chatMessages, setChatMessages] = useState<AdminDashboardMessage[]>([]); // Beibehalten für einfache Admin-Ansicht, falls benötigt
  
  const [isLoadingSessionData, setIsLoadingSessionData] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true); // Für die einfache Chat-Ansicht
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(true);
  const [isEndingSession, setIsEndingSession] = useState(false);
  const [isStartingOrRestartingSession, setIsStartingOrRestartingSession] = useState(false);
  const [isResettingSession, setIsResettingSession] = useState(false);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [showParticipantMirrorView, setShowParticipantMirrorView] = useState(false);

  const [paceValue, setPaceValue] = useState<number>(DEFAULT_COOLDOWN);
  const chatMessagesEndRef = useRef<null | HTMLDivElement>(null);


  const displayedInvitationLink = sessionData?.invitationLink && sessionData.invitationToken 
    ? `${sessionData.invitationLink}?token=${sessionData.invitationToken}` 
    : "Wird generiert...";

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
            } else {
              if (!sessionData || sessionData.scenarioId !== existingData.scenarioId) {
                setSessionData(existingData); 
              }
            }
            setPaceValue(existingData.messageCooldownSeconds ?? DEFAULT_COOLDOWN);
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
    }
  }, [sessionId, toast]);


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
      querySnapshot.forEach((doc) => {
        fetchedParticipants.push({ id: doc.id, ...doc.data() } as Participant);
      });
      setSessionParticipants(fetchedParticipants);
      setIsLoadingParticipants(false);
    }, (error) => {
      console.error("Error fetching participants: ", error);
      setIsLoadingParticipants(false);
    });
    return () => unsubscribeParticipants();
  }, [sessionId]);

  // Effect for Chat Messages (für die Admin-Ansicht, die nicht die ChatPageContent Komponente ist)
  useEffect(() => {
    if (!sessionId || showParticipantMirrorView) { // Nur laden, wenn Spiegelansicht nicht aktiv ist
      setIsLoadingMessages(false); // Wenn Spiegel aktiv, werden Nachrichten von ChatPageContent geladen
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
  }, [sessionId, showParticipantMirrorView]); // Abhängigkeit showParticipantMirrorView hinzugefügt

  useEffect(() => {
    if (showParticipantMirrorView && chatMessagesEndRef.current) { // Dieser Ref ist für die *alte* Chat-Anzeige
      // chatMessagesEndRef.current.scrollIntoView({ behavior: "smooth" }); // Auskommentiert, da ChatPageContent eigenes Scrolling hat
    }
  }, [chatMessages, showParticipantMirrorView]);


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
    if (!sessionId) return;
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
    };

    if (!sessionData || sessionData.status === "ended" || sessionData.status === "paused") {
        sessionUpdateData.createdAt = serverTimestamp(); 
    }

    try {
        await setDoc(sessionDocRef, sessionUpdateData, { merge: true }); 
        toast({ title: "Sitzung gestartet/aktualisiert", description: "Die Sitzung ist jetzt aktiv mit neuem Link-Token." });
    } catch (error) {
        console.error("Error starting/restarting session: ", error);
        toast({ variant: "destructive", title: "Fehler", description: "Sitzung konnte nicht gestartet/aktualisiert werden." });
    } finally {
        setIsStartingOrRestartingSession(false);
    }
  };

  const handleResetSession = async () => {
    if (!sessionId) return;
    setIsResettingSession(true);
    const sessionDocRef = doc(db, "sessions", sessionId);
    const participantsColRef = collection(db, "sessions", sessionId, "participants");
    const messagesColRef = collection(db, "sessions", sessionId, "messages");

    try {
      const batch = writeBatch(db);
      const participantsSnap = await getDocs(participantsColRef);
      participantsSnap.forEach(doc => batch.delete(doc.ref));
      const messagesSnap = await getDocs(messagesColRef);
      messagesSnap.forEach(doc => batch.delete(doc.ref));
      await batch.commit();

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
      await setDoc(sessionDocRef, newSessionData); 

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
    setPaceValue(newCooldown); 
    const sessionDocRef = doc(db, "sessions", sessionId);
    try {
      await updateDoc(sessionDocRef, { messageCooldownSeconds: newCooldown });
    } catch (error) {
      console.error("Error updating pace: ", error);
      toast({ variant: "destructive", title: "Fehler", description: "Pace konnte nicht angepasst werden." });
    }
  };

  const handleMuteAllUsers = async () => {
    if (!sessionId || !sessionData || sessionData.status === "ended") return;
    const participantsColRef = collection(db, "sessions", sessionId, "participants");
    const q = query(participantsColRef, where("isBot", "==", false));
    try {
      const querySnapshot = await getDocs(q);
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


  const scenarioTitle = currentScenario?.title || "Szenario wird geladen...";
  const expectedStudentRoles = currentScenario ? currentScenario.standardRollen - currentScenario.defaultBots : 0;

  const getBotDisplayName = (botConfig: BotConfig, index: number): string => {
    if (botConfig.name) return botConfig.name;
    switch (botConfig.personality) {
      case 'provokateur': return 'Bot Provokateur';
      case 'verteidiger': return 'Bot Verteidiger';
      case 'informant': return 'Bot Informant';
      default: return `Bot ${index + 1} (${botConfig.personality || 'Standard'})`;
    }
  };
  
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
              <Button variant="destructive" disabled={isEndingSession || !isSessionActive && !isSessionPaused}>
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
        <Card className="mt-6 border-primary/50 shadow-lg col-span-1 lg:col-span-3"> {/* Volle Breite für die Chat-Einbettung */}
          <CardHeader>
            <CardTitle className="flex items-center text-primary"><Eye className="mr-2 h-5 w-5"/> Live Chat-Spiegelung</CardTitle>
            <CardDescription>Hier sehen und interagieren Sie als "Admin" im Live-Chat der Sitzung.</CardDescription>
          </CardHeader>
          <CardContent className="h-[70vh] p-0"> {/* Höhe anpassen, kein Padding für ChatPageContent */}
            {sessionId && ( // Sicherstellen, dass sessionId vorhanden ist
              <ChatPageContent 
                sessionId={sessionId} 
                initialUserName="Admin"
                initialUserRole="Moderator"
                initialUserId="ADMIN_USER_ID_FIXED" // Eine feste, eindeutige ID für den Admin
                initialUserAvatarFallback="AD"
                isAdminView={true} 
              />
            )}
          </CardContent>
        </Card>
      )}


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Diese Sektion wird nur angezeigt, wenn showParticipantMirrorView false ist */}
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
                      {currentScenario ? `${expectedStudentRoles} Teilnehmer, ${currentScenario.defaultBots} Bot(s)` : 'Laden...'}
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
                            {isStartingOrRestartingSession ? "Wird ausgeführt..." : 
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
                             {p.isMuted && <Badge variant="destructive" className="ml-2 text-xs">Stumm</Badge>}
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
                  <CardTitle className="flex items-center"><Bot className="mr-2 h-5 w-5 text-primary" /> Bot-Steuerung ({currentScenario?.defaultBotsConfig?.length || 0})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {currentScenario?.defaultBotsConfig?.map((botConfig, index) => {
                     const participantBot = sessionParticipants.find(p => p.isBot && p.name === getBotDisplayName(botConfig, index));
                     const botName = getBotDisplayName(botConfig, index);
                     const botIsActive = participantBot?.botConfig?.isActive ?? botConfig.isActive ?? true; 
                     const botEscalation = participantBot?.botConfig?.currentEscalation ?? botConfig.currentEscalation ?? 0;
                     const botAutoTimer = participantBot?.botConfig?.autoTimerEnabled ?? botConfig.autoTimerEnabled ?? false;

                    return (
                      <div key={`bot-${index}`} className="p-3 border rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold">{botName} <Badge variant={botIsActive ? "default" : "outline"}>{botIsActive ? "Aktiv" : "Inaktiv"}</Badge></p>
                          <Switch 
                            checked={botIsActive} 
                            onCheckedChange={() => alert(`Toggle Bot ${botName} (noch nicht implementiert)`)} 
                            disabled={!isSessionInteractable || isStartingOrRestartingSession || isResettingSession}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Eskalationslevel: {botEscalation}</Label>
                          <Progress value={botEscalation * 33.33} className="h-2" />
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => alert(`Eskalieren ${botName} (noch nicht implementiert)`)} disabled={!isSessionInteractable || isStartingOrRestartingSession || isResettingSession}><ChevronUp className="h-4 w-4" /></Button>
                          <Button variant="outline" size="sm" onClick={() => alert(`Deeskalieren ${botName} (noch nicht implementiert)`)} disabled={!isSessionInteractable || isStartingOrRestartingSession || isResettingSession}><ChevronDown className="h-4 w-4" /></Button>
                          <Button variant="secondary" size="sm" className="flex-1" onClick={() => alert(`Manuell Posten ${botName} (noch nicht implementiert)`)} disabled={!isSessionInteractable || isStartingOrRestartingSession || isResettingSession}>Posten</Button>
                        </div>
                        <div className="flex items-center space-x-2 pt-1">
                          <Label htmlFor={`autotimer-bot-${index}`} className="text-xs">Auto-Timer</Label>
                          <Switch id={`autotimer-bot-${index}`} checked={botAutoTimer} disabled={!isSessionInteractable || isStartingOrRestartingSession || isResettingSession} onCheckedChange={() => alert("Auto-Timer für Bot (noch nicht implementiert)")}/>
                        </div>
                      </div>
                    );
                  })}
                   {(!currentScenario?.defaultBotsConfig || currentScenario.defaultBotsConfig.length === 0) && (
                     <p className="text-sm text-muted-foreground">Für dieses Szenario sind keine Bots konfiguriert.</p>
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

    