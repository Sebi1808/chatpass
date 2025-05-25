import { 
  fetchFromCDN, 
  fetchShortcodes, 
  fetchEmojis,
  type CompactEmoji,
  type Emoji as EmojibaseEmoji
} from 'emojibase';
import { 
  EmojiData, 
  EmojiCategory, 
  EmojiWithVariations,
  SKIN_TONES 
} from './emoji-data';

// Globale Emoji-Datenbank
let emojiDatabase: EmojiData[] = [];
let categorizedEmojis: EmojiCategory[] = [];
let isInitialized = false;

// Deutsche Übersetzungen für Kategorien
const CATEGORY_TRANSLATIONS: Record<string, { name: string; nameDE: string; icon: string }> = {
  'frequent': { name: 'Frequently Used', nameDE: 'Häufig verwendet', icon: '🕐' },
  'people': { name: 'People & Body', nameDE: 'Personen & Körper', icon: '😀' },
  'hearts': { name: 'Hearts & Love', nameDE: 'Herzen & Liebe', icon: '❤️' },
  'nature': { name: 'Animals & Nature', nameDE: 'Tiere & Natur', icon: '🌱' },
  'food': { name: 'Food & Drink', nameDE: 'Essen & Trinken', icon: '🍎' },
  'activity': { name: 'Activities', nameDE: 'Aktivitäten', icon: '⚽' },
  'travel': { name: 'Travel & Places', nameDE: 'Reisen & Orte', icon: '🚗' },
  'objects': { name: 'Objects', nameDE: 'Objekte', icon: '💡' },
  'symbols': { name: 'Symbols', nameDE: 'Symbole', icon: '🔣' },
  'flags': { name: 'Flags', nameDE: 'Flaggen', icon: '🏳️' },
  'component': { name: 'Components', nameDE: 'Komponenten', icon: '🏽' }
};

