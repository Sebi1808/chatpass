
"use client";

import { memo } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from '@/lib/utils';
import type { Scenario, DisplayParticipant } from "@/lib/types";
import type { ParticipantColor } from '@/lib/config';
import { Bot as BotIcon, User, VolumeX, ShieldCheck, Crown } from "lucide-react";

interface ChatSidebarProps {
  participants: DisplayParticipant[];
  isLoadingParticipants: boolean; // Added this prop
  currentUserId: string | null;
  userName: string | null; // This will be the nickname for display
  userRole: string | null;
  userAvatarFallback: string;
  currentScenario: Scenario | undefined;
  isMuted: boolean;
  getParticipantColorClasses: (pUserId?: string, pSenderType?: 'admin' | 'user' | 'bot' | 'system') => ParticipantColor;
  isAdminView?: boolean;
}

const ChatSidebar = memo(function ChatSidebar({
  participants,
  isLoadingParticipants,
  currentUserId,
  userName, // This is nickname
  userRole,
  userAvatarFallback,
  currentScenario,
  isMuted,
  getParticipantColorClasses,
  isAdminView = false,
}: ChatSidebarProps) {
  return (
    <>
      <h2 className="text-lg font-semibold">Teilnehmende ({isLoadingParticipants ? '...' : participants.length})</h2>
      <ScrollArea className="flex-1 -mr-2">
        <div className="space-y-3 py-2 pr-2">
          {isLoadingParticipants ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
              <p className="text-sm text-muted-foreground">Lade Teilnehmer...</p>
            </div>
          ) : participants.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Noch keine Teilnehmer beigetreten.</p>
          ) : (
            participants.map((p) => {
              const pColor = getParticipantColorClasses(p.userId, p.isBot ? 'bot' : (p.userId === currentUserId && isAdminView ? 'admin' : 'user'));
              const isAdminParticipant = p.userId === currentUserId && isAdminView;
              const isCurrentParticipantMuted = p.isMuted ?? false;
              const displayName = p.nickname || p.name; // Prefer nickname

              return (
                <div key={p.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50">
                  <Avatar className={cn("h-9 w-9 border-2", pColor.ring)}>
                    <AvatarImage src={`https://placehold.co/40x40.png?text=${p.avatarFallback}`} alt={displayName} data-ai-hint="person user"/>
                    <AvatarFallback className={cn(pColor.bg, pColor.text)}>{p.avatarFallback}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium flex items-center">
                      <span className={cn("text-neutral-200", pColor.nameText)}>{displayName}</span> {/* Use nickname */}
                      {p.isBot && <Badge variant="outline" className="ml-1.5 text-xs px-1.5 py-0.5 h-5 leading-tight bg-purple-700 text-white border border-purple-900/50 shadow-sm flex items-center gap-1"><BotIcon className="h-3 w-3" />BOT</Badge>}
                      {isAdminParticipant && <Badge variant="destructive" className="ml-1.5 text-xs px-1.5 py-0.5 h-5 leading-tight bg-red-700 text-white border border-red-900/50 shadow-sm flex items-center gap-1"><Crown className="h-3 w-3" />ADMIN</Badge>}
                      {p.userId === currentUserId && !isAdminView && <Badge variant="secondary" className="ml-1.5 text-xs px-1.5 py-0">Du</Badge>}
                      {isCurrentParticipantMuted && !p.isBot && <VolumeX className="inline h-3 w-3 text-destructive ml-1.5" />}
                    </p>
                    <p className="text-xs text-muted-foreground">{p.role}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
      {!isAdminView && userRole && currentScenario && userName && currentUserId && ( // userName here is the nickname
        <>
          <Separator />
          <Card className="mt-auto bg-muted/30">
            <CardHeader className="p-3">
              <div className="flex items-center gap-2">
                <Avatar className={cn("h-10 w-10 border-2", getParticipantColorClasses(currentUserId, 'user').ring)}>
                  <AvatarImage src={`https://placehold.co/40x40.png?text=${userAvatarFallback}`} alt="My Avatar" data-ai-hint="person user"/>
                  <AvatarFallback className={cn(getParticipantColorClasses(currentUserId, 'user').bg, getParticipantColorClasses(currentUserId, 'user').text)}>
                    {userAvatarFallback}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-base">Du als: {userName}</CardTitle> {/* userName is nickname */}
                  <p className="text-xs text-muted-foreground">Deine Rolle: {userRole}</p>
                </div>
              </div>
            </CardHeader>
            {currentScenario.langbeschreibung && (
              <CardContent className="p-3 pt-0">
                  <ScrollArea className="h-[80px] text-xs"> {/* Reduced height for role description */}
                      <CardDescription className="text-muted-foreground border-l-2 border-primary pl-2 italic">
                          {currentScenario.humanRolesConfig?.find(r => r.name === userRole)?.description || currentScenario.langbeschreibung}
                      </CardDescription>
                  </ScrollArea>
              </CardContent>
            )}
          </Card>
        </>
      )}
    </>
  );
});

ChatSidebar.displayName = "ChatSidebar";

export { ChatSidebar };
