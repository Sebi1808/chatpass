export interface EmojiData {
  emoji: string;
  hexcode: string;
  unicode: number;
  annotation: string;
  tags: string[];
  category: string;
  version?: number;
  hasSkinTones?: boolean;
  skinTones?: Array<{
    emoji: string;
    hexcode: string;
    unicode: number;
    tone: number;
  }>;
  shortcodes?: string[];
}

export interface EmojiCategory {
  id: string;
  name: string;
  nameDE: string;
  icon: string;
  order: number;
  emojis: EmojiData[];
}

export interface EmojiVariation {
  emoji: string;
  hexcode: string;
  unicode: number;
  skintone: number;
  description: string;
  descriptionDE: string;
}

export interface EmojiWithVariations {
  baseEmoji: EmojiData;
  hasVariations: boolean;
  variations: Array<{
    emoji: string;
    tone: number;
    description: string;
  }>;
}

// Basis-Emoji-Kategorien nach Unicode Standard
export const EMOJI_CATEGORIES: Array<Omit<EmojiCategory, 'emojis'>> = [
  { id: 'frequent', name: 'Frequently Used', nameDE: 'Häufig verwendet', icon: '🕒', order: 0 },
  { id: 'people', name: 'People & Body', nameDE: 'Menschen & Körper', icon: '😀', order: 1 },
  { id: 'hearts', name: 'Hearts & Love', nameDE: 'Herzen & Liebe', icon: '❤️', order: 2 },
  { id: 'nature', name: 'Animals & Nature', nameDE: 'Tiere & Natur', icon: '🐻', order: 3 },
  { id: 'food', name: 'Food & Drink', nameDE: 'Essen & Trinken', icon: '🍔', order: 4 },
  { id: 'activity', name: 'Activities', nameDE: 'Aktivitäten', icon: '⚽', order: 5 },
  { id: 'travel', name: 'Travel & Places', nameDE: 'Reisen & Orte', icon: '✈️', order: 6 },
  { id: 'objects', name: 'Objects', nameDE: 'Objekte', icon: '💡', order: 7 },
  { id: 'symbols', name: 'Symbols', nameDE: 'Symbole', icon: '🔣', order: 8 },
  { id: 'flags', name: 'Flags', nameDE: 'Flaggen', icon: '🏁', order: 9 }
];

// Hautfarben-Varianten
export const SKIN_TONES = [
  { id: 1, code: '1F3FB', emoji: '🏻', name: 'Light skin tone', nameDE: 'Helle Hautfarbe' },
  { id: 2, code: '1F3FC', emoji: '🏼', name: 'Medium-light skin tone', nameDE: 'Mittel-helle Hautfarbe' },
  { id: 3, code: '1F3FD', emoji: '🏽', name: 'Medium skin tone', nameDE: 'Mittlere Hautfarbe' },
  { id: 4, code: '1F3FE', emoji: '🏾', name: 'Medium-dark skin tone', nameDE: 'Mittel-dunkle Hautfarbe' },
  { id: 5, code: '1F3FF', emoji: '🏿', name: 'Dark skin tone', nameDE: 'Dunkle Hautfarbe' }
];

