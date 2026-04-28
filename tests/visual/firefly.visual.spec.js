import { expect, test } from "@playwright/test";

async function stabilize(page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        scroll-behavior: auto !important;
      }
      #cursor, body::after { display: none !important; }
      .fade-in { opacity: 1 !important; transform: none !important; }
    `
  });
  await page.evaluate(() => document.fonts?.ready);
}

test("notes page keeps the editorial landing composition", async ({ page }) => {
  await page.goto("/index.html");
  await stabilize(page);
  await expect(page.locator(".main")).toHaveScreenshot("notes-page.png", {
    animations: "disabled",
    fullPage: true
  });
});

test("app page keeps diagnose compare design layout", async ({ page }) => {
  await page.goto("/app.html");
  await stabilize(page);
  await page.locator("#designer").scrollIntoViewIfNeeded();
  await expect(page.locator(".main")).toHaveScreenshot("app-designer-flow.png", {
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
  await expect(page.locator("#comparison")).toHaveScreenshot("comparison-workbench.png", {
    animations: "disabled"
  });
});
