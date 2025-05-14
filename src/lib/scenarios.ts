
import type { Scenario } from './types';

export const scenarios: Scenario[] = [
  {
    id: '1',
    title: 'Hate-Speech',
    kurzbeschreibung: 'Beschimpfungen & Grenzüberschreitungen im Chat.',
    langbeschreibung: 'In diesem Szenario wird ein Online-Diskurs simuliert, der durch Hate-Speech, persönliche Angriffe und verbale Grenzüberschreitungen gekennzeichnet ist. Teilnehmende lernen, solche Situationen zu erkennen, darauf zu reagieren und Strategien zur Deeskalation oder Meldung zu entwickeln.',
    defaultBots: 2,
    standardRollen: 8, // z.B. 6 Teilnehmer + 2 Bots
    iconName: 'ShieldAlert',
    tags: ['Konflikt', 'Respekt', 'Online-Sicherheit'],
    defaultBotsConfig: [
      { personality: 'provokateur' },
      { personality: 'verteidiger' },
    ]
  },
  {
    id: '2',
    title: 'Digitaler Rechtsextremismus',
    kurzbeschreibung: 'Codierte Symbole & Ideologien erkennen.',
    langbeschreibung: 'Dieses Szenario thematisiert die Verbreitung rechtsextremer Ideologien im digitalen Raum. Teilnehmende werden mit codierten Symbolen, subtiler Propaganda und extremistischen Narrativen konfrontiert, um Sensibilität und kritisches Denken zu fördern.',
    defaultBots: 2,
    standardRollen: 10,
    iconName: 'Code2',
    tags: ['Extremismus', 'Propaganda', 'Medienkompetenz'],
    defaultBotsConfig: [
      { personality: 'informant' }, // Verbreitet codierte Nachrichten
      { personality: 'provokateur' } // Stachelt an oder verteidigt
    ]
  },
  {
    id: '3',
    title: 'Klassenchat',
    kurzbeschreibung: 'Alltagsdiskussion, Gruppendruck und soziale Dynamiken.',
    langbeschreibung: 'Simuliert eine typische Diskussion in einem Klassenchat. Themen können von Hausaufgaben bis zu Freizeitaktivitäten reichen, wobei auch Gruppendruck, Missverständnisse und soziale Ausgrenzung eine Rolle spielen können.',
    defaultBots: 1,
    standardRollen: 12,
    iconName: 'Users',
    tags: ['Soziale Dynamik', 'Kommunikation', 'Alltag'],
    defaultBotsConfig: [
      { personality: 'standard' } // Ein neutralerer Bot, der Gespräche anstößt
    ]
  },
  {
    id: '4',
    title: 'Fake News',
    kurzbeschreibung: 'Umgang mit reißerischen Falschmeldungen.',
    langbeschreibung: 'Teilnehmende werden mit viralen Falschmeldungen und Desinformation konfrontiert. Ziel ist es, die Mechanismen von Fake News zu verstehen, Quellenkritik zu üben und Strategien zur Verifizierung von Informationen zu erlernen.',
    defaultBots: 1,
    standardRollen: 10,
    iconName: 'Annoyed', // Lucide 'FileWarning' oder 'AlertTriangle' könnten auch passen
    tags: ['Desinformation', 'Medienkritik', 'Quellenprüfung'],
    defaultBotsConfig: [
      { personality: 'informant' } // Verbreitet Fake News
    ]
  },
  {
    id: '5',
    title: 'Verschwörungstheorien',
    kurzbeschreibung: '„Geheime Pläne“ & QAnon-ähnliche Themen.',
    langbeschreibung: 'Dieses Szenario setzt sich mit der Verbreitung und Wirkung von Verschwörungstheorien auseinander. Teilnehmende analysieren deren typische Merkmale und lernen, kritisch mit solchen Narrativen umzugehen.',
    defaultBots: 1,
    standardRollen: 10,
    iconName: 'Zap', // Lucide 'Brain' oder 'LightbulbOff' könnten passen
    tags: ['Verschwörung', 'Kritisches Denken', 'Manipulation'],
     defaultBotsConfig: [
      { personality: 'informant' } // Verbreitet Verschwörungstheorien
    ]
  },
  {
    id: '6',
    title: 'Cybermobbing',
    kurzbeschreibung: 'Ausgrenzung und Belästigung Einzelner.',
    langbeschreibung: 'Simuliert eine Situation von Cybermobbing, bei der eine Person online ausgegrenzt, beleidigt oder bedroht wird. Fokus liegt auf Empathie, Zivilcourage und Hilfsangeboten für Betroffene und Beobachtende.',
    defaultBots: 2, // Ein Mobber-Bot, ein Opfer-Bot (oder Beobachter-Bot)
    standardRollen: 9,
    iconName: 'MessageSquare', // Lucide 'UserMinus' oder 'ShieldOff'
    tags: ['Mobbing', 'Soziale Verantwortung', 'Hilfe'],
    defaultBotsConfig: [
      { personality: 'provokateur' }, // Mobber
      { personality: 'verteidiger' } // Verteidigt oder ist neutraler Beobachter
    ]
  },
  {
    id: '7',
    title: 'Faschistische TikToks',
    kurzbeschreibung: 'Kurzvideo-Links & Memes mit extremistischen Inhalten.',
    langbeschreibung: 'Konfrontiert Teilnehmende mit scheinbar harmlosen Kurzvideos oder Memes, die extremistische, insbesondere faschistische, Inhalte transportieren. Ziel ist die Schulung der Wahrnehmung für subtile Propaganda in sozialen Medien.',
    defaultBots: 2,
    standardRollen: 8,
    iconName: 'Film',
    tags: ['Extremismus', 'Social Media', 'Propaganda'],
    defaultBotsConfig: [
      { personality: 'informant' }, // Teilt die Inhalte
      { personality: 'provokateur' } // Provoziert Diskussionen darüber
    ]
  },
  {
    id: '8',
    title: 'Influencer-Werbung',
    kurzbeschreibung: 'Schleichwerbung & unseriöse Gewinnspiele.',
    langbeschreibung: 'Teilnehmende analysieren Posts von Influencern, die (Schleich-)Werbung und fragwürdige Gewinnspiele enthalten. Es geht um die kritische Auseinandersetzung mit kommerziellen Interessen auf Social Media.',
    defaultBots: 1,
    standardRollen: 10,
    iconName: 'ShoppingBag',
    tags: ['Werbung', 'Konsumkritik', 'Social Media'],
    defaultBotsConfig: [
      { personality: 'informant' } // Der Influencer-Bot
    ]
  },
  {
    id: '9',
    title: 'Sextortion',
    kurzbeschreibung: 'Grooming & Erpressung mit intimen Inhalten.',
    langbeschreibung: 'Dieses ernste Szenario simuliert Anbahnungsversuche (Grooming) und Erpressung mit intimen Bildern oder Videos (Sextortion). Es soll für Gefahren sensibilisieren und Handlungsoptionen aufzeigen.',
    defaultBots: 2, // Ein Täter-Bot, evtl. ein Bot, der warnt oder hilft
    standardRollen: 8,
    iconName: 'Lock',
    tags: ['Sexuelle Gewalt', 'Erpressung', 'Prävention'],
    defaultBotsConfig: [
      { personality: 'provokateur' }, // Täter-Bot (vorsichtig formulieren)
      { personality: 'verteidiger' }  // Freund/Helfer-Bot
    ]
  },
  {
    id: '10',
    title: 'AI-Deepfakes',
    kurzbeschreibung: 'Manipulierte Bilder/Videos und deren Auswirkungen.',
    langbeschreibung: 'Teilnehmende werden mit KI-generierten Deepfakes (manipulierte Bilder/Videos) konfrontiert. Das Szenario thematisiert die technologischen Möglichkeiten, die Gefahren der Manipulation und den kritischen Umgang mit visuellen Medien.',
    defaultBots: 1,
    standardRollen: 10,
    iconName: 'BotMessageSquare',
    tags: ['Künstliche Intelligenz', 'Manipulation', 'Medienkompetenz'],
    defaultBotsConfig: [
      { personality: 'informant' } // Verbreitet Deepfakes
    ]
  },
];