// Deutsche Keywords für Hauptkategorien
const GERMAN_KEYWORDS_MAP: Record<string, string[]> = {
  'people': [
    'menschen', 'person', 'hand', 'finger', 'körper', 'familie', 'baby', 'kind',
    'erwachsene', 'alt', 'mann', 'frau', 'junge', 'mädchen', 'beruf', 'job',
    'winken', 'zeigen', 'klatschen', 'beten', 'muskel', 'bein', 'fuß', 'auge',
    'mund', 'nase', 'ohr', 'haar', 'bart', 'smiley', 'lachen', 'freude', 'trauer', 'wut', 'liebe', 'herz', 'gesicht', 
    'emotion', 'gefühl', 'glücklich', 'traurig', 'wütend', 'verliebt', 'lächeln',
    'weinen', 'schreien', 'überrascht', 'schockiert', 'verwirrt', 'müde', 'krank'
  ],
  'hearts': [
    'herz', 'herzen', 'liebe', 'verliebt', 'romantik', 'gefühle', 'emotion',
    'leidenschaft', 'zuneigung', 'rot', 'blau', 'grün', 'gelb', 'orange', 'lila',
    'schwarz', 'weiß', 'braun', 'gebrochen', 'valentine', 'valentinstag',
    'beziehung', 'partnerschaft', 'freundschaft', 'herzklopfen', 'herzschlag'
  ],
  'nature': [
    'tier', 'natur', 'katze', 'hund', 'vogel', 'fisch', 'insekt', 'blume',
    'baum', 'pflanze', 'löwe', 'tiger', 'bär', 'affe', 'elefant', 'pferd',
    'kuh', 'schwein', 'huhn', 'schlange', 'frosch', 'schmetterling', 'biene',
    'rose', 'tulpe', 'sonnenblume', 'wald', 'berg', 'ozean', 'sonne', 'mond'
  ],
  'food': [
    'essen', 'trinken', 'nahrung', 'getränk', 'obst', 'gemüse', 'fleisch',
    'brot', 'kuchen', 'pizza', 'burger', 'kaffee', 'bier', 'wein', 'wasser',
    'apfel', 'banane', 'erdbeere', 'karotte', 'tomate', 'käse', 'milch',
    'schokolade', 'eis', 'restaurant', 'kochen', 'backen'
  ],
  'travel': [
    'reisen', 'ort', 'transport', 'auto', 'flugzeug', 'zug', 'schiff', 'fahrrad',
    'stadt', 'land', 'gebäude', 'haus', 'hotel', 'flughafen', 'bahnhof',
    'strand', 'berg', 'wald', 'park', 'straße', 'brücke', 'turm', 'schloss',
    'kirche', 'krankenhaus', 'schule', 'büro', 'geschäft', 'markt'
  ],
  'activity': [
    'aktivität', 'sport', 'spiel', 'hobby', 'fußball', 'basketball', 'tennis',
    'schwimmen', 'laufen', 'fahrrad', 'ski', 'musik', 'gitarre', 'klavier',
    'tanz', 'kunst', 'malen', 'lesen', 'schreiben', 'fotografieren', 'kochen',
    'garten', 'party', 'feier', 'konzert', 'theater', 'kino', 'spazieren'
  ],
  'objects': [
    'objekt', 'gegenstand', 'werkzeug', 'technologie', 'computer', 'handy',
    'telefon', 'uhr', 'kamera', 'buch', 'brief', 'geld', 'schlüssel',
    'brille', 'schuh', 'kleidung', 'tasche', 'regenschirm', 'lampe',
    'stuhl', 'tisch', 'bett', 'auto', 'fahrrad', 'medizin', 'thermometer'
  ],
  'symbols': [
    'symbol', 'zeichen', 'pfeil', 'stern', 'herz', 'liebe', 'math', 'zahlen',
    'buchstaben', 'warnung', 'stopp', 'ok', 'neu', 'top', 'cool', 'frei',
    'musik', 'lautstärke', 'play', 'pause', 'stop', 'vor', 'zurück',
    'hoch', 'runter', 'links', 'rechts', 'check', 'kreuz', 'fragezeichen'
  ],
  'flags': [
    'flagge', 'land', 'nation', 'staat', 'deutschland', 'europa', 'amerika',
    'asien', 'afrika', 'australien', 'country', 'flaggen', 'international',
    'welt', 'globe', 'erde', 'kontinent', 'region', 'territorium'
  ]
};

