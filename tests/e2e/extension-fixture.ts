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
  const extensionPath = resolve("dist/chrome");
  const userDataDir = await mkdtemp(join(tmpdir(), "emoji-revealer-e2e-"));
  const options: BrowserContextOptions = {
    channel: process.env.PLAYWRIGHT_CHROME_CHANNEL ?? "chromium",
    headless: process.env.HEADED !== "1",
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  };

  return chromium.launchPersistentContext(userDataDir, options);
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
