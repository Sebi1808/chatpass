
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowDown, XCircle, Loader2, AlertTriangle, Eye, X as XIcon, Users as UsersIconLucide, Send, Paperclip, Smile, Mic, Crown, Bot as BotIconLucide, ImageIcon as ImageIconLucide, MessageSquare } from "lucide-react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense, useRef, type FormEvent, type ChangeEvent, useMemo, useCallback } from "react";
import NextImage from 'next/image';
import type { Scenario, DisplayMessage, SessionData, InitialPostConfig, Message as MessageType, ParticipantColor } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { db, storage } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, Timestamp, doc, getDoc, where, getDocs, updateDoc, runTransaction } from "firebase/firestore";
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { useToast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils';
import { emojiCategories } from '@/lib/config';
import { MessageInputBar } from '@/components/chat/message-input-bar';
import { MessageList } from '@/components/chat/message-list';
import { ChatSidebar } from '@/components/chat/chat-sidebar';
import { useSessionData } from "@/hooks/use-session-data";
import { useParticipants } from "@/hooks/use-participants";
import { useMessages } from "@/hooks/use-messages";
// import { scenarios as staticScenarios } from '@/lib/scenarios'; // No longer primary source for scenario

interface ChatPageUrlParams {
  sessionId: string;
}

interface ChatPageProps {
  params: ChatPageUrlParams;
}

interface ChatPageContentProps {
  sessionId: string;
  initialUserName?: string; // This will be displayName (nickname)
  initialUserRole?: string;
  initialUserId?: string;
  initialUserAvatarFallback?: string;
  initialUserRealName?: string; // Added for completeness if needed
  isAdminView?: boolean;
}

const simpleHash = (str: string): number => {
  let hash = 0;
  if (!str || str.length === 0) {
    // console.log("simpleHash: input is empty or null, returning 0");
    return hash;
  }
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; 
  }
  // console.log(`simpleHash: input='${str}', output=${hash}`);
  return hash;
};

const LoadingScreen = ({ text = "Chat wird geladen..." }: { text?: string }) => (
  <div className="flex h-full w-full items-center justify-center bg-background p-4">
    <Card className="max-w-md w-full">
      <CardHeader><CardTitle className="flex items-center"><Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />{text}</CardTitle></CardHeader>
      <CardContent><p className="text-muted-foreground">Einen Moment Geduld, die Simulation wird vorbereitet.</p></CardContent>
    </Card>
  </div>
);

