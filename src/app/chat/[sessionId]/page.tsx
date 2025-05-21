"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowDown, XCircle, Loader2, AlertTriangle, Eye, X as XIcon, Users as UsersIconLucide, Send, Paperclip, Smile, Mic, Crown, Bot as BotIconLucide, ImageIcon as ImageIconLucide, MessageSquare, ArrowLeft, Check } from "lucide-react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense, useRef, type FormEvent, type ChangeEvent, useMemo, useCallback } from "react";
import NextImage from 'next/image';
import type { Scenario, DisplayMessage, SessionData, InitialPostConfig, Message as MessageType, Participant } from "@/lib/types";
import type { ParticipantColor } from '@/lib/config';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DialogFooter } from "@/components/ui/dialog";

interface ChatPageUrlParams {
  sessionId: string;
}

interface ChatPageProps {
  params: ChatPageUrlParams;
}

interface ChatPageContentProps {
  sessionId: string;
  initialUserDisplayName?: string; // This will be displayName (nickname)
  initialUserRole?: string;
  initialUserId?: string;
  initialUserAvatarFallback?: string;
  initialUserRealName?: string; 
  isAdminView?: boolean;
}

interface DmContactSummary {
  partner: Participant;
  lastMessage: MessageType | null;
  unreadCount: number;
}

