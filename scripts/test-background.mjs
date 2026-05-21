#!/usr/bin/env node

import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import * as esbuild from "esbuild";

const DUPLICATE_STATUS_REQUEST_MESSAGE =
  "emoji-revealer:get-duplicate-status";
const RUNTIME_STATE_MESSAGE = "emoji-revealer:runtime-state";
const DUPLICATE_STATUS_CHANGED_MESSAGE =
  "emoji-revealer:duplicate-status-changed";
const DEV_BUILD_PRESENCE_MESSAGE = "emoji-revealer:dev-build-presence";
const DEV_BUILD_PRESENCE_REQUEST_MESSAGE =
  "emoji-revealer:get-dev-build-presence";
const LOCAL_PROD_ID = "migochplggocmjacpndhoedemhcoabhc";
const DEV_ID = "klehagjocloghgoedkclniblgonaknpd";
const DEV_STALE_MS = 3500;

class FakeTimers {
  constructor() {
    this.now = 0;
    this.nextId = 1;
    this.timers = new Map();
  }

  setTimeout(callback, delay) {
    const id = this.nextId++;
    this.timers.set(id, {
      callback,
      time: this.now + delay,
      interval: null,
    });
    return id;
  }

  setInterval(callback, delay) {
    const id = this.nextId++;
    this.timers.set(id, {
      callback,
      time: this.now + delay,
      interval: delay,
    });
    return id;
  }

  clearTimer(id) {
    this.timers.delete(id);
  }

  tick(ms) {
    const end = this.now + ms;
    while (true) {
      let nextId = null;
      let nextTimer = null;

      for (const [id, timer] of this.timers) {
        if (timer.time <= end && (!nextTimer || timer.time < nextTimer.time)) {
          nextId = id;
          nextTimer = timer;
        }
      }

      if (!nextTimer) break;

      this.now = nextTimer.time;
      if (nextTimer.interval === null) {
        this.timers.delete(nextId);
      } else {
        nextTimer.time += nextTimer.interval;
      }
      nextTimer.callback();
    }
    this.now = end;
  }
}

async function loadServiceWorker({ isDev, chromeMock }) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "emoji-bg-"));
  const outfile = path.join(tempDir, `service-worker-${isDev}.mjs`);
  await esbuild.build({
    entryPoints: ["src/service-worker.ts"],
    outfile,
    bundle: true,
    platform: "browser",
    format: "esm",
    define: { __DEV__: JSON.stringify(isDev) },
    logLevel: "silent",
  });

  globalThis.chrome = chromeMock;
  await import(`file://${outfile}?t=${Date.now()}-${Math.random()}`);
}

function createChromeMock() {
  let messageListener;
  let externalMessageListener;
  let tabRemovedListener;
  let tabUpdatedListener;
  const sentMessages = [];
  const tabMessages = [];
  const actionCalls = {
    setBadgeBackgroundColor: [],
    setBadgeText: [],
    setIcon: [],
    setTitle: [],
  };
  const state = {
    externalDevResponds: false,
    lastError: undefined,
  };

  const chromeMock = {
    action: {
      setBadgeBackgroundColor: (payload) => {
        actionCalls.setBadgeBackgroundColor.push(payload);
        return Promise.resolve();
      },
      setBadgeText: (payload) => {
        actionCalls.setBadgeText.push(payload);
        return Promise.resolve();
      },
      setIcon: (payload) => {
        actionCalls.setIcon.push(payload);
        return Promise.resolve();
      },
      setTitle: (payload) => {
        actionCalls.setTitle.push(payload);
        return Promise.resolve();
      },
    },
    runtime: {
      get lastError() {
        return state.lastError;
      },
      set lastError(value) {
        state.lastError = value;
      },
      onMessage: {
        addListener: (listener) => {
          messageListener = listener;
        },
      },
      onMessageExternal: {
        addListener: (listener) => {
          externalMessageListener = listener;
        },
      },
      sendMessage: (...args) => {
        if (typeof args[0] === "string") {
          const callback = args[2];
          sentMessages.push({ extensionId: args[0], message: args[1] });
          if (state.externalDevResponds) {
            callback?.({ ok: true });
          } else {
            state.lastError = { message: "Receiving end does not exist." };
            callback?.();
            state.lastError = undefined;
          }
          return;
        }

        const callback = args[1];
        sentMessages.push(args[0]);
        callback?.();
      },
    },
    tabs: {
      query: (_queryInfo, callback) => {
        callback([{ id: 7 }]);
      },
      sendMessage: (tabId, message, callback) => {
        tabMessages.push({ tabId, message });
        callback?.();
      },
      onRemoved: {
        addListener: (listener) => {
          tabRemovedListener = listener;
        },
      },
      onUpdated: {
        addListener: (listener) => {
          tabUpdatedListener = listener;
        },
      },
    },
  };

  return {
    actionCalls,
    chromeMock,
    get externalMessageListener() {
      return externalMessageListener;
    },
    get messageListener() {
      return messageListener;
    },
    tabMessages,
    sentMessages,
    state,
    get tabRemovedListener() {
      return tabRemovedListener;
    },
    get tabUpdatedListener() {
      return tabUpdatedListener;
    },
  };
}