export function ChatPageContent({
  sessionId: sessionIdProp,
  initialUserName: initialDisplayNameProp, // Renamed for clarity
  initialUserRole: initialUserRoleProp,
  initialUserId: initialUserIdProp,
  initialUserAvatarFallback: initialUserAvatarFallbackProp,
  initialUserRealName: initialUserRealNameProp, // Added
  isAdminView = false
}: ChatPageContentProps) {

  const sessionId = sessionIdProp;
  const { toast } = useToast();
  const router = useRouter();

  // User details state
  const [userRealName, setUserRealName] = useState<string | null>(initialUserRealNameProp || null); // Klarname
  const [userName, setUserName] = useState<string | null>(initialDisplayNameProp || null); // This is displayName (nickname)
  const [userRole, setUserRole] = useState<string | null>(initialUserRoleProp || null);
  const [userId, setUserId] = useState<string | null>(initialUserIdProp || null);
  const [userAvatarFallback, setUserAvatarFallback] = useState<string>(initialUserAvatarFallbackProp || "??");
  const [isLoadingUserDetails, setIsLoadingUserDetails] = useState(!isAdminView && !initialDisplayNameProp);


  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [lastMessageSentAt, setLastMessageSentAt] = useState<number>(0);
  const [cooldownRemainingSeconds, setCooldownRemainingSeconds] = useState<number>(0);

  const { sessionData, isLoading: isLoadingSessionDataHook, error: sessionErrorHook } = useSessionData(sessionId);
  const [currentScenario, setCurrentScenario] = useState<Scenario | undefined>(undefined);
  const [isLoadingScenario, setIsLoadingScenario] = useState(true); 
  
  const { participants, isLoadingParticipants: isLoadingParticipantsHook, participantsError } = useParticipants(sessionId);
  // Pass currentScenario and sessionData to useMessages for initialPost logic
  const { messages, isLoadingMessages: isLoadingMessagesHook, messagesError } = useMessages(sessionId, userId, isAdminView, currentScenario, sessionData);

  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const viewportRef = useRef<null | HTMLDivElement>(null);
  const firstTimeMessagesLoadRef = useRef(true); // To ensure initial scroll to bottom
  const [showScrollToBottomButton, setShowScrollToBottomButton] = useState(false);
  const SCROLL_UP_THRESHOLD = 50; // Pixels from bottom to hide scroll button

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
  
  const [pageError, setPageErrorState] = useState<string | null>(null);

  useEffect(() => {
    if (sessionErrorHook) setPageErrorState(sessionErrorHook);
    else if (participantsError) setPageErrorState(participantsError);
    else if (messagesError) setPageErrorState(messagesError);
    else setPageErrorState(null);
  }, [sessionErrorHook, participantsError, messagesError]);

 useEffect(() => {
    if (!isAdminView && (!initialDisplayNameProp || !initialUserRoleProp || !initialUserIdProp || !initialUserAvatarFallbackProp)) {
      const realNameFromStorage = localStorage.getItem(`chatUser_${sessionId}_realName`);
      const displayNameFromStorage = localStorage.getItem(`chatUser_${sessionId}_displayName`);
      const roleFromStorage = localStorage.getItem(`chatUser_${sessionId}_role`);
      const userIdFromStorage = localStorage.getItem(`chatUser_${sessionId}_userId`);
      const avatarFallbackFromStorage = localStorage.getItem(`chatUser_${sessionId}_avatarFallback`);

      if (!realNameFromStorage || !displayNameFromStorage || !roleFromStorage || !userIdFromStorage || !avatarFallbackFromStorage ) {
        toast({ variant: "destructive", title: "Fehler", description: "Benutzerdetails nicht gefunden. Bitte treten Sie der Sitzung erneut bei." });
        if (sessionId) router.push(`/join/${sessionId}`); else router.push('/');
        setIsLoadingUserDetails(false);
        return;
      }
      setUserRealName(realNameFromStorage);
      setUserName(displayNameFromStorage); // userName is the nickname
      setUserRole(roleFromStorage);
      setUserId(userIdFromStorage);
      setUserAvatarFallback(avatarFallbackFromStorage);
    }
    setIsLoadingUserDetails(false);
  }, [sessionId, isAdminView, initialDisplayNameProp, initialUserRoleProp, initialUserIdProp, initialUserAvatarFallbackProp, router, toast]);


  // Load scenario data from Firestore
  useEffect(() => {
    if (sessionData?.scenarioId) {
      setIsLoadingScenario(true);
      const scenarioDocRef = doc(db, "scenarios", sessionData.scenarioId);
      getDoc(scenarioDocRef).then(docSnap => {
        if (docSnap.exists()) {
          setCurrentScenario({ id: docSnap.id, ...docSnap.data() } as Scenario);
          setPageErrorState(null);
        } else {
          setPageErrorState("Szenario-Details nicht gefunden. Die Sitzung ist möglicherweise ungültig.");
          setCurrentScenario(undefined);
        }
      }).catch(error => {
        console.error("ChatPage: Error fetching scenario:", error);
        setPageErrorState("Szenario-Details konnten nicht geladen werden.");
        setCurrentScenario(undefined);
      }).finally(() => {
        setIsLoadingScenario(false);
      });
    } else if (!isLoadingSessionDataHook && !sessionData?.scenarioId) {
      // Session data loaded, but no scenarioId, or sessionData itself is null
      if (!pageError) { // Avoid overwriting more specific errors like "Sitzungsdokument nicht gefunden."
         setPageErrorState(prev => prev || "Keine Szenario-ID in Sitzungsdaten oder Sitzung nicht gefunden.");
      }
      setCurrentScenario(undefined);
      setIsLoadingScenario(false);
    }
  }, [sessionData, isLoadingSessionDataHook, pageError]);


  const isLoadingPage = useMemo(() => {
    if (isAdminView) { 
      return isLoadingSessionDataHook || isLoadingScenario || isLoadingParticipantsHook || isLoadingMessagesHook;
    }
    return isLoadingUserDetails || isLoadingSessionDataHook || isLoadingScenario || isLoadingParticipantsHook || isLoadingMessagesHook;
  }, [isAdminView, isLoadingUserDetails, isLoadingSessionDataHook, isLoadingScenario, isLoadingParticipantsHook, isLoadingMessagesHook]);


  useEffect(() => {
    if (!sessionId || !userId || isAdminView) {
      setIsMuted(false);
      return;
    }
    
    let unsubscribeParticipant: (() => void) | undefined;
    const findParticipantDocAndListen = async () => {
        try {
            const participantsColRef = collection(db, "sessions", sessionId, "participants");
            const q = query(participantsColRef, where("userId", "==", userId)); // Ensure 'where' is imported
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
              // console.warn(`Participant document for userId ${userId} not found in session ${sessionId}. Assuming not muted.`);
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
      const isNearBottomThreshold = 100; 
      const isScrolledToBottom = scrollContainer.scrollHeight - scrollContainer.clientHeight <= scrollContainer.scrollTop + isNearBottomThreshold;

      if (force || isScrolledToBottom) {
        // Ensure the element is actually in view before trying to scroll to it.
        // This helps in scenarios where the ref might exist but isn't rendered.
        if (messagesEndRef.current.offsetParent !== null) { 
             messagesEndRef.current.scrollIntoView({ behavior: behavior });
        }
      }
    }
  }, []);

  // Effect for scrolling when new messages arrive or page loads
  useEffect(() => {
    if (isLoadingMessagesHook || !messages.length || !viewportRef.current) return;

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return;

    const isOwnMessage = lastMessage.senderUserId === userId;

    if (firstTimeMessagesLoadRef.current) {
      setTimeout(() => scrollToBottom(true, 'auto'), 150); 
      firstTimeMessagesLoadRef.current = false;
    } else {
      // If it's not the user's own message OR if it is their own message and they are already near the bottom
      const scrollContainer = viewportRef.current;
      const isNearBottomForNewMessage = scrollContainer.scrollHeight - scrollContainer.clientHeight <= scrollContainer.scrollTop + 250; 

      if (isOwnMessage) {
        // Explicit scroll for own messages is handled in handleSendMessage's finally/then block
      } else if (isNearBottomForNewMessage) { // New message from someone else and user is near bottom
        setTimeout(() => scrollToBottom(false, 'smooth'), 100);
      } else if (!isOwnMessage && !isNearBottomForNewMessage) { // New message from someone else and user is scrolled up
         if(!showScrollToBottomButton) setShowScrollToBottomButton(true);
      }
    }
  }, [messages, isLoadingMessagesHook, userId, scrollToBottom, showScrollToBottomButton]);


  // Effect to clear firstTimeMessagesLoadRef when session changes
  useEffect(() => {
    firstTimeMessagesLoadRef.current = true; 
  }, [sessionId]);

  // Effect to manage the "scroll to bottom" button visibility
  useEffect(() => {
    const scrollContainer = viewportRef.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
      if (scrollContainer) {
        const atBottom = scrollContainer.scrollHeight - scrollContainer.clientHeight - scrollContainer.scrollTop <= SCROLL_UP_THRESHOLD;
        if (atBottom) {
          if (showScrollToBottomButton) setShowScrollToBottomButton(false);
        } else {
           if (!showScrollToBottomButton) setShowScrollToBottomButton(true);
        }
      }
    };
    scrollContainer.addEventListener('scroll', handleScroll);
    handleScroll(); 
    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
    };
  }, [showScrollToBottomButton, SCROLL_UP_THRESHOLD]); 


  // Effect for message cooldown timer
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
    const adminColor: ParticipantColor = { name: 'admin', bg: "bg-red-600/90 dark:bg-red-700/90", text: "text-white", nameText: "text-red-100 dark:text-red-200 font-semibold", ring: "ring-red-500" };
    const botColor: ParticipantColor = { name: 'bot', bg: "bg-purple-600/80 dark:bg-purple-700/80", text: "text-purple-50", nameText: "text-purple-100 dark:text-purple-200 font-semibold", ring: "ring-purple-600" };
    const ownColor: ParticipantColor = { name: 'own', bg: "bg-primary", text: "text-primary-foreground", nameText: "text-primary-foreground/90 font-semibold", ring: "ring-primary" };
    const systemColor: ParticipantColor = { name: 'system', bg: "bg-slate-200 dark:bg-slate-700", text: "text-slate-800 dark:text-slate-200", nameText: "text-slate-600 dark:text-slate-300 font-medium", ring: "ring-slate-400" };
    // Fallback/Default color for other users
    const emeraldColor: ParticipantColor = { name: 'emerald', bg: "bg-emerald-600/90 dark:bg-emerald-700/90", text: "text-white", nameText: "text-emerald-100 dark:text-emerald-200 font-semibold", ring: "ring-emerald-600" };

    // console.log(`getParticipantColorClasses called for pUserId: ${pUserId}, pSenderType: ${pSenderType}, currentUserId: ${userId}, isAdminView: ${isAdminView}`);

    if (pSenderType === 'system') {
        // console.log("-> Resolved as SYSTEM color");
        return systemColor;
    }
    if (isAdminView && pUserId === initialUserIdProp && pSenderType === 'admin') {
        // console.log(`-> Resolved as ADMIN (self) color for ${pUserId}`);
        return adminColor;
    }
    if (!isAdminView && pSenderType === 'admin') { 
        // console.log(`-> Resolved as ADMIN (other) color for ${pUserId}`);
        return adminColor;
    }
    if (pSenderType === 'bot') {
        // console.log(`-> Resolved as BOT color for ${pUserId}`);
        return botColor;
    }
    if (pUserId === userId && !isAdminView) { 
        // console.log(`-> Resolved as OWN USER color for ${pUserId}`);
        return ownColor;
    }
    
    // console.log(`-> Resolved as OTHER USER (Emerald) color for ${pUserId}`);
    return emeraldColor; 
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
    if ((!newMessage.trim() && !selectedImageFile) || !userName || !userId || !userAvatarFallback) {
      toast({ variant: "destructive", title: "Senden fehlgeschlagen", description: "Nachricht oder Bild fehlt oder Benutzerdaten fehlen." });
      return;
    }
    if (sessionData?.status === "ended") {
      toast({ variant: "destructive", title: "Sitzung beendet", description: "Keine Nachrichten mehr möglich." });
      return;
    }
    if (sessionData?.status !== "active" && !isAdminView) { // Adjusted to allow sending unless explicitly not 'active'
      toast({ variant: "destructive", title: "Sitzung nicht aktiv", description: `Nachrichtenversand aktuell nicht möglich (Status: ${sessionData?.status}).` });
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
                // Add more specific Firebase Storage error codes as needed
                default: errorMessage = `Storage Fehler: ${error.message || error.code}`; break;
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
          // console.error("selectedImageFile is not a File object:", selectedImageFile);
          toast({ variant: "destructive", title: "Ungültige Datei", description: "Das ausgewählte Element ist keine gültige Bilddatei."});
          throw new Error("Ungültige Datei ausgewählt"); 
      }

      const messagesColRef = collection(db, "sessions", sessionId!, "messages");
      const messageData: Omit<MessageType, 'id'> = {
        senderUserId: userId!,
        senderName: userName!, // This is the displayName (nickname)
        senderType: isAdminView ? 'admin' : 'user',
        avatarFallback: userAvatarFallback!,
        content: newMessage.trim(),
        timestamp: serverTimestamp() as Timestamp, 
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
      
      setTimeout(() => scrollToBottom(true, 'smooth'), 50);


    } catch (error) { 
      // console.error("Error in handleSendMessage:", error);
      if (!(error instanceof Error && (error.message.includes("Bild-Upload fehlgeschlagen") || error.message.includes("Bild-URL Abruf fehlgeschlagen") || error.message.includes("Ungültige Datei")))) {
         toast({ variant: "destructive", title: "Senden fehlgeschlagen", description: (error instanceof Error ? error.message : "Ein unbekannter Fehler ist aufgetreten.") });
      }
    } finally {
      // console.log("handleSendMessage finally block. Resetting state.");
      setIsSendingMessage(false);
      setImageUploadProgress(null); // Ensure progress is reset
    }
  }, [
      newMessage, selectedImageFile, userName, userId, userAvatarFallback,
      sessionData, isAdminView, isMuted, lastMessageSentAt, sessionId,
      toast, replyingTo, handleRemoveSelectedImage, scrollToBottom, quotingMessage
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
      const quotedTextPattern = `> ${quotingMessage.senderName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} schrieb:\\n> "${quotingMessage.content.replace(/\n/g, '\\n> ').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"(\\n){1,2}`;
      const regex = new RegExp(quotedTextPattern.replace(/\s/g, '\\s*'), ''); 
      setNewMessage(prev => prev.replace(regex, "").trimStart());
    }
    setQuotingMessage(null);
  }, [quotingMessage]);

  const handleMentionUser = useCallback((nameToMention: string) => {
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
          const updatedUserList = usersWhoReactedWithEmoji.filter(uid => uid !== userId);
          if (updatedUserList.length === 0) {
            delete newReactions[emoji]; 
          } else {
            newReactions[emoji] = updatedUserList;
          }
        } else {
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


  if (isLoadingPage && !isAdminView) {
    let loadingText = "Chat wird geladen...";
    if (isLoadingSessionDataHook && !sessionData) {
      loadingText = "Sitzungsdaten werden geladen...";
    } else if (isLoadingScenario && !currentScenario && sessionData?.scenarioId) {
      loadingText = "Szenario-Details werden geladen...";
    }
    return <LoadingScreen text={loadingText} />;
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
  
  if (isAdminView && (isLoadingSessionDataHook || (isLoadingScenario && !currentScenario && sessionData?.scenarioId))) {
     return (
        <div className="p-4 text-center text-muted-foreground flex items-center justify-center h-full bg-background">
            {isLoadingSessionDataHook || (isLoadingScenario && !currentScenario && sessionData?.scenarioId) ?
              <><Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" /> Lade Chat-Daten für Admin-Vorschau...</> :
              <><AlertTriangle className="mr-2 h-5 w-5 text-destructive" /> Wichtige Sitzungs- oder Szenariodaten fehlen.</>}
        </div>
    );
  }
  
  if (!isAdminView && !isLoadingSessionDataHook && sessionData?.scenarioId && !currentScenario && !isLoadingScenario && !pageError) {
     return (
      <div className="flex h-screen w-full items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader><CardTitle className="text-destructive flex items-center"><AlertTriangle className="mr-2"/>Fehler beim Laden</CardTitle></CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Szenario-Details konnten nicht geladen werden, obwohl Sitzungsdaten vorhanden sind.</p>
            <Button onClick={() => router.push('/')} variant="outline" className="mt-4">Zur Startseite</Button>
          </CardContent>
        </Card>
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
              Simulation: {currentScenario?.title || (isLoadingScenario ? "Lade Titel..." : (sessionData?.scenarioId ? "Szenario..." : "Kein Szenario"))}
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
                    userName={userName} // This is displayName (nickname)
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
                userName={userName} // This is displayName (nickname)
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
                  isChatDataLoading={isLoadingMessagesHook || (isAdminView && (isLoadingSessionDataHook || isLoadingScenario))}
                  isAdminView={isAdminView}
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
              canTryToSend={isAdminView || (sessionData?.status === "active" && !isMuted && cooldownRemainingSeconds <= 0)}
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
      <div className="flex h-screen w-full items-center justify-center p-4 bg-background">
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
