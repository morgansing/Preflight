import { expect, test, type Page } from "@playwright/test";

/**
 * The five golden paths. Demo paths are deterministic fixtures; live
 * paths use the sandbox (mock provider, offline). Serial: the store is
 * shared and the harness runs one evaluation at a time.
 */

test.describe.configure({ mode: "serial" });

async function setMode(page: Page, mode: "demo" | "live") {
  await page.goto("/dashboard");
  await page.evaluate((m) => window.localStorage.setItem("preflight.mode", m), mode);
}

test("demo: the pre-baked wall replays and links to a replay", async ({ page }) => {
  await setMode(page, "demo");
  await page.goto("/runs");
  await expect(page.getByText("This is a demo run")).toBeVisible();
  // The wall fills in from scripted timings — cells resolve over time.
  await expect(page.getByRole("grid", { name: "Scenario run wall" })).toBeVisible();
  await page.waitForTimeout(4000);
  const settled = page.getByRole("grid", { name: "Scenario run wall" }).getByRole("button");
  await expect(settled.first()).toBeVisible();
  await settled.first().click();
  await expect(page).toHaveURL(/\/replay\//);
});

test("demo: a fake test runs end-to-end and joins run history", async ({ page }) => {
  await setMode(page, "demo");
  await page.goto("/runs");
  await page.getByRole("button", { name: "Run a fake test" }).click();
  await page.getByRole("button", { name: /Smoke · 24/ }).click();
  await page.getByRole("button", { name: /start fake test/i }).click();
  // Smoke fake tests complete in ~9s.
  await expect(page.getByText(/run complete — open run_\d+/i)).toBeVisible({ timeout: 20_000 });
  await page.goto("/runs/history");
  await expect(page.getByText("run_0148").first()).toBeVisible();
});

test("demo: report links to the run wall; filters isolate the fails", async ({ page }) => {
  await setMode(page, "demo");
  await page.goto("/reports");
  await page.getByRole("link", { name: /open the run wall/i }).click();
  await expect(page).toHaveURL(/\/runs\/run_0147/);
  await page.getByRole("button", { name: /✗ 5/ }).click();
  // 5 failing cells, each a replay link.
  const cells = page.getByRole("grid", { name: "Scenario outcomes" }).getByRole("link");
  await expect(cells).toHaveCount(5);
});

test("live: a sandbox smoke run completes and reports", async ({ page }) => {
  await setMode(page, "live");
  await page.goto("/runs");
  await expect(page.getByRole("button", { name: /start sandbox run/i })).toBeVisible();
  // Smoke is the default selection.
  await page.getByRole("button", { name: /start sandbox run/i }).click();
  await expect(page.getByText(/run (complete|error) — view the readiness report/i)).toBeVisible({
    timeout: 45_000,
  });
  await page.getByRole("link", { name: /view the readiness report/i }).click();
  await expect(page.getByText("Agent readiness")).toBeVisible();
  await expect(page.getByText(/95% CI/)).toBeVisible();
});

test("live: share minting produces a badge and a public page", async ({ page }) => {
  await setMode(page, "live");
  await page.goto("/reports");
  await expect(page.getByText("Share this result")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: /create public link/i }).click();
  await expect(page.getByText("README markdown")).toBeVisible({ timeout: 10_000 });
  const shareUrl = await page.locator("code").first().textContent();
  expect(shareUrl).toContain("/share/");
  await page.goto(shareUrl!);
  await expect(page.getByText("VERIFIED RESULT")).toBeVisible();
  const badge = await page.request.get(shareUrl!.replace("/share/", "/api/badge/"));
  expect(badge.status()).toBe(200);
  expect(badge.headers()["content-type"]).toContain("svg");
});