// Englische Keywords für bessere Suche
const ENGLISH_KEYWORDS_MAP: Record<string, string[]> = {
  'people': [
    'people', 'person', 'hand', 'finger', 'body', 'family', 'baby', 'child',
    'adult', 'old', 'man', 'woman', 'boy', 'girl', 'job', 'profession',
    'wave', 'point', 'clap', 'pray', 'muscle', 'leg', 'foot', 'eye',
    'mouth', 'nose', 'ear', 'hair', 'beard', 'skin', 'tone', 'smile', 'laugh', 'happy', 'sad', 'angry', 'love', 'heart', 'face',
    'emotion', 'feeling', 'joy', 'cry', 'tears', 'surprised', 'shocked',
    'confused', 'tired', 'sick', 'kiss', 'wink', 'tongue', 'devil', 'angel'
  ],
  'hearts': [
    'heart', 'hearts', 'love', 'romance', 'romantic', 'emotion', 'feeling',
    'passion', 'affection', 'red', 'blue', 'green', 'yellow', 'orange', 'purple',
    'black', 'white', 'brown', 'broken', 'valentine', 'relationship',
    'friendship', 'caring', 'loving', 'heartbeat', 'pulse', 'crush'
  ],
  'nature': [
    'animal', 'nature', 'cat', 'dog', 'bird', 'fish', 'insect', 'flower',
    'tree', 'plant', 'lion', 'tiger', 'bear', 'monkey', 'elephant', 'horse',
    'cow', 'pig', 'chicken', 'snake', 'frog', 'butterfly', 'bee',
    'rose', 'tulip', 'sunflower', 'forest', 'mountain', 'ocean', 'sun', 'moon'
  ],
  'food': [
    'food', 'drink', 'eat', 'beverage', 'fruit', 'vegetable', 'meat',
    'bread', 'cake', 'pizza', 'burger', 'coffee', 'beer', 'wine', 'water',
    'apple', 'banana', 'strawberry', 'carrot', 'tomato', 'cheese', 'milk',
    'chocolate', 'ice', 'restaurant', 'cook', 'bake', 'kitchen'
  ],
  'travel': [
    'travel', 'place', 'transport', 'car', 'plane', 'train', 'ship', 'bike',
    'city', 'country', 'building', 'house', 'hotel', 'airport', 'station',
    'beach', 'mountain', 'forest', 'park', 'road', 'bridge', 'tower', 'castle',
    'church', 'hospital', 'school', 'office', 'shop', 'market', 'vacation'
  ],
  'activity': [
    'activity', 'sport', 'game', 'hobby', 'football', 'basketball', 'tennis',
    'swim', 'run', 'bike', 'ski', 'music', 'guitar', 'piano',
    'dance', 'art', 'paint', 'read', 'write', 'photo', 'cook',
    'garden', 'party', 'celebration', 'concert', 'theater', 'cinema', 'walk'
  ],
  'objects': [
    'object', 'thing', 'tool', 'technology', 'computer', 'mobile', 'phone',
    'watch', 'camera', 'book', 'letter', 'money', 'key', 'glasses',
    'shoe', 'clothes', 'bag', 'umbrella', 'lamp', 'chair', 'table',
    'bed', 'car', 'bicycle', 'medicine', 'thermometer', 'office'
  ],
  'symbols': [
    'symbol', 'sign', 'arrow', 'star', 'heart', 'love', 'math', 'number',
    'letter', 'warning', 'stop', 'ok', 'new', 'top', 'cool', 'free',
    'music', 'volume', 'play', 'pause', 'stop', 'forward', 'back',
    'up', 'down', 'left', 'right', 'check', 'cross', 'question'
  ],
  'flags': [
    'flag', 'country', 'nation', 'state', 'germany', 'europe', 'america',
    'asia', 'africa', 'australia', 'international', 'world', 'globe',
    'earth', 'continent', 'region', 'territory', 'nationality'
  ]
};

export { GERMAN_KEYWORDS_MAP, ENGLISH_KEYWORDS_MAP }; 