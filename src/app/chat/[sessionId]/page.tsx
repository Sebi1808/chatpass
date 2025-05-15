
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowDown, X, Users as UsersIcon, Bot as BotIcon, User, VolumeX, ShieldCheck, Crown, CornerDownLeft, Quote, SmilePlus, Paperclip, Send, Mic, Image as ImageIconLucide, AlertTriangle, PauseCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, Suspense, useRef, type FormEvent, type ChangeEvent, useMemo, useCallback } from "react";
import type { Scenario, Participant as ParticipantType, Message as MessageType, SessionData, DisplayMessage, DisplayParticipant } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { db, storage } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, Timestamp, doc, getDoc, where, getDocs, updateDoc, runTransaction } from "firebase/firestore";
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { useToast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils';
import { participantColors, emojiCategories } from '@/lib/config';
import { MessageInputBar } from '@/components/chat/message-input-bar';
import { MessageList } from '@/components/chat/message-list';
import { ChatSidebar } from '@/components/chat/chat-sidebar';

interface ChatPageUrlParams {
  sessionId: string;
}

interface ChatPageProps {
  params: ChatPageUrlParams;
}

interface ChatPageContentProps {
  sessionId: string;
  initialUserName?: string;
  initialUserRole?: string;
  initialUserId?: string;
  initialUserAvatarFallback?: string;
  isAdminView?: boolean;
}

const LoadingScreen = () => (
  <div className="flex h-screen w-full items-center justify-center p-4">
    <Card className="max-w-md w-full">
      <CardHeader><CardTitle>Chat wird geladen...</CardTitle></CardHeader>
      <CardContent><p>Einen Moment Geduld, die Simulation wird vorbereitet.</p></CardContent>
    </Card>
  </div>
);

// Function to create a simple hash from a string (for color selection)
const simpleHash = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
};