const simpleHash = (str: string): number => {
  let hash = 0;
  if (!str || str.length === 0) {
    return hash;
  }
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; 
  }
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
  initialUserDisplayName: initialDisplayNameProp,
  initialUserRole: initialUserRoleProp,
  initialUserId: initialUserIdProp,
  initialUserAvatarFallback: initialUserAvatarFallbackProp,
  initialUserRealName: initialUserRealNameProp,
  isAdminView = false
}: ChatPageContentProps) {

  const sessionId = sessionIdProp;
  const { toast } = useToast();
  const router = useRouter();

  const [userRealName, setUserRealName] = useState<string | null>(initialUserRealNameProp || null); 
  const [userDisplayName, setUserDisplayName] = useState<string | null>(initialDisplayNameProp || null); 
  const [userRole, setUserRole] = useState<string | null>(initialUserRoleProp || null);
  const [userId, setUserId] = useState<string | null>(initialUserIdProp || null);
  const [userAvatarFallback, setUserAvatarFallback] = useState<string>(initialUserAvatarFallbackProp || "??");
  const [isLoadingUserDetails, setIsLoadingUserDetails] = useState(!isAdminView && !initialDisplayNameProp);

  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [lastMessageSentAt, setLastMessageSentAt] = useState<number>(0);
  const [cooldownRemainingSeconds, setCooldownRemainingSeconds] = useState<number>(0);
  const [sessionStatusForTimer, setSessionStatusForTimer] = useState<"open" | "pending" | "active" | "paused" | "ended" | null>(null);

  const { sessionData, isLoading: isLoadingSessionDataHook, error: sessionErrorHook } = useSessionData(sessionId);
  const [currentScenario, setCurrentScenario] = useState<Scenario | undefined>(undefined);
  const [isLoadingScenario, setIsLoadingScenario] = useState(true); 
  
  const { participants, isLoadingParticipants: isLoadingParticipantsHook, participantsError } = useParticipants(sessionId);
  const { messages, isLoadingMessages: isLoadingMessagesHook, messagesError } = useMessages(sessionId, userId, isAdminView, currentScenario, sessionData);

  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const viewportRef = useRef<null | HTMLDivElement>(null);
  const firstTimeMessagesLoadRef = useRef(true);
  const [showScrollToBottomButton, setShowScrollToBottomButton] = useState(false);
  const SCROLL_UP_THRESHOLD = 50; 

  const [replyingTo, setReplyingTo] = useState<DisplayMessage | null>(null);
  const [quotingMessage, setQuotingMessage] = useState<DisplayMessage | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [imageUploadProgress, setImageUploadProgress] = useState<number | null>(null);
  
  const [pageError, setPageErrorState] = useState<string | null>(null);

  // NEW: State for current participant details (for UserInfoBox)
  const [currentParticipantDetails, setCurrentParticipantDetails] = useState<Participant | null>(null);
  const [penaltyTimeRemaining, setPenaltyTimeRemaining] = useState<string | null>(null);

  // Direct Message State
  const [showDmPopup, setShowDmPopup] = useState(false);
  const [dmRecipient, setDmRecipient] = useState<Participant | null>(null);
  const [dmContent, setDmContent] = useState("");
  const [activeDmThread, setActiveDmThread] = useState<MessageType[]>([]);
  const [isSendingDm, setIsSendingDm] = useState(false);
  const [unreadDms, setUnreadDms] = useState<MessageType[]>([]);
  const [showInbox, setShowInbox] = useState(false);
  const dmMessagesEndRef = useRef<null | HTMLDivElement>(null); // Ref for DM autoscroll

  // NEUER STATE für die aufbereiteten DM Kontakte für die Inbox
  const [dmContactSummaries, setDmContactSummaries] = useState<DmContactSummary[]>([]);
  const [showDmEmojiPicker, setShowDmEmojiPicker] = useState(false);
  // States für DM Bild-Upload
  const dmFileInputRef = useRef<HTMLInputElement>(null);
  const [dmSelectedImageFile, setDmSelectedImageFile] = useState<File | null>(null);
  const [dmImagePreviewUrl, setDmImagePreviewUrl] = useState<string | null>(null);
  const [dmImageUploadProgress, setDmImageUploadProgress] = useState<number | null>(null);

  // State for Admin DM Overlay
  const [showAdminDmOverlay, setShowAdminDmOverlay] = useState(false);
  const [adminDmToDisplay, setAdminDmToDisplay] = useState<MessageType | null>(null);

  // NEU: State für Admin Broadcasts in der Inbox-Ansicht
  const [adminBroadcastInboxMessages, setAdminBroadcastInboxMessages] = useState<MessageType[]>([]);
  const [unreadAdminBroadcastCount, setUnreadAdminBroadcastCount] = useState(0);

  // NEU: State für das Modal, das alle Admin Broadcasts anzeigt
  const [showAdminBroadcastInboxModal, setShowAdminBroadcastInboxModal] = useState(false);

  const scrollToBottomDm = useCallback(() => {
    dmMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (showDmPopup && activeDmThread.length > 0) {
      scrollToBottomDm();
    }
  }, [activeDmThread, showDmPopup, scrollToBottomDm]);

  useEffect(() => {
    if (sessionErrorHook) setPageErrorState(sessionErrorHook);
    else if (participantsError) setPageErrorState(participantsError);
    else if (messagesError) setPageErrorState(messagesError);
    else setPageErrorState(null);
  }, [sessionErrorHook, participantsError, messagesError]);

 useEffect(() => {
    if (!isAdminView && (!initialDisplayNameProp || !initialUserRoleProp || !initialUserIdProp || !initialUserAvatarFallbackProp)) {
      const localUserId = localStorage.getItem('localUserId');
      if (!localUserId) {
        toast({ variant: "destructive", title: "Fehler", description: "Benutzer-ID nicht gefunden. Bitte treten Sie der Sitzung erneut bei." });
        if (sessionId) router.push(`/join/${sessionId}`); else router.push('/');
        setIsLoadingUserDetails(false);
        return;
      }
      setUserId(localUserId); // Set userId first

      const realNameFromStorage = localStorage.getItem(`chatUser_${sessionId}_${localUserId}_realName`);
      const displayNameFromStorage = localStorage.getItem(`chatUser_${sessionId}_${localUserId}_displayName`);
      const roleFromStorage = localStorage.getItem(`chatUser_${sessionId}_${localUserId}_roleName`); // Use roleName
      const avatarFallbackFromStorage = localStorage.getItem(`chatUser_${sessionId}_${localUserId}_avatarFallback`);

      if (!realNameFromStorage || !displayNameFromStorage || !roleFromStorage || !avatarFallbackFromStorage ) {
        toast({ variant: "destructive", title: "Fehler", description: "Benutzerdetails nicht vollständig im Speicher gefunden. Bitte treten Sie der Sitzung erneut bei." });
        if (sessionId) router.push(`/join/${sessionId}`); else router.push('/');
        setIsLoadingUserDetails(false);
        return;
      }
      setUserRealName(realNameFromStorage);
      setUserDisplayName(displayNameFromStorage);
      setUserRole(roleFromStorage);
      setUserAvatarFallback(avatarFallbackFromStorage);
    }
    setIsLoadingUserDetails(false);
  }, [sessionId, isAdminView, initialDisplayNameProp, initialUserRoleProp, initialUserIdProp, initialUserAvatarFallbackProp, router, toast]);


  useEffect(() => {
    if (!sessionData?.scenarioId) {
      if (!isLoadingSessionDataHook && !sessionData?.scenarioId && !pageError && !isAdminView) {
         setPageErrorState(prev => prev || "Keine Szenario-ID in Sitzungsdaten gefunden. Sitzung möglicherweise fehlerhaft.");
      }
      setCurrentScenario(undefined);
      setIsLoadingScenario(false);
      return;
    }
    setIsLoadingScenario(true);
    const scenarioDocRef = doc(db, "scenarios", sessionData.scenarioId);
    getDoc(scenarioDocRef).then(docSnap => {
      if (docSnap.exists()) {
        setCurrentScenario({ id: docSnap.id, ...docSnap.data() } as Scenario);
        if (pageError === "Keine Szenario-ID in Sitzungsdaten gefunden. Sitzung möglicherweise fehlerhaft.") {
            setPageErrorState(null); // Clear previous error if scenario is now found
        }
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
  }, [sessionData?.scenarioId, isLoadingSessionDataHook, pageError, isAdminView]);


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
    const participantDocRef = doc(db, "sessions", sessionId, "participants", userId);

    unsubscribeParticipant = onSnapshot(participantDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as Participant; // Use Participant type
        setIsMuted(data.isMuted ?? false);
      } else {
        // console.warn(`ChatPage: Participant document for userId ${userId} not found in session ${sessionId}. Assuming not muted.`);
        setIsMuted(false); 
      }
    }, (error) => {
      console.error("Error listening to own participant data: ", error);
      setIsMuted(false); 
    });

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
        if (messagesEndRef.current.offsetParent !== null) { 
             messagesEndRef.current.scrollIntoView({ behavior: behavior });
        }
      }
    }
  }, []);

  useEffect(() => {
    if (isLoadingMessagesHook || !messages.length || !viewportRef.current) return;

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return;
    const isOwnMessage = lastMessage.senderUserId === userId;

    if (firstTimeMessagesLoadRef.current) {
      setTimeout(() => scrollToBottom(true, 'auto'), 200); 
      firstTimeMessagesLoadRef.current = false;
    } else {
      if (isOwnMessage) {
        // Explicit scroll for own messages is now handled in handleSendMessage's finally/then block
        // Potentially add a small delay here too if race conditions occur on mobile
        setTimeout(() => scrollToBottom(true, 'smooth'), 50);
      } else { // New message from someone else
        const scrollContainer = viewportRef.current;
        const isNearBottomForNewMessage = scrollContainer.scrollHeight - scrollContainer.clientHeight <= scrollContainer.scrollTop + 250;
        if (isNearBottomForNewMessage) {
          setTimeout(() => scrollToBottom(false, 'smooth'), 100);
        } else if (!showScrollToBottomButton) {
           setShowScrollToBottomButton(true);
        }
      }
    }
  }, [messages, isLoadingMessagesHook, userId, scrollToBottom, showScrollToBottomButton]);


  useEffect(() => {
    firstTimeMessagesLoadRef.current = true; 
  }, [sessionId]);

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
    // Define base colors and their text/nameText counterparts
    const adminColorBase: Omit<ParticipantColor, 'name' | 'nameText'> = { bg: "bg-red-600", text: "text-white", ring: "ring-red-500" };
    const systemColorBase: Omit<ParticipantColor, 'name' | 'nameText'> = { bg: "bg-gray-500", text: "text-white", ring: "ring-gray-400" };
    const botColorBase: Omit<ParticipantColor, 'name' | 'nameText'> = { bg: "bg-purple-600", text: "text-white", ring: "ring-purple-500" }; // Adjusted Bot color
    const ownUserColorBase: Omit<ParticipantColor, 'name' | 'nameText'> = { bg: "bg-orange-500", text: "text-white", ring: "ring-orange-400" }; // Own messages in Orange

    const otherUserColors: Array<Omit<ParticipantColor, 'name' | 'nameText'> & {namePrefix: string}> = [
      { namePrefix: "green", bg: "bg-green-500", text: "text-white", ring: "ring-green-400" },
      { namePrefix: "blue", bg: "bg-blue-600", text: "text-white", ring: "ring-blue-500" }, // Changed from yellow to blue for better contrast with orange
      { namePrefix: "pink", bg: "bg-pink-500", text: "text-white", ring: "ring-pink-400" },
      { namePrefix: "indigo", bg: "bg-indigo-500", text: "text-white", ring: "ring-indigo-400" },
      { namePrefix: "teal", bg: "bg-teal-500", text: "text-white", ring: "ring-teal-400" },
      { namePrefix: "cyan", bg: "bg-cyan-500", text: "text-white", ring: "ring-cyan-400"},
      { namePrefix: "lime", bg: "bg-lime-500", text: "text-black", ring: "ring-lime-400"},
      { namePrefix: "emerald", bg: "bg-emerald-500", text: "text-white", ring: "ring-emerald-400"},

    ];

    const constructColor = (base: Omit<ParticipantColor, 'name' | 'nameText'>, name: string): ParticipantColor => ({
        ...base,
        name: name,
        nameText: base.text // Simplified: nameText is same as text, adjust if specific styling needed
    });

    if (isAdminView && pUserId === userId && pSenderType === 'admin') return constructColor(adminColorBase, 'admin_self_as_admin_in_chat_view'); // Admin sending as admin in full chat view
    if (pSenderType === 'admin') return constructColor(adminColorBase, 'admin');
    if (pSenderType === 'system') return constructColor(systemColorBase, 'system');
    if (pSenderType === 'bot') return constructColor(botColorBase, 'bot');

    // If it's the current user's message (and not admin in admin view sending as user)
    if (pUserId === userId) return constructColor(ownUserColorBase, 'own_user');

    // Fallback for other users - pseudo-random color based on ID
    if (!pUserId) return constructColor(otherUserColors[0], otherUserColors[0].namePrefix); // Default if no ID
    
    const participant = participants.find(par => par.userId === pUserId);
    if (participant && participant.colorSeed != null) {
        const colorIndex = Math.abs(participant.colorSeed) % otherUserColors.length;
        const selectedColorBase = otherUserColors[colorIndex];
        return constructColor(selectedColorBase, selectedColorBase.namePrefix);
    }
    
    // If no colorSeed, use hash as before
    const hash = simpleHash(pUserId);
    const selectedColorBase = otherUserColors[Math.abs(hash) % otherUserColors.length];
    return constructColor(selectedColorBase, selectedColorBase.namePrefix);

  }, [userId, isAdminView, participants]);

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
    if (event) event.preventDefault();
    if (!newMessage.trim() && !selectedImageFile) return;
    if (!userId || !userDisplayName || !userAvatarFallback) {
      toast({ variant: "destructive", title: "Fehler", description: "Benutzerdetails nicht geladen, Nachricht kann nicht gesendet werden." });
      return;
    }

    // Cooldown check
    const now = Date.now();
    const cooldownSetting = sessionData?.messageCooldownSeconds ?? 0;

    if (cooldownSetting > 0 && lastMessageSentAt && (now - lastMessageSentAt < cooldownSetting * 1000) && !isAdminView) {
      const timeLeft = Math.ceil((cooldownSetting * 1000 - (now - lastMessageSentAt)) / 1000);
      toast({
        variant: "default",
        title: "Nachricht gesendet",
        description: `Cooldown aktiv. Nächste Nachricht in ${timeLeft} Sekunden.`
      });
      return;
    }

    setIsSendingMessage(true);
    setLastMessageSentAt(now);
    setImageUploadProgress(null); 

    let uploadedImageUrl: string | undefined = undefined;
    let uploadedImageFileName: string | undefined = undefined;

    if (selectedImageFile) {
      setImageUploadProgress(0);
        const file = selectedImageFile;
      const fileName = `${Date.now()}_${file.name}`;
      const imageRef = storageRef(storage, `sessionImages/${sessionId}/${fileName}`);
      try {
        const uploadTask = uploadBytesResumable(imageRef, file);
        await new Promise<void>((resolve, reject) => {
          uploadTask.on('state_changed',
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setImageUploadProgress(progress);
            },
            (error) => {
              console.error("Image upload error:", error);
              toast({ variant: "destructive", title: "Bild-Upload fehlgeschlagen", description: error.message });
              reject(error);
            },
            async () => { 
              uploadedImageUrl = await getDownloadURL(uploadTask.snapshot.ref);
              uploadedImageFileName = fileName;
                resolve(); 
            }
          );
        });
      } catch (error) {
        setIsSendingMessage(false);
        setImageUploadProgress(null);
        // Error is already toasted by the uploadTask error handler
        return;
      }
    }

    try {
      const messageData: Partial<MessageType> = {
        senderUserId: userId,
        senderName: userDisplayName,
        senderType: isAdminView ? 'admin' : 'user',
        avatarFallback: userAvatarFallback,
        content: newMessage.trim(),
        platform: currentScenario?.initialPost?.platform || 'Generic',
        timestamp: serverTimestamp() as Timestamp, 
      };

      if (uploadedImageUrl) {
        messageData.imageUrl = uploadedImageUrl;
      }
      if (uploadedImageFileName) {
        messageData.imageFileName = uploadedImageFileName;
      }

      if (replyingTo) {
        messageData.replyToMessageId = replyingTo.id;
        messageData.replyToMessageContentSnippet = replyingTo.content.substring(0, 50) + (replyingTo.content.length > 50 ? "..." : "");
        messageData.replyToMessageSenderName = replyingTo.senderName;
      }
      
      const messagesColRef = collection(db, "sessions", sessionId!, "messages");
      await addDoc(messagesColRef, messageData);

      setNewMessage("");
      setSelectedImageFile(null);
      setImagePreviewUrl(null);
      setReplyingTo(null);
      setQuotingMessage(null); 
      if (inputRef.current) {
        inputRef.current.focus();
      }
    } catch (error: any) {
      console.error("Error sending message: ", error);
      toast({ variant: "destructive", title: "Fehler beim Senden", description: error.message });
    } finally {
      setIsSendingMessage(false);
      setImageUploadProgress(null);
    }
  }, [
      newMessage, selectedImageFile, userDisplayName, userId, userAvatarFallback,
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
  
  const [reactingToMessageId, setReactingToMessageId] = useState<string | null>(null);
  
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

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const handleEmojiSelectForInput = useCallback((emoji: string) => {
    setNewMessage(prev => prev + emoji);
    setShowEmojiPicker(false); 
  }, []);

  // Effect to get current participant details for UserInfoBox and set up penalty countdown
  useEffect(() => {
    if (userId && participants.length > 0) {
      const ownData = participants.find(p => p.userId === userId);
      setCurrentParticipantDetails(ownData || null);

      if (ownData?.activePenalty && ownData.activePenalty.startedAt instanceof Timestamp) {
        const updateCountdown = () => {
          const endTime = ownData.activePenalty!.startedAt.toDate().getTime() + ownData.activePenalty!.durationMinutes * 60 * 1000;
          const now = Date.now();
          const remainingMillis = endTime - now;

          if (remainingMillis <= 0) {
            setPenaltyTimeRemaining(null); 
            // Optimistically update the local participant details
            setCurrentParticipantDetails(prevDetails => {
              if (prevDetails && prevDetails.activePenalty) {
                return {
                  ...prevDetails,
                  activePenalty: null,
                  isMuted: false // Assuming penalty removal always un-mutes
                };
              }
              return prevDetails;
            });
          } else {
            const remainingSecondsTotal = Math.ceil(remainingMillis / 1000);
            const minutes = Math.floor(remainingSecondsTotal / 60);
            const seconds = remainingSecondsTotal % 60;
            setPenaltyTimeRemaining(`${minutes}m ${seconds < 10 ? '0' : ''}${seconds}s`);
          }
        };

        updateCountdown(); // Initial call
        const intervalId = setInterval(updateCountdown, 1000); // Update every second
        return () => clearInterval(intervalId); // Cleanup interval on component unmount or when penalty changes
      } else {
        setPenaltyTimeRemaining(null); // No active penalty or invalid penalty data
      }
    } else {
      setCurrentParticipantDetails(null);
      setPenaltyTimeRemaining(null);
    }
  }, [userId, participants]);

  // Effect for fetching ALL DMs and preparing contact summaries for the INBOX
  useEffect(() => {
    if (!sessionId || !userId || !participants.length) {
      setDmContactSummaries([]);
      return;
    }

    const allDmsQuery = query(
      collection(db, "sessions", sessionId, "directMessages"),
      orderBy("timestamp", "desc") // Order by newest first to easily find the last message
    );

    const unsubscribe = onSnapshot(allDmsQuery, (snapshot) => {
      const messagesFromDb: MessageType[] = [];
      snapshot.forEach(doc => messagesFromDb.push({ id: doc.id, ...doc.data() } as MessageType));
      console.log("[DM Inbox] Fetched raw messages from DB for inbox summary:", messagesFromDb.length);

      const relevantMessages = messagesFromDb.filter(
        msg => msg.senderUserId === userId || msg.recipientId === userId
      );
      console.log("[DM Inbox] Relevant messages for current user (", userId, ") for inbox summary:", relevantMessages.length, relevantMessages.map(m => ({s:m.senderUserId, r:m.recipientId, c:m.content?.substring(0,10)})));

      // NEU: Debug-Ausgabe für alle relevanten Nachrichten, die "admin" im senderId oder type enthalten
      const potentialAdminMessages = relevantMessages.filter(msg => 
        (msg.senderUserId && msg.senderUserId.toLowerCase().includes('admin')) ||
        msg.senderType === 'admin'
      );
      console.log("[DM Inbox] Potential admin messages:", potentialAdminMessages.length);
      if (potentialAdminMessages.length > 0) {
        console.log("[DM Inbox] First potential admin message structure:", JSON.parse(JSON.stringify(potentialAdminMessages[0])));
      }

      const partnerIds = new Set<string>();
      relevantMessages.forEach(msg => {
        if (msg.senderUserId !== userId) partnerIds.add(msg.senderUserId!); 
        if (msg.recipientId !== userId) partnerIds.add(msg.recipientId!); 
      });
      console.log("[DM Inbox] Potential partnerIds:", Array.from(partnerIds));

      const summaries: DmContactSummary[] = Array.from(partnerIds).map(partnerId => {
        console.log(`[DM Inbox] Processing partnerId: ${partnerId} for contact summary.`);
        let partnerDetails = participants.find(p => p.userId === partnerId);
        
        if (partnerDetails) {
          console.log(`[DM Inbox] Found participant details for ${partnerId} in main participants list.`);
        } else {
          console.log(`[DM Inbox] Participant ${partnerId} NOT found in main list. Checking if it's an Admin ID.`);
        }

        // Handle Admin as a special partner if not in participants list
        // Erweiterter Regex: Erkennt verschiedene Admin ID Formate
        const adminSenderIdPatterns = [
          /^admin_user_for_session_.+/, // Original-Pattern
          /^ADMIN_.+/, // ADMIN_PREFIX Format
          /^admin$/i,  // Einfach "admin"
          /admin/i     // Enthält "admin" irgendwo
        ];
        
        const isAdminPartner = adminSenderIdPatterns.some(pattern => pattern.test(partnerId));
        console.log(`[DM Inbox] Is partnerId ${partnerId} an admin according to patterns? ${isAdminPartner}`);

        if (!partnerDetails && isAdminPartner) {
            console.log(`[DM Inbox] Detected Admin senderId (${partnerId}) not in participants. Creating mock partner.`);
            
            // Finde alle Nachrichten von diesem Admin-Partner
            const adminMessages = relevantMessages.filter(
              msg => msg.senderUserId === partnerId || msg.recipientId === partnerId
            );
            console.log(`[DM Inbox] Found ${adminMessages.length} messages with this admin ID`);
            
            // Optional: Verwende Informationen aus den Nachrichten, wenn verfügbar
            const firstAdminMsg = adminMessages[0];
            const adminDisplayName = firstAdminMsg?.senderName || "Admin-Team";
            const adminAvatarFallback = firstAdminMsg?.avatarFallback || "AT";
            
            partnerDetails = {
                id: partnerId,
                userId: partnerId,
                displayName: adminDisplayName,
                realName: "System-Admin",
                avatarFallback: adminAvatarFallback,
                isBot: false,
                role: "Administrator",
                roleId: "admin-role",
                status: "Beigetreten",
                joinedAt: new Timestamp(0,0),
                updatedAt: new Timestamp(0,0),
                colorSeed: simpleHash(adminDisplayName),
            };
        }

        if (!partnerDetails) { 
             console.warn(`[DM Inbox] FINAL CHECK: Participant details for partnerId ${partnerId} STILL not found (and not identified as Admin or Admin mock creation failed). Skipping summary for this partner.`);
             return null; 
        }
        console.log(`[DM Inbox] Successfully got partnerDetails for ${partnerId}:`, partnerDetails?.displayName);

        const conversationMessages = relevantMessages.filter(
          msg => (msg.senderUserId === userId && msg.recipientId === partnerId) || 
                 (msg.senderUserId === partnerId && msg.recipientId === userId)
        );
        
        const lastMessage = conversationMessages.length > 0 ? conversationMessages[0] : null; // Already sorted by desc timestamp
        
        const unreadCount = conversationMessages.filter(
          msg => msg.recipientId === userId && msg.senderUserId === partnerId && !msg.isRead
        ).length;

        return {
          partner: partnerDetails,
          lastMessage,
          unreadCount
        };
      }).filter(Boolean) as DmContactSummary[]; 
      
      // Sort summaries: those with unread messages first, then by last message timestamp
      summaries.sort((a, b) => {
        if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
        if (b.unreadCount > 0 && a.unreadCount === 0) return 1;
        if (a.lastMessage?.timestamp && b.lastMessage?.timestamp) {
          const tsA = a.lastMessage.timestamp as Timestamp;
          const tsB = b.lastMessage.timestamp as Timestamp;
          return tsB.toMillis() - tsA.toMillis(); // Newest first
        }
        if (a.lastMessage) return -1; // a has a message, b doesn't
        if (b.lastMessage) return 1;  // b has a message, a doesn't
        return 0;
      });
      console.log("[DM Inbox] Final DM Contact Summaries for user (", userId, "):", summaries.map(s => ({p:s.partner.displayName, unread: s.unreadCount, lastMsg: s.lastMessage?.content?.substring(0,10) })));
      setDmContactSummaries(summaries);
    }, (error) => {
      console.error("Error fetching all DMs for inbox:", error);
      toast({variant: "destructive", title: "Inbox Fehler", description: "Konversationen konnten nicht geladen werden."})  
    });

    return () => unsubscribe();
  }, [sessionId, userId, participants, toast]); // Re-run if participants change, to get correct partnerDetails

  // Placeholder Effect for fetching DMs (THIS ONE IS FOR UNREAD COUNT BADGE/TOASTS)
  useEffect(() => {
    if (!sessionId || !userId) return;
    // This is a placeholder. In a real implementation, you would query a 'directMessages' collection
    // filtered by senderId or recipientId === userId.
    console.log("Placeholder: Listening for direct messages for user:", userId);
    // setUnreadDms([]); // Reset on user/session change
    // setActiveDmThread([]);

    // Example: Dummy listener for unread DMs (replace with actual Firestore listener)
    const unsubDms = onSnapshot(
        query(
            collection(db, "sessions", sessionId, "directMessages"),
            where("recipientId", "==", userId),
            where("isRead", "==", false),
            orderBy("timestamp", "desc")
        ),
        (snapshot) => {
            const newUnreadDms: MessageType[] = [];
            snapshot.forEach(doc => newUnreadDms.push({ id: doc.id, ...doc.data()} as MessageType));
            setUnreadDms(newUnreadDms);
            if (newUnreadDms.length > 0 && !showInbox && !showDmPopup) { // Only toast if inbox/popup not already open
                 toast({
                    title: `🚨 Neue Direktnachricht!`, // Emoji hinzugefügt
                    description: `Du hast ${newUnreadDms.length} neue ungelesene Nachricht${newUnreadDms.length > 1 ? 'en' : ''}.`,
                    duration: 5000,
                });
            }
        },
        (error) => {
            console.error("Error fetching unread DMs:", error);
            // toast({ variant: "destructive", title: "DM Fehler", description: "Ungelesene DMs konnten nicht geladen werden."});
        }
    );
    
    return () => {
      console.log("Placeholder: Unsubscribing from direct messages for user:", userId);
      unsubDms();
    };
  }, [sessionId, userId, toast, showInbox, showDmPopup]);

  // New Effect for listening to Admin Broadcast DMs
  useEffect(() => {
    if (!sessionId || !userId || isAdminView) {
      console.log("[Admin DM Listener] Conditions not met or isAdminView. Listener inactive. SessionId:", sessionId, "UserId:", userId, "isAdminView:", isAdminView);
      setAdminBroadcastInboxMessages([]);
      setUnreadAdminBroadcastCount(0);
      return;
    }
    console.log(`[Admin DM Listener] ACTIVE for session: ${sessionId}, user: ${userId}`);

    // Query for ALL admin broadcasts meant for this user (read or unread)
    // This is because we want to populate an inbox view with all of them.
    // The overlay will still only trigger for the latest unread.
    const allAdminBroadcastsForUserQuery = query(
      collection(db, "sessions", sessionId, "messages"),
      where("isAdminBroadcast", "==", true),
      where("recipientId", "==", userId), // Already set by our backend function for all broadcast types
      orderBy("timestamp", "desc")
    );

    const unsubscribeAdminDms = onSnapshot(allAdminBroadcastsForUserQuery, (snapshot) => {
      console.log("[Admin DM Listener] Snapshot for ALL admin broadcasts for user received. Empty:", snapshot.empty, "Size:", snapshot.size);
      const allReceivedBroadcasts: MessageType[] = [];
      let newUnreadCount = 0;
      snapshot.forEach(doc => {
        const msg = { id: doc.id, ...doc.data() } as MessageType;
        allReceivedBroadcasts.push(msg);
        if (!msg.isRead) {
          newUnreadCount++;
        }
      });
      
      setAdminBroadcastInboxMessages(allReceivedBroadcasts); // beinhaltet gelesene und ungelesene
      setUnreadAdminBroadcastCount(newUnreadCount);
      console.log("[Admin DM Listener] Total admin broadcasts for inbox:", allReceivedBroadcasts.length, "Unread count:", newUnreadCount);

      // Logic for the overlay (triggers on the latest unread, if any new one appears)
      const latestUnreadBroadcast = allReceivedBroadcasts.find(msg => !msg.isRead);

      if (latestUnreadBroadcast) {
        console.log("[Admin DM Listener] Latest UNREAD Admin DM to process for overlay:", JSON.parse(JSON.stringify(latestUnreadBroadcast)));
        
        // Only trigger overlay if it's a new message not currently shown
        if (adminDmToDisplay?.id !== latestUnreadBroadcast.id && showAdminDmOverlay === false) {
          toast({
            title: "🚨 EILMELDUNG VOM ADMIN!", // Emoji hinzugefügt
            description: "Eine wichtige Information wurde empfangen.",
            duration: 3000, 
            variant: "destructive",
          });
          console.log("[Admin DM Listener] Toast for new Admin DM shown for overlay.");

          setTimeout(async () => {
            console.log("[Admin DM Listener] Setting Admin DM for overlay display:", JSON.parse(JSON.stringify(latestUnreadBroadcast)));
            setAdminDmToDisplay(latestUnreadBroadcast);
            setShowAdminDmOverlay(true);
            // Marking as read is now handled when the overlay is closed or an inbox item is clicked.
          }, 2500); 
        }
      } else {
        console.log("[Admin DM Listener] No new unread admin DMs for overlay found.");
      }
    }, (error) => {
      console.error("[Admin DM Listener] Error fetching admin broadcast DMs:", error);
    });

    return () => {
      console.log(`[Admin DM Listener] CLEANUP for session: ${sessionId}, user: ${userId}`);
      unsubscribeAdminDms();
    };
  }, [sessionId, userId, isAdminView, toast, adminDmToDisplay, showAdminDmOverlay]); // Added showAdminDmOverlay

  const handleOpenDmPopup = (recipient: Participant) => {
    if (recipient.userId === userId) {
      toast({title: "Hinweis", description: "Du kannst dir keine Nachrichten selbst schreiben."});
      return;
    }
    setDmRecipient(recipient);
    setShowDmPopup(true);
    setDmContent(""); // Clear previous content
    // Mark DMs from this recipient as read when opening the popup (optional)
    // loadAndMarkDmThread(recipient.userId);
  };

  const handleCloseDmPopup = () => {
    setShowDmPopup(false);
    setDmRecipient(null);
    setActiveDmThread([]);
  };

  const handleSendDm = async () => {
    if (!dmContent.trim() && !dmSelectedImageFile) {
        toast({variant: "destructive", title: "Leere DM", description: "Bitte gib eine Nachricht ein oder wähle ein Bild."});
        return;
    }
    if (!dmRecipient || !userId || !userDisplayName || !userAvatarFallback || !currentScenario) {
      toast({variant: "destructive", title: "DM Senden Fehlgeschlagen", description: "Details fehlen."});
      return;
    }
    setIsSendingDm(true);
    setDmImageUploadProgress(null);

    let uploadedDmImageUrl: string | undefined = undefined;
    let uploadedDmImageFileName: string | undefined = undefined;

    if (dmSelectedImageFile) {
      setDmImageUploadProgress(0);
      const file = dmSelectedImageFile;
      const fileName = `${Date.now()}_${file.name}`;
      const imageRef = storageRef(storage, `sessionDmImages/${sessionId}/${userId}_${dmRecipient.userId}/${fileName}`); // Eindeutiger Pfad für DM Bilder
      try {
        const uploadTask = uploadBytesResumable(imageRef, file);
        await new Promise<void>((resolve, reject) => {
          uploadTask.on('state_changed',
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setDmImageUploadProgress(progress);
            },
            (error) => {
              console.error("DM Image upload error:", error);
              toast({ variant: "destructive", title: "DM Bild-Upload fehlgeschlagen", description: error.message });
              reject(error);
            },
            async () => { 
              uploadedDmImageUrl = await getDownloadURL(uploadTask.snapshot.ref);
              uploadedDmImageFileName = fileName;
              resolve(); 
            }
          );
        });
      } catch (error) {
        setIsSendingDm(false);
        setDmImageUploadProgress(null);
        return;
      }
    }

    try {
      const dmData: Partial<MessageType> = {
        senderUserId: userId, 
        senderName: userDisplayName,
        avatarFallback: userAvatarFallback,
        recipientId: dmRecipient.userId,
        content: dmContent.trim(),
        timestamp: serverTimestamp(),
        isRead: false,
      };

      if (uploadedDmImageUrl) dmData.imageUrl = uploadedDmImageUrl;
      if (uploadedDmImageFileName) dmData.imageFileName = uploadedDmImageFileName;

      console.log("[DM SEND] dmData to be sent to Firestore:", JSON.parse(JSON.stringify(dmData))); // Log data before sending

      await addDoc(collection(db, "sessions", sessionId, "directMessages"), dmData);
      setDmContent("");
      setDmSelectedImageFile(null);
      setDmImagePreviewUrl(null);
      // toast({title: "DM gesendet!", description: `Nachricht an ${dmRecipient.displayName} wurde gesendet.`});
    } catch (error: any) {
      console.error("Error sending DM:", error);
      toast({variant: "destructive", title: "DM Senden Fehlgeschlagen", description: error.message});
    } finally {
      setIsSendingDm(false);
      setDmImageUploadProgress(null);
    }
  };

  const handleDmEmojiSelect = useCallback((emoji: string) => {
    setDmContent(prev => prev + emoji);
    setShowDmEmojiPicker(false); 
  }, []);

  const handleDmImageFileSelected = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      if (file.size > 5 * 1024 * 1024) { 
        toast({ variant: "destructive", title: "Datei zu groß", description: "Bitte wählen Sie ein Bild unter 5MB." });
        return;
      }
      setDmSelectedImageFile(file);
      setDmImagePreviewUrl(URL.createObjectURL(file));
      setDmImageUploadProgress(null);
    }
  }, [toast]);

  const handleDmRemoveSelectedImage = useCallback(() => {
    setDmSelectedImageFile(null);
    if (dmImagePreviewUrl) {
      URL.revokeObjectURL(dmImagePreviewUrl);
      setDmImagePreviewUrl(null);
    }
    if (dmFileInputRef.current) { 
      dmFileInputRef.current.value = "";
    }
    setDmImageUploadProgress(null);
  }, [dmImagePreviewUrl]);

  // Wiederhergestellte/angepasste Funktion zum Laden eines DM-Threads und Markieren als gelesen
  const loadAndMarkDmThread = useCallback(async (otherUserId: string) => {
    if (!sessionId || !userId) {
      console.error("[DM LOAD] Session ID or User ID missing in loadAndMarkDmThread");
      return Promise.resolve(() => {}); 
    }
    setShowInbox(false); 
    console.log(`[DM LOAD] Called for otherUserId: ${otherUserId} (current userId: ${userId})`); // Log otherUserId

    const dmQuery = query(
        collection(db, "sessions", sessionId, "directMessages"),
        orderBy("timestamp", "asc")
    );

    let tempRecipient = participants.find(p => p.userId === otherUserId);
    if (!tempRecipient) {
      console.warn(`[DM] Recipient with userId ${otherUserId} not found in participants list.`);
      
      // NEU: Erstelle Admin-Partner, ähnlich wie bei dmContactSummaries (wenn es ein Admin ist)
      const adminSenderIdPatterns = [
        /^admin_user_for_session_.+/, // Original-Pattern
        /^ADMIN_.+/, // ADMIN_PREFIX Format
        /^admin$/i,  // Einfach "admin"
        /admin/i     // Enthält "admin" irgendwo
      ];
      
      const isAdminPartner = adminSenderIdPatterns.some(pattern => pattern.test(otherUserId));
      console.log(`[DM LOAD] Is otherUserId an admin according to patterns? ${isAdminPartner}`);
      
      if (isAdminPartner) {
        console.log("[DM LOAD] Creating mock admin recipient for chat");
        
        // Vorläufig setzen, evtl. später mit echten Daten aus Nachrichten ersetzen
        tempRecipient = {
          id: otherUserId,
          userId: otherUserId,
          displayName: "Admin-Team",
          realName: "System-Admin",
          avatarFallback: "AT",
          isBot: false,
          role: "Administrator",
          roleId: "admin-role",
          status: "Beigetreten",
          joinedAt: new Timestamp(0,0),
          updatedAt: new Timestamp(0,0),
          colorSeed: simpleHash("Admin-Team"),
        };
      }
    }
    
    if (tempRecipient) {
        setDmRecipient(tempRecipient); 
    } else {
        console.error(`[DM] Could not create recipient for userId ${otherUserId} - cannot open chat`);
        toast({ variant: "destructive", title: "Chat-Fehler", description: "Konversationspartner konnte nicht gefunden werden." });
        return Promise.resolve(() => {});
    }
    
    setActiveDmThread([]); // Clear previous thread before loading new one

    const unsubscribeThread = onSnapshot(dmQuery, async (snapshot) => {
        const threadMessages: MessageType[] = [];
        const batchUpdates: Promise<void>[] = []; 

        console.log(`[DM LOAD THREAD for ${otherUserId}] Raw messages from snapshot before filtering:`, snapshot.docs.length);
        // snapshot.forEach(doc => {
        //   const rawMsgData = doc.data();
        //   console.log(`[DM LOAD THREAD for ${otherUserId}] Raw Msg ID: ${doc.id}, Sender: ${rawMsgData.senderUserId || rawMsgData.senderId}, Recipient: ${rawMsgData.recipientId}, Content: ${rawMsgData.content?.substring(0,30)}, Img: ${rawMsgData.imageUrl ? 'Yes' : 'No'}`);
        // });

        snapshot.forEach(doc => {
            const msgData = doc.data();
            const msg = { id: doc.id, ...msgData } as MessageType;
            
            const actualSenderId = msgData.senderUserId || msgData.senderId;

            const isFromOtherUserToCurrentUser = actualSenderId === otherUserId && msg.recipientId === userId;
            const isFromCurrentUserToOtherUser = actualSenderId === userId && msg.recipientId === otherUserId;

            // console.log(`[DM LOAD THREAD for ${otherUserId}] Processing Msg ID: ${msg.id}, ActualSender: ${actualSenderId}, Recipient: ${msg.recipientId}, isFromOther: ${isFromOtherUserToCurrentUser}, isFromCurrent: ${isFromCurrentUserToOtherUser}`);

            if (isFromOtherUserToCurrentUser || isFromCurrentUserToOtherUser) {
                threadMessages.push(msg);
                if (isFromOtherUserToCurrentUser && !msg.isRead) {
                    batchUpdates.push(updateDoc(doc.ref, { isRead: true }));
                }
            }
        });
        
        console.log(`[DM LOAD THREAD for ${otherUserId}] Filtered threadMessages count:`, threadMessages.length, threadMessages.map(m => ({s:m.senderUserId, r:m.recipientId, c:m.content?.substring(0,10)})));
        setActiveDmThread(threadMessages);

        if (!showDmPopup && threadMessages.length > 0) { // Only show popup if messages exist
          setShowDmPopup(true);
        }

        if (batchUpdates.length > 0) {
            try {
                await Promise.all(batchUpdates);
                // Optimistically update unreadDms state for the current user
                setUnreadDms(prev => prev.filter(dm => dm.senderUserId !== otherUserId || dm.recipientId !== userId));
            } catch (error) {
                console.error("[DM] Error marking DMs as read in Firestore:", error);
            }
        }
    }, (error) => {
        console.error("[DM] Error fetching DM thread snapshot:", error);
        toast({variant: "destructive", title: "DM Fehler", description: "Nachrichtenverlauf konnte nicht geladen werden."});
    });
    
    return unsubscribeThread;
  }, [sessionId, userId, participants, toast, showDmPopup]);

  if (isLoadingPage && !pageError) {
    return <LoadingScreen text={isAdminView ? "Admin Chat-Ansicht wird geladen..." : "Chat wird geladen..."} />;
  }

  // Determine overall page/component error state
  const finalPageError = pageError || 
                         (sessionData === null && !isLoadingSessionDataHook ? "Sitzungsdaten konnten nicht geladen werden." : null) ||
                         (currentScenario === undefined && !isLoadingScenario && sessionData?.scenarioId ? "Szenario konnte nicht geladen werden." : null) ||
                         (!isAdminView && (!userDisplayName || !userRole) && !isLoadingUserDetails ? "Benutzerdetails nicht vollständig." : null);

  if (finalPageError && !isAdminView) { // Non-admins see a more user-friendly error and are kicked
     return (
      <div className="flex h-screen w-full items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader><CardTitle className="text-destructive flex items-center"><AlertTriangle className="mr-2"/>Fehler</CardTitle></CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{finalPageError}</p>
            <Button onClick={() => router.push('/')} variant="outline" className="mt-4">Zur Startseite</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn("flex h-[calc(100vh-var(--header-height,0px))] bg-background", isAdminView && "border rounded-md")}>
      {/* Left Column: Participants List and User Info Box */}
      <div className={cn("w-64 md:w-72 lg:w-80 border-r flex flex-col", isAdminView ? "bg-card" : "bg-muted/40")}>
        {/* Participant List (ChatSidebar) - takes available height, becomes scrollable internally */}
                 <ChatSidebar
                    participants={participants}
                    currentUserId={userId}
                isLoadingParticipants={isLoadingParticipantsHook}
                isAdminView={isAdminView}
          getParticipantColorClasses={getParticipantColorClasses}
          onInitiateDm={(participant: Participant) => {
            setShowInbox(false); // Close inbox if open
            loadAndMarkDmThread(participant.userId);
          }}
        />
        {/* User Info Box - fixed height, shown below participant list */}
        {!isAdminView && (
          <div className="p-4 border-t bg-background/80 backdrop-blur-sm shadow-sm">
            <h3 className="font-semibold text-base mb-2 text-primary">Deine Infos</h3>
            {isLoadingUserDetails || !currentParticipantDetails ? (
              <div className="text-sm text-muted-foreground flex items-center"><Loader2 className="h-3 w-3 animate-spin mr-1.5"/>Lade deine Daten...</div>
            ) : (
              <div className="space-y-2.5 text-sm">
                <div className="flex flex-col">
                  <span className="font-medium">Name:</span>
                  <span className="text-foreground/90">{currentParticipantDetails.displayName} ({currentParticipantDetails.realName})</span>
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center">
                    <span className="font-medium mr-1">Rolle:</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="link" className="p-0 h-auto text-foreground underline underline-offset-2 decoration-dashed">
                          {currentParticipantDetails.role}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 p-3 text-sm">
                        <p className="font-semibold mb-1">{currentParticipantDetails.role}</p>
                        <p className="text-muted-foreground">
                          {/* Hier würde normaler Weise die Rollenbeschreibung aus dem Szenario */}
                          {currentScenario?.humanRolesConfig?.find((r: { id: string }) => r.id === currentParticipantDetails.roleId)?.description || 
                           "Keine Rollenbeschreibung verfügbar. Bitte beachten Sie die Anweisungen des Admins."}
                        </p>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* Admin-Mitteilungen Vorschau */}
                {adminBroadcastInboxMessages.length > 0 && (
                  <div className="pt-2 mt-1 border-t">
                    <h4 className="font-medium text-sm mb-1.5 flex items-center">
                      <AlertTriangle className="h-4 w-4 mr-1.5 text-red-500" /> Admin-Mitteilungen:
                    </h4>
                    <Button 
                      variant="outline" 
                      className={cn(
                        "w-full text-left justify-start py-1.5 px-2 h-auto text-xs", 
                        unreadAdminBroadcastCount > 0 ? "border-red-500 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400" : ""
                      )}
                      onClick={() => setShowAdminBroadcastInboxModal(true)}
                    >
                      {unreadAdminBroadcastCount > 0 ? (
                        <div className="flex items-center w-full justify-between">
                          <span className="truncate">{adminBroadcastInboxMessages[0].content}</span>
                          <span className="ml-1 h-2 w-2 rounded-full bg-red-500 animate-pulse flex-shrink-0"></span>
                        </div>
                      ) : (
                        <span className="truncate">{adminBroadcastInboxMessages[0].content}</span>
                      )}
                    </Button>
                  </div>
                )}

                <div className="pt-2 mt-1 border-t">
                  <h4 className="font-medium text-sm mb-1.5">Inbox:</h4>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-xs p-1 h-auto justify-start hover:bg-muted/50 w-full"
                    onClick={() => {
                        setShowInbox(true);
                    }}
                  >
                    <MessageSquare className="h-3.5 w-3.5 mr-1.5 text-primary"/>
                    {unreadDms.length > 0 ? (
                        <span className='flex items-center justify-between w-full'>
                            <span>{unreadDms.length} ungelesene Nachricht{unreadDms.length > 1 ? 'en' : ''}</span>
                            <span className="ml-1.5 h-2 w-2 rounded-full bg-blue-500 animate-pulse"></span>
                        </span>
                    ) : (
                        "Nachrichten anzeigen"
                    )}
                  </Button>
                </div>
                <div className="pt-2 mt-1 border-t">
                  <h4 className="font-medium text-sm mb-1.5">Status:</h4>
                  {currentParticipantDetails.isMuted && !currentParticipantDetails.activePenalty && <Badge variant="destructive" className="text-xs">Stumm</Badge>}
                  {currentParticipantDetails.activePenalty && (
                    <Badge 
                      variant={currentParticipantDetails.activePenalty.type === 'red' ? "destructive" : "default"} 
                      className={cn("text-xs", currentParticipantDetails.activePenalty.type === 'yellow' && "bg-yellow-500 text-black")}
                    >
                      {currentParticipantDetails.activePenalty.description} {penaltyTimeRemaining && 
                        <span className="ml-1.5 flex items-center">
                          <Loader2 className="h-3 w-3 animate-spin mr-1" /> 
                          {penaltyTimeRemaining}
                        </span>
                      }
                    </Badge>
                  )}
                  {!currentParticipantDetails.isMuted && !currentParticipantDetails.activePenalty && <Badge variant="default" className="text-xs bg-green-500">Aktiv</Badge>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col overflow-hidden"> {/* Added overflow-hidden here */}
        {finalPageError && isAdminView && (
          <div className="p-4 text-center text-muted-foreground flex items-center justify-center h-full bg-background">
              {isLoadingSessionDataHook || (isLoadingScenario && !currentScenario && sessionData?.scenarioId) ?
                <><Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" /> Lade Chat-Daten für Admin-Vorschau...</> :
                <><AlertTriangle className="mr-2 h-5 w-5 text-destructive" /> Wichtige Sitzungs- oder Szenariodaten fehlen.</>}
          </div>
        )}
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
              onOpenImageModal={(imageUrl: string) => { console.log("Opening image modal for:", imageUrl); /* TODO: Implement Image Modal */ }}
              onOpenDm={(recipient: Participant) => loadAndMarkDmThread(recipient.userId)}
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
        </div>

      {/* DM Popup / Overlay */}
      {showDmPopup && dmRecipient && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 flex items-center justify-center p-4" onClick={(e) => { e.stopPropagation(); handleCloseDmPopup();}}>
          <Card className="w-full max-w-lg shadow-2xl relative bg-card text-card-foreground" onClick={(e) => e.stopPropagation()}> 
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div className="flex items-center">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => {
                    setShowDmPopup(false);
                    setDmRecipient(null);
                    setActiveDmThread([]);
                    setShowInbox(true);
                  }}
                  className="mr-2 h-7 w-7"
                  title="Zurück zur Inbox"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <CardTitle className="text-lg">
                  Direktnachricht an {dmRecipient.displayName}
                </CardTitle>
      </div>
              <Button variant="ghost" size="icon" onClick={handleCloseDmPopup} className="h-7 w-7">
                <XIcon className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[40vh] border-y p-4 bg-muted/30">
                {activeDmThread.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Beginne eine neue Unterhaltung.</p>}
                {activeDmThread.map(msg => (
                  <div key={msg.id} className={cn(
                    "mb-2 p-2 rounded-md text-sm max-w-[80%]",
                    msg.senderUserId === userId ? "bg-primary text-primary-foreground ml-auto" : "bg-secondary text-secondary-foreground mr-auto"
                  )}>
                    {msg.imageUrl && (
                      <div className="my-1.5 relative aspect-video max-w-xs mx-auto">
                        <NextImage 
                          src={msg.imageUrl} 
                          alt="Gesendetes Bild in DM" 
                          layout="fill" 
                          objectFit="contain" 
                          className="rounded"
                          // Potentially add onClick to open a modal for larger view
                        />
                      </div>
                    )}
                    {msg.content && <p className='whitespace-pre-wrap'>{msg.content}</p>}
                    <p className={cn("text-xs opacity-70 mt-1", msg.senderUserId === userId ? "text-right" : "text-left")}>
                        {msg.timestamp instanceof Timestamp ? msg.timestamp.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "Senden..."}
                    </p>
                  </div>
                ))}
                <div ref={dmMessagesEndRef} />
              </ScrollArea>
              <div className="p-3 space-y-2">
                <Textarea
                  value={dmContent}
                  onChange={(e) => setDmContent(e.target.value)}
                  placeholder={`Deine Nachricht an ${dmRecipient.displayName}...`}
                  className="min-h-[60px]"
                  disabled={isSendingDm}
                />
                {dmImagePreviewUrl && (
                  <div className="mt-2 relative w-32 h-32 group">
                    <NextImage src={dmImagePreviewUrl} alt="DM Bildvorschau" layout="fill" objectFit="cover" className="rounded-md" />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-1 right-1 h-6 w-6 opacity-70 group-hover:opacity-100"
                      onClick={handleDmRemoveSelectedImage}
                      disabled={isSendingDm}
                    >
                      <XIcon className="h-4 w-4" />
                    </Button>
                    {dmImageUploadProgress !== null && dmImageUploadProgress < 100 && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-md">
                            <Loader2 className="h-6 w-6 animate-spin text-white"/>
                        </div>
                    )}
                  </div>
                )}
                <div className="flex items-center justify-between gap-2 mt-2">
                  <div className="flex items-center gap-2">
                    <Popover open={showDmEmojiPicker} onOpenChange={setShowDmEmojiPicker}>
                        <PopoverTrigger asChild>
                        <Button variant="outline" size="icon" className="shrink-0" title="Emoji einfügen" disabled={isSendingDm}>
                            <Smile className="h-5 w-5" />
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent 
                            className="w-auto p-0 mb-1 max-w-[300px] sm:max-w-xs z-50" 
                            side="top" 
                            align="start"
                        >
                            <Tabs defaultValue={emojiCategories[0].name} className="w-full">
                                <TabsList className="grid w-full grid-cols-5 h-auto p-1">
                                    {emojiCategories.map(category => (
                                    <TabsTrigger key={category.name} value={category.name} className="text-xl p-1.5 h-9" title={category.name}>
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
                                            className="text-xl p-0 h-9 w-9 hover:bg-muted/50"
                                            onClick={() => handleDmEmojiSelect(emoji)}
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
                    <Button variant="outline" size="icon" className="shrink-0" title="Bild anhängen" onClick={() => dmFileInputRef.current?.click()} disabled={isSendingDm}>
                        <Paperclip className="h-5 w-5" />
                    </Button>
                    <input type="file" accept="image/*" ref={dmFileInputRef} onChange={handleDmImageFileSelected} className="hidden" />
                  </div>
                  <Button onClick={handleSendDm} disabled={(!dmContent.trim() && !dmSelectedImageFile) || isSendingDm} className="w-full max-w-[calc(100%-100px)]">
                    {isSendingDm ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                    Senden
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Inbox Overlay/Modal */}
      {showInbox && (
         <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 flex items-center justify-center p-4" onClick={() => setShowInbox(false)}>
            <Card className="w-full max-w-md shadow-2xl relative bg-card text-card-foreground" onClick={(e) => e.stopPropagation()}>
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center justify-between">
                        <span>Deine Inbox</span>
                        <Button variant="ghost" size="icon" onClick={() => setShowInbox(false)} className="h-7 w-7">
                            <XIcon className="h-5 w-5" />
                        </Button>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {/* NEU: Button für Admin Broadcast Inbox */}
                    {adminBroadcastInboxMessages.length > 0 && (
                        <Button
                            variant="outline"
                            className="w-full justify-start p-3 mb-3 border-red-500 hover:bg-red-500/10"
                            onClick={() => {
                                setShowAdminBroadcastInboxModal(true);
                                setShowInbox(false); // Hauptinbox schließen
                            }}
                        >
                            <AlertTriangle className="h-5 w-5 mr-3 text-red-500 flex-shrink-0" />
                            <div className="flex-1 text-left">
                                <p className="font-semibold text-red-600">Admin Mitteilungen</p>
                                {unreadAdminBroadcastCount > 0 ? (
                                    <p className="text-xs text-red-500/90">{unreadAdminBroadcastCount} neue Mitteilung{unreadAdminBroadcastCount > 1 ? 'en' : ''}</p>
                                ) : (
                                    <p className="text-xs text-muted-foreground">Alle Mitteilungen gelesen</p>
                                )}
                            </div>
                            {unreadAdminBroadcastCount > 0 && <span className="ml-2 h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse"></span>}
                        </Button>
                    )}
                    {dmContactSummaries.length === 0 && adminBroadcastInboxMessages.length === 0 && <p className="text-muted-foreground text-sm text-center py-4">Keine Konversationen oder Admin-Mitteilungen vorhanden.</p>}
                    <ScrollArea className="h-[60vh] max-h-[calc(80vh-120px)] pr-2 -mr-2"> {/* Added ScrollArea here */}
                      <div className="space-y-2">
                        {dmContactSummaries.map(summary => {
                          if (!summary.partner) return null;
                          const partner = summary.partner;
                          const lastMsg = summary.lastMessage;
                          const hasUnread = summary.unreadCount > 0;
                          // Check if the last message is an unread admin broadcast TO THE CURRENT USER
                          const isUnreadAdminBroadcastToCurrentUser = lastMsg?.isAdminBroadcast === true && lastMsg?.recipientId === userId && !lastMsg?.isRead;

                          return (
                            <Button
                              key={partner.userId}
                              variant="ghost"
                              className={cn(
                                "w-full h-auto p-3 text-left flex items-start space-x-3 hover:bg-muted/80 dark:hover:bg-muted/30 rounded-md",
                                isUnreadAdminBroadcastToCurrentUser ? "border-2 border-red-500 bg-red-500/10 hover:bg-red-500/20 font-semibold" :
                                hasUnread ? "font-semibold" : "" // General unread highlight if not admin broadcast
                              )}
                              onClick={() => {
                                setShowInbox(false); 
                                loadAndMarkDmThread(partner.userId); 
                              }}
                            >
                              <Avatar className="h-10 w-10 border-2 border-border flex-shrink-0">
                                <AvatarImage src={`https://placehold.co/40x40.png?text=${partner.avatarFallback}`} alt={partner.displayName} />
                                <AvatarFallback className={cn(getParticipantColorClasses(partner.userId).bg, getParticipantColorClasses(partner.userId).text, "font-bold")}>
                                  {partner.avatarFallback}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center">
                                  <p className={cn("truncate text-sm", 
                                    isUnreadAdminBroadcastToCurrentUser ? "text-red-600 font-bold" :
                                    hasUnread ? "text-primary" : "text-foreground"
                                  )}>{partner.displayName}</p>
                                  {lastMsg?.timestamp instanceof Timestamp && (
                                    <p className={cn("text-xs shrink-0 ml-2", 
                                      isUnreadAdminBroadcastToCurrentUser ? "text-red-600/90" :
                                      hasUnread ? "text-primary/90" : "text-muted-foreground"
                                    )}>
                                      {lastMsg.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                  )}
                                </div>
                                
                                {/* Verbesserte Nachrichtenvorschau */}
                                <div className="flex items-center justify-between mt-1">
                                  <p className={cn("text-xs truncate flex items-center", 
                                    isUnreadAdminBroadcastToCurrentUser ? "text-red-600/80" :
                                    hasUnread ? "text-foreground/90 font-medium" : "text-muted-foreground"
                                  )}>
                                    {isUnreadAdminBroadcastToCurrentUser && <AlertTriangle className="h-3.5 w-3.5 inline-block mr-1 text-red-500 flex-shrink-0" />}
                                    {lastMsg?.senderUserId === userId && <span className="mr-1 opacity-80">Du:</span>}
                                    <span className="truncate">{lastMsg?.content || "Keine Nachrichten"}</span>
                                  </p>
                                  {hasUnread && (
                                    <span className={cn("ml-2 h-2.5 w-2.5 rounded-full flex-shrink-0", 
                                      isUnreadAdminBroadcastToCurrentUser ? "bg-red-500 animate-pulse" : "bg-orange-500"
                                    )}></span>
                                  )}
                                </div>
                              </div>
                            </Button>
                          );
                        })}
                      </div>
                    </ScrollArea>
                </CardContent>
            </Card>
         </div>
      )}

      {/* NEU: Modal für Admin Broadcast Inbox */}
      {showAdminBroadcastInboxModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowAdminBroadcastInboxModal(false)}>
          <Card className="w-full max-w-lg shadow-2xl relative bg-card text-card-foreground" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div className="flex items-center">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => {
                            setShowAdminBroadcastInboxModal(false);
                            setShowInbox(true); // Zurück zur Haupt-Inbox
                        }}
                        className="mr-2 h-7 w-7"
                        title="Zurück zur Inbox"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <CardTitle className="text-lg flex items-center">
                        <AlertTriangle className="h-5 w-5 mr-2 text-red-500" /> Admin Mitteilungen
                    </CardTitle>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setShowAdminBroadcastInboxModal(false)} className="h-7 w-7">
                    <XIcon className="h-5 w-5" />
                </Button>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[60vh] border-y p-4 bg-muted/30">
                {adminBroadcastInboxMessages.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Keine Admin-Mitteilungen vorhanden.</p>}
                {adminBroadcastInboxMessages.map(msg => (
                  <div 
                    key={msg.id} 
                    className={cn(
                        "mb-3 p-3 rounded-md text-sm border-l-4 cursor-pointer hover:bg-muted/60",
                        msg.isRead ? "border-muted-foreground/30 bg-muted/20" : "border-red-500 bg-red-500/5 font-medium",
                    )}
                    onClick={async () => {
                        setAdminDmToDisplay(msg); // Zum Anzeigen im bekannten Overlay
                        setShowAdminDmOverlay(true);
                        setShowAdminBroadcastInboxModal(false); // Dieses Modal schließen
                        if (!msg.isRead) {
                            try {
                                const msgRef = doc(db, "sessions", sessionId, "messages", msg.id);
                                await updateDoc(msgRef, { isRead: true });
                                // Lokal den Status aktualisieren (optional, da Listener eh neu lädt)
                                setAdminBroadcastInboxMessages(prev => prev.map(m => m.id === msg.id ? {...m, isRead: true} : m));
                                setUnreadAdminBroadcastCount(prev => Math.max(0, prev -1));
                            } catch (error) {
                                console.error("Fehler beim Markieren der Admin-Nachricht als gelesen:", error);
                            }
                        }
                    }}
                  >
                    {msg.imageUrl && (
                      <div className="mb-1.5 relative aspect-video max-w-xs">
                        <NextImage 
                          src={msg.imageUrl} 
                          alt="Admin Bild-Mitteilung" 
                          layout="fill" 
                          objectFit="contain" 
                          className="rounded"
                        />
                      </div>
                    )}
                    <p className={cn("whitespace-pre-wrap mb-1", !msg.isRead && "text-red-700 dark:text-red-400")}>{msg.content}</p>
                    <p className={cn("text-xs opacity-70", !msg.isRead ? "text-red-600/80" : "text-muted-foreground")}>
                        Empfangen: {msg.timestamp instanceof Timestamp ? msg.timestamp.toDate().toLocaleString() : "Unbekannt"}
                    </p>
                  </div>
                ))}
              </ScrollArea>
            </CardContent>
             <DialogFooter className="p-3 border-t">
                <Button variant="outline" onClick={() => setShowAdminBroadcastInboxModal(false)} className="w-full">Schließen</Button>
            </DialogFooter>
          </Card>
        </div>
      )}

      {/* Admin Broadcast DM Overlay (das existierende zum Anzeigen einer einzelnen Nachricht) */}
      {showAdminDmOverlay && adminDmToDisplay && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4" 
          onClick={async (e) => { 
            // Nur schließen, wenn auf den Hintergrund geklickt wird, nicht auf die Card selbst.
            if (e.target === e.currentTarget) {
              setShowAdminDmOverlay(false); 
              if (adminDmToDisplay && !adminDmToDisplay.isRead) {
                try {
                    const msgRef = doc(db, "sessions", sessionId, "messages", adminDmToDisplay.id);
                    await updateDoc(msgRef, { isRead: true });
                    setAdminBroadcastInboxMessages(prev => prev.map(m => m.id === adminDmToDisplay.id ? {...m, isRead: true} : m));
                    setUnreadAdminBroadcastCount(prev => Math.max(0, prev -1));
                } catch (error) {
                    console.error("Fehler beim Markieren der Admin-Nachricht als gelesen (Overlay Click):", error);
                }
              }
              setAdminDmToDisplay(null); 
            }
          }}
        >
          <Card 
            className="w-full max-w-lg shadow-2xl relative text-white border-4 border-red-700 bg-red-600 dark:bg-red-700" 
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader className="pb-3 pt-4 bg-red-700 dark:bg-red-800 rounded-t-lg">
              <div className="flex justify-between items-center">
                <CardTitle className="text-2xl font-extrabold flex items-center text-white">
                  <AlertTriangle className="h-7 w-7 mr-3 flex-shrink-0 animate-pulse" /> EILMELDUNG VOM ADMIN
                </CardTitle>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={async () => { 
                    setShowAdminDmOverlay(false); 
                    if (adminDmToDisplay && !adminDmToDisplay.isRead) {
                      try {
                          const msgRef = doc(db, "sessions", sessionId, "messages", adminDmToDisplay.id);
                          await updateDoc(msgRef, { isRead: true });
                          setAdminBroadcastInboxMessages(prev => prev.map(m => m.id === adminDmToDisplay.id ? {...m, isRead: true} : m));
                          setUnreadAdminBroadcastCount(prev => Math.max(0, prev -1));
                      } catch (error) {
                          console.error("Fehler beim Markieren der Admin-Nachricht als gelesen (X Click):", error);
                      }
                    }
                    setAdminDmToDisplay(null); 
                  }} 
                  className="h-9 w-9 text-white hover:bg-red-800 dark:hover:bg-red-900 rounded-full" // Adjusted hover for X
                >
                  <XIcon className="h-6 w-6" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="py-6 px-6 bg-red-600 dark:bg-red-700 text-white text-base leading-relaxed max-h-[60vh] overflow-y-auto"> {/* Adjusted background and text color */}
              {adminDmToDisplay.imageUrl && (
                <div className="mb-4 relative aspect-video w-full max-w-md mx-auto bg-white/10 rounded p-1"> {/* Added slight bg to image container for contrast */}
                  <NextImage 
                    src={adminDmToDisplay.imageUrl} 
                    alt="Admin Bild-Mitteilung" 
                    layout="fill" 
                    objectFit="contain" 
                    className="rounded"
                  />
                </div>
              )}
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{adminDmToDisplay.content}</p>
              <p className="text-xs text-red-200 dark:text-red-300 mt-4 pt-2 border-t border-red-500/50 dark:border-red-600/50"> {/* Adjusted text and border color for readability */}
                Gesendet vom Admin-Team am {adminDmToDisplay.timestamp instanceof Timestamp ? adminDmToDisplay.timestamp.toDate().toLocaleDateString() : '-'} um {adminDmToDisplay.timestamp instanceof Timestamp ? adminDmToDisplay.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit'}) : '-'} Uhr.
              </p>
            </CardContent>
            <CardFooter className="pt-3 bg-red-700 dark:bg-red-800 rounded-b-lg"> {/* Ensured footer matches header */}
              <Button 
                className="w-full bg-red-800 hover:bg-red-900 dark:bg-red-900 dark:hover:bg-red-950 text-white font-bold py-3 text-base"  // Dark red button
                onClick={async () => { 
                  setShowAdminDmOverlay(false); 
                  if (adminDmToDisplay && !adminDmToDisplay.isRead) {
                    try {
                        const msgRef = doc(db, "sessions", sessionId, "messages", adminDmToDisplay.id);
                        await updateDoc(msgRef, { isRead: true });
                        setAdminBroadcastInboxMessages(prev => prev.map(m => m.id === adminDmToDisplay.id ? {...m, isRead: true} : m));
                        setUnreadAdminBroadcastCount(prev => Math.max(0, prev -1));
                    } catch (error) {
                        console.error("Fehler beim Markieren der Admin-Nachricht als gelesen (Verstanden Click):", error);
                    }
                  }
                  setAdminDmToDisplay(null); 
                }}
              >
                <Check className="mr-2 h-4 w-4"/> Verstanden
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function ChatPage() { 
  const params = useParams();
  const sessionId = params?.sessionId as string; // Extract sessionId using useParams hook

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