// Deutsche Keywords für bessere Suche
const GERMAN_KEYWORDS: Record<string, string[]> = {
  // Gesichter & Emotionen
  '😀': ['lachen', 'grinsen', 'freude', 'glücklich', 'froh'],
  '😂': ['tränen', 'lachen', 'lustig', 'witzig', 'humor'],
  '😊': ['lächeln', 'freundlich', 'glücklich', 'zufrieden'],
  '😍': ['verliebt', 'liebe', 'herzen', 'schwärmen'],
  '😢': ['traurig', 'weinen', 'tränen', 'sad'],
  '😭': ['heulen', 'weinen', 'sehr traurig', 'schluchzen'],
  '😡': ['wütend', 'sauer', 'ärger', 'zorn'],
  '🤔': ['denken', 'nachdenken', 'grübeln', 'überlegen'],
  '😴': ['schlafen', 'müde', 'schlaf', 'erschöpft'],
  '🤗': ['umarmung', 'umarmen', 'freundlich', 'herzlich'],
  
  // Herzen
  '❤️': ['herz', 'liebe', 'rot', 'verliebt'],
  '💙': ['herz', 'blau', 'liebe', 'freundschaft'],
  '💚': ['herz', 'grün', 'liebe', 'natur'],
  '💛': ['herz', 'gelb', 'liebe', 'freundschaft'],
  '🧡': ['herz', 'orange', 'liebe'],
  '💜': ['herz', 'lila', 'violett', 'liebe'],
  '🖤': ['herz', 'schwarz', 'liebe', 'dunkel'],
  '💔': ['herz', 'gebrochen', 'traurig', 'trennung'],
  
  // Tiere
  '🐶': ['hund', 'welpe', 'tier', 'haustier'],
  '🐱': ['katze', 'kätzchen', 'tier', 'haustier'],
  '🐭': ['maus', 'tier', 'nager'],
  '🐹': ['hamster', 'tier', 'haustier', 'nager'],
  '🐰': ['hase', 'kaninchen', 'tier', 'ostern'],
  '🦊': ['fuchs', 'tier', 'wald'],
  '🐻': ['bär', 'tier', 'wald'],
  '🐼': ['panda', 'bär', 'tier', 'china'],
  '🐨': ['koala', 'tier', 'australien'],
  '🐯': ['tiger', 'tier', 'katze', 'wild'],
  
  // Essen
  '🍎': ['apfel', 'frucht', 'gesund', 'rot'],
  '🍌': ['banane', 'frucht', 'gelb'],
  '🍕': ['pizza', 'essen', 'italien'],
  '🍔': ['burger', 'hamburger', 'essen', 'fastfood'],
  '🍟': ['pommes', 'fritten', 'essen', 'fastfood'],
  '🍰': ['kuchen', 'torte', 'süß', 'geburtstag'],
  '🍺': ['bier', 'trinken', 'alkohol', 'deutschland'],
  '☕': ['kaffee', 'trinken', 'heiß', 'morgen'],
  
  // Aktivitäten
  '⚽': ['fußball', 'sport', 'ball', 'deutschland'],
  '🏀': ['basketball', 'sport', 'ball'],
  '🎮': ['spielen', 'gaming', 'videospiel', 'controller'],
  '🎵': ['musik', 'note', 'lied', 'singen'],
  '🎸': ['gitarre', 'musik', 'instrument'],
  '📚': ['bücher', 'lesen', 'lernen', 'schule'],
  '🎬': ['film', 'kino', 'movie'],
  
  // Reisen
  '✈️': ['flugzeug', 'reisen', 'urlaub', 'fliegen'],
  '🚗': ['auto', 'fahren', 'verkehr'],
  '🚅': ['zug', 'bahn', 'reisen', 'schnell'],
  '🏠': ['haus', 'zuhause', 'wohnen'],
  '🏖️': ['strand', 'meer', 'urlaub', 'sonne'],
  '🌍': ['welt', 'erde', 'planet', 'global'],
  
  // Symbole
  '✅': ['richtig', 'korrekt', 'ja', 'erledigt'],
  '❌': ['falsch', 'nein', 'fehler', 'stopp'],
  '⭐': ['stern', 'gut', 'bewertung', 'favorit'],
  '🔥': ['feuer', 'heiß', 'cool', 'awesome'],
  '💯': ['hundert', 'perfekt', 'toll', 'super'],
  '👍': ['daumen hoch', 'gut', 'ok', 'zustimmung'],
  '👎': ['daumen runter', 'schlecht', 'nein', 'ablehnung'],
  
  // Flaggen
  '🇩🇪': ['deutschland', 'german', 'flagge'],
  '🇺🇸': ['usa', 'amerika', 'flagge'],
  '🇬🇧': ['england', 'großbritannien', 'flagge'],
  '🇫🇷': ['frankreich', 'france', 'flagge'],
  '🇪🇸': ['spanien', 'spain', 'flagge'],
  '🇮🇹': ['italien', 'italy', 'flagge']
};

/**
 * Prüft ob ein Emoji ein Herz-Emoji ist
 */
function isHeartEmoji(emoji: string): boolean {
  const heartEmojis = [
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', 
    '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', 
    '❤️‍🔥', '❤️‍🩹'
  ];
  return heartEmojis.includes(emoji);
}

/**
 * Initialisiert die vollständige Emoji-Datenbank mit ALLEN Emojis
 */
