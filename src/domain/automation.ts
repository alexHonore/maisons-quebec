import { contentSlug } from "./content-page";
import { eventDefinitionName, isNativeEventType, type NativeEventType } from "./event-catalog";

/** Déclencheurs que le site écrit déjà dans l'outbox. */
export const AUTOMATION_TRIGGERS = ["lead.created", "appointment.requested", "appointment.confirmed"] as const;

export const AUTOMATION_ACTIONS = ["webhook.requeue", "admin.task", "content.open_draft"] as const;

export type AutomationAction = (typeof AUTOMATION_ACTIONS)[number];

export const AUTOMATION_ACTION_LABELS: Record<AutomationAction, string> = {
  "webhook.requeue": "Remettre la livraison webhook en file",
  "admin.task": "Écrire une tâche admin",
  "content.open_draft": "Ouvrir un brouillon depuis une page publiée",
};

/** Nom de file fixe. Il ne peut pas transporter un courriel ni un nom. */
export const AUTOMATION_TASK_NAME = "automation.tache_admin";

export const AUTOMATION_RUN_STATES = ["en_file", "aucune_destination", "tache_en_file", "brouillon_ouvert", "page_introuvable"] as const;

export type AutomationRunState = (typeof AUTOMATION_RUN_STATES)[number];

export const AUTOMATION_RUN_LABELS: Record<AutomationRunState, string> = {
  en_file: "en file",
  aucune_destination: "aucune destination",
  tache_en_file: "tâche en file",
  brouillon_ouvert: "brouillon ouvert",
  page_introuvable: "page introuvable",
};

const REFUSED_ACTIONS = ["content.publish", "publish", "javascript", "eval", "webhook.deliver", "auto_publish"];

export type ParsedAutomation = {
  readonly name: string;
  readonly trigger: NativeEventType;
  readonly action: AutomationAction;
  readonly page: string | null;
};

export function isAutomationAction(value: string): value is AutomationAction {
  return (AUTOMATION_ACTIONS as readonly string[]).includes(value);
}

export type AutomationDocument = {
  readonly schema_version: "1.0";
  readonly name: string;
  readonly trigger: NativeEventType;
  readonly action: AutomationAction;
  readonly page: string | null;
};

const DOCUMENT_KEYS = ["schema_version", "name", "trigger", "action"] as const;
const SENSITIVE_KEY = /secret|password|token|api_key|apikey|webhook|url|email|authorization|credential|n8n/i;

export type AutomationDocumentFailure = "invalid_document" | "invalid_name" | "invalid_trigger" | "invalid_action" | "invalid_page" | "secret_present";

function sensitiveText(value: string): boolean {
  return value.includes("@") || /https?:\/\//i.test(value);
}

export function automationDocument(definition: ParsedAutomation): AutomationDocument {
  return {
    schema_version: "1.0",
    name: definition.name,
    trigger: definition.trigger,
    action: definition.action,
    page: definition.page,
  };
}

/** Même document que l'import JSON. Une page n'est ajoutée que si elle est saisie, ou si l'action ouvre un brouillon. */
export function automationBoardDocument(input: {
  readonly name: string;
  readonly trigger: string;
  readonly action: string;
  readonly page?: string | null;
}): string {
  const action = input.action.trim();
  const page = (input.page ?? "").trim();
  const body: { [key: string]: string } = {
    schema_version: "1.0",
    name: input.name.trim(),
    trigger: input.trigger.trim(),
    action,
  };
  if (action === "content.open_draft" || page !== "") body.page = page;
  return JSON.stringify(body);
}

export function renderAutomationJson(document: AutomationDocument): string {
  const body: { [key: string]: string } = {
    schema_version: document.schema_version,
    name: document.name,
    trigger: document.trigger,
    action: document.action,
  };
  if (document.page) body.page = document.page;
  return JSON.stringify(body);
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
  const allowed = new Set<string>([...DOCUMENT_KEYS, "page"]);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) {
      return { ok: false, reason: SENSITIVE_KEY.test(key) ? "secret_present" : "invalid_document" };
    }
    if (typeof record[key] !== "string") return { ok: false, reason: "invalid_document" };
  }
  if (DOCUMENT_KEYS.some((key) => typeof record[key] !== "string")) return { ok: false, reason: "invalid_document" };
  const values = [...DOCUMENT_KEYS.map((key) => String(record[key])), typeof record.page === "string" ? String(record.page) : ""];
  if (values.some(sensitiveText)) return { ok: false, reason: "secret_present" };
  if (values[0] !== "1.0") return { ok: false, reason: "invalid_document" };
  const action = values[3] ?? "";
  if (action.includes("auto_publish")) return { ok: false, reason: "invalid_action" };
  if (action !== "content.open_draft" && typeof record.page === "string") return { ok: false, reason: "invalid_document" };
  const definition = parseAutomation({
    name: values[1] ?? "",
    trigger: values[2] ?? "",
    action,
    page: typeof record.page === "string" ? record.page : "",
  });
  if (!definition.ok) return definition;
  return { ok: true, document: automationDocument(definition.definition) };
}

export function dryRunAutomation(definition: ParsedAutomation): {
  readonly executed: false;
  readonly requeuedWebhook: false;
  readonly createdTask: false;
  readonly openedDraft: false;
  readonly summary: string;
} {
  const effect = definition.action === "webhook.requeue"
    ? "L'action remettrait la livraison webhook en file."
    : definition.action === "content.open_draft"
      ? `L'action copierait le corps publié de ${definition.page ?? "la page"} vers un nouveau brouillon.`
      : "L'action écrirait la tâche automation.tache_admin.";
  return {
    executed: false,
    requeuedWebhook: false,
    createdTask: false,
    openedDraft: false,
    summary: `Essai à blanc. Déclencheur ${definition.trigger}. ${effect} Aucune livraison n'a été remise en file. Aucune tâche n'a été créée. Aucun brouillon n'a été créé.`,
  };
}

export function parseAutomation(input: {
  readonly name: string;
  readonly trigger: string;
  readonly action: string;
  readonly page?: string | null;
}): { ok: true; definition: ParsedAutomation } | { ok: false; reason: "invalid_name" | "invalid_trigger" | "invalid_action" | "invalid_page" } {
  const name = eventDefinitionName(input.name);
  if (!name || name.includes("@")) return { ok: false, reason: "invalid_name" };
  if (!isNativeEventType(input.trigger) || !(AUTOMATION_TRIGGERS as readonly string[]).includes(input.trigger)) {
    return { ok: false, reason: "invalid_trigger" };
  }
  const action = input.action.trim();
  if (action.includes("auto_publish") || !isAutomationAction(action) || REFUSED_ACTIONS.includes(action)) {
    return { ok: false, reason: "invalid_action" };
  }
  const pageText = (input.page ?? "").trim();
  if (action === "content.open_draft") {
    const page = contentSlug(pageText);
    if (!page) return { ok: false, reason: "invalid_page" };
    return { ok: true, definition: { name, trigger: input.trigger, action, page } };
  }
  if (pageText !== "") return { ok: false, reason: "invalid_page" };
  return { ok: true, definition: { name, trigger: input.trigger, action, page: null } };
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
