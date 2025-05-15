
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowDown, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, Suspense, useRef, type FormEvent, type ChangeEvent, useMemo, useCallback } from "react";
import type { Scenario, Participant as ParticipantType, Message as MessageType, SessionData, DisplayMessage, DisplayParticipant } from "@/lib/types";

import { db, storage } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, Timestamp, doc, getDoc, where, getDocs, updateDoc, runTransaction } from "firebase/firestore";
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { useToast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { participantColors as defaultParticipantColors, emojiCategories, type ParticipantColor } from '@/lib/config'; // Ensure defaultParticipantColors is imported
import { MessageInputBar } from '@/components/chat/message-input-bar';
import { MessageList } from '@/components/chat/message-list';
import { ChatSidebar } from '@/components/chat/chat-sidebar';


interface ChatPageUrlParams {
  sessionId: string;
}

interface ChatPageProps {
  params: ChatPageUrlParams; // Changed from {sessionId: string}
}


interface ChatPageContentProps {
  sessionId: string;
  initialUserName?: string;
  initialUserRole?: string;
  initialUserId?: string;
  initialUserAvatarFallback?: string;
  isAdminView?: boolean;
}

const simpleHash = (str: string): number => {
  let hash = 0;
  if (!str || str.length === 0) {
    return 0;
  }
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  // console.log(`simpleHash: input='${str}', output=${hash}`);
  return hash;
};


export function ChatPageContent({
  sessionId, // Directly use sessionId prop
  initialUserName,
  initialUserRole,
  initialUserId,
  initialUserAvatarFallback,
  isAdminView = false
}: ChatPageContentProps) {
  const { toast } = useToast();
  const router = useRouter();

  const [userName, setUserName] = useState<string | null>(initialUserName || null);
  const [userRole, setUserRole] = useState<string | null>(initialUserRole || null);
  const [userId, setUserId] = useState<string | null>(initialUserId || null);
  const [userAvatarFallback, setUserAvatarFallback] = useState<string>(initialUserAvatarFallback || "??");

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
  const [showScrollToBottomButton, setShowScrollToBottomButton] = useState(false);


  const [isLoading, setIsLoading] = useState(true);
  const [isChatDataLoading, setIsChatDataLoading] = useState(true);

  const [replyingTo, setReplyingTo] = useState<DisplayMessage | null>(null);
  const [quotingMessage, setQuotingMessage] = useState<DisplayMessage | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);


  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [imageUploadProgress, setImageUploadProgress] = useState<number | null>(null);

  const [selectedImageForModal, setSelectedImageForModal] = useState<string | null>(null);
  const [selectedImageFilenameForModal, setSelectedImageFilenameForModal] = useState<string | null>(null);

  const handleOpenImageModal = (imageUrl: string, imageFileName?: string) => {
    setSelectedImageForModal(imageUrl);
    setSelectedImageFilenameForModal(imageFileName || "Bild");
  };

  const handleCloseImageModal = () => {
    setSelectedImageForModal(null);
    setSelectedImageFilenameForModal(null);
  };


  useEffect(() => {
    if (!isAdminView && (!initialUserName || !initialUserRole || !initialUserId || !initialUserAvatarFallback)) {
      const nameFromStorage = localStorage.getItem(`chatUser_${sessionId}_name`);
      const roleFromStorage = localStorage.getItem(`chatUser_${sessionId}_role`);
      const userIdFromStorage = localStorage.getItem(`chatUser_${sessionId}_userId`);
      const avatarFallbackFromStorage = localStorage.getItem(`chatUser_${sessionId}_avatarFallback`);

      if (!nameFromStorage || !roleFromStorage || !userIdFromStorage || !avatarFallbackFromStorage) {
        toast({ variant: "destructive", title: "Fehler", description: "Benutzerdetails nicht gefunden. Bitte treten Sie der Sitzung erneut bei." });
        router.push(`/join/${sessionId}`);
        return;
      }
      setUserName(nameFromStorage);
      setUserRole(roleFromStorage);
      setUserId(userIdFromStorage);
      setUserAvatarFallback(avatarFallbackFromStorage);
    }
    // Scenarios are static, so we can look it up directly
    // Assuming scenarios.ts is imported
    // This useEffect might be better if scenarios were fetched or passed as prop if dynamic
    const scenarioData = defaultParticipantColors.length > 0 ? // A placeholder check, replace with actual scenario loading
      { id: sessionId, title: `Szenario ${sessionId}`, langbeschreibung: `Lange Beschreibung für Szenario ${sessionId}`, defaultBots: 0, standardRollen: 0, iconName: 'Users', tags: [] } : undefined;
    setCurrentScenario(scenarioData);


  }, [sessionId, toast, router, isAdminView, initialUserName, initialUserRole, initialUserId, initialUserAvatarFallback]);

  useEffect(() => {
    if (!sessionId) return;
    setIsLoading(true);
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
      setIsLoading(false);
    }, (error) => {
      console.error("Error listening to session data: ", error);
      if (!isAdminView) {
        toast({ variant: "destructive", title: "Fehler", description: "Sitzungsstatus konnte nicht geladen werden." });
        router.push("/");
      }
      setIsLoading(false);
    });
    return () => unsubscribeSessionData();
  }, [sessionId, toast, router, isAdminView]);

  useEffect(() => {
    if (!sessionId || !userId || isAdminView) return;

    let unsubscribeParticipant: (() => void) | undefined;
    const findParticipantDocAndListen = async () => {
      const participantsColRef = collection(db, "sessions", sessionId, "participants");
      if (!userId) { // Defensive check
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
    const q_participants = query(participantsColRef, orderBy("joinedAt", "asc"));

    const unsubscribe = onSnapshot(q_participants, (querySnapshot) => {
      const fetchedParticipants: DisplayParticipant[] = [];
      querySnapshot.forEach((docSn) => {
        fetchedParticipants.push({ id: docSn.id, ...docSn.data() } as DisplayParticipant);
      });
      setParticipants(fetchedParticipants);
      // console.log("Fetched participants:", fetchedParticipants);
      setIsChatDataLoading(false);
    }, (error) => {
      console.error("Error fetching participants: ", error);
      toast({ variant: "destructive", title: "Fehler", description: "Teilnehmer konnten nicht geladen werden." });
      setIsChatDataLoading(false);
    });

    return () => unsubscribe();
  }, [sessionId, toast]);

  const [isInitialMessagesLoad, setIsInitialMessagesLoad] = useState(true);

  useEffect(() => {
    if (!sessionId || !userId) return; // Ensure userId is available
    setIsChatDataLoading(true);
    const messagesColRef = collection(db, "sessions", sessionId, "messages");
    const q_msg = query(messagesColRef, orderBy("timestamp", "asc"));

    const unsubscribeMessages = onSnapshot(q_msg, (querySnapshot) => {
      const fetchedMessages: DisplayMessage[] = [];
      querySnapshot.forEach((docSn) => {
        const data = docSn.data() as MessageType;
        const timestamp = data.timestamp as Timestamp | null;
        fetchedMessages.push({
          ...data,
          id: docSn.id,
          isOwn: data.senderUserId === userId,
          timestampDisplay: timestamp ? new Date(timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Senden...'
        });
      });
      setMessages(fetchedMessages);
      setIsChatDataLoading(false);

      // Scroll logic
      if (isInitialMessagesLoad) {
          scrollToBottom(true); // Force scroll on initial load
          setIsInitialMessagesLoad(false);
      } else {
          const scrollContainer = scrollAreaRef.current?.children[0] as HTMLDivElement | undefined;
          if (scrollContainer) {
              const isScrolledToBottom = scrollContainer.scrollHeight - scrollContainer.clientHeight <= scrollContainer.scrollTop + 150; // Increased tolerance
              if (isScrolledToBottom && !showScrollToBottomButton) { // Only auto-scroll if user is near bottom and not intentionally scrolled up
                  scrollToBottom();
              }
          }
      }
    }, (error) => {
      console.error("Error fetching messages: ", error);
      toast({ variant: "destructive", title: "Fehler", description: "Nachrichten konnten nicht geladen werden." });
      setIsChatDataLoading(false);
    });

    return () => unsubscribeMessages();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, toast, userId, isInitialMessagesLoad]); // showScrollToBottomButton removed to prevent loop with its own setter

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


  const scrollToBottom = useCallback((force: boolean = false) => {
    if (force) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        setShowScrollToBottomButton(false); // Hide button when forced to bottom
    } else {
      // This part is tricky, as we don't want to scroll if the user has scrolled up.
      // The logic in onSnapshot for messages now handles conditional auto-scrolling.
      // This function is mainly for the "scroll to bottom" button.
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // No dependencies needed if it's just scrolling to a ref

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    const isScrolledToBottom = target.scrollHeight - target.clientHeight <= target.scrollTop + 20;
    if (isScrolledToBottom) {
      setShowScrollToBottomButton(false);
    } else if (target.scrollTop < target.scrollHeight - target.clientHeight - 100) { // Show if scrolled up significantly
      setShowScrollToBottomButton(true);
    }
  };


   const scrollToMessage = (messageId: string) => {
    const messageElement = document.getElementById(`msg-${messageId}`);
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      messageElement.classList.add('ring-2', 'ring-primary', 'transition-all', 'duration-1000', 'ease-in-out', 'rounded-md');
      setTimeout(() => {
        messageElement.classList.remove('ring-2', 'ring-primary', 'transition-all', 'duration-1000', 'ease-in-out', 'rounded-md');
      }, 2500);
    }
  };

  const getScenarioTitle = () => currentScenario?.title || "Szenario wird geladen...";

  const getParticipantColorClasses = useCallback((pUserId?: string, pSenderType?: 'admin' | 'user' | 'bot'): ParticipantColor => {
    const adminColor: ParticipantColor = { name: 'admin', bg: "bg-red-600", text: "text-red-50", nameText: "text-red-100", ring: "ring-red-500" };
    const botColor: ParticipantColor = { name: 'bot', bg: "bg-purple-600", text: "text-purple-50", nameText: "text-purple-100", ring: "ring-purple-500" };
    const ownColor: ParticipantColor = { name: 'own', bg: "bg-primary", text: "text-primary-foreground", nameText: "text-primary-foreground/90", ring: "ring-primary" };
    const emeraldColor: ParticipantColor = { name: 'emerald', bg: "bg-emerald-600", text: "text-emerald-50", nameText: "text-emerald-100", ring: "ring-emerald-500"};

    // console.log(`getParticipantColorClasses called for pUserId: ${pUserId}, pSenderType: ${pSenderType}, currentUserId: ${userId}, isAdminView: ${isAdminView}`);

    if (pSenderType === 'admin' || (isAdminView && pUserId === initialUserId)) {
      // console.log("-> Resolved as ADMIN color");
      return adminColor;
    }
    if (pSenderType === 'bot' || (pUserId && pUserId.startsWith('bot-'))) {
      // console.log("-> Resolved as BOT color");
      return botColor;
    }
    if (pUserId === userId && !isAdminView) {
      // console.log(`-> Resolved as OWN USER color for ${pUserId}`);
      return ownColor;
    }

    // Fallback for other users - always emerald
    // console.log(`-> Resolved as OTHER USER (Emerald) for ${pUserId}`);
    return emeraldColor;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, isAdminView, initialUserId]); // Removed defaultParticipantColors if not used for dynamic assignment


  const handleImageFileSelected = (event: ChangeEvent<HTMLInputElement>) => {
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
  };

  const handleRemoveSelectedImage = () => {
    setSelectedImageFile(null);
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
      setImagePreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setImageUploadProgress(null);
  };

 const handleSendMessage = async (event?: FormEvent<HTMLFormElement>) => {
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
        const imageFileName = `${safeFileNamePart}_${Date.now()}`;
        const imagePath = `chat_images/${sessionId}/${imageFileName}`;
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
              switch (snapshot.state) {
                case 'paused': console.log('Upload is paused'); break;
                case 'running': console.log('Upload is running'); break;
              }
            },
            (error) => {
              console.error("Firebase Storage upload error: ", error);
              let errorMessage = `Fehler: ${error.code || 'Unbekannt'}`;
               switch (error.code) {
                case 'storage/unauthorized': errorMessage = "Fehler: Keine Berechtigung zum Hochladen."; break;
                case 'storage/canceled': errorMessage = "Upload abgebrochen."; break;
                case 'storage/unknown': errorMessage = "Unbekannter Fehler beim Upload."; break;
                default: errorMessage = `Storage Fehler: ${error.code} - ${error.message}`; break;
              }
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
        console.log("Image upload process finished. URL:", uploadedImageUrl);
      } else if (selectedImageFile) {
        console.error("selectedImageFile is not a File object:", selectedImageFile);
        toast({ variant: "destructive", title: "Ungültige Datei", description: "Das ausgewählte Element ist keine gültige Bilddatei."});
        setIsSendingMessage(false);
        setImageUploadProgress(null);
        return;
      }

      const messagesColRef = collection(db, "sessions", sessionId, "messages");
      const messageData: MessageType = {
        id: '', // Firestore will generate
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
      setQuotingMessage(null); // Ensure quotingMessage is also reset
      handleRemoveSelectedImage(); // Clear image preview and file
      if (!isAdminView) setLastMessageSentAt(Date.now());
      // scrollToBottom(true); // Already handled by useEffect on messages change

    } catch (error) {
      console.error("Error in handleSendMessage (either upload or Firestore add): ", error);
      if (!(error instanceof Error && (error.message.includes("Bild-Upload fehlgeschlagen") || error.message.includes("Bild-URL Abruf fehlgeschlagen") || error.message.includes("Ungültige Datei")))) {
         toast({ variant: "destructive", title: "Senden fehlgeschlagen", description: "Ein unbekannter Fehler ist aufgetreten." });
      }
    } finally {
      console.log("handleSendMessage finally block. Resetting state.");
      setIsSendingMessage(false);
      setImageUploadProgress(null);
    }
  };

  const handleSetReply = (message: DisplayMessage) => {
    setQuotingMessage(null);
    setReplyingTo(message);
    inputRef.current?.focus();
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
  };

  const handleSetQuote = (message: DisplayMessage) => {
    setReplyingTo(null); // Cancel any active reply
    const quotedText = `> ${message.senderName} schrieb:\n> "${message.content.replace(/\n/g, '\n> ')}"\n\n`;
    setNewMessage(prev => quotedText + prev); // Prepend quoted text
    setQuotingMessage(message); // Keep track of what's being quoted for UI indication
    inputRef.current?.focus();
  };

  const handleCancelQuote = () => {
     if (quotingMessage) {
        // Attempt to remove the quoted text. This is a bit fragile if user edits the quote.
        const quotedTextPattern = `> ${quotingMessage.senderName} schrieb:\\n> "${quotingMessage.content.replace(/\n/g, '\\n> ').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\n\\n`;
        const regex = new RegExp(quotedTextPattern.replace(/\s/g, '\\s*'), ''); // Remove 'g' for single replacement from start
        setNewMessage(prev => prev.replace(regex, ""));
    }
    setQuotingMessage(null);
  };


  const handleMentionUser = (name: string) => {
    setNewMessage(prev => `${prev}@${name} `);
    inputRef.current?.focus();
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!userId || !sessionId) return;
    // No scroll to bottom here, as it's handled by message list updates or manual button
    // console.log(`Handling reaction: msgId=${messageId}, emoji=${emoji}, userId=${userId}`);

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
          // User already reacted with this emoji, remove reaction
          const updatedUserList = usersWhoReactedWithEmoji.filter(uid => uid !== userId);
          if (updatedUserList.length === 0) {
            delete newReactions[emoji]; // Remove emoji if no one else reacted with it
          } else {
            newReactions[emoji] = updatedUserList;
          }
        } else {
          // User has not reacted with this emoji, add reaction
          newReactions[emoji] = [...usersWhoReactedWithEmoji, userId];
        }
        // console.log("Updating reactions in transaction:", newReactions);
        transaction.update(messageRef, { reactions: newReactions });
      });
       // console.log("Reaction processed successfully");
    } catch (error) {
      console.error("Error processing reaction: ", error);
      toast({
        variant: "destructive",
        title: "Reaktion fehlgeschlagen",
        description: "Ihre Reaktion konnte nicht gespeichert werden.",
      });
    }
  };

  const isSessionActive = useMemo(() => sessionData?.status === "active", [sessionData]);

  if (isLoading && !isAdminView) {
    return (
      <div className="flex h-screen w-full items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader><CardTitle>Chat wird geladen...</CardTitle></CardHeader>
          <CardContent><p>Einen Moment Geduld, die Simulation wird vorbereitet.</p></CardContent>
        </Card>
      </div>
    );
  }

  if (isAdminView && (!sessionData || !currentScenario)) { // Added !currentScenario check for admin view robustness
     return <div className="p-4 text-center text-muted-foreground">Lade Chat-Daten für Admin-Vorschau...</div>;
  }


  return (
      <div className={cn("flex flex-col bg-muted/40 dark:bg-background/50", isAdminView ? "h-full" : "h-screen")}>
        {!isAdminView && (
          <header className="flex h-16 items-center justify-between border-b bg-background px-4 md:px-6 shrink-0">
            {/* Header Content */}
            <h1 className="text-lg font-semibold text-primary truncate max-w-[calc(100%-200px)] sm:max-w-none">
              Simulation: {getScenarioTitle()}
            </h1>
            {/* Other header items */}
          </header>
        )}

        <div className="flex flex-1 overflow-hidden relative">
          {!isAdminView && (
            <aside className="hidden md:flex md:w-72 lg:w-80 flex-col border-r bg-background p-4 space-y-4">
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

          <main className="flex flex-1 flex-col">
            <ScrollArea
              className={cn("flex-1 p-4 md:p-6", isAdminView ? "bg-background" : "")}
              ref={scrollAreaRef}
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
                emojiCategories={emojiCategories}
                messagesEndRef={messagesEndRef}
                isChatDataLoading={isChatDataLoading}
                isAdminView={isAdminView}
                onReaction={handleReaction}
                onOpenImageModal={handleOpenImageModal}
              />
            </ScrollArea>
            {showScrollToBottomButton && (
              <Button
                variant="outline"
                size="icon"
                className="absolute bottom-20 right-4 md:right-8 z-10 rounded-full shadow-md bg-background/80 hover:bg-muted/90 dark:bg-card/80 dark:hover:bg-muted/70 backdrop-blur-sm"
                onClick={() => scrollToBottom(true)}
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
              emojiCategories={emojiCategories}
              messageCooldownSeconds={sessionData?.messageCooldownSeconds}
            />
          </main>
        </div>

      {selectedImageForModal && (
         <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in-50"
            onClick={handleCloseImageModal} // Close by clicking background
          >
            <div
              className="relative flex flex-col bg-card rounded-lg shadow-xl max-w-[90vw] w-auto max-h-[85vh] h-auto overflow-hidden"
              onClick={(e) => e.stopPropagation()} // Prevent closing when clicking on the dialog itself
            >
              <div className="flex items-center justify-between p-3 border-b">
                <h3 className="text-lg font-semibold text-card-foreground truncate">
                  {selectedImageFilenameForModal || "Bild"}
                </h3>
                <Button variant="ghost" size="icon" onClick={handleCloseImageModal} className="text-muted-foreground hover:text-foreground">
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <div className="flex-1 p-1 flex items-center justify-center overflow-hidden">
                <Image
                  src={selectedImageForModal}
                  alt={selectedImageFilenameForModal || "Großansicht Bild"}
                  width={1920} 
                  height={1080} 
                  className="object-contain max-w-full max-h-full w-auto h-auto" 
                  data-ai-hint="modal image"
                  priority 
                />
              </div>
            </div>
          </div>
      )}
      </div>
  );
}


export default function ChatPage({ params }: ChatPageProps) { // params is used directly
  const { sessionId } = params; // Destructure here for clarity if preferred

  return (
    <Suspense fallback={
      <div className="flex h-screen w-full items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader><CardTitle>Chat wird geladen...</CardTitle></CardHeader>
          <CardContent><p>Einen Moment Geduld, die Simulation wird vorbereitet.</p></CardContent>
        </Card>
      </div>
    }>
      <ChatPageContent sessionId={sessionId} />
    </Suspense>
  );
}
