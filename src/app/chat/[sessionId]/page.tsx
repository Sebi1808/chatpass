
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Paperclip, Send, Smile, Mic, User, Bot, CornerDownLeft, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { scenarios } from "@/lib/scenarios";
import type { Scenario } from "@/lib/types";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"


interface ChatPageProps {
  params: { sessionId: string };
}

// Mock message data - this will eventually come from a real-time backend
const mockMessages = [
  { id: '1', sender: 'Lehrkraft', senderType: 'admin', avatarFallback: 'LK', content: 'Willkommen zur Simulation "Hate-Speech"! Bitte achtet auf einen respektvollen Umgang.', timestamp: '10:00', isOwn: false, userId: 'admin-001' },
  { id: '2', sender: 'Bot Provokateur', senderType: 'bot', avatarFallback: 'BP', content: 'Respekt? Was für ein langweiliges Wort! 😂', timestamp: '10:01', botFlag: true, isOwn: false, userId: 'bot-provokateur' },
  { id: '3', sender: 'Schüler Max', senderType: 'user', avatarFallback: 'SM', content: 'Das ist nicht witzig. Solche Aussagen sind verletzend.', timestamp: '10:02', isOwn: true, replyTo: 'Bot Provokateur', userId: 'user-max-123' }, // Example with isOwn for the current user
  { id: '4', sender: 'Schülerin Anna', senderType: 'user', avatarFallback: 'SA', content: 'Genau, das geht zu weit!', timestamp: '10:03', isOwn: false, userId: 'user-anna-456' },
  { id: '5', sender: 'Bot Verteidiger', senderType: 'bot', avatarFallback: 'BV', content: 'Gut gekontert, Max! Es ist wichtig, für seine Meinung einzustehen.', timestamp: '10:04', botFlag: true, isOwn: false, userId: 'bot-verteidiger' },
];

// Mock participant data - this will also be dynamic
interface Participant {
  id: string;
  name: string;
  role: string;
  avatarFallback: string;
  type: 'admin' | 'user' | 'bot';
}

const initialParticipants: Participant[] = [
    { id: 'admin-001', name: 'Lehrkraft', role: 'Admin', avatarFallback: 'LK', type: 'admin' },
    { id: 'bot-provokateur', name: 'Bot Provokateur', role: 'Bot', avatarFallback: 'BP', type: 'bot' },
    { id: 'bot-verteidiger', name: 'Bot Verteidiger', role: 'Bot', avatarFallback: 'BV', type: 'bot' },
    // Students will be added dynamically
];