export function ChatPageContent({
  sessionId, // sessionId is now directly passed as a prop
  initialUserName: initialUserNameProp,
  initialUserRole: initialUserRoleProp,
  initialUserId: initialUserIdProp,
  initialUserAvatarFallback: initialUserAvatarFallbackProp,
  isAdminView = false
}: ChatPageContentProps) {
  const { toast } = useToast();
  const router = useRouter();

  // All useState, useRef calls must be at the top level, unconditionally
  const [userName, setUserName] = useState<string | null>(initialUserNameProp || null);
  const [userRole, setUserRole] = useState<string | null>(initialUserRoleProp || null);
  const [userId, setUserId] = useState<string | null>(initialUserIdProp || null);
  const [userAvatarFallback, setUserAvatarFallback] = useState<string>(initialUserAvatarFallbackProp || "??");

  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [lastMessageSentAt, setLastMessageSentAt] = useState<number>(0);
  const [cooldownRemainingSeconds, setCooldownRemainingSeconds] = useState<number>(0);

  const [currentScenario, setCurrentScenario] = useState<Scenario | undefined>(undefined);
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [participants, setParticipants] = useState<DisplayParticipant[]>([]);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const scrollAreaRef = useRef<null | HTMLDivElement>(null);
  const viewportRef = useRef<null | HTMLDivElement>(null);

  const [showScrollToBottomButton, setShowScrollToBottomButton] = useState(false);

  const [isLoadingUserDetails, setIsLoadingUserDetails] = useState(!isAdminView && !initialUserNameProp);
  const [isChatDataLoading, setIsChatDataLoading] = useState(true);

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
  
  // Fetch scenarios from lib (assuming it's a static list for now)
  useEffect(() => {
    // This dynamic import is not ideal for static data.
    // Consider passing scenarios as a prop or importing directly if truly static.
    import('@/lib/scenarios').then(module => {
      const scenario = module.scenarios.find(s => s.id === sessionId);
      setCurrentScenario(scenario);
    });
  }, [sessionId]);


  useEffect(() => {
    if (!isAdminView && (!initialUserNameProp || !initialUserRoleProp || !initialUserIdProp || !initialUserAvatarFallbackProp)) {
      const nameFromStorage = localStorage.getItem(`chatUser_${sessionId}_name`);
      const roleFromStorage = localStorage.getItem(`chatUser_${sessionId}_role`);
      const userIdFromStorage = localStorage.getItem(`chatUser_${sessionId}_userId`);
      const avatarFallbackFromStorage = localStorage.getItem(`chatUser_${sessionId}_avatarFallback`);

      if (!nameFromStorage || !roleFromStorage || !userIdFromStorage || !avatarFallbackFromStorage) {
        toast({ variant: "destructive", title: "Fehler", description: "Benutzerdetails nicht gefunden. Bitte treten Sie der Sitzung erneut bei." });
        if (sessionId) router.push(`/join/${sessionId}`); else router.push('/');
        return;
      }
      setUserName(nameFromStorage);
      setUserRole(roleFromStorage);
      setUserId(userIdFromStorage);
      setUserAvatarFallback(avatarFallbackFromStorage);
    }
    setIsLoadingUserDetails(false);
  }, [sessionId, isAdminView, initialUserNameProp, initialUserRoleProp, initialUserIdProp, initialUserAvatarFallbackProp, router, toast]);


  useEffect(() => {
    if (!sessionId) return;
    const sessionDocRef = doc(db, "sessions", sessionId);

    const unsubscribeSessionData = onSnapshot(sessionDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as SessionData;
        setSessionData(data);
        if (data.status === "ended" && !isAdminView) {
          toast({ variant: "destructive", title: "Sitzung beendet", description: "Diese Sitzung wurde vom Administrator beendet." });
        }
      } else {
        if (!isAdminView) {
          toast({ variant: "destructive", title: "Fehler", description: "Sitzung nicht gefunden oder wurde gelöscht." });
          router.push("/");
        } else {
           console.warn("Sitzung nicht gefunden im Admin View für sessionId:", sessionId);
        }
        setSessionData(null);
      }
    }, (error) => {
      console.error("Error listening to session data: ", error);
      if (!isAdminView) {
        toast({ variant: "destructive", title: "Fehler", description: "Sitzungsstatus konnte nicht geladen werden." });
        router.push("/");
      }
    });
    return () => unsubscribeSessionData();
  }, [sessionId, isAdminView, router, toast]);

  useEffect(() => {
    if (!sessionId || !userId || isAdminView) return;

    let unsubscribeParticipant: (() => void) | undefined;
    const findParticipantDocAndListen = async () => {
      const participantsColRef = collection(db, "sessions", sessionId, "participants");
      if (!userId) {
        console.warn("Skipping participant listener because userId is null");
        return;
      }
      const q = query(participantsColRef, where("userId", "==", userId));

      try {
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const userDoc = querySnapshot.docs[0];
          unsubscribeParticipant = onSnapshot(userDoc.ref, (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data() as ParticipantType;
              setIsMuted(data.isMuted ?? false);
            }
          }, (error) => {
            console.error("Error listening to own participant data: ", error);
          });
        } else {
          console.warn("Could not find participant document for userId:", userId);
        }
      } catch (error) {
         console.error("Error querying for participant document:", error);
      }
    };

    findParticipantDocAndListen();
    return () => {
      if (unsubscribeParticipant) {
        unsubscribeParticipant();
      }
    };
  }, [sessionId, userId, isAdminView]);

  useEffect(() => {
    if (!sessionId) return;
    setIsChatDataLoading(true);
    const participantsColRef = collection(db, "sessions", sessionId, "participants");
    // Client-side sorting to avoid Firestore index, order by joinedAt then by isBot
    const q_participants = query(participantsColRef);

    const unsubscribe = onSnapshot(q_participants, (querySnapshot) => {
      const fetchedParticipants: DisplayParticipant[] = [];
      querySnapshot.forEach((docSn) => {
        fetchedParticipants.push({ id: docSn.id, ...docSn.data() } as DisplayParticipant);
      });
      
      fetchedParticipants.sort((a, b) => {
        const aTimestamp = a.joinedAt instanceof Timestamp ? a.joinedAt.toMillis() : (typeof a.joinedAt === 'object' && a.joinedAt ? (a.joinedAt as any).seconds * 1000 : 0);
        const bTimestamp = b.joinedAt instanceof Timestamp ? b.joinedAt.toMillis() : (typeof b.joinedAt === 'object' && b.joinedAt ? (b.joinedAt as any).seconds * 1000 : 0);
        if (a.isBot && !b.isBot) return -1;
        if (!a.isBot && b.isBot) return 1;
        return aTimestamp - bTimestamp;
      });

      setParticipants(fetchedParticipants);
      setIsChatDataLoading(false);
    }, (error) => {
      console.error("Error fetching participants: ", error);
      toast({ variant: "destructive", title: "Fehler", description: "Teilnehmer konnten nicht geladen werden." });
      setIsChatDataLoading(false);
    });

    return () => unsubscribe();
  }, [sessionId, toast]);


  const scrollToBottom = useCallback((force: boolean = false, behavior: 'auto' | 'smooth' = 'smooth') => {
    if (messagesEndRef.current && viewportRef.current) {
      if (force) {
        messagesEndRef.current.scrollIntoView({ behavior });
      } else {
        const scrollContainer = viewportRef.current;
        const isNearBottom = scrollContainer.scrollHeight - scrollContainer.clientHeight <= scrollContainer.scrollTop + 250; // Increased threshold
        if (isNearBottom) {
          messagesEndRef.current.scrollIntoView({ behavior: "auto" }); // Keep auto for ongoing new messages if near bottom
        }
      }
    }
  }, []);

  useEffect(() => {
    if (!sessionId || !userId) {
      return;
    }
    const messagesColRef = collection(db, "sessions", sessionId, "messages");
    const q_msg = query(messagesColRef, orderBy("timestamp", "asc"));

    let firstTimeMessagesLoad = true;

    const unsubscribeMessages = onSnapshot(q_msg, (querySnapshot) => {
      const newMessagesData: DisplayMessage[] = [];
      let hasNewActualMessages = false;

      const prevMessageCount = messages.length;

      querySnapshot.forEach((docSn) => {
        const data = docSn.data() as MessageType;
        const timestamp = data.timestamp as Timestamp | null;
        newMessagesData.push({
          ...data,
          id: docSn.id,
          isOwn: data.senderUserId === userId && !isAdminView,
          timestampDisplay: timestamp ? new Date(timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Senden...'
        });
      });
      
      if (newMessagesData.length > prevMessageCount) {
        hasNewActualMessages = true;
      }
      
      setMessages(newMessagesData);

      if (firstTimeMessagesLoad) {
          scrollToBottom(true, 'auto');
          setShowScrollToBottomButton(false);
          firstTimeMessagesLoad = false;
      } else if (hasNewActualMessages) {
          const scrollContainer = viewportRef.current;
          if (scrollContainer) {
              const isNearBottom = scrollContainer.scrollHeight - scrollContainer.clientHeight <= scrollContainer.scrollTop + 250; // Consistent threshold
              if (isNearBottom) {
                  scrollToBottom(false, 'smooth'); // Smooth scroll for new messages if user is near bottom
                  setShowScrollToBottomButton(false);
              } else {
                  setShowScrollToBottomButton(true); // Show button if user has scrolled up
              }
          }
      }
    }, (error) => {
      console.error("Error fetching messages: ", error);
      toast({ variant: "destructive", title: "Fehler", description: "Nachrichten konnten nicht geladen werden." });
    });

    return () => unsubscribeMessages();
  }, [sessionId, userId, isAdminView, toast, scrollToBottom, messages.length]);


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

  const getParticipantColorClasses = useCallback((pUserId?: string, pSenderType?: 'admin' | 'user' | 'bot') => {
    console.log(`getParticipantColorClasses called for pUserId: ${pUserId}, pSenderType: ${pSenderType}, currentUserId: ${userId}, isAdminView: ${isAdminView}`);

    const adminColor = { name: 'admin', bg: "bg-destructive/90", text: "text-destructive-foreground", nameText: "text-destructive-foreground", ring: "ring-destructive" };
    const botColor = { name: 'bot', bg: "bg-purple-600/80", text: "text-purple-50", nameText: "text-purple-100", ring: "ring-purple-600" };
    const ownColor = { name: 'own', bg: "bg-primary", text: "text-primary-foreground", nameText: "text-primary-foreground/90", ring: "ring-primary" };
    const emeraldColor = { name: 'emerald', bg: "bg-emerald-600", text: "text-emerald-50", nameText: "text-emerald-100", ring: "ring-emerald-600" };

    if (pSenderType === 'admin' || (isAdminView && pUserId === initialUserIdProp)) {
      console.log(`-> Resolved as ADMIN color for ${pUserId}`);
      return adminColor;
    }
    if (pSenderType === 'bot') {
       console.log(`-> Resolved as BOT color for ${pUserId}`);
      return botColor;
    }
    if (pUserId === userId && !isAdminView) {
      console.log(`-> Resolved as OWN USER color for ${pUserId}`);
      return ownColor;
    }
    
    // Fallback for other users - consistent Emerald color
    console.log(`-> Resolved as OTHER USER (Emerald) for ${pUserId}`);
    return emeraldColor;

  }, [userId, isAdminView, initialUserIdProp]);


  const isSessionActive = useMemo(() => sessionData?.status === "active", [sessionData]);


  const handleScroll = useCallback(() => {
    const scrollContainer = viewportRef.current;
    if (scrollContainer) {
      const isScrolledUp = scrollContainer.scrollHeight - scrollContainer.clientHeight - scrollContainer.scrollTop > 300;
      setShowScrollToBottomButton(isScrolledUp);
    }
  }, []);


  const scrollToMessage = useCallback((messageId: string) => {
    const messageElement = document.getElementById(`msg-${messageId}`);
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Highlight effect (optional, can be removed if causing issues)
      messageElement.classList.add('ring-2', 'ring-primary/70', 'transition-all', 'duration-1000', 'ease-in-out', 'rounded-md', 'p-1', '-m-1');
      setTimeout(() => {
        messageElement.classList.remove('ring-2', 'ring-primary/70', 'transition-all', 'duration-1000', 'ease-in-out', 'rounded-md', 'p-1', '-m-1');
      }, 2500);
    }
  }, []);

  const getScenarioTitle = () => currentScenario?.title || "Szenario wird geladen...";

  const handleImageFileSelected = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
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
        const safeFileNamePart = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const imageFileNameForPath = `${safeFileNamePart}_${Date.now()}`;
        const imagePath = `chat_images/${sessionId}/${imageFileNameForPath}`;
        const sRef = storageRef(storage, imagePath);
        
        console.log(`Attempting to upload ${file.name} to ${imagePath}`);
        console.log("Storage reference:", sRef);

        const uploadTask = uploadBytesResumable(sRef, file);

        await new Promise<void>((resolve, reject) => {
          uploadTask.on('state_changed',
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              console.log(`Upload is ${progress}% done. State: ${snapshot.state}`);
              setImageUploadProgress(progress);
              if (snapshot.state === 'paused') console.log('Upload is paused');
              else if (snapshot.state === 'running') console.log('Upload is running');
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
              console.log('Upload successful, getting download URL...');
              try {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                console.log('Download URL:', downloadURL);
                uploadedImageUrl = downloadURL;
                uploadedImageFileName = file.name;
                console.log("Image upload process finished. URL:", uploadedImageUrl);
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
      } else if (selectedImageFile) {
        console.error("selectedImageFile is not a File object:", selectedImageFile);
        toast({ variant: "destructive", title: "Ungültige Datei", description: "Das ausgewählte Element ist keine gültige Bilddatei."});
        throw new Error("Ungültige Datei ausgewählt");
      }

      const messagesColRef = collection(db, "sessions", sessionId, "messages");
      const messageData: MessageType = {
        id: '', 
        senderUserId: userId!,
        senderName: userName!,
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

      console.log("Adding message to Firestore:", messageData);
      await addDoc(messagesColRef, messageData);
      console.log("Message added to Firestore.");


      setNewMessage("");
      setReplyingTo(null);
      setQuotingMessage(null);
      handleRemoveSelectedImage(); // Clears the image preview and file state
      if (!isAdminView) setLastMessageSentAt(Date.now());


    } catch (error) {
      console.error("Error in handleSendMessage:", error);
      if (!(error instanceof Error && (error.message.includes("Bild-Upload fehlgeschlagen") || error.message.includes("Bild-URL Abruf fehlgeschlagen") || error.message.includes("Ungültige Datei")))) {
         toast({ variant: "destructive", title: "Senden fehlgeschlagen", description: (error instanceof Error ? error.message : "Ein unbekannter Fehler ist aufgetreten.") });
      }
    } finally {
      console.log("handleSendMessage finally block. Resetting state.");
      setIsSendingMessage(false);
      setImageUploadProgress(null);
    }
  }, [newMessage, selectedImageFile, userName, userId, userAvatarFallback, sessionData, isAdminView, isMuted, lastMessageSentAt, sessionId, toast, replyingTo, handleRemoveSelectedImage]);

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
        const quotedTextPattern = `> ${quotingMessage.senderName} schrieb:\\n> "${quotingMessage.content.replace(/\n/g, '\\n> ').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\n\\n`;
        const regex = new RegExp(quotedTextPattern.replace(/\s/g, '\\s*'), '');
        setNewMessage(prev => prev.replace(regex, ""));
    }
    setQuotingMessage(null);
  }, [quotingMessage]);


  const handleMentionUser = useCallback((name: string) => {
    setNewMessage(prev => `${prev}@${name} `);
    inputRef.current?.focus();
  }, []);

  const handleReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!userId || !sessionId) return;
    setReactingToMessageId(null);

    const messageRef = doc(db, "sessions", sessionId, "messages", messageId);

    try {
      await runTransaction(db, async (transaction) => {
        const messageDoc = await transaction.get(messageRef);
        if (!messageDoc.exists()) {
          throw "Document does not exist!";
        }

        const currentData = messageDoc.data() as MessageType;
        const currentReactions = currentData.reactions || {};
        const usersWhoReactedWithEmoji: string[] = currentReactions[emoji] || [];

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
        transaction.update(messageRef, { reactions: newReactions });
      });
    } catch (error) {
      console.error("Error processing reaction: ", error);
      toast({
        variant: "destructive",
        title: "Reaktion fehlgeschlagen",
        description: "Ihre Reaktion konnte nicht gespeichert werden.",
      });
    }
  }, [userId, sessionId, toast]);


  const handleEmojiSelectForInput = useCallback((emoji: string) => {
    setNewMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
  }, []);

  if (isLoadingUserDetails && !isAdminView) {
    return <LoadingScreen />;
  }

  if (isAdminView && (!sessionData && isLoadingUserDetails)) {
     return <div className="p-4 text-center text-muted-foreground">Lade Chat-Daten für Admin-Vorschau...</div>;
  }


  return (
      <div className={cn(
        "flex flex-col bg-muted/40 dark:bg-background/50", 
        isAdminView ? "h-full" : "min-h-screen h-screen" // Ensure full screen height for participant view
      )}>
        {!isAdminView && (
          <header className="flex h-16 items-center justify-between border-b bg-background px-4 md:px-6 shrink-0">
            <h1 className="text-lg font-semibold text-primary truncate max-w-[calc(100%-100px)] sm:max-w-none">
              Simulation: {getScenarioTitle()}
            </h1>
             <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden" aria-label="Teilnehmer anzeigen">
                  <UsersIcon className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full max-w-xs sm:max-w-sm p-4">
                 <ChatSidebar
                    participants={participants}
                    currentUserId={userId}
                    userName={userName}
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
            isAdminView ? "" : "relative" // relative for participant view to contain scroll button
        )}>
          {!isAdminView && (
            <aside className="hidden md:flex md:w-72 lg:w-80 flex-col border-r bg-background p-4 space-y-4 shrink-0">
               <ChatSidebar
                participants={participants}
                currentUserId={userId}
                userName={userName}
                userRole={userRole}
                userAvatarFallback={userAvatarFallback}
                currentScenario={currentScenario}
                isMuted={isMuted}
                getParticipantColorClasses={getParticipantColorClasses}
                isAdminView={isAdminView}
              />
            </aside>
          )}

          <main className="flex flex-1 flex-col min-w-0"> {/* Added min-w-0 here */}
            <ScrollArea
              className={cn("flex-1 p-4 md:p-6", isAdminView ? "bg-background" : "")}
              ref={scrollAreaRef}
              viewportRef={viewportRef}
              onScroll={handleScroll}
              >
              <MessageList
                messages={messages}
                currentUserId={userId}
                getParticipantColorClasses={getParticipantColorClasses}
                onMentionUser={handleMentionUser}
                onSetReply={handleSetReply}
                onSetQuote={handleSetQuote}
                onScrollToMessage={scrollToMessage}
                onReaction={handleReaction}
                reactingToMessageId={reactingToMessageId}
                setReactingToMessageId={setReactingToMessageId}
                emojiCategories={emojiCategories}
                messagesEndRef={messagesEndRef}
                isChatDataLoading={isChatDataLoading}
                isAdminView={isAdminView}
              />
            </ScrollArea>
            {showScrollToBottomButton && !isAdminView && (
              <Button
                variant="outline"
                size="icon"
                className="absolute bottom-24 right-4 md:right-8 z-10 rounded-full shadow-md bg-background/80 hover:bg-muted/90 dark:bg-card/80 dark:hover:bg-muted/70 backdrop-blur-sm"
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
      </div>
  );
}


export default function ChatPage({ params }: ChatPageProps) {
  const { sessionId } = params; // Destructure here for Server Component

  return (
    <Suspense fallback={
      <div className="flex h-screen w-full items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader><CardTitle>Chat wird geladen...</CardTitle></CardHeader>
          <CardContent><p>Einen Moment Geduld, die Simulation wird vorbereitet.</p></CardContent>
        </Card>
      </div>
    }>
      <ChatPageContent sessionId={sessionId!} />
    </Suspense>
  );
}


    