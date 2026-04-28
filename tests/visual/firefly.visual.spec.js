import { expect, test } from "@playwright/test";

const smokeMode = process.env.FIREFLY_VISUAL_MODE === "smoke";

async function stabilize(page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        scroll-behavior: auto !important;
      }
      body, body * {
        font-family: Arial, Helvetica, sans-serif !important;
      }
      #cursor, body::after { display: none !important; }
      .fade-in { opacity: 1 !important; transform: none !important; }
    `
  });
  await page.evaluate(() => document.fonts?.ready);
}

async function expectVisual(locator, snapshotName, options = {}) {
  await expect(locator).toBeVisible();

  if (!smokeMode) {
    await expect(locator).toHaveScreenshot(snapshotName, options);
    return;
  }

  const box = await locator.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(320);
  expect(box?.height ?? 0).toBeGreaterThan(180);

  const screenshot = await locator.screenshot({ animations: "disabled" });
  expect(screenshot.byteLength).toBeGreaterThan(20_000);
}

test("notes page keeps the editorial landing composition", async ({ page }) => {
  await page.goto("/index.html");
  await stabilize(page);
  await expectVisual(page.locator(".main"), "notes-page.png", {
    animations: "disabled",
    fullPage: true
  });
});

test("app page keeps diagnose compare design layout", async ({ page }) => {
  await page.goto("/app.html");
  await stabilize(page);
  await page.locator("#designer").scrollIntoViewIfNeeded();
  await expectVisual(page.locator(".main"), "app-designer-flow.png", {
    animations: "disabled",
    fullPage: true
  });
});

test("comparison mode renders stable before and after workbench", async ({ page }) => {
  await page.goto("/app.html");
  await stabilize(page);
  await page.locator("#comparison").scrollIntoViewIfNeeded();
  await page.locator("#comparison-label").fill("BIOS lane change");
  await page.locator("#capture-before-button").click();
  await page.locator("[name='pcieActiveLanes']").fill("2");
  await page.locator("[name='busMBps']").fill("3900");
  await page.locator("#capture-after-button").click();
  await expectVisual(page.locator("#comparison"), "comparison-workbench.png", {
    animations: "disabled"
  });
});
