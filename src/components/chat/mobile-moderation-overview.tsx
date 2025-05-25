"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog"; // Wiederverwendet für Aktionen
import { cn } from "@/lib/utils";
import { 
  X as XIcon, 
  Loader2, 
  AlertTriangle, 
  Eye, 
  Send, 
  MessageSquare, 
  ArrowLeft, 
  Ban, 
  ShieldCheck, 
  Volume2, 
  Trash2,
  Check,
  ChevronRight,
  Users,
  ShieldAlert,
  UserCog,
  Clock,
  EyeOff,
  UserX
} from "lucide-react";
import type { DisplayMessage, Participant, SessionData } from "@/lib/types"; // SessionData hinzugefügt
import NextImage from 'next/image';
import { Timestamp } from 'firebase/firestore';

// Props von der Desktop-Version übernehmen (ggf. anpassen)
interface MobileModerationOverviewProps {
  isOpen: boolean;
  onClose: () => void;
  hasModPermissions: boolean;
  currentUserBadges?: ('admin' | 'moderator')[];
  sessionId: string;
  participants: Participant[];
  reportedMessages: DisplayMessage[];
  isLoadingReportedMessages: boolean;
  loadReportedMessages: () => void;
  handleDismissReport: (messageId: string, reporterUserId: string) => void;
  toggleBlurMessage: (messageId: string) => void;
  isTogglingBlur: string | null;
  handleApplyPenalty: (participantId: string, penaltyType: 'yellow' | 'red') => void;
  handleShowParticipantMessages: (participant: Participant) => void; // Könnte anders gehandhabt werden
  loadAndMarkDmThread: (userId: string) => void;
  getParticipantColorClasses: (userId?: string, senderType?: 'admin' | 'user' | 'bot' | 'system') => any;
  toast: any;
  handleAssignBadge: (participantId: string, badgeType: 'admin' | 'moderator') => void;
  handleRemoveBadge: (participantId: string, badgeType: 'admin' | 'moderator') => void;
  handleToggleMute: (participantId: string) => void;
  handleRemoveParticipant: (participantId: string) => void;
  handleClearAllBlurs: () => void;
  isAdjustingCooldown: boolean;
  handleAdjustCooldown: (seconds: number) => void;
  sessionData: SessionData | null; // Typ für sessionData präzisieren
  userId?: string | null;
  // closeAllModalsExceptDMs: () => void; // Wird hier evtl. anders gehandhabt
  
  // Für Mobile spezifische Stati und Handler, falls benötigt
  activePenalties: Participant[];
  hiddenMessages: DisplayMessage[];
  isLoadingHiddenMessages: boolean;
  loadActivePenalties: () => void;
  loadHiddenMessages: () => void;
  penaltyTimers: { [key: string]: string };
}

type MobileModTab = "main" | "reported" | "participants" | "moderators" | "penalties" | "hidden" | "blocking";

