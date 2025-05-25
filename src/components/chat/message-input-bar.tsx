"use client";

import React, { memo, type FormEvent, type ChangeEvent, type RefObject } from 'react';
import NextImage from 'next/image';
import Image from 'next/image';
import { emojiCategories } from '@/lib/config';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Paperclip, Send, Smile, Mic, XCircle, ImageIcon as ImageIconLucide, Trash2, PauseCircle, AlertTriangle, VolumeX, CornerDownLeft, X, PaperclipIcon, SmileIcon, Loader2, Ban, MicIcon, Pencil, ShieldCheck, Square, Plus } from "lucide-react"; // Changed ImageIcon to ImageIconLucide
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { DisplayMessage } from "@/lib/types";
import { useIsMobile } from '@/hooks/use-mobile';
import { EmojiPicker } from '@/components/chat/emoji-picker';

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

// Optimierte Vergleichsfunktion für React.memo
const areEqual = (prevProps: MessageInputBarProps, nextProps: MessageInputBarProps) => {
  // Vergleiche nur die wichtigsten Props, die ein Re-Render rechtfertigen
  return (
    prevProps.newMessage === nextProps.newMessage &&
    prevProps.isSendingMessage === nextProps.isSendingMessage &&
    prevProps.selectedImageFile === nextProps.selectedImageFile &&
    prevProps.imagePreviewUrl === nextProps.imagePreviewUrl &&
    prevProps.imageUploadProgress === nextProps.imageUploadProgress &&
    prevProps.canTryToSend === nextProps.canTryToSend &&
    prevProps.cooldownRemainingSeconds === nextProps.cooldownRemainingSeconds &&
    prevProps.sessionStatus === nextProps.sessionStatus &&
    prevProps.isMuted === nextProps.isMuted &&
    prevProps.isAdminView === nextProps.isAdminView &&
    prevProps.replyingTo?.id === nextProps.replyingTo?.id &&
    prevProps.quotingMessage?.id === nextProps.quotingMessage?.id &&
    prevProps.showEmojiPicker === nextProps.showEmojiPicker &&
    prevProps.currentUserBadges?.length === nextProps.currentUserBadges?.length &&
    prevProps.isRecording === nextProps.isRecording &&
    prevProps.recordingDuration === nextProps.recordingDuration &&
    prevProps.recordedAudioBlob === nextProps.recordedAudioBlob &&
    prevProps.audioPreviewUrl === nextProps.audioPreviewUrl &&
    prevProps.isUploadingAudio === nextProps.isUploadingAudio &&
    prevProps.audioUploadProgress === nextProps.audioUploadProgress
  );
};

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

  // Debug-Log entfernt für bessere Performance
  // console.log("MessageInputBar rerendered due to prop change or parent rerender. New message:", newMessage, "Is sending:", isSendingMessage);
  const { toast } = useToast(); // Initialize toast
  const isMobile = useIsMobile();
  const [showMobileAttachments, setShowMobileAttachments] = React.useState(false);

  // Optimierung: useCallback für message change handler
  const handleMessageChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
  }, [setNewMessage]);

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

  // Mobile-optimized button classes
  const mobileButtonClasses = isMobile 
    ? "h-11 w-11 min-h-[44px] min-w-[44px] touch-manipulation" // iOS minimum touch target
    : "h-9 w-9";

  const inputClasses = isMobile
    ? "text-base min-h-[44px] text-[16px] rounded-2xl" // Prevents zoom on iOS
    : "text-base";

  return (
    <div className={cn(
      "border-t bg-background relative",
      isAdminView ? "border-t-0 p-3 md:p-4" : "p-3 md:p-4",
      isMobile && "pb-safe-area-inset-bottom"
    )}>
      {/* Reply UI - Mobile Optimized */}
      {replyingTo && (
        <div className={cn(
          "mb-3 p-3 border rounded-xl bg-muted/50 text-sm text-muted-foreground flex justify-between items-start",
          isMobile && "rounded-2xl p-4"
        )}>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-primary mb-1">
              Antwort auf {replyingTo.senderName}
            </p>
            <p className="text-muted-foreground truncate">
              "{replyingTo.content}"
            </p>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleCancelReply} 
            className={cn("flex-shrink-0 ml-2", isMobile ? "h-8 w-8" : "h-6 w-6 p-0")}
          >
            <XCircle className={cn(isMobile ? "h-5 w-5" : "h-4 w-4")} />
          </Button>
        </div>
      )}

      {/* Quote UI - Mobile Optimized */}
      {quotingMessage && (
        <div className={cn(
          "mb-3 p-3 border rounded-xl bg-muted/50 text-sm text-muted-foreground flex justify-between items-start",
          isMobile && "rounded-2xl p-4"
        )}>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-primary mb-1">
              Zitiert {quotingMessage.senderName}
            </p>
            <p className="text-muted-foreground text-xs">
              Bearbeiten Sie das Zitat und Ihre Nachricht.
            </p>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleCancelQuote} 
            className={cn("flex-shrink-0 ml-2", isMobile ? "h-8 w-8" : "h-6 w-6 p-0")}
          >
            <XCircle className={cn(isMobile ? "h-5 w-5" : "h-4 w-4")} />
          </Button>
        </div>
      )}

      {/* Image Preview - Mobile Optimized */}
      {imagePreviewUrl && (
        <div className={cn("relative group mb-3", isMobile ? "max-w-full" : "max-w-xs")}>
          <Image 
            src={imagePreviewUrl} 
            alt="Bildvorschau" 
            width={isMobile ? 200 : 120} 
            height={isMobile ? 200 : 120} 
            className="rounded-lg shadow-sm object-cover" 
          />
          <Button
            variant="destructive"
            size="icon"
            className={cn(
              "absolute top-2 right-2 opacity-70 group-hover:opacity-100",
              isMobile ? "h-8 w-8" : "h-6 w-6"
            )}
            onClick={handleRemoveSelectedImage}
            disabled={isSendingMessage}
          >
            <X className={cn(isMobile ? "h-5 w-5" : "h-4 w-4")} />
          </Button>
          {imageUploadProgress !== null && imageUploadProgress < 100 && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
              <Loader2 className="h-6 w-6 animate-spin text-white"/>
            </div>
          )}
        </div>
      )}

      {/* Voice Recording UI - Mobile Optimized */}
      {isRecording && (
        <div className={cn(
          "bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg mb-3",
          isMobile ? "p-4 rounded-2xl" : "p-3"
        )}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse" />
              <span className={cn(
                "font-medium text-red-700 dark:text-red-400",
                isMobile && "text-lg"
              )}>
                Aufnahme läuft
              </span>
            </div>
            <span className={cn(
              "font-mono text-red-600 dark:text-red-400",
              isMobile ? "text-xl" : "text-sm"
            )}>
              {formatDuration(recordingDuration)}
            </span>
          </div>
          
          <div className="flex gap-3">
            <Button 
              variant="destructive" 
              onClick={cancelVoiceRecording}
              className={cn(
                isMobile ? "h-12 px-6 text-base flex-1" : "h-8 px-3 text-xs"
              )}
            >
              <X className={cn(isMobile ? "h-5 w-5 mr-2" : "h-3.5 w-3.5 mr-1")} />
              Abbrechen
            </Button>
            <Button 
              variant="default" 
              onClick={stopVoiceRecording}
              className={cn(
                "bg-red-600 hover:bg-red-700",
                isMobile ? "h-12 px-6 text-base flex-1" : "h-8 px-3 text-xs"
              )}
            >
              <Square className={cn(isMobile ? "h-5 w-5 mr-2" : "h-3.5 w-3.5 mr-1")} />
              Stopp
            </Button>
          </div>
        </div>
      )}

      {/* Audio Preview - Mobile Optimized */}
      {recordedAudioBlob && audioPreviewUrl && !isRecording && (
        <div className={cn(
          "bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg mb-3",
          isMobile ? "p-4 rounded-2xl" : "p-3"
        )}>
          <div className="flex items-center gap-3 mb-3">
            <Mic className={cn("text-blue-600 dark:text-blue-400", isMobile ? "h-5 w-5" : "h-4 w-4")} />
            <span className={cn(
              "font-medium text-blue-700 dark:text-blue-400",
              isMobile && "text-lg"
            )}>
              Sprachnachricht bereit
            </span>
            <span className="text-sm text-blue-600 dark:text-blue-400">
              ({formatDuration(recordingDuration)})
            </span>
          </div>
          
          <audio 
            controls 
            className="w-full mb-3" 
            style={{ height: isMobile ? '48px' : '32px' }}
          >
            <source src={audioPreviewUrl} type="audio/webm" />
            Ihr Browser unterstützt keine Audio-Wiedergabe.
          </audio>
          
          {isUploadingAudio && audioUploadProgress !== null && (
            <div className="w-full bg-blue-100 dark:bg-blue-900 rounded-full h-2 mb-3">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                style={{width: `${audioUploadProgress}%`}}
              ></div>
            </div>
          )}
          
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={cancelVoiceRecording}
              disabled={isUploadingAudio}
              className={cn(
                isMobile ? "h-12 px-6 text-base flex-1" : "h-8 px-3 text-xs"
              )}
            >
              <X className={cn(isMobile ? "h-5 w-5 mr-2" : "h-3.5 w-3.5 mr-1")} />
              Verwerfen
            </Button>
            <Button 
              variant="default" 
              onClick={handleSendVoiceMessage}
              disabled={isUploadingAudio}
              className={cn(
                isMobile ? "h-12 px-6 text-base flex-1" : "h-8 px-3 text-xs"
              )}
            >
              {isUploadingAudio ? (
                <>
                  <Loader2 className={cn(isMobile ? "h-5 w-5 mr-2 animate-spin" : "h-3.5 w-3.5 mr-1 animate-spin")} />
                  Hochladen...
                </>
              ) : (
                <>
                  <Send className={cn(isMobile ? "h-5 w-5 mr-2" : "h-3.5 w-3.5 mr-1")} />
                  Senden
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Status Alerts - Mobile Optimized */}
      {!canTryToSend && sessionStatus !== "active" && !isAdminView && (
        <Alert variant={sessionStatus === "ended" ? "destructive" : "default"} className={cn("mb-3", isMobile && "rounded-2xl")}>
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
        <Alert variant="destructive" className={cn("mb-3", isMobile && "rounded-2xl")}>
          <VolumeX className="h-4 w-4" />
          <AlertTitle>Stummgeschaltet</AlertTitle>
          <AlertDescription>Sie wurden vom Administrator stummgeschaltet.</AlertDescription>
        </Alert>
      )}

      {/* Moderation Reminder - Mobile Optimized */}
      {(currentUserBadges?.includes('admin') || currentUserBadges?.includes('moderator')) && (
        <div className="w-full flex justify-center mb-3">
          <div className={cn(
            "text-xs p-2 px-4 rounded-full flex items-center gap-2 bg-muted/70 text-muted-foreground",
            currentUserBadges?.includes('admin') ? "border-pink-500 border" : "border-yellow-400 border",
            isMobile && "text-sm p-3 px-5 rounded-2xl"
          )}>
            <ShieldCheck className={cn(isMobile ? "h-4 w-4" : "h-3.5 w-3.5")} />
            <span className={isMobile ? "hidden" : ""}>Du hast Moderationsrechte: Du kannst{' '}
              <span className="font-medium">
                {currentUserBadges?.includes('admin') ? 'Nachrichten verbergen & Strafen verteilen' : 'Nachrichten verbergen'}
              </span>
            </span>
            <span className={isMobile ? "" : "hidden"}>Moderator</span>
          </div>
        </div>
      )}

      {/* Main Input Form - Mobile Optimized */}
      <form className="flex items-end gap-2" onSubmit={handleSendMessage}>
        <input type="file" ref={fileInputRef} onChange={handleImageFileSelected} accept="image/*" className="hidden" disabled={!showAttachmentAndEmojiButtons} />
        
        {/* Mobile: Attachment Button */}
        {isMobile && showAttachmentAndEmojiButtons && (
          <Button 
            type="button"
            variant="outline" 
            size="icon" 
            className={cn(mobileButtonClasses, "flex-shrink-0")} 
            onClick={() => setShowMobileAttachments(!showMobileAttachments)}
          >
            <Plus className="h-5 w-5" />
          </Button>
        )}

        {/* Desktop: Individual Buttons */}
        {!isMobile && showAttachmentAndEmojiButtons && (
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

            <div className="relative">
              <Button 
                variant="outline" 
                size="icon" 
                className="shrink-0" 
                title="Emoji einfügen"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              >
                <Smile className="h-5 w-5" />
              </Button>
              
              {/* Neue EmojiPicker-Komponente für Desktop */}
              <EmojiPicker
                isOpen={showEmojiPicker}
                onClose={() => setShowEmojiPicker(false)}
                onEmojiSelect={handleEmojiSelect}
                position="top"
                align="start"
                isMobile={false}
              />
            </div>
          </>
        )}

        {/* Input Field */}
        <Input
          ref={inputRef}
          id="message-input"
          type="text"
          placeholder={inputPlaceholderText}
          className={cn("flex-1", inputClasses)}
          value={newMessage}
          onChange={handleMessageChange}
          disabled={isInputDisabled}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && isMobile) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
        />

        {/* Send/Voice Button */}
        <Button 
          type="submit" 
          size="icon" 
          className={cn("flex-shrink-0 bg-primary hover:bg-primary/90", mobileButtonClasses)} 
          disabled={isSendButtonDisabled} 
          aria-label="Senden"
        >
          {isSendingMessage && selectedImageFile && imageUploadProgress !== null && imageUploadProgress < 100 ? 
            <ImageIconLucide className="h-5 w-5 animate-pulse" /> : 
            <Send className="h-5 w-5" />
          }
        </Button>
      </form>

      {/* Mobile Attachments Popover */}
      {isMobile && showMobileAttachments && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-card rounded-2xl shadow-lg border p-3 z-10">
          <div className="grid grid-cols-3 gap-3">
            <Button
              variant="outline"
              className="h-20 flex flex-col gap-2 touch-manipulation"
              onClick={() => {
                fileInputRef.current?.click();
                setShowMobileAttachments(false);
              }}
            >
              <ImageIconLucide className="h-6 w-6" />
              <span className="text-xs">Bild</span>
            </Button>
            
            <Button
              variant="outline"
              className={cn(
                "h-20 flex flex-col gap-2 touch-manipulation",
                isRecording ? "bg-red-100 border-red-500 text-red-600" : ""
              )}
              onClick={() => {
                if (isRecording) {
                  stopVoiceRecording();
                } else {
                  startVoiceRecording();
                }
                setShowMobileAttachments(false);
              }}
              disabled={recordedAudioBlob !== null}
            >
              {isRecording ? (
                <Square className="h-6 w-6" />
              ) : (
                <Mic className="h-6 w-6" />
              )}
              <span className="text-xs">
                {isRecording ? "Stopp" : "Sprache"}
              </span>
            </Button>
            
            <Button
              variant="outline"
              className="h-20 flex flex-col gap-2 touch-manipulation"
              onClick={() => {
                setShowEmojiPicker(true);
                setShowMobileAttachments(false);
              }}
            >
              <Smile className="h-6 w-6" />
              <span className="text-xs">Emoji</span>
            </Button>
          </div>
        </div>
      )}

      {/* Mobile Emoji Picker - Full Screen */}
      {isMobile && (
        <EmojiPicker
          isOpen={showEmojiPicker}
          onClose={() => setShowEmojiPicker(false)}
          onEmojiSelect={handleEmojiSelect}
          isMobile={true}
        />
      )}

      {/* Cooldown Messages */}
      {cooldownRemainingSeconds > 0 && canTryToSend && !isAdminView && sessionStatus === "active" && !isMuted && (
        <p className={cn("text-xs text-muted-foreground mt-2 text-right", isMobile && "text-sm")}>
          Nächste Nachricht in {cooldownRemainingSeconds}s
        </p>
      )}
      {messageCooldownSeconds && messageCooldownSeconds > 0 && cooldownRemainingSeconds <= 0 && canTryToSend && !isAdminView && sessionStatus === "active" && !isMuted && (
        <p className={cn("text-xs text-muted-foreground mt-2 text-right", isMobile && "text-sm")}>
          Nachrichten Cooldown: {messageCooldownSeconds}s
        </p>
      )}
    </div>
  );
}, areEqual); // Verwende die optimierte Vergleichsfunktion

MessageInputBar.displayName = "MessageInputBar";

export { MessageInputBar };
