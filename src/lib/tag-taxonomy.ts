
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

// This is a simplified example, you should expand it with your full taxonomy
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
          { name: "Antimuslimischer Rassismus", emoji: "☪️" },
          { name: "Antischwarzer Rassismus" },
          { name: "Xenophobie" },
        ],
      },
      {
        name: "Geschlecht & Sexualität",
        emoji: "젠더", // Placeholder, find a better emoji
        subTags: [
          { name: "Sexismus" },
          { name: "Misogynie" },
          { name: "Transfeindlichkeit" },
          { name: "Homofeindlichkeit", emoji: "🏳️‍🌈" },
        ],
      },
      // Add more categories and tags as per your full list
    ],
  },
  {
    categoryName: "ONLINE-PHÄNOMENE",
    emoji: "💥",
    tags: [
      {
        name: "Gewaltformen",
        subTags: [
          { name: "Cybermobbing", emoji: "💻" },
          { name: "Hate Speech", emoji: "🤬" },
          { name: "Trolling" },
        ],
      },
      {
        name: "Desinformation",
        subTags: [
          { name: "Fake News", emoji: "📰" },
          { name: "Deepfakes" },
        ],
      },
    ],
  },
  // Add all other main categories and their respective tags and subTags
  // For example:
  {
    categoryName: "PLATTFORMEN",
    emoji: "📱",
    tags: [
      { name: "Social Media", subTags: [{ name: "TikTok" }, { name: "Instagram" }] },
      { name: "Messenger", subTags: [{ name: "WhatsApp" }] },
    ],
  },
  {
    categoryName: "THEMEN & KONTEXTE",
    emoji: "🌐",
    tags: [
      { name: "Politisch" },
      { name: "Gesellschaftlich" },
      { name: "Persönlich" },
    ],
  },
];
