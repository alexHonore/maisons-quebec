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

export type AutomationDocument = {
  readonly schema_version: "1.0";
  readonly name: string;
  readonly trigger: NativeEventType;
  readonly action: AutomationAction;
};

const DOCUMENT_KEYS = ["schema_version", "name", "trigger", "action"] as const;
const SENSITIVE_KEY = /secret|password|token|api_key|apikey|webhook|url|email|authorization|credential|n8n/i;

export type AutomationDocumentFailure = "invalid_document" | "invalid_name" | "invalid_trigger" | "invalid_action" | "secret_present";

function sensitiveText(value: string): boolean {
  return value.includes("@") || /https?:\/\//i.test(value);
}

export function automationDocument(definition: ParsedAutomation): AutomationDocument {
  return {
    schema_version: "1.0",
    name: definition.name,
    trigger: definition.trigger,
    action: definition.action,
  };
}

export function renderAutomationJson(document: AutomationDocument): string {
  return JSON.stringify({
    schema_version: document.schema_version,
    name: document.name,
    trigger: document.trigger,
    action: document.action,
  });
}

/** JSON plat de cette tranche. Toute clé, adresse, courriel ou secret en plus est refusé. */
export function parseAutomationDocument(raw: string): { ok: true; document: AutomationDocument } | { ok: false; reason: AutomationDocumentFailure } {
  const text = raw.trim();
  if (text.length < 2 || text.length > 4000) return { ok: false, reason: "invalid_document" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: "invalid_document" };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { ok: false, reason: "invalid_document" };
  const record = parsed as { [key: string]: unknown };
  for (const key of Object.keys(record)) {
    if (!(DOCUMENT_KEYS as readonly string[]).includes(key)) {
      return { ok: false, reason: SENSITIVE_KEY.test(key) ? "secret_present" : "invalid_document" };
    }
  }
  if (DOCUMENT_KEYS.some((key) => typeof record[key] !== "string")) return { ok: false, reason: "invalid_document" };
  const values = DOCUMENT_KEYS.map((key) => String(record[key]));
  if (values.some(sensitiveText)) return { ok: false, reason: "secret_present" };
  if (values[0] !== "1.0") return { ok: false, reason: "invalid_document" };
  const definition = parseAutomation({ name: values[1] ?? "", trigger: values[2] ?? "", action: values[3] ?? "" });
  if (!definition.ok) return definition;
  return { ok: true, document: automationDocument(definition.definition) };
}

export function dryRunAutomation(definition: ParsedAutomation): {
  readonly executed: false;
  readonly requeuedWebhook: false;
  readonly createdTask: false;
  readonly summary: string;
} {
  const effect = definition.action === "webhook.requeue"
    ? "L'action remettrait la livraison webhook en file."
    : "L'action écrirait la tâche automation.tache_admin.";
  return {
    executed: false,
    requeuedWebhook: false,
    createdTask: false,
    summary: `Essai à blanc. Déclencheur ${definition.trigger}. ${effect} Aucune livraison n'a été remise en file. Aucune tâche n'a été créée.`,
  };
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