function withFakeTimers(fn) {
  const timers = new FakeTimers();
  const originalSetTimeout = globalThis.setTimeout;
  const originalSetInterval = globalThis.setInterval;
  const originalClearTimeout = globalThis.clearTimeout;
  const originalClearInterval = globalThis.clearInterval;

  globalThis.setTimeout = timers.setTimeout.bind(timers);
  globalThis.setInterval = timers.setInterval.bind(timers);
  globalThis.clearTimeout = timers.clearTimer.bind(timers);
  globalThis.clearInterval = timers.clearTimer.bind(timers);

  return Promise.resolve()
    .then(() => fn(timers))
    .finally(() => {
      globalThis.setTimeout = originalSetTimeout;
      globalThis.setInterval = originalSetInterval;
      globalThis.clearTimeout = originalClearTimeout;
      globalThis.clearInterval = originalClearInterval;
    });
}

function requestDuplicateStatus(listener) {
  return new Promise((resolve) => {
    const keepOpen = listener(
      { type: DUPLICATE_STATUS_REQUEST_MESSAGE },
      {},
      resolve
    );
    assert.equal(keepOpen, true);
  });
}

await withFakeTimers(async (timers) => {
  const mock = createChromeMock();
  await loadServiceWorker({ isDev: true, chromeMock: mock.chromeMock });

  assert.deepEqual(mock.sentMessages[0], {
    extensionId: LOCAL_PROD_ID,
    message: { type: DEV_BUILD_PRESENCE_MESSAGE },
  });

  timers.tick(1000);
  assert.deepEqual(mock.sentMessages[1], {
    extensionId: LOCAL_PROD_ID,
    message: { type: DEV_BUILD_PRESENCE_MESSAGE },
  });
});

await withFakeTimers(async () => {
  const mock = createChromeMock();
  await loadServiceWorker({ isDev: false, chromeMock: mock.chromeMock });
  mock.sentMessages.length = 0;

  mock.externalMessageListener(
    { type: DEV_BUILD_PRESENCE_MESSAGE },
    { id: "not-the-dev-build" },
    () => {}
  );

  assert.deepEqual(await requestDuplicateStatus(mock.messageListener), {
    ok: true,
    data: { duplicateDetected: false },
  });

  mock.externalMessageListener(
    { type: DEV_BUILD_PRESENCE_MESSAGE },
    { id: DEV_ID },
    () => {}
  );

  assert.deepEqual(await requestDuplicateStatus(mock.messageListener), {
    ok: true,
    data: { duplicateDetected: true },
  });
});

await withFakeTimers(async () => {
  const mock = createChromeMock();
  mock.state.externalDevResponds = true;
  await loadServiceWorker({ isDev: false, chromeMock: mock.chromeMock });
  mock.sentMessages.length = 0;

  assert.deepEqual(await requestDuplicateStatus(mock.messageListener), {
    ok: true,
    data: { duplicateDetected: true },
  });
  assert.deepEqual(mock.sentMessages[0], {
    extensionId: DEV_ID,
    message: { type: DEV_BUILD_PRESENCE_REQUEST_MESSAGE },
  });
  assert.deepEqual(mock.actionCalls.setBadgeText.at(-1), { text: "OFF" });
});

await withFakeTimers(async (timers) => {
  const mock = createChromeMock();
  await loadServiceWorker({ isDev: false, chromeMock: mock.chromeMock });

  mock.externalMessageListener(
    { type: DEV_BUILD_PRESENCE_MESSAGE },
    { id: DEV_ID },
    () => {}
  );

  assert.deepEqual(await requestDuplicateStatus(mock.messageListener), {
    ok: true,
    data: { duplicateDetected: true },
  });

  timers.tick(DEV_STALE_MS);

  assert.deepEqual(await requestDuplicateStatus(mock.messageListener), {
    ok: true,
    data: { duplicateDetected: false },
  });
  assert.deepEqual(mock.actionCalls.setBadgeText.at(-1), { text: "" });
});

await withFakeTimers(async () => {
  const mock = createChromeMock();
  await loadServiceWorker({ isDev: false, chromeMock: mock.chromeMock });
  mock.sentMessages.length = 0;

  mock.messageListener(
    { type: RUNTIME_STATE_MESSAGE, disabledByDuplicate: true },
    { tab: { id: 7 }, frameId: 0 },
    () => {}
  );

  assert.deepEqual(await requestDuplicateStatus(mock.messageListener), {
    ok: true,
    data: { duplicateDetected: true },
  });
  assert.deepEqual(mock.actionCalls.setBadgeText.at(-1), { text: "OFF" });
  assert.ok(
    mock.sentMessages.some(
      (message) =>
        message.type === DUPLICATE_STATUS_CHANGED_MESSAGE &&
        message.data?.duplicateDetected === true
    )
  );
  assert.ok(
    mock.tabMessages.some(
      ({ message, tabId }) =>
        tabId === 7 &&
        message.type === DUPLICATE_STATUS_CHANGED_MESSAGE &&
        message.data?.duplicateDetected === true
    )
  );

  mock.tabRemovedListener(7);
  assert.deepEqual(await requestDuplicateStatus(mock.messageListener), {
    ok: true,
    data: { duplicateDetected: false },
  });
});

console.log("Background arbitration tests passed");
