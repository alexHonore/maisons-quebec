import { DatabaseSync } from "node:sqlite";
import { expect, test, type Page } from "@playwright/test";
import { signatureFromJson, signatureFromPdf } from "../src/domain/analytics-report";
import { E2E_DB, E2E_OWNER } from "./env";

const READY_METHOD = "Cette page explique une méthode de lecture. Elle ne donne aucun prix et aucune statistique. ";
const READY_TAIL = "\n\nCette méthode ne constitue pas un prix de marché. Elle concerne une personne qui veut vendre à Québec. Voir /vendre/calculateur-produit-net.";

function readyBody(): string {
  let body = "";
  while (body.length < 600) body += READY_METHOD;
  return `${body.trim()}${READY_TAIL}`;
}

function torontoToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function watchExternalCalls(page: Page): string[] {
  const calls: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (/openrouter\.ai|api\.pexels\.com|unsplash\.com|n8n/i.test(url)) calls.push(url);
  });
  return calls;
}

async function login(page: Page) {
  await page.goto("/admin/login");
  await page.locator("input[name='email']").fill(E2E_OWNER.email);
  await page.locator("input[name='password']").fill(E2E_OWNER.password);
  await page.getByRole("button", { name: "Entrer" }).click();
  await expect(page.getByRole("heading", { name: "Administration" })).toBeVisible();
}

async function submitLead(page: Page, email: string, name: string) {
  await page.goto("/vendre/calculateur-produit-net");
  await page.locator("input[name='sale']").fill("500000");
  await page.locator("input[name='brokerage_value']").fill("10000");
  await page.getByRole("button", { name: "Calculer" }).click();
  await expect(page.getByText("Produit net :")).toBeVisible();
  await page.locator("input[name='name']").fill(name);
  await page.locator("input[name='email']").fill(email);
  await page.locator("input[name='consent_respond']").check();
  await page.getByRole("button", { name: "Enregistrer la demande" }).click();
  await expect(page.getByText("Votre demande de réponse est enregistrée.")).toBeVisible();
  await expect(page.getByText("elle reste en attente")).toBeVisible();
}

function leadRows(): { email: string; delivery: string; outbox: string }[] {
  const db = new DatabaseSync(E2E_DB);
  try {
    const destinations = Number(db.prepare("SELECT COUNT(*) AS total FROM webhook_destinations").get()?.total ?? 0);
    if (destinations !== 0) throw new Error("Une destination webhook existe. Le test ne peut pas parler d'attente.");
    return db
      .prepare(
        `SELECT leads.contact_email AS email, leads.delivery_status AS delivery, lead_outbox.status AS outbox
         FROM leads JOIN lead_outbox ON lead_outbox.lead_id = leads.id
         WHERE lead_outbox.event_type = 'lead.created'`,
      )
      .all()
      .map((row) => ({
        email: String(row.email),
        delivery: String(row.delivery),
        outbox: String(row.outbox),
      }));
  } finally {
    db.close();
  }
}

function countRows(table: "content_pages" | "media_assets" | "job_queue"): number {
  const db = new DatabaseSync(E2E_DB);
  try {
    return Number(db.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get()?.total ?? 0);
  } finally {
    db.close();
  }
}

