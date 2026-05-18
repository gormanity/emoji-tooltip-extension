#!/usr/bin/env node

import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import * as esbuild from "esbuild";

class FakeWindow {
  constructor() {
    this.now = 0;
    this.nextTimerId = 1;
    this.listeners = new Map();
    this.timers = new Map();
    this.postedMessages = [];
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  postMessage(data, targetOrigin) {
    this.postedMessages.push({ data, targetOrigin });
  }

  setTimeout(callback, delay) {
    const id = this.nextTimerId++;
    this.timers.set(id, {
      callback,
      time: this.now + delay,
      interval: null,
    });
    return id;
  }

  setInterval(callback, delay) {
    const id = this.nextTimerId++;
    this.timers.set(id, {
      callback,
      time: this.now + delay,
      interval: delay,
    });
    return id;
  }

  clearTimeout(id) {
    this.timers.delete(id);
  }

  emitMessage(data) {
    for (const listener of this.listeners.get("message") ?? []) {
      listener({ source: this, data });
    }
  }

  tick(ms) {
    const end = this.now + ms;

    while (true) {
      let nextId = null;
      let nextTimer = null;

      for (const [id, timer] of this.timers) {
        if (
          timer.time <= end &&
          (!nextTimer || timer.time < nextTimer.time)
        ) {
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

async function loadCoordinator() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "emoji-revealer-"));
  const outfile = path.join(tempDir, "runtime-coordinator.mjs");

  await esbuild.build({
    entryPoints: ["src/runtime-coordinator.ts"],
    outfile,
    bundle: true,
    platform: "node",
    format: "esm",
    logLevel: "silent",
  });

  return import(`file://${outfile}`);
}

function withFakeClock(fakeWindow, fn) {
  const originalNow = Date.now;
  Date.now = () => fakeWindow.now;
  try {
    fn();
  } finally {
    Date.now = originalNow;
  }
}

function runtimeCounters() {
  return {
    starts: 0,
    stops: 0,
    start() {
      this.starts++;
    },
    stop() {
      this.stops++;
    },
  };
}

const {
  createRuntimeCoordinator,
  DEV_HEARTBEAT_MESSAGE,
  RUNTIME_COORDINATOR_TIMING,
} = await loadCoordinator();

{
  const win = new FakeWindow();
  withFakeClock(win, () => {
    const runtime = runtimeCounters();

    createRuntimeCoordinator({
      isDev: true,
      win,
      start: () => runtime.start(),
      stop: () => runtime.stop(),
    });

    assert.equal(runtime.starts, 1);
    assert.equal(win.postedMessages.length, 1);
    assert.deepEqual(win.postedMessages[0], {
      data: { type: DEV_HEARTBEAT_MESSAGE },
      targetOrigin: "*",
    });

    win.tick(RUNTIME_COORDINATOR_TIMING.devHeartbeatMs);
    assert.equal(win.postedMessages.length, 2);
  });
}

{
  const win = new FakeWindow();
  withFakeClock(win, () => {
    const runtime = runtimeCounters();

    createRuntimeCoordinator({
      isDev: false,
      win,
      start: () => runtime.start(),
      stop: () => runtime.stop(),
    });

    win.tick(RUNTIME_COORDINATOR_TIMING.prodGraceMs - 1);
    assert.equal(runtime.starts, 0);
    win.tick(1);
    assert.equal(runtime.starts, 1);
  });
}

{
  const win = new FakeWindow();
  withFakeClock(win, () => {
    const runtime = runtimeCounters();
    let suspends = 0;
    let resumes = 0;

    createRuntimeCoordinator({
      isDev: false,
      win,
      start: () => runtime.start(),
      stop: () => runtime.stop(),
      onSuspend: () => suspends++,
      onResume: () => resumes++,
    });

    win.emitMessage({ type: DEV_HEARTBEAT_MESSAGE });
    assert.equal(suspends, 1);
    win.tick(RUNTIME_COORDINATOR_TIMING.prodGraceMs);
    assert.equal(runtime.starts, 0);
    win.tick(
      RUNTIME_COORDINATOR_TIMING.devStaleMs -
        RUNTIME_COORDINATOR_TIMING.prodGraceMs -
        1
    );
    assert.equal(runtime.starts, 0);
    assert.equal(resumes, 0);
  });
}

{
  const win = new FakeWindow();
  withFakeClock(win, () => {
    const runtime = runtimeCounters();
    let suspends = 0;

    createRuntimeCoordinator({
      isDev: false,
      win,
      start: () => runtime.start(),
      stop: () => runtime.stop(),
      onSuspend: () => suspends++,
    });

    win.tick(RUNTIME_COORDINATOR_TIMING.prodGraceMs);
    assert.equal(runtime.starts, 1);
    win.emitMessage({ type: DEV_HEARTBEAT_MESSAGE });
    assert.equal(runtime.stops, 1);
    assert.equal(suspends, 1);
    win.emitMessage({ type: DEV_HEARTBEAT_MESSAGE });
    assert.equal(suspends, 1);
  });
}

{
  const win = new FakeWindow();
  withFakeClock(win, () => {
    const runtime = runtimeCounters();
    let resumes = 0;

    createRuntimeCoordinator({
      isDev: false,
      win,
      start: () => runtime.start(),
      stop: () => runtime.stop(),
      onResume: () => resumes++,
    });

    win.emitMessage({ type: DEV_HEARTBEAT_MESSAGE });
    win.tick(RUNTIME_COORDINATOR_TIMING.devStaleMs - 1);
    assert.equal(runtime.starts, 0);
    assert.equal(resumes, 0);
    win.tick(1);
    assert.equal(runtime.starts, 1);
    assert.equal(resumes, 1);
  });
}

console.log("Runtime coordinator tests passed");
