import { defineConfig } from "@playwright/test";
import { E2E_ORIGIN, e2eEnv } from "./e2e/env";

export default defineConfig({
  testDir: "e2e",
  testMatch: /parcours\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: { baseURL: E2E_ORIGIN },
  webServer: {
    command: `rm -f ${e2eEnv.SITE_SETTINGS_PATH} ${e2eEnv.SITE_SETTINGS_PATH}-wal ${e2eEnv.SITE_SETTINGS_PATH}-shm && npx next start -p 3457 -H 127.0.0.1`,
    url: E2E_ORIGIN,
    timeout: 120_000,
    reuseExistingServer: false,
    env: e2eEnv,
  },
});
