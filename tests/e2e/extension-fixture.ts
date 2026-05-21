import { mkdtemp, readFile, stat } from "node:fs/promises";
import {
  createServer,
  type RequestListener,
  type Server as HttpServer,
} from "node:http";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";
import {
  chromium,
  type BrowserContext,
  type BrowserContextOptions,
  type Page,
  type Worker,
} from "@playwright/test";

const DEFAULT_OPTIONS = {
  enabled: true,
  showEmoji: false,
  showName: true,
  showCodePoints: false,
  showSkinTone: true,
  showInEditableAreas: false,
};

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

export interface FixtureServer {
  origin: string;
  close: () => Promise<void>;
}

export type TooltipOptions = typeof DEFAULT_OPTIONS;
export type ExtensionMode = "prod" | "prod-and-dev";

export interface ExtensionContext {
  context: BrowserContext;
  extensionIds: string[];
}

export async function startFixtureServer(): Promise<FixtureServer> {
  const root = resolve("fixtures/e2e");
  const handler: RequestListener = async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      const pathname =
        url.pathname === "/" ? "/content-fixture.html" : url.pathname;
      const filePath = resolve(root, `.${pathname}`);

      if (!filePath.startsWith(root)) {
        response.writeHead(403);
        response.end("Forbidden");
        return;
      }

      await stat(filePath);
      response.writeHead(200, {
        "content-type":
          CONTENT_TYPES[extname(filePath)] ?? "application/octet-stream",
      });
      response.end(await readFile(filePath));
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  };
  const server = createServer(handler);
  await listen(server);

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Fixture server did not start with a TCP address");
  }

  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: async () => closeServer(server),
  };
}

export async function launchExtensionContext(): Promise<BrowserContext> {
  return (await launchExtensionContextWithMetadata("prod")).context;
}

export async function launchExtensionContextWithMetadata(
  mode: ExtensionMode = "prod",
): Promise<ExtensionContext> {
  const extensionPath = resolve("dist/chrome");
  const extensionPaths =
    mode === "prod-and-dev"
      ? [extensionPath, resolve("dist-dev/chrome")]
      : [extensionPath];
  const userDataDir = await mkdtemp(join(tmpdir(), "emoji-revealer-e2e-"));
  const options: BrowserContextOptions = {
    channel: process.env.PLAYWRIGHT_CHROME_CHANNEL ?? "chromium",
    headless: process.env.HEADED !== "1",
    args: [
      `--disable-extensions-except=${extensionPaths.join(",")}`,
      `--load-extension=${extensionPaths.join(",")}`,
    ],
  };

  const context = await chromium.launchPersistentContext(userDataDir, options);
  const extensionIds = await waitForExtensionIds(context, extensionPaths.length);
  return { context, extensionIds };
}

export async function setExtensionOptions(
  context: BrowserContext,
  options: Partial<TooltipOptions> = {},
): Promise<void> {
  const worker = await getServiceWorker(context);
  await worker.evaluate(async (nextOptions) => {
    await chrome.storage.sync.clear();
    await chrome.storage.sync.set(nextOptions);
  }, { ...DEFAULT_OPTIONS, ...options });
}

export async function closePage(page: Page | undefined): Promise<void> {
  if (page && !page.isClosed()) await page.close();
}

async function getServiceWorker(context: BrowserContext): Promise<Worker> {
  return context.serviceWorkers()[0] ?? context.waitForEvent("serviceworker");
}

export async function getExtensionServiceWorker(
  context: BrowserContext,
  extensionId?: string,
): Promise<Worker> {
  if (!extensionId) return getServiceWorker(context);

  const existingWorker = context
    .serviceWorkers()
    .find((worker) => worker.url().startsWith(`chrome-extension://${extensionId}/`));
  if (existingWorker) return existingWorker;

  while (true) {
    const worker = await context.waitForEvent("serviceworker");
    if (worker.url().startsWith(`chrome-extension://${extensionId}/`)) {
      return worker;
    }
  }
}

async function waitForExtensionIds(
  context: BrowserContext,
  expectedCount: number,
): Promise<string[]> {
  const ids = new Set<string>();

  const collect = (worker: Worker): void => {
    const match = worker.url().match(/^chrome-extension:\/\/([^/]+)\//);
    if (match) ids.add(match[1]);
  };

  for (const worker of context.serviceWorkers()) {
    collect(worker);
  }

  while (ids.size < expectedCount) {
    collect(await context.waitForEvent("serviceworker"));
  }

  return [...ids];
}

async function listen(server: HttpServer): Promise<void> {
  await new Promise<void>((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", () => resolveListen());
  });
}

async function closeServer(server: HttpServer): Promise<void> {
  await new Promise<void>((resolveClose, rejectClose) => {
    server.close((error) => {
      if (error) rejectClose(error);
      else resolveClose();
    });
  });
}
