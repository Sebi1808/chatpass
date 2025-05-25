import type { LucideIcon } from 'lucide-react';
import {
  ShieldAlert,
  Code2,
  Users,
  MessageSquare as MessageSquareIcon, // Renamed to avoid conflict if MessageSquare is used differently
  Zap,
  Film,
  ShoppingBag,
  Lock,
  Bot as BotIconLucide, // Renamed to avoid conflict
  Image as ImageIconLucide, // Renamed to avoid conflict
  NotebookPen,
  ListChecks,
  FileText,
  Settings as SettingsIcon, // Renamed
  Database as DatabaseIcon, // Renamed
  MessageCircle,
  BotMessageSquare,
  Users as UsersIconLucide, // Explicitly alias if needed for clarity
} from 'lucide-react';

export interface ParticipantColor {
  name: string;
  bg: string;
  text: string;
  nameText: string;
  ring: string;
}

// DEPRECATED: Diese Emoji-Typen werden durch das neue System ersetzt
// @deprecated Use EmojiData from '@/lib/emoji-data' instead
export interface Emoji { // Sicherstellen, dass dies exportiert wird
  char: string;
  name: string;
  keywords?: string[];
  category?: string;
}

// @deprecated Use EmojiCategory from '@/lib/emoji-data' instead
export interface EmojiCategory { // Sicherstellen, dass dies exportiert wird
  name: string;
  icon: string;
  emojis: Emoji[];
}

// Consistent color definitions
export const participantColors: ParticipantColor[] = [
  { name: 'sky', bg: "bg-sky-600", text: "text-sky-50", nameText: "text-sky-700 dark:text-sky-200", ring: "ring-sky-600" },
  { name: 'emerald', bg: "bg-emerald-600", text: "text-emerald-50", nameText: "text-emerald-700 dark:text-emerald-200", ring: "ring-emerald-600" },
  { name: 'violet', bg: "bg-violet-600", text: "text-violet-50", nameText: "text-violet-700 dark:text-violet-200", ring: "ring-violet-600" },
  { name: 'rose', bg: "bg-rose-600", text: "text-rose-50", nameText: "text-rose-700 dark:text-rose-200", ring: "ring-rose-600" },
  { name: 'amber', bg: "bg-amber-500", text: "text-amber-950 dark:text-amber-50", nameText: "text-amber-700 dark:text-amber-200", ring: "ring-amber-500" },
  { name: 'teal', bg: "bg-teal-600", text: "text-teal-50", nameText: "text-teal-700 dark:text-teal-200", ring: "ring-teal-600" },
  { name: 'cyan', bg: "bg-cyan-600", text: "text-cyan-50", nameText: "text-cyan-700 dark:text-cyan-200", ring: "ring-cyan-600" },
  { name: 'fuchsia', bg: "bg-fuchsia-600", text: "text-fuchsia-50", nameText: "text-fuchsia-700 dark:text-fuchsia-200", ring: "ring-fuchsia-600" },
];

