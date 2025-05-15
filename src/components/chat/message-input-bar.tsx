
"use client";

import type { ChangeEvent, FormEvent, RefObject } from 'react';
import { memo } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Paperclip, Send, Smile, Mic, XCircle, ImageIcon, Trash2, PauseCircle, AlertTriangle, VolumeX } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import Image from 'next/image';
import type { DisplayMessage } from '@/lib/types';
import type { emojiCategories as EmojiCategoriesType } from '@/lib/config';
import { cn } from '@/lib/utils';

interface MessageInputBarProps {
  newMessage: string;
  setNewMessage: (value: string) => void;
  handleSendMessage: (event?: FormEvent) => Promise<void>;
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
  sessionStatus: "active" | "paused" | "ended" | null;
  isMuted: boolean;
  isAdminView: boolean;
  replyingTo: DisplayMessage | null;
  handleCancelReply: () => void;
  quotingMessage: DisplayMessage | null;
  handleCancelQuote: () => void;
  showEmojiPicker: boolean;
  setShowEmojiPicker: (value: boolean) => void;
  handleEmojiSelect: (emoji: string) => void; 
  emojiCategories: typeof EmojiCategoriesType;
  messageCooldownSeconds: number | undefined;
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
}: MessageInputBarProps) {

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
  const isInputDisabled = !canTryToSend || isSendingMessage || (isAdminView && !sessionData && sessionStatus !== 'ended'); // sessionData check was missing
  const showAttachmentAndEmojiButtons = canTryToSend && !isSendingMessage && !(isAdminView && !sessionData && sessionStatus !== 'ended');


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
      {imagePreviewUrl && selectedImageFile && (
        <div className="mb-2 p-2 border rounded-md bg-muted/50 flex items-center gap-2">
          <div className="relative w-[60px] h-[60px] rounded-md overflow-hidden">
            <Image src={imagePreviewUrl} alt="Vorschau" fill style={{objectFit:"cover"}} data-ai-hint="image preview"/>
          </div>
          <div className="flex-1 text-sm text-muted-foreground">
            <p className="font-semibold">{selectedImageFile.name}</p>
            <p>{(selectedImageFile.size / 1024).toFixed(1)} KB</p>
          </div>
          <Button variant="ghost" size="icon" onClick={handleRemoveSelectedImage} className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10" disabled={isSendingMessage}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}
      {isSendingMessage && selectedImageFile && imageUploadProgress !== null && imageUploadProgress < 100 && (
        <div className="mt-1 mb-2">
          <Progress value={imageUploadProgress} className="h-2 w-full" />
          <p className="text-xs text-muted-foreground text-right mt-0.5">{imageUploadProgress.toFixed(0)}% hochgeladen</p>
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
      <form className="flex items-center gap-2 md:gap-3" onSubmit={handleSendMessage}>
        <input type="file" ref={fileInputRef} onChange={handleImageFileSelected} accept="image/*" className="hidden" disabled={!showAttachmentAndEmojiButtons} />
        
        { (!isAdminView || (isAdminView && showAttachmentAndEmojiButtons)) && (
          <>
            <Button variant="ghost" size="icon" type="button" className="shrink-0" aria-label="Anhang" disabled={!showAttachmentAndEmojiButtons} onClick={() => fileInputRef.current?.click()}>
              <Paperclip className="h-5 w-5" />
            </Button>

            <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" type="button" className="shrink-0" aria-label="Emoji" disabled={!showAttachmentAndEmojiButtons}>
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
                              className="text-xl p-0 h-8 w-8" // Smaller emoji text in picker
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
        { (!isAdminView || (isAdminView && showAttachmentAndEmojiButtons)) && (
            <Button variant="ghost" size="icon" type="button" className="shrink-0" aria-label="Spracheingabe" disabled={!showAttachmentAndEmojiButtons} onClick={() => alert("Spracheingabe (noch nicht implementiert)")}>
            <Mic className="h-5 w-5" />
            </Button>
        )}
        <Button type="submit" size="icon" className="shrink-0 bg-primary hover:bg-primary/90" disabled={isSendButtonDisabled} aria-label="Senden">
          {isSendingMessage && selectedImageFile && imageUploadProgress !== null && imageUploadProgress < 100 ? <ImageIcon className="h-5 w-5 animate-pulse" /> : <Send className="h-5 w-5" />}
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
