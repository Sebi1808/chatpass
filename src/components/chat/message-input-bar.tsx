"use client";

import React, { memo, type FormEvent, type ChangeEvent, type RefObject } from 'react';
import NextImage from 'next/image';
import Image from 'next/image';
import { emojiCategories } from '@/lib/config';
import { PopoverContent, PopoverTrigger, Popover } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Paperclip, Send, Smile, Mic, XCircle, ImageIcon as ImageIconLucide, Trash2, PauseCircle, AlertTriangle, VolumeX, CornerDownLeft, X, PaperclipIcon, SmileIcon, Loader2, Ban, MicIcon, Pencil, ShieldCheck, Square } from "lucide-react"; // Changed ImageIcon to ImageIconLucide
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { DisplayMessage } from "@/lib/types";

interface MessageInputBarProps {
  newMessage: string;
  setNewMessage: (value: string) => void;
  handleSendMessage: (event?: FormEvent<HTMLFormElement>) => Promise<void>;
  inputRef: RefObject<HTMLInputElement>;
  fileInputRef: RefObject<HTMLInputElement>;
  handleImageFileSelected: (event: ChangeEvent<HTMLInputElement>) => void;
  selectedImageFile: File | null;
  imagePreviewUrl: string | null;
  handleRemoveSelectedImage: () => void;
  isSendingMessage: boolean;
  imageUploadProgress: number | null;
  canTryToSend: boolean;
  cooldownRemainingSeconds: number;
  sessionStatus: "open" | "pending" | "active" | "paused" | "ended" | null;
  isMuted: boolean;
  isAdminView: boolean;
  replyingTo: DisplayMessage | null;
  handleCancelReply: () => void;
  quotingMessage: DisplayMessage | null;
  handleCancelQuote: () => void;
  showEmojiPicker: boolean;
  setShowEmojiPicker: (value: boolean) => void;
  handleEmojiSelect: (emoji: string) => void; 
  emojiCategories: typeof emojiCategories;
  messageCooldownSeconds: number | undefined;
  currentUserBadges?: ('admin' | 'moderator')[];
  isRecording: boolean;
  recordingDuration: number;
  recordedAudioBlob: Blob | null;
  audioPreviewUrl: string | null;
  isUploadingAudio: boolean;
  audioUploadProgress: number | null;
  startVoiceRecording: () => void;
  stopVoiceRecording: () => void;
  cancelVoiceRecording: () => void;
  handleSendVoiceMessage: () => void;
}

