#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const LOCAL_PROD_ID = "migochplggocmjacpndhoedemhcoabhc";
const DEV_ID = "klehagjocloghgoedkclniblgonaknpd";

function idFromKey(key) {
  const der = Buffer.from(key, "base64");
  const hash = createHash("sha256").update(der).digest();
  return [...hash.subarray(0, 16)]
    .map((byte) => ((byte >> 4).toString(16) + (byte & 15).toString(16)))
    .join("")
    .replace(/[0-9a-f]/g, (char) => "abcdefghijklmnop"[parseInt(char, 16)]);
}

await execFileAsync("node", ["scripts/build.mjs"]);
await execFileAsync("node", ["scripts/build.mjs", "--dev"]);

const prodManifest = JSON.parse(await readFile("dist/chrome/manifest.json"));
const devManifest = JSON.parse(
  await readFile("dist-dev/chrome/manifest.json")
);

assert.equal(idFromKey(prodManifest.key), LOCAL_PROD_ID);
assert.equal(idFromKey(devManifest.key), DEV_ID);
assert.notEqual(idFromKey(prodManifest.key), idFromKey(devManifest.key));
assert.deepEqual(prodManifest.externally_connectable, { ids: [DEV_ID] });
assert.deepEqual(devManifest.externally_connectable, {
  ids: [LOCAL_PROD_ID],
});

console.log("Build manifest ID tests passed");
