
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Paperclip, Send, Smile, Mic, User, Bot as BotIcon, CornerDownLeft, Settings, Users, MessageSquare } from "lucide-react"; // Added Users, MessageSquare
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense, useRef, type FormEvent } from "react";
import { scenarios } from "@/lib/scenarios";
import type { Scenario, Participant as ParticipantType, Message as MessageType } from "@/lib/types"; // Renamed to avoid conflicts
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";


interface ChatPageProps {
  params: { sessionId: string };
}

// Adjusted Message interface to align with Firestore and include senderUserId
interface DisplayMessage extends MessageType {
  id: string; // Firestore document ID
  isOwn: boolean;
  timestampDisplay: string; // Formatted timestamp string for display
}

// Adjusted Participant interface to align with Firestore
interface DisplayParticipant extends ParticipantType {
   id: string; // Firestore document ID
}


function ChatPageContent({ params }: ChatPageProps) { // Destructure params directly
  const { sessionId } = params; // Use destructured sessionId
  const searchParams = useSearchParams(); // Not used for user details anymore, kept for potential future use
  const { toast } = useToast();

  const [userName, setUserName] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userAvatarFallback, setUserAvatarFallback] = useState<string>("??");

  const [currentScenario, setCurrentScenario] = useState<Scenario | undefined>(undefined);
  const [participants, setParticipants] = useState<DisplayParticipant[]>([]);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);


  useEffect(() => {
    // Load user details from localStorage
    const nameFromStorage = localStorage.getItem(`chatUser_${sessionId}_name`);
    const roleFromStorage = localStorage.getItem(`chatUser_${sessionId}_role`);
    const userIdFromStorage = localStorage.getItem(`chatUser_${sessionId}_userId`);
    const avatarFallbackFromStorage = localStorage.getItem(`chatUser_${sessionId}_avatarFallback`);

    if (!nameFromStorage || !roleFromStorage || !userIdFromStorage || !avatarFallbackFromStorage) {
      toast({ variant: "destructive", title: "Fehler", description: "Benutzerdetails nicht gefunden. Bitte treten Sie der Sitzung erneut bei." });
      // Consider redirecting to join page: router.push(`/join/${sessionId}`);
      setIsLoading(false);
      return;
    }

    setUserName(nameFromStorage);
    setUserRole(roleFromStorage);
    setUserId(userIdFromStorage);
    setUserAvatarFallback(avatarFallbackFromStorage);

    const scenario = scenarios.find(s => s.id === sessionId);
    setCurrentScenario(scenario);
    // setIsLoading(false); // Basic info loaded - will be set to false after data fetching

  }, [sessionId, toast]);

  // Fetch participants from Firestore
  useEffect(() => {
    if (!sessionId) return;
    setIsLoading(true);
    const participantsColRef = collection(db, "sessions", sessionId, "participants");
    const q = query(participantsColRef, orderBy("joinedAt", "asc"));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const fetchedParticipants: DisplayParticipant[] = [];
      querySnapshot.forEach((doc) => {
        fetchedParticipants.push({ id: doc.id, ...doc.data() } as DisplayParticipant);
      });
      setParticipants(fetchedParticipants);
      // setIsLoading(false); // Set loading to false after all initial data is fetched
    }, (error) => {
      console.error("Error fetching participants: ", error);
      toast({ variant: "destructive", title: "Fehler", description: "Teilnehmer konnten nicht geladen werden." });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [sessionId, toast]);

  // Fetch messages from Firestore
   useEffect(() => {
    if (!sessionId || !userId) return; // Ensure userId is available for isOwn check
    setIsLoading(true);
    const messagesColRef = collection(db, "sessions", sessionId, "messages");
    const q = query(messagesColRef, orderBy("timestamp", "asc"));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const fetchedMessages: DisplayMessage[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data() as MessageType; // Explicitly type data
        const timestamp = data.timestamp as Timestamp | null; // Firestore Timestamp
        fetchedMessages.push({
          ...data,
          id: doc.id,
          senderUserId: data.senderUserId, // ensure these are explicitly mapped
          senderName: data.senderName,
          senderType: data.senderType,
          avatarFallback: data.avatarFallback,
          content: data.content,
          timestamp: data.timestamp, // Keep original timestamp for sorting/logic if needed
          isOwn: data.senderUserId === userId,
          timestampDisplay: timestamp ? new Date(timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Senden...'
        });
      });
      setMessages(fetchedMessages);
      setIsLoading(false); // All initial data loaded
    }, (error) => {
      console.error("Error fetching messages: ", error);
      toast({ variant: "destructive", title: "Fehler", description: "Nachrichten konnten nicht geladen werden." });
      setIsLoading(false);
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

    const messagesColRef = collection(db, "sessions", sessionId, "messages");
    try {
      await addDoc(messagesColRef, {
        senderUserId: userId,
        senderName: userName,
        senderType: 'user', // Or determine if it's admin/bot based on userRole logic if needed
        avatarFallback: userAvatarFallback,
        content: newMessage.trim(),
        timestamp: serverTimestamp(),
        // replyTo and botFlag can be added later
      });
      setNewMessage("");
    } catch (error) {
      console.error("Error sending message: ", error);
      toast({ variant: "destructive", title: "Fehler", description: "Nachricht konnte nicht gesendet werden." });
    }
  };
  
  if (isLoading || !currentScenario || !userId) { // Show loading indicator if essential data isn't ready
    return <div className="flex h-screen w-full items-center justify-center"><p>Chat wird geladen...</p></div>;
  }


  return (
    <div className="flex h-screen flex-col bg-muted/40">
      {/* Header */}
      <header className="flex h-16 items-center justify-between border-b bg-background px-4 md:px-6 shrink-0">
        <h1 className="text-lg font-semibold text-primary">Simulation: {getScenarioTitle()}</h1>
        <div className="flex items-center gap-2">
            <Badge variant="secondary">ID: {sessionId}</Badge>
            {userName && userRole && (
              <>
                <Avatar className="h-8 w-8 border">
                    <AvatarImage src={`https://placehold.co/40x40.png?text=${userAvatarFallback}`} alt="User Avatar" data-ai-hint="person user"/>
                    <AvatarFallback>{userAvatarFallback}</AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium hidden sm:inline">
                  {userName} ({userRole})
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
                          <p className="text-sm font-medium">{p.name}</p>
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
                    <p className="text-sm font-medium">{p.name}</p>
                     <p className="text-xs text-muted-foreground">{p.role} {p.isBot ? <BotIcon className="inline h-3 w-3" /> : <User className="inline h-3 w-3" />}</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
           {userRole && currentScenario && (
            <Card className="mt-auto">
              <CardHeader className="p-3">
                <CardTitle className="text-sm">Ihre Rolle: {userRole}</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 text-xs text-muted-foreground">
                {userRole.toLowerCase().includes("teilnehmer") && currentScenario.langbeschreibung.substring(0,100)+"..."}
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
               {messages.length === 0 && !isLoading && (
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
            <form className="flex items-center gap-2 md:gap-3" onSubmit={handleSendMessage}>
              <Button variant="ghost" size="icon" type="button" className="shrink-0" aria-label="Anhang">
                <Paperclip className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" type="button" className="shrink-0" aria-label="Emoji">
                <Smile className="h-5 w-5" />
              </Button>
              <Input
                type="text"
                placeholder="Nachricht eingeben..."
                className="flex-1 text-base"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                disabled={!userId || isLoading}
              />
              <Button variant="ghost" size="icon" type="button" className="shrink-0" aria-label="Spracheingabe">
                <Mic className="h-5 w-5" />
              </Button>
              <Button type="submit" size="icon" className="shrink-0 bg-primary hover:bg-primary/90" disabled={!userId || !newMessage.trim() || isLoading} aria-label="Senden">
                <Send className="h-5 w-5" />
              </Button>
            </form>
            {/* <p className="text-xs text-muted-foreground mt-1.5 text-right">Tippt: Bot Provokateur...</p> */}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function ChatPage(props: ChatPageProps) {
  return (
    <Suspense fallback={<div className="flex h-screen w-full items-center justify-center"><p>Chat wird geladen...</p></div>}>
      <ChatPageContent {...props} />
    </Suspense>
  );
}

    