export const DEV_HEARTBEAT_MESSAGE = "emoji-revealer:dev-heartbeat";

export const RUNTIME_COORDINATOR_TIMING = {
  prodGraceMs: 500,
  devHeartbeatMs: 1000,
  devStaleMs: 3500,
} as const;

interface RuntimeCoordinatorOptions {
  isDev: boolean;
  start: () => void;
  stop: () => void;
  win?: Window;
  timing?: Partial<typeof RUNTIME_COORDINATOR_TIMING>;
}

export interface RuntimeCoordinator {
  stop: () => void;
}

interface DevHeartbeatMessage {
  type: typeof DEV_HEARTBEAT_MESSAGE;
}

function isDevHeartbeatMessage(data: unknown): data is DevHeartbeatMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { type?: unknown }).type === DEV_HEARTBEAT_MESSAGE
  );
}

export function createRuntimeCoordinator(
  options: RuntimeCoordinatorOptions
): RuntimeCoordinator {
  const win = options.win ?? window;
  const timing = { ...RUNTIME_COORDINATOR_TIMING, ...options.timing };
  let active = false;
  let stopped = false;
  let heartbeatTimer: number | null = null;
  let graceTimer: number | null = null;
  let staleTimer: number | null = null;
  let lastDevHeartbeat: number | null = null;

  const startRuntime = (): void => {
    if (active || stopped) return;
    active = true;
    options.start();
  };

  const stopRuntime = (): void => {
    if (!active) return;
    active = false;
    options.stop();
  };

  const announceDevPresence = (): void => {
    win.postMessage({ type: DEV_HEARTBEAT_MESSAGE }, "*");
  };

  const clearTimer = (timer: number | null): void => {
    if (timer !== null) {
      win.clearTimeout(timer);
    }
  };

  const isHeartbeatFresh = (): boolean => {
    return (
      lastDevHeartbeat !== null &&
      Date.now() - lastDevHeartbeat < timing.devStaleMs
    );
  };

  const maybeStartProd = (): void => {
    if (stopped || isHeartbeatFresh()) return;
    startRuntime();
  };

  const scheduleStaleCheck = (): void => {
    clearTimer(staleTimer);
    staleTimer = win.setTimeout(() => {
      staleTimer = null;
      maybeStartProd();
    }, timing.devStaleMs);
  };

  const handleMessage = (event: MessageEvent): void => {
    if (event.source !== win || !isDevHeartbeatMessage(event.data)) return;
    lastDevHeartbeat = Date.now();
    stopRuntime();
    scheduleStaleCheck();
  };

  if (options.isDev) {
    startRuntime();
    announceDevPresence();
    heartbeatTimer = win.setInterval(
      announceDevPresence,
      timing.devHeartbeatMs
    );
  } else {
    win.addEventListener("message", handleMessage);
    graceTimer = win.setTimeout(() => {
      graceTimer = null;
      maybeStartProd();
    }, timing.prodGraceMs);
  }

  return {
    stop(): void {
      stopped = true;
      clearTimer(heartbeatTimer);
      clearTimer(graceTimer);
      clearTimer(staleTimer);
      if (!options.isDev) {
        win.removeEventListener("message", handleMessage);
      }
      stopRuntime();
    },
  };
}
