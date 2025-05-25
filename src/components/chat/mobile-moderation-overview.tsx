"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog"; // Wiederverwendet für Aktionen
import { Separator } from "@/components/ui/separator";
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
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

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
  handleShowParticipantMessages: (participant: Participant) => void;
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
type BadgeVariant = "default" | "destructive" | "secondary" | "outline" | null | undefined;

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
  handleShowParticipantMessages,
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
        { label: "Gemeldete Nachrichten", value: "reported", icon: ShieldAlert, count: reportedMessages.length, badgeVariant: reportedMessages.length > 0 ? "destructive" : "default" as BadgeVariant },
        { label: "Teilnehmer verwalten", value: "participants", icon: Users, count: participants.length },
        { label: "Moderatoren / Admins", value: "moderators", icon: UserCog, count: participants.filter(p => p.assignedBadges?.includes('admin') || p.assignedBadges?.includes('moderator')).length },
        { label: "Aktive Strafen", value: "penalties", icon: Clock, count: activePenalties.length, badgeVariant: activePenalties.length > 0 ? "destructive" : "default" as BadgeVariant },
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
                    {msg.isBlurred && <Badge variant="secondary" className="mt-1"><Eye className="h-3 w-3 mr-1" />Ausgeblendet</Badge>}
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
        <h3 className="font-semibold text-lg">Teilnehmer ({participants.length})</h3>
        <div className="w-9"></div>{/* Platzhalter für Balance */}
      </div>
      <ScrollArea className="h-[calc(100vh-120px)] p-3">
        <div className="space-y-3">
          {participants.map(participant => (
            <Card key={participant.id} className="overflow-hidden">
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10 mt-1">
                    <AvatarFallback className={cn(getParticipantColorClasses(participant.userId).bg, getParticipantColorClasses(participant.userId).text, "text-sm")}>
                      {participant.avatarFallback}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm">{participant.displayName}</span>
                      <div className="flex gap-1">
                        {participant.assignedBadges?.includes('admin') && (
                          <Badge variant="destructive" className="text-xs">Admin</Badge>
                        )}
                        {participant.assignedBadges?.includes('moderator') && (
                          <Badge variant="secondary" className="text-xs">Mod</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                      <span>{participant.role}</span>
                      {participant.isMuted && <Badge variant="outline" className="text-xs"><Volume2 className="h-3 w-3 mr-1" />Stumm</Badge>}
                      {penaltyTimers[participant.id] && (
                        <Badge variant="destructive" className="text-xs">
                          <Clock className="h-3 w-3 mr-1" />{penaltyTimers[participant.id]}
                        </Badge>
                      )}
                    </div>
                    {hasModPermissions && participant.userId !== userId && (
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" size="sm" onClick={() => setSelectedParticipantForActions(participant)}>
                          Aktionen
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => { onClose(); loadAndMarkDmThread(participant.userId); }}>
                          DM
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );

  const renderModerators = () => {
    const moderators = participants.filter(p => p.assignedBadges?.includes('admin') || p.assignedBadges?.includes('moderator'));
    
    return (
      <div>
        <div className="flex items-center justify-between p-3 border-b">
          <Button variant="ghost" size="icon" onClick={() => setActiveTab("main")}><ArrowLeft className="h-5 w-5" /></Button>
          <h3 className="font-semibold text-lg">Moderatoren ({moderators.length})</h3>
          <div className="w-9"></div>
        </div>
        <ScrollArea className="h-[calc(100vh-120px)] p-3">
          {moderators.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">Keine Moderatoren oder Admins.</p>
          ) : (
            <div className="space-y-3">
              {moderators.map(moderator => (
                <Card key={moderator.id} className="overflow-hidden">
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10 mt-1">
                        <AvatarFallback className={cn(getParticipantColorClasses(moderator.userId).bg, getParticipantColorClasses(moderator.userId).text, "text-sm")}>
                          {moderator.avatarFallback}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-sm">{moderator.displayName}</span>
                          <div className="flex gap-1">
                            {moderator.assignedBadges?.includes('admin') && (
                              <Badge variant="destructive" className="text-xs">Admin</Badge>
                            )}
                            {moderator.assignedBadges?.includes('moderator') && (
                              <Badge variant="secondary" className="text-xs">Moderator</Badge>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">{moderator.role}</p>
                        {currentUserBadges?.includes('admin') && moderator.userId !== userId && (
                          <div className="grid grid-cols-2 gap-2">
                            <Button variant="outline" size="sm" onClick={() => setSelectedParticipantForActions(moderator)}>
                              Verwalten
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => { onClose(); loadAndMarkDmThread(moderator.userId); }}>
                              DM
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    );
  };

  const renderPenalties = () => (
    <div>
      <div className="flex items-center justify-between p-3 border-b">
        <Button variant="ghost" size="icon" onClick={() => setActiveTab("main")}><ArrowLeft className="h-5 w-5" /></Button>
        <h3 className="font-semibold text-lg">Aktive Strafen ({activePenalties.length})</h3>
        <Button variant="ghost" size="icon" onClick={loadActivePenalties}>
          <Clock className="h-5 w-5" />
        </Button>
      </div>
      <ScrollArea className="h-[calc(100vh-120px)] p-3">
        {activePenalties.length === 0 ? (
          <p className="text-center text-muted-foreground py-6">Keine aktiven Strafen.</p>
        ) : (
          <div className="space-y-3">
            {activePenalties.map(participant => (
              <Card key={participant.id} className="overflow-hidden border-l-4 border-l-red-500">
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10 mt-1">
                      <AvatarFallback className={cn(getParticipantColorClasses(participant.userId).bg, getParticipantColorClasses(participant.userId).text, "text-sm")}>
                        {participant.avatarFallback}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-sm">{participant.displayName}</span>
                        {penaltyTimers[participant.id] && (
                          <Badge variant="destructive" className="text-xs">
                            <Clock className="h-3 w-3 mr-1" />{penaltyTimers[participant.id]}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">Strafe aktiv</p>
                      {hasModPermissions && (
                        <div className="grid grid-cols-2 gap-2">
                          <Button variant="outline" size="sm" onClick={() => { onClose(); loadAndMarkDmThread(participant.userId); }}>
                            DM senden
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={async () => {
                              try {
                                const participantRef = doc(db, "sessions", sessionId, "participants", participant.id);
                                await updateDoc(participantRef, {
                                  activePenalty: null,
                                  isMuted: false,
                                  updatedAt: serverTimestamp()
                                });
                                toast({ title: "Strafe aufgehoben", description: `Strafe für ${participant.displayName} wurde aufgehoben.` });
                                loadActivePenalties();
                              } catch (error: any) {
                                toast({ variant: "destructive", title: "Fehler", description: "Strafe konnte nicht aufgehoben werden." });
                              }
                            }}
                          >
                            <Check className="h-4 w-4 mr-1" />Aufheben
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );

  const renderHiddenMessages = () => (
    <div>
      <div className="flex items-center justify-between p-3 border-b">
        <Button variant="ghost" size="icon" onClick={() => setActiveTab("main")}><ArrowLeft className="h-5 w-5" /></Button>
        <h3 className="font-semibold text-lg">Ausgeblendete Nachrichten ({hiddenMessages.length})</h3>
        <Button variant="ghost" size="icon" onClick={loadHiddenMessages} disabled={isLoadingHiddenMessages}>
          {isLoadingHiddenMessages ? <Loader2 className="h-5 w-5 animate-spin" /> : <EyeOff className="h-5 w-5"/>}
        </Button>
      </div>
      <ScrollArea className="h-[calc(100vh-120px)] p-3">
        {isLoadingHiddenMessages && <div className="flex justify-center py-4"><Loader2 className="h-8 w-8 animate-spin" /></div>}
        {!isLoadingHiddenMessages && hiddenMessages.length === 0 && (
          <p className="text-center text-muted-foreground py-6">Keine ausgeblendeten Nachrichten.</p>
        )}
        <div className="space-y-3">
          {hiddenMessages.map(msg => (
            <Card key={msg.id} className="overflow-hidden border-l-4 border-l-yellow-500">
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
                    <Badge variant="secondary" className="mt-1"><EyeOff className="h-3 w-3 mr-1" />Ausgeblendet</Badge>
                  </div>
                </div>
                
                {msg.imageUrl && (
                  <div className="my-2 rounded-md overflow-hidden aspect-video relative max-w-xs">
                     <NextImage src={msg.imageUrl} alt="Bild-Anhang" layout="fill" objectFit="cover" />
                  </div>
                )}
                <p className="text-sm whitespace-pre-wrap bg-muted/50 p-2 rounded-md">{msg.content}</p>
                
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Button variant="outline" size="sm" onClick={() => toggleBlurMessage(msg.id)}>
                    <Eye className="h-4 w-4 mr-1" />Einblenden
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { onClose(); loadAndMarkDmThread(msg.senderUserId!); }}>
                    DM
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setSelectedMessageForActions(msg)}
                  >
                    Aktionen
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case "main": return renderMainScreen();
      case "reported": return renderReportedMessages();
      case "participants": return renderParticipants();
      case "moderators": return renderModerators();
      case "penalties": return renderPenalties(); 
      case "hidden": return renderHiddenMessages(); 
      // case "blocking": return renderBlocking(); // Implementieren
      default: return renderMainScreen();
    }
  };

  return (
    <div className="fixed inset-0 bg-background z-[60] flex flex-col animate-in slide-in-from-bottom duration-300">
      <div className="flex-1 overflow-y-auto">
        {renderContent()}
      </div>

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

      {/* Dialog für Nachrichten-Aktionen */}
      {selectedMessageForActions && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-background rounded-lg shadow-xl border max-w-xs w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-lg">Aktionen für Nachricht</h3>
              <p className="text-sm text-muted-foreground mt-1">von {selectedMessageForActions.senderName}</p>
            </div>
            <div className="p-4 space-y-3">
              {/* DM senden */}
              <Button 
                className="w-full justify-start" 
                variant="ghost" 
                onClick={() => { 
                  onClose(); 
                  loadAndMarkDmThread(selectedMessageForActions.senderUserId!); 
                  setSelectedMessageForActions(null); 
                }}
                disabled={!selectedMessageForActions.senderUserId}
              >
                <Send className="mr-2 h-4 w-4" /> DM senden
              </Button>

              {/* Alle Nachrichten anzeigen */}
              <Button 
                className="w-full justify-start" 
                variant="ghost" 
                onClick={() => { 
                  const participant = participants.find(p => p.userId === selectedMessageForActions.senderUserId);
                  if (participant) {
                    handleShowParticipantMessages(participant);
                    setSelectedMessageForActions(null);
                  }
                }}
                disabled={!participants.find(p => p.userId === selectedMessageForActions.senderUserId)}
              >
                <MessageSquare className="mr-2 h-4 w-4" /> Alle Nachrichten anzeigen
              </Button>

              {/* Zur Nachricht springen */}
              <Button 
                className="w-full justify-start" 
                variant="ghost" 
                onClick={() => { 
                  onClose();
                  setSelectedMessageForActions(null);
                  setTimeout(() => {
                    const messageElements = document.querySelectorAll('.message-container');
                    for (const element of messageElements) {
                      const messageId = element.getAttribute('data-message-id');
                      if (messageId === selectedMessageForActions.id) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        element.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2');
                        setTimeout(() => {
                          element.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2');
                        }, 2000);
                        break;
                      }
                    }
                  }, 300);
                }}
              >
                <ArrowLeft className="mr-2 h-4 w-4 rotate-180" /> Zur Nachricht springen
              </Button>

              <Separator />

              {/* Ein-/Ausblenden */}
              <Button 
                className="w-full justify-start" 
                variant="ghost" 
                onClick={() => { 
                  toggleBlurMessage(selectedMessageForActions.id); 
                  setSelectedMessageForActions(null); 
                }}
              >
                <Eye className="mr-2 h-4 w-4" /> 
                {selectedMessageForActions.isBlurred ? "Einblenden" : "Ausblenden"}
              </Button>

              {/* Strafen */}
              <Button 
                className="w-full justify-start" 
                variant="ghost" 
                onClick={() => { 
                  const participant = participants.find(p => p.userId === selectedMessageForActions.senderUserId);
                  if(participant) handleApplyPenalty(participant.id, 'yellow');
                  setSelectedMessageForActions(null); 
                }}
              >
                <Ban className="mr-2 h-4 w-4 text-yellow-500" /> Gelbe Karte (2 Min)
              </Button>
              <Button 
                className="w-full justify-start" 
                variant="ghost" 
                onClick={() => { 
                  const participant = participants.find(p => p.userId === selectedMessageForActions.senderUserId);
                  if(participant) handleApplyPenalty(participant.id, 'red');
                  setSelectedMessageForActions(null); 
                }}
              >
                <Ban className="mr-2 h-4 w-4 text-red-500" /> Rote Karte (3 Min)
              </Button>
            </div>

            {/* Meldungen verwerfen */}
            {selectedMessageForActions.reportedBy && selectedMessageForActions.reportedBy.length > 0 && (
              <>
                <Separator />
                <div className="p-4">
                  <h4 className="font-medium text-sm mb-3 text-red-600">Meldungen verwerfen:</h4>
                  <div className="space-y-2">
                    {selectedMessageForActions.reportedBy.map((report: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-950/20 rounded border border-red-200 dark:border-red-800">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{report.userId}</p>
                          <p className="text-xs text-muted-foreground truncate">{report.reason}</p>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            handleDismissReport(selectedMessageForActions.id, report.userId);
                            // Entferne die Meldung aus der lokalen Ansicht
                            const updatedReports = selectedMessageForActions.reportedBy?.filter((r: any) => r.userId !== report.userId) || [];
                            if (updatedReports.length === 0) {
                              setSelectedMessageForActions(null);
                            } else {
                              setSelectedMessageForActions({
                                ...selectedMessageForActions,
                                reportedBy: updatedReports
                              });
                            }
                          }}
                          className="h-8 px-2 text-xs ml-2"
                        >
                          <XIcon className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="p-4 border-t">
              <Button variant="outline" className="w-full" onClick={() => setSelectedMessageForActions(null)}>
                Abbrechen
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog für Teilnehmer-Aktionen */}
      {selectedParticipantForActions && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-background rounded-lg shadow-xl border max-w-xs w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-lg">Aktionen für {selectedParticipantForActions?.displayName}</h3>
              <div className="flex gap-1 mt-2">
                {selectedParticipantForActions.assignedBadges?.includes('admin') && (
                  <Badge variant="destructive" className="text-xs">Admin</Badge>
                )}
                {selectedParticipantForActions.assignedBadges?.includes('moderator') && (
                  <Badge variant="secondary" className="text-xs">Mod</Badge>
                )}
                {selectedParticipantForActions.isMuted && (
                  <Badge variant="outline" className="text-xs">Stumm</Badge>
                )}
              </div>
            </div>
            <div className="p-4 space-y-3">
              {/* Kommunikations-Aktionen */}
              <div className="space-y-2">
                <h4 className="font-medium text-sm text-muted-foreground">Kommunikation</h4>
                
                {/* DM senden */}
                <Button 
                  className="w-full justify-start" 
                  variant="ghost" 
                  onClick={() => { 
                    onClose(); 
                    loadAndMarkDmThread(selectedParticipantForActions.userId); 
                    setSelectedParticipantForActions(null); 
                  }}
                >
                  <Send className="mr-2 h-4 w-4" /> DM senden
                </Button>

                {/* Alle Nachrichten anzeigen */}
                <Button 
                  className="w-full justify-start" 
                  variant="ghost" 
                  onClick={() => { 
                    handleShowParticipantMessages(selectedParticipantForActions);
                    setSelectedParticipantForActions(null);
                  }}
                >
                  <MessageSquare className="mr-2 h-4 w-4" /> Alle Nachrichten anzeigen
                </Button>
              </div>

              <Separator />

              {/* Moderations-Aktionen */}
              <div className="space-y-2">
                <h4 className="font-medium text-sm text-muted-foreground">Moderation</h4>
                
                {/* Stummschalten/Entstummen */}
                <Button 
                  className="w-full justify-start" 
                  variant="ghost" 
                  onClick={() => { 
                    handleToggleMute(selectedParticipantForActions.id); 
                    setSelectedParticipantForActions(null); 
                  }}
                >
                  <Volume2 className="mr-2 h-4 w-4" /> 
                  {selectedParticipantForActions.isMuted ? "Entstummen" : "Stummschalten"}
                </Button>

                {/* Strafe aufheben, wenn aktiv */}
                {selectedParticipantForActions.activePenalty && (
                  <Button 
                    className="w-full justify-start" 
                    variant="ghost" 
                    onClick={async () => { 
                      try {
                        const participantRef = doc(db, "sessions", sessionId, "participants", selectedParticipantForActions.id);
                        await updateDoc(participantRef, {
                          activePenalty: null,
                          isMuted: false,
                          updatedAt: serverTimestamp()
                        });
                        toast({ title: "Strafe aufgehoben", description: `Strafe für ${selectedParticipantForActions.displayName} wurde aufgehoben.` });
                        setSelectedParticipantForActions(null);
                      } catch (error: any) {
                        toast({ variant: "destructive", title: "Fehler", description: "Strafe konnte nicht aufgehoben werden." });
                      }
                    }}
                  >
                    <Check className="mr-2 h-4 w-4 text-green-500" /> Strafe aufheben
                  </Button>
                )}

                {/* Strafen vergeben */}
                <Button 
                  className="w-full justify-start" 
                  variant="ghost" 
                  onClick={() => { 
                    handleApplyPenalty(selectedParticipantForActions.id, 'yellow'); 
                    setSelectedParticipantForActions(null); 
                  }}
                >
                  <Ban className="mr-2 h-4 w-4 text-yellow-500" /> Gelbe Karte (2 Min)
                </Button>
                <Button 
                  className="w-full justify-start" 
                  variant="ghost" 
                  onClick={() => { 
                    handleApplyPenalty(selectedParticipantForActions.id, 'red'); 
                    setSelectedParticipantForActions(null); 
                  }}
                >
                  <Ban className="mr-2 h-4 w-4 text-red-500" /> Rote Karte (3 Min)
                </Button>
              </div>

              {/* Admin-Funktionen */}
              {currentUserBadges?.includes('admin') && selectedParticipantForActions.userId !== userId && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm text-muted-foreground">Admin-Aktionen</h4>
                    
                    {/* Moderator-Badge verwalten */}
                    {!selectedParticipantForActions.assignedBadges?.includes('moderator') ? (
                      <Button 
                        className="w-full justify-start" 
                        variant="ghost" 
                        onClick={() => { 
                          handleAssignBadge(selectedParticipantForActions.id, 'moderator'); 
                          setSelectedParticipantForActions(null); 
                        }}
                      >
                        <ShieldCheck className="mr-2 h-4 w-4 text-blue-500" /> Moderator machen
                      </Button>
                    ) : (
                      <Button 
                        className="w-full justify-start" 
                        variant="ghost" 
                        onClick={() => { 
                          handleRemoveBadge(selectedParticipantForActions.id, 'moderator'); 
                          setSelectedParticipantForActions(null); 
                        }}
                      >
                        <ShieldCheck className="mr-2 h-4 w-4 text-gray-500" /> Moderator entfernen
                      </Button>
                    )}

                    {/* Admin-Badge verwalten */}
                    {!selectedParticipantForActions.assignedBadges?.includes('admin') && (
                      <Button 
                        className="w-full justify-start" 
                        variant="ghost" 
                        onClick={() => { 
                          handleAssignBadge(selectedParticipantForActions.id, 'admin'); 
                          setSelectedParticipantForActions(null); 
                        }}
                      >
                        <UserCog className="mr-2 h-4 w-4 text-red-500" /> Admin machen
                      </Button>
                    )}

                    {/* Teilnehmer entfernen */}
                    <Button 
                      className="w-full justify-start" 
                      variant="ghost" 
                      onClick={() => { 
                        if (confirm(`${selectedParticipantForActions.displayName} wirklich entfernen?`)) {
                          handleRemoveParticipant(selectedParticipantForActions.id); 
                          setSelectedParticipantForActions(null); 
                        }
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4 text-red-500" /> Teilnehmer entfernen
                    </Button>
                  </div>
                </>
              )}
            </div>
            <div className="p-4 border-t">
              <Button variant="outline" className="w-full" onClick={() => setSelectedParticipantForActions(null)}>
                Abbrechen
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 