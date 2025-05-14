
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Paperclip, Send, Smile, Mic, User, Bot as BotIcon, CornerDownLeft, Settings, Users, MessageSquare, AlertTriangle, LogOut, PauseCircle, PlayCircle, VolumeX, XCircle, ThumbsUp, SmilePlus, Quote } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useRouter } from "next/navigation";
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
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, Timestamp, doc, getDoc, where, getDocs } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from '@/lib/utils';


interface ChatPageProps {
  params: { sessionId: string };
}

interface ChatPageContentProps {
  sessionId: string;
}

interface DisplayMessage extends MessageType {
  id: string;
  isOwn: boolean;
  timestampDisplay: string;
}

interface DisplayParticipant extends ParticipantType {
  id: string;
}

const participantColors = [
  { name: 'sky', bg: "bg-sky-500", text: "text-sky-50", ring: "ring-sky-400", nameText: "text-sky-100" },
  { name: 'emerald', bg: "bg-emerald-500", text: "text-emerald-50", ring: "ring-emerald-400", nameText: "text-emerald-100" },
  { name: 'violet', bg: "bg-violet-500", text: "text-violet-50", ring: "ring-violet-400", nameText: "text-violet-100" },
  { name: 'rose', bg: "bg-rose-500", text: "text-rose-50", ring: "ring-rose-400", nameText: "text-rose-100" },
  { name: 'amber', bg: "bg-amber-500", text: "text-amber-50", ring: "ring-amber-400", nameText: "text-amber-100" },
  { name: 'teal', bg: "bg-teal-500", text: "text-teal-50", ring: "ring-teal-400", nameText: "text-teal-100" },
  { name: 'indigo', bg: "bg-indigo-500", text: "text-indigo-50", ring: "ring-indigo-400", nameText: "text-indigo-100" },
  { name: 'fuchsia', bg: "bg-fuchsia-500", text: "text-fuchsia-50", ring: "ring-fuchsia-400", nameText: "text-fuchsia-100" },
];

// Simple hash function to get a color index consistently for a user
const simpleHash = (str: string): number => {
  let hash = 0;
  if (!str) return 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
};

const basicEmojis = ['😀', '😂', '👍', '❤️', '🙏', '😢', '😮', '🤔', '🎉', '🔥', '😊', '💯', '👋', '👀', '👉', '👈', '🤷', '✨', '🙌', '😕'];