// DEPRECATED: Legacy emoji categories - use the new enhanced system instead
// @deprecated Use EMOJI_CATEGORIES from '@/lib/emoji-data' instead
export const emojiCategories = [
    { name: "Top", icon: "⭐", emojis: ['👍', '❤️', '😂', '🤔', '😠', '👏', '🙏', '🔥', '🎉', '💯'] },
    { name: "Smileys", icon: "😀", emojis: ['👍', '❤️', '😂', '🤔', '😠', '👏', '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺', '🤡', '💩', '👻', '💀', '☠️', '👽', '👾', '🤖', '🎃', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾'] },
    { name: "People", icon: "🧑", emojis: ['🫶', '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👎', '✊', '👊', '🤛', '🤜', '🙌', '👐', '🤲', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦵', '🦿', '🦶', '👂', '🦻', '👃', '🧠', '🦷', '🦴', '👀', '👁️', '👅', '👄', '💋', '🩸', '🧑', '👧', '🧒', '👦', '👩', '🧑‍🦱', '👨‍🦱', '👩‍🦱', '🧑‍🦰', '👨‍🦰', '👩‍🦰', '👱‍♀️', '👱', '👱‍♂️', '🧑‍🦳', '👨‍🦳', '👩‍🦳', '🧑‍🦲', '👨‍🦲', '👩‍🦲', '🧔‍♀️', '🧔', '🧔‍♂️', '👵', '🧓', '👴', '👲', '👳‍♀️', '👳', '👳‍♂️', '🧕', '👮‍♀️', '👮', '👮‍♂️', '👷‍♀️', '👷', '👷‍♂️', '💂‍♀️', '💂', '💂‍♂️', '🕵️‍♀️', '🕵️', '🕵️‍♂️', '👩‍⚕️', '👨‍⚕️', '👩‍🌾', '👨‍🌾', '👩‍🍳', '👨‍🍳', '👩‍🎓', '👨‍🎓', '👩‍🎤', '👨‍🎤', '👩‍🏫', '👨‍🏫', '👩‍🏭', '👨‍🏭', '👩‍💻', '👨‍💻', '👩‍💼', '👨‍💼', '👩‍🔧', '👨‍🔧', '👩‍🔬', '👨‍🔬', '👩‍🎨', '👨‍🎨', '👩‍🚒', '👨‍🚒', '👩‍✈️', '👨‍✈️', '👩‍🚀', '👨‍🚀', '👩‍⚖️', '👨‍⚖️', '👰‍♀️', '👰', '👰‍♂️', '🤵‍♀️', '🤵', '🤵‍♂️', '👸', '🤴', '🥷', '🦸‍♀️', '🦸', '🦸‍♂️', '🦹‍♀️', '🦹', '🦹‍♂️', '🤶', '🧑‍🎄', '🎅', '🧙‍♀️', '🧙', '🧙‍♂️', '🧝‍♀️', '🧝', '🧝‍♂️', '🧛‍♀️', '🧛', '🧛‍♂️', '🧟‍♀️', '🧟', '🧟‍♂️', '🧞‍♀️', '🧞', '🧞‍♂️', '🧜‍♀️', '🧜', '🧜‍♂️', '🧚‍♀️', '🧚', '🧚‍♂️', '👼', '🤰', '🤱', '👩‍🍼', '🧑‍🍼', '👨‍🍼', '🙇‍♀️', '🙇', '🙇‍♂️', '💁‍♀️', '💁', '💁‍♂️', '🙅‍♀️', '🙅', '🙅‍♂️', '🙆‍♀️', '🙆', '🙆‍♂️', '🙋‍♀️', '🙋', '🙋‍♂️', '🧏‍♀️', '🧏', '🧏‍♂️', '🤦‍♀️', '🤦', '🤦‍♂️', '🤷‍♀️', '🤷', '🤷‍♂️', '🙎‍♀️', '🙎', '🙎‍♂️', '🙍‍♀️', '🙍', '🙍‍♂️', '💇‍♀️', '💇', '💇‍♂️', '💆‍♀️', '💆', '💆‍♂️', '🧖‍♀️', '🧖', '🧖‍♂️', '👯‍♀️', '👯', '👯‍♂️', '🕺', '💃', '🕴️', '👩‍🦽', '🧑‍🦽', '👨‍🦽', '👩‍🦼', '🧑‍🦼', '👨‍🦼', '🚶‍♀️', '🚶', '🚶‍♂️', '👩‍🦯', '🧑‍🦯', '👨‍🦯', '🧎‍♀️', '🧎', '🧎‍♂️', '🏃‍♀️', '🏃', '🏃‍♂️', '🧍‍♀️', '🧍', '🧍‍♂️', '🗣️', '🫂'] },
    { name: "Animals", icon: "🐻", emojis: ['🙈', '🙉', '🙊', '🐵', '🐺', '🦊', '🦝', '🐱', '🐶', '🦁', '🐯', '🐴', '🦄', '🐮', '🐷', '🐗', '🐭', '🐹', '🐰', '🐻', '🐻‍❄️', '🐨', '🐼', '🐸', '🦓', '🦒', '🐘', '🦣', '🦏', '🦛', '🐪', '🐫', '🦙', '🦘', '🦥', '🦦', '🦨', '🦡', '🦔', '🦇', '🦅', '🦉', '🐔', '🐧', '🐦', '🐤', '🐥', '🦆', '🦢', '🕊️', '🦩', '🦚', '🦜', '🐸', '🐊', '🐢', '🦎', '🐍', '🐲', '🐉', '🦕', '🦖', '🐳', '🐋', '🐬', '🦭', '🐟', '🐠', '🐡', '🦐', '🦑', '🐙', '🦞', '🦀', '🐌', '🦋', '🐛', '🐜', '🐝', '🪲', '🐞', '🦗', '🕷️', '🕸️', '🦂', '🦟', '🪰', '🪱', '🦠'] },
    { name: "Food", icon: "🍔", emojis: ['🍇', '🍈', '🍉', '🍊', '🍋', '🍌', '🍍', '🥭', '🍎', '🍏', '🍐', '🍑', '🍒', '🍓', '🫐', '🥝', '🍅', '🫒', '🥥', '🥑', '🍆', '🥔', '🥕', '🌽', '🌶️', '🫑', '🥒', '🥬', '🥦', '🧄', '🧅', '🍄', '🥜', '🫘', '🌰', '🍞', '🥐', '🥖', '🫓', '🥨', '🥯', '🥞', '🧇', '🧀', '🍖', '🍗', '🥩', '🥓', '🍔', '🍟', '🍕', '🌭', '🥪', '🌮', '🌯', '𫔔', '🥙', '🧆', '🥚', '🍳', '🥘', '🍲', '𫕕', '🥣', '🥗', '🍿', '🧈', '🧂', '🥫', '🍱', '🍘', '🍙', '🍚', '🍛', '🍜', '🍝', '🍠', '🍢', '🍣', '🍤', '🍥', '🥮', '🍡', '🥟', '🥠', '🥡', '🍦', '🍧', '🍨', '🍩', '🍪', '🎂', '🍰', '🧁', '🥧', '🍫', '🍬', '🍭', '🍮', '🍯', '🍼', '🥛', '☕', '𫖖', '🍵', '🍶', '🍾', '🍷', '🍸', '🍹', '🍺', '🍻', '🥂', '🥃', '𫗗', '🥤', '🧋', '🧃', '🧉', '🧊', '🥢'] },
    { name: "Symbols", icon: "🔣", emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '❤️‍🩹', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳', '🈶', '🈚', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️', '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️', '🅱️', '🆎', '🆑', '🅾️', '🆘', '❌', '⭕', '🛑', '⛔', '📛', '🚫', '💯', '💢', '♨️', '🚷', '🚯', '🚳', '🚱', '🔞', '📵', '🚭', '❗', '❕', '❓', '❔', '‼️', '⁉️', '🔅', '🔆', '〽️', '⚠️', '🚸', '🔱', '⚜️', '🔰', '♻️', '✅', '🈯', '💹', '❇️', '✳️', '❎', '🌐', '💠', 'Ⓜ️', '🌀', '💤', '🏧', '🚾', '♿', '🅿️', '🛗', '🈳', '🈂️', '🛂', '🛃', '🛄', '🛅', '🚰', '🚹', '♂️', '🚺', '♀️', '⚧️', '🚼', '🚻', '🚮', '🎦', '📶', '🈁', '🔣', 'ℹ️', '🔤', '🔡', '🔠', '🆖', '🆗', '🆙', '🆒', '🆕', '🆓', '0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '🔢', '#️⃣', '*️⃣', '⏏️', '▶️', '⏸️', '⏯️', '⏹️', '⏺️', '⏭️', '⏮️', '⏩', '⏪', '⏫', '⏬', '◀️', '🔼', '🔽', '➡️', '⬅️', '⬆️', '⬇️', '↗️', '↘️', '↙️', '↖️', '↕️', '↔️', '↪️', '↩️', '⤴️', '⤵️', '🔀', '🔁', '🔂', '🔄', '🔃', '🎵', '🎶', '➕', '➖', '➗', '✖️', '🟰', '♾️', '💲', '💱', '™️', '©️', '®️', '〰️', '➰', '➿', '🔚', '🔙', '🔛', '🔝', '🔜', '✔️', '☑️', '🔘', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🟤', '🔺', '🔻', '◼️', '◻️', '◾', '◽', '▪️', '▫️', '🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '⬛', '⬜', '🟫', '🔶', '🔷', '🔸', '🔹', '🔳', '🔲', '▪', '▫', '▲', '▼'] },
];

// Map string icon names to actual Lucide components
export const lucideIconMap: Record<string, LucideIcon> = {
  ShieldAlert,
  Code2,
  Users: UsersIconLucide, // Use the alias for clarity
  MessageSquare: MessageSquareIcon, // Use the alias
  Zap,
  Film,
  ShoppingBag,
  Lock,
  BotMessageSquare,
  Image: ImageIconLucide, // Use the alias
  NotebookPen,
  ListChecks,
  FileText,
  Bot: BotIconLucide, // Use the alias
  Settings: SettingsIcon, // Use the alias
  Database: DatabaseIcon, // Use the alias
  MessageCircle,
  // Ensure all icons used in availableIcons are mapped here
};

// Define the available icons for selection in the editor
export const availableIcons: { value: string; label: string; icon: LucideIcon }[] = [
  { value: "Image", label: "🖼️ Standard Bild", icon: ImageIconLucide },
  { value: "ShieldAlert", label: "🛡️ Warnung/Konflikt", icon: ShieldAlert },
  { value: "MessageSquare", label: "💬 Chat/Diskussion", icon: MessageSquareIcon },
  { value: "Users", label: "👥 Gruppen/Soziales", icon: UsersIconLucide },
  { value: "Code2", label: "💻 Technik/Code", icon: Code2 },
  { value: "Zap", label: "⚡ Energie/Aktion", icon: Zap },
  { value: "Film", label: "🎬 Medien/Video", icon: Film },
  { value: "ShoppingBag", label: "🛍️ Handel/Shopping", icon: ShoppingBag },
  { value: "Lock", label: "🔒 Sicherheit/Privatsphäre", icon: Lock },
  { value: "BotMessageSquare", label: "🤖 Bot-Interaktion", icon: BotMessageSquare },
  { value: "NotebookPen", label: "📝 Bildung/Notizen", icon: NotebookPen },
  { value: "ListChecks", label: "☑️ Aufgaben/Organisation", icon: ListChecks },
  { value: "FileText", label: "📄 Dokument/Info", icon: FileText },
  { value: "Bot", label: "🤖 Bot Allgemein", icon: BotIconLucide },
  { value: "Settings", label: "⚙️ Einstellungen", icon: SettingsIcon },
  { value: "Database", label: "🗂️ Daten/Speicher", icon: DatabaseIcon },
  { value: "MessageCircle", label: "💬 Sprechblase", icon: MessageCircle },
];

    