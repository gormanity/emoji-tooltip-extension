const RUNTIME_STATE_MESSAGE = "emoji-revealer:runtime-state";

interface RuntimeStateMessage {
  type: typeof RUNTIME_STATE_MESSAGE;
  disabledByDuplicate: boolean;
}

const NORMAL_ICON_PATHS = {
  16: "icons/icon16.png",
  32: "icons/icon32.png",
};

const OFF_ICON_PATHS = {
  16: "icons/icon-off16.png",
  32: "icons/icon-off32.png",
};

const NORMAL_TITLE = "Emoji Revealer";
const DUPLICATE_DISABLED_TITLE =
  "Emoji Revealer disabled while the dev build is active";
const NAVIGATION_STATE_SETTLE_MS = 750;

const suspendedFramesByTab = new Map<number, Set<number>>();
const navigationSettleTimersByTab = new Map<number, number>();

function isRuntimeStateMessage(message: unknown): message is RuntimeStateMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as { type?: unknown }).type === RUNTIME_STATE_MESSAGE &&
    typeof (message as { disabledByDuplicate?: unknown })
      .disabledByDuplicate === "boolean"
  );
}

function setFrameState(
  tabId: number,
  frameId: number,
  disabledByDuplicate: boolean
): void {
  if (disabledByDuplicate) {
    const frames = suspendedFramesByTab.get(tabId) ?? new Set<number>();
    frames.add(frameId);
    suspendedFramesByTab.set(tabId, frames);
    return;
  }

  const frames = suspendedFramesByTab.get(tabId);
  if (!frames) return;
  frames.delete(frameId);
  if (frames.size === 0) {
    suspendedFramesByTab.delete(tabId);
  }
}

function clearNavigationSettleTimer(tabId: number): void {
  const timer = navigationSettleTimersByTab.get(tabId);
  if (timer === undefined) return;
  clearTimeout(timer);
  navigationSettleTimersByTab.delete(tabId);
}

function scheduleNavigationStateSettle(tabId: number): void {
  clearNavigationSettleTimer(tabId);
  navigationSettleTimersByTab.set(
    tabId,
    setTimeout(() => {
      navigationSettleTimersByTab.delete(tabId);
      updateActionState();
    }, NAVIGATION_STATE_SETTLE_MS)
  );
}

function setActionState(disabledByDuplicate: boolean): void {
  void chrome.action.setIcon({
    path: disabledByDuplicate ? OFF_ICON_PATHS : NORMAL_ICON_PATHS,
  });
  void chrome.action.setTitle({
    title: disabledByDuplicate ? DUPLICATE_DISABLED_TITLE : NORMAL_TITLE,
  });
  void chrome.action.setBadgeText({
    text: disabledByDuplicate ? "OFF" : "",
  });
  void chrome.action.setBadgeBackgroundColor({
    color: "#555555",
  });
}

function updateActionState(): void {
  setActionState(suspendedFramesByTab.size > 0);
}

chrome.runtime.onMessage.addListener((message, sender) => {
  if (!isRuntimeStateMessage(message)) return false;

  const tabId = sender.tab?.id;
  if (tabId === undefined) return false;

  clearNavigationSettleTimer(tabId);
  setFrameState(tabId, sender.frameId ?? 0, message.disabledByDuplicate);
  updateActionState();
  return false;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  clearNavigationSettleTimer(tabId);
  suspendedFramesByTab.delete(tabId);
  updateActionState();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status !== "loading") return;

  const wasDisabledByDuplicate =
    (suspendedFramesByTab.get(tabId)?.size ?? 0) > 0;
  suspendedFramesByTab.delete(tabId);

  if (wasDisabledByDuplicate) {
    scheduleNavigationStateSettle(tabId);
  }
});
