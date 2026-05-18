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

const suspendedFramesByTab = new Map<number, Set<number>>();

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

function resetTabState(tabId: number): void {
  suspendedFramesByTab.delete(tabId);
  void chrome.action.setIcon({
    tabId,
    path: NORMAL_ICON_PATHS,
  });
}

function updateTabIcon(tabId: number): void {
  const disabledByDuplicate = (suspendedFramesByTab.get(tabId)?.size ?? 0) > 0;

  void chrome.action.setIcon({
    tabId,
    path: disabledByDuplicate ? OFF_ICON_PATHS : NORMAL_ICON_PATHS,
  });
}

chrome.runtime.onMessage.addListener((message, sender) => {
  if (!isRuntimeStateMessage(message)) return false;

  const tabId = sender.tab?.id;
  if (tabId === undefined) return false;

  setFrameState(tabId, sender.frameId ?? 0, message.disabledByDuplicate);
  updateTabIcon(tabId);
  return false;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  suspendedFramesByTab.delete(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    resetTabState(tabId);
  }
});
