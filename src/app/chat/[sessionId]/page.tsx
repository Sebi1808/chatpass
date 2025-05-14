
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Paperclip, Send, Smile, Mic, User, Bot as BotIcon, CornerDownLeft, Settings, Users, MessageSquare, AlertTriangle, LogOut, PauseCircle, PlayCircle } from "lucide-react"; 
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "next/navigation"; // useRouter for redirect
import { useEffect, useState, Suspense, useRef, type FormEvent } from "react";
import { scenarios } from "@/lib/scenarios";
import type { Scenario, Participant as ParticipantType, Message as MessageType, SessionData } from "@/lib/types"; 
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, Timestamp, doc, getDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


interface ChatPageProps {
  params: { sessionId: string };
}

interface DisplayMessage extends MessageType {
  id: string; 
  isOwn: boolean;
  timestampDisplay: string; 
}

interface DisplayParticipant extends ParticipantType {
   id: string; 
}


function ChatPageContent({ params: pageParams }: ChatPageProps) { 
  const { sessionId } = pageParams; 
  const { toast } = useToast();
  const router = useRouter();

  const [userName, setUserName] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userAvatarFallback, setUserAvatarFallback] = useState<string>("??");
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [lastMessageSentAt, setLastMessageSentAt] = useState<number>(0);

  const [currentScenario, setCurrentScenario] = useState<Scenario | undefined>(undefined);
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [participants, setParticipants] = useState<DisplayParticipant[]>([]);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true); // General loading state for initial setup
  const [isChatDataLoading, setIsChatDataLoading] = useState(true); // Specific for messages and participants


  useEffect(() => {
    const nameFromStorage = localStorage.getItem(`chatUser_${sessionId}_name`);
    const roleFromStorage = localStorage.getItem(`chatUser_${sessionId}_role`);
    const userIdFromStorage = localStorage.getItem(`chatUser_${sessionId}_userId`);
    const avatarFallbackFromStorage = localStorage.getItem(`chatUser_${sessionId}_avatarFallback`);

    if (!nameFromStorage || !roleFromStorage || !userIdFromStorage || !avatarFallbackFromStorage) {
      toast({ variant: "destructive", title: "Fehler", description: "Benutzerdetails nicht gefunden. Bitte treten Sie der Sitzung erneut bei." });
      router.push(`/join/${sessionId}`);
      return;
    }

    setUserName(nameFromStorage);
    setUserRole(roleFromStorage);
    setUserId(userIdFromStorage);
    setUserAvatarFallback(avatarFallbackFromStorage);

    const scenario = scenarios.find(s => s.id === sessionId);
    setCurrentScenario(scenario);

  }, [sessionId, toast, router]);

  // Listener for SessionData (status, cooldown)
  useEffect(() => {
    if (!sessionId) return;
    setIsLoading(true); // Start general loading
    const sessionDocRef = doc(db, "sessions", sessionId);
    const unsubscribeSessionData = onSnapshot(sessionDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as SessionData;
        setSessionData(data);
        if (data.status === "ended") {
            toast({variant: "destructive", title: "Sitzung beendet", description: "Diese Sitzung wurde vom Administrator beendet."});
        }
      } else {
        // Session might have been deleted
        toast({ variant: "destructive", title: "Fehler", description: "Sitzung nicht gefunden oder wurde gelöscht." });
        setSessionData(null);
        router.push("/");
      }
      setIsLoading(false); // General loading finished after session data fetch
    }, (error) => {
      console.error("Error listening to session data: ", error);
      toast({ variant: "destructive", title: "Fehler", description: "Sitzungsstatus konnte nicht geladen werden." });
      setIsLoading(false);
      router.push("/");
    });
    return () => unsubscribeSessionData();
  }, [sessionId, toast, router]);

  // Listener for own participant data (mute status)
  useEffect(() => {
    if (!sessionId || !userId) return;
    const participantDocRef = doc(db, "sessions", sessionId, "participants", userId);
    // Check if the document reference is actually for this user (userId might be the auto-generated doc ID)
    // This effect should ideally fetch the participant doc using the userId stored in localStorage.
    // For now, assuming `userId` from localStorage is the document ID. This needs refinement if userId isn't the doc ID.
    // A better approach: query participants collection where `userId` field matches `userId` from localStorage.
    // However, `addDoc` generates random IDs. So, `userId` from localStorage *is* the doc ID if it was set correctly during join.

    // Re-fetch the participant based on userId to ensure we get the correct doc ID
    const findParticipantDocAndListen = async () => {
        const participantsColRef = collection(db, "sessions", sessionId, "participants");
        const q = query(participantsColRef, where("userId", "==", userId));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            const userDoc = querySnapshot.docs[0]; // Should be only one
            const unsub = onSnapshot(userDoc.ref, (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data() as ParticipantType;
                    setIsMuted(data.isMuted ?? false);
                }
            }, (error) => {
                 console.error("Error listening to own participant data: ", error);
            });
            return unsub; // Return the unsubscribe function
        }
        return () => {}; // Return an empty unsubscribe function if not found
    };
    
    let unsubscribeParticipant: (() => void) | undefined;
    findParticipantDocAndListen().then(unsub => unsubscribeParticipant = unsub);

    return () => {
        if (unsubscribeParticipant) {
            unsubscribeParticipant();
        }
    };

  }, [sessionId, userId]);


  // Fetch all participants from Firestore
  useEffect(() => {
    if (!sessionId) return;
    setIsChatDataLoading(true);
    const participantsColRef = collection(db, "sessions", sessionId, "participants");
    const q = query(participantsColRef, orderBy("joinedAt", "asc"));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const fetchedParticipants: DisplayParticipant[] = [];
      querySnapshot.forEach((doc) => {
        fetchedParticipants.push({ id: doc.id, ...doc.data() } as DisplayParticipant);
      });
      setParticipants(fetchedParticipants);
      setIsChatDataLoading(false); 
    }, (error) => {
      console.error("Error fetching participants: ", error);
      toast({ variant: "destructive", title: "Fehler", description: "Teilnehmer konnten nicht geladen werden." });
      setIsChatDataLoading(false);
    });

    return () => unsubscribe();
  }, [sessionId, toast]);

  // Fetch messages from Firestore
   useEffect(() => {
    if (!sessionId || !userId) return; 
    setIsChatDataLoading(true);
    const messagesColRef = collection(db, "sessions", sessionId, "messages");
    const q_msg = query(messagesColRef, orderBy("timestamp", "asc"));

    const unsubscribe = onSnapshot(q_msg, (querySnapshot) => {
      const fetchedMessages: DisplayMessage[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data() as MessageType; 
        const timestamp = data.timestamp as Timestamp | null; 
        fetchedMessages.push({
          ...data,
          id: doc.id,
          senderUserId: data.senderUserId, 
          senderName: data.senderName,
          senderType: data.senderType,
          avatarFallback: data.avatarFallback,
          content: data.content,
          timestamp: data.timestamp, 
          isOwn: data.senderUserId === userId,
          timestampDisplay: timestamp ? new Date(timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Senden...'
        });
      });
      setMessages(fetchedMessages);
      setIsChatDataLoading(false); 
    }, (error) => {
      console.error("Error fetching messages: ", error);
      toast({ variant: "destructive", title: "Fehler", description: "Nachrichten konnten nicht geladen werden." });
      setIsChatDataLoading(false);
    });

    return () => unsubscribe();
  }, [sessionId, toast, userId]);


  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const getScenarioTitle = () => currentScenario?.title || "Szenario wird geladen...";

  const handleSendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newMessage.trim() || !userName || !userId || !userAvatarFallback) {
        toast({variant: "destructive", title: "Senden fehlgeschlagen", description: "Nachricht ist leer oder Benutzerdaten fehlen."})
        return;
    }
    if (sessionData?.status === "ended") {
        toast({variant: "destructive", title: "Sitzung beendet", description: "Keine Nachrichten mehr möglich."});
        return;
    }
    if (sessionData?.status === "paused") {
        toast({variant: "destructive", title: "Sitzung pausiert", description: "Nachrichtenversand aktuell nicht möglich."});
        return;
    }
    if (isMuted) {
        toast({variant: "destructive", title: "Stummgeschaltet", description: "Sie wurden vom Admin stummgeschaltet."});
        return;
    }

    const now = Date.now();
    const cooldownMillis = (sessionData?.messageCooldownSeconds || 0) * 1000;
    if (now - lastMessageSentAt < cooldownMillis) {
        const timeLeft = Math.ceil((cooldownMillis - (now - lastMessageSentAt)) / 1000);
        toast({
            variant: "default",
            title: "Bitte warten",
            description: `Sie können in ${timeLeft} Sekunden wieder eine Nachricht senden.`,
            className: "bg-yellow-500/20 border-yellow-500"
        });
        return;
    }


    const messagesColRef = collection(db, "sessions", sessionId, "messages");
    try {
      await addDoc(messagesColRef, {
        senderUserId: userId,
        senderName: userName,
        senderType: 'user', 
        avatarFallback: userAvatarFallback,
        content: newMessage.trim(),
        timestamp: serverTimestamp(),
      });
      setNewMessage("");
      setLastMessageSentAt(Date.now());
    } catch (error) {
      console.error("Error sending message: ", error);
      toast({ variant: "destructive", title: "Fehler", description: "Nachricht konnte nicht gesendet werden." });
    }
  };
  
  if (isLoading || !currentScenario || !userId || !sessionData) { 
    return (
        <div className="flex h-screen w-full items-center justify-center p-4">
            <Card className="max-w-md w-full">
                <CardHeader><CardTitle>Chat wird geladen...</CardTitle></CardHeader>
                <CardContent><p>Einen Moment Geduld, die Simulation wird vorbereitet.</p></CardContent>
            </Card>
        </div>
    );
  }
  
  const isSessionActive = sessionData.status === "active";
  const canSendMessage = isSessionActive && !isMuted;
  let sessionStatusMessage = "";
  if (sessionData.status === "ended") sessionStatusMessage = "Diese Simulation wurde vom Administrator beendet.";
  else if (sessionData.status === "paused") sessionStatusMessage = "Die Simulation ist aktuell pausiert.";
  else if (isMuted) sessionStatusMessage = "Sie wurden vom Administrator stummgeschaltet.";


  return (
    <div className="flex h-screen flex-col bg-muted/40">
      {/* Header */}
      <header className="flex h-16 items-center justify-between border-b bg-background px-4 md:px-6 shrink-0">
        <h1 className="text-lg font-semibold text-primary truncate max-w-[calc(100%-200px)] sm:max-w-none">
          Simulation: {getScenarioTitle()}
        </h1>
        <div className="flex items-center gap-2">
            <Badge variant={sessionData.status === "active" ? "default" : (sessionData.status === "paused" ? "secondary" : "destructive")}>
              {sessionData.status === "active" ? "Aktiv" : (sessionData.status === "paused" ? "Pausiert" : "Beendet")}
            </Badge>
            {userName && userRole && (
              <>
                <Avatar className="h-8 w-8 border hidden sm:flex">
                    <AvatarImage src={`https://placehold.co/40x40.png?text=${userAvatarFallback}`} alt="User Avatar" data-ai-hint="person user"/>
                    <AvatarFallback>{userAvatarFallback}</AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium hidden sm:inline truncate max-w-[100px]">
                  {userName}
                </span>
              </>
            )}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden" aria-label="Teilnehmer anzeigen">
                  <Users className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full max-w-xs sm:max-w-sm p-4">
                <SheetHeader className="mb-4">
                  <SheetTitle>Teilnehmende ({participants.length})</SheetTitle>
                </SheetHeader>
                <ScrollArea className="h-[calc(100%-60px)]">
                  <div className="space-y-3">
                    {participants.map((p) => (
                      <div key={p.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted">
                        <Avatar className="h-9 w-9 border">
                          <AvatarImage src={`https://placehold.co/40x40.png?text=${p.avatarFallback}`} alt={p.name} data-ai-hint="person user" />
                          <AvatarFallback>{p.avatarFallback}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{p.name} {p.isMuted && <VolumeX className="inline h-3 w-3 text-destructive" />}</p>
                          <p className="text-xs text-muted-foreground">{p.role} {p.isBot ? <BotIcon className="inline h-3 w-3" /> : <User className="inline h-3 w-3" />}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </SheetContent>
            </Sheet>
        </div>
      </header>

      {/* Main chat area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Participant List (Sidebar) */}
        <aside className="hidden md:flex md:w-64 lg:w-72 flex-col border-r bg-background p-4 space-y-4">
          <h2 className="text-lg font-semibold">Teilnehmende ({participants.length})</h2>
          <ScrollArea className="flex-1">
            <div className="space-y-3">
              {participants.map((p) => (
                <div key={p.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted">
                  <Avatar className="h-9 w-9 border">
                    <AvatarImage src={`https://placehold.co/40x40.png?text=${p.avatarFallback}`} alt={p.name} data-ai-hint="person user"/>
                    <AvatarFallback>{p.avatarFallback}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{p.name} {p.isMuted && <VolumeX className="inline h-3 w-3 text-destructive" />}</p>
                     <p className="text-xs text-muted-foreground">{p.role} {p.isBot ? <BotIcon className="inline h-3 w-3" /> : <User className="inline h-3 w-3" />}</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
           {userRole && currentScenario && (
            <Card className="mt-auto">
              <CardHeader className="p-3">
                <CardTitle className="text-sm flex items-center">
                   <Avatar className="h-6 w-6 border mr-2">
                        <AvatarImage src={`https://placehold.co/40x40.png?text=${userAvatarFallback}`} alt="My Avatar" data-ai-hint="person user"/>
                        <AvatarFallback>{userAvatarFallback}</AvatarFallback>
                    </Avatar>
                    Ihre Rolle: {userRole}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 text-xs text-muted-foreground max-h-24 overflow-y-auto">
                {userRole.toLowerCase().includes("teilnehmer") && currentScenario.langbeschreibung}
                {userRole.toLowerCase().includes("bot") && "Sie sind ein Bot und nehmen aktiv an der Diskussion teil."}
                {userRole.toLowerCase().includes("admin") && "Sie sind Admin und moderieren die Diskussion."}
              </CardContent>
            </Card>
          )}
        </aside>

        {/* Chat messages and input */}
        <main className="flex flex-1 flex-col">
          <ScrollArea className="flex-1 p-4 md:p-6">
            <div className="space-y-6">
              {messages.map((msg) => (
                  <div key={msg.id} className={`flex gap-3 ${msg.isOwn ? "justify-end" : "justify-start"}`}>
                    {!msg.isOwn && (
                      <Avatar className="h-10 w-10 border">
                         <AvatarImage src={`https://placehold.co/40x40.png?text=${msg.avatarFallback}`} alt={msg.senderName} data-ai-hint="person user"/>
                        <AvatarFallback>{msg.avatarFallback}</AvatarFallback>
                      </Avatar>
                    )}
                    <Card className={`max-w-xs md:max-w-md lg:max-w-lg shadow-md ${msg.isOwn ? "bg-primary text-primary-foreground" : "bg-card"}`}>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-semibold ${msg.isOwn ? "text-primary-foreground/80" : "text-accent"}`}>
                            {msg.senderName}
                            {msg.senderType === 'bot' && <BotIcon className="inline-block h-3 w-3 ml-1" />}
                            {msg.senderType === 'admin' && <Settings className="inline-block h-3 w-3 ml-1" />}
                          </span>
                          <span className={`text-xs ${msg.isOwn ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{msg.timestampDisplay}</span>
                        </div>
                        {msg.replyTo && (
                          <div className={`text-xs p-1.5 rounded-md mb-1.5 flex items-center gap-1 ${msg.isOwn ? "bg-primary/20 text-primary-foreground/90" : "bg-muted text-muted-foreground"}`}>
                             <CornerDownLeft className="h-3 w-3 shrink-0" /> <span className="truncate">Antwort auf: {msg.replyTo}</span>
                          </div>
                        )}
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </CardContent>
                    </Card>
                    {msg.isOwn && userName && userAvatarFallback && ( 
                      <Avatar className="h-10 w-10 border">
                        <AvatarImage src={`https://placehold.co/40x40.png?text=${userAvatarFallback}`} alt="My Avatar" data-ai-hint="person user"/>
                        <AvatarFallback>{userAvatarFallback}</AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                ))}
              <div ref={messagesEndRef} />
               {messages.length === 0 && !isChatDataLoading && (
                <div className="text-center text-muted-foreground py-8">
                    <MessageSquare className="mx-auto h-12 w-12 mb-2 opacity-50" />
                    <p>Noch keine Nachrichten in dieser Sitzung.</p>
                    <p>Sei der Erste, der eine Nachricht sendet!</p>
                </div>
            )}
            </div>
          </ScrollArea>

          {/* Message Input */}
          <div className="border-t bg-background p-3 md:p-4">
            {!canSendMessage && sessionStatusMessage && (
                 <Alert variant={sessionData.status === "ended" || isMuted ? "destructive" : "default"} className="mb-2">
                    {sessionData.status === "paused" ? <PauseCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                    <AlertTitle>
                        {sessionData.status === "ended" ? "Sitzung beendet" : (sessionData.status === "paused" ? "Sitzung pausiert" : "Stummgeschaltet")}
                    </AlertTitle>
                    <AlertDescription>
                        {sessionStatusMessage}
                    </AlertDescription>
                </Alert>
            )}
            <form className="flex items-center gap-2 md:gap-3" onSubmit={handleSendMessage}>
              <Button variant="ghost" size="icon" type="button" className="shrink-0" aria-label="Anhang" disabled={!canSendMessage}>
                <Paperclip className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" type="button" className="shrink-0" aria-label="Emoji" disabled={!canSendMessage}>
                <Smile className="h-5 w-5" />
              </Button>
              <Input
                type="text"
                placeholder={canSendMessage ? "Nachricht eingeben..." : "Nachrichtenversand deaktiviert"}
                className="flex-1 text-base"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                disabled={!canSendMessage || isLoading}
              />
              <Button variant="ghost" size="icon" type="button" className="shrink-0" aria-label="Spracheingabe" disabled={!canSendMessage}>
                <Mic className="h-5 w-5" />
              </Button>
              <Button type="submit" size="icon" className="shrink-0 bg-primary hover:bg-primary/90" disabled={!canSendMessage || !newMessage.trim() || isLoading} aria-label="Senden">
                <Send className="h-5 w-5" />
              </Button>
            </form>
            {sessionData.messageCooldownSeconds > 0 && isSessionActive && !isMuted && (
                 <p className="text-xs text-muted-foreground mt-1.5 text-right">Nachrichten Cooldown: {sessionData.messageCooldownSeconds}s</p>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function ChatPage(props: ChatPageProps) {
  return (
    <Suspense fallback={
        <div className="flex h-screen w-full items-center justify-center p-4">
            <Card className="max-w-md w-full">
                <CardHeader><CardTitle>Chat wird geladen...</CardTitle></CardHeader>
                <CardContent><p>Einen Moment Geduld, die Simulation wird vorbereitet.</p></CardContent>
            </Card>
        </div>
    }>
      <ChatPageContent {...props} />
    </Suspense>
  );
}
