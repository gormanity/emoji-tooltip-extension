import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import {
  closePage,
  getExtensionServiceWorker,
  launchExtensionContext,
  launchExtensionContextWithMetadata,
  setExtensionOptions,
  startFixtureServer,
  type FixtureServer,
} from "./extension-fixture";

let server: FixtureServer;
let context: BrowserContext;
let page: Page | undefined;

test.beforeAll(async () => {
  server = await startFixtureServer();
});

test.afterAll(async () => {
  await server?.close();
});

test.beforeEach(async () => {
  context = await launchExtensionContext();
  page = await context.newPage();
});

test.afterEach(async () => {
  await closePage(page);
  await context?.close();
});

test("adds native tooltips to emoji text on page load", async () => {
  await page!.goto(`${server.origin}/content-fixture.html`);

  await expect(
    page!.locator('#plain-text [data-emoji-char="😀"]'),
  ).toHaveAttribute("title", "grinning face");
  await expect(
    page!.locator('#plain-text [data-emoji-char="👋🏽"]'),
  ).toHaveAttribute("title", "waving hand: medium skin tone");
});

test("leaves input and editable surfaces unmodified by default", async () => {
  await page!.goto(`${server.origin}/content-fixture.html`);

  await expect(page!.locator("#input")).toHaveValue("Input 😀");
  await expect(page!.locator("#textarea")).toHaveValue("Textarea 😀");
  await expect(page!.locator("#editable")).toHaveText("Editable 😀");
  await expect(page!.locator("#editable-tooltip")).toHaveText("😀");
  await expect(page!.locator("#role-textbox")).toHaveText("Role textbox 😀");
  await expect(page!.locator("#preformatted")).toHaveText("Pre 😀.");
  await expect(page!.locator("#code")).toHaveText("Code 😀.");
  await expect(page!.locator("#aria-hidden")).toHaveText("Hidden 😀.");

  await expect(page!.locator("#editable [data-emoji-revealer]")).toHaveCount(0);
  await expect(
    page!.locator("#editable-tooltip [data-emoji-revealer]"),
  ).toHaveCount(0);
  await expect(page!.locator("#role-textbox [data-emoji-revealer]")).toHaveCount(
    0,
  );
  await expect(page!.locator("#preformatted [data-emoji-revealer]")).toHaveCount(
    0,
  );
  await expect(page!.locator("#code [data-emoji-revealer]")).toHaveCount(0);
  await expect(page!.locator("#aria-hidden [data-emoji-revealer]")).toHaveCount(
    0,
  );
});

test("processes dynamically inserted emoji text", async () => {
  await page!.goto(`${server.origin}/content-fixture.html`);
  await page!.locator("#append-dynamic").click();

  await expect(
    page!.locator("#dynamic-text [data-emoji-char='🚀']"),
  ).toHaveAttribute("title", "rocket");
});

test("adds tooltips to emoji image fallbacks", async () => {
  await page!.goto(`${server.origin}/content-fixture.html`);

  await expect(page!.locator("#emoji-image")).toHaveAttribute(
    "title",
    "grinning face",
  );
});

test("shows a floating tooltip for contenteditable emoji when enabled", async () => {
  await page!.goto(`${server.origin}/content-fixture.html`);
  await setExtensionOptions(context, { showInEditableAreas: true });
  await page!.reload();
  await expect(page!.locator('#plain-text [data-emoji-char="😀"]')).toHaveCount(
    1,
  );

  const editableEmoji = page!.locator("#editable-tooltip-emoji");
  await editableEmoji.click();
  const box = await editableEmoji.boundingBox();
  if (!box) throw new Error("Editable tooltip fixture is not visible");
  await page!.mouse.move(box.x + 14, box.y + box.height / 2);

  const tooltip = page!.locator('[data-emoji-revealer-floating="true"]');
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toHaveText("grinning face");
});

test("removes and restores text tooltips when the extension is toggled", async () => {
  await page!.goto(`${server.origin}/content-fixture.html`);
  await expect(page!.locator('#plain-text [data-emoji-char="😀"]')).toHaveCount(
    1,
  );

  await setExtensionOptions(context, { enabled: false });
  await expect(page!.locator('#plain-text [data-emoji-char="😀"]')).toHaveCount(
    0,
  );
  await expect(page!.locator("#plain-text")).toHaveText("Hello 😀 and 👋🏽.");

  await setExtensionOptions(context, { enabled: true });
  await expect(
    page!.locator('#plain-text [data-emoji-char="😀"]'),
  ).toHaveAttribute("title", "grinning face");
});

test("updates existing tooltip formatting when options change", async () => {
  await page!.goto(`${server.origin}/content-fixture.html`);

  await setExtensionOptions(context, {
    showEmoji: true,
    showCodePoints: true,
    showSkinTone: false,
  });

  await expect(
    page!.locator('#plain-text [data-emoji-char="👋🏽"]'),
  ).toHaveAttribute("title", "👋🏽 waving hand (U+1F44B U+1F3FD)");
});

test("production build works on the target page by itself", async () => {
  await page!.goto(`${server.origin}/content-fixture.html`);

  await expect(
    page!.locator('#plain-text [data-emoji-revealer="prod"][data-emoji-char="😀"]'),
  ).toHaveAttribute("title", "grinning face");
  await expect(page!.locator('[data-emoji-revealer="dev"]')).toHaveCount(0);
});

