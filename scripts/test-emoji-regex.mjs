#!/usr/bin/env node

/**
 * Tests that the emoji regex can match all emojis in our database
 */

import * as fs from "fs/promises";

// The regex from content-script.ts - keep in sync!
// Handles: basic emojis, ZWJ sequences, skin tones, flags, keycaps, subdivision flags
const EMOJI_REGEX =
  /(?:(?:\p{Regional_Indicator}){2}|[#*0-9]\uFE0F?\u20E3|(?:\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Emoji})(?:\uFE0F)?(?:\p{Emoji_Modifier})?(?:[\u{E0020}-\u{E007F}]+)?(?:\u200D(?:\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Emoji})(?:\uFE0F)?(?:\p{Emoji_Modifier})?(?:[\u{E0020}-\u{E007F}]+)?)*)/gu;

async function main() {
  const data = await fs.readFile("src/emoji-data.json", "utf-8");
  const emojis = Object.keys(JSON.parse(data));

  let passed = 0;
  let failed = 0;
  const failures = [];

  for (const emoji of emojis) {
    // Reset regex state
    EMOJI_REGEX.lastIndex = 0;

    // Test if the emoji matches
    const matches = emoji.match(EMOJI_REGEX);

    if (matches && matches[0] === emoji) {
      passed++;
    } else {
      failed++;
      failures.push({
        emoji,
        codePoints: [...emoji]
          .map((c) => "U+" + c.codePointAt(0).toString(16).toUpperCase())
          .join(" "),
        matched: matches ? matches[0] : null,
      });
    }
  }

  console.log(`\nEmoji Regex Test Results`);
  console.log(`========================`);
  console.log(`Total: ${emojis.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  const passRate = ((passed / emojis.length) * 100).toFixed(2);
  console.log(`Pass rate: ${passRate}%`);

  if (failures.length > 0) {
    console.log(`\nFailures:`);
    for (const f of failures.slice(0, 20)) {
      console.log(`  ${f.emoji} (${f.codePoints})`);
      if (f.matched) {
        console.log(`    Partial match: "${f.matched}"`);
      }
    }

    if (failures.length > 20) {
      console.log(`  ... and ${failures.length - 20} more`);
    }

    process.exit(1);
  }

  console.log(`\nAll emojis matched successfully!`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
