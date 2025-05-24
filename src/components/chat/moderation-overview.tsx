"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { 
  Crown, 
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
  Check
} from "lucide-react";
import NextImage from 'next/image';
import { collection, query, where, orderBy, limit, getDocs, doc, updateDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { DisplayMessage, Participant } from "@/lib/types";

interface ModerationOverviewProps {
  showModeratorOverviewDialog: boolean;
  setShowModeratorOverviewDialog: (show: boolean) => void;
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
  sessionData: any;
  userId?: string | null;
  closeAllModalsExceptDMs: () => void;
}

export function ModerationOverview({
  showModeratorOverviewDialog,
  setShowModeratorOverviewDialog,
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
  closeAllModalsExceptDMs
}: ModerationOverviewProps) {
  const [currentModerationTab, setCurrentModerationTab] = useState<string>("reported");
  const [activePenalties, setActivePenalties] = useState<Participant[]>([]);
  const [hiddenMessages, setHiddenMessages] = useState<DisplayMessage[]>([]);
  const [isLoadingHiddenMessages, setIsLoadingHiddenMessages] = useState(false);
  const [penaltyTimers, setPenaltyTimers] = useState<{ [key: string]: string }>({});

  // Funktion zum Berechnen der verbleibenden Zeit
  const calculateRemainingTime = useCallback((penaltyStartTime: any, durationMinutes: number) => {
    if (!penaltyStartTime) return "00:00";
    
    const startTime = penaltyStartTime.toDate ? penaltyStartTime.toDate() : new Date(penaltyStartTime);
    const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);
    const now = new Date();
    const remaining = endTime.getTime() - now.getTime();
    
    if (remaining <= 0) return "00:00";
    
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  // Effect für den Countdown-Timer
  useEffect(() => {
    if (!showModeratorOverviewDialog || currentModerationTab !== 'penalties') return;
    
    const interval = setInterval(() => {
      const newTimers: { [key: string]: string } = {};
      
      activePenalties.forEach(participant => {
        if (participant.activePenalty) {
          const duration = participant.activePenalty.type === 'yellow' ? 2 : 3;
          newTimers[participant.id] = calculateRemainingTime(participant.activePenalty.startTime, duration);
        }
      });
      
      setPenaltyTimers(newTimers);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [showModeratorOverviewDialog, currentModerationTab, activePenalties, calculateRemainingTime]);

  // Funktion zum Laden der aktiven Strafen
  const loadActivePenalties = useCallback(async () => {
    if (!sessionId || !hasModPermissions) return;

    try {
      setActivePenalties(participants.filter(p => p.activePenalty));
    } catch (error) {
      console.error("Fehler beim Laden der aktiven Strafen:", error);
    }
  }, [sessionId, hasModPermissions]);

  // Funktion zum Laden der versteckten Nachrichten
  const loadHiddenMessages = useCallback(async () => {
    if (!sessionId || !hasModPermissions) return;

    setIsLoadingHiddenMessages(true);

    try {
      const messagesRef = collection(db, "sessions", sessionId, "messages");
      const hiddenQuery = query(messagesRef, 
        where("isBlurred", "==", true), 
        orderBy("timestamp", "desc"),
        limit(50)
      );
      
      const hiddenDocsSnap = await getDocs(hiddenQuery);
      const hiddenMsgsData: DisplayMessage[] = [];
      
      hiddenDocsSnap.forEach((doc) => {
        const data = doc.data();
        const timestamp = data.timestamp as Timestamp;
        hiddenMsgsData.push({
          ...data,
          id: doc.id,
          isOwn: false,
          timestampDisplay: timestamp ? timestamp.toDate().toLocaleString() : "Unbekannt",
          reactions: data.reactions || {},
          replyToMessageId: data.replyToMessageId || undefined,
          replyToMessageSenderName: data.replyToMessageSenderName || undefined,
          replyToMessageContentSnippet: data.replyToMessageContentSnippet || undefined
        } as DisplayMessage);
      });
      
      setHiddenMessages(hiddenMsgsData);
    } catch (error) {
      console.error("Fehler beim Laden der versteckten Nachrichten:", error);
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Versteckte Nachrichten konnten nicht geladen werden."
      });
    } finally {
      setIsLoadingHiddenMessages(false);
    }
  }, [sessionId, hasModPermissions, toast]);

  // Effect zum Laden der aktiven Strafen und versteckten Nachrichten
  useEffect(() => {
    if (showModeratorOverviewDialog && hasModPermissions) {
      loadActivePenalties();
      loadHiddenMessages();
    }
  }, [showModeratorOverviewDialog, hasModPermissions, loadActivePenalties, loadHiddenMessages]);

  // Live-Update Effect für participants ohne Neuladen der ganzen Übersicht
  useEffect(() => {
    if (showModeratorOverviewDialog && hasModPermissions) {
      // Automatisches Update der aktivePenalties wenn sich participants ändern
      setActivePenalties(participants.filter(p => p.activePenalty));
    }
  }, [participants, showModeratorOverviewDialog, hasModPermissions]);

  // Effect zum Neuladen bei Tab-Wechsel
  useEffect(() => {
    if (showModeratorOverviewDialog && hasModPermissions) {
      switch (currentModerationTab) {
        case 'reported':
          loadReportedMessages();
          break;
        case 'penalties':
          loadActivePenalties();
          break;
        case 'hidden':
          loadHiddenMessages();
          break;
      }
    }
  }, [currentModerationTab, showModeratorOverviewDialog, hasModPermissions, loadReportedMessages, loadActivePenalties, loadHiddenMessages]);

  if (!showModeratorOverviewDialog || !hasModPermissions) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowModeratorOverviewDialog(false)}>
      <Card className="w-full max-w-7xl shadow-2xl relative bg-card text-card-foreground max-h-[95vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="pb-3 flex flex-row items-center justify-between border-b">
          <CardTitle className="text-2xl flex items-center">
            <Crown className="h-7 w-7 mr-3 text-pink-500" /> Moderationsübersicht
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={() => setShowModeratorOverviewDialog(false)} className="h-9 w-9">
            <XIcon className="h-6 w-6" />
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Tabs value={currentModerationTab} onValueChange={setCurrentModerationTab} className="w-full">
            <div className="flex items-center justify-between px-6 py-3 border-b bg-muted/30">
              <TabsList className="grid grid-cols-6 h-12">
                <TabsTrigger value="reported" className="relative text-sm font-medium">
                  Meldungen
                  {reportedMessages.length > 0 && (
                    <Badge variant="destructive" className="ml-2 h-5 min-w-[20px] text-xs">
                      {reportedMessages.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="participants" className="text-sm font-medium">Teilnehmer</TabsTrigger>
                <TabsTrigger value="moderators" className="text-sm font-medium">Moderatoren</TabsTrigger>
                <TabsTrigger value="penalties" className="relative text-sm font-medium">
                  Strafen
                  {activePenalties.length > 0 && (
                    <Badge variant="secondary" className="ml-2 h-5 min-w-[20px] text-xs">
                      {activePenalties.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="hidden" className="relative text-sm font-medium">
                  <span className="flex items-center gap-2">
                    Ausgeblendete Nachrichten
                    {hiddenMessages.length > 0 && (
                      <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 text-xs font-medium bg-secondary text-secondary-foreground rounded-full">
                        {hiddenMessages.length}
                      </span>
                    )}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="blocking" className="text-sm font-medium">Blockiert</TabsTrigger>
              </TabsList>
              
              {/* Navigation Buttons */}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => {
                  const tabs = ["reported", "participants", "moderators", "penalties", "hidden", "blocking"];
                  const currentIndex = tabs.indexOf(currentModerationTab);
                  if (currentIndex > 0) setCurrentModerationTab(tabs[currentIndex - 1]);
                }} className="h-10 px-3">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => {
                  const tabs = ["reported", "participants", "moderators", "penalties", "hidden", "blocking"];
                  const currentIndex = tabs.indexOf(currentModerationTab);
                  if (currentIndex < tabs.length - 1) setCurrentModerationTab(tabs[currentIndex + 1]);
                }} className="h-10 px-3">
                  <ArrowLeft className="h-5 w-5 rotate-180" />
                </Button>
              </div>
            </div>

            {/* Tab: Gemeldete Nachrichten */}
            <TabsContent value="reported" className="mt-0">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold">Gemeldete Nachrichten ({reportedMessages.length})</h3>
                  <Button 
                    variant="outline" 
                    size="default" 
                    onClick={loadReportedMessages}
                    disabled={isLoadingReportedMessages}
                  >
                    {isLoadingReportedMessages ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
                    Aktualisieren
                  </Button>
                </div>
                <ScrollArea className="h-[65vh]">
                  {isLoadingReportedMessages ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin mr-3" />
                      <span className="text-lg">Lade gemeldete Nachrichten...</span>
                    </div>
                  ) : reportedMessages.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <AlertTriangle className="h-16 w-16 mx-auto mb-6 opacity-50" />
                      <p className="text-lg">Keine gemeldeten Nachrichten vorhanden.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {reportedMessages.map(msg => (
                        <Card key={msg.id} className="border-l-4 border-l-red-500 hover:shadow-lg transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex gap-4 mb-3">
                              {/* Nachrichteninhalt - Flexible Breite */}
                              <div className="flex-1 min-w-0 space-y-3">
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-8 w-8">
                                    <AvatarFallback className={cn(getParticipantColorClasses(msg.senderUserId).bg, getParticipantColorClasses(msg.senderUserId).text, "text-sm font-bold")}>
                                      {msg.avatarFallback}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="font-semibold text-base">{msg.senderName}</span>
                                  <span className="text-sm text-muted-foreground">{msg.timestampDisplay}</span>
                                </div>
                                
                                {/* Nachrichtentext in visuell abgehobener Box */}
                                <div className="p-4 rounded-lg bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 border-2 border-slate-200 dark:border-slate-700 shadow-inner ring-1 ring-slate-300/50 dark:ring-slate-600/50">
                                  {msg.imageUrl && (
                                    <div className="mb-3 relative aspect-video max-w-md">
                                      <NextImage src={msg.imageUrl} alt="Nachrichtenbild" layout="fill" objectFit="contain" className="rounded-lg shadow-sm" />
                                    </div>
                                  )}
                                  <div className="relative">
                                    <div className="absolute -left-2 top-0 w-1 h-full bg-blue-500 rounded-full"></div>
                                    <p className="text-base leading-relaxed whitespace-pre-wrap pl-4 font-medium text-slate-900 dark:text-slate-100">{msg.content}</p>
                                  </div>
                                  {msg.isBlurred && (
                                    <div className="mt-3 pt-3 border-t border-slate-300 dark:border-slate-600">
                                      <Badge variant="secondary" className="text-sm bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">
                                        <Eye className="h-4 w-4 mr-2" />
                                        Für Nutzer ausgeblendet
                                      </Badge>
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              {/* Button-Leiste - Fixe Breite rechts, alle Buttons in einer horizontalen Reihe */}
                              <div className="flex gap-1.5 items-start shrink-0 flex-wrap sm:flex-nowrap">
                                <Button 
                                  variant="outline"
                                  size="icon"
                                  onClick={() => {
                                    setShowModeratorOverviewDialog(false);
                                    loadAndMarkDmThread(msg.senderUserId!)
                                  }}
                                  className="h-9 w-9 text-foreground hover:bg-muted border-neutral-400"
                                  title="Direktnachricht senden"
                                  disabled={!msg.senderUserId}
                                >
                                  <Send className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => handleShowParticipantMessages(participants.find(p => p.userId === msg.senderUserId)!)}
                                  className="h-9 w-9 text-blue-600 border-blue-500 hover:bg-blue-500/10"
                                  disabled={!participants.find(p => p.userId === msg.senderUserId)}
                                  title="Alle Nachrichten anzeigen"
                                >
                                  <MessageSquare className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant={msg.isBlurred ? "default" : "outline"}
                                  size="icon"
                                  onClick={() => toggleBlurMessage(msg.id)}
                                  disabled={isTogglingBlur === msg.id}
                                  className={cn("h-9 w-9", 
                                    msg.isBlurred 
                                      ? "bg-orange-500 hover:bg-orange-600 text-white border-orange-500" 
                                      : "border-orange-500 text-orange-600 hover:bg-orange-500/10"
                                  )}
                                  title={msg.isBlurred ? "Nachricht einblenden" : "Nachricht ausblenden"}
                                >
                                  {isTogglingBlur === msg.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Eye className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => {
                                    closeAllModalsExceptDMs();
                                    setTimeout(() => {
                                      const messageElements = document.querySelectorAll('.message-container');
                                      for (const element of messageElements) {
                                        const messageId = element.getAttribute('data-message-id');
                                        if (messageId === msg.id) {
                                          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                          element.classList.add('ring-2', 'ring-cyan-500', 'ring-offset-2');
                                          setTimeout(() => {
                                            element.classList.remove('ring-2', 'ring-cyan-500', 'ring-offset-2');
                                          }, 2000);
                                          break;
                                        }
                                      }
                                    }, 300);
                                  }}
                                  className="h-9 w-9 text-cyan-600 border-cyan-500 hover:bg-cyan-500/10"
                                  title="Zur Nachricht im Chat springen"
                                >
                                  <ArrowLeft className="h-4 w-4 rotate-180" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => {
                                    const participant = participants.find(p => p.userId === msg.senderUserId);
                                    if (participant) handleApplyPenalty(participant.id, 'yellow');
                                  }}
                                  className="h-9 w-9 border-yellow-500 text-yellow-600 hover:bg-yellow-500/10"
                                  title="Gelbe Karte (2 Min Timeout)"
                                >
                                  <Ban className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => {
                                    const participant = participants.find(p => p.userId === msg.senderUserId);
                                    if (participant) handleApplyPenalty(participant.id, 'red');
                                  }}
                                  className="h-9 w-9 border-red-500 text-red-600 hover:bg-red-500/10"
                                  title="Rote Karte (3 Min Timeout)"
                                >
                                  <Ban className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            
                            {/* Meldegründe unterhalb */}
                            <div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-3 space-y-2">
                              <p className="text-sm font-medium text-red-700 dark:text-red-400">Meldungsgründe:</p>
                              {msg.reportedBy?.map((report: any, index: number) => (
                                <div key={index} className="flex items-center justify-between">
                                  <div className="text-sm">
                                    <span className="font-medium">{report.userId}:</span> 
                                    <span className="ml-2 text-muted-foreground">{report.reason}</span>
                                  </div>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => handleDismissReport(msg.id, report.userId)}
                                    className="h-7 px-3 text-xs"
                                    title={`Meldung von ${report.userId} verwerfen`}
                                  >
                                    <XIcon className="h-3.5 w-3.5 mr-1" /> Verwerfen
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </TabsContent>

            {/* Tab: Aktive Strafen */}
            <TabsContent value="penalties" className="mt-0">
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Aktive Strafen ({activePenalties.length})</h3>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={loadActivePenalties}
                  >
                    Aktualisieren
                  </Button>
                </div>
                <ScrollArea className="h-[60vh]">
                  {activePenalties.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>Keine aktiven Strafen vorhanden.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {activePenalties.map(participant => (
                        <Card key={participant.id} className={cn("border-l-4", 
                          participant.activePenalty?.type === 'red' ? "border-l-red-500" : "border-l-yellow-500"
                        )}>
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback className={cn(getParticipantColorClasses(participant.userId).bg, getParticipantColorClasses(participant.userId).text)}>
                                    {participant.avatarFallback}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm">{participant.displayName}</span>
                                    <Badge variant={participant.activePenalty?.type === 'red' ? "destructive" : "default"} 
                                           className={cn("text-xs", participant.activePenalty?.type === 'yellow' && "bg-yellow-500 text-black")}>
                                      <Ban className="h-3 w-3 mr-1" />
                                      {participant.activePenalty?.type === 'yellow' ? 'Gelbe' : 'Rote'} Karte
                                    </Badge>
                                    {penaltyTimers[participant.id] && (
                                      <Badge variant="outline" className="text-xs font-mono">
                                        {penaltyTimers[participant.id]}
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground">{participant.activePenalty?.description}</p>
                                </div>
                              </div>
                              <div className="flex gap-1">
                                <Button variant="outline" size="sm" onClick={() => {
                                  setShowModeratorOverviewDialog(false);
                                  loadAndMarkDmThread(participant.userId)
                                }} className="h-8 px-2 text-xs" title="Direktnachricht senden">
                                  <Send className="h-3.5 w-3.5" />
                                </Button>
                                {currentUserBadges?.includes('admin') && (
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
                                    className="h-8 px-2 text-xs"
                                    title="Strafe aufheben"
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                  </Button>
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
            </TabsContent>

            {/* Tab: Moderatoren */}
            <TabsContent value="moderators" className="mt-0">
              <div className="p-4">
                <h3 className="text-lg font-semibold mb-4">Moderatoren und Admins</h3>
                <ScrollArea className="h-[60vh]">
                  <div className="space-y-2">
                    {participants.filter(p => p.assignedBadges?.includes('admin') || p.assignedBadges?.includes('moderator')).map(moderator => (
                      <Card key={moderator.id} className="border-l-4 border-l-yellow-500">
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className={cn(getParticipantColorClasses(moderator.userId).bg, getParticipantColorClasses(moderator.userId).text, "text-xs")}>
                                  {moderator.avatarFallback}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">{moderator.displayName}</span>
                                  {moderator.assignedBadges?.includes('admin') && (
                                    <Badge className="bg-pink-500 text-white text-xs">
                                      <Crown className="h-3 w-3 mr-1" />
                                      Admin
                                    </Badge>
                                  )}
                                  {moderator.assignedBadges?.includes('moderator') && (
                                    <Badge className="bg-yellow-500 text-black text-xs">
                                      <ShieldCheck className="h-3 w-3 mr-1" />
                                      Mod
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground">{moderator.realName} • {moderator.role}</p>
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <Button variant="outline" size="sm" onClick={() => {
                                setShowModeratorOverviewDialog(false);
                                loadAndMarkDmThread(moderator.userId)
                              }} className="h-8 px-2 text-xs" title="Direktnachricht senden">
                                <Send className="h-3.5 w-3.5 mr-1" /> Kontakt
                              </Button>
                              {currentUserBadges?.includes('admin') && moderator.userId !== userId && (
                                <>
                                  {moderator.assignedBadges?.includes('moderator') && !moderator.assignedBadges?.includes('admin') && (
                                    <Button variant="outline" size="sm" onClick={() => handleRemoveBadge(moderator.id, 'moderator')} className="h-8 px-2 text-xs">
                                      Entfernen
                                    </Button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </TabsContent>

            {/* Tab: Blockierungen */}
            <TabsContent value="blocking" className="mt-0">
              <div className="p-4">
                <h3 className="text-lg font-semibold mb-4">Aktive Blockierungen</h3>
                <ScrollArea className="h-[60vh]">
                  <div className="space-y-2">
                    {participants.filter(p => p.blockedUserIds && p.blockedUserIds.length > 0).map(participant => (
                      <Card key={participant.id}>
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className={cn(getParticipantColorClasses(participant.userId).bg, getParticipantColorClasses(participant.userId).text, "text-xs")}>
                                  {participant.avatarFallback}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium text-sm">{participant.displayName}</span>
                            </div>
                            <Badge variant="secondary" className="text-xs">{participant.blockedUserIds?.length || 0} blockiert</Badge>
                          </div>
                          <div className="space-y-1">
                            {participant.blockedUserIds?.map(blockedUserId => {
                              const blockedUser = participants.find(p => p.userId === blockedUserId);
                              return (
                                <div key={blockedUserId} className="flex items-center justify-between p-2 bg-muted/50 rounded text-xs">
                                  <div className="flex items-center gap-2">
                                    <Avatar className="h-5 w-5">
                                      <AvatarFallback className="text-[10px]">
                                        {blockedUser?.avatarFallback || '?'}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span>{blockedUser?.displayName || blockedUserId}</span>
                                  </div>
                                  {currentUserBadges?.includes('admin') && (
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      onClick={() => {
                                        toast({ title: "Info", description: "Admin-Blockierung-Aufhebung noch nicht implementiert." });
                                      }}
                                      className="h-6 px-2 text-[10px]"
                                    >
                                      Aufheben
                                    </Button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {participants.filter(p => p.blockedUserIds && p.blockedUserIds.length > 0).length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <p>Keine aktiven Blockierungen vorhanden.</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </TabsContent>

            {/* Tab: Versteckte Nachrichten */}
            <TabsContent value="hidden" className="mt-0">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold">Ausgeblendete Nachrichten ({hiddenMessages.length})</h3>
                  <Button 
                    variant="outline" 
                    size="default"
                    onClick={loadHiddenMessages}
                    disabled={isLoadingHiddenMessages}
                  >
                    {isLoadingHiddenMessages ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
                    Aktualisieren
                  </Button>
                </div>
                <ScrollArea className="h-[65vh]">
                  {isLoadingHiddenMessages ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin mr-3" />
                      <span className="text-lg">Lade ausgeblendete Nachrichten...</span>
                    </div>
                  ) : hiddenMessages.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <p className="text-lg">Keine ausgeblendeten Nachrichten vorhanden.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {hiddenMessages.map(msg => (
                        <Card key={msg.id} className="border-l-4 border-l-orange-500 hover:shadow-lg transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex gap-4">
                              <div className="flex-1 space-y-3">
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-8 w-8">
                                    <AvatarFallback className={cn(getParticipantColorClasses(msg.senderUserId).bg, getParticipantColorClasses(msg.senderUserId).text, "text-sm font-bold")}>
                                      {msg.avatarFallback}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="font-semibold text-base">{msg.senderName}</span>
                                  <span className="text-sm text-muted-foreground">{msg.timestampDisplay}</span>
                                  <Badge variant="secondary" className="text-sm">
                                    <Eye className="h-4 w-4 mr-2" />
                                    Versteckt
                                  </Badge>
                                </div>
                                
                                <div className="p-4 rounded-lg bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 border-2 border-slate-200 dark:border-slate-700 shadow-inner ring-1 ring-slate-300/50 dark:ring-slate-600/50">
                                  {msg.imageUrl && (
                                    <div className="mb-3 relative aspect-video max-w-md">
                                      <NextImage src={msg.imageUrl} alt="Nachrichtenbild" layout="fill" objectFit="contain" className="rounded-lg shadow-sm" />
                                    </div>
                                  )}
                                  <div className="relative">
                                    <div className="absolute -left-2 top-0 w-1 h-full bg-blue-500 rounded-full"></div>
                                    <p className="text-base leading-relaxed whitespace-pre-wrap pl-4 font-medium text-slate-900 dark:text-slate-100">{msg.content}</p>
                                  </div>
                                  {msg.isBlurred && (
                                    <div className="mt-3 pt-3 border-t border-slate-300 dark:border-slate-600">
                                      <Badge variant="secondary" className="text-sm bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">
                                        <Eye className="h-4 w-4 mr-2" />
                                        Für Nutzer ausgeblendet
                                      </Badge>
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex flex-col gap-2">
                                <Button 
                                  variant="default" 
                                  size="sm"
                                  onClick={() => toggleBlurMessage(msg.id)}
                                  disabled={isTogglingBlur === msg.id}
                                  className="h-8 text-xs bg-orange-500 hover:bg-orange-600 border-orange-500"
                                  title="Nachricht einblenden"
                                >
                                  {isTogglingBlur === msg.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                                  ) : (
                                    <Eye className="h-3.5 w-3.5 mr-1" />
                                  )}
                                  Einblenden
                                </Button>
                                <Button 
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    closeAllModalsExceptDMs();
                                    setTimeout(() => {
                                      const messageElements = document.querySelectorAll('.message-container');
                                      for (const element of messageElements) {
                                        const messageId = element.getAttribute('data-message-id');
                                        if (messageId === msg.id) {
                                          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                          element.classList.add('ring-2', 'ring-cyan-500', 'ring-offset-2');
                                          setTimeout(() => {
                                            element.classList.remove('ring-2', 'ring-cyan-500', 'ring-offset-2');
                                          }, 2000);
                                          break;
                                        }
                                      }
                                    }, 300);
                                  }}
                                  className="h-8 text-xs border-cyan-500 text-cyan-600 hover:bg-cyan-50"
                                  title="Zur Nachricht im Chat springen"
                                >
                                  <ArrowLeft className="h-3.5 w-3.5 rotate-180 mr-1" />
                                  Kontext
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </TabsContent>

            {/* Tab: Teilnehmer-Verwaltung mit allen Lucide Icons */}
            <TabsContent value="participants" className="mt-0">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold">Teilnehmer-Verwaltung ({participants.length})</h3>
                  {currentUserBadges?.includes('admin') && (
                    <div className="flex gap-3">
                      <Button 
                        variant="outline" 
                        size="default" 
                        onClick={handleClearAllBlurs}
                        disabled={isAdjustingCooldown}
                      >
                        {isAdjustingCooldown ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
                        Alle Blurs aufheben
                      </Button>
                      <Button 
                        variant="outline" 
                        size="default" 
                        onClick={() => {
                          const newCooldown = prompt("Neuer Cooldown in Sekunden:", sessionData?.messageCooldownSeconds?.toString() || "0");
                          if (newCooldown !== null) {
                            const seconds = parseInt(newCooldown);
                            if (!isNaN(seconds) && seconds >= 0) {
                              handleAdjustCooldown(seconds);
                            }
                          }
                        }}
                        disabled={isAdjustingCooldown}
                      >
                        Cooldown anpassen
                      </Button>
                    </div>
                  )}
                </div>
                <ScrollArea className="h-[65vh]">
                  <div className="space-y-3">
                    {participants.map(participant => (
                      <Card key={participant.id} className={cn("border-l-4 hover:shadow-lg transition-shadow", 
                        participant.assignedBadges?.includes('admin') ? "border-l-pink-500" :
                        participant.assignedBadges?.includes('moderator') ? "border-l-yellow-500" :
                        participant.isMuted ? "border-l-gray-500" : "border-l-green-500"
                      )}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <Avatar className="h-10 w-10">
                                <AvatarFallback className={cn(getParticipantColorClasses(participant.userId).bg, getParticipantColorClasses(participant.userId).text, "text-sm font-bold")}>
                                  {participant.avatarFallback}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="flex items-center gap-3">
                                  <span className="font-semibold text-base">{participant.displayName}</span>
                                  {participant.assignedBadges?.includes('admin') && (
                                    <Badge className="bg-pink-500 text-white text-sm px-3 py-1">
                                      <Crown className="h-4 w-4 mr-1.5" />
                                      Admin
                                    </Badge>
                                  )}
                                  {participant.assignedBadges?.includes('moderator') && (
                                    <Badge className="bg-yellow-500 text-black text-sm px-3 py-1">
                                      <ShieldCheck className="h-4 w-4 mr-1.5" />
                                      Mod
                                    </Badge>
                                  )}
                                  {participant.isMuted && <Badge variant="secondary" className="text-sm px-3 py-1">Stumm</Badge>}
                                  {participant.activePenalty && (
                                    <Badge variant={participant.activePenalty.type === 'red' ? "destructive" : "default"} 
                                           className={cn("text-sm px-3 py-1", participant.activePenalty.type === 'yellow' && "bg-yellow-500 text-black")}>
                                      <Ban className="h-4 w-4 mr-1.5" />
                                      {participant.activePenalty.type === 'yellow' ? 'Gelb' : 'Rot'}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">{participant.realName} • {participant.role}</p>
                              </div>
                            </div>
                            <div className="flex gap-2 flex-wrap">
                              <Button 
                                variant="outline" 
                                size="icon" 
                                onClick={() => {
                                  setShowModeratorOverviewDialog(false);
                                  loadAndMarkDmThread(participant.userId)
                                }}
                                className="h-9 w-9 text-foreground hover:bg-muted border-neutral-400"
                                title="Direktnachricht senden"
                                disabled={!participant.userId}
                              >
                                <Send className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="outline" 
                                size="icon" 
                                onClick={() => handleShowParticipantMessages(participant)} 
                                className="h-9 w-9 text-blue-600 border-blue-500 hover:bg-blue-500/10"
                                title="Alle Nachrichten anzeigen"
                              >
                                <MessageSquare className="h-4 w-4" />
                              </Button>
                              {hasModPermissions && participant.userId !== userId && (
                                <>
                                  <Button 
                                    variant="outline" 
                                    size="icon" 
                                    onClick={() => handleToggleMute(participant.id)}
                                    className={cn("h-9 w-9", 
                                      participant.isMuted 
                                        ? "border-green-500 text-green-500 hover:bg-green-500/10" 
                                        : "border-red-500 text-red-600 hover:bg-red-500/10"
                                    )}
                                    title={participant.isMuted ? "Stummschaltung aufheben" : "Stummschalten"}
                                  >
                                    <Volume2 className="h-4 w-4" />
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    size="icon" 
                                    onClick={() => handleApplyPenalty(participant.id, 'yellow')} 
                                    className="h-9 w-9 border-yellow-500 text-yellow-600 hover:bg-yellow-500/10"
                                    title="Gelbe Karte"
                                  >
                                    <Ban className="h-4 w-4" />
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    size="icon" 
                                    onClick={() => handleApplyPenalty(participant.id, 'red')} 
                                    className="h-9 w-9 border-red-500 text-red-600 hover:bg-red-500/10"
                                    title="Rote Karte"
                                  >
                                    <Ban className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              {currentUserBadges?.includes('admin') && participant.userId !== userId && (
                                <>
                                  {!participant.assignedBadges?.includes('moderator') && (
                                    <Button 
                                      variant="outline" 
                                      size="icon" 
                                      onClick={() => handleAssignBadge(participant.id, 'moderator')} 
                                      className="h-9 w-9 text-purple-600 border-purple-500 hover:bg-purple-500/10"
                                      title="Moderator-Badge vergeben"
                                    >
                                      <ShieldCheck className="h-4 w-4" />
                                    </Button>
                                  )}
                                  {participant.assignedBadges?.includes('moderator') && (
                                    <Button 
                                      variant="outline" 
                                      size="icon" 
                                      onClick={() => handleRemoveBadge(participant.id, 'moderator')} 
                                      className="h-9 w-9 text-purple-600 border-purple-500 hover:bg-purple-500/10"
                                      title="Moderator-Badge entfernen"
                                    >
                                      <XIcon className="h-4 w-4" />
                                    </Button>
                                  )}
                                  {!participant.assignedBadges?.includes('admin') && (
                                    <Button 
                                      variant="outline" 
                                      size="icon" 
                                      onClick={() => handleAssignBadge(participant.id, 'admin')} 
                                      className="h-9 w-9 text-pink-600 border-pink-500 hover:bg-pink-500/10"
                                      title="Admin-Badge vergeben"
                                    >
                                      <Crown className="h-4 w-4" />
                                    </Button>
                                  )}
                                  {participant.activePenalty && (
                                    <Button 
                                      variant="outline" 
                                      size="icon" 
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
                                      className="h-9 w-9 text-green-600 border-green-500 hover:bg-green-500/10"
                                      title="Strafe aufheben"
                                    >
                                      <Check className="h-4 w-4" />
                                    </Button>
                                  )}
                                  {!participant.assignedBadges?.includes('admin') && (
                                    <Button 
                                      variant="outline" 
                                      size="icon" 
                                      onClick={() => handleRemoveParticipant(participant.id)} 
                                      className="h-9 w-9 text-destructive hover:bg-destructive/10"
                                      title="Teilnehmer entfernen"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </TabsContent>
            
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
} 