
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Paperclip, Send, Smile, Mic, User, Bot as BotIcon, CornerDownLeft, Settings, Users, MessageSquare, AlertTriangle, LogOut, PauseCircle, PlayCircle, VolumeX, XCircle, ThumbsUp, SmilePlus, Quote, Eye, Image as ImageIcon, Trash2, NotebookPen, Crown, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, Suspense, useRef, type FormEvent, type ChangeEvent, useMemo, useCallback } from "react";
import { scenarios } from "@/lib/scenarios";
import type { Scenario, Participant as ParticipantType, Message as MessageType, SessionData, DisplayMessage, DisplayParticipant } from "@/lib/types";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import { db, storage } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, Timestamp, doc, getDoc, where, getDocs, updateDoc, runTransaction } from "firebase/firestore";
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { participantColors, emojiCategories, type ParticipantColor } from '@/lib/config';
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
  sessionIdProp: string; // Renamed from sessionId to avoid conflict with destructured params
  initialUserName?: string;
  initialUserRole?: string;
  initialUserId?: string;
  initialUserAvatarFallback?: string;
  isAdminView?: boolean;
}

const simpleHash = (str: string): number => {
  let hash = 0;
  if (!str || str.length === 0) {
    // console.log("simpleHash: input is empty or null, returning 0");
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
  sessionIdProp,
  initialUserName,
  initialUserRole,
  initialUserId,
  initialUserAvatarFallback,
  isAdminView = false
}: ChatPageContentProps) {
  const sessionId = sessionIdProp; // Use the prop
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
  const [isLoading, setIsLoading] = useState(true);
  const [isChatDataLoading, setIsChatDataLoading] = useState(true);

  const [replyingTo, setReplyingTo] = useState<DisplayMessage | null>(null);
  const [quotingMessage, setQuotingMessage] = useState<DisplayMessage | null>(null);

  const [reactingToMessageId, setReactingToMessageId] = useState<string | null>(null);
  const [showEmojiPickerForInput, setShowEmojiPickerForInput] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);


  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [imageUploadProgress, setImageUploadProgress] = useState<number | null>(null);

  
  // State for the new simple image modal
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

    const scenario = scenarios.find(s => s.id === sessionId);
    setCurrentScenario(scenario);

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
    const q_participants = query(participantsColRef, orderBy("joinedAt", "asc"));

    const unsubscribe = onSnapshot(q_participants, (querySnapshot) => {
      const fetchedParticipants: DisplayParticipant[] = [];
      querySnapshot.forEach((docSn) => {
        fetchedParticipants.push({ id: docSn.id, ...docSn.data() } as DisplayParticipant);
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

  useEffect(() => {
    if (!sessionId || !userId) return;
    setIsChatDataLoading(true);
    const messagesColRef = collection(db, "sessions", sessionId, "messages");
    const q_msg = query(messagesColRef, orderBy("timestamp", "asc"));

    const unsubscribe = onSnapshot(q_msg, (querySnapshot) => {
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
    }, (error) => {
      console.error("Error fetching messages: ", error);
      toast({ variant: "destructive", title: "Fehler", description: "Nachrichten konnten nicht geladen werden." });
      setIsChatDataLoading(false);
    });

    return () => unsubscribe();
  }, [sessionId, toast, userId]);

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


  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

   const scrollToMessage = (messageId: string) => {
    const messageElement = document.getElementById(`msg-${messageId}`);
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      messageElement.classList.add('ring-2', 'ring-primary', 'transition-all', 'duration-1000', 'ease-in-out');
      setTimeout(() => {
        messageElement.classList.remove('ring-2', 'ring-primary', 'transition-all', 'duration-1000', 'ease-in-out');
      }, 1500);
    }
  };

  useEffect(scrollToBottom, [messages]);

  const getScenarioTitle = () => currentScenario?.title || "Szenario wird geladen...";


  // Memoize color objects to prevent re-creation on every render
  const adminColor = useMemo((): ParticipantColor => ({ name: 'admin', bg: "bg-red-600", text: "text-white", nameText: "text-red-100", ring: "ring-red-600" }), []);
  const botColor = useMemo((): ParticipantColor => ({ name: 'bot', bg: "bg-purple-600", text: "text-white", nameText: "text-purple-100", ring: "ring-purple-600" }), []);
  const ownColor = useMemo((): ParticipantColor => ({ name: 'own', bg: "bg-primary", text: "text-primary-foreground", nameText: "text-primary-foreground/90", ring: "ring-primary" }), []);

  const getParticipantColorClasses = useCallback((pUserId?: string, pSenderType?: 'admin' | 'user' | 'bot'): ParticipantColor => {
    // console.log(`getParticipantColorClasses called for pUserId: ${pUserId}, pSenderType: ${pSenderType}, currentUserId: ${userId}, isAdminView: ${isAdminView}`);
    if (pSenderType === 'admin' || (isAdminView && pUserId === initialUserId)) {
        // console.log(`-> Resolved as ADMIN color`);
        return adminColor;
    }
    if (pSenderType === 'bot' || (pUserId && pUserId.startsWith('bot-'))) {
        // console.log(`-> Resolved as BOT color`);
        return botColor;
    }
    // This condition is crucial: check if it's the current user AND NOT in admin view
    if (pUserId === userId && !isAdminView) {
        // console.log(`-> Resolved as OWN USER color`);
        return ownColor;
    }

    // Default for "other users"
    if (pUserId && participantColors.length > 0) {
        const hash = simpleHash(pUserId);
        const colorIndex = Math.abs(hash) % participantColors.length;
        const selected = participantColors[colorIndex];
        // console.log(`-> Resolved as OTHER USER: userId=${pUserId}, hash=${hash}, colorIndex=${colorIndex}, selectedColorName=${selected?.name}`);
        return selected || participantColors[0]; // Fallback to first color if something goes wrong
    }

    // Absolute fallback if no pUserId or participantColors is empty
    // console.log(`-> Fallback to default color (participantColors[0]) for userId=${pUserId}`);
    return participantColors.length > 0 ? participantColors[0] : { name: 'default', bg: "bg-gray-500", text: "text-white", nameText: "text-gray-100", ring: "ring-gray-500" };
  }, [userId, isAdminView, initialUserId, adminColor, botColor, ownColor]); // participantColors is stable from config


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
        className: "bg-yellow-500/20 border-yellow-500"
      });
      return;
    }

    setIsSendingMessage(true);
    if (selectedImageFile) {
      setImageUploadProgress(0);
    }

    let uploadedImageUrl: string | undefined = undefined;
    let uploadedImageFileName: string | undefined = undefined;

    try {
      if (selectedImageFile && selectedImageFile instanceof File) {
        const file = selectedImageFile;
        const imageFileName = `${file.name}_${Date.now()}`;
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
                case 'storage/unauthorized': errorMessage = "Fehler: Keine Berechtigung zum Hochladen. Storage-Regeln oder CORS prüfen."; break;
                case 'storage/canceled': errorMessage = "Upload abgebrochen."; break;
                case 'storage/object-not-found': errorMessage = "Fehler: Objekt nicht gefunden. Pfad oder Bucket überprüfen."; break;
                case 'storage/bucket-not-found': errorMessage = "Fehler: Storage Bucket nicht gefunden."; break;
                case 'storage/project-not-found': errorMessage = "Fehler: Firebase Projekt nicht gefunden."; break;
                case 'storage/quota-exceeded': errorMessage = "Fehler: Speicher-Quota überschritten."; break;
                case 'storage/unauthenticated': errorMessage = "Fehler: Nicht authentifiziert. Anmeldung erforderlich oder Regeln prüfen."; break;
                case 'storage/retry-limit-exceeded': errorMessage = "Fehler: Zeitlimit für Upload überschritten. Netzwerk prüfen."; break;
                case 'storage/invalid-checksum': errorMessage = "Fehler: Prüfsumme der Datei stimmt nicht überein. Datei erneut versuchen."; break;
                case 'storage/unknown': errorMessage = "Unbekannter Fehler beim Upload. Server-Antwort prüfen."; break;
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
                const getUrlErrorTyped = getUrlError as Error;
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
        toast({ variant: "destructive", title: "Ungültige Datei", description: "Das ausgewählte Element ist keine gültige Bilddatei." });
        setIsSendingMessage(false);
        setImageUploadProgress(null);
        return;
      }


      const messagesColRef = collection(db, "sessions", sessionId, "messages");
      const messageData: MessageType = {
        id: '', // Firestore will generate ID
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
      handleRemoveSelectedImage();
      if (!isAdminView) setLastMessageSentAt(Date.now());
      setShowEmojiPickerForInput(false);

    } catch (error) {
      console.error("Error in handleSendMessage (either upload or Firestore add): ", error);
      // Avoid double-toasting if already toasted by upload error handler
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
    setReplyingTo(null);
    const quotedText = `> ${message.senderName} schrieb:\n> "${message.content.replace(/\n/g, '\n> ')}"\n\n`;
    setNewMessage(prev => quotedText + prev);
    setQuotingMessage(message);
    inputRef.current?.focus();
  };

  const handleCancelQuote = () => {
     if (quotingMessage) {
        const quotedTextPattern = `> ${quotingMessage.senderName} schrieb:\\n> "${quotingMessage.content.replace(/\n/g, '\\n> ').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\n\\n`;
        const regex = new RegExp(quotedTextPattern.replace(/\s/g, '\\s*'), 'g');
        setNewMessage(prev => prev.replace(regex, ""));
    }
    setQuotingMessage(null);
  };

  const handleMentionUser = (name: string) => {
    setNewMessage(prev => `${prev}@${name} `);
    inputRef.current?.focus();
  };

  const handleEmojiSelectForInput = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
    setShowEmojiPickerForInput(false);
  };

  const handleOpenReactionPicker = (messageId: string) => {
    setReactingToMessageId(messageId);
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!userId || !sessionId) return;
    setReactingToMessageId(null); // Close picker after selection

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

        if (usersWhoReactedWithEmoji.includes(userId)) { // User has reacted with this emoji, remove reaction
          const updatedUserList = usersWhoReactedWithEmoji.filter(uid => uid !== userId);
          if (updatedUserList.length === 0) {
            delete newReactions[emoji]; // Remove emoji if no users left
          } else {
            newReactions[emoji] = updatedUserList;
          }
        } else { // User has not reacted with this emoji, add reaction
          newReactions[emoji] = [...usersWhoReactedWithEmoji, userId];
        }
        transaction.update(messageRef, { reactions: newReactions });
      });
       const localMessage = messages.find(m => m.id === messageId);
       const hadReacted = localMessage?.reactions?.[emoji]?.includes(userId);

       toast({ title: `Reaktion "${emoji}" ${hadReacted ? 'entfernt' : 'hinzugefügt'}.` });
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

  if (isAdminView && (!sessionData || !currentScenario)) {
     return <div className="p-4 text-center text-muted-foreground">Lade Chat-Daten für Admin-Vorschau...</div>;
  }


  return (
      <div className={cn("flex flex-col bg-muted/40", isAdminView ? "h-full" : "h-screen")}>
        {!isAdminView && (
          <header className="flex h-16 items-center justify-between border-b bg-background px-4 md:px-6 shrink-0">
            <h1 className="text-lg font-semibold text-primary truncate max-w-[calc(100%-200px)] sm:max-w-none">
              Simulation: {getScenarioTitle()}
            </h1>
            <div className="flex items-center gap-2">
              <Badge variant={sessionData?.status === "active" ? "default" : (sessionData?.status === "paused" ? "secondary" : "destructive")}>
                {sessionData?.status === "active" ? "Aktiv" : (sessionData?.status === "paused" ? "Pausiert" : "Beendet")}
              </Badge>
              {userName && userRole && userId && (
                <>
                  <Avatar className={cn("h-8 w-8 border-2 hidden sm:flex", getParticipantColorClasses(userId, 'user').ring)}>
                    <AvatarImage src={`https://placehold.co/40x40.png?text=${userAvatarFallback}`} alt="User Avatar" data-ai-hint="person user"/>
                    <AvatarFallback className={cn(getParticipantColorClasses(userId, 'user').bg, getParticipantColorClasses(userId, 'user').text)}>
                      {userAvatarFallback}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium hidden sm:inline truncate max-w-[100px]">
                    {userName}
                  </span>
                </>
              )}
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden" aria-label="Teilnehmer anzeigen">
                    <Users className="h-5 w-5" />
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
            </div>
          </header>
        )}

        <div className="flex flex-1 overflow-hidden">
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
            <ScrollArea className={cn("flex-1 p-4 md:p-6", isAdminView ? "bg-background" : "")}>
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
                onOpenReactionPicker={handleOpenReactionPicker}
                onReaction={handleReaction}
                reactingToMessageId={reactingToMessageId}
                onImageClick={handleOpenImageModal} // Pass the handler
              />
            </ScrollArea>

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
              showEmojiPicker={showEmojiPickerForInput}
              setShowEmojiPicker={setShowEmojiPickerForInput}
              handleEmojiSelect={handleEmojiSelectForInput} // For input
              emojiCategories={emojiCategories}
              messageCooldownSeconds={sessionData?.messageCooldownSeconds}
            />
          </main>
        </div>

      {/* Simple Image Modal */}
      {selectedImageForModal && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={handleCloseImageModal}
        >
          <div
            className="bg-card rounded-lg shadow-2xl p-4 relative flex flex-col max-w-[90vw] max-h-[90vh] w-auto h-auto"
            onClick={(e) => e.stopPropagation()} 
          >
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-semibold text-card-foreground truncate">
                {selectedImageFilenameForModal || "Bild"}
                </h3>
                <Button variant="ghost" size="icon" onClick={handleCloseImageModal} className="text-muted-foreground hover:text-foreground">
                    <X className="h-5 w-5" />
                </Button>
            </div>
            <div className="relative flex-1 w-full h-full overflow-hidden flex items-center justify-center">
              <Image
                src={selectedImageForModal}
                alt={selectedImageFilenameForModal || "Großansicht Bild"}
                width={1200} // Provide a large base width
                height={800} // Provide a large base height
                style={{ 
                    maxWidth: '100%', // Allow shrinking
                    maxHeight: 'calc(90vh - 80px)', // Max height considering header and padding
                    width: 'auto', // Maintain aspect ratio
                    height: 'auto', // Maintain aspect ratio
                    objectFit: 'contain', 
                    borderRadius: '0.25rem'
                }}
                data-ai-hint="modal image"
              />
            </div>
          </div>
        </div>
      )}
      </div>
  );
}


interface ChatPageOuterProps {
  params: ChatPageUrlParams;
}

export default function ChatPage({ params }: ChatPageOuterProps) {
  const sessionId = params.sessionId;

  return (
    <Suspense fallback={
      <div className="flex h-screen w-full items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader><CardTitle>Chat wird geladen...</CardTitle></CardHeader>
          <CardContent><p>Einen Moment Geduld, die Simulation wird vorbereitet.</p></CardContent>
        </Card>
      </div>
    }>
      <ChatPageContent sessionIdProp={sessionId} />
    </Suspense>
  );
}