export async function initializeEmojiDatabase(): Promise<void> {
  if (isInitialized) return;
  
  try {
    console.log('🚀 Initialisiere vollständige Emoji-Datenbank...');
    
    // Lade ALLE Emojis von emojibase
    const allEmojis = await fetchEmojis('de', {
      compact: false,
      shortcodes: ['emojibase'],
      version: '15.1'
    });
    
    console.log(`📦 ${allEmojis.length} Emojis von emojibase geladen`);
    
    // Konvertiere zu unserem Format
    emojiDatabase = allEmojis.map((emoji: any): EmojiData => {
      const emojiChar = emoji.emoji || String.fromCodePoint(...(emoji.unicode || [emoji.hexcode]));
      const germanKeywords = GERMAN_KEYWORDS[emojiChar] || [];
      
      // Spezielle Kategorie-Zuordnung für Herz-Emojis
      let category = mapEmojibaseCategory(emoji.group);
      if (isHeartEmoji(emojiChar) || germanKeywords.includes('herz') || germanKeywords.includes('liebe')) {
        category = 'hearts';
      }
      
      return {
        emoji: emojiChar,
        hexcode: emoji.hexcode || '',
        unicode: Array.isArray(emoji.unicode) ? emoji.unicode[0] : emoji.unicode || 0,
        annotation: emoji.annotation || emoji.label || emojiChar,
        category: category,
        tags: [...(emoji.tags || []), ...germanKeywords],
        version: emoji.version || 1,
        hasSkinTones: !!(emoji.skins && emoji.skins.length > 0),
        skinTones: emoji.skins ? emoji.skins.map((skin: any) => ({
          emoji: skin.emoji || String.fromCodePoint(...(skin.unicode || [])),
          hexcode: skin.hexcode || '',
          unicode: Array.isArray(skin.unicode) ? skin.unicode[0] : skin.unicode || 0,
          tone: determineSkinTone(typeof skin.tone === 'number' ? skin.tone : 1)
        })) : undefined
      };
    });
    
    // Erstelle Kategorien
    categorizedEmojis = createCategories();
    
    console.log(`✅ Emoji-Datenbank initialisiert mit ${emojiDatabase.length} Emojis in ${categorizedEmojis.length} Kategorien`);
    isInitialized = true;
    
  } catch (error) {
    console.error('❌ Fehler beim Initialisieren der Emoji-Datenbank:', error);
    
    // Fallback: Minimale Emoji-Liste
    emojiDatabase = createFallbackEmojis();
    categorizedEmojis = createCategories();
    isInitialized = true;
  }
}

/**
 * Mappt Emojibase-Kategorien zu unseren Kategorien
 */
function mapEmojibaseCategory(group?: number): string {
  switch (group) {
    case 0: return 'people';
    case 1: return 'people';
    case 2: return 'component';
    case 3: return 'nature';
    case 4: return 'food';
    case 5: return 'travel';
    case 6: return 'activity';
    case 7: return 'objects';
    case 8: return 'symbols';
    case 9: return 'flags';
    default: return 'symbols';
  }
}

/**
 * Bestimmt den Hautton-Index
 */
function determineSkinTone(tone?: number): number {
  if (!tone) return 0;
  // Emojibase verwendet 1-5 für Hauttöne
  return Math.max(1, Math.min(5, tone));
}

/**
 * Erstellt Fallback-Emojis für den Fall, dass emojibase nicht lädt
 */
