
import type { Scenario } from './types';

export const scenarios: Scenario[] = [
  {
    id: '1',
    title: 'Hate-Speech',
    kurzbeschreibung: 'Beschimpfungen & Grenzüberschreitungen im Chat.',
    langbeschreibung: 'In diesem Szenario wird ein Online-Diskurs simuliert, der durch Hate-Speech, persönliche Angriffe und verbale Grenzüberschreitungen gekennzeichnet ist. Teilnehmende lernen, solche Situationen zu erkennen, darauf zu reagieren und Strategien zur Deeskalation oder Meldung zu entwickeln.',
    defaultBots: 2,
    standardRollen: 5, // 3 Humans + 2 Bots
    iconName: 'ShieldAlert',
    tags: ['Konflikt', 'Respekt', 'Online-Sicherheit'],
    previewImageUrl: 'https://placehold.co/600x400.png',
    lernziele: [
        "Hate-Speech erkennen und definieren können.",
        "Strategien zur Reaktion auf Hate-Speech entwickeln (Gegenrede, Melden, Ignorieren).",
        "Emotionale Auswirkungen von Hate-Speech auf Betroffene verstehen."
    ],
    defaultBotsConfig: [
      { id: '1-prov-0', name: "Provokateur Alpha", personality: 'provokateur', avatarFallback: 'PA', currentEscalation: 1, isActive: true, initialMission: "Störe die Diskussion mit aggressiven Kommentaren." },
      { id: '1-vert-1', name: "Verteidiger Beta", personality: 'verteidiger', avatarFallback: 'VB', currentEscalation: 0, isActive: true, initialMission: "Tritt für einen respektvollen Umgang ein und widersprich dem Provokateur." },
    ],
    humanRolesConfig: [
        { id: "1-opfer-0", name: "Zielperson der Angriffe", description: "Du hast einen neutralen Kommentar gepostet und wirst nun Ziel von verbalen Attacken. Versuche, dich zu behaupten oder Hilfe zu suchen." },
        { id: "1-unterstuetzer-0", name: "Unterstützer*in", description: "Du beobachtest die Angriffe auf die Zielperson. Entscheide, ob und wie du eingreifst, um zu helfen oder zu deeskalieren." },
        { id: "1-beobachter-0", name: "Stiller Beobachter", description: "Du liest im Chat mit, greifst aber zunächst nicht aktiv ein. Überlege, was deine Zurückhaltung bewirkt und wann ein Eingreifen für dich sinnvoll wäre." }
    ]
  },
  {
    id: '2',
    title: 'Digitaler Rechtsextremismus',
    kurzbeschreibung: 'Codierte Symbole & Ideologien erkennen.',
    langbeschreibung: 'Dieses Szenario thematisiert die Verbreitung rechtsextremer Ideologien im digitalen Raum. Teilnehmende werden mit codierten Symbolen, subtiler Propaganda und extremistischen Narrativen konfrontiert, um Sensibilität und kritisches Denken zu fördern.',
    defaultBots: 2,
    standardRollen: 4, // 2 Humans + 2 Bots
    iconName: 'Code2',
    tags: ['Extremismus', 'Propaganda', 'Medienkompetenz'],
    previewImageUrl: 'https://placehold.co/600x400.png',
    lernziele: [
        "Codierte Sprache und Symbole des digitalen Rechtsextremismus identifizieren.",
        "Manipulative Strategien in rechtsextremen Online-Inhalten analysieren.",
        "Handlungsmöglichkeiten gegen die Verbreitung solcher Inhalte diskutieren."
    ],
    defaultBotsConfig: [
      { id: '2-info-0', name: "Agitator Gamma", personality: 'informant', avatarFallback: 'AG', currentEscalation: 0, isActive: true, initialMission: "Verbreite subtil rechtsextreme Narrative und teste die Reaktionen." },
      { id: '2-prov-1', name: "Rekrutierer Delta", personality: 'provokateur', avatarFallback: 'RD', currentEscalation: 1, isActive: true, initialMission: "Versuche, andere von deinen 'alternativen Fakten' zu überzeugen und für deine Gruppe zu gewinnen." }
    ],
    humanRolesConfig: [
        { id: "2-kritiker-0", name: "Kritische Stimme", description: "Du erkennst die problematischen Inhalte und versuchst, argumentativ dagegenzuhalten und andere zu warnen." },
        { id: "2-unsicher-0", name: "Unsichere Person", description: "Du bist neu in der Online-Gruppe und unsicher, wie du die geteilten Informationen einordnen sollst. Du bist anfällig für einfache Erklärungen." }
    ]
  },
  {
    id: '3',
    title: 'Klassenchat',
    kurzbeschreibung: 'Alltagsdiskussion, Gruppendruck und soziale Dynamiken.',
    langbeschreibung: 'Simuliert eine typische Diskussion in einem Klassenchat. Themen können von Hausaufgaben bis zu Freizeitaktivitäten reichen, wobei auch Gruppendruck, Missverständnisse und soziale Ausgrenzung eine Rolle spielen können.',
    defaultBots: 1,
    standardRollen: 1, // 0 Humans + 1 Bot (example)
    iconName: 'Users',
    tags: ['Soziale Dynamik', 'Kommunikation', 'Alltag'],
    previewImageUrl: 'https://placehold.co/600x400.png',
    lernziele: [],
    defaultBotsConfig: [
      { id: '3-std-0', name: "Mitschüler Epsilon", personality: 'standard', avatarFallback: 'ME', currentEscalation: 0, isActive: true, initialMission: "Nimm an der Diskussion teil, stelle Fragen und reagiere auf andere." }
    ],
    humanRolesConfig: []
  },
  {
    id: '4',
    title: 'Fake News',
    kurzbeschreibung: 'Umgang mit reißerischen Falschmeldungen.',
    langbeschreibung: 'Teilnehmende werden mit viralen Falschmeldungen und Desinformation konfrontiert. Ziel ist es, die Mechanismen von Fake News zu verstehen, Quellenkritik zu üben und Strategien zur Verifizierung von Informationen zu erlernen.',
    defaultBots: 1,
    standardRollen: 1, // 0 Humans + 1 Bot
    iconName: 'Annoyed',
    tags: ['Desinformation', 'Medienkritik', 'Quellenprüfung'],
    previewImageUrl: 'https://placehold.co/600x400.png',
    defaultBotsConfig: [
      { id: '4-info-0', name: "Nachrichtenstreuer Zeta", personality: 'informant', avatarFallback: 'NZ', currentEscalation: 1, isActive: true, initialMission: "Poste eine reißerische Falschmeldung und beobachte die Reaktionen." }
    ],
    humanRolesConfig: []
  },
  {
    id: '5',
    title: 'Verschwörungstheorien',
    kurzbeschreibung: '„Geheime Pläne“ & QAnon-ähnliche Themen.',
    langbeschreibung: 'Dieses Szenario setzt sich mit der Verbreitung und Wirkung von Verschwörungstheorien auseinander. Teilnehmende analysieren deren typische Merkmale und lernen, kritisch mit solchen Narrativen umzugehen.',
    defaultBots: 1,
    standardRollen: 1, // 0 Humans + 1 Bot
    iconName: 'Zap',
    tags: ['Verschwörung', 'Kritisches Denken', 'Manipulation'],
    previewImageUrl: 'https://placehold.co/600x400.png',
     defaultBotsConfig: [
      { id: '5-info-0', name: "Theoretiker Eta", personality: 'informant', avatarFallback: 'TE', currentEscalation: 0, isActive: true, initialMission: "Präsentiere eine obskure Theorie als absolute Wahrheit." }
    ],
    humanRolesConfig: []
  },
  {
    id: '6',
    title: 'Cybermobbing',
    kurzbeschreibung: 'Ausgrenzung und Belästigung Einzelner.',
    langbeschreibung: 'Simuliert eine Situation von Cybermobbing, bei der eine Person online ausgegrenzt, beleidigt oder bedroht wird. Fokus liegt auf Empathie, Zivilcourage und Hilfsangeboten für Betroffene und Beobachtende.',
    defaultBots: 2,
    standardRollen: 2, // 0 Humans + 2 Bots
    iconName: 'MessageSquare',
    tags: ['Mobbing', 'Soziale Verantwortung', 'Hilfe'],
    previewImageUrl: 'https://placehold.co/600x400.png',
    defaultBotsConfig: [
      { id: '6-prov-0', name: "Mobber Theta", personality: 'provokateur', avatarFallback: 'MT', currentEscalation: 1, isActive: true, initialMission: "Suche dir ein Opfer und beginne mit subtilen Sticheleien, die sich steigern." },
      { id: '6-vert-1', name: "Helfer Iota", personality: 'verteidiger', avatarFallback: 'HI', currentEscalation: 0, isActive: true, initialMission: "Erkenne das Mobbing und versuche, dem Opfer beizustehen." }
    ],
    humanRolesConfig: []
  },
  {
    id: '7',
    title: 'Faschistische TikToks',
    kurzbeschreibung: 'Kurzvideo-Links & Memes mit extremistischen Inhalten.',
    langbeschreibung: 'Konfrontiert Teilnehmende mit scheinbar harmlosen Kurzvideos oder Memes, die extremistische, insbesondere faschistische, Inhalte transportieren. Ziel ist die Schulung der Wahrnehmung für subtile Propaganda in sozialen Medien.',
    defaultBots: 2,
    standardRollen: 2, // 0 Humans + 2 Bots
    iconName: 'Film',
    tags: ['Extremismus', 'Social Media', 'Propaganda'],
    previewImageUrl: 'https://placehold.co/600x400.png',
    defaultBotsConfig: [
      { id: '7-info-0', name: "Meme Lord Kappa", personality: 'informant', avatarFallback: 'MK', currentEscalation: 0, isActive: true, initialMission: "Teile Memes, die auf den zweiten Blick problematische Ideologien transportieren." },
      { id: '7-prov-1', name: "Verharmloser Lambda", personality: 'provokateur', avatarFallback: 'VL', currentEscalation: 0, isActive: true, initialMission: "Tue kritische Nachfragen zu den Memes als Überempfindlichkeit ab." }
    ],
    humanRolesConfig: []
  },
  {
    id: '8',
    title: 'Influencer-Werbung',
    kurzbeschreibung: 'Schleichwerbung & unseriöse Gewinnspiele.',
    langbeschreibung: 'Teilnehmende analysieren Posts von Influencern, die (Schleich-)Werbung und fragwürdige Gewinnspiele enthalten. Es geht um die kritische Auseinandersetzung mit kommerziellen Interessen auf Social Media.',
    defaultBots: 1,
    standardRollen: 1, // 0 Humans + 1 Bot
    iconName: 'ShoppingBag',
    tags: ['Werbung', 'Konsumkritik', 'Social Media'],
    previewImageUrl: 'https://placehold.co/600x400.png',
    defaultBotsConfig: [
      { id: '8-info-0', name: "Influencer My", personality: 'informant', avatarFallback: 'IM', currentEscalation: 0, isActive: true, initialMission: "Bewerbe ein Produkt auf übertriebene Weise und starte ein unrealistisches Gewinnspiel." }
    ],
    humanRolesConfig: []
  },
  {
    id: '9',
    title: 'Sextortion',
    kurzbeschreibung: 'Grooming & Erpressung mit intimen Inhalten.',
    langbeschreibung: 'Dieses ernste Szenario simuliert Anbahnungsversuche (Grooming) und Erpressung mit intimen Bildern oder Videos (Sextortion). Es soll für Gefahren sensibilisieren und Handlungsoptionen aufzeigen.',
    defaultBots: 2,
    standardRollen: 2, // 0 Humans + 2 Bots
    iconName: 'Lock',
    tags: ['Sexuelle Gewalt', 'Erpressung', 'Prävention'],
    previewImageUrl: 'https://placehold.co/600x400.png',
    defaultBotsConfig: [
      { id: '9-prov-0', name: "Groomer Ny", personality: 'provokateur', avatarFallback: 'GN', currentEscalation: 0, isActive: true, initialMission: "Baue Vertrauen zu jemandem auf, um an private Informationen oder Bilder zu gelangen." },
      { id: '9-vert-1', name: "Warner Xi", personality: 'verteidiger', avatarFallback: 'WX', currentEscalation: 0, isActive: true, initialMission: "Versuche, potenzielle Opfer vor den Maschen des Groomers zu warnen, ohne direkt zu konfrontieren." }
    ],
    humanRolesConfig: []
  },
  {
    id: '10',
    title: 'AI-Deepfakes',
    kurzbeschreibung: 'Manipulierte Bilder/Videos und deren Auswirkungen.',
    langbeschreibung: 'Teilnehmende werden mit KI-generierten Deepfakes (manipulierte Bilder/Videos) konfrontiert. Das Szenario thematisiert die technologischen Möglichkeiten, die Gefahren der Manipulation und den kritischen Umgang mit visuellen Medien.',
    defaultBots: 1,
    standardRollen: 1, // 0 Humans + 1 Bot
    iconName: 'BotMessageSquare',
    tags: ['Künstliche Intelligenz', 'Manipulation', 'Medienkompetenz'],
    previewImageUrl: 'https://placehold.co/600x400.png',
    defaultBotsConfig: [
      { id: '10-info-0', name: "Fälscher Omikron", personality: 'informant', avatarFallback: 'FO', currentEscalation: 0, isActive: true, initialMission: "Präsentiere ein überzeugendes Deepfake-Video als echt und verteidige dessen Authentizität." }
    ],
    humanRolesConfig: []
  },
];
