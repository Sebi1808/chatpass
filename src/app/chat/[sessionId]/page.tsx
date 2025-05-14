import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Paperclip, Send, Smile, Mic, User, Bot, CornerDownLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface ChatPageProps {
  params: { sessionId: string };
}

// Mock message data
const mockMessages = [
  { id: '1', sender: 'Lehrkraft', senderType: 'admin', avatar: 'L', content: 'Willkommen zur Simulation "Hate-Speech"! Bitte achtet auf einen respektvollen Umgang.', timestamp: '10:00', isOwn: false },
  { id: '2', sender: 'Bot Provokateur', senderType: 'bot', avatar: 'BP', content: 'Respekt? Was für ein langweiliges Wort! 😂', timestamp: '10:01', botFlag: true, isOwn: false },
  { id: '3', sender: 'Schüler Max', senderType: 'user', avatar: 'SM', content: 'Das ist nicht witzig. Solche Aussagen sind verletzend.', timestamp: '10:02', isOwn: true, replyTo: 'Bot Provokateur' },
  { id: '4', sender: 'Schülerin Anna', senderType: 'user', avatar: 'SA', content: 'Genau, das geht zu weit!', timestamp: '10:03', isOwn: false },
  { id: '5', sender: 'Bot Verteidiger', senderType: 'bot', avatar: 'BV', content: 'Gut gekontert, Max! Es ist wichtig, für seine Meinung einzustehen.', timestamp: '10:04', botFlag: true, isOwn: false },
];


export default function ChatPage({ params }: ChatPageProps) {
  return (
    <div className="flex h-screen flex-col bg-muted/40">
      {/* Header */}
      <header className="flex h-16 items-center justify-between border-b bg-background px-4 md:px-6 shrink-0">
        <h1 className="text-lg font-semibold text-primary">Simulation: Hate-Speech</h1>
        <div className="flex items-center gap-2">
            <Badge variant="secondary">ID: {params.sessionId}</Badge>
            <Avatar className="h-8 w-8">
                <AvatarImage src="https://placehold.co/40x40.png" alt="User Avatar" data-ai-hint="person user" />
                <AvatarFallback>SM</AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium">Schüler Max</span>
        </div>
      </header>

      {/* Main chat area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Participant List (Sidebar) - hidden on small screens, shown on md+ */}
        <aside className="hidden md:flex md:w-64 lg:w-72 flex-col border-r bg-background p-4 space-y-4">
          <h2 className="text-lg font-semibold">Teilnehmende (5)</h2>
          <ScrollArea className="flex-1">
            <div className="space-y-3">
              {['Lehrkraft', 'Bot Provokateur', 'Schüler Max', 'Schülerin Anna', 'Bot Verteidiger'].map((name, idx) => (
                <div key={idx} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={`https://placehold.co/40x40.png?text=${name.substring(0,1)}`} alt={name} data-ai-hint="person user" />
                    <AvatarFallback>{name.substring(0,2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{name}</p>
                    <p className="text-xs text-muted-foreground">{idx === 0 ? 'Admin' : idx % 2 !== 0 ? 'Bot' : 'Schüler*in'}</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </aside>

        {/* Chat messages and input */}
        <main className="flex flex-1 flex-col">
          <ScrollArea className="flex-1 p-4 md:p-6">
            <div className="space-y-6">
              {mockMessages.map((msg) => (
                <div key={msg.id} className={`flex gap-3 ${msg.isOwn ? "justify-end" : "justify-start"}`}>
                  {!msg.isOwn && (
                    <Avatar className="h-10 w-10 border">
                       <AvatarImage src={`https://placehold.co/40x40.png?text=${msg.sender.substring(0,1)}`} alt={msg.sender} data-ai-hint="person user"/>
                      <AvatarFallback>{msg.sender.substring(0,2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                  )}
                  <Card className={`max-w-xs md:max-w-md lg:max-w-lg shadow-md ${msg.isOwn ? "bg-primary text-primary-foreground" : "bg-card"}`}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-semibold ${msg.isOwn ? "text-primary-foreground/80" : "text-accent"}`}>
                          {msg.sender}
                          {msg.senderType === 'bot' && <Bot className="inline-block h-3 w-3 ml-1" />}
                          {msg.senderType === 'admin' && <User className="inline-block h-3 w-3 ml-1" />}
                        </span>
                        <span className={`text-xs ${msg.isOwn ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{msg.timestamp}</span>
                      </div>
                      {msg.replyTo && (
                        <div className={`text-xs p-1.5 rounded-md mb-1.5 flex items-center gap-1 ${msg.isOwn ? "bg-primary/20 text-primary-foreground/90" : "bg-muted text-muted-foreground"}`}>
                           <CornerDownLeft className="h-3 w-3 shrink-0" /> <span className="truncate">Antwort auf: {msg.replyTo}</span>
                        </div>
                      )}
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    </CardContent>
                  </Card>
                  {msg.isOwn && (
                    <Avatar className="h-10 w-10 border">
                      <AvatarImage src="https://placehold.co/40x40.png?text=SM" alt="My Avatar" data-ai-hint="person user"/>
                      <AvatarFallback>SM</AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}
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
                defaultValue="Das ist nicht witzig. Solche Aussagen sind verletzend."
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
