import type { Scenario } from './types';
import { ShieldAlert, Code2, MessageSquare, Annoyed, Zap, Users, Film, ShoppingBag, Lock, BotMessageSquare } from 'lucide-react';

export const scenarios: Scenario[] = [
  {
    id: '1',
    title: 'Hate-Speech',
    kurzbeschreibung: 'Beschimpfungen & Grenzüberschreitungen im Chat.',
    langbeschreibung: 'In diesem Szenario wird ein Online-Diskurs simuliert, der durch Hate-Speech, persönliche Angriffe und verbale Grenzüberschreitungen gekennzeichnet ist. Teilnehmende lernen, solche Situationen zu erkennen, darauf zu reagieren und Strategien zur Deeskalation oder Meldung zu entwickeln.',
    defaultBots: 2,
    standardRollen: 8,
    icon: ShieldAlert,
    tags: ['Konflikt', 'Respekt', 'Online-Sicherheit']
  },
  {
    id: '2',
    title: 'Digitaler Rechtsextremismus',
    kurzbeschreibung: 'Codierte Symbole & Ideologien erkennen.',
    langbeschreibung: 'Dieses Szenario thematisiert die Verbreitung rechtsextremer Ideologien im digitalen Raum. Teilnehmende werden mit codierten Symbolen, subtiler Propaganda und extremistischen Narrativen konfrontiert, um Sensibilität und kritisches Denken zu fördern.',
    defaultBots: 2,
    standardRollen: 10,
    icon: Code2,
    tags: ['Extremismus', 'Propaganda', 'Medienkompetenz']
  },
  {
    id: '3',
    title: 'Klassenchat',
    kurzbeschreibung: 'Alltagsdiskussion, Gruppendruck und soziale Dynamiken.',
    langbeschreibung: 'Simuliert eine typische Diskussion in einem Klassenchat. Themen können von Hausaufgaben bis zu Freizeitaktivitäten reichen, wobei auch Gruppendruck, Missverständnisse und soziale Ausgrenzung eine Rolle spielen können.',
    defaultBots: 1,
    standardRollen: 12,
    icon: Users,
    tags: ['Soziale Dynamik', 'Kommunikation', 'Alltag']
  },
  {
    id: '4',
    title: 'Fake News',
    kurzbeschreibung: 'Umgang mit reißerischen Falschmeldungen.',
    langbeschreibung: 'Teilnehmende werden mit viralen Falschmeldungen und Desinformation konfrontiert. Ziel ist es, die Mechanismen von Fake News zu verstehen, Quellenkritik zu üben und Strategien zur Verifizierung von Informationen zu erlernen.',
    defaultBots: 1,
    standardRollen: 10,
    icon: Annoyed, // Lucide doesn't have a perfect "Fake News" icon, Annoyed can represent reaction
    tags: ['Desinformation', 'Medienkritik', 'Quellenprüfung']
  },
  {
    id: '5',
    title: 'Verschwörungstheorien',
    kurzbeschreibung: '„Geheime Pläne“ & QAnon-ähnliche Themen.',
    langbeschreibung: 'Dieses Szenario setzt sich mit der Verbreitung und Wirkung von Verschwörungstheorien auseinander. Teilnehmende analysieren deren typische Merkmale und lernen, kritisch mit solchen Narrativen umzugehen.',
    defaultBots: 1,
    standardRollen: 10,
    icon: Zap, // Zap can represent sudden, shocking "revelations"
    tags: ['Verschwörung', 'Kritisches Denken', 'Manipulation']
  },
  {
    id: '6',
    title: 'Cybermobbing',
    kurzbeschreibung: 'Ausgrenzung und Belästigung Einzelner.',
    langbeschreibung: 'Simuliert eine Situation von Cybermobbing, bei der eine Person online ausgegrenzt, beleidigt oder bedroht wird. Fokus liegt auf Empathie, Zivilcourage und Hilfsangeboten für Betroffene und Beobachtende.',
    defaultBots: 2,
    standardRollen: 9,
    icon: MessageSquare, // Represents chat where mobbing can occur
    tags: ['Mobbing', 'Soziale Verantwortung', 'Hilfe']
  },
  {
    id: '7',
    title: 'Faschistische TikToks',
    kurzbeschreibung: 'Kurzvideo-Links & Memes mit extremistischen Inhalten.',
    langbeschreibung: 'Konfrontiert Teilnehmende mit scheinbar harmlosen Kurzvideos oder Memes, die extremistische, insbesondere faschistische, Inhalte transportieren. Ziel ist die Schulung der Wahrnehmung für subtile Propaganda in sozialen Medien.',
    defaultBots: 2,
    standardRollen: 8,
    icon: Film,
    tags: ['Extremismus', 'Social Media', 'Propaganda']
  },
  {
    id: '8',
    title: 'Influencer-Werbung',
    kurzbeschreibung: 'Schleichwerbung & unseriöse Gewinnspiele.',
    langbeschreibung: 'Teilnehmende analysieren Posts von Influencern, die (Schleich-)Werbung und fragwürdige Gewinnspiele enthalten. Es geht um die kritische Auseinandersetzung mit kommerziellen Interessen auf Social Media.',
    defaultBots: 1,
    standardRollen: 10,
    icon: ShoppingBag,
    tags: ['Werbung', 'Konsumkritik', 'Social Media']
  },
  {
    id: '9',
    title: 'Sextortion',
    kurzbeschreibung: 'Grooming & Erpressung mit intimen Inhalten.',
    langbeschreibung: 'Dieses ernste Szenario simuliert Anbahnungsversuche (Grooming) und Erpressung mit intimen Bildern oder Videos (Sextortion). Es soll für Gefahren sensibilisieren und Handlungsoptionen aufzeigen.',
    defaultBots: 2,
    standardRollen: 8,
    icon: Lock,
    tags: ['Sexuelle Gewalt', 'Erpressung', 'Prävention']
  },
  {
    id: '10',
    title: 'AI-Deepfakes',
    kurzbeschreibung: 'Manipulierte Bilder/Videos und deren Auswirkungen.',
    langbeschreibung: 'Teilnehmende werden mit KI-generierten Deepfakes (manipulierte Bilder/Videos) konfrontiert. Das Szenario thematisiert die technologischen Möglichkeiten, die Gefahren der Manipulation und den kritischen Umgang mit visuellen Medien.',
    defaultBots: 1,
    standardRollen: 10,
    icon: BotMessageSquare,
    tags: ['Künstliche Intelligenz', 'Manipulation', 'Medienkompetenz']
  },
];
