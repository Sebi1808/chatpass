
import type { BotConfig } from './types';

export const botTemplates: Omit<BotConfig, 'id'>[] = [
  {
    templateId: 'template-prov-std',
    name: "Standard Provokateur",
    personality: 'provokateur',
    avatarFallback: "SP",
    currentEscalation: 1,
    isActive: true,
    autoTimerEnabled: false,
    initialMission: "Provoziere die Diskussionsteilnehmer mit kritischen Fragen oder kontroversen Aussagen zum Thema.",
  },
  {
    templateId: 'template-vert-std',
    name: "Standard Verteidiger",
    personality: 'verteidiger',
    avatarFallback: "SV",
    currentEscalation: 0,
    isActive: true,
    autoTimerEnabled: false,
    initialMission: "Verteidige eine bestimmte Position oder Person im Chat und suche nach konstruktiven Lösungen.",
  },
  {
    templateId: 'template-info-std',
    name: "Standard Informant",
    personality: 'informant',
    avatarFallback: "SI",
    currentEscalation: 0,
    isActive: true,
    autoTimerEnabled: false,
    initialMission: "Teile relevante (oder scheinbar relevante) Informationen und Fakten zum Diskussionsthema.",
  },
  {
    templateId: 'template-std-std',
    name: "Standard Chatbot",
    personality: 'standard',
    avatarFallback: "CB",
    currentEscalation: 0,
    isActive: true,
    autoTimerEnabled: false,
    initialMission: "Nimm als neutraler Teilnehmer an der Diskussion teil.",
  },
];