test("dev build wins on the target page when prod and dev are installed", async () => {
  await context.close();
  const loaded = await launchExtensionContextWithMetadata("prod-and-dev");
  context = loaded.context;
  page = await context.newPage();

  await page.goto(`${server.origin}/content-fixture.html`);

  await expect(
    page.locator('#plain-text [data-emoji-revealer="dev"][data-emoji-char="😀"]'),
  ).toHaveAttribute("title", "grinning face");
  await expect(page.locator('[data-emoji-revealer="prod"]')).toHaveCount(0);
});

test("dev build ignores standalone emoji components without warnings", async () => {
  await context.close();
  const loaded = await launchExtensionContextWithMetadata("prod-and-dev");
  context = loaded.context;
  page = await context.newPage();
  const warnings: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "warning") {
      warnings.push(message.text());
    }
  });

  await page.goto(`${server.origin}/content-fixture.html`);
  await expect(page.locator("#emoji-components")).toContainText("Components");

  expect(
    warnings.filter((message) =>
      message.includes("Emoji Revealer: Unrecognized emoji sequence"),
    ),
  ).toEqual([]);
});

test("production popup and badge show duplicate-disabled without a target page", async () => {
  await context.close();
  const loaded = await launchExtensionContextWithMetadata("prod-and-dev");
  context = loaded.context;

  const popupPage = await openProductionPopup(context, loaded.extensionIds);
  await expect(popupPage.locator("#duplicateInstallBanner")).toBeVisible();
  await expectProductionBadgeText(context, loaded.extensionIds, "OFF");
  await closePage(popupPage);
});

test("production resumes after page-local dev heartbeat stales", async () => {
  await page!.goto(`${server.origin}/content-fixture.html`);
  await emitDevHeartbeat(page!);
  await page!.waitForTimeout(600);
  await expect(page!.locator('[data-emoji-revealer="prod"]')).toHaveCount(0);

  await page!.waitForTimeout(3500);
  await expect(
    page!.locator('#plain-text [data-emoji-revealer="prod"][data-emoji-char="😀"]'),
  ).toHaveAttribute("title", "grinning face");
});

test("production content follows background duplicate-disabled state", async () => {
  await page!.goto(`${server.origin}/content-fixture.html`);
  await expect(
    page!.locator('#plain-text [data-emoji-revealer="prod"][data-emoji-char="😀"]'),
  ).toHaveAttribute("title", "grinning face");

  const worker = await getExtensionServiceWorker(context);
  await sendDuplicateStatusToActiveTab(worker, true);
  await expect(page!.locator('[data-emoji-revealer="prod"]')).toHaveCount(0);

  await sendDuplicateStatusToActiveTab(worker, false);
  await expect(
    page!.locator('#plain-text [data-emoji-revealer="prod"][data-emoji-char="😀"]'),
  ).toHaveAttribute("title", "grinning face");
});

async function openProductionPopup(
  context: BrowserContext,
  extensionIds: string[],
): Promise<Page> {
  for (const extensionId of extensionIds) {
    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup/popup.html`);
    const isDevPopup = await popupPage.locator("#devBadge").evaluate((badge) => {
      return !(badge as HTMLElement).classList.contains("is-hidden");
    });

    if (!isDevPopup) {
      return popupPage;
    }

    await closePage(popupPage);
  }

  throw new Error("Unable to find production popup");
}

async function expectProductionBadgeText(
  context: BrowserContext,
  extensionIds: string[],
  expectedText: string,
): Promise<void> {
  const productionExtensionId = await findProductionExtensionId(
    context,
    extensionIds,
  );
  const worker = context
    .serviceWorkers()
    .find((candidate) =>
      candidate.url().startsWith(`chrome-extension://${productionExtensionId}/`),
    );
  if (!worker) {
    throw new Error("Unable to find production service worker");
  }

  await expect
    .poll(() => worker.evaluate(() => chrome.action.getBadgeText({})))
    .toBe(expectedText);
}

async function findProductionExtensionId(
  context: BrowserContext,
  extensionIds: string[],
): Promise<string> {
  for (const extensionId of extensionIds) {
    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup/popup.html`);
    const isDevPopup = await popupPage.locator("#devBadge").evaluate((badge) => {
      return !(badge as HTMLElement).classList.contains("is-hidden");
    });
    await closePage(popupPage);

    if (!isDevPopup) {
      return extensionId;
    }
  }

  throw new Error("Unable to find production extension ID");
}

async function emitDevHeartbeat(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.postMessage({ type: "emoji-revealer:dev-heartbeat" }, "*");
  });
}

async function sendDuplicateStatusToActiveTab(
  worker: Awaited<ReturnType<typeof getExtensionServiceWorker>>,
  duplicateDetected: boolean,
): Promise<void> {
  await worker.evaluate(async (nextDuplicateDetected) => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabId = tabs[0]?.id;
    if (tabId === undefined) {
      throw new Error("Unable to find active tab");
    }

    await chrome.tabs.sendMessage(tabId, {
      type: "emoji-revealer:duplicate-status-changed",
      data: { duplicateDetected: nextDuplicateDetected },
    });
  }, duplicateDetected);
}
