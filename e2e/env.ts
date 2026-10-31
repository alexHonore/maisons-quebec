export const E2E_PORT = "3457";
export const E2E_ORIGIN = `http://127.0.0.1:${E2E_PORT}`;
export const E2E_DB = "/tmp/maisons-quebec-e2e.sqlite";

export const E2E_OWNER = {
  email: "proprietaire@example.com",
  password: "phrase-de-test-seulement",
} as const;

export const e2eEnv: { [key: string]: string } = {
  SITE_URL: "https://maisonsquebec.ca",
  SITE_SETTINGS_PATH: E2E_DB,
  ADMIN_SESSION_SECRET: "secret-de-session-e2e-seulement",
  ADMIN_BOOTSTRAP_EMAIL: E2E_OWNER.email,
  ADMIN_BOOTSTRAP_PASSWORD: E2E_OWNER.password,
  ADMIN_TOTP_SECRET: "",
  OPENROUTER_API_KEY: "",
  PEXELS_API_KEY: "",
  UNSPLASH_ACCESS_KEY: "",
  IMAGE_GENERATION_API_KEY: "",
  N8N_BASE_URL: "",
  N8N_API_KEY: "",
};
