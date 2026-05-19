import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import {
  closePage,
  launchExtensionContext,
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
