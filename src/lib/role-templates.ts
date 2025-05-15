
import type { HumanRoleConfig } from './types';

export const humanRoleTemplates: Omit<HumanRoleConfig, 'id'>[] = [
  {
    templateId: 'template-victim-std',
    name: "Betroffene Person (Standard)",
    description: "Du bist direkt von der im Szenario dargestellten Situation betroffen. Versuche, deine Gefühle und Perspektive auszudrücken und nach Unterstützung zu suchen oder dich zu verteidigen.",
  },
  {
    templateId: 'template-bystander-std',
    name: "Zuschauende Person (Standard)",
    description: "Du beobachtest die Situation zunächst. Entscheide, ob, wann und wie du eingreifst. Welche Verantwortung hast du?",
  },
  {
    templateId: 'template-supporter-std',
    name: "Unterstützende Person (Standard)",
    description: "Deine Aufgabe ist es, eine bestimmte Seite oder Person in der Diskussion aktiv zu unterstützen, Argumente zu liefern und Solidarität zu zeigen.",
  },
  {
    templateId: 'template-moderator-std',
    name: "Moderierende Person (Standard)",
    description: "Du bist dafür verantwortlich, die Diskussion im Rahmen zu halten, Regeln durchzusetzen und bei Konflikten zu vermitteln. Versuche, eine konstruktive Gesprächsatmosphäre zu schaffen.",
  },
];
