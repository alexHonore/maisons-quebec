import { HONEST_FUNNELS } from "./honest-funnels";

/** Événements que le code écrit réellement dans l'outbox. */
export const NATIVE_EVENT_TYPES = ["lead.created", "appointment.requested", "appointment.confirmed"] as const;

export type NativeEventType = (typeof NATIVE_EVENT_TYPES)[number];

export const EVENT_FUNNELS = ["produit_net", ...HONEST_FUNNELS] as const;

export type EventFunnelName = (typeof EVENT_FUNNELS)[number];

/** Noms du cahier qui ne correspondent à aucune émission du code. */
export const REFUSED_EVENT_TRIGGERS = [
  "form_submitted",
  "funnel.completed",
  "funnel_completed",
  "report.requested",
  "report_requested",
  "lead.updated",
  "lead.qualified",
  "lead.status_changed",
  "lead_status_changed",
  "appointment_requested",
] as const;

const BLOCKED_NAME = /script|eval|function|javascript|constructor/i;

export type NativeEventSpec = {
  readonly eventType: NativeEventType;
  readonly schemaVersion: "1.0";
  readonly description: string;
  readonly trigger: string;
  readonly consentRule: string;
  readonly payloadFields: readonly string[];
  readonly fictionalExample: { readonly [key: string]: unknown };
};

export const NATIVE_EVENTS: readonly NativeEventSpec[] = [
  {
    eventType: "lead.created",
    schemaVersion: "1.0",
    description: "Une nouvelle demande a été enregistrée après un résultat et un consentement de réponse.",
    trigger: "Enregistrement d'un nouveau lead. Une nouvelle soumission de la même clé n'émet pas cet événement.",
    consentRule: "Émis seulement si la personne a consenti à une réponse. Une définition ne peut pas retirer cette exigence.",
    payloadFields: [
      "lead_id",
      "lead_type",
      "funnel_name",
      "contact_name",
      "contact_email",
      "consent_to_respond",
      "consent_marketing",
      "consent_text_version",
    ],
    fictionalExample: {
      event_type: "lead.created",
      schema_version: "1.0",
      payload: {
        lead_id: "00000000-0000-4000-8000-000000000001",
        lead_type: "vendeur",
        funnel_name: "estimation_maison",
        contact_name: "Personne fictive",
        contact_email: "personne@exemple.invalid",
        consent_to_respond: true,
        consent_marketing: false,
        consent_text_version: "estimation-reponse-v1",
      },
      note: "Exemple fictif. Ce n'est pas une émission observée.",
    },
  },
  {
    eventType: "appointment.requested",
    schemaVersion: "1.0",
    description: "La personne demande un rendez-vous. Ce n'est pas un créneau confirmé.",
    trigger: "Case de rendez-vous cochée, avec une plage, à la création du lead ou sur un doublon qui n'a pas encore de rendez-vous.",
    consentRule: "Le lead doit déjà avoir un consentement de réponse. L'événement ne contient pas le courriel.",
    payloadFields: ["lead_id", "appointment_id", "funnel_name", "window_text"],
    fictionalExample: {
      event_type: "appointment.requested",
      schema_version: "1.0",
      payload: {
        lead_id: "00000000-0000-4000-8000-000000000001",
        appointment_id: "00000000-0000-4000-8000-000000000002",
        funnel_name: "estimation_maison",
        window_text: "mardi matin",
      },
      note: "Exemple fictif. Ce n'est pas une confirmation.",
    },
  },
  {
    eventType: "appointment.confirmed",
    schemaVersion: "1.0",
    description: "Un propriétaire a saisi un créneau réel.",
    trigger: "Action du rôle owner sur une demande déjà au statut demandé. Jamais à l'enregistrement public.",
    consentRule: "Réservé au propriétaire. Le libellé vide est refusé. L'événement ne contient pas le courriel.",
    payloadFields: ["lead_id", "appointment_id", "funnel_name", "confirmed_slot"],
    fictionalExample: {
      event_type: "appointment.confirmed",
      schema_version: "1.0",
      payload: {
        lead_id: "00000000-0000-4000-8000-000000000001",
        appointment_id: "00000000-0000-4000-8000-000000000002",
        funnel_name: "estimation_maison",
        confirmed_slot: "mardi matin au bureau",
      },
      note: "Exemple fictif. Le site ne confirme pas ce créneau tout seul.",
    },
  },
];

export function isNativeEventType(value: string): value is NativeEventType {
  return (NATIVE_EVENT_TYPES as readonly string[]).includes(value);
}

export function isEventFunnelName(value: string): value is EventFunnelName {
  return (EVENT_FUNNELS as readonly string[]).includes(value);
}

export function eventDefinitionName(raw: string): string | null {
  const name = raw.trim();
  if (!/^[a-z][a-z0-9_]{2,40}$/.test(name)) return null;
  if (isNativeEventType(name)) return null;
  if (BLOCKED_NAME.test(name)) return null;
  return name;
}

export function eventSchemaVersion(raw: string): string | null {
  const version = raw.trim();
  if (!/^[1-9]\d?\.\d{1,2}$/.test(version)) return null;
  return version;
}

export type ParsedEventDefinition = {
  readonly name: string;
  readonly trigger: NativeEventType;
  readonly schemaVersion: string;
  readonly funnelName: EventFunnelName | null;
};

export function parseEventDefinition(input: {
  readonly name: string;
  readonly trigger: string;
  readonly schemaVersion: string;
  readonly funnelName?: string | null;
  readonly consentRequired?: boolean;
}): { ok: true; definition: ParsedEventDefinition } | { ok: false; reason: "invalid_name" | "invalid_trigger" | "invalid_version" | "invalid_funnel" | "consent_locked" } {
  if (input.consentRequired === false) return { ok: false, reason: "consent_locked" };
  const name = eventDefinitionName(input.name);
  if (!name) return { ok: false, reason: "invalid_name" };
  if (!isNativeEventType(input.trigger)) return { ok: false, reason: "invalid_trigger" };
  const schemaVersion = eventSchemaVersion(input.schemaVersion);
  if (!schemaVersion) return { ok: false, reason: "invalid_version" };
  const funnelRaw = (input.funnelName ?? "").trim();
  if (funnelRaw === "") return { ok: true, definition: { name, trigger: input.trigger, schemaVersion, funnelName: null } };
  if (!isEventFunnelName(funnelRaw)) return { ok: false, reason: "invalid_funnel" };
  return { ok: true, definition: { name, trigger: input.trigger, schemaVersion, funnelName: funnelRaw } };
}