test.describe.serial("trois parcours existants", () => {
  test("visiteur, calcul, consentement, lead en attente, puis le propriétaire", async ({ page }) => {
    const external = watchExternalCalls(page);
    const email = "visiteur.e2e@example.com";
    await submitLead(page, email, "Visiteur Essai");
    const stored = leadRows().find((row) => row.email === email);
    expect(stored?.delivery).toBe("pending");
    expect(stored?.outbox).toBe("pending");
    await login(page);
    await page.goto("/admin/leads");
    await expect(page.locator("li", { hasText: email })).toContainText("en attente");
    expect(external).toEqual([]);
  });

  test("brouillon humain, scores, publication, sans article ni image fabriqués", async ({ page }) => {
    const external = watchExternalCalls(page);
    await login(page);
    await page.goto("/admin/contenu");
    await page.locator("input[name='slug']").fill("lire-une-methode");
    await page.locator("input[name='title']").fill("Lire une méthode");
    await page.locator("input[name='description']").fill("Cette description présente une méthode de lecture, sans chiffre de marché.");
    await page.locator("textarea[name='body']").fill(readyBody());
    await page.locator("input[name='source_note']").fill("Note de méthode rédigée pour Maisons Québec.");
    await page.getByRole("button", { name: "Enregistrer le brouillon" }).click();
    await expect(page.getByText("SEO 100")).toBeVisible();
    await expect(page.getByText("Citabilité 100")).toBeVisible();
    await expect(page.getByText("Conversion 100")).toBeVisible();
    await page.getByRole("button", { name: "Publier" }).click();
    await expect(page.getByRole("button", { name: "Remettre en brouillon" })).toBeVisible();
    await page.goto("/guides/lire-une-methode");
    await expect(page.getByRole("heading", { name: "Lire une méthode" })).toBeVisible();

    const pagesBefore = countRows("content_pages");
    const mediaBefore = countRows("media_assets");
    await page.goto("/admin/prompts");
    await page.getByRole("button", { name: "Générer" }).click();
    await expect(page.getByText(/À connecter|n'est pas branchée/)).toBeVisible();
    await expect(page.getByText("Aucun article n'a été écrit.")).toBeVisible();
    expect(countRows("content_pages")).toBe(pagesBefore);

    await page.goto("/admin/medias");
    await page.getByRole("button", { name: "Générer une image" }).click();
    await expect(page.getByText(/À connecter|Non branché/)).toBeVisible();
    await expect(page.getByText("Aucune image n'a été enregistrée.")).toBeVisible();
    expect(countRows("media_assets")).toBe(mediaBefore);
    expect(external).toEqual([]);
  });

  test("JSON d'automatisation, essai à blanc, exécution, puis PDF égal au JSON", async ({ page }) => {
    const external = watchExternalCalls(page);
    await login(page);
    await page.goto("/admin/automations");
    await page.locator("input[name='name']").fill("relance_e2e");
    await page.locator("select[name='action']").selectOption("admin.task");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("relance_e2e")).toBeVisible();
    const exportHref = await page.getByRole("link", { name: "Exporter JSON" }).getAttribute("href");
    expect(exportHref).toBeTruthy();
    const exported = await page.request.get(exportHref ?? "");
    expect(exported.ok()).toBeTruthy();
    const document = await exported.text();
    expect(document).not.toContain("@");
    expect(document).not.toContain("https://");
    await page.locator("textarea[name='document']").fill(document);
    await page.getByRole("button", { name: "Importer" }).click();
    await expect(page.getByText("Version 1 — lead.created — admin.task")).toBeVisible();
    await expect(page.getByText("Version 2 — lead.created — admin.task")).toBeVisible();

    await page.goto("/admin/jobs");
    await expect(page.getByText("automation.tache_admin")).toHaveCount(0);
    await page.goto("/admin/automations");
    await page.getByRole("button", { name: "Essai à blanc" }).click();
    await expect(page.getByText("Aucune tâche n'a été créée.")).toBeVisible();
    await expect(page.getByText("Aucune livraison n'a été remise en file.")).toBeVisible();
    expect(countRows("job_queue")).toBe(0);

    await page.goto("/guides/lire-une-methode");
    const publicHtml = await page.locator("article").innerHTML();
    expect(publicHtml).toContain("Cette méthode ne constitue pas un prix de marché.");
    await page.goto("/admin/contenu");
    const publishedHref = await page.locator("li", { hasText: "publiée" }).getByRole("link", { name: "Lire une méthode" }).getAttribute("href");
    await page.goto(publishedHref ?? "");
    await expect(page.getByRole("heading", { name: "Lire une méthode" })).toBeVisible();
    const publishedBody = await page.locator("textarea[name='body']").inputValue();
    expect(publishedBody).toContain("Cette méthode ne constitue pas un prix de marché.");
    const pagesBefore = countRows("content_pages");

    await page.goto("/admin/automations");
    const create = page.locator("form", { has: page.getByRole("button", { name: "Enregistrer", exact: true }) });
    await create.locator("input[name='name']").fill("ouvrir_e2e");
    await create.locator("select[name='action']").selectOption("content.open_draft");
    await create.locator("input[name='page']").fill("lire-une-methode");
    await create.getByRole("button", { name: "Enregistrer", exact: true }).click();
    const draftAutomation = page.locator("li", { hasText: "ouvrir_e2e" });
    await expect(draftAutomation).toContainText("Ouvrir un brouillon depuis une page publiée");
    await draftAutomation.getByRole("button", { name: "Essai à blanc" }).click();
    await expect(page.getByText("Aucun brouillon n'a été créé.")).toBeVisible();
    expect(countRows("content_pages")).toBe(pagesBefore);

    const email = "visiteur.auto@example.com";
    await submitLead(page, email, "Visiteur Auto");
    const stored = leadRows().find((row) => row.email === email);
    expect(stored?.outbox).toBe("pending");
    await page.goto("/admin/jobs");
    await expect(page.getByText("automation.tache_admin — queued")).toBeVisible();
    await page.goto("/guides/lire-une-methode");
    expect(await page.locator("article").innerHTML()).toBe(publicHtml);
    expect((await page.request.get("/guides/lire-une-methode-brouillon")).status()).toBe(404);
    await page.goto("/admin/contenu");
    const draftRow = page.locator("li", { hasText: "/guides/lire-une-methode-brouillon" });
    await expect(draftRow).toContainText("brouillon");
    const draftHref = await draftRow.getByRole("link", { name: "Lire une méthode" }).getAttribute("href");
    await page.goto(draftHref ?? "");
    await expect(page.getByText("Le public ne voit pas ce brouillon.")).toBeVisible();
    await expect(page.locator("textarea[name='body']")).toHaveValue(publishedBody);
    await page.goto("/admin/automations");
    await expect(page.getByText("content.open_draft — brouillon ouvert")).toBeVisible();

    const today = torontoToday();
    const jsonResponse = await page.request.get(`/admin/analytics/export?format=json&from=${today}&to=${today}`);
    const pdfResponse = await page.request.get(`/admin/analytics/export?format=pdf&from=${today}&to=${today}`);
    expect(jsonResponse.ok()).toBeTruthy();
    expect(pdfResponse.ok()).toBeTruthy();
    const json = await jsonResponse.text();
    const pdf = Buffer.from(await pdfResponse.body()).toString("latin1");
    expect(json).not.toContain(email);
    expect(pdf).not.toContain(email);
    expect(signatureFromPdf(pdf)).toBe(signatureFromJson(json));
    expect(signatureFromJson(json)).toContain("total leads observe");
    expect(external).toEqual([]);
  });
});
