#!/usr/bin/env node

/**
 * Generates emoji-data.json from Unicode CLDR annotations
 *
 * Sources:
 * - Unicode emoji-test.txt for emoji sequences
 * - CLDR annotations for English names
 */

import * as fs from "fs/promises";
import * as path from "path";
import * as https from "https";

const EMOJI_TEST_URL = "https://unicode.org/Public/emoji/15.1/emoji-test.txt";
const OUTPUT_PATH = path.join("src", "emoji-data.json");

/**
 * Fetch a URL using https module (more reliable than fetch in Node)
 */
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        httpsGet(res.headers.location).then(resolve).catch(reject);
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }

      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
      res.on("error", reject);
    }).on("error", reject);
  });
}

/**
 * Fetch the Unicode emoji-test.txt file
 */
async function fetchEmojiTest() {
  console.log("Fetching emoji-test.txt from Unicode...");
  return httpsGet(EMOJI_TEST_URL);
}

/**
 * Convert space-separated hex code points to an emoji string
 * e.g., "1F600" -> "😀" or "1F469 200D 1F4BB" -> "👩‍💻"
 */
function codePointsToEmoji(codePointsStr) {
  return codePointsStr
    .trim()
    .split(/\s+/)
    .map((hex) => String.fromCodePoint(parseInt(hex, 16)))
    .join("");
}

/**
 * Parse emoji-test.txt and extract emoji with names
 * Format: code_points ; status # emoji E version name
 */
function parseEmojiTest(text) {
  const emojis = {};
  const lines = text.split("\n");

  for (const line of lines) {
    // Skip comments and empty lines (but parse the data lines)
    if (line.startsWith("#") || !line.trim()) continue;

    // Match: 1F600 ; fully-qualified # 😀 E1.0 grinning face
    const match = line.match(
      /^([0-9A-F ]+)\s*;\s*(fully-qualified|component)\s*#\s*\S+\s+E[\d.]+\s+(.+)$/i
    );

    if (match) {
      const [, codePointsHex, status, name] = match;

      // Only include fully-qualified emojis (skip components like skin tones alone)
      if (status.toLowerCase() === "fully-qualified") {
        // Construct emoji from code points (more reliable than extracting visual)
        const emoji = codePointsToEmoji(codePointsHex);
        emojis[emoji] = name.trim();
      }
    }
  }

  return emojis;
}

/**
 * Sort emojis by their Unicode code points for consistent output
 */
function sortEmojis(emojis) {
  const entries = Object.entries(emojis);
  entries.sort((a, b) => {
    const codeA = [...a[0]].map((c) => c.codePointAt(0)).join(",");
    const codeB = [...b[0]].map((c) => c.codePointAt(0)).join(",");
    return codeA.localeCompare(codeB);
  });
  return Object.fromEntries(entries);
}

async function main() {
  try {
    const text = await fetchEmojiTest();
    console.log("Parsing emoji data...");

    const emojis = parseEmojiTest(text);
    const sorted = sortEmojis(emojis);
    const count = Object.keys(sorted).length;

    console.log(`Found ${count} emojis`);

    // Write to file with nice formatting
    const json = JSON.stringify(sorted, null, 2);
    await fs.writeFile(OUTPUT_PATH, json + "\n");

    console.log(`Written to ${OUTPUT_PATH}`);

    // Print file size
    const stats = await fs.stat(OUTPUT_PATH);
    const sizeKb = (stats.size / 1024).toFixed(1);
    console.log(`File size: ${sizeKb} KB`);
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

main();
