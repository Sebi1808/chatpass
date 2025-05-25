"use client";

import React, { memo, type FormEvent, type ChangeEvent, type RefObject } from 'react';
import NextImage from 'next/image';
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Paperclip, Send, Smile, Mic, XCircle, ImageIcon as ImageIconLucide, Trash2, PauseCircle, AlertTriangle, VolumeX, CornerDownLeft, X, PaperclipIcon, SmileIcon, Loader2, Ban, MicIcon, Pencil, ShieldCheck, Square, Plus } from "lucide-react"; // Changed ImageIcon to ImageIconLucide
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { DisplayMessage } from "@/lib/types";
import { useIsMobile } from '@/hooks/use-mobile';
import { EnhancedEmojiPicker } from "@/components/ui/enhanced-emoji-picker";
import { MarkdownInfo } from "@/components/ui/markdown-info";

interface MessageInputBarProps {
  newMessage: string;
  setNewMessage: (value: string) => void;
  handleSendMessage: (event?: FormEvent<HTMLFormElement>) => Promise<void>;
  inputRef: RefObject<HTMLTextAreaElement>;
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
  const handleMessageChange = React.useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
  }, [setNewMessage]);

  // Auto-resize Textarea (nur für Mobile)
  React.useEffect(() => {
    if (isMobile && inputRef.current) {
      const textarea = inputRef.current;
      // Reset height to get the correct scrollHeight
      textarea.style.height = 'auto';
      
      // Calculate number of lines based on scrollHeight
      const lineHeight = 24; // Approximate line height
      const maxLines = 5;
      const lines = Math.min(Math.ceil(textarea.scrollHeight / lineHeight), maxLines);
      
      // Set height based on content, max 5 lines
      textarea.style.height = `${Math.min(textarea.scrollHeight, lineHeight * maxLines)}px`;
    }
  }, [newMessage, isMobile]);

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
      "border-t bg-muted/40 dark:bg-background relative",
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
          "mb-3 p-3 border-l-4 border-primary bg-muted/30 text-sm flex justify-between items-start",
          isMobile && "p-4 rounded-r-2xl"
        )}>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-primary mb-1">
              Zitiere: {quotingMessage.senderName}
            </p>
            <p className="text-muted-foreground truncate">
              "{quotingMessage.content}"
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
      {selectedImageFile && imagePreviewUrl && (
        <div className={cn(
          "mb-3 p-3 border rounded-xl bg-muted/30",
          isMobile && "p-4 rounded-2xl"
        )}>
          <div className="flex items-start gap-3">
            <div className="relative">
              <NextImage
                src={imagePreviewUrl}
                alt="Preview"
                width={isMobile ? 80 : 60}
                height={isMobile ? 80 : 60}
                className="rounded-lg object-cover"
              />
              {imageUploadProgress !== null && (
                <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                  <div className="text-white text-xs font-medium">
                    {imageUploadProgress.toFixed(0)}%
                  </div>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{selectedImageFile.name}</p>
              <p className="text-xs text-muted-foreground">
                {(selectedImageFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
              {imageUploadProgress !== null && (
                <Progress value={imageUploadProgress} className="mt-2 h-2" />
              )}
            </div>
            {!isSendingMessage && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleRemoveSelectedImage}
                className={cn("flex-shrink-0", isMobile ? "h-8 w-8" : "h-6 w-6 p-0")}
              >
                <Trash2 className={cn(isMobile ? "h-5 w-5" : "h-4 w-4")} />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Voice Recording UI - Mobile Optimized */}
      {isRecording && (
        <div className={cn(
          "mb-3 p-3 border rounded-xl bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800",
          isMobile && "p-4 rounded-2xl"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-red-700 dark:text-red-300">
                  Aufnahme läuft
                </span>
              </div>
              <span className="text-sm text-red-600 dark:text-red-400 font-mono">
                {formatDuration(recordingDuration)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={stopVoiceRecording}
                className="text-red-600 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/30"
              >
                <Square className={cn(isMobile ? "h-5 w-5" : "h-4 w-4")} />
                <span className="ml-1">Stopp</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={cancelVoiceRecording}
                className="text-red-600 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/30"
              >
                <X className={cn(isMobile ? "h-5 w-5" : "h-4 w-4")} />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Voice Message Preview - Mobile Optimized */}
      {recordedAudioBlob && audioPreviewUrl && !isRecording && (
        <div className={cn(
          "mb-3 p-3 border rounded-xl bg-muted/30",
          isMobile && "p-4 rounded-2xl"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Mic className={cn("text-muted-foreground", isMobile ? "h-5 w-5" : "h-4 w-4")} />
                <span className="text-sm font-medium">Sprachnachricht</span>
              </div>
              <audio 
                controls 
                src={audioPreviewUrl} 
                className="h-8 max-w-40"
                preload="metadata"
              >
                Ihr Browser unterstützt keine Audio-Wiedergabe.
              </audio>
            </div>
            <div className="flex items-center gap-2">
              {isUploadingAudio && audioUploadProgress !== null && (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-xs text-muted-foreground">
                    {audioUploadProgress.toFixed(0)}%
                  </span>
                </div>
              )}
              {!isUploadingAudio && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSendVoiceMessage}
                    disabled={isSendingMessage}
                    className="text-green-600 hover:text-green-700 hover:bg-green-100 dark:hover:bg-green-900/30"
                  >
                    <Send className={cn(isMobile ? "h-5 w-5" : "h-4 w-4")} />
                    <span className="ml-1">Senden</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={cancelVoiceRecording}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Trash2 className={cn(isMobile ? "h-5 w-5" : "h-4 w-4")} />
                  </Button>
                </>
              )}
            </div>
          </div>
          {isUploadingAudio && audioUploadProgress !== null && (
            <Progress value={audioUploadProgress} className="mt-2 h-2" />
          )}
        </div>
      )}

      {/* Admin/Moderator Hinweis */}
      {currentUserBadges && currentUserBadges.length > 0 && !isAdminView && (
        <div className={cn("mb-3 flex items-center gap-2", isMobile && "rounded-2xl")}>
          <Badge 
            variant="secondary" 
            className={cn(
              "text-xs px-2 py-1 flex items-center gap-1.5",
              currentUserBadges.includes('admin') 
                ? "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800" 
                : "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-950/30 dark:text-yellow-300 dark:border-yellow-800"
            )}
          >
            <ShieldCheck className="h-3 w-3" />
            {currentUserBadges.includes('admin') ? 'Admin' : 'Moderator'}
          </Badge>
          <span className="text-xs text-muted-foreground">
            Moderationsrechte aktiv - Klicken Sie auf Nachrichten/Teilnehmer für Optionen
          </span>
        </div>
      )}

      {/* Cooldown & Status Warning - Mobile Optimized */}
      {(cooldownRemainingSeconds > 0 || sessionStatus === "paused" || sessionStatus === "ended" || isMuted) && !isAdminView && (
        <Alert className={cn("mb-3", isMobile && "rounded-2xl")}>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>
            {cooldownRemainingSeconds > 0 && "Nachrichtenbegrenzung"}
            {sessionStatus === "paused" && "Simulation pausiert"}
            {sessionStatus === "ended" && "Simulation beendet"}
            {isMuted && "Stummgeschaltet"}
          </AlertTitle>
          <AlertDescription>
            {cooldownRemainingSeconds > 0 && 
              `Sie können in ${cooldownRemainingSeconds} Sekunden wieder schreiben. ${messageCooldownSeconds ? `Cooldown: ${messageCooldownSeconds}s` : ''}`
            }
            {sessionStatus === "paused" && "Die Simulation wurde pausiert. Warten Sie auf die Fortsetzung."}
            {sessionStatus === "ended" && "Die Simulation ist beendet. Keine weiteren Nachrichten möglich."}
            {isMuted && "Sie wurden von einem Moderator stummgeschaltet."}
          </AlertDescription>
        </Alert>
      )}

      {/* Main Input Area */}
      <form onSubmit={handleSendMessage} className="space-y-0">
        <div className="flex items-end gap-2">
          {/* Mobile Attachment Button */}
          {isMobile && showAttachmentAndEmojiButtons && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(mobileButtonClasses, "flex-shrink-0")}
              onClick={() => setShowMobileAttachments(!showMobileAttachments)}
            >
              <Plus className="h-5 w-5" />
            </Button>
          )}

          {/* Desktop Attachment Buttons */}
          {!isMobile && showAttachmentAndEmojiButtons && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(mobileButtonClasses, "flex-shrink-0")}
                onClick={() => fileInputRef.current?.click()}
                title="Bild anhängen"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(mobileButtonClasses, "flex-shrink-0")}
                onClick={startVoiceRecording}
                disabled={recordedAudioBlob !== null}
                title="Sprachnachricht aufnehmen"
              >
                <Mic className="h-4 w-4" />
              </Button>

              {/* Emoji Button - LINKS der Eingabe */}
              <div className="relative">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(mobileButtonClasses, "flex-shrink-0")}
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  title="Emoji hinzufügen"
                  data-emoji-trigger="true"
                >
                  <Smile className="h-4 w-4" />
                </Button>
                
                {/* Desktop Emoji-Picker */}
                <EnhancedEmojiPicker
                  isOpen={showEmojiPicker}
                  onClose={() => setShowEmojiPicker(false)}
                  onEmojiSelect={handleEmojiSelect}
                  variant="input"
                  position="top"
                  align="start"
                />
              </div>
            </>
          )}

          {/* Text Input */}
          <div className="flex-1 min-w-0 relative">
            <Textarea
              ref={inputRef}
              placeholder={inputPlaceholderText}
              value={newMessage}
              onChange={handleMessageChange}
              disabled={isInputDisabled}
              rows={1}
              className={cn(
                "resize-none border-2 transition-colors pr-8", // Mehr Platz rechts für Markdown-Info
                "focus:border-primary focus:ring-0",
                isMobile ? "text-base min-h-[44px] text-[16px] rounded-2xl" : "text-base",
                isInputDisabled && "opacity-50"
              )}
              style={{
                minHeight: isMobile ? '44px' : '40px',
                maxHeight: isMobile ? '120px' : '40px', // 5 lines * 24px = 120px für Mobile
                overflowY: isMobile ? 'auto' : 'hidden'
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (isMobile) {
                    // Mobile: Enter = neue Zeile, Shift+Enter = senden (oder nur senden via Button)
                    if (e.shiftKey) {
                      e.preventDefault();
                      if (!isSendButtonDisabled) {
                        handleSendMessage();
                      }
                    }
                    // Normale Enter-Taste: neue Zeile (default Verhalten)
                  } else {
                    // Desktop: Enter = senden, Shift+Enter = neue Zeile
                    if (!e.shiftKey) {
                      e.preventDefault();
                      if (!isSendButtonDisabled) {
                        handleSendMessage();
                      }
                    }
                    // Shift+Enter: neue Zeile (default Verhalten)
                  }
                }
              }}
            />
            
            {/* Markdown Info - dezent in der rechten unteren Ecke */}
            <div className="absolute bottom-1 right-1">
              <MarkdownInfo size="sm" />
            </div>
          </div>

          {/* Mobile Emoji Button - RECHTS nur für Mobile */}
          {isMobile && showAttachmentAndEmojiButtons && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(mobileButtonClasses, "flex-shrink-0")}
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              title="Emoji hinzufügen"
              data-emoji-trigger="true"
            >
              <Smile className="h-4 w-4" />
            </Button>
          )}

          {/* Send Button */}
          <Button
            type="submit"
            disabled={isSendButtonDisabled}
            className={cn(
              mobileButtonClasses,
              "flex-shrink-0 transition-all duration-200",
              isSendButtonDisabled 
                ? "opacity-50 cursor-not-allowed" 
                : "hover:scale-105 active:scale-95"
            )}
          >
            {isSendingMessage ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </form>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageFileSelected}
        className="hidden"
      />

      {/* Mobile Attachments Menu */}
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
              data-emoji-trigger="true"
            >
              <Smile className="h-6 w-6" />
              <span className="text-xs">Emoji</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}, areEqual);

MessageInputBar.displayName = "MessageInputBar";

export { MessageInputBar };
