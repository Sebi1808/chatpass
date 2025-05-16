
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowDown, XCircle, Loader2, AlertTriangle, Eye, X as XIcon, Users as UsersIconLucide, Send, Paperclip, Smile, Mic, Crown, Bot as BotIconLucide, ImageIcon as ImageIconLucide, MessageSquare } from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, Suspense, useRef, type FormEvent, type ChangeEvent, useMemo, useCallback } from "react";
import NextImage from 'next/image'; // Alias import
import type { Scenario, DisplayMessage, DisplayParticipant, SessionData, InitialPostConfig, Message as MessageType } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { db, storage } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, Timestamp, doc, getDoc, where, getDocs, updateDoc, runTransaction } from "firebase/firestore";
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { useToast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils';
import { emojiCategories, type ParticipantColor, participantColors } from '@/lib/config';
import { MessageInputBar } from '@/components/chat/message-input-bar';
import { MessageList } from '@/components/chat/message-list';
import { ChatSidebar } from '@/components/chat/chat-sidebar';
import { useSessionData } from "@/hooks/use-session-data";
import { useParticipants } from "@/hooks/use-participants";
import { useMessages } from "@/hooks/use-messages";
import { scenarios as staticScenarios } from '@/lib/scenarios'; 

interface ChatPageUrlParams {
  sessionId: string;
}

interface ChatPageProps {
  params: ChatPageUrlParams;
}

interface ChatPageContentProps {
  sessionId: string;
  initialUserName?: string; // This will be the nickname for display
  initialUserRole?: string;
  initialUserId?: string;
  initialUserAvatarFallback?: string;
  isAdminView?: boolean;
}

const simpleHash = (str: string): number => {
  let hash = 0;
  if (!str || str.length === 0) {
    return hash;
  }
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
};


const LoadingScreen = ({ text = "Chat wird geladen..." }: { text?: string }) => (
  <div className="flex h-screen w-full items-center justify-center bg-background p-4">
    <Card className="max-w-md w-full">
      <CardHeader><CardTitle className="flex items-center"><Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />{text}</CardTitle></CardHeader>
      <CardContent><p className="text-muted-foreground">Einen Moment Geduld, die Simulation wird vorbereitet.</p></CardContent>
    </Card>
  </div>
);

export function ChatPageContent({
  sessionId: sessionIdProp,
  initialUserName: initialNicknameProp, // Renamed for clarity
  initialUserRole: initialUserRoleProp,
  initialUserId: initialUserIdProp,
  initialUserAvatarFallback: initialUserAvatarFallbackProp,
  isAdminView = false
}: ChatPageContentProps) {

  const sessionId = sessionIdProp;
  const { toast } = useToast();
  const router = useRouter();

  // User details state
  const [klarname, setKlarname] = useState<string | null>(null); // Klarname
  const [nickname, setNickname] = useState<string | null>(initialNicknameProp || null); // Nickname
  const [userRole, setUserRole] = useState<string | null>(initialUserRoleProp || null);
  const [userId, setUserId] = useState<string | null>(initialUserIdProp || null);
  const [userAvatarFallback, setUserAvatarFallback] = useState<string>(initialUserAvatarFallbackProp || "??");
  const [isLoadingUserDetails, setIsLoadingUserDetails] = useState(!isAdminView && !initialNicknameProp);

  // Session and chat state
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [lastMessageSentAt, setLastMessageSentAt] = useState<number>(0);
  const [cooldownRemainingSeconds, setCooldownRemainingSeconds] = useState<number>(0);

  const { sessionData, isLoading: isLoadingSessionDataHook, error: sessionErrorHook } = useSessionData(sessionId);
  const [currentScenario, setCurrentScenario] = useState<Scenario | undefined>(undefined);
  
  const { participants, isLoadingParticipants: isLoadingParticipantsHook, participantsError } = useParticipants(sessionId);
  const { messages, isLoadingMessages: isLoadingMessagesHook, messagesError } = useMessages(sessionId, userId, isAdminView, currentScenario, sessionData);

  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const viewportRef = useRef<null | HTMLDivElement>(null);
  const firstTimeMessagesLoadRef = useRef(true); 
  const [showScrollToBottomButton, setShowScrollToBottomButton] = useState(false);

  const [replyingTo, setReplyingTo] = useState<DisplayMessage | null>(null);
  const [quotingMessage, setQuotingMessage] = useState<DisplayMessage | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isSendingMessage, setIsSendingMessage] = useState(false); 
  const [imageUploadProgress, setImageUploadProgress] = useState<number | null>(null);
  
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [reactingToMessageId, setReactingToMessageId] = useState<string | null>(null);

  const [selectedImageForModal, setSelectedImageForModal] = useState<string | null>(null);
  const [selectedImageFilenameForModal, setSelectedImageFilenameForModal] = useState<string | null>(null);


  const pageError = useMemo(() => sessionErrorHook || participantsError || messagesError, [sessionErrorHook, participantsError, messagesError]);
  const isSessionActive = useMemo(() => sessionData?.status === "active", [sessionData]);

  const isLoadingPage = useMemo(() => {
    if (isAdminView) {
      return isLoadingSessionDataHook || isLoadingParticipantsHook || isLoadingMessagesHook || !currentScenario;
    }
    return isLoadingUserDetails || isLoadingSessionDataHook || isLoadingParticipantsHook || isLoadingMessagesHook || !currentScenario;
  }, [isAdminView, isLoadingUserDetails, isLoadingSessionDataHook, isLoadingParticipantsHook, isLoadingMessagesHook, currentScenario]);


  useEffect(() => {
    if (!isAdminView && (!initialNicknameProp || !initialUserRoleProp || !initialUserIdProp || !initialUserAvatarFallbackProp)) {
      const nameFromStorage = localStorage.getItem(`chatUser_${sessionId}_name`); // Klarname
      const nicknameFromStorage = localStorage.getItem(`chatUser_${sessionId}_nickname`);
      const roleFromStorage = localStorage.getItem(`chatUser_${sessionId}_role`);
      const userIdFromStorage = localStorage.getItem(`chatUser_${sessionId}_userId`);
      const avatarFallbackFromStorage = localStorage.getItem(`chatUser_${sessionId}_avatarFallback`);

      if (!nicknameFromStorage || !roleFromStorage || !userIdFromStorage || !avatarFallbackFromStorage || !nameFromStorage) {
        toast({ variant: "destructive", title: "Fehler", description: "Benutzerdetails nicht gefunden. Bitte treten Sie der Sitzung erneut bei." });
        if (sessionId) router.push(`/join/${sessionId}`); else router.push('/');
        setIsLoadingUserDetails(false);
        return;
      }
      setKlarname(nameFromStorage);
      setNickname(nicknameFromStorage);
      setUserRole(roleFromStorage);
      setUserId(userIdFromStorage);
      setUserAvatarFallback(avatarFallbackFromStorage);
    }
    setIsLoadingUserDetails(false);
  }, [sessionId, isAdminView, initialNicknameProp, initialUserRoleProp, initialUserIdProp, initialUserAvatarFallbackProp, router, toast]);

 useEffect(() => {
    if (sessionData?.scenarioId) {
      const scenario = staticScenarios.find(s => s.id === sessionData.scenarioId);
      setCurrentScenario(scenario);
      // console.log("ChatPageContent: currentScenario set to:", scenario?.title);
    } else if (!sessionData && !isLoadingSessionDataHook) {
      setCurrentScenario(undefined);
      // console.log("ChatPageContent: sessionData is null or scenarioId is missing, currentScenario set to undefined.");
    }
  }, [sessionData, isLoadingSessionDataHook]);


  useEffect(() => {
    if (!sessionId || !userId || isAdminView) {
      setIsMuted(false);
      return;
    }
    
    let unsubscribeParticipant: (() => void) | undefined;

    const findParticipantDocAndListen = async () => {
      if (!userId) return; 

      const participantsColRef = collection(db, "sessions", sessionId, "participants");
      const q = query(participantsColRef, where("userId", "==", userId));
      
      try {
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const userDoc = querySnapshot.docs[0];
          unsubscribeParticipant = onSnapshot(userDoc.ref, (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data() as DisplayParticipant;
              setIsMuted(data.isMuted ?? false);
            } else {
              setIsMuted(false); 
            }
          }, (error) => {
            console.error("Error listening to own participant data: ", error);
            setIsMuted(false); 
          });
        } else {
          setIsMuted(false); 
        }
      } catch (error) {
        console.error("Error querying for participant document:", error);
        setIsMuted(false);
      }
    };

    findParticipantDocAndListen();

    return () => {
      if (unsubscribeParticipant) {
        unsubscribeParticipant();
      }
    };
  }, [sessionId, userId, isAdminView]); 

  const scrollToBottom = useCallback((force: boolean = false, behavior: 'auto' | 'smooth' = 'smooth') => {
    if (messagesEndRef.current && viewportRef.current) {
      const scrollContainer = viewportRef.current;
      const isNearBottomThreshold = 50; 
      const isScrolledToBottom = scrollContainer.scrollHeight - scrollContainer.clientHeight <= scrollContainer.scrollTop + isNearBottomThreshold;

      if (force || isScrolledToBottom) {
        // console.log(`scrollToBottom called. force: ${force}, behavior: ${behavior}, isScrolledToBottom: ${isScrolledToBottom}`);
        messagesEndRef.current.scrollIntoView({ behavior: behavior });
      }
    }
  }, []);

  useEffect(() => {
    if (isLoadingMessagesHook || !messages.length || !viewportRef.current) return;

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return;
    const isOwnMessage = lastMessage.senderUserId === userId;

    if (firstTimeMessagesLoadRef.current) {
      // console.log("First time messages load, scrolling to bottom 'auto'");
      setTimeout(() => scrollToBottom(true, 'auto'), 100); // Force scroll on first load
      firstTimeMessagesLoadRef.current = false;
    } else if (!isOwnMessage) {
        const scrollContainer = viewportRef.current;
        const isNearBottomForNewMessage = scrollContainer.scrollHeight - scrollContainer.clientHeight <= scrollContainer.scrollTop + 250;
        if (isNearBottomForNewMessage) {
            // console.log("New message from other, near bottom, scrolling 'smooth'");
            setTimeout(() => scrollToBottom(false, 'smooth'), 50);
        } else {
            // console.log("New message from other, not near bottom, showing scroll to bottom button");
            if(!showScrollToBottomButton) setShowScrollToBottomButton(true);
        }
    }
    // For own messages, scrolling is handled explicitly in handleSendMessage
  }, [messages, isLoadingMessagesHook, userId, scrollToBottom, showScrollToBottomButton]);


  useEffect(() => {
    firstTimeMessagesLoadRef.current = true; // Reset on session change
  }, [sessionId]);

  const SCROLL_UP_THRESHOLD = 50;
  useEffect(() => {
    const scrollContainer = viewportRef.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
      if (scrollContainer) {
        const atBottom = scrollContainer.scrollHeight - scrollContainer.clientHeight - scrollContainer.scrollTop <= SCROLL_UP_THRESHOLD;
        if (atBottom && showScrollToBottomButton) {
          // console.log("Scrolled to bottom, hiding button");
          setShowScrollToBottomButton(false);
        } else if (!atBottom && !showScrollToBottomButton && (scrollContainer.scrollHeight - scrollContainer.clientHeight > SCROLL_UP_THRESHOLD)) {
          // console.log("Scrolled up, showing button");
           setShowScrollToBottomButton(true);
        }
      }
    };
    scrollContainer.addEventListener('scroll', handleScroll);
    handleScroll(); 
    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
    };
  }, [showScrollToBottomButton]); 


  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (sessionData?.messageCooldownSeconds && sessionData.messageCooldownSeconds > 0 && lastMessageSentAt > 0 && !isAdminView) {
      const cooldownMillis = sessionData.messageCooldownSeconds * 1000;
      const updateRemainingTime = () => {
        const timePassed = Date.now() - lastMessageSentAt;
        const remaining = cooldownMillis - timePassed;
        if (remaining > 0) {
          setCooldownRemainingSeconds(Math.ceil(remaining / 1000));
        } else {
          setCooldownRemainingSeconds(0);
          if (interval) clearInterval(interval);
        }
      };
      updateRemainingTime();
      interval = setInterval(updateRemainingTime, 1000);
    } else {
      setCooldownRemainingSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [lastMessageSentAt, sessionData?.messageCooldownSeconds, isAdminView]);

  const getParticipantColorClasses = useCallback((pUserId?: string, pSenderType?: 'admin' | 'user' | 'bot' | 'system'): ParticipantColor => {
    const adminColor: ParticipantColor = { name: 'admin', bg: "bg-red-600/90", text: "text-red-50", nameText: "text-red-100 dark:text-red-200", ring: "ring-red-600" };
    const botColor: ParticipantColor = { name: 'bot', bg: "bg-purple-600/80", text: "text-purple-50", nameText: "text-purple-100 dark:text-purple-200", ring: "ring-purple-600" }; // Distinct bot color
    const ownColor: ParticipantColor = { name: 'own', bg: "bg-primary", text: "text-primary-foreground", nameText: "text-primary-foreground/90", ring: "ring-primary" };
    const systemColor: ParticipantColor = { name: 'system', bg: "bg-slate-200 dark:bg-slate-700", text: "text-slate-700 dark:text-slate-300", nameText: "text-slate-600 dark:text-slate-400", ring: "ring-slate-500" };
    const defaultOtherColor: ParticipantColor = { name: 'emerald', bg: "bg-emerald-600", text: "text-emerald-50", nameText: "text-emerald-100 dark:text-emerald-200", ring: "ring-emerald-600" };
    
    // console.log(`getParticipantColorClasses called for pUserId: ${pUserId}, pSenderType: ${pSenderType}, currentUserId: ${userId}, isAdminView: ${isAdminView}`);

    if (pSenderType === 'system') {
        // console.log("-> Resolved as SYSTEM color");
        return systemColor;
    }
    if (isAdminView && pUserId === initialUserIdProp && pSenderType === 'admin') {
        // console.log(`-> Resolved as ADMIN (self) color for ${pUserId}`);
        return adminColor;
    }
    if (!isAdminView && pSenderType === 'admin') { // Any admin message seen by non-admin
        // console.log(`-> Resolved as ADMIN (other) color for ${pUserId}`);
        return adminColor;
    }
    if (pSenderType === 'bot') {
        // console.log(`-> Resolved as BOT color for ${pUserId}`);
        return botColor;
    }
    if (pUserId === userId && !isAdminView) { // Current logged-in non-admin user
        // console.log(`-> Resolved as OWN USER color for ${pUserId}`);
        return ownColor;
    }

    // Fallback for "other" users (not self, not admin, not bot)
    if (pUserId && pSenderType === 'user') {
        // console.log(`-> Resolved as OTHER USER (Emerald) for ${pUserId}`);
        return defaultOtherColor;
    }
    
    // console.warn(`getParticipantColorClasses: Could not determine color for pUserId: ${pUserId}, pSenderType: ${pSenderType}. Defaulting to 'other'.`);
    return defaultOtherColor; // Fallback
  }, [userId, isAdminView, initialUserIdProp]);

  const handleImageFileSelected = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      if (file.size > 5 * 1024 * 1024) { 
        toast({ variant: "destructive", title: "Datei zu groß", description: "Bitte wählen Sie ein Bild unter 5MB." });
        return;
      }
      setSelectedImageFile(file);
      setImagePreviewUrl(URL.createObjectURL(file));
      setImageUploadProgress(null);
    }
  }, [toast]);

  const handleRemoveSelectedImage = useCallback(() => {
    setSelectedImageFile(null);
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
      setImagePreviewUrl(null);
    }
    if (fileInputRef.current) { 
      fileInputRef.current.value = "";
    }
    setImageUploadProgress(null);
  }, [imagePreviewUrl]);


  const handleSendMessage = useCallback(async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if ((!newMessage.trim() && !selectedImageFile) || !nickname || !userId || !userAvatarFallback) {
      toast({ variant: "destructive", title: "Senden fehlgeschlagen", description: "Nachricht oder Bild fehlt oder Benutzerdaten fehlen." });
      return;
    }
    if (sessionData?.status === "ended") {
      toast({ variant: "destructive", title: "Sitzung beendet", description: "Keine Nachrichten mehr möglich." });
      return;
    }
    if (sessionData?.status === "paused" && !isAdminView) {
      toast({ variant: "destructive", title: "Sitzung pausiert", description: "Nachrichtenversand aktuell nicht möglich." });
      return;
    }
    if (isMuted && !isAdminView) {
      toast({ variant: "destructive", title: "Stummgeschaltet", description: "Sie wurden vom Admin stummgeschaltet." });
      return;
    }

    const now = Date.now();
    const cooldownMillis = (sessionData?.messageCooldownSeconds || 0) * 1000;
    if (now - lastMessageSentAt < cooldownMillis && !isAdminView) {
      const timeLeft = Math.ceil((cooldownMillis - (now - lastMessageSentAt)) / 1000);
      toast({
        variant: "default",
        title: "Bitte warten",
        description: `Sie können in ${timeLeft} Sekunden wieder eine Nachricht senden.`,
        className: "bg-yellow-500/20 border-yellow-500 dark:bg-yellow-700/30 dark:border-yellow-600"
      });
      return;
    }

    setIsSendingMessage(true);
    if (selectedImageFile) setImageUploadProgress(0);

    let uploadedImageUrl: string | undefined = undefined;
    let uploadedImageFileName: string | undefined = undefined;

    try {
      if (selectedImageFile && selectedImageFile instanceof File) {
        const file = selectedImageFile;
        // Sanitize filename for Firebase Storage path
        const safeFileNamePart = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const imageFileNameForPath = `${userId}_${Date.now()}_${safeFileNamePart}`;
        const imagePath = `chat_images/${sessionId}/${imageFileNameForPath}`;
        const sRef = storageRef(storage, imagePath);
        
        // console.log(`Attempting to upload ${file.name} to ${imagePath}`);
        // console.log("Storage reference:", sRef);

        const uploadTask = uploadBytesResumable(sRef, file);

        await new Promise<void>((resolve, reject) => {
          uploadTask.on('state_changed',
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              // console.log(`Upload is ${progress}% done. State: ${snapshot.state}`);
              setImageUploadProgress(progress);
            },
            (error) => {
              let errorMessage = `Fehler: ${error.code || 'Unbekannt'}`;
              switch (error.code) {
                case 'storage/unauthorized': errorMessage = "Fehler: Keine Berechtigung zum Hochladen."; break;
                case 'storage/canceled': errorMessage = "Upload abgebrochen."; break;
                case 'storage/unknown': errorMessage = "Unbekannter Fehler beim Upload."; break;
                default: errorMessage = `Storage Fehler: ${error.code} - ${error.message}`; break;
              }
              console.error("Upload error in state_changed listener:", error, errorMessage);
              toast({ variant: "destructive", title: "Bild-Upload fehlgeschlagen", description: errorMessage });
              reject(new Error(errorMessage)); 
            },
            async () => { 
              // console.log('Upload successful, getting download URL...');
              try {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                // console.log('Download URL:', downloadURL);
                uploadedImageUrl = downloadURL;
                uploadedImageFileName = file.name; 
                // console.log("Image upload process finished. URL:", uploadedImageUrl);
                resolve(); 
              } catch (getUrlError) {
                const getUrlErrorTyped = getUrlError as Error & { code?: string };
                console.error("Error getting download URL: ", getUrlErrorTyped);
                toast({ variant: "destructive", title: "Bild-URL Abruf fehlgeschlagen", description: `URL konnte nicht abgerufen werden: ${getUrlErrorTyped.message}` });
                reject(getUrlErrorTyped); 
              }
            }
          );
        });
      } else if (selectedImageFile && !(selectedImageFile instanceof File)) {
          console.error("selectedImageFile is not a File object:", selectedImageFile);
          toast({ variant: "destructive", title: "Ungültige Datei", description: "Das ausgewählte Element ist keine gültige Bilddatei."});
          throw new Error("Ungültige Datei ausgewählt"); 
      }

      const messagesColRef = collection(db, "sessions", sessionId!, "messages");
      const messageData: Omit<MessageType, 'id'> = {
        senderUserId: userId!,
        senderName: nickname!, // Use nickname for senderName
        senderType: isAdminView ? 'admin' : 'user',
        avatarFallback: userAvatarFallback!,
        content: newMessage.trim(),
        timestamp: serverTimestamp(), 
        reactions: {}, 
      };

      if (uploadedImageUrl) messageData.imageUrl = uploadedImageUrl;
      if (uploadedImageFileName) messageData.imageFileName = uploadedImageFileName;

      if (replyingTo) {
        messageData.replyToMessageId = replyingTo.id;
        messageData.replyToMessageContentSnippet = replyingTo.content.substring(0, 70) + (replyingTo.content.length > 70 ? "..." : "");
        messageData.replyToMessageSenderName = replyingTo.senderName;
      }
      
      // console.log("Adding message to Firestore:", messageData);
      await addDoc(messagesColRef, messageData);
      // console.log("Message added to Firestore.");

      setNewMessage("");
      setReplyingTo(null);
      setQuotingMessage(null); 
      handleRemoveSelectedImage(); 
      if (!isAdminView) setLastMessageSentAt(Date.now());
      
      // Explicitly scroll after own message is sent
      // console.log("Own message sent, explicitly scrolling 'smooth'");
      setTimeout(() => {
        scrollToBottom(true, 'smooth');
      }, 100);


    } catch (error) { 
      console.error("Error in handleSendMessage:", error);
      // Avoid double-toasting if already toasted from upload error
      if (!(error instanceof Error && (error.message.includes("Bild-Upload fehlgeschlagen") || error.message.includes("Bild-URL Abruf fehlgeschlagen") || error.message.includes("Ungültige Datei")))) {
         toast({ variant: "destructive", title: "Senden fehlgeschlagen", description: (error instanceof Error ? error.message : "Ein unbekannter Fehler ist aufgetreten.") });
      }
    } finally {
      // console.log("handleSendMessage finally block. Resetting state.");
      setIsSendingMessage(false);
      // imageUploadProgress is reset in handleRemoveSelectedImage
    }
  }, [
      newMessage, selectedImageFile, nickname, userId, userAvatarFallback, // Use nickname
      sessionData, isAdminView, isMuted, lastMessageSentAt, sessionId,
      toast, replyingTo, handleRemoveSelectedImage, scrollToBottom
    ]
  );

  const handleSetReply = useCallback((message: DisplayMessage) => {
    setQuotingMessage(null); 
    setReplyingTo(message);
    inputRef.current?.focus();
  }, []);

  const handleCancelReply = useCallback(() => {
    setReplyingTo(null);
  }, []);

  const handleSetQuote = useCallback((message: DisplayMessage) => {
    setReplyingTo(null); 
    const quotedText = `> ${message.senderName} schrieb:\n> "${message.content.replace(/\n/g, '\n> ')}"\n\n`;
    setNewMessage(prev => quotedText + prev); 
    setQuotingMessage(message); 
    inputRef.current?.focus();
  }, []);

  const handleCancelQuote = useCallback(() => {
    if (quotingMessage) {
      // More robust regex to remove quoted block
      const quotedTextPattern = `> ${quotingMessage.senderName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} schrieb:\\n> "${quotingMessage.content.replace(/\n/g, '\\n> ').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"(\\n){1,2}`;
      const regex = new RegExp(quotedTextPattern.replace(/\s/g, '\\s*'), ''); 
      setNewMessage(prev => prev.replace(regex, "").trimStart());
    }
    setQuotingMessage(null);
  }, [quotingMessage]);

  const handleMentionUser = useCallback((nameToMention: string) => { // Use nameToMention to avoid conflict
    setNewMessage(prev => `${prev}@${nameToMention} `); 
    inputRef.current?.focus();
  }, []);
  
  const handleReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!userId || !sessionId) {
        toast({variant: "destructive", title: "Fehler", description: "Reaktion konnte nicht gesendet werden (Benutzer- oder Sitzungsdaten fehlen)."});
        return;
    }
    const messageDocRef = doc(db, "sessions", sessionId, "messages", messageId);

    try {
      await runTransaction(db, async (transaction) => {
        const messageDoc = await transaction.get(messageDocRef);
        if (!messageDoc.exists()) {
          throw new Error("Nachricht nicht mehr vorhanden!");
        }
        const currentData = messageDoc.data() as MessageType;
        const currentReactions = currentData.reactions || {};
        const usersWhoReactedWithEmoji: string[] = Array.isArray(currentReactions[emoji]) ? currentReactions[emoji] : [];
        
        let newReactions = { ...currentReactions };

        if (usersWhoReactedWithEmoji.includes(userId)) {
          // User wants to remove their reaction
          const updatedUserList = usersWhoReactedWithEmoji.filter(uid => uid !== userId);
          if (updatedUserList.length === 0) {
            delete newReactions[emoji]; // Remove emoji if no one else reacted with it
          } else {
            newReactions[emoji] = updatedUserList;
          }
        } else {
          // User wants to add their reaction
          newReactions[emoji] = [...usersWhoReactedWithEmoji, userId];
        }
        transaction.update(messageDocRef, { reactions: newReactions });
      });
    } catch (error) {
      console.error("Error processing reaction: ", error);
      toast({
        variant: "destructive",
        title: "Reaktion fehlgeschlagen",
        description: (error instanceof Error && error.message) || "Ihre Reaktion konnte nicht gespeichert werden.",
      });
    }
  }, [userId, sessionId, toast]);

  const handleEmojiSelectForInput = useCallback((emoji: string) => {
    setNewMessage(prev => prev + emoji);
    setShowEmojiPicker(false); 
  }, []);

  const handleOpenImageModal = useCallback((imageUrl: string, imageFileName?: string) => {
    setSelectedImageForModal(imageUrl);
    setSelectedImageFilenameForModal(imageFileName || "Bild");
  }, []);

  const handleCloseImageModal = useCallback(() => {
    setSelectedImageForModal(null);
    setSelectedImageFilenameForModal(null);
  }, []);


  if (isLoadingPage && !isAdminView) { // Full loading screen for non-admin users
    return <LoadingScreen text={!currentScenario && !isLoadingSessionDataHook ? "Szenario-Details nicht gefunden..." : "Chat wird geladen..."} />;
  }
  
  if (pageError && !isAdminView) { 
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader><CardTitle className="text-destructive flex items-center"><AlertTriangle className="mr-2"/>Fehler</CardTitle></CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{pageError}</p>
            <Button onClick={() => router.push('/')} variant="outline" className="mt-4">Zur Startseite</Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Lighter loading state for admin view, as it's embedded
  if (isAdminView && (isLoadingSessionDataHook || (!currentScenario && sessionData?.scenarioId))) {
     return (
        <div className="p-4 text-center text-muted-foreground flex items-center justify-center h-full bg-background">
            {isLoadingSessionDataHook || (!currentScenario && sessionData?.scenarioId) ?
              <><Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" /> Lade Chat-Daten für Admin-Vorschau...</> :
              <><AlertTriangle className="mr-2 h-5 w-5 text-destructive" /> Wichtige Sitzungs- oder Szenariodaten fehlen, um die Admin-Vorschau zu laden.</>}
        </div>
    );
  }

  return (
      <div className={cn(
        "flex flex-col bg-muted/40 dark:bg-background/50 overflow-hidden",
        isAdminView ? "h-full" : "h-screen min-h-screen" 
      )}>
        {!isAdminView && (
          <header className="flex h-16 items-center justify-between border-b bg-background px-4 md:px-6 shrink-0">
            <h1 className="text-lg font-semibold text-primary truncate max-w-[calc(100%-100px)] sm:max-w-none">
              Simulation: {currentScenario?.title || (isLoadingSessionDataHook ? "Lade Titel..." : "Szenario")}
            </h1>
             <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden" aria-label="Teilnehmer anzeigen">
                  <UsersIconLucide className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full max-w-xs sm:max-w-sm p-4 flex flex-col bg-background">
                 <ChatSidebar
                    participants={participants}
                    isLoadingParticipants={isLoadingParticipantsHook}
                    currentUserId={userId}
                    userName={nickname} // Use nickname for display
                    userRole={userRole}
                    userAvatarFallback={userAvatarFallback}
                    currentScenario={currentScenario}
                    isMuted={isMuted}
                    getParticipantColorClasses={getParticipantColorClasses}
                    isAdminView={isAdminView}
                  />
              </SheetContent>
            </Sheet>
          </header>
        )}

        <div className={cn(
            "flex flex-1 overflow-hidden", 
            isAdminView ? "" : "relative" 
        )}>
          {!isAdminView && (
            <aside className="hidden md:flex md:w-72 lg:w-80 flex-col border-r bg-background p-4 space-y-4 shrink-0">
               <ChatSidebar
                participants={participants}
                isLoadingParticipants={isLoadingParticipantsHook}
                currentUserId={userId}
                userName={nickname} // Use nickname for display
                userRole={userRole}
                userAvatarFallback={userAvatarFallback}
                currentScenario={currentScenario}
                isMuted={isMuted}
                getParticipantColorClasses={getParticipantColorClasses}
                isAdminView={isAdminView}
              />
            </aside>
          )}

          <main className="flex flex-1 flex-col min-w-0 bg-background"> 
            <ScrollArea
              className="flex-1" 
              viewportRef={viewportRef}
              >
               <div className="p-4 md:p-6"> 
                <MessageList
                  messages={messages}
                  currentUserId={userId}
                  getParticipantColorClasses={getParticipantColorClasses}
                  onMentionUser={handleMentionUser}
                  onSetReply={handleSetReply}
                  onSetQuote={handleSetQuote}
                  onReaction={handleReaction}
                  reactingToMessageId={reactingToMessageId}
                  setReactingToMessageId={setReactingToMessageId}
                  emojiCategories={emojiCategories}
                  messagesEndRef={messagesEndRef}
                  isChatDataLoading={isLoadingMessagesHook || (isAdminView && isLoadingSessionDataHook)}
                  isAdminView={isAdminView}
                  onOpenImageModal={handleOpenImageModal}
                />
               </div>
            </ScrollArea>
            {showScrollToBottomButton && (
              <Button
                variant="outline"
                size="icon"
                className="absolute bottom-24 right-4 md:right-8 z-10 rounded-full shadow-md bg-background/80 hover:bg-muted/90 dark:bg-card/80 dark:hover:bg-muted/70 backdrop-blur-sm border-border"
                onClick={() => scrollToBottom(true, 'smooth')}
                aria-label="Zu neuesten Nachrichten springen"
              >
                <ArrowDown className="h-5 w-5" />
              </Button>
            )}

            <MessageInputBar
              newMessage={newMessage}
              setNewMessage={setNewMessage}
              handleSendMessage={handleSendMessage}
              inputRef={inputRef}
              fileInputRef={fileInputRef}
              handleImageFileSelected={handleImageFileSelected}
              selectedImageFile={selectedImageFile}
              imagePreviewUrl={imagePreviewUrl}
              handleRemoveSelectedImage={handleRemoveSelectedImage}
              isSendingMessage={isSendingMessage}
              imageUploadProgress={imageUploadProgress}
              canTryToSend={isAdminView || (isSessionActive && !isMuted && cooldownRemainingSeconds <= 0)}
              cooldownRemainingSeconds={cooldownRemainingSeconds}
              sessionStatus={sessionData?.status || null}
              isMuted={isMuted}
              isAdminView={isAdminView}
              replyingTo={replyingTo}
              handleCancelReply={handleCancelReply}
              quotingMessage={quotingMessage}
              handleCancelQuote={handleCancelQuote}
              showEmojiPicker={showEmojiPicker}
              setShowEmojiPicker={setShowEmojiPicker}
              handleEmojiSelect={handleEmojiSelectForInput} 
              emojiCategories={emojiCategories}
              messageCooldownSeconds={sessionData?.messageCooldownSeconds}
            />
          </main>
        </div>

        {/* Image Modal */}
        {selectedImageForModal && (
          <div 
            className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm"
            onClick={handleCloseImageModal}
          >
            <div 
              className="relative bg-card rounded-lg shadow-xl flex flex-col max-w-[90vw] w-auto h-auto md:max-w-[80vw] lg:max-w-[70vw] max-h-[85vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-3 border-b border-border">
                <h3 className="text-sm font-medium text-foreground truncate">
                  {selectedImageFilenameForModal || "Bild"}
                </h3>
                <Button variant="ghost" size="icon" onClick={handleCloseImageModal} className="h-7 w-7 p-0">
                  <XIcon className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1 p-1 flex items-center justify-center overflow-hidden">
                <div className="relative w-full h-full">
                  <NextImage
                    src={selectedImageForModal}
                    alt={selectedImageFilenameForModal || "Angezeigtes Bild"}
                    width={1920} 
                    height={1080} 
                    className="object-contain max-w-full max-h-full w-auto h-auto"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
  );
}

export default function ChatPage({ params }: ChatPageProps) {
  const { sessionId } = params;

  if (!sessionId) { 
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader><CardTitle className="text-destructive flex items-center"><AlertTriangle className="mr-2"/>Fehler</CardTitle></CardHeader>
          <CardContent><p className="text-muted-foreground">Sitzungs-ID fehlt. Bitte verwenden Sie einen gültigen Link.</p></CardContent>
        </Card>
      </div>
    );
  }

  return (
    <Suspense fallback={
      <div className="flex h-screen w-full items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader><CardTitle className="flex items-center"><Loader2 className="mr-2 h-5 w-5 animate-spin text-primary"/>Chat wird geladen...</CardTitle></CardHeader>
          <CardContent><p className="text-muted-foreground">Einen Moment Geduld, die Simulation wird vorbereitet.</p></CardContent>
        </Card>
      </div>
    }>
      <ChatPageContent sessionId={sessionId} />
    </Suspense>
  );
}
