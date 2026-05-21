import {
  CHROMIUM_DEV_EXTENSION_ID,
  CHROMIUM_PROD_EXTENSION_IDS,
  DEV_BUILD_PING_INTERVAL_MS,
  DEV_BUILD_PRESENCE_MESSAGE,
  DEV_BUILD_PRESENCE_REQUEST_MESSAGE,
  DEV_BUILD_STALE_MS,
  DUPLICATE_STATUS_CHANGED_MESSAGE,
  type DuplicateStatusResponse,
  isDevBuildPresenceMessage,
  isDevBuildPresenceRequestMessage,
  isDuplicateStatusRequestMessage,
  isRuntimeStateMessage,
} from "./runtime-messages";

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
const NAVIGATION_STATE_FALLBACK_MS = 10000;

const suspendedFramesByTab = new Map<number, Set<number>>();
const navigationFallbackTimersByTab = new Map<number, number>();
let currentActionState: boolean | null = null;
let externalDevBuildPresent = false;
let externalDevBuildStaleTimer: number | undefined;

function isDuplicateDisabled(): boolean {
  return externalDevBuildPresent || suspendedFramesByTab.size > 0;
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

function clearNavigationFallbackTimer(tabId: number): void {
  const timer = navigationFallbackTimersByTab.get(tabId);
  if (timer === undefined) return;
  clearTimeout(timer);
  navigationFallbackTimersByTab.delete(tabId);
}

function scheduleNavigationStateFallback(tabId: number): void {
  clearNavigationFallbackTimer(tabId);
  navigationFallbackTimersByTab.set(
    tabId,
    setTimeout(() => {
      const wasDisabledByDuplicate = isDuplicateDisabled();
      navigationFallbackTimersByTab.delete(tabId);
      updateDuplicateState(wasDisabledByDuplicate);
    }, NAVIGATION_STATE_FALLBACK_MS)
  );
}

function setActionState(disabledByDuplicate: boolean): void {
  if (currentActionState === disabledByDuplicate) return;
  currentActionState = disabledByDuplicate;

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
  setActionState(isDuplicateDisabled());
}

function notifyDuplicateStatusChanged(): void {
  const message = {
    type: DUPLICATE_STATUS_CHANGED_MESSAGE,
    data: { duplicateDetected: isDuplicateDisabled() },
  };

  try {
    chrome.runtime.sendMessage(message, () => {
      void chrome.runtime.lastError;
    });
  } catch {
    // The popup may not be open, and extension contexts can disappear.
  }

  try {
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        if (tab.id === undefined) continue;
        chrome.tabs.sendMessage(tab.id, message, () => {
          void chrome.runtime.lastError;
        });
      }
    });
  } catch {
    // Content scripts may not be injected into any current tab.
  }
}

function updateDuplicateState(wasDisabledByDuplicate: boolean): void {
  updateActionState();

  if (isDuplicateDisabled() !== wasDisabledByDuplicate) {
    notifyDuplicateStatusChanged();
  }
}

function setExternalDevBuildPresent(present: boolean): void {
  const wasDisabledByDuplicate = isDuplicateDisabled();
  externalDevBuildPresent = present;
  updateDuplicateState(wasDisabledByDuplicate);
}

function markExternalDevBuildPresent(): void {
  setExternalDevBuildPresent(true);
  if (externalDevBuildStaleTimer !== undefined) {
    clearTimeout(externalDevBuildStaleTimer);
  }
  externalDevBuildStaleTimer = setTimeout(() => {
    externalDevBuildStaleTimer = undefined;
    setExternalDevBuildPresent(false);
  }, DEV_BUILD_STALE_MS);
}

function startDevBuildHeartbeat(): void {
  if (!__DEV__) return;

  const pingProd = (): void => {
    for (const extensionId of CHROMIUM_PROD_EXTENSION_IDS) {
      chrome.runtime.sendMessage(
        extensionId,
        { type: DEV_BUILD_PRESENCE_MESSAGE },
        () => {
          void chrome.runtime.lastError;
        }
      );
    }
  };

  pingProd();
  setInterval(pingProd, DEV_BUILD_PING_INTERVAL_MS);
}

function probeDevBuildPresence(callback?: () => void): void {
  if (__DEV__) {
    callback?.();
    return;
  }

  chrome.runtime.sendMessage(
    CHROMIUM_DEV_EXTENSION_ID,
    { type: DEV_BUILD_PRESENCE_REQUEST_MESSAGE },
    (response?: { ok?: boolean }) => {
      if (!chrome.runtime.lastError && response?.ok === true) {
        markExternalDevBuildPresent();
      }
      callback?.();
    }
  );
}

function sendDuplicateStatusResponse(
  sendResponse: (response: DuplicateStatusResponse) => void
): void {
  sendResponse({
    ok: true,
    data: { duplicateDetected: isDuplicateDisabled() },
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (isDuplicateStatusRequestMessage(message)) {
    probeDevBuildPresence(() => {
      sendDuplicateStatusResponse(sendResponse);
    });
    return true;
  }

  if (!isRuntimeStateMessage(message)) return false;

  const tabId = sender.tab?.id;
  if (tabId === undefined) return false;

  const wasDisabledByDuplicate = isDuplicateDisabled();
  clearNavigationFallbackTimer(tabId);
  setFrameState(tabId, sender.frameId ?? 0, message.disabledByDuplicate);
  updateDuplicateState(wasDisabledByDuplicate);
  return false;
});

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (__DEV__) {
    if (!CHROMIUM_PROD_EXTENSION_IDS.some((id) => id === sender.id)) {
      return false;
    }
    if (!isDevBuildPresenceRequestMessage(message)) return false;

    sendResponse({ ok: true });
    return false;
  }

  if (sender.id !== CHROMIUM_DEV_EXTENSION_ID) return false;
  if (!isDevBuildPresenceMessage(message)) return false;

  markExternalDevBuildPresent();
  sendResponse({ ok: true });
  return false;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  const wasDisabledByDuplicate = isDuplicateDisabled();
  clearNavigationFallbackTimer(tabId);
  suspendedFramesByTab.delete(tabId);
  updateDuplicateState(wasDisabledByDuplicate);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status !== "loading") return;

  const wasDisabledByDuplicate =
    (suspendedFramesByTab.get(tabId)?.size ?? 0) > 0;
  suspendedFramesByTab.delete(tabId);

  if (wasDisabledByDuplicate) {
    scheduleNavigationStateFallback(tabId);
  }
});

startDevBuildHeartbeat();
probeDevBuildPresence();
