
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

// Vollständige Tag-Taxonomie basierend auf deiner vorherigen Eingabe
export const tagTaxonomy: TagCategory[] = [
  {
    categoryName: "DISKRIMINIERUNG",
    emoji: "🚫",
    tags: [
      {
        name: "Rassismus & Ethnizität",
        emoji: "🌍",
        subTags: [
          { name: "Antisemitismus", emoji: "✡️" },
          { name: "Antiziganismus" },
          { name: "Anti-asiatischer Rassismus" },
          { name: "Anti-slawischer Rassismus" },
          { name: "Antimuslimischer Rassismus", emoji: "☪️" },
          { name: "Antischwarzer Rassismus" },
          { name: "Rassismus (allgemein)" },
          { name: "Migratismus" },
          { name: "Kulturalismus" },
          { name: "Xenophobie" },
        ],
      },
      {
        name: "Geschlecht & Sexualität",
        emoji: "⚧️", // Gender Symbol
        subTags: [
          { name: "Sexismus" },
          { name: "Misogynie" },
          { name: "Transfeindlichkeit" },
          { name: "Homofeindlichkeit", emoji: "🏳️‍🌈" },
          { name: "Bi-/Panfeindlichkeit" },
          { name: "Cis-Sexismus" },
          { name: "Heteronormativität" },
          { name: "TERF-Ideologie" },
          { name: "Incel-Ideologie" },
        ],
      },
      {
        name: "Körper & Aussehen",
        emoji: "💪",
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
        emoji: "🎂",
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
        emoji: "🙏",
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
    emoji: "💥",
    tags: [
      {
        name: "Content-Typen",
        emoji: "📝",
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
        emoji: "🤝",
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
        emoji: "🌐",
        subTags: [
          { name: "Facebook" }, { name: "Instagram" }, { name: "Twitter/X" }, { name: "TikTok" },
          { name: "YouTube" }, { name: "LinkedIn" }, { name: "Snapchat" }, { name: "Pinterest" },
          { name: "Reddit" }, { name: "Discord" },
        ],
      },
      {
        name: "Messenger",
        emoji: "✉️",
        subTags: [ { name: "WhatsApp" }, { name: "Telegram" }, { name: "Signal" }, { name: "Threema" }, { name: "iMessage" } ],
      },
      {
        name: "Gaming",
        emoji: "🎮",
        subTags: [
          { name: "Steam" }, { name: "Twitch" }, { name: "Xbox Live" }, { name: "PlayStation Network" },
          { name: "Mobile Games" }, { name: "MMORPGs" }, { name: "Discord Gaming" },
        ],
      },
      {
        name: "Foren & Communities",
        emoji: "🗣️",
        subTags: [ { name: "4chan/8chan" }, { name: "Reddit" }, { name: "GitHub" }, { name: "Stack Overflow" }, { name: "Imageboards" } ],
      },
      {
        name: "Dating & Social",
        emoji: "❤️‍🔥",
        subTags: [ { name: "Tinder" }, { name: "Bumble" }, { name: "Grindr" }, { name: "OnlyFans" } ],
      },
      {
        name: "Beruflich",
        emoji: "💼",
        subTags: [ { name: "Xing" }, { name: "LinkedIn" }, { name: "Slack" }, { name: "Microsoft Teams" } ],
      },
    ],
  },
  {
    categoryName: "ONLINE-PHÄNOMENE",
    emoji: "🔥",
    tags: [
      {
        name: "Gewaltformen",
        emoji: "👊",
        subTags: [
          { name: "Cybermobbing" }, { name: "Cyberstalking" }, { name: "Doxing" }, { name: "Swatting" },
          { name: "Hate Speech" }, { name: "Flame Wars" }, { name: "Trolling" }, { name: "Griefing" },
        ],
      },
      {
        name: "Missbrauchsformen",
        emoji: "💔",
        subTags: [
          { name: "Catfishing" }, { name: "Grooming" }, { name: "Sextortion" }, { name: "Revenge Porn" },
          { name: "Deepfake Pornografie" }, { name: "Upskirting" }, { name: "Image-Based Sexual Abuse" },
        ],
      },
      {
        name: "Manipulationsstrategien",
        emoji: "🤔",
        subTags: [
          { name: "Gaslighting" }, { name: "Love-Bombing" }, { name: "Negging" }, { name: "Triangulation" },
          { name: "Silent Treatment" }, { name: "DARVO" }, { name: "Whataboutism" }, { name: "Derailing" },
        ],
      },
      {
        name: "Gruppendynamiken",
        emoji: "👥",
        subTags: [
          { name: "Shitstorms" }, { name: "Mobbing-Spiralen" }, { name: "Echo-Chambers" }, { name: "Filter-Bubbles" },
          { name: "Viral Harassment" }, { name: "Pile-On Effekte" }, { name: "Mass Reporting" },
        ],
      },
      {
        name: "Technische Angriffe",
        emoji: "💻",
        subTags: [
          { name: "Account-Hacking" }, { name: "Identity Theft" }, { name: "IP-Doxing" }, { name: "GPS-Stalking" },
          { name: "Malware-Verbreitung" }, { name: "Phishing" }, { name: "Social Engineering" },
        ],
      },
    ],
  },
  {
    categoryName: "THEMEN & KONTEXTE",
    emoji: "🗺️",
    tags: [
      {
        name: "Politisch",
        emoji: "🏛️",
        subTags: [
          { name: "Rechtsextremismus" }, { name: "Linksextremismus" }, { name: "Verschwörungstheorien" },
          { name: "Wahlmanipulation" }, { name: "Autoritarismus" }, { name: "Nationalismus" }, { name: "Populismus" },
        ],
      },
      {
        name: "Gesellschaftlich",
        emoji: "🌍",
        subTags: [
          { name: "Feminismus vs. Antifeminismus" }, { name: "LGBTQIA+ Rechte" }, { name: "Black Lives Matter" },
          { name: "Klimawandel-Leugnung" }, { name: "Impfgegner" }, { name: "Corona-Proteste" },
        ],
      },
      {
        name: "Persönlich",
        emoji: "👤",
        subTags: [
          { name: "Beziehungskonflikte" }, { name: "Familienstreit" }, { name: "Arbeitsplatz-Mobbing" },
          { name: "Schulhof-Gewalt" }, { name: "Nachbarschaftskonflikte" },
        ],
      },
      {
        name: "Kulturell",
        emoji: "🎭",
        subTags: [
          { name: "Gaming-Kultur" }, { name: "Influencer-Drama" }, { name: "Fan-Wars" },
          { name: "Sport-Rivalitäten" }, { name: "Musik-Szenen" },
        ],
      },
      {
        name: "Bildung & Beruf",
        emoji: "🎓",
        subTags: [
          { name: "Schul-Mobbing" }, { name: "Uni-Harassment" }, { name: "Workplace-Bullying" },
          { name: "Academic-Bullying" }, { name: "Peer-Review-Sabotage" },
        ],
      },
    ],
  },
  {
    categoryName: "ZIELGRUPPEN",
    emoji: "🎯",
    tags: [
      {
        name: "Demografisch",
        emoji: "📊",
        subTags: [
          { name: "Kinder (unter 14)" }, { name: "Jugendliche (14-18)" }, { name: "Junge Erwachsene (18-30)" },
          { name: "Erwachsene (30-60)" }, { name: "Senior*innen (60+)" },
        ],
      },
      {
        name: "Sozial",
        emoji: "🤝",
        subTags: [
          { name: "Schüler*innen" }, { name: "Student*innen" }, { name: "Berufstätige" }, { name: "Eltern" },
          { name: "LGBTQIA+ Personen" }, { name: "Migrant*innen" }, { name: "Menschen mit Behinderung" },
          { name: "Aktivist*innen" }, { name: "Influencer" }, { name: "Politiker*innen" }, { name: "Journalist*innen" },
        ],
      },
      {
        name: "Rollen",
        emoji: "🎭",
        subTags: [
          { name: "Opfer/Betroffene" }, { name: "Täter*innen" }, { name: "Bystander" },
          { name: "Unterstützer*innen" }, { name: "Moderator*innen" }, { name: "Administrator*innen" },
        ],
      },
    ],
  },
  {
    categoryName: "TECHNIKEN & STRATEGIEN",
    emoji: "🛠️",
    tags: [
      {
        name: "Eskalationsstrategien",
        emoji: "📈",
        subTags: [
          { name: "Provokation" }, { name: "Beleidigung" }, { name: "Bedrohung" }, { name: "Bloßstellung" },
          { name: "Isolation" }, { name: "False Flag" }, { name: "Victim Blaming" },
        ],
      },
      {
        name: "Desinformation",
        emoji: "🤥",
        subTags: [
          { name: "Fake News" }, { name: "Deepfakes" }, { name: "Manipulated Media" }, { name: "Out-of-Context" },
          { name: "Satire as Truth" }, { name: "Conspiracy Theories" },
        ],
      },
      {
        name: "Psychologische Methoden",
        emoji: "🧠",
        subTags: [
          { name: "Gaslighting" }, { name: "Triangulation" }, { name: "Silent Treatment" }, { name: "Love Bombing" },
          { name: "Intermittent Reinforcement" }, { name: "Trauma Bonding" },
        ],
      },
    ],
  },
  {
    categoryName: "SCHWEREGRADE",
    emoji: "⚖️",
    tags: [
      {
        name: "Intensität",
        emoji: "🌡️",
        subTags: [
          { name: "Niedrig (Mikroaggressionen)" }, { name: "Mittel (Beleidigungen)" },
          { name: "Hoch (Bedrohungen)" }, { name: "Extrem (Doxing, Swatting)" },
        ],
      },
      {
        name: "Dauer",
        emoji: "⏳",
        subTags: [ { name: "Einzelfall" }, { name: "Wiederholend" }, { name: "Systematisch" }, { name: "Koordiniert" } ],
      },
      {
        name: "Reichweite",
        emoji: "📢",
        subTags: [
          { name: "1:1 (Direktnachrichten)" }, { name: "Kleine Gruppe (5-20)" }, { name: "Mittlere Gruppe (20-100)" },
          { name: "Große Gruppe (100-1000)" }, { name: "Viral (1000+)" },
        ],
      },
    ],
  },
];
