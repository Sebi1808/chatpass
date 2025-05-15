
export interface Tag {
  name: string;
  emoji?: string; // Optional emoji
  subTags?: Tag[];
}

export interface TagCategory {
  categoryName: string;
  emoji?: string; // Optional emoji for the category
  tags: Tag[];
}

export const tagTaxonomy: TagCategory[] = [
  {
    categoryName: "DISKRIMINIERUNG",
    emoji: "🚫",
    tags: [
      {
        name: "Rassismus & Ethnizität",
        emoji: "🌍",
        subTags: [
          { name: "Antisemitismus" },
          { name: "Antiziganismus" },
          { name: "Anti-asiatischer Rassismus" },
          { name: "Anti-slawischer Rassismus" },
          { name: "Antimuslimischer Rassismus" },
          { name: "Antischwarzer Rassismus" },
          { name: "Rassismus (allgemein)" },
          { name: "Migratismus" },
          { name: "Kulturalismus" },
          { name: "Xenophobie" },
        ],
      },
      {
        name: "Geschlecht & Sexualität",
        emoji: "젠더", // Gender symbol emoji might vary
        subTags: [
          { name: "Sexismus" },
          { name: "Misogynie" },
          { name: "Transfeindlichkeit" },
          { name: "Homofeindlichkeit" },
          { name: "Bi-/Panfeindlichkeit" },
          { name: "Cis-Sexismus" },
          { name: "Heteronormativität" },
          { name: "TERF-Ideologie" },
          { name: "Incel-Ideologie" },
        ],
      },
      {
        name: "Körper & Aussehen",
        emoji: "🧍",
        subTags: [
          { name: "Ableismus" },
          { name: "Lookismus" },
          { name: "Fettfeindlichkeit" },
          { name: "Body Shaming" },
          { name: "Slut Shaming" },
          { name: "Behindertenfeindlichkeit" },
          { name: "Saneismus" },
        ],
      },
      {
        name: "Alter & Generation",
        emoji: "⏳",
        subTags: [
          { name: "Ageismus" },
          { name: "Adultismus" },
          { name: "Boomer-Bashing" },
          { name: "Generation-Shaming" },
        ],
      },
      {
        name: "Sozioökonomisch",
        emoji: "💰",
        subTags: [
          { name: "Klassismus" },
          { name: "Bildungsstand-Diskriminierung" },
          { name: "Arbeitslosigkeit-Stigma" },
          { name: "Hartz-IV-Shaming" },
          { name: "Wohnungslosigkeit-Stigma" },
          { name: "Regionalismus (Ost/West)" },
        ],
      },
      {
        name: "Religion & Weltanschauung",
        emoji: "🕊️",
        subTags: [
          { name: "Islamophobie" },
          { name: "Christophobie" },
          { name: "Atheisten-Feindlichkeit" },
          { name: "Sektenhass" },
        ],
      },
    ],
  },
  {
    categoryName: "DIGITALE FORMATE & FORMATIONEN",
    emoji: "💻",
    tags: [
      {
        name: "Content-Typen",
        emoji: "📄",
        subTags: [
          { name: "Hasskommentare" },
          { name: "Hate-Memes" },
          { name: "Deepfakes" },
          { name: "Manipulierte Bilder" },
          { name: "Screenshot-Diffamierung" },
          { name: "Fake-Videos" },
          { name: "Voice-Fakes" },
          { name: "Hassmusik/Songs" },
        ],
      },
      {
        name: "Kommunikationsformen",
        emoji: "💬",
        subTags: [
          { name: "Direktnachrichten" },
          { name: "Öffentliche Posts" },
          { name: "Stories/Status" },
          { name: "Live-Streams" },
          { name: "Voice-Messages" },
          { name: "Video-Calls" },
          { name: "Gruppenchats" },
          { name: "Forenbeiträge" },
        ],
      },
      {
        name: "Koordinationsstrukturen",
        emoji: "🔗",
        subTags: [
          { name: "Raid-Aktionen" },
          { name: "Brigading" },
          { name: "Astroturfing" },
          { name: "Sockpuppet-Netzwerke" },
          { name: "Hashtag-Hijacking" },
          { name: "Cancel-Culture" },
          { name: "Review-Bombing" },
        ],
      },
    ],
  },
  {
    categoryName: "PLATTFORMEN",
    emoji: "📱",
    tags: [
      {
        name: "Social Media",
        subTags: [
          { name: "Facebook" }, { name: "Instagram" }, { name: "Twitter/X" }, { name: "TikTok" },
          { name: "YouTube" }, { name: "LinkedIn" }, { name: "Snapchat" }, { name: "Pinterest" },
          { name: "Reddit" }, { name: "Discord" },
        ],
      },
      {
        name: "Messenger",
        subTags: [
          { name: "WhatsApp" }, { name: "Telegram" }, { name: "Signal" }, { name: "Threema" }, { name: "iMessage" },
        ],
      },
      {
        name: "Gaming",
        subTags: [
          { name: "Steam" }, { name: "Twitch" }, { name: "Xbox Live" }, { name: "PlayStation Network" },
          { name: "Mobile Games" }, { name: "MMORPGs" }, { name: "Discord Gaming" },
        ],
      },
      {
        name: "Foren & Communities",
        subTags: [
          { name: "4chan/8chan" }, { name: "Reddit" }, { name: "GitHub" }, { name: "Stack Overflow" }, { name: "Imageboards" },
        ],
      },
      {
        name: "Dating & Social",
        subTags: [
          { name: "Tinder" }, { name: "Bumble" }, { name: "Grindr" }, { name: "OnlyFans" },
        ],
      },
      {
        name: "Beruflich",
        subTags: [
          { name: "Xing" }, { name: "LinkedIn" }, { name: "Slack" }, { name: "Microsoft Teams" },
        ],
      },
    ],
  },
  {
    categoryName: "ONLINE-PHÄNOMENE",
    emoji: "💥",
    tags: [
      {
        name: "Gewaltformen",
        subTags: [
          { name: "Cybermobbing" }, { name: "Cyberstalking" }, { name: "Doxing" }, { name: "Swatting" },
          { name: "Hate Speech" }, { name: "Flame Wars" }, { name: "Trolling" }, { name: "Griefing" },
        ],
      },
      {
        name: "Missbrauchsformen",
        subTags: [
          { name: "Catfishing" }, { name: "Grooming" }, { name: "Sextortion" }, { name: "Revenge Porn" },
          { name: "Deepfake Pornografie" }, { name: "Upskirting" }, { name: "Image-Based Sexual Abuse" },
        ],
      },
      {
        name: "Manipulationsstrategien",
        subTags: [
          { name: "Gaslighting" }, { name: "Love-Bombing" }, { name: "Negging" }, { name: "Triangulation" },
          { name: "Silent Treatment" }, { name: "DARVO (Deny, Attack, Reverse)" }, { name: "Whataboutism" }, { name: "Derailing" },
        ],
      },
      {
        name: "Gruppendynamiken",
        subTags: [
          { name: "Shitstorms" }, { name: "Mobbing-Spiralen" }, { name: "Echo-Chambers" }, { name: "Filter-Bubbles" },
          { name: "Viral Harassment" }, { name: "Pile-On Effekte" }, { name: "Mass Reporting" },
        ],
      },
      {
        name: "Technische Angriffe",
        subTags: [
          { name: "Account-Hacking" }, { name: "Identity Theft" }, { name: "IP-Doxing" }, { name: "GPS-Stalking" },
          { name: "Malware-Verbreitung" }, { name: "Phishing" }, { name: "Social Engineering" },
        ],
      },
    ],
  },
  {
    categoryName: "THEMEN & KONTEXTE",
    emoji: "🌐",
    tags: [
      { name: "Politisch" }, { name: "Gesellschaftlich" }, { name: "Persönlich" }, { name: "Kulturell" }, { name: "Bildung & Beruf" },
    ],
  },
  {
    categoryName: "ZIELGRUPPEN",
    emoji: "👥",
    tags: [
      { name: "Demografisch" }, { name: "Sozial" }, { name: "Rollen" },
    ],
  },
  {
    categoryName: "TECHNIKEN & STRATEGIEN",
    emoji: "🛠️",
    tags: [
      { name: "Eskalationsstrategien" }, { name: "Desinformation" }, { name: "Psychologische Methoden" },
    ],
  },
  {
    categoryName: "SCHWEREGRADE",
    emoji: "📊",
    tags: [
      { name: "Intensität" }, { name: "Dauer" }, { name: "Reichweite" },
    ],
  },
];