function ChatPageContent({ params }: ChatPageProps) {
  const searchParams = useSearchParams();
  const [userName, setUserName] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [currentScenario, setCurrentScenario] = useState<Scenario | undefined>(undefined);
  const [participants, setParticipants] = useState<Participant[]>(initialParticipants);
  const [userAvatarFallback, setUserAvatarFallback] = useState<string>("??");

  useEffect(() => {
    const nameFromStorage = localStorage.getItem(`chatUser_${params.sessionId}_name`);
    const roleFromStorage = localStorage.getItem(`chatUser_${params.sessionId}_role`);
    
    const nameFromQuery = searchParams.get("name");
    const roleFromQuery = searchParams.get("role");

    const finalName = nameFromQuery || nameFromStorage;
    const finalRole = roleFromQuery || roleFromStorage;

    setUserName(finalName);
    setUserRole(finalRole);

    if (finalName) {
      setUserAvatarFallback(finalName.substring(0, 2).toUpperCase());
      
      // Add current user to participants list if not already present
      setParticipants(prev => {
        const userExists = prev.some(p => p.name === finalName && p.role === finalRole);
        if (!userExists && finalName && finalRole) {
          return [...prev, { id: `user-${Date.now()}`, name: finalName, role: finalRole, avatarFallback: finalName.substring(0,2).toUpperCase(), type: 'user' }];
        }
        return prev;
      });
    }
    
    const scenario = scenarios.find(s => s.id === params.sessionId);
    setCurrentScenario(scenario);

  }, [searchParams, params.sessionId]);

  const getScenarioTitle = () => currentScenario?.title || "Szenario wird geladen...";

  // Determine if a message is from the current user
  // This is a simplified check; in a real app, you'd use unique user IDs.
  const isOwnMessage = (messageSender: string, messageSenderType: 'admin' | 'user' | 'bot') => {
    return messageSenderType === 'user' && messageSender === userName;
  };


  return (
    <div className="flex h-screen flex-col bg-muted/40">
      {/* Header */}
      <header className="flex h-16 items-center justify-between border-b bg-background px-4 md:px-6 shrink-0">
        <h1 className="text-lg font-semibold text-primary">Simulation: {getScenarioTitle()}</h1>
        <div className="flex items-center gap-2">
            <Badge variant="secondary">ID: {params.sessionId}</Badge>
            {userName && userRole && (
              <>
                <Avatar className="h-8 w-8 border">
                    <AvatarImage src={`https://placehold.co/40x40.png?text=${userAvatarFallback}`} alt="User Avatar" data-ai-hint="person user" />
                    <AvatarFallback>{userAvatarFallback}</AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium hidden sm:inline">
                  {userName} ({userRole})
                </span>
              </>
            )}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Users className="h-5 w-5" />
                  <span className="sr-only">Teilnehmer anzeigen</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full max-w-xs sm:max-w-sm p-4">
                <SheetHeader className="mb-4">
                  <SheetTitle>Teilnehmende ({participants.length})</SheetTitle>
                </SheetHeader>
                <ScrollArea className="h-[calc(100%-60px)]"> {/* Adjust height as needed */}
                  <div className="space-y-3">
                    {participants.map((p) => (
                      <div key={p.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted">
                        <Avatar className="h-9 w-9 border">
                          <AvatarImage src={`https://placehold.co/40x40.png?text=${p.avatarFallback}`} alt={p.name} data-ai-hint="person user" />
                          <AvatarFallback>{p.avatarFallback}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.role} {p.type === 'bot' ? <Bot className="inline h-3 w-3" /> : p.type === 'admin' ? <User className="inline h-3 w-3" /> : null}</p>
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
        {/* Participant List (Sidebar) - hidden on small screens, shown on md+ */}
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
                    <p className="text-xs text-muted-foreground">{p.role} {p.type === 'bot' ? <Bot className="inline h-3 w-3" /> : p.type === 'admin' ? <User className="inline h-3 w-3" /> : null}</p>
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
                {/* Placeholder for role description - this needs to be properly implemented */}
                {userRole.toLowerCase().includes("teilnehmer") && currentScenario.langbeschreibung.substring(0,100)+"..."}
                 {userRole.toLowerCase().includes("bot") && "Sie sind ein Bot und nehmen aktiv an der Diskussion teil."}
              </CardContent>
            </Card>
          )}
        </aside>

        {/* Chat messages and input */}
        <main className="flex flex-1 flex-col">
          <ScrollArea className="flex-1 p-4 md:p-6">
            <div className="space-y-6">
              {mockMessages.map((msg) => {
                const ownMsg = isOwnMessage(msg.sender, msg.senderType as 'user' | 'admin' | 'bot');
                return (
                  <div key={msg.id} className={`flex gap-3 ${ownMsg ? "justify-end" : "justify-start"}`}>
                    {!ownMsg && (
                      <Avatar className="h-10 w-10 border">
                         <AvatarImage src={`https://placehold.co/40x40.png?text=${msg.avatarFallback}`} alt={msg.sender} data-ai-hint="person user"/>
                        <AvatarFallback>{msg.avatarFallback}</AvatarFallback>
                      </Avatar>
                    )}
                    <Card className={`max-w-xs md:max-w-md lg:max-w-lg shadow-md ${ownMsg ? "bg-primary text-primary-foreground" : "bg-card"}`}>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-semibold ${ownMsg ? "text-primary-foreground/80" : "text-accent"}`}>
                            {msg.sender}
                            {msg.senderType === 'bot' && <Bot className="inline-block h-3 w-3 ml-1" />}
                            {msg.senderType === 'admin' && <Settings className="inline-block h-3 w-3 ml-1" />}
                          </span>
                          <span className={`text-xs ${ownMsg ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{msg.timestamp}</span>
                        </div>
                        {msg.replyTo && (
                          <div className={`text-xs p-1.5 rounded-md mb-1.5 flex items-center gap-1 ${ownMsg ? "bg-primary/20 text-primary-foreground/90" : "bg-muted text-muted-foreground"}`}>
                             <CornerDownLeft className="h-3 w-3 shrink-0" /> <span className="truncate">Antwort auf: {msg.replyTo}</span>
                          </div>
                        )}
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </CardContent>
                    </Card>
                    {ownMsg && userName && ( // Ensure userName is not null
                      <Avatar className="h-10 w-10 border">
                        <AvatarImage src={`https://placehold.co/40x40.png?text=${userAvatarFallback}`} alt="My Avatar" data-ai-hint="person user"/>
                        <AvatarFallback>{userAvatarFallback}</AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          {/* Message Input */}
          <div className="border-t bg-background p-3 md:p-4">
            <form className="flex items-center gap-2 md:gap-3">
              <Button variant="ghost" size="icon" type="button" className="shrink-0">
                <Paperclip className="h-5 w-5" />
                <span className="sr-only">Anhang</span>
              </Button>
              <Button variant="ghost" size="icon" type="button" className="shrink-0">
                <Smile className="h-5 w-5" />
                <span className="sr-only">Emoji</span>
              </Button>
              <Input
                type="text"
                placeholder="Nachricht eingeben..."
                className="flex-1 text-base"
                // Example, do not keep defaultValue in a real chat
                // defaultValue="Das ist nicht witzig. Solche Aussagen sind verletzend." 
              />
              <Button variant="ghost" size="icon" type="button" className="shrink-0">
                <Mic className="h-5 w-5" />
                <span className="sr-only">Spracheingabe</span>
              </Button>
              <Button type="submit" size="icon" className="shrink-0 bg-primary hover:bg-primary/90">
                <Send className="h-5 w-5" />
                <span className="sr-only">Senden</span>
              </Button>
            </form>
            <p className="text-xs text-muted-foreground mt-1.5 text-right">Tippt: Bot Provokateur...</p>
          </div>
        </main>
      </div>
    </div>
  );
}

// Wrap ChatPageContent with Suspense for useSearchParams
export default function ChatPage(props: ChatPageProps) {
  return (
    <Suspense fallback={<div className="flex h-screen w-full items-center justify-center"><p>Chat wird geladen...</p></div>}>
      <ChatPageContent {...props} />
    </Suspense>
  );
}
