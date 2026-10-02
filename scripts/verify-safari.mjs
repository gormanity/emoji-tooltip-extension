#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { execFileSync } from "node:child_process";

const [app, buildNumber] = process.argv.slice(2);
assert(app && buildNumber, "Usage: node scripts/verify-safari.mjs APP BUILD_NUMBER");
const version = JSON.parse(await readFile("package.json")).version;
const extension = `${app}/Contents/PlugIns/Emoji Revealer Extension.appex`;
const root = resolve(extension, "Contents/Resources");
const manifest = JSON.parse(await readFile(`${root}/manifest.json`));
assert.equal(manifest.version, version, "Manifest version must match package.json");

// Compare every shipped runtime file with the staged build, including popup dependencies.
// Store artwork and source maps are not runtime dependencies.
async function compareDirectory(directory, prefix = "") {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = `${prefix}${entry.name}`;
    if (entry.name.endsWith(".map")) continue;
    if (entry.isDirectory()) await compareDirectory(`${directory}/${entry.name}`, `${relative}/`);
    else assert.deepEqual(await readFile(`${root}/${relative}`), await readFile(`${directory}/${entry.name}`), `Missing or stale Safari resource: ${relative}`);
  }
}
await compareDirectory("dist/chrome");
const references = [
  manifest.background?.service_worker,
  ...(manifest.background?.scripts ?? []),
  manifest.action?.default_popup,
  ...Object.values(manifest.icons ?? {}),
  ...Object.values(manifest.action?.default_icon ?? {}),
  ...(manifest.content_scripts ?? []).flatMap((script) => [...(script.js ?? []), ...(script.css ?? [])]),
].filter(Boolean);
for (const reference of references) {
  const file = resolve(root, reference);
  assert(file.startsWith(root + sep), `Resource escapes bundle: ${reference}`);
  assert((await stat(file)).isFile(), `Missing manifest resource: ${reference}`);
}
for (const bundle of [app, extension]) {
  const plist = JSON.parse(execFileSync("plutil", ["-convert", "json", "-o", "-", `${bundle}/Contents/Info.plist`], { encoding: "utf8" }));
  assert.equal(plist.CFBundleShortVersionString, version, "Native version must match manifest");
  assert.equal(plist.CFBundleVersion, buildNumber, "Native build number mismatch");
}
console.log(`Safari resources and versions verified: ${version} (${buildNumber})`);