function ChatPageContent({ sessionId }: ChatPageContentProps) {
  const { toast } = useToast();
  const router = useRouter();

  const [userName, setUserName] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userAvatarFallback, setUserAvatarFallback] = useState<string>("??");
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [lastMessageSentAt, setLastMessageSentAt] = useState<number>(0);
  const [cooldownRemainingSeconds, setCooldownRemainingSeconds] = useState<number>(0);

  const [currentScenario, setCurrentScenario] = useState<Scenario | undefined>(undefined);
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [participants, setParticipants] = useState<DisplayParticipant[]>([]);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isChatDataLoading, setIsChatDataLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<DisplayMessage | null>(null);
  const [quotingMessage, setQuotingMessage] = useState<DisplayMessage | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);


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
    setIsLoading(true);
    const sessionDocRef = doc(db, "sessions", sessionId);
    const unsubscribeSessionData = onSnapshot(sessionDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as SessionData;
        setSessionData(data);
        if (data.status === "ended") {
          toast({ variant: "destructive", title: "Sitzung beendet", description: "Diese Sitzung wurde vom Administrator beendet." });
        }
      } else {
        toast({ variant: "destructive", title: "Fehler", description: "Sitzung nicht gefunden oder wurde gelöscht." });
        setSessionData(null);
        router.push("/");
      }
      setIsLoading(false);
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

    let unsubscribeParticipant: (() => void) | undefined;

    const findParticipantDocAndListen = async () => {
      const participantsColRef = collection(db, "sessions", sessionId, "participants");
      const q = query(participantsColRef, where("userId", "==", userId));

      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        unsubscribeParticipant = onSnapshot(userDoc.ref, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as ParticipantType;
            setIsMuted(data.isMuted ?? false);
          }
        }, (error) => {
          console.error("Error listening to own participant data: ", error);
        });
      } else {
        console.warn("Could not find participant document for userId:", userId);
      }
    };

    findParticipantDocAndListen();

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
    const q_participants = query(participantsColRef, orderBy("joinedAt", "asc"));

    const unsubscribe = onSnapshot(q_participants, (querySnapshot) => {
      const fetchedParticipants: DisplayParticipant[] = [];
      querySnapshot.forEach((docSn) => {
        fetchedParticipants.push({ id: docSn.id, ...docSn.data() } as DisplayParticipant);
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
      querySnapshot.forEach((docSn) => {
        const data = docSn.data() as MessageType;
        const timestamp = data.timestamp as Timestamp | null;
        fetchedMessages.push({
          ...data,
          id: docSn.id,
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

  // Cooldown timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (sessionData?.messageCooldownSeconds && sessionData.messageCooldownSeconds > 0 && lastMessageSentAt > 0) {
      const cooldownMillis = sessionData.messageCooldownSeconds * 1000;
      const updateRemainingTime = () => {
        const timePassed = Date.now() - lastMessageSentAt;
        const remaining = cooldownMillis - timePassed;
        if (remaining > 0) {
          setCooldownRemainingSeconds(Math.ceil(remaining / 1000));
        } else {
          setCooldownRemainingSeconds(0);
          if (interval) clearInterval(interval);
        }
      };
      updateRemainingTime(); // Initial call
      interval = setInterval(updateRemainingTime, 1000);
    } else {
      setCooldownRemainingSeconds(0); // No cooldown active
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [lastMessageSentAt, sessionData?.messageCooldownSeconds]);


  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const getScenarioTitle = () => currentScenario?.title || "Szenario wird geladen...";

  const getParticipantColorClasses = (pUserId: string, pSenderType?: 'admin' | 'user' | 'bot'): { bg: string, text: string, name: string, ring: string, nameText: string } => {
    if (pSenderType === 'bot') {
      return { bg: "bg-accent/30", text: "text-accent-foreground", name: 'bot', ring: "ring-accent", nameText: "text-accent" };
    }
    if (pSenderType === 'admin') {
      return { bg: "bg-destructive/30", text: "text-destructive-foreground", name: 'admin', ring: "ring-destructive", nameText: "text-destructive" };
    }
    if (!pUserId) { // Fallback for safety
        return participantColors[0];
    }
    const colorIndex = simpleHash(pUserId) % participantColors.length;
    return participantColors[colorIndex];
  };


  const handleSendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newMessage.trim() || !userName || !userId || !userAvatarFallback) {
      toast({ variant: "destructive", title: "Senden fehlgeschlagen", description: "Nachricht ist leer oder Benutzerdaten fehlen." })
      return;
    }
    if (sessionData?.status === "ended") {
      toast({ variant: "destructive", title: "Sitzung beendet", description: "Keine Nachrichten mehr möglich." });
      return;
    }
    if (sessionData?.status === "paused") {
      toast({ variant: "destructive", title: "Sitzung pausiert", description: "Nachrichtenversand aktuell nicht möglich." });
      return;
    }
    if (isMuted) {
      toast({ variant: "destructive", title: "Stummgeschaltet", description: "Sie wurden vom Admin stummgeschaltet." });
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
    const messageData: Omit<MessageType, 'id'> = {
      senderUserId: userId,
      senderName: userName,
      senderType: 'user',
      avatarFallback: userAvatarFallback,
      content: newMessage.trim(),
      timestamp: serverTimestamp(),
    };

    if (replyingTo) {
      messageData.replyToMessageId = replyingTo.id;
      messageData.replyToMessageContentSnippet = replyingTo.content.substring(0, 70) + (replyingTo.content.length > 70 ? "..." : "");
      messageData.replyToMessageSenderName = replyingTo.senderName;
    }
    // Quoting message is handled by pre-filling the newMessage state

    try {
      await addDoc(messagesColRef, messageData);
      setNewMessage("");
      setReplyingTo(null); // Clear reply state
      setQuotingMessage(null); // Clear quote state
      setLastMessageSentAt(Date.now());
      setShowEmojiPicker(false); // Close emoji picker after sending
    } catch (error) {
      console.error("Error sending message: ", error);
      toast({ variant: "destructive", title: "Fehler", description: "Nachricht konnte nicht gesendet werden." });
    }
  };

  const handleSetReply = (message: DisplayMessage) => {
    setQuotingMessage(null); // Cancel any active quote
    setReplyingTo(message);
    // Optionally focus input field
    document.getElementById("message-input")?.focus();
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
  };

  const handleSetQuote = (message: DisplayMessage) => {
    setReplyingTo(null); // Cancel any active reply
    setQuotingMessage(message);
    setNewMessage(`> ${message.senderName} schrieb:\n> "${message.content}"\n\n`);
    // Optionally focus input field
    document.getElementById("message-input")?.focus();
  };

  const handleCancelQuote = () => {
    setQuotingMessage(null);
    // Optionally clear the input if it only contains the quote boilerplate
    if (newMessage.startsWith(`> ${quotingMessage?.senderName} schrieb:\n> "${quotingMessage?.content}"\n\n`)) {
        setNewMessage("");
    }
  };


  const handleEmojiSelect = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
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
  const canSendBasedOnStatusAndMute = isSessionActive && !isMuted;
  const canSendMessage = canSendBasedOnStatusAndMute && cooldownRemainingSeconds <= 0;

  let sessionStatusMessage = "";
  let inputPlaceholderText = "Nachricht eingeben...";

  if (sessionData.status === "ended") {
    sessionStatusMessage = "Diese Simulation wurde vom Administrator beendet.";
    inputPlaceholderText = "Simulation beendet";
  } else if (sessionData.status === "paused") {
    sessionStatusMessage = "Die Simulation ist aktuell pausiert.";
    inputPlaceholderText = "Simulation pausiert";
  } else if (isMuted) {
    sessionStatusMessage = "Sie wurden vom Administrator stummgeschaltet.";
    inputPlaceholderText = "Sie sind stummgeschaltet";
  } else if (cooldownRemainingSeconds > 0) {
    inputPlaceholderText = `Nächste Nachricht in ${cooldownRemainingSeconds}s...`;
  }


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
          {userName && userRole && userId && (
            <>
              <Avatar className="h-8 w-8 border hidden sm:flex">
                <AvatarImage src={`https://placehold.co/40x40.png?text=${userAvatarFallback}`} alt="User Avatar" data-ai-hint="person user" />
                <AvatarFallback className={`${getParticipantColorClasses(userId, 'user').bg} ${getParticipantColorClasses(userId, 'user').text}`}>
                  {userAvatarFallback}
                </AvatarFallback>
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
                  {participants.map((p) => {
                    const pColor = getParticipantColorClasses(p.userId, p.senderType || (p.isBot ? 'bot' : 'user'));
                    return (
                      <div key={p.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted">
                        <Avatar className="h-9 w-9 border">
                          <AvatarImage src={`https://placehold.co/40x40.png?text=${p.avatarFallback}`} alt={p.name} data-ai-hint="person user" />
                          <AvatarFallback className={`${pColor.bg} ${pColor.text}`}>{p.avatarFallback}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">
                            {p.name}
                            {p.isBot && <Badge variant="secondary" className="ml-1.5 text-xs px-1.5 py-0">BOT</Badge>}
                            {p.userId === userId && isMuted && <VolumeX className="inline h-3 w-3 text-destructive ml-1.5" />}
                          </p>
                          <p className="text-xs text-muted-foreground">{p.role}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Main chat area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Participant List (Sidebar) */}
        <aside className="hidden md:flex md:w-72 lg:w-80 flex-col border-r bg-background p-4 space-y-4">
          <h2 className="text-lg font-semibold">Teilnehmende ({participants.length})</h2>
          <ScrollArea className="flex-1">
            <div className="space-y-3">
              {participants.map((p) => {
                const pColor = getParticipantColorClasses(p.userId, p.senderType || (p.isBot ? 'bot' : 'user'));
                return (
                  <div key={p.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted">
                    <Avatar className="h-9 w-9 border">
                      <AvatarImage src={`https://placehold.co/40x40.png?text=${p.avatarFallback}`} alt={p.name} data-ai-hint="person user" />
                      <AvatarFallback className={`${pColor.bg} ${pColor.text}`}>{p.avatarFallback}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">
                        {p.name}
                        {p.isBot && <Badge variant="secondary" className="ml-1.5 text-xs px-1.5 py-0">BOT</Badge>}
                        {p.userId === userId && isMuted && <VolumeX className="inline h-3 w-3 text-destructive ml-1.5" />}
                      </p>
                      <p className="text-xs text-muted-foreground">{p.role}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
          <Separator />
          {userRole && currentScenario && userName && userAvatarFallback && userId && (
            <Card className="mt-auto bg-muted/30">
              <CardHeader className="p-3">
                <div className="flex items-center gap-2">
                  <Avatar className="h-10 w-10 border">
                    <AvatarImage src={`https://placehold.co/40x40.png?text=${userAvatarFallback}`} alt="My Avatar" data-ai-hint="person user" />
                    <AvatarFallback className={`${getParticipantColorClasses(userId, 'user').bg} ${getParticipantColorClasses(userId, 'user').text}`}>
                      {userAvatarFallback}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-base">{userName}</CardTitle>
                    <p className="text-xs text-muted-foreground">Ihre Rolle: {userRole}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <ScrollArea className="max-h-32 text-xs"> {/* Increased height for role description */}
                    <CardDescription className="text-muted-foreground border-l-2 border-primary pl-2 italic">
                        {currentScenario.langbeschreibung}
                    </CardDescription>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </aside>

        {/* Chat messages and input */}
        <main className="flex flex-1 flex-col">
          <ScrollArea className="flex-1 p-4 md:p-6">
            <div className="space-y-6">
              {messages.map((msg) => {
                const bubbleColor = msg.isOwn ? { bg: "bg-primary", text: "text-primary-foreground", nameText: "text-primary-foreground/90" } : getParticipantColorClasses(msg.senderUserId, msg.senderType);
                return (
                  <div key={msg.id} className={`flex gap-3 ${msg.isOwn ? "justify-end" : "justify-start"}`}>
                    {!msg.isOwn && (
                      <Avatar className="h-10 w-10 border self-end">
                        <AvatarImage src={`https://placehold.co/40x40.png?text=${msg.avatarFallback}`} alt={msg.senderName} data-ai-hint="person user" />
                        <AvatarFallback className={`${bubbleColor.bg} ${bubbleColor.text}`}>{msg.avatarFallback}</AvatarFallback>
                      </Avatar>
                    )}
                    <div className={cn("max-w-xs md:max-w-md lg:max-w-lg rounded-xl shadow-md", bubbleColor.bg, bubbleColor.text)}>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className={cn("text-xs font-semibold", msg.isOwn ? bubbleColor.nameText : bubbleColor.nameText)}>
                            {msg.senderName}
                            {msg.senderType === 'bot' && <Badge variant="outline" className="ml-1.5 text-xs px-1 py-0 border-accent/50 text-accent">BOT</Badge>}
                          </span>
                          <span className={`text-xs ${msg.isOwn ? "text-primary-foreground/70" : "opacity-70"}`}>{msg.timestampDisplay}</span>
                        </div>
                        {msg.replyToMessageId && msg.replyToMessageSenderName && msg.replyToMessageContentSnippet && (
                          <div className={`text-xs p-1.5 rounded-md mb-1.5 flex items-center gap-1 ${msg.isOwn ? "bg-black/20" : "bg-black/10"} opacity-80`}>
                            <CornerDownLeft className="h-3 w-3 shrink-0" />
                            <div className="truncate">
                              <span className="font-medium">Antwort auf {msg.replyToMessageSenderName}:</span> {msg.replyToMessageContentSnippet}
                            </div>
                          </div>
                        )}
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        <div className="flex items-center gap-1 mt-1.5">
                          {!msg.isOwn && (
                            <>
                              <Button variant="ghost" size="sm" className={`h-auto px-1.5 py-0.5 opacity-60 hover:opacity-100 ${bubbleColor.text} hover:bg-black/10`} onClick={() => handleSetReply(msg)} aria-label="Antworten">
                                <CornerDownLeft className="h-3.5 w-3.5 mr-1" /> <span className="text-xs">Antworten</span>
                              </Button>
                              <Button variant="ghost" size="sm" className={`h-auto px-1.5 py-0.5 opacity-60 hover:opacity-100 ${bubbleColor.text} hover:bg-black/10`} onClick={() => handleSetQuote(msg)} aria-label="Zitieren">
                                <Quote className="h-3.5 w-3.5 mr-1" /> <span className="text-xs">Zitieren</span>
                              </Button>
                            </>
                          )}
                          <Button variant="ghost" size="icon" className={`h-6 w-6 p-0 opacity-60 hover:opacity-100 ${bubbleColor.text} hover:bg-black/10`} onClick={() => alert("Reagieren noch nicht implementiert")} aria-label="Reagieren">
                            <SmilePlus className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </div>
                    {msg.isOwn && userName && userAvatarFallback && userId && (
                      <Avatar className="h-10 w-10 border self-end">
                        <AvatarImage src={`https://placehold.co/40x40.png?text=${userAvatarFallback}`} alt="My Avatar" data-ai-hint="person user" />
                        <AvatarFallback className={`${getParticipantColorClasses(userId, 'user').bg} ${getParticipantColorClasses(userId, 'user').text}`}>{userAvatarFallback}</AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
              {messages.length === 0 && !isChatDataLoading && (
                <div className="text-center text-muted-foreground py-8">
                  <MessageSquare className="mx-auto h-12 w-12 mb-2 opacity-50" />
                  <p>Noch keine Nachrichten in dieser Sitzung.</p>
                  <p>Sei der Erste, der eine Nachricht sendet!</p>
                </div>
              )}
              {isChatDataLoading && (
                <div className="text-center text-muted-foreground py-8">
                  <MessageSquare className="mx-auto h-12 w-12 mb-2 opacity-50 animate-pulse" />
                  <p>Lade Chat-Nachrichten...</p>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Message Input */}
          <div className="border-t bg-background p-3 md:p-4 relative">
            {replyingTo && (
              <div className="mb-2 p-2 border rounded-md bg-muted/50 text-sm text-muted-foreground flex justify-between items-center">
                <div>
                  Antwort auf <span className="font-semibold">{replyingTo.senderName}</span>: <span className="italic">&quot;{replyingTo.content.substring(0, 30)}...&quot;</span>
                </div>
                <Button variant="ghost" size="icon" onClick={handleCancelReply} className="h-6 w-6 p-0">
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            )}
            {quotingMessage && (
              <div className="mb-2 p-2 border rounded-md bg-muted/50 text-sm text-muted-foreground flex justify-between items-center">
                <div>
                  Zitiert <span className="font-semibold">{quotingMessage.senderName}</span>. Bearbeiten Sie das Zitat und Ihre Nachricht.
                </div>
                <Button variant="ghost" size="icon" onClick={handleCancelQuote} className="h-6 w-6 p-0">
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            )}
            {!canSendBasedOnStatusAndMute && sessionStatusMessage && (
              <Alert variant={sessionData.status === "ended" || isMuted ? "destructive" : "default"} className="mb-2">
                {sessionData.status === "paused" ? <PauseCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                <AlertTitle>
                  {sessionData.status === "ended" ? "Sitzung beendet" : (sessionData.status === "paused" ? "Sitzung pausiert" : (isMuted ? "Stummgeschaltet" : "Hinweis"))}
                </AlertTitle>
                <AlertDescription>
                  {sessionStatusMessage}
                </AlertDescription>
              </Alert>
            )}
            <form className="flex items-center gap-2 md:gap-3" onSubmit={handleSendMessage}>
              <Button variant="ghost" size="icon" type="button" className="shrink-0" aria-label="Anhang" disabled={!canSendMessage || isLoading}>
                <Paperclip className="h-5 w-5" />
              </Button>

              <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" type="button" className="shrink-0" aria-label="Emoji" disabled={!canSendMessage || isLoading}>
                    <Smile className="h-5 w-5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2 mb-1" side="top" align="start">
                  <div className="grid grid-cols-5 gap-1">
                    {basicEmojis.map(emoji => (
                      <Button
                        key={emoji}
                        variant="ghost"
                        size="icon"
                        className="text-xl p-1 h-8 w-8"
                        onClick={() => {
                          handleEmojiSelect(emoji);
                        }}
                      >
                        {emoji}
                      </Button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              <Input
                id="message-input"
                type="text"
                placeholder={inputPlaceholderText}
                className="flex-1 text-base"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                disabled={!canSendMessage || isLoading}
              />
              <Button variant="ghost" size="icon" type="button" className="shrink-0" aria-label="Spracheingabe" disabled={!canSendMessage || isLoading}>
                <Mic className="h-5 w-5" />
              </Button>
              <Button type="submit" size="icon" className="shrink-0 bg-primary hover:bg-primary/90" disabled={!canSendMessage || !newMessage.trim() || isLoading} aria-label="Senden">
                <Send className="h-5 w-5" />
              </Button>
            </form>
            {cooldownRemainingSeconds > 0 && canSendBasedOnStatusAndMute && (
              <p className="text-xs text-muted-foreground mt-1.5 text-right">Nächste Nachricht in {cooldownRemainingSeconds}s</p>
            )}
            {sessionData.messageCooldownSeconds > 0 && cooldownRemainingSeconds <= 0 && canSendBasedOnStatusAndMute && (
              <p className="text-xs text-muted-foreground mt-1.5 text-right">Nachrichten Cooldown: {sessionData.messageCooldownSeconds}s</p>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function ChatPage({ params }: ChatPageProps) {
  const extractedSessionId = params.sessionId;
  return (
    <Suspense fallback={
      <div className="flex h-screen w-full items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader><CardTitle>Chat wird geladen...</CardTitle></CardHeader>
          <CardContent><p>Einen Moment Geduld, die Simulation wird vorbereitet.</p></CardContent>
        </Card>
      </div>
    }>
      <ChatPageContent sessionId={extractedSessionId} />
    </Suspense>
  );
}