function createFallbackEmojis(): EmojiData[] {
  const fallbackEmojis = [
    // Häufig verwendete Emojis
    '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇',
    '🥰', '😍', '🤩', '😘', '😗', '☺️', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪',
    '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒',
    '🙄', '😬', '🤥', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧',
    '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐', '😕', '😟',
    '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢',
    '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬',
    '😈', '👿', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻', '👽', '👾', '🤖',
    
    // Herzen
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞',
    '💓', '💗', '💖', '💘', '💝', '💟',
    
    // Handsymbole
    '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙',
    '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '👊', '✊', '🤛', '🤜', '👏',
    '🙌', '👐', '🤲', '🤝', '🙏',
    
    // Tiere
    '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷',
    '🐸', '🐵', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺',
    '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🦗', '🕷️', '🦂',
    
    // Essen
    '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭',
    '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕',
    '🫒', '🧄', '🧅', '🥔', '🍠', '🥐', '🥖', '🍞', '🥨', '🥯', '🧀', '🥚', '🍳',
    '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔', '🍟', '🍕',
    
    // Aktivitäten
    '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸',
    '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋',
    '🎽', '🛹', '🛷', '⛸️', '🥌', '🎿', '⛷️', '🏂', '🪂', '🏋️‍♀️', '🏋️‍♂️', '🤸‍♀️', '🤸‍♂️',
    
    // Reisen
    '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛',
    '🚜', '🏍️', '🛵', '🚲', '🛴', '🛹', '🛼', '🚁', '🛸', '✈️', '🛩️', '🪂', '⛵',
    '🚤', '🛥️', '🛳️', '⛴️', '🚢', '⚓', '⛽', '🚧', '🚨', '🚥', '🚦', '🛑',
    
    // Objekte
    '💎', '🔔', '🔕', '🎵', '🎶', '💰', '💴', '💵', '💶', '💷', '💸', '💳', '🧾',
    '💹', '💱', '💲', '✉️', '📧', '📨', '📩', '📤', '📥', '📦', '📫', '📪', '📬',
    '📭', '📮', '🗳️', '✏️', '✒️', '🖋️', '🖊️', '🖌️', '🖍️', '📝', '💼', '📁',
    '📂', '🗂️', '📅', '📆', '🗒️', '🗓️', '📇', '📈', '📉', '📊', '📋', '📌',
    
    // Symbole
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞',
    '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯',
    '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐',
    '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳', '🈶', '🈚', '🈸',
    '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️', '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️',
    '🅱️', '🆎', '🆑', '🅾️', '🆘', '❌', '⭕', '🛑', '⛔', '📛', '🚫', '💯', '💢',
    '♨️', '🚷', '🚯', '🚳', '🚱', '🔞', '📵', '🚭', '❗', '❕', '❓', '❔', '‼️',
    '⁉️', '🔅', '🔆', '〽️', '⚠️', '🚸', '🔱', '⚜️', '🔰', '♻️', '✅', '🈯',
    '💹', '❇️', '✳️', '❎', '🌐', '💠', 'Ⓜ️', '🌀', '💤', '🏧', '🚾', '♿', '🅿️',
    '🛗', '🈳', '🈂️', '🛂', '🛃', '🛄', '🛅', '🚹', '🚺', '🚼', '⚧️', '🚻', '🚮',
    '🎦', '📶', '🈁', '🔣', 'ℹ️', '🔤', '🔡', '🔠', '🆖', '🆗', '🆙', '🆒', '🆕',
    '🆓', '0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟',
    
    // Flaggen
    '🏁', '🚩', '🎌', '🏴', '🏳️', '🏳️‍🌈', '🏳️‍⚧️', '🏴‍☠️', '🇦🇨', '🇦🇩', '🇦🇪', '🇦🇫',
    '🇦🇬', '🇦🇮', '🇦🇱', '🇦🇲', '🇦🇴', '🇦🇶', '🇦🇷', '🇦🇸', '🇦🇹', '🇦🇺', '🇦🇼', '🇦🇽',
    '🇦🇿', '🇧🇦', '🇧🇧', '🇧🇩', '🇧🇪', '🇧🇫', '🇧🇬', '🇧🇭', '🇧🇮', '🇧🇯', '🇧🇱', '🇧🇲',
    '🇧🇳', '🇧🇴', '🇧🇶', '🇧🇷', '🇧🇸', '🇧🇹', '🇧🇻', '🇧🇼', '🇧🇾', '🇧🇿', '🇨🇦', '🇨🇨',
    '🇨🇩', '🇨🇫', '🇨🇬', '🇨🇭', '🇨🇮', '🇨🇰', '🇨🇱', '🇨🇲', '🇨🇳', '🇨🇴', '🇨🇵', '🇨🇷',
    '🇨🇺', '🇨🇻', '🇨🇼', '🇨🇽', '🇨🇾', '🇨🇿', '🇩🇪', '🇩🇬', '🇩🇯', '🇩🇰', '🇩🇲', '🇩🇴',
    '🇩🇿', '🇪🇦', '🇪🇨', '🇪🇪', '🇪🇬', '🇪🇭', '🇪🇷', '🇪🇸', '🇪🇹', '🇪🇺', '🇫🇮', '🇫🇯',
    '🇫🇰', '🇫🇲', '🇫🇴', '🇫🇷', '🇬🇦', '🇬🇧', '🇬🇩', '🇬🇪', '🇬🇫', '🇬🇬', '🇬🇭', '🇬🇮',
    '🇬🇱', '🇬🇲', '🇬🇳', '🇬🇵', '🇬🇶', '🇬🇷', '🇬🇸', '🇬🇹', '🇬🇺', '🇬🇼', '🇬🇾', '🇭🇰',
    '🇭🇲', '🇭🇳', '🇭🇷', '🇭🇹', '🇭🇺', '🇮🇨', '🇮🇩', '🇮🇪', '🇮🇱', '🇮🇲', '🇮🇳', '🇮🇴',
    '🇮🇶', '🇮🇷', '🇮🇸', '🇮🇹', '🇯🇪', '🇯🇲', '🇯🇴', '🇯🇵', '🇰🇪', '🇰🇬', '🇰🇭', '🇰🇮',
    '🇰🇲', '🇰🇳', '🇰🇵', '🇰🇷', '🇰🇼', '🇰🇾', '🇰🇿', '🇱🇦', '🇱🇧', '🇱🇨', '🇱🇮', '🇱🇰',
    '🇱🇷', '🇱🇸', '🇱🇹', '🇱🇺', '🇱🇻', '🇱🇾', '🇲🇦', '🇲🇨', '🇲🇩', '🇲🇪', '🇲🇫', '🇲🇬',
    '🇲🇭', '🇲🇰', '🇲🇱', '🇲🇲', '🇲🇳', '🇲🇴', '🇲🇵', '🇲🇶', '🇲🇷', '🇲🇸', '🇲🇹', '🇲🇺',
    '🇲🇻', '🇲🇼', '🇲🇽', '🇲🇾', '🇲🇿', '🇳🇦', '🇳🇨', '🇳🇪', '🇳🇫', '🇳🇬', '🇳🇮', '🇳🇱',
    '🇳🇴', '🇳🇵', '🇳🇷', '🇳🇺', '🇳🇿', '🇴🇲', '🇵🇦', '🇵🇪', '🇵🇫', '🇵🇬', '🇵🇭', '🇵🇰',
    '🇵🇱', '🇵🇲', '🇵🇳', '🇵🇷', '🇵🇸', '🇵🇹', '🇵🇼', '🇵🇾', '🇶🇦', '🇷🇪', '🇷🇴', '🇷🇸',
    '🇷🇺', '🇷🇼', '🇸🇦', '🇸🇧', '🇸🇨', '🇸🇩', '🇸🇪', '🇸🇬', '🇸🇭', '🇸🇮', '🇸🇯', '🇸🇰',
    '🇸🇱', '🇸🇲', '🇸🇳', '🇸🇴', '🇸🇷', '🇸🇸', '🇸🇹', '🇸🇻', '🇸🇽', '🇸🇾', '🇸🇿', '🇹🇦',
    '🇹🇨', '🇹🇩', '🇹🇫', '🇹🇬', '🇹🇭', '🇹🇯', '🇹🇰', '🇹🇱', '🇹🇲', '🇹🇳', '🇹🇴', '🇹🇷',
    '🇹🇹', '🇹🇻', '🇹🇼', '🇹🇿', '🇺🇦', '🇺🇬', '🇺🇲', '🇺🇳', '🇺🇸', '🇺🇾', '🇺🇿', '🇻🇦',
    '🇻🇨', '🇻🇪', '🇻🇬', '🇻🇮', '🇻🇳', '🇻🇺', '🇼🇫', '🇼🇸', '🇽🇰', '🇾🇪', '🇾🇹', '🇿🇦',
    '🇿🇲', '🇿🇼'
  ];
  
  return fallbackEmojis.map((emoji, index): EmojiData => {
    const codePoint = emoji.codePointAt(0) || 0;
    const germanKeywords = GERMAN_KEYWORDS[emoji] || [];
    
    return {
      emoji,
      hexcode: codePoint.toString(16).toUpperCase(),
      unicode: codePoint,
      annotation: emoji,
      category: determineFallbackCategory(emoji),
      tags: germanKeywords,
      version: 1,
      hasSkinTones: false
    };
  });
}

