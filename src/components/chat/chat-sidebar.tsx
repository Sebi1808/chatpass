"use client";

import { memo, useMemo } from 'react'; // Added useMemo
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // Removed CardDescription
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from '@/lib/utils';
import type { Scenario, DisplayParticipant, Participant } from "@/lib/types";
import type { ParticipantColor } from '@/lib/config';
import { Bot as BotIcon, User, VolumeX, ShieldCheck, Crown, Loader2, Info, Send } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogTrigger } from "@/components/ui/dialog"; // Removed DialogDescription, Added DialogTrigger
import { Button } from '../ui/button';


interface ChatSidebarProps {
  participants: DisplayParticipant[];
  isLoadingParticipants: boolean;
  currentUserId: string | null;
  getParticipantColorClasses: (pUserId?: string, pSenderType?: 'admin' | 'user' | 'bot' | 'system') => ParticipantColor;
  isAdminView?: boolean;
  onInitiateDm?: (participant: Participant) => void;
}

const ChatSidebar = memo(function ChatSidebar({
  participants,
  isLoadingParticipants,
  currentUserId,
  getParticipantColorClasses,
  isAdminView = false,
  onInitiateDm
}: ChatSidebarProps) {

  return (
    <>
      <h2 className="text-lg font-semibold pl-2 pt-2">Teilnehmende ({isLoadingParticipants ? '...' : participants.filter(p => p.isBot ? isAdminView : true).length})</h2>
      <ScrollArea className="flex-1 pb-2">
        <div className="space-y-3 py-2 px-2">
          {isLoadingParticipants ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
              <p className="text-sm text-muted-foreground">Lade Teilnehmer...</p>
            </div>
          ) : (!participants || participants.filter(p => p.isBot ? isAdminView : true).length === 0) ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Noch keine Teilnehmer beigetreten.</p>
          ) : (
            participants.map((p) => {
              if (p.isBot && !isAdminView) return null;

              const pColor = getParticipantColorClasses(p.userId, p.isBot ? 'bot' : (p.userId === currentUserId && isAdminView ? 'admin' : 'user'));
              const isAdminParticipant = p.userId === currentUserId && isAdminView;
              const isCurrentParticipantMuted = p.isMuted ?? false;

              return (
                <div key={p.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50">
                  <Avatar className={cn("h-9 w-9 border-2", pColor.ring)}>
                    <AvatarImage src={`https://placehold.co/40x40.png?text=${p.avatarFallback}`} alt={p.displayName} data-ai-hint="person user"/>
                    <AvatarFallback className={cn("font-semibold", pColor.bg, pColor.text)}>{p.avatarFallback}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium flex items-center">
                      <span className="text-neutral-200">{p.displayName}</span>
                      {p.isBot && <Badge variant="outline" className="ml-1.5 text-xs px-1.5 py-0.5 h-5 leading-tight bg-purple-700 text-white border border-purple-900/50 shadow-sm flex items-center gap-1"><BotIcon className="h-3 w-3" />BOT</Badge>}
                      {isAdminParticipant && <Badge variant="destructive" className="ml-1.5 text-xs px-1.5 py-0.5 h-5 leading-tight bg-red-700 text-white border border-red-900/50 shadow-sm flex items-center gap-1"><Crown className="h-3 w-3" />ADMIN</Badge>}
                      {p.userId === currentUserId && !isAdminView && <Badge variant="secondary" className="ml-1.5 text-xs px-1.5 py-0">Du</Badge>}
                      {isCurrentParticipantMuted && !p.isBot && <VolumeX className="inline h-3 w-3 text-destructive ml-1.5" />}
                    </p>
                    <p className="text-xs text-muted-foreground">{p.role}</p>
                  </div>
                  {p.userId !== currentUserId && onInitiateDm && (
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="h-7 w-7 p-1 text-muted-foreground hover:text-primary flex-shrink-0"
                      onClick={(e) => { 
                        e.stopPropagation();
                        onInitiateDm(p as Participant);
                      }}
                      title={`Direktnachricht an ${p.displayName}`}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </>
  );
});

ChatSidebar.displayName = "ChatSidebar";

export { ChatSidebar };
    