const MessageInputBar = memo(function MessageInputBar({
  newMessage,
  setNewMessage,
  handleSendMessage,
  inputRef,
  fileInputRef,
  handleImageFileSelected,
  selectedImageFile,
  imagePreviewUrl,
  handleRemoveSelectedImage,
  isSendingMessage,
  imageUploadProgress,
  canTryToSend,
  cooldownRemainingSeconds,
  sessionStatus,
  isMuted,
  isAdminView,
  replyingTo,
  handleCancelReply,
  quotingMessage,
  handleCancelQuote,
  showEmojiPicker,
  setShowEmojiPicker,
  handleEmojiSelect, 
  emojiCategories,
  messageCooldownSeconds,
  currentUserBadges,
  isRecording,
  recordingDuration,
  recordedAudioBlob,
  audioPreviewUrl,
  isUploadingAudio,
  audioUploadProgress,
  startVoiceRecording,
  stopVoiceRecording,
  cancelVoiceRecording,
  handleSendVoiceMessage,
}: MessageInputBarProps) {

  const { toast } = useToast(); // Initialize toast

  // Format recording duration helper function
  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  let inputPlaceholderText = "Nachricht eingeben...";
  if (isSendingMessage && selectedImageFile && imageUploadProgress !== null) {
    inputPlaceholderText = `Bild wird hochgeladen (${imageUploadProgress.toFixed(0)}%)...`;
  } else if (isSendingMessage) {
    inputPlaceholderText = "Nachricht wird gesendet...";
  } else if (sessionStatus === "ended") {
    inputPlaceholderText = "Simulation beendet";
  } else if (sessionStatus === "paused" && !isAdminView) {
    inputPlaceholderText = "Simulation pausiert";
  } else if (isMuted && !isAdminView) {
    inputPlaceholderText = "Sie sind stummgeschaltet";
  } else if (cooldownRemainingSeconds > 0 && !isAdminView) {
    inputPlaceholderText = `Nächste Nachricht in ${cooldownRemainingSeconds}s...`;
  }

  const isSendButtonDisabled = !canTryToSend || (!newMessage.trim() && !selectedImageFile) || isSendingMessage;
  const isInputDisabled = !canTryToSend || isSendingMessage;
  const showAttachmentAndEmojiButtons = canTryToSend && !isSendingMessage;

  return (
    <div className={cn("border-t bg-background p-3 md:p-4 relative", isAdminView ? "border-t-0" : "")}>
      {replyingTo && (
        <div className="mb-2 p-2 border rounded-md bg-muted/50 text-sm text-muted-foreground flex justify-between items-center">
          <div>
            Antwort auf <span className="font-semibold">{replyingTo.senderName}</span>: <span className="italic">&quot;{replyingTo.content.substring(0, 30)}...&quot;</span>
          </div>
          <Button variant="ghost" size="icon" onClick={handleCancelReply} className="h-6 w-6 p-0">
            <XCircle className="h-4 w-4" />
          </Button>
        </div>
      )}
      {quotingMessage && (
        <div className="mb-2 p-2 border rounded-md bg-muted/50 text-sm text-muted-foreground flex justify-between items-center">
          <div>
            Zitiert <span className="font-semibold">{quotingMessage.senderName}</span>. Bearbeiten Sie das Zitat und Ihre Nachricht.
          </div>
          <Button variant="ghost" size="icon" onClick={handleCancelQuote} className="h-6 w-6 p-0">
            <XCircle className="h-4 w-4" />
          </Button>
        </div>
      )}
      {/* Image Preview */}
      {imagePreviewUrl && (
        <div className="relative group max-w-xs">
          <Image src={imagePreviewUrl} alt="Bildvorschau" width={120} height={120} className="rounded-lg shadow-sm object-cover" />
          <Button
            variant="destructive"
            size="icon"
            className="absolute top-1 right-1 h-6 w-6 opacity-70 group-hover:opacity-100"
            onClick={handleRemoveSelectedImage}
            disabled={isSendingMessage}
          >
            <X className="h-4 w-4" />
          </Button>
          {imageUploadProgress !== null && imageUploadProgress < 100 && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
              <Loader2 className="h-6 w-6 animate-spin text-white"/>
            </div>
          )}
        </div>
      )}

      {/* Voice Recording UI */}
      {isRecording && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-red-700 dark:text-red-400">Aufnahme läuft</span>
            </div>
            <span className="text-sm font-mono text-red-600 dark:text-red-400">{formatDuration(recordingDuration)}</span>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={cancelVoiceRecording}
              className="h-8 px-3 text-xs"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Abbrechen
            </Button>
            <Button 
              variant="default" 
              size="sm" 
              onClick={stopVoiceRecording}
              className="h-8 px-3 text-xs bg-red-600 hover:bg-red-700"
            >
              <Square className="h-3.5 w-3.5 mr-1" />
              Stopp
            </Button>
          </div>
        </div>
      )}

      {/* Audio Preview */}
      {recordedAudioBlob && audioPreviewUrl && !isRecording && (
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Mic className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-medium text-blue-700 dark:text-blue-400">Sprachnachricht bereit</span>
            <span className="text-sm text-blue-600 dark:text-blue-400">({formatDuration(recordingDuration)})</span>
          </div>
          
          <audio controls className="w-full h-8" style={{height: '32px'}}>
            <source src={audioPreviewUrl} type="audio/webm" />
            Ihr Browser unterstützt keine Audio-Wiedergabe.
          </audio>
          
          {isUploadingAudio && audioUploadProgress !== null && (
            <div className="w-full bg-blue-100 dark:bg-blue-900 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                style={{width: `${audioUploadProgress}%`}}
              ></div>
            </div>
          )}
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={cancelVoiceRecording}
              disabled={isUploadingAudio}
              className="h-8 px-3 text-xs"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Verwerfen
            </Button>
            <Button 
              variant="default" 
              size="sm" 
              onClick={handleSendVoiceMessage}
              disabled={isUploadingAudio}
              className="h-8 px-3 text-xs"
            >
              {isUploadingAudio ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  Hochladen...
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5 mr-1" />
                  Senden
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {!canTryToSend && sessionStatus !== "active" && !isAdminView && (
        <Alert variant={sessionStatus === "ended" ? "destructive" : "default"} className="mb-2">
          {sessionStatus === "paused" ? <PauseCircle className="h-4 w-4" /> : (sessionStatus === "ended" ? <AlertTriangle className="h-4 w-4" /> : null)}
          <AlertTitle>
            {sessionStatus === "ended" ? "Sitzung beendet" : (sessionStatus === "paused" ? "Sitzung pausiert" : "Hinweis")}
          </AlertTitle>
          <AlertDescription>
            {sessionStatus === "ended" ? "Diese Simulation wurde vom Administrator beendet." : "Die Simulation ist aktuell pausiert."}
          </AlertDescription>
        </Alert>
      )}
        {isMuted && !isAdminView && sessionStatus === "active" && (
            <Alert variant="destructive" className="mb-2">
              <VolumeX className="h-4 w-4" />
              <AlertTitle>Stummgeschaltet</AlertTitle>
              <AlertDescription>Sie wurden vom Administrator stummgeschaltet.</AlertDescription>
          </Alert>
      )}
      {/* Moderation Reminder - NEU */}
      {(currentUserBadges?.includes('admin') || currentUserBadges?.includes('moderator')) && (
        <div className="w-full flex justify-center mb-2">
          <div className={cn(
            "text-xs p-1.5 px-3 rounded-full flex items-center gap-1.5 bg-muted/70 text-muted-foreground",
            currentUserBadges?.includes('admin') ? "border-pink-500 border" : "border-yellow-400 border",
          )}>
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Du hast Moderationsrechte: Du kannst{' '}
              <span className="font-medium">
                {currentUserBadges?.includes('admin') ? 'Nachrichten verbergen & Strafen verteilen' : 'Nachrichten verbergen'}
              </span>
            </span>
          </div>
        </div>
      )}
      <form className="flex items-center gap-1 sm:gap-2 md:gap-3" onSubmit={handleSendMessage}>
        <input type="file" ref={fileInputRef} onChange={handleImageFileSelected} accept="image/*" className="hidden" disabled={!showAttachmentAndEmojiButtons} />
        
        {showAttachmentAndEmojiButtons && (
          <>
            <Button variant="outline" size="icon" className="shrink-0" title="Bild anhängen" onClick={() => fileInputRef.current?.click()}>
              <Paperclip className="h-5 w-5" />
            </Button>
            
            <Button 
              variant="outline" 
              size="icon" 
              className={cn("shrink-0", isRecording ? "bg-red-100 border-red-500 text-red-600" : "")} 
              title={isRecording ? "Aufnahme läuft..." : "Sprachnachricht aufnehmen"}
              onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
              disabled={recordedAudioBlob !== null}
            >
              {isRecording ? (
                <Square className="h-5 w-5" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </Button>

            <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="shrink-0" title="Emoji einfügen">
                  <Smile className="h-5 w-5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 mb-1 max-w-[300px] sm:max-w-xs" side="top" align="start">
                <Tabs defaultValue={emojiCategories[0].name} className="w-full">
                  <TabsList className="grid w-full grid-cols-5 h-auto p-1">
                    {emojiCategories.map(category => (
                      <TabsTrigger key={category.name} value={category.name} className="text-lg p-1 h-8" title={category.name}>
                        {category.icon}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {emojiCategories.map(category => (
                    <TabsContent key={category.name} value={category.name} className="mt-0">
                      <ScrollArea className="h-48">
                        <div className="grid grid-cols-8 gap-0.5 p-2">
                          {category.emojis.map(emoji => (
                            <Button
                              key={emoji}
                              variant="ghost"
                              size="icon"
                              className="text-xl p-0 h-8 w-8"
                              onClick={() => handleEmojiSelect(emoji)}
                            >
                              {emoji}
                            </Button>
                          ))}
                        </div>
                      </ScrollArea>
                    </TabsContent>
                  ))}
                </Tabs>
              </PopoverContent>
            </Popover>
          </>
        )}

        <Input
          ref={inputRef}
          id="message-input"
          type="text"
          placeholder={inputPlaceholderText}
          className="flex-1 text-base"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          disabled={isInputDisabled}
        />
        <Button type="submit" size="icon" className="shrink-0 bg-primary hover:bg-primary/90" disabled={isSendButtonDisabled} aria-label="Senden">
          {isSendingMessage && selectedImageFile && imageUploadProgress !== null && imageUploadProgress < 100 ? <ImageIconLucide className="h-5 w-5 animate-pulse" /> : <Send className="h-5 w-5" />}
        </Button>
      </form>
      {cooldownRemainingSeconds > 0 && canTryToSend && !isAdminView && sessionStatus === "active" && !isMuted && (
        <p className="text-xs text-muted-foreground mt-1.5 text-right">Nächste Nachricht in {cooldownRemainingSeconds}s</p>
      )}
      {messageCooldownSeconds && messageCooldownSeconds > 0 && cooldownRemainingSeconds <= 0 && canTryToSend && !isAdminView && sessionStatus === "active" && !isMuted && (
        <p className="text-xs text-muted-foreground mt-1.5 text-right">Nachrichten Cooldown: {messageCooldownSeconds}s</p>
      )}
    </div>
  );
});

MessageInputBar.displayName = "MessageInputBar";

export { MessageInputBar };
