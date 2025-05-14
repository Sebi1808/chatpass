
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AlertCircle, Bot, ChevronDown, ChevronUp, Download, MessageSquare, Play, Pause, QrCode, Users, Settings, Volume2, VolumeX, Copy, MessageCircle as MessageCircleIcon } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { scenarios } from "@/lib/scenarios";
import type { Scenario, BotConfig, Participant, Message as MessageType } from "@/lib/types";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/firebase";
import { doc, setDoc, getDoc, serverTimestamp, collection, onSnapshot, query, orderBy, Timestamp } from "firebase/firestore";

interface AdminSessionDashboardPageProps {
  params: { sessionId: string };
}

interface AdminDashboardMessage extends MessageType {
  id: string;
  timestampDisplay: string;
}

export default function AdminSessionDashboardPage({ params }: AdminSessionDashboardPageProps) {
  const { sessionId } = params;
  const { toast } = useToast();
  const [currentScenario, setCurrentScenario] = useState<Scenario | undefined>(undefined);
  const [invitationLink, setInvitationLink] = useState<string>("Wird generiert...");
  const [sessionParticipants, setSessionParticipants] = useState<Participant[]>([]);
  const [chatMessages, setChatMessages] = useState<AdminDashboardMessage[]>([]);
  const [isLoadingLink, setIsLoadingLink] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);


  useEffect(() => {
    const scenario = scenarios.find(s => s.id === sessionId);
    setCurrentScenario(scenario);

    if (scenario) {
      const sessionDocRef = doc(db, "sessions", sessionId);
      const generateLink = async () => {
        setIsLoadingLink(true);
        try {
          const docSnap = await getDoc(sessionDocRef);
          let link = "";
          if (typeof window !== "undefined") {
            link = `${window.location.origin}/join/${sessionId}`;
          }

          if (!docSnap.exists()) {
            await setDoc(sessionDocRef, {
              scenarioId: sessionId,
              createdAt: serverTimestamp(),
              invitationLink: link,
              status: "active" // Initial status
            });
            setInvitationLink(link);
            toast({ title: "Neue Sitzung erstellt", description: `Sitzung ${sessionId} wurde in Firestore angelegt.` });
          } else {
            const existingData = docSnap.data();
            if (existingData.invitationLink !== link && link) {
                 await setDoc(sessionDocRef, { invitationLink: link }, { merge: true });
                 setInvitationLink(link);
            } else {
                setInvitationLink(existingData.invitationLink || link);
            }
          }
        } catch (error) {
          console.error("Error managing session document: ", error);
          toast({ variant: "destructive", title: "Firestore Fehler", description: "Sitzung konnte nicht erstellt/geladen werden." });
          if (typeof window !== "undefined") {
            setInvitationLink(`${window.location.origin}/join/${sessionId}`); // Fallback
          }
        } finally {
          setIsLoadingLink(false);
        }
      };
      generateLink();

      const participantsColRef = collection(db, "sessions", sessionId, "participants");
      const participantsQuery = query(participantsColRef);
      const unsubscribeParticipants = onSnapshot(participantsQuery, (querySnapshot) => {
        const fetchedParticipants: Participant[] = [];
        querySnapshot.forEach((doc) => {
          fetchedParticipants.push({ id: doc.id, ...doc.data() } as Participant);
        });
        setSessionParticipants(fetchedParticipants);
      }, (error) => {
        console.error("Error fetching participants: ", error);
        toast({ variant: "destructive", title: "Firestore Fehler", description: "Teilnehmer konnten nicht geladen werden." });
      });

      // Listen for chat messages
      const messagesColRef = collection(db, "sessions", sessionId, "messages");
      const messagesQuery = query(messagesColRef, orderBy("timestamp", "asc"));
      setIsLoadingMessages(true);
      const unsubscribeMessages = onSnapshot(messagesQuery, (querySnapshot) => {
        const fetchedMessages: AdminDashboardMessage[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data() as MessageType;
          const timestamp = data.timestamp as Timestamp | null;
          fetchedMessages.push({
            ...data,
            id: doc.id,
            timestampDisplay: timestamp ? new Date(timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Senden...'
          });
        });
        setChatMessages(fetchedMessages);
        setIsLoadingMessages(false);
      }, (error) => {
        console.error("Error fetching messages: ", error);
        toast({ variant: "destructive", title: "Firestore Fehler", description: "Nachrichten konnten nicht geladen werden." });
        setIsLoadingMessages(false);
      });

      return () => {
        unsubscribeParticipants();
        unsubscribeMessages();
      };

    } else {
      setInvitationLink("Szenario nicht gefunden");
      setIsLoadingLink(false);
      setSessionParticipants([]);
      setChatMessages([]);
      setIsLoadingMessages(false);
    }
  }, [sessionId, toast]);

  const copyToClipboard = () => {
    if (invitationLink && invitationLink !== "Wird generiert..." && invitationLink !== "Szenario nicht gefunden") {
      navigator.clipboard.writeText(invitationLink).then(() => {
        toast({ title: "Link kopiert!", description: "Der Einladungslink wurde in die Zwischenablage kopiert." });
      }).catch(err => {
        toast({ variant: "destructive", title: "Fehler", description: "Link konnte nicht kopiert werden." });
        console.error('Failed to copy: ', err);
      });
    } else {
        toast({ variant: "destructive", title: "Fehler", description: "Einladungslink ist noch nicht bereit."});
    }
  };

  const scenarioTitle = currentScenario?.title || "Szenario wird geladen...";
  const expectedStudentRoles = currentScenario ? currentScenario.standardRollen - currentScenario.defaultBots : 0;

  const getBotDisplayName = (botConfig: BotConfig, index: number): string => {
    switch (botConfig.personality) {
      case 'provokateur': return 'Bot Provokateur';
      case 'verteidiger': return 'Bot Verteidiger';
      case 'informant': return 'Bot Informant';
      default: return `Bot ${index + 1} (${botConfig.personality || 'Standard'})`;
    }
  };
  
  const displayParticipantsList: Participant[] = [...sessionParticipants];
  if (currentScenario && sessionParticipants.length < expectedStudentRoles) {
    const joinedUserIds = new Set(sessionParticipants.map(p => p.userId));
    for (let i = 0; i < expectedStudentRoles; i++) {
        const placeholderId = `student-placeholder-${i + 1}`;
        if (!joinedUserIds.has(placeholderId) && displayParticipantsList.length < expectedStudentRoles ) {
             displayParticipantsList.push({
                id: placeholderId,
                userId: placeholderId,
                name: `Teilnehmer ${String.fromCharCode(65 + i)}`,
                role: `Teilnehmer ${String.fromCharCode(65 + i)}`,
                isBot: false,
                status: "Nicht beigetreten",
                avatarFallback: `T${String.fromCharCode(65 + i)}`,
            });
        }
    }
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
          <Button variant="destructive"><Pause className="mr-2 h-4 w-4" /> Sitzung beenden</Button>
        </div>
      </div>
      <Separator />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                  <Input id="invitation-link" type="text" value={isLoadingLink ? "Wird geladen..." : invitationLink} readOnly className="bg-muted" />
                  <Button variant="outline" size="icon" onClick={copyToClipboard} aria-label="Link kopieren" disabled={isLoadingLink}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Button variant="outline" onClick={() => alert("QR-Code Anzeige ist noch nicht implementiert.")}>
                <QrCode className="mr-2 h-4 w-4" /> QR-Code anzeigen
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center"><MessageSquare className="mr-2 h-5 w-5 text-primary" /> Chat-Verlauf (Live-Vorschau)</CardTitle>
              <CardDescription>Beobachten Sie die laufende Diskussion.</CardDescription>
            </CardHeader>
            <CardContent className="h-96 bg-muted/30 rounded-md p-4 overflow-y-auto space-y-2">
              {isLoadingMessages && <p className="text-sm text-muted-foreground">Chat-Nachrichten werden geladen...</p>}
              {!isLoadingMessages && chatMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <MessageCircleIcon className="w-12 h-12 mb-2 opacity-50" />
                  <p>Noch keine Nachrichten in dieser Sitzung.</p>
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
                <CardTitle className="flex items-center"><Settings className="mr-2 h-5 w-5 text-primary" /> Pace & Allgemeine Steuerung</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <Label htmlFor="pace-slider" className="mb-2 block">Pace-Regler (Cool-down: <span className="font-bold text-primary">5s</span>)</Label>
                    <Slider defaultValue={[5]} max={10} step={1} id="pace-slider" />
                </div>
                <div className="flex items-center justify-between">
                    <Label htmlFor="simulation-active" className="text-base">Simulation Aktiv</Label>
                    <Switch id="simulation-active" defaultChecked />
                </div>
                 <div className="flex items-center space-x-2">
                    <Button variant="outline"><Play className="mr-2 h-4 w-4" /> Globale Pause</Button>
                    <Button variant="destructive"><AlertCircle className="mr-2 h-4 w-4" /> Alle Stummschalten</Button>
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
              {displayParticipantsList.filter(p => !p.isBot).map(p => (
                <div key={p.id || p.userId} className="flex items-center justify-between p-2 bg-muted/20 rounded-md">
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                        {p.role} - 
                        <span className={p.status === "Nicht beigetreten" ? "italic text-orange-500" : (p.id.startsWith("student-placeholder") ? "italic text-orange-500" : "text-green-500")}>
                            {p.id.startsWith("student-placeholder") ? "Nicht beigetreten" : (p.status || "Beigetreten")}
                        </span>
                    </p>
                  </div>
                  <Button variant={p.isMuted ? "secondary" : "outline"} size="sm" onClick={() => alert(`Stummschalten/Entstummen für ${p.name} (noch nicht implementiert)`)}>
                    {p.isMuted ? <VolumeX className="mr-1 h-4 w-4" /> : <Volume2 className="mr-1 h-4 w-4" />}
                    {p.isMuted ? "Entstummen" : "Stumm"}
                  </Button>
                </div>
              ))}
              {expectedStudentRoles === 0 && sessionParticipants.filter(p => !p.isBot).length === 0 && (
                <p className="text-sm text-muted-foreground">Keine Teilnehmer für dieses Szenario vorgesehen.</p>
              )}
               {displayParticipantsList.filter(p => !p.isBot).length === 0 && expectedStudentRoles > 0 && (
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
                 const botName = getBotDisplayName(botConfig, index);
                 const botStatus = "Aktiv"; 
                 const botEscalation = 0; 

                return (
                  <div key={`bot-${index}`} className="p-3 border rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{botName} <Badge variant={botStatus === "Aktiv" ? "default" : "outline"}>{botStatus}</Badge></p>
                      <Switch checked={botStatus === "Aktiv"} onCheckedChange={() => alert(`Toggle Bot ${botName}`)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Eskalationslevel: {botEscalation}</Label>
                      <Progress value={botEscalation * 33.33} className="h-2" />
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => alert(`Eskalieren ${botName}`)}><ChevronUp className="h-4 w-4" /></Button>
                      <Button variant="outline" size="sm" onClick={() => alert(`Deeskalieren ${botName}`)}><ChevronDown className="h-4 w-4" /></Button>
                      <Button variant="secondary" size="sm" className="flex-1" onClick={() => alert(`Manuell Posten ${botName}`)}>Posten</Button>
                    </div>
                    <div className="flex items-center space-x-2 pt-1">
                      <Label htmlFor={`autotimer-bot-${index}`} className="text-xs">Auto-Timer</Label>
                      <Switch id={`autotimer-bot-${index}`} />
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
                <Button className="w-full" onClick={() => alert("CSV Export gestartet...")}>
                    Chat-Protokoll als CSV herunterladen
                </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}


    