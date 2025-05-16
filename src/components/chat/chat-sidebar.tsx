
"use client";

import { memo } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from '@/lib/utils';
import type { Scenario, DisplayParticipant, HumanRoleConfig } from "@/lib/types"; // Added HumanRoleConfig
import type { ParticipantColor } from '@/lib/config';
import { Bot as BotIcon, User, VolumeX, ShieldCheck, Crown, Loader2, Info } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Button } from '../ui/button';


interface ChatSidebarProps {
  participants: DisplayParticipant[];
  isLoadingParticipants: boolean; 
  currentUserId: string | null;
  userDisplayName: string | null; 
  userRole: string | null; // This is the role NAME
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
  userDisplayName, 
  userRole,
  userAvatarFallback,
  currentScenario,
  isMuted,
  getParticipantColorClasses,
  isAdminView = false,
}: ChatSidebarProps) {

  const currentUserRoleDescription = useMemo(() => {
    if (!currentScenario || !currentScenario.humanRolesConfig || !userRole) return "Keine Rollenbeschreibung verfügbar.";
    const roleConfig = currentScenario.humanRolesConfig.find(r => r.name === userRole);
    return roleConfig?.description || "Rollenbeschreibung nicht gefunden.";
  }, [currentScenario, userRole]);


  return (
    <>
      <h2 className="text-lg font-semibold">Teilnehmende ({isLoadingParticipants ? '...' : participants.filter(p => !p.isBot || isAdminView).length})</h2>
      <ScrollArea className="flex-1 -mr-2"> 
        <div className="space-y-3 py-2 pr-2">
          {isLoadingParticipants ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
              <p className="text-sm text-muted-foreground">Lade Teilnehmer...</p>
            </div>
          ) : (!participants || participants.filter(p => !p.isBot || isAdminView).length === 0) ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Noch keine Teilnehmer beigetreten.</p>
          ) : (
            participants.map((p) => {
              if (p.isBot && !isAdminView) return null; // Do not show bots to regular users in sidebar

              const pColor = getParticipantColorClasses(p.userId, p.isBot ? 'bot' : (p.userId === currentUserId && isAdminView ? 'admin' : 'user'));
              const isAdminParticipant = p.userId === currentUserId && isAdminView;
              const isCurrentParticipantMuted = p.isMuted ?? false;
              const participantDisplayNameToShow = p.displayName || p.realName;

              return (
                <div key={p.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50">
                  <Avatar className={cn("h-9 w-9 border-2", pColor.ring)}>
                    <AvatarImage src={`https://placehold.co/40x40.png?text=${p.avatarFallback}`} alt={participantDisplayNameToShow} data-ai-hint="person user"/>
                    <AvatarFallback className={cn("font-semibold",pColor.bg, pColor.text)}>{p.avatarFallback}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium flex items-center">
                      <span className="text-neutral-200">{participantDisplayNameToShow}</span> {/* Consistent light color for names */}
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
      {!isAdminView && userRole && currentScenario && userDisplayName && currentUserId && ( 
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
                  <CardTitle className="text-base">Du als: {userDisplayName}</CardTitle>
                  <div className="flex items-center">
                    <p className="text-xs text-muted-foreground">Deine Rolle: {userRole}</p>
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-5 w-5 ml-1 p-0"><Info className="h-3.5 w-3.5 text-muted-foreground hover:text-primary"/></Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-lg">
                            <DialogHeader>
                                <DialogTitle>Rollenbeschreibung: {userRole}</DialogTitle>
                            </DialogHeader>
                            <ScrollArea className="max-h-[60vh] mt-2">
                                <pre className="whitespace-pre-wrap text-sm text-muted-foreground p-1">{currentUserRoleDescription}</pre>
                            </ScrollArea>
                            <DialogClose asChild><Button type="button" variant="secondary" className="mt-3 w-full">Schließen</Button></DialogClose>
                        </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </div>
            </CardHeader>
            {/* Role description is now in the dialog */}
          </Card>
        </>
      )}
    </>
  );
});

ChatSidebar.displayName = "ChatSidebar";

export { ChatSidebar };