export function MobileModerationOverview({
  isOpen,
  onClose,
  hasModPermissions,
  currentUserBadges = [],
  sessionId,
  participants,
  reportedMessages,
  isLoadingReportedMessages,
  loadReportedMessages,
  handleDismissReport,
  toggleBlurMessage,
  isTogglingBlur,
  handleApplyPenalty,
  // handleShowParticipantMessages, // Wird anders gelöst
  loadAndMarkDmThread,
  getParticipantColorClasses,
  toast,
  handleAssignBadge,
  handleRemoveBadge,
  handleToggleMute,
  handleRemoveParticipant,
  handleClearAllBlurs,
  isAdjustingCooldown,
  handleAdjustCooldown,
  sessionData,
  userId,
  activePenalties,
  hiddenMessages,
  isLoadingHiddenMessages,
  loadActivePenalties,
  loadHiddenMessages,
  penaltyTimers,
}: MobileModerationOverviewProps) {
  const [activeTab, setActiveTab] = useState<MobileModTab>("main");
  const [selectedMessageForActions, setSelectedMessageForActions] = useState<DisplayMessage | null>(null);
  const [selectedParticipantForActions, setSelectedParticipantForActions] = useState<Participant | null>(null);

  useEffect(() => {
    if (isOpen && activeTab === 'reported') {
      loadReportedMessages();
    }
    if (isOpen && activeTab === 'penalties') {
      loadActivePenalties();
    }
    if (isOpen && activeTab === 'hidden') {
      loadHiddenMessages();
    }
  }, [isOpen, activeTab, loadReportedMessages, loadActivePenalties, loadHiddenMessages]);


  if (!isOpen || !hasModPermissions) return null;

  const renderMainScreen = () => (
    <div className="p-4 space-y-3">
      <h2 className="text-xl font-semibold mb-4">Moderation</h2>
      {[
        { label: "Gemeldete Nachrichten", value: "reported", icon: ShieldAlert, count: reportedMessages.length, badgeVariant: reportedMessages.length > 0 ? "destructive" : "default" },
        { label: "Teilnehmer verwalten", value: "participants", icon: Users, count: participants.length },
        { label: "Moderatoren / Admins", value: "moderators", icon: UserCog, count: participants.filter(p => p.assignedBadges?.includes('admin') || p.assignedBadges?.includes('moderator')).length },
        { label: "Aktive Strafen", value: "penalties", icon: Clock, count: activePenalties.length, badgeVariant: activePenalties.length > 0 ? "destructive" : "default" },
        { label: "Ausgeblendete Nachrichten", value: "hidden", icon: EyeOff, count: hiddenMessages.length },
        // { label: "Blockierte Nutzer", value: "blocking", icon: UserX }, // Später hinzufügen
      ].map(item => (
        <Button
          key={item.value}
          variant="outline"
          className="w-full justify-between h-14 text-base"
          onClick={() => setActiveTab(item.value as MobileModTab)}
        >
          <div className="flex items-center">
            <item.icon className="h-5 w-5 mr-3" />
            {item.label}
          </div>
          <div className="flex items-center">
            {typeof item.count === 'number' && (
              <Badge variant={item.badgeVariant || 'secondary'} className="mr-2">{item.count}</Badge>
            )}
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
        </Button>
      ))}
       {currentUserBadges?.includes('admin') && (
        <div className="pt-4 mt-4 border-t space-y-2">
             <Button variant="outline" className="w-full" onClick={handleClearAllBlurs} disabled={isAdjustingCooldown}>
                {isAdjustingCooldown && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Alle Blurs aufheben
             </Button>
             <Button variant="outline" className="w-full" onClick={() => {
                const newCooldown = prompt("Neuer Cooldown in Sekunden:", sessionData?.messageCooldownSeconds?.toString() || "0");
                if (newCooldown !== null) {
                    const seconds = parseInt(newCooldown);
                    if (!isNaN(seconds) && seconds >= 0) handleAdjustCooldown(seconds);
                }
             }} disabled={isAdjustingCooldown}>
                Cooldown anpassen
             </Button>
        </div>
       )}
    </div>
  );

  const renderReportedMessages = () => (
    <div>
      <div className="flex items-center justify-between p-3 border-b">
        <Button variant="ghost" size="icon" onClick={() => setActiveTab("main")}><ArrowLeft className="h-5 w-5" /></Button>
        <h3 className="font-semibold text-lg">Gemeldete Nachrichten</h3>
        <Button variant="ghost" size="icon" onClick={loadReportedMessages} disabled={isLoadingReportedMessages}>
          {isLoadingReportedMessages ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldAlert className="h-5 w-5"/>}
        </Button>
      </div>
      <ScrollArea className="h-[calc(100vh-120px)] p-3"> {/* Höhe anpassen */}
        {isLoadingReportedMessages && <div className="flex justify-center py-4"><Loader2 className="h-8 w-8 animate-spin" /></div>}
        {!isLoadingReportedMessages && reportedMessages.length === 0 && (
          <p className="text-center text-muted-foreground py-6">Keine gemeldeten Nachrichten.</p>
        )}
        <div className="space-y-3">
          {reportedMessages.map(msg => (
            <Card key={msg.id} className="overflow-hidden">
              <CardContent className="p-3">
                <div className="flex items-start gap-2 mb-2">
                  <Avatar className="h-8 w-8 mt-1">
                    <AvatarFallback className={cn(getParticipantColorClasses(msg.senderUserId).bg, getParticipantColorClasses(msg.senderUserId).text, "text-xs")}>
                      {msg.avatarFallback}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm">{msg.senderName}</span>
                        <span className="text-xs text-muted-foreground">{msg.timestampDisplay}</span>
                    </div>
                    {msg.isBlurred && <Badge variant="secondary" size="sm" className="mt-1"><Eye className="h-3 w-3 mr-1" />Ausgeblendet</Badge>}
                  </div>
                </div>
                
                {msg.imageUrl && (
                  <div className="my-2 rounded-md overflow-hidden aspect-video relative max-w-xs">
                     <NextImage src={msg.imageUrl} alt="Bild-Anhang" layout="fill" objectFit="cover" />
                  </div>
                )}
                <p className="text-sm whitespace-pre-wrap bg-muted/50 p-2 rounded-md">{msg.content}</p>
                
                <div className="mt-2 space-y-1">
                  <p className="text-xs font-medium text-destructive">Meldungen:</p>
                  {msg.reportedBy?.map((report: any, index: number) => (
                    <div key={index} className="text-xs p-1.5 bg-red-500/10 rounded flex justify-between items-center">
                      <span><span className="font-semibold">{report.userId.substring(0,6)}...</span>: {report.reason}</span>
                      <Button size="sm" variant="ghost" className="h-6 px-1.5" onClick={() => handleDismissReport(msg.id, report.userId)}>
                        <XIcon className="h-3 w-3"/>
                      </Button>
                    </div>
                  ))}
                </div>
                 <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" onClick={() => setSelectedMessageForActions(msg)}>Aktionen</Button>
                    <Button variant="outline" size="sm" onClick={() => { onClose(); loadAndMarkDmThread(msg.senderUserId!); }}>DM</Button>
                 </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );

  // Platzhalter für andere Tabs
  const renderParticipants = () => (
     <div>
      <div className="flex items-center justify-between p-3 border-b">
        <Button variant="ghost" size="icon" onClick={() => setActiveTab("main")}><ArrowLeft className="h-5 w-5" /></Button>
        <h3 className="font-semibold text-lg">Teilnehmer</h3>
        <div className="w-9"></div>{/* Platzhalter für Balance */}
      </div>
      <ScrollArea className="h-[calc(100vh-120px)] p-3"> {/* Höhe anpassen */}
        <p className="text-center text-muted-foreground py-6">Teilnehmer-Tab (Mobil) - Inhalt folgt.</p>
      </ScrollArea>
    </div>
  );
  const renderModerators = () => (
     <div>
      <div className="flex items-center justify-between p-3 border-b">
        <Button variant="ghost" size="icon" onClick={() => setActiveTab("main")}><ArrowLeft className="h-5 w-5" /></Button>
        <h3 className="font-semibold text-lg">Moderatoren</h3>
        <div className="w-9"></div>
      </div>
      <ScrollArea className="h-[calc(100vh-120px)] p-3">
        <p className="text-center text-muted-foreground py-6">Moderatoren-Tab (Mobil) - Inhalt folgt.</p>
      </ScrollArea>
    </div>
  );
  // Weitere render Funktionen für penalties, hidden, blocking

  const renderContent = () => {
    switch (activeTab) {
      case "main": return renderMainScreen();
      case "reported": return renderReportedMessages();
      case "participants": return renderParticipants();
      case "moderators": return renderModerators();
      // case "penalties": return renderPenalties(); // Implementieren
      // case "hidden": return renderHiddenMessages(); // Implementieren
      // case "blocking": return renderBlocking(); // Implementieren
      default: return renderMainScreen();
    }
  };

  return (
    <div className="fixed inset-0 bg-background z-[60] flex flex-col animate-in slide-in-from-bottom duration-300">
      <div className="flex-1 overflow-y-auto">
        {renderContent()}
      </div>

      {/* Dialog für Nachrichten-Aktionen */}
      <Dialog open={!!selectedMessageForActions} onOpenChange={(open) => !open && setSelectedMessageForActions(null)}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Aktionen für Nachricht</DialogTitle>
          </DialogHeader>
          {selectedMessageForActions && (
            <div className="py-2 space-y-2">
              <Button className="w-full justify-start" variant="ghost" onClick={() => { toggleBlurMessage(selectedMessageForActions.id); setSelectedMessageForActions(null); }}>
                <Eye className="mr-2 h-4 w-4" /> {selectedMessageForActions.isBlurred ? "Einblenden" : "Ausblenden"}
              </Button>
              <Button className="w-full justify-start" variant="ghost" onClick={() => { 
                const participant = participants.find(p => p.userId === selectedMessageForActions.senderUserId);
                if(participant) handleApplyPenalty(participant.id, 'yellow');
                setSelectedMessageForActions(null); 
              }}>
                <Ban className="mr-2 h-4 w-4 text-yellow-500" /> Gelbe Karte
              </Button>
              <Button className="w-full justify-start" variant="ghost" onClick={() => { 
                const participant = participants.find(p => p.userId === selectedMessageForActions.senderUserId);
                if(participant) handleApplyPenalty(participant.id, 'red');
                setSelectedMessageForActions(null); 
              }}>
                <Ban className="mr-2 h-4 w-4 text-red-500" /> Rote Karte
              </Button>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Abbrechen</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ggf. Dialog für Teilnehmer-Aktionen hier */}

      {/* Globaler Schließen-Button (optional, da Tabs zurück zu Main führen) */}
      {activeTab !== "main" && (
         <div className="p-2 border-t bg-background">
            <Button variant="outline" className="w-full" onClick={onClose}>Moderation schließen</Button>
         </div>
      )}
       {activeTab === "main" && (
         <div className="p-2 border-t bg-background">
            <Button variant="default" className="w-full" onClick={onClose}>Schließen</Button>
         </div>
      )}
    </div>
  );
} 