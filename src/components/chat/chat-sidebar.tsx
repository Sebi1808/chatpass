
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from '@/lib/utils';
import type { Scenario, DisplayParticipant } from "@/lib/types";
import type { ParticipantColor } from '@/lib/config';
import { Bot as BotIcon, User, VolumeX } from "lucide-react";

interface ChatSidebarProps {
  participants: DisplayParticipant[];
  currentUserId: string | null;
  userName: string | null;
  userRole: string | null;
  userAvatarFallback: string;
  currentScenario: Scenario | undefined;
  isMuted: boolean;
  getParticipantColorClasses: (pUserId?: string, pSenderType?: 'admin' | 'user' | 'bot') => ParticipantColor;
  isAdminView?: boolean;
}

export function ChatSidebar({
  participants,
  currentUserId,
  userName,
  userRole,
  userAvatarFallback,
  currentScenario,
  isMuted,
  getParticipantColorClasses,
  isAdminView = false,
}: ChatSidebarProps) {
  return (
    <>
      <h2 className="text-lg font-semibold">Teilnehmende ({participants.length})</h2>
      <ScrollArea className="flex-1">
        <div className="space-y-3">
          {participants.map((p) => {
            const pColor = getParticipantColorClasses(p.userId, p.isBot ? 'bot' : (p.userId === currentUserId && isAdminView ? 'admin' : 'user'));
            return (
              <div key={p.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted">
                <Avatar className={cn("h-9 w-9 border-2", pColor.ring)}>
                  <AvatarImage src={`https://placehold.co/40x40.png?text=${p.avatarFallback}`} alt={p.name} data-ai-hint="person user" />
                  <AvatarFallback className={`${pColor.bg} ${pColor.text}`}>{p.avatarFallback}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">
                    {p.name}
                    {p.isBot && <Badge variant="outline" className="ml-1.5 text-xs px-1 py-0 border-accent/50 text-accent">BOT</Badge>}
                    {(p.userId === currentUserId && isAdminView) && <Badge variant="destructive" className="ml-1.5 text-xs px-1.5 py-0">ADMIN</Badge>}
                    {p.userId === currentUserId && isMuted && <VolumeX className="inline h-3 w-3 text-destructive ml-1.5" />}
                  </p>
                  <p className="text-xs text-muted-foreground">{p.role}</p>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
      {!isAdminView && userRole && currentScenario && userName && (
        <>
          <Separator />
          <Card className="mt-auto bg-muted/30">
            <CardHeader className="p-3">
              <div className="flex items-center gap-2">
                <Avatar className={cn("h-10 w-10 border-2", getParticipantColorClasses(currentUserId, 'user').ring)}>
                  <AvatarImage src={`https://placehold.co/40x40.png?text=${userAvatarFallback}`} alt="My Avatar" data-ai-hint="person user" />
                  <AvatarFallback className={`${getParticipantColorClasses(currentUserId, 'user').bg} ${getParticipantColorClasses(currentUserId, 'user').text}`}>
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
              <ScrollArea className="h-[200px] text-xs"> {/* Increased height */}
                <CardDescription className="text-muted-foreground border-l-2 border-primary pl-2 italic">
                  {currentScenario.langbeschreibung}
                </CardDescription>
              </ScrollArea>
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}

    