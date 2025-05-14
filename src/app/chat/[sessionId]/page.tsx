
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Paperclip, Send, Smile, Mic, User, Bot as BotIcon, CornerDownLeft, Settings, Users, MessageSquare, AlertTriangle, LogOut, PauseCircle, PlayCircle, VolumeX, XCircle, ThumbsUp, SmilePlus, Quote, Eye, Image as ImageIcon, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { useEffect, useState, Suspense, useRef, type FormEvent, type ChangeEvent } from "react";
import { scenarios } from "@/lib/scenarios";
import type { Scenario, Participant as ParticipantType, Message as MessageType, SessionData } from "@/lib/types";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { db, storage } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, Timestamp, doc, getDoc, where, getDocs, updateDoc } from "firebase/firestore";
import { ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { Progress } from "@/components/ui/progress";


interface ChatPageProps {
  params: { sessionId: string }; // For ChatPage component
}

interface ChatPageContentProps {
  sessionId: string; // Passed directly to ChatPageContent
  initialUserName?: string;
  initialUserRole?: string;
  initialUserId?: string;
  initialUserAvatarFallback?: string;
  isAdminView?: boolean;
}

interface DisplayMessage extends MessageType {
  id: string;
  isOwn: boolean;
  timestampDisplay: string;
}

interface DisplayParticipant extends ParticipantType {
  id: string;
}

const participantColors = [
  { name: 'sky', bg: "bg-sky-500/80", text: "text-sky-50", ring: "ring-sky-400", nameText: "text-sky-100" },
  { name: 'emerald', bg: "bg-emerald-500/80", text: "text-emerald-50", ring: "ring-emerald-400", nameText: "text-emerald-100" },
  { name: 'violet', bg: "bg-violet-500/80", text: "text-violet-50", ring: "ring-violet-400", nameText: "text-violet-100" },
  { name: 'rose', bg: "bg-rose-500/80", text: "text-rose-50", ring: "ring-rose-400", nameText: "text-rose-100" },
  { name: 'amber', bg: "bg-amber-500/80", text: "text-amber-50", ring: "ring-amber-400", nameText: "text-amber-100" },
  { name: 'teal', bg: "bg-teal-500/80", text: "text-teal-50", ring: "ring-teal-400", nameText: "text-teal-100" },
  { name: 'indigo', bg: "bg-indigo-500/80", text: "text-indigo-50", ring: "ring-indigo-400", nameText: "text-indigo-100" },
  { name: 'fuchsia', bg: "bg-fuchsia-500/80", text: "text-fuchsia-50", ring: "ring-fuchsia-400", nameText: "text-fuchsia-100" },
];

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

const emojiCategories = [
    { name: "Smileys", icon: "😀", emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺', '🤡', '💩', '👻', '💀', '☠️', '👽', '👾', '🤖', '🎃', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾','🫶', '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦵', '🦿', '🦶', '👂', '🦻', '👃', '🧠', '🦷', '🦴', '👀', '👁️', '👅', '👄', '💋', '🩸'] },
    { name: "People", icon: "🧑", emojis: ['🧑', '👧', '🧒', '👦', '👩', '🧑‍🦱', '👨‍🦱', '👩‍🦱', '🧑‍🦰', '👨‍🦰', '👩‍🦰', '👱‍♀️', '👱', '👱‍♂️', '🧑‍🦳', '👨‍🦳', '👩‍🦳', '🧑‍🦲', '👨‍🦲', '👩‍🦲', '🧔‍♀️', '🧔', '🧔‍♂️', '👵', '🧓', '👴', '👲', '👳‍♀️', '👳', '👳‍♂️', '🧕', '👮‍♀️', '👮', '👮‍♂️', '👷‍♀️', '👷', '👷‍♂️', '💂‍♀️', '💂', '💂‍♂️', '🕵️‍♀️', '🕵️', '🕵️‍♂️', '👩‍⚕️', '👨‍⚕️', '👩‍🌾', '👨‍🌾', '👩‍🍳', '👨‍🍳', '👩‍🎓', '👨‍🎓', '👩‍🎤', '👨‍🎤', '👩‍🏫', '👨‍🏫', '👩‍🏭', '👨‍🏭', '👩‍💻', '👨‍💻', '👩‍💼', '👨‍💼', '👩‍🔧', '👨‍🔧', '👩‍🔬', '👨‍🔬', '👩‍🎨', '👨‍🎨', '👩‍🚒', '👨‍🚒', '👩‍✈️', '👨‍✈️', '👩‍🚀', '👨‍🚀', '👩‍⚖️', '👨‍⚖️', '👰‍♀️', '👰', '👰‍♂️', '🤵‍♀️', '🤵', '🤵‍♂️', '👸', '🤴', '🥷', '🦸‍♀️', '🦸', '🦸‍♂️', '🦹‍♀️', '🦹', '🦹‍♂️', '🤶', '🧑‍🎄', '🎅', '🧙‍♀️', '🧙', '🧙‍♂️', '🧝‍♀️', '🧝', '🧝‍♂️', '🧛‍♀️', '🧛', '🧛‍♂️', '🧟‍♀️', '🧟', '🧟‍♂️', '🧞‍♀️', '🧞', '🧞‍♂️', '🧜‍♀️', '🧜', '🧜‍♂️', '🧚‍♀️', '🧚', '🧚‍♂️', '👼', '🤰', '🤱', '👩‍🍼', '🧑‍🍼', '👨‍🍼', '🙇‍♀️', '🙇', '🙇‍♂️', '💁‍♀️', '💁', '💁‍♂️', '🙅‍♀️', '🙅', '🙅‍♂️', '🙆‍♀️', '🙆', '🙆‍♂️', '🙋‍♀️', '🙋', '🙋‍♂️', '🧏‍♀️', '🧏', '🧏‍♂️', '🤦‍♀️', '🤦', '🤦‍♂️', '🤷‍♀️', '🤷', '🤷‍♂️', '🙎‍♀️', '🙎', '🙎‍♂️', '🙍‍♀️', '🙍', '🙍‍♂️', '💇‍♀️', '💇', '💇‍♂️', '💆‍♀️', '💆', '💆‍♂️', '🧖‍♀️', '🧖', '🧖‍♂️', '👯‍♀️', '👯', '👯‍♂️', '🕺', '💃', '🕴️', '👩‍🦽', '🧑‍🦽', '👨‍🦽', '👩‍🦼', '🧑‍🦼', '👨‍🦼', '🚶‍♀️', '🚶', '🚶‍♂️', '👩‍🦯', '🧑‍🦯', '👨‍🦯', '🧎‍♀️', '🧎', '🧎‍♂️', '🏃‍♀️', '🏃', '🏃‍♂️', '🧍‍♀️', '🧍', '🧍‍♂️', '🗣️', '🫂'] },
    { name: "Animals", icon: "🐻", emojis: ['🙈', '🙉', '🙊', '🐵', '🐺', '🦊', '🦝', '🐱', '🐶', '🦁', '🐯', '🐴', '🦄', '🐮', '🐷', '🐗', '🐭', '🐹', '🐰', '🐻', '🐻‍❄️', '🐨', '🐼', '🐸', '🦓', '🦒', '🐘', '🦣', '🦏', ' Hippo', '🐪', '🐫', '🦙', ' कंगारू', '🦘', '🦥', '🦦', '🦨', '🦡', '🦔', '🦇', '🦅', '🦉', '🐔', '🐧', '🐦', '🐤', '🐥', '🦆', '🦢', '🕊️', '🦩', '🦚', '🦜', '🐸', '🐊', '🐢', '🦎', '🐍', '🐲', '🐉', '🦕', '🦖', '🐳', '🐋', '🐬', '🦭', '🐟', '🐠', '🐡', '🦐', '🦑', '🐙', '🦞', '🦀', '🐌', '🦋', '🐛', '🐜', '🐝', '🪲', '🐞', '🦗', '🕷️', '🕸️', '🦂', '🦟', '🪰', '🪱', '🦠'] },
    { name: "Food", icon: "🍔", emojis: ['🍇', '🍈', '🍉', '🍊', '🍋', '🍌', '🍍', '🥭', '🍎', '🍏', '🍐', '🍑', '🍒', '🍓', '🫐', '🥝', '🍅', '🫒', '🥥', '🥑', '🍆', '🥔', '🥕', '🌽', '🌶️', '🫑', '🥒', '🥬', '🥦', '🧄', '🧅', '🍄', '🥜', '🫘', '🌰', '🍞', '🥐', '🥖', '🫓', '🥨', '🥯', '🥞', '🧇', '🧀', '🍖', '🍗', '🥩', '🥓', '🍔', '🍟', '🍕', '🌭', '🥪', '🌮', '🌯', '🫔', '🥙', '🧆', '🥚', '🍳', '🥘', '🍲', '🫕', '🥣', '🥗', '🍿', '🧈', '🧂', '🥫', '🍱', '🍘', '🍙', '🍚', '🍛', '🍜', '🍝', '🍠', '🍢', '🍣', '🍤', '🍥', '🥮', '🍡', '🥟', '🥠', '🥡', '🍦', '🍧', '🍨', '🍩', '🍪', '🎂', '🍰', '🧁', '🥧', '🍫', '🍬', '🍭', '🍮', '🍯', '🍼', '🥛', '☕', '🫖', '🍵', '🍶', '🍾', '🍷', '🍸', '🍹', '🍺', '🍻', '🥂', '🥃', '🫗', '🥤', '🧋', '🧃', '🧉', '🧊', '🥢'] },
    { name: "Symbols", icon: "❤️", emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '❤️‍🩹', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳', '🈶', '🈚', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️', '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️', '🅱️', '🆎', '🆑', '🅾️', '🆘', '❌', '⭕', '🛑', '⛔', '📛', '🚫', '💯', '💢', '♨️', '🚷', '🚯', '🚳', '🚱', '🔞', '📵', '🚭', '❗', '❕', '❓', '❔', '‼️', '⁉️', '🔅', '🔆', '〽️', '⚠️', '🚸', '🔱', '⚜️', '🔰', '♻️', '✅', '🈯', '💹', '❇️', '✳️', '❎', '🌐', '💠', 'Ⓜ️', '🌀', '💤', '🏧', '🚾', '♿', '🅿️', '🛗', '🈳', '🈂️', '🛂', '🛃', '🛄', '🛅', '🚰', '🚹', '♂️', '🚺', '♀️', '⚧️', '🚼', '🚻', '🚮', '🎦', '📶', '🈁', '🔣', 'ℹ️', '🔤', '🔡', '🔠', '🆖', '🆗', '🆙', '🆒', '🆕', '🆓', '0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '🔢', '#️⃣', '*️⃣', '⏏️', '▶️', '⏸️', '⏯️', '⏹️', '⏺️', '⏭️', '⏮️', '⏩', '⏪', '⏫', '⏬', '◀️', '🔼', '🔽', '➡️', '⬅️', '⬆️', '⬇️', '↗️', '↘️', '↙️', '↖️', '↕️', '↔️', '↪️', '↩️', '⤴️', '⤵️', '🔀', '🔁', '🔂', '🔄', '🔃', '🎵', '🎶', '➕', '➖', '➗', '✖️', '🟰', '♾️', '💲', '💱', '™️', '©️', '®️', '〰️', '➰', '➿', '🔚', '🔙', '🔛', '🔝', '🔜', '✔️', '☑️', '🔘', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🟤', '🔺', '🔻', '◼️', '◻️', '◾', '◽', '▪️', '▫️', '🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '⬛', '⬜', '🟫', '🔶', '🔷', '🔸', '🔹', '🔳', '🔲', '▪', '▫', '▲', '▼'] },
];


export function ChatPageContent({
  sessionId,
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
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [imageUploadProgress, setImageUploadProgress] = useState<number | null>(null);


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

  const getParticipantColorClasses = (pUserId?: string, pSenderType?: 'admin' | 'user' | 'bot'): { bg: string, text: string, nameText: string, ring: string } => {
    if (isAdminView && pUserId === userId) { 
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
                  errorMessage = "Fehler: Keine Berechtigung zum Hochladen. Bitte Admin kontaktieren oder Storage-Regeln prüfen.";
                  break;
                case 'storage/canceled':
                  errorMessage = "Upload abgebrochen.";
                  break;
                case 'storage/unknown':
                  errorMessage = "Unbekannter Fehler beim Upload. Server-Antwort prüfen.";
                  break;
                default:
                  errorMessage = `Storage Fehler: ${error.code} - ${error.message}`;
                  break;
              }
              toast({ variant: "destructive", title: "Bild-Upload fehlgeschlagen", description: errorMessage });
              reject(error);
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
                console.error("Error getting download URL: ", getUrlError);
                toast({ variant: "destructive", title: "Bild-URL Abruf fehlgeschlagen", description: "URL konnte nicht abgerufen werden." });
                reject(getUrlError); 
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
      const messageData: Omit<MessageType, 'id'> = {
        senderUserId: userId,
        senderName: userName,
        senderType: isAdminView ? 'admin' : 'user',
        avatarFallback: userAvatarFallback,
        content: newMessage.trim(),
        timestamp: serverTimestamp(),
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
      if (!(error instanceof Error && (error.message.includes("Bild-Upload fehlgeschlagen") || error.message.includes("URL konnte nicht abgerufen werden") || error.message.includes("Ungültige Datei")))) {
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
    setNewMessage(prev => prev + emoji);
    // setShowEmojiPicker(false); // Keep picker open for multiple emojis
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
  const canSendBasedOnStatusAndMute = isAdminView || (isSessionActive && !isMuted);
  const canTryToSend = canSendBasedOnStatusAndMute && (isAdminView || cooldownRemainingSeconds <= 0);

  let inputPlaceholderText = "Nachricht eingeben...";
  if (isSendingMessage && selectedImageFile && imageUploadProgress !== null) {
    inputPlaceholderText = `Bild wird hochgeladen (${imageUploadProgress.toFixed(0)}%)...`;
  } else if (isSendingMessage) {
    inputPlaceholderText = "Nachricht wird gesendet...";
  } else if (sessionData?.status === "ended") {
    inputPlaceholderText = "Simulation beendet";
  } else if (sessionData?.status === "paused") {
    inputPlaceholderText = "Simulation pausiert";
  } else if (isMuted && !isAdminView) {
    inputPlaceholderText = "Sie sind stummgeschaltet";
  } else if (cooldownRemainingSeconds > 0 && !isAdminView) {
    inputPlaceholderText = `Nächste Nachricht in ${cooldownRemainingSeconds}s...`;
  }
  
  const isSendButtonDisabled = !canTryToSend || (!newMessage.trim() && !selectedImageFile) || isSendingMessage || isLoading;


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
                  <ScrollArea className="h-[200px] text-xs"> {/* Adjusted height */}
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
                const bubbleColor = msg.isOwn ? (isAdminView ? getParticipantColorClasses(userId, 'admin') : { bg: "bg-primary", text: "text-primary-foreground", nameText: "text-primary-foreground/90", ring: "ring-primary" }) : getParticipantColorClasses(msg.senderUserId, msg.senderType);
                return (
                  <div key={msg.id} id={`msg-${msg.id}`} className={`flex gap-3 ${msg.isOwn ? "justify-end" : "justify-start"}`}>
                    {!msg.isOwn && (
                      <Avatar className={cn("h-10 w-10 border-2 self-end", bubbleColor.ring)}>
                        <AvatarImage src={`https://placehold.co/40x40.png?text=${msg.avatarFallback}`} alt={msg.senderName} data-ai-hint="person user" />
                        <AvatarFallback className={`${bubbleColor.bg} ${bubbleColor.text}`}>{msg.avatarFallback}</AvatarFallback>
                      </Avatar>
                    )}
                    <div className={cn("max-w-xs md:max-w-md lg:max-w-lg rounded-xl shadow-md", bubbleColor.bg, bubbleColor.text)}>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between mb-1">
                          <button
                            onClick={() => !msg.isOwn && handleMentionUser(msg.senderName)}
                            className={cn("text-xs font-semibold cursor-pointer hover:underline", msg.isOwn ? bubbleColor.nameText : bubbleColor.nameText)}
                            disabled={msg.isOwn}
                          >
                            {msg.senderName}
                            {msg.senderType === 'bot' && <Badge variant="outline" className={cn("ml-1.5 text-xs px-1 py-0", msg.isOwn ? "border-primary-foreground/50 text-primary-foreground/80" : "border-accent text-accent")}>BOT</Badge>}
                            {msg.senderType === 'admin' && <Badge variant="destructive" className={cn("ml-1.5 text-xs px-1 py-0")}>ADMIN</Badge>}
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
                          <div className="my-2">
                            <Image
                              src={msg.imageUrl}
                              alt={msg.imageFileName || "Hochgeladenes Bild"}
                              width={300}
                              height={200}
                              className="rounded-md object-cover cursor-pointer"
                              onClick={() => window.open(msg.imageUrl, '_blank')}
                              data-ai-hint="chat image"
                            />
                             {msg.imageFileName && <p className="text-xs opacity-70 mt-1">{msg.imageFileName}</p>}
                          </div>
                        )}
                        {msg.content && <p className="text-sm whitespace-pre-wrap">{msg.content}</p>}
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
                           <Button variant="ghost" size="icon" className={`h-6 w-6 p-0 opacity-60 hover:opacity-100 ${bubbleColor.text} hover:bg-black/10`} onClick={() => toast({title: "Reagieren (noch nicht implementiert)"})} aria-label="Reagieren">
                                <SmilePlus className="h-4 w-4" />
                           </Button>
                        </div>
                      </CardContent>
                    </div>
                     {msg.isOwn && userName && userAvatarFallback && userId && (
                       <Avatar className={cn("h-10 w-10 border-2 self-end", isAdminView && msg.senderType === 'admin' ? getParticipantColorClasses(userId, 'admin').ring : getParticipantColorClasses(userId, 'user').ring)}>
                        <AvatarImage src={`https://placehold.co/40x40.png?text=${userAvatarFallback}`} alt="My Avatar" data-ai-hint="person user" />
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
            {imagePreviewUrl && (
              <div className="mb-2 p-2 border rounded-md bg-muted/50 flex items-center gap-2">
                <Image src={imagePreviewUrl} alt="Vorschau" width={60} height={60} className="rounded-md object-cover" data-ai-hint="image preview"/>
                <div className="flex-1 text-sm text-muted-foreground">
                  <p className="font-semibold">{selectedImageFile?.name}</p>
                  <p>{selectedImageFile ? (selectedImageFile.size / 1024).toFixed(1) : 0} KB</p>
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
            {!canTryToSend && sessionData?.status !== "active" && (
              <Alert variant={sessionData?.status === "ended" ? "destructive" : "default"} className="mb-2">
                {sessionData?.status === "paused" ? <PauseCircle className="h-4 w-4" /> : (sessionData?.status === "ended" ? <AlertTriangle className="h-4 w-4" /> : null)}
                <AlertTitle>
                  {sessionData?.status === "ended" ? "Sitzung beendet" : (sessionData?.status === "paused" ? "Sitzung pausiert" : "Hinweis")}
                </AlertTitle>
                <AlertDescription>
                  {sessionData?.status === "ended" ? "Diese Simulation wurde vom Administrator beendet." : "Die Simulation ist aktuell pausiert."}
                </AlertDescription>
              </Alert>
            )}
             {isMuted && !isAdminView && sessionData?.status === "active" && (
                 <Alert variant="destructive" className="mb-2">
                    <VolumeX className="h-4 w-4" />
                    <AlertTitle>Stummgeschaltet</AlertTitle>
                    <AlertDescription>Sie wurden vom Administrator stummgeschaltet.</AlertDescription>
                </Alert>
            )}
            <form className="flex items-center gap-2 md:gap-3" onSubmit={handleSendMessage}>
              <input type="file" ref={fileInputRef} onChange={handleImageFileSelected} accept="image/*" className="hidden" disabled={!canTryToSend || isSendingMessage || isLoading} />
              <Button variant="ghost" size="icon" type="button" className="shrink-0" aria-label="Anhang" disabled={!canTryToSend || isSendingMessage || isLoading} onClick={() => fileInputRef.current?.click()}>
                <Paperclip className="h-5 w-5" />
              </Button>

              <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" type="button" className="shrink-0" aria-label="Emoji" disabled={!canTryToSend || isSendingMessage || isLoading}>
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
                                className="text-xl p-0 h-8 w-8"
                                onClick={() => {
                                  handleEmojiSelect(emoji);
                                }}
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

              <Input
                ref={inputRef}
                id="message-input"
                type="text"
                placeholder={inputPlaceholderText}
                className="flex-1 text-base"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                disabled={!canTryToSend || isSendingMessage || isLoading}
              />
              <Button variant="ghost" size="icon" type="button" className="shrink-0" aria-label="Spracheingabe" disabled={!canTryToSend || isSendingMessage || isLoading} onClick={() => toast({title: "Spracheingabe (noch nicht implementiert)"})}>
                <Mic className="h-5 w-5" />
              </Button>
              <Button type="submit" size="icon" className="shrink-0 bg-primary hover:bg-primary/90" disabled={isSendButtonDisabled} aria-label="Senden">
                {isSendingMessage && selectedImageFile ? <ImageIcon className="h-5 w-5 animate-pulse" /> : <Send className="h-5 w-5" />}
              </Button>
            </form>
            {cooldownRemainingSeconds > 0 && canTryToSend && !isAdminView && sessionData?.status === "active" && !isMuted && (
              <p className="text-xs text-muted-foreground mt-1.5 text-right">Nächste Nachricht in {cooldownRemainingSeconds}s</p>
            )}
            {sessionData?.messageCooldownSeconds && sessionData.messageCooldownSeconds > 0 && cooldownRemainingSeconds <= 0 && canTryToSend && !isAdminView && sessionData?.status === "active" && !isMuted &&(
              <p className="text-xs text-muted-foreground mt-1.5 text-right">Nachrichten Cooldown: {sessionData.messageCooldownSeconds}s</p>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function ChatPage({ params }: { params: ChatPageProps }) {
  const { sessionId } = params; 

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