/**
 * Bestimmt die Kategorie für Fallback-Emojis
 */
function determineFallbackCategory(emoji: string): string {
  const faces = ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '☺️', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐', '😕', '😟', '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻', '👽', '👾', '🤖'];
  const animals = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🦗', '🕷️', '🦂'];
  const food = ['🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔', '🍠', '🥐', '🥖', '🍞', '🥨', '🥯', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔', '🍟', '🍕'];
  const travel = ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🏍️', '🛵', '🚲', '🛴', '🛹', '🛼', '🚁', '🛸', '✈️', '🛩️', '🪂', '⛵', '🚤', '🛥️', '🛳️', '⛴️', '🚢', '⚓', '⛽', '🚧', '🚨', '🚥', '🚦', '🛑'];
  const flags = emoji.startsWith('🇨') || emoji.startsWith('🇦') || emoji.startsWith('🇧') || emoji.startsWith('🇩') || emoji.startsWith('🇪') || emoji.startsWith('🇫') || emoji.startsWith('🇬') || emoji.startsWith('🇭') || emoji.startsWith('🇮') || emoji.startsWith('🇯') || emoji.startsWith('🇰') || emoji.startsWith('🇱') || emoji.startsWith('🇲') || emoji.startsWith('🇳') || emoji.startsWith('🇴') || emoji.startsWith('🇵') || emoji.startsWith('🇶') || emoji.startsWith('🇷') || emoji.startsWith('🇸') || emoji.startsWith('🇹') || emoji.startsWith('🇺') || emoji.startsWith('🇻') || emoji.startsWith('🇼') || emoji.startsWith('🇽') || emoji.startsWith('🇾') || emoji.startsWith('🇿') || ['🏁', '🚩', '🎌', '🏴', '🏳️'].includes(emoji);
  
  if (isHeartEmoji(emoji)) return 'hearts';
  if (faces.includes(emoji)) return 'people';
  if (animals.includes(emoji)) return 'nature';
  if (food.includes(emoji)) return 'food';
  if (travel.includes(emoji)) return 'travel';
  if (flags) return 'flags';
  if (['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋'].includes(emoji)) return 'activity';
  if (['💎', '🔔', '🔕', '🎵', '🎶', '💰', '💴', '💵', '💶', '💷', '💸', '💳', '🧾', '💹', '💱', '💲', '✉️', '📧', '📨', '📩', '📤', '📥', '📦', '📫', '📪', '📬', '📭', '📮', '🗳️', '✏️', '✒️', '🖋️', '🖊️', '🖌️', '🖍️', '📝', '💼', '📁', '📂', '🗂️', '📅', '📆', '🗒️', '🗓️', '📇', '📈', '📉', '📊', '📋', '📌'].includes(emoji)) return 'objects';
  
  return 'symbols';
}

/**
 * Erstellt kategorisierte Emoji-Listen
 */
function createCategories(): EmojiCategory[] {
  const recentEmojis = getRecentEmojis();
  
  const categories: EmojiCategory[] = [
    {
      id: 'frequent',
      name: 'Frequently Used',
      nameDE: 'Häufig verwendet',
      icon: '🕐',
      order: 0,
      emojis: recentEmojis.length > 0 ? recentEmojis : emojiDatabase.slice(0, 50)
    },
    {
      id: 'people',
      name: 'People & Body',
      nameDE: 'Personen & Körper',
      icon: '😀',
      order: 1,
      emojis: emojiDatabase.filter(e => e.category === 'people')
    },
    {
      id: 'hearts',
      name: 'Hearts & Love',
      nameDE: 'Herzen & Liebe',
      icon: '❤️',
      order: 2,
      emojis: emojiDatabase.filter(e => e.category === 'hearts')
    },
    {
      id: 'nature',
      name: 'Animals & Nature',
      nameDE: 'Tiere & Natur',
      icon: '🌱',
      order: 3,
      emojis: emojiDatabase.filter(e => e.category === 'nature')
    },
    {
      id: 'food',
      name: 'Food & Drink',
      nameDE: 'Essen & Trinken',
      icon: '🍎',
      order: 4,
      emojis: emojiDatabase.filter(e => e.category === 'food')
    },
    {
      id: 'activity',
      name: 'Activities',
      nameDE: 'Aktivitäten',
      icon: '⚽',
      order: 5,
      emojis: emojiDatabase.filter(e => e.category === 'activity')
    },
    {
      id: 'travel',
      name: 'Travel & Places',
      nameDE: 'Reisen & Orte',
      icon: '🚗',
      order: 6,
      emojis: emojiDatabase.filter(e => e.category === 'travel')
    },
    {
      id: 'objects',
      name: 'Objects',
      nameDE: 'Objekte',
      icon: '💡',
      order: 7,
      emojis: emojiDatabase.filter(e => e.category === 'objects')
    },
    {
      id: 'symbols',
      name: 'Symbols',
      nameDE: 'Symbole',
      icon: '🔣',
      order: 8,
      emojis: emojiDatabase.filter(e => e.category === 'symbols')
    },
    {
      id: 'flags',
      name: 'Flags',
      nameDE: 'Flaggen',
      icon: '🏳️',
      order: 9,
      emojis: emojiDatabase.filter(e => e.category === 'flags')
    }
  ];
  
  return categories.filter(cat => cat.emojis.length > 0);
}

/**
 * Sucht Emojis basierend auf deutscher und englischer Eingabe
 */
export function searchEmojis(query: string, limit: number = 50): EmojiData[] {
  if (!query.trim() || !emojiDatabase.length) return [];
  
  const searchTerm = query.toLowerCase().trim();
  const results: Array<{ emoji: EmojiData; score: number }> = [];
  
  for (const emoji of emojiDatabase) {
    let score = 0;
    
    // Exact match in annotation gets highest score
    if (emoji.annotation.toLowerCase().includes(searchTerm)) {
      score += 100;
    }
    
    // Match in German tags
    for (const tag of emoji.tags || []) {
      if (tag.toLowerCase().includes(searchTerm)) {
        score += 50;
      }
      if (tag.toLowerCase() === searchTerm) {
        score += 75;
      }
    }
    
    // Match in shortcodes
    for (const shortcode of emoji.shortcodes || []) {
      if (shortcode.toLowerCase().includes(searchTerm)) {
        score += 30;
      }
    }
    
    // Partial match in annotation
    const words = emoji.annotation.toLowerCase().split(' ');
    for (const word of words) {
      if (word.startsWith(searchTerm)) {
        score += 25;
      }
    }
    
    if (score > 0) {
      results.push({ emoji, score });
    }
  }
  
  // Sort by score (highest first) and return limited results
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(r => r.emoji);
}

/**
 * Gibt alle verfügbaren Kategorien zurück
 */
export function getEmojiCategories(): EmojiCategory[] {
  return categorizedEmojis;
}

/**
 * Gibt Emojis einer bestimmten Kategorie zurück
 */
export function getEmojisByCategory(categoryId: string): EmojiData[] {
  const category = categorizedEmojis.find(cat => cat.id === categoryId);
  return category ? category.emojis : [];
}

/**
 * Gibt kürzlich verwendete Emojis zurück
 */
export function getRecentEmojis(): EmojiData[] {
  try {
    const recent = localStorage.getItem('recentEmojis');
    if (!recent) return [];
    
    const recentEmojiChars: string[] = JSON.parse(recent);
    return recentEmojiChars
      .map(char => emojiDatabase.find(e => e.emoji === char))
      .filter((emoji): emoji is EmojiData => emoji !== undefined)
      .slice(0, 50);
  } catch {
    return [];
  }
}

/**
 * Fügt ein Emoji zu den kürzlich verwendeten hinzu
 */
export function addToRecentEmojis(emoji: EmojiData): void {
  try {
    const recent = getRecentEmojis();
    const filtered = recent.filter(e => e.emoji !== emoji.emoji);
    const updated = [emoji, ...filtered].slice(0, 50);
    
    localStorage.setItem('recentEmojis', JSON.stringify(updated.map(e => e.emoji)));
    
    // Update frequent category
    const frequentCategory = categorizedEmojis.find(cat => cat.id === 'frequent');
    if (frequentCategory) {
      frequentCategory.emojis = updated;
    }
  } catch (error) {
    console.error('Fehler beim Speichern der kürzlich verwendeten Emojis:', error);
  }
}

/**
 * Gibt Hauton-Variationen für ein Emoji zurück
 */
export function getEmojiVariations(emoji: EmojiData): EmojiWithVariations {
  const variations: Array<{ emoji: string; tone: number; description: string }> = [];
  
  if (emoji.hasSkinTones && emoji.skinTones) {
    emoji.skinTones.forEach((skinTone: any) => {
      const tone = SKIN_TONES.find(t => t.id === skinTone.tone);
      if (tone) {
        variations.push({
          emoji: skinTone.emoji,
          tone: skinTone.tone,
          description: `${emoji.annotation} (${tone.nameDE})`
        });
      }
    });
  }
  
  return {
    baseEmoji: emoji,
    hasVariations: variations.length > 0,
    variations
  };
}

/**
 * Gibt alle verfügbaren Emojis zurück
 */
export function getAllEmojis(): EmojiData[] {
  return emojiDatabase;
}

/**
 * Überprüft ob die Emoji-Datenbank bereit ist
 */
export function isEmojiDatabaseReady(): boolean {
  return isInitialized && emojiDatabase.length > 0;
} 