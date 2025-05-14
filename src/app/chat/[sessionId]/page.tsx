
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Paperclip, Send, Smile, Mic, User, Bot as BotIcon, CornerDownLeft, Settings, Users, MessageSquare, AlertTriangle, LogOut, PauseCircle, PlayCircle, VolumeX, XCircle, ThumbsUp, SmilePlus, Quote, Eye, Image as ImageIcon, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { useEffect, useState, Suspense, useRef, type FormEvent, type ChangeEvent } from "react";
import { scenarios } from "@/lib/scenarios";
import type { Scenario, Participant as ParticipantType, Message as MessageType, SessionData, DisplayMessage, DisplayParticipant } from "@/lib/types";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { db, storage } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, Timestamp, doc, getDoc, where, getDocs, updateDoc, runTransaction } from "firebase/firestore";
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { participantColors, emojiCategories } from '@/lib/config';
import { MessageInputBar } from '@/components/chat/message-input-bar';


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

const simpleHash = (str: string): number => {
  let hash = 0;
  if (!str) return 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
};


export function ChatPageContent({
  sessionId: currentSessionId, 
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
  const [isLoading, setIsLoading] = useState(true);
  const [isChatDataLoading, setIsChatDataLoading] = useState(true);
  
  const [replyingTo, setReplyingTo] = useState<DisplayMessage | null>(null);
  const [quotingMessage, setQuotingMessage] = useState<DisplayMessage | null>(null);
  
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [reactingToMessageId, setReactingToMessageId] = useState<string | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  
  const [imageForModal, setImageForModal] = useState<string | null>(null);
  const [imageFileNameForModal, setImageFileNameForModal] = useState<string | null>(null);

  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [imageUploadProgress, setImageUploadProgress] = useState<number | null>(null);


  useEffect(() => {
    if (!isAdminView && (!initialUserName || !initialUserRole || !initialUserId || !initialUserAvatarFallback)) {
      const nameFromStorage = localStorage.getItem(`chatUser_${currentSessionId}_name`);
      const roleFromStorage = localStorage.getItem(`chatUser_${currentSessionId}_role`);
      const userIdFromStorage = localStorage.getItem(`chatUser_${currentSessionId}_userId`);
      const avatarFallbackFromStorage = localStorage.getItem(`chatUser_${currentSessionId}_avatarFallback`);

      if (!nameFromStorage || !roleFromStorage || !userIdFromStorage || !avatarFallbackFromStorage) {
        toast({ variant: "destructive", title: "Fehler", description: "Benutzerdetails nicht gefunden. Bitte treten Sie der Sitzung erneut bei." });
        router.push(`/join/${currentSessionId}`);
        return;
      }
      setUserName(nameFromStorage);
      setUserRole(roleFromStorage);
      setUserId(userIdFromStorage);
      setUserAvatarFallback(avatarFallbackFromStorage);
    }

    const scenario = scenarios.find(s => s.id === currentSessionId);
    setCurrentScenario(scenario);

  }, [currentSessionId, toast, router, isAdminView, initialUserName, initialUserRole, initialUserId, initialUserAvatarFallback]);

  useEffect(() => {
    if (!currentSessionId) return;
    setIsLoading(true);
    const sessionDocRef = doc(db, "sessions", currentSessionId);
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
           console.warn("Sitzung nicht gefunden im Admin View für sessionId:", currentSessionId);
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
  }, [currentSessionId, toast, router, isAdminView]);

  useEffect(() => {
    if (!currentSessionId || !userId || isAdminView) return;

    let unsubscribeParticipant: (() => void) | undefined;
    const findParticipantDocAndListen = async () => {
      const participantsColRef = collection(db, "sessions", currentSessionId, "participants");
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
  }, [currentSessionId, userId, isAdminView]);


  useEffect(() => {
    if (!currentSessionId) return;
    setIsChatDataLoading(true);
    const participantsColRef = collection(db, "sessions", currentSessionId, "participants");
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
  }, [currentSessionId, toast]);

  useEffect(() => {
    if (!currentSessionId || !userId) return;
    setIsChatDataLoading(true);
    const messagesColRef = collection(db, "sessions", currentSessionId, "messages");
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
  }, [currentSessionId, toast, userId]);

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

  const getParticipantColorClasses = (pUserId?: string, pSenderType?: 'admin' | 'user' | 'bot'): { bg: string, text: string, nameText: string, ring: string } => {
    if (isAdminView && pUserId === userId && pSenderType === 'admin') {
       return { bg: "bg-destructive/80", text: "text-destructive-foreground", nameText: "text-destructive-foreground/90", ring: "ring-destructive" };
    }
    if (pSenderType === 'admin') {
      return { bg: "bg-destructive/70", text: "text-destructive-foreground", nameText: "text-destructive-foreground/90", ring: "ring-destructive" };
    }
    if (pSenderType === 'bot') {
      return { bg: "bg-accent/60", text: "text-accent-foreground", nameText: "text-accent-foreground/90", ring: "ring-accent" };
    }
    if (!pUserId) {
        return { ...participantColors[0], ring: participantColors[0].ring || "ring-gray-400" };
    }
    const colorIndex = simpleHash(pUserId) % participantColors.length;
    return { ...participantColors[colorIndex], ring: participantColors[colorIndex].ring || `ring-${participantColors[colorIndex].name}-400`};
  };


  const handleImageFileSelected = (event: ChangeEvent<HTMLInputElement>) => {
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
      toast({ variant: "destructive", title: "Senden fehlgeschlagen", description: "Nachricht oder Bild fehlt oder Benutzerdaten fehlen." })
      return;
    }
    if (sessionData?.status === "ended") {
      toast({ variant: "destructive", title: "Sitzung beendet", description: "Keine Nachrichten mehr möglich." });
      return;
    }
    if (sessionData?.status === "paused") {
      toast({ variant: "destructive", title: "Sitzung pausiert", description: "Nachrichtenversand aktuell nicht möglich." });
      return;
    }
    if (isMuted && !isAdminView) {
      toast({ variant: "destructive", title: "Stummgeschaltet", description: "Sie wurden vom Admin stummgeschaltet." });
      return;
    }

    const now = Date.now();
    const cooldownMillis = (sessionData?.messageCooldownSeconds || 0) * 1000;
    if (now - lastMessageSentAt < cooldownMillis && !isAdminView ) {
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
        const imagePath = `chat_images/${currentSessionId}/${imageFileName}`;
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
                case 'paused':
                  console.log('Upload is paused');
                  break;
                case 'running':
                  console.log('Upload is running');
                  break;
              }
            },
            (error) => {
              console.error("Firebase Storage upload error: ", error);
              let errorMessage = `Fehler: ${error.code || 'Unbekannt'}`;
              if (error.message) errorMessage += ` - ${error.message}`;
              switch (error.code) {
                case 'storage/unauthorized':
                  errorMessage = "Fehler: Keine Berechtigung zum Hochladen. Storage-Regeln oder CORS prüfen.";
                  break;
                case 'storage/canceled':
                  errorMessage = "Upload abgebrochen.";
                  break;
                case 'storage/object-not-found':
                    errorMessage = "Fehler: Objekt nicht gefunden. Pfad oder Bucket überprüfen.";
                    break;
                case 'storage/bucket-not-found':
                    errorMessage = "Fehler: Storage Bucket nicht gefunden.";
                    break;
                case 'storage/project-not-found':
                    errorMessage = "Fehler: Firebase Projekt nicht gefunden.";
                    break;
                case 'storage/quota-exceeded':
                    errorMessage = "Fehler: Speicher-Quota überschritten.";
                    break;
                case 'storage/unauthenticated':
                    errorMessage = "Fehler: Nicht authentifiziert. Anmeldung erforderlich oder Regeln prüfen.";
                    break;
                case 'storage/retry-limit-exceeded':
                    errorMessage = "Fehler: Zeitlimit für Upload überschritten. Netzwerk prüfen.";
                    break;
                case 'storage/invalid-checksum':
                     errorMessage = "Fehler: Prüfsumme der Datei stimmt nicht überein. Datei erneut versuchen.";
                     break;
                case 'storage/unknown':
                  errorMessage = "Unbekannter Fehler beim Upload. Server-Antwort prüfen.";
                  break;
                default:
                  errorMessage = `Storage Fehler: ${error.code} - ${error.message}`;
                  break;
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


      const messagesColRef = collection(db, "sessions", currentSessionId, "messages");
      const messageData: Omit<MessageType, 'id'> = {
        senderUserId: userId,
        senderName: userName,
        senderType: isAdminView ? 'admin' : 'user',
        avatarFallback: userAvatarFallback,
        content: newMessage.trim(),
        timestamp: serverTimestamp(),
        reactions: {}, // Initialize with empty reactions
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
      setShowEmojiPicker(false);

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

  const handleEmojiSelect = (emoji: string) => {
    if (reactingToMessageId) {
      handleReaction(reactingToMessageId, emoji);
      setReactingToMessageId(null); 
    } else {
      setNewMessage(prev => prev + emoji);
    }
    setShowEmojiPicker(false);
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!userId || !currentSessionId) return;

    const messageRef = doc(db, "sessions", currentSessionId, "messages", messageId);

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
      // Removed toast for successful reaction to avoid clutter
      // toast({ title: "Reaktion verarbeitet", description: `Ihre Reaktion "${emoji}" wurde gespeichert.` });
    } catch (error) {
      console.error("Error processing reaction: ", error);
      toast({
        variant: "destructive",
        title: "Reaktion fehlgeschlagen",
        description: "Ihre Reaktion konnte nicht gespeichert werden.",
      });
    }
  };

  const openReactionPicker = (messageId: string) => {
    setReactingToMessageId(messageId);
    setShowEmojiPicker(true); 
  };


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

  const isSessionActive = sessionData?.status === "active";

  return (
    <Dialog open={!!imageForModal} onOpenChange={(isOpen) => { if (!isOpen) setImageForModal(null); }}>
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
                  <Avatar className={cn("h-8 w-8 border hidden sm:flex", getParticipantColorClasses(userId, 'user').ring, "ring-2")}>
                    <AvatarImage src={`https://placehold.co/40x40.png?text=${userAvatarFallback}`} alt="User Avatar" data-ai-hint="person user" />
                    <AvatarFallback className={`${getParticipantColorClasses(userId, 'user').bg} ${getParticipantColorClasses(userId, 'user').text}`}>
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
                  <SheetHeader className="mb-4">
                    <SheetTitle>Teilnehmende ({participants.length})</SheetTitle>
                  </SheetHeader>
                  <ScrollArea className="h-[calc(100%-80px)]">
                    <div className="space-y-3">
                      {participants.map((p) => {
                        const pColor = getParticipantColorClasses(p.userId, p.senderType || (p.isBot ? 'bot' : (p.userId === initialUserId && isAdminView ? 'admin' : 'user')));
                        return (
                          <div key={p.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted">
                            <Avatar className={cn("h-9 w-9 border-2", pColor.ring)}>
                              <AvatarImage src={`https://placehold.co/40x40.png?text=${p.avatarFallback}`} alt={p.name} data-ai-hint="person user" />
                              <AvatarFallback className={`${pColor.bg} ${pColor.text}`}>{p.avatarFallback}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium">
                                {p.name}
                                {p.isBot && <Badge variant="outline" className="ml-1.5 text-xs px-1.5 py-0 border-accent text-accent">BOT</Badge>}
                                {(p.userId === initialUserId && isAdminView && p.senderType === 'admin') && <Badge variant="destructive" className="ml-1.5 text-xs px-1.5 py-0">ADMIN</Badge>}
                                {p.userId === userId && isMuted && <VolumeX className="inline h-3 w-3 text-destructive ml-1.5" />}
                              </p>
                              <p className="text-xs text-muted-foreground">{p.role}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </SheetContent>
              </Sheet>
            </div>
          </header>
        )}

        <div className="flex flex-1 overflow-hidden">
          {!isAdminView && (
            <aside className="hidden md:flex md:w-72 lg:w-80 flex-col border-r bg-background p-4 space-y-4">
              <h2 className="text-lg font-semibold">Teilnehmende ({participants.length})</h2>
              <ScrollArea className="flex-1">
                <div className="space-y-3">
                  {participants.map((p) => {
                    const pColor = getParticipantColorClasses(p.userId, p.senderType || (p.isBot ? 'bot' : (p.userId === initialUserId && isAdminView ? 'admin' : 'user')));
                    return (
                      <div key={p.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted">
                         <Avatar className={cn("h-9 w-9 border-2", pColor.ring)}>
                          <AvatarImage src={`https://placehold.co/40x40.png?text=${p.avatarFallback}`} alt={p.name} data-ai-hint="person user" />
                          <AvatarFallback className={`${pColor.bg} ${pColor.text}`}>{p.avatarFallback}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">
                            {p.name}
                            {p.isBot && <Badge variant="outline" className="ml-1.5 text-xs px-1 py-0 border-accent/50 text-accent">BOT</Badge>}
                             {(p.userId === initialUserId && isAdminView && p.senderType === 'admin') && <Badge variant="destructive" className="ml-1.5 text-xs px-1.5 py-0">ADMIN</Badge>}
                            {p.userId === userId && isMuted && <VolumeX className="inline h-3 w-3 text-destructive ml-1.5" />}
                          </p>
                          <p className="text-xs text-muted-foreground">{p.role}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
              <Separator />
              {userRole && currentScenario && userName && userAvatarFallback && userId && (
                <Card className="mt-auto bg-muted/30">
                  <CardHeader className="p-3">
                    <div className="flex items-center gap-2">
                       <Avatar className={cn("h-10 w-10 border-2", getParticipantColorClasses(userId, 'user').ring)}>
                        <AvatarImage src={`https://placehold.co/40x40.png?text=${userAvatarFallback}`} alt="My Avatar" data-ai-hint="person user" />
                        <AvatarFallback className={`${getParticipantColorClasses(userId, 'user').bg} ${getParticipantColorClasses(userId, 'user').text}`}>
                          {userAvatarFallback}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-base">{userName}</CardTitle>
                        <p className="text-xs text-muted-foreground">Ihre Rolle: {userRole}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <ScrollArea className="h-[200px] text-xs">
                        <CardDescription className="text-muted-foreground border-l-2 border-primary pl-2 italic">
                            {currentScenario.langbeschreibung}
                        </CardDescription>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
            </aside>
          )}

          <main className="flex flex-1 flex-col">
            <ScrollArea className={cn("flex-1 p-4 md:p-6", isAdminView ? "bg-background" : "")}>
              <div className="space-y-6">
                {messages.map((msg) => {
                  const bubbleColor = msg.isOwn ? (isAdminView && msg.senderType === 'admin' ? getParticipantColorClasses(userId, 'admin') : { bg: "bg-primary", text: "text-primary-foreground", nameText: "text-primary-foreground/90", ring: "ring-primary" }) : getParticipantColorClasses(msg.senderUserId, msg.senderType);
                  return (
                    <div key={msg.id} id={`msg-${msg.id}`} className={`flex gap-3 ${msg.isOwn ? "justify-end" : "justify-start"}`}>
                      {!msg.isOwn && (
                        <Avatar className={cn("h-10 w-10 border-2 self-end", bubbleColor.ring)}>
                          <AvatarImage src={`https://placehold.co/40x40.png?text=${msg.avatarFallback}`} alt={msg.senderName} data-ai-hint="person user"/>
                          <AvatarFallback className={`${bubbleColor.bg} ${bubbleColor.text}`}>{msg.avatarFallback}</AvatarFallback>
                        </Avatar>
                      )}
                      <div className={cn("max-w-xs md:max-w-md lg:max-w-lg rounded-xl shadow-md", bubbleColor.bg, bubbleColor.text)}>
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between mb-1">
                            <button
                              onClick={() => !msg.isOwn && handleMentionUser(msg.senderName)}
                              className={cn("text-xs font-semibold cursor-pointer hover:underline", bubbleColor.nameText)}
                              disabled={msg.isOwn}
                            >
                              {msg.senderName}
                              {msg.senderType === 'bot' && <Badge variant="outline" className={cn("ml-1.5 text-xs px-1 py-0", msg.isOwn ? "border-primary-foreground/50 text-primary-foreground/80" : "border-accent text-accent bg-accent/10")}>BOT</Badge>}
                              {msg.senderType === 'admin' && !msg.isOwn && <Badge variant="destructive" className={cn("ml-1.5 text-xs px-1.5 py-0")}>ADMIN</Badge>}
                              {msg.senderType === 'admin' && msg.isOwn && <Badge variant="outline" className={cn("ml-1.5 text-xs px-1.5 py-0 border-primary-foreground/70 text-primary-foreground/80")}>ADMIN (Du)</Badge>}

                            </button>
                            <span className={`text-xs ${msg.isOwn ? "text-primary-foreground/70" : "opacity-70"}`}>{msg.timestampDisplay}</span>
                          </div>
                          {msg.replyToMessageId && msg.replyToMessageSenderName && msg.replyToMessageContentSnippet && (
                            <div
                              className={`text-xs p-1.5 rounded-md mb-1.5 flex items-center gap-1 ${msg.isOwn ? "bg-black/20" : "bg-black/10"} opacity-80 cursor-pointer hover:opacity-100`}
                              onClick={() => scrollToMessage(msg.replyToMessageId as string)}
                              title="Zum Original springen"
                            >
                              <CornerDownLeft className="h-3 w-3 shrink-0" />
                              <div className="truncate">
                                <span className="font-medium">Antwort auf {msg.replyToMessageSenderName}:</span> {msg.replyToMessageContentSnippet}
                              </div>
                            </div>
                          )}
                          {msg.imageUrl && (
                             <div 
                                className="my-2 relative w-full max-w-[250px] sm:max-w-[300px] aspect-auto rounded-md overflow-hidden cursor-pointer group"
                                onClick={() => {
                                  setImageForModal(msg.imageUrl || null);
                                  setImageFileNameForModal(msg.imageFileName || "Bild");
                                }}
                               >
                                <Image
                                  src={msg.imageUrl}
                                  alt={msg.imageFileName || "Hochgeladenes Bild"}
                                  width={300} 
                                  height={200} 
                                  style={{ 
                                    maxWidth: "100%", 
                                    height: "auto", 
                                    objectFit: "contain", 
                                    display: "block" 
                                  }}
                                  className="transition-transform duration-300 group-hover:scale-105"
                                  data-ai-hint="chat image"
                                />
                                 <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                    <Eye className="h-8 w-8 text-white" />
                                </div>
                               </div>
                          )}
                           {msg.imageFileName && !msg.imageUrl && <p className="text-xs opacity-70 mt-1 italic">Bild wird geladen: {msg.imageFileName}</p>}
                          {msg.content && <p className="text-sm whitespace-pre-wrap">{msg.content}</p>}
                          
                          {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {Object.entries(msg.reactions).map(([emoji, reactedUserIds]) => {
                                if (!Array.isArray(reactedUserIds) || reactedUserIds.length === 0) return null;
                                const currentUserReacted = reactedUserIds.includes(userId!);
                                return (
                                  <Button
                                    key={emoji}
                                    variant={currentUserReacted ? "secondary" : "ghost"}
                                    size="sm"
                                    className={cn(
                                      "h-auto px-1.5 py-0.5 rounded-full text-xs",
                                      currentUserReacted 
                                        ? `border ${bubbleColor.text === 'text-primary-foreground' ? 'border-primary-foreground/50 bg-black/30' : 'border-current bg-black/20'} ${bubbleColor.text}`
                                        : `${bubbleColor.text} hover:bg-black/10`
                                    )}
                                    onClick={() => handleReaction(msg.id, emoji)}
                                  >
                                    <span className="text-sm mr-0.5">{emoji}</span>
                                    <span>{reactedUserIds.length}</span>
                                  </Button>
                                );
                              })}
                            </div>
                          )}

                          <div className="flex items-center gap-1 mt-1.5">
                            {!msg.isOwn && (
                              <>
                                <Button variant="ghost" size="sm" className={`h-auto px-1.5 py-0.5 opacity-60 hover:opacity-100 ${bubbleColor.text} hover:bg-black/10`} onClick={() => handleSetReply(msg)} aria-label="Antworten">
                                  <CornerDownLeft className="h-3.5 w-3.5 mr-1" /> <span className="text-xs">Antworten</span>
                                </Button>
                                <Button variant="ghost" size="sm" className={`h-auto px-1.5 py-0.5 opacity-60 hover:opacity-100 ${bubbleColor.text} hover:bg-black/10`} onClick={() => handleSetQuote(msg)} aria-label="Zitieren">
                                  <Quote className="h-3.5 w-3.5 mr-1" /> <span className="text-xs">Zitieren</span>
                                </Button>
                              </>
                            )}
                             <Button variant="ghost" size="sm" className={`h-auto px-1.5 py-0.5 opacity-60 hover:opacity-100 ${bubbleColor.text} hover:bg-black/10`} onClick={() => openReactionPicker(msg.id)} aria-label="Reagieren">
                                <SmilePlus className="h-3.5 w-3.5 mr-1" /> <span className="text-xs">Reagieren</span>
                            </Button>
                          </div>
                        </CardContent>
                      </div>
                       {msg.isOwn && userName && userAvatarFallback && userId && (
                         <Avatar className={cn("h-10 w-10 border-2 self-end", isAdminView && msg.senderType === 'admin' ? getParticipantColorClasses(userId, 'admin').ring : getParticipantColorClasses(userId, 'user').ring)}>
                          <AvatarImage src={`https://placehold.co/40x40.png?text=${userAvatarFallback}`} alt="My Avatar" data-ai-hint="person user"/>
                          <AvatarFallback className={`${isAdminView && msg.senderType === 'admin' ? getParticipantColorClasses(userId, 'admin').bg : getParticipantColorClasses(userId, 'user').bg} ${isAdminView && msg.senderType === 'admin' ? getParticipantColorClasses(userId, 'admin').text : getParticipantColorClasses(userId, 'user').text}`}>
                             {msg.senderType === 'admin' && isAdminView ? "AD" : userAvatarFallback}
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
                {messages.length === 0 && !isChatDataLoading && (
                  <div className="text-center text-muted-foreground py-8">
                    <MessageSquare className="mx-auto h-12 w-12 mb-2 opacity-50" />
                    <p>Noch keine Nachrichten in dieser Sitzung.</p>
                    {!isAdminView && <p>Sei der Erste, der eine Nachricht sendet!</p>}
                  </div>
                )}
                {isChatDataLoading && (
                  <div className="text-center text-muted-foreground py-8">
                    <MessageSquare className="mx-auto h-12 w-12 mb-2 opacity-50 animate-pulse" />
                    <p>Lade Chat-Nachrichten...</p>
                  </div>
                )}
              </div>
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
              showEmojiPicker={showEmojiPicker}
              setShowEmojiPicker={setShowEmojiPicker}
              handleEmojiSelect={handleEmojiSelect}
              emojiCategories={emojiCategories}
              reactingToMessageId={reactingToMessageId}
              messageCooldownSeconds={sessionData?.messageCooldownSeconds}
            />
          </main>
        </div>
      </div>
      <DialogContent className="p-0 sm:p-0 max-w-5xl w-[90vw] md:w-[70vw] lg:w-[60vw] h-auto max-h-[90vh] flex flex-col bg-background/95 backdrop-blur-md shadow-2xl rounded-xl">
        <DialogHeader className="p-3 sm:p-4 flex-shrink-0 border-b">
          <DialogTitle className="text-foreground/90 truncate pr-10">
            {imageFileNameForModal || "Bildvorschau"}
          </DialogTitle>
        </DialogHeader>
        {imageForModal && (
          <div className="relative flex-1 w-full min-h-0 flex items-center justify-center p-1 sm:p-2 md:p-4">
            <Image
              src={imageForModal}
              alt={imageFileNameForModal || "Vollbild-Vorschau"}
              width={1200} 
              height={800}
              sizes="(max-width: 768px) 80vw, (max-width: 1200px) 60vw, 50vw"
              style={{
                objectFit: "contain", 
                maxWidth: '100%',    
                maxHeight: '100%',
                width: 'auto',      // Added for aspect ratio
                height: 'auto'     // Added for aspect ratio
              }}
              className="block rounded-md" 
              data-ai-hint="image modal"
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function ChatPage({ params: pageParams }: ChatPageProps) {
  const { sessionId } = pageParams; 

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

    