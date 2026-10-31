import { eventDefinitionName, isNativeEventType, type NativeEventType } from "./event-catalog";

/** Déclencheurs que le site écrit déjà dans l'outbox. */
export const AUTOMATION_TRIGGERS = ["lead.created", "appointment.requested", "appointment.confirmed"] as const;

export const AUTOMATION_ACTIONS = ["webhook.requeue", "admin.task"] as const;

export type AutomationAction = (typeof AUTOMATION_ACTIONS)[number];

export const AUTOMATION_ACTION_LABELS: Record<AutomationAction, string> = {
  "webhook.requeue": "Remettre la livraison webhook en file",
  "admin.task": "Écrire une tâche admin",
};

/** Nom de file fixe. Il ne peut pas transporter un courriel ni un nom. */
export const AUTOMATION_TASK_NAME = "automation.tache_admin";

export const AUTOMATION_RUN_STATES = ["en_file", "aucune_destination", "tache_en_file"] as const;

export type AutomationRunState = (typeof AUTOMATION_RUN_STATES)[number];

export const AUTOMATION_RUN_LABELS: Record<AutomationRunState, string> = {
  en_file: "en file",
  aucune_destination: "aucune destination",
  tache_en_file: "tâche en file",
};

const REFUSED_ACTIONS = ["content.publish", "publish", "javascript", "eval", "webhook.deliver"];

export type ParsedAutomation = {
  readonly name: string;
  readonly trigger: NativeEventType;
  readonly action: AutomationAction;
};

export function isAutomationAction(value: string): value is AutomationAction {
  return (AUTOMATION_ACTIONS as readonly string[]).includes(value);
}

export function parseAutomation(input: {
  readonly name: string;
  readonly trigger: string;
  readonly action: string;
}): { ok: true; definition: ParsedAutomation } | { ok: false; reason: "invalid_name" | "invalid_trigger" | "invalid_action" } {
  const name = eventDefinitionName(input.name);
  if (!name || name.includes("@")) return { ok: false, reason: "invalid_name" };
  if (!isNativeEventType(input.trigger) || !(AUTOMATION_TRIGGERS as readonly string[]).includes(input.trigger)) {
    return { ok: false, reason: "invalid_trigger" };
  }
  const action = input.action.trim();
  if (!isAutomationAction(action) || REFUSED_ACTIONS.includes(action)) return { ok: false, reason: "invalid_action" };
  return { ok: true, definition: { name, trigger: input.trigger, action } };
}

export type N8nTransport = (input: { readonly url: string }) => Promise<{ readonly status: number }>;

/**
 * Cette tranche n'appelle pas n8n.
 * Sans N8N_BASE_URL, la réponse est « à connecter ». Une adresse présente ne devient pas un succès.
 */
export function requestN8nConnection(input: {
  readonly baseUrl: string | undefined;
  readonly transport?: N8nTransport;
}): { ok: false; message: "à connecter" | "non branché"; called: false } {
  void input.transport;
  if ((input.baseUrl ?? "").trim() === "") return { ok: false, message: "à connecter", called: false };
  return { ok: false, message: "non branché", called: false };
}
