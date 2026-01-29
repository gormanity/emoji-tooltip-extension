#!/usr/bin/env node

import * as esbuild from "esbuild";
import * as fs from "fs/promises";
import * as path from "path";
import sharp from "sharp";

const SRC_DIR = "src";
const DIST_DIR = "dist";
const ICONS_DIR = path.join(SRC_DIR, "icons");
const ICON_SIZES = [16, 32, 48, 128];
const PROMO_SIZES = [
  { name: "promo-small", width: 440, height: 280 },
  { name: "promo-large", width: 920, height: 680 },
  { name: "promo-marquee", width: 1400, height: 560 },
];

const watchMode = process.argv.includes("--watch");

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function copyStaticFiles() {
  const staticFiles = ["manifest.json"];
  const staticDirs = ["popup"];

  for (const file of staticFiles) {
    const src = path.join(SRC_DIR, file);
    const dest = path.join(DIST_DIR, file);
    try {
      await fs.copyFile(src, dest);
      console.log(`Copied ${file}`);
    } catch (err) {
      if (err.code !== "ENOENT") throw err;
    }
  }

  for (const dir of staticDirs) {
    const src = path.join(SRC_DIR, dir);
    const dest = path.join(DIST_DIR, dir);
    try {
      const entries = await fs.readdir(src);
      await ensureDir(dest);
      for (const entry of entries) {
        if (entry.endsWith(".html") || entry.endsWith(".css")) {
          await fs.copyFile(path.join(src, entry), path.join(dest, entry));
          console.log(`Copied ${dir}/${entry}`);
        }
      }
    } catch (err) {
      if (err.code !== "ENOENT") throw err;
    }
  }
}

async function generateIcons() {
  const iconSvg = path.join(ICONS_DIR, "icon.svg");
  const iconsDistDir = path.join(DIST_DIR, "icons");

  try {
    await fs.access(iconSvg);
  } catch {
    console.log("No icon.svg found, skipping icon generation");
    return;
  }

  await ensureDir(iconsDistDir);
  const svgBuffer = await fs.readFile(iconSvg);

  for (const size of ICON_SIZES) {
    const outputPath = path.join(iconsDistDir, `icon${size}.png`);
    await sharp(svgBuffer).resize(size, size).png().toFile(outputPath);
    console.log(`Generated icon${size}.png`);
  }
}

async function generatePromoImages() {
  const promoDir = path.join(ICONS_DIR, "promo");
  const promoDistDir = path.join(DIST_DIR, "store-assets");

  try {
    await fs.access(promoDir);
  } catch {
    console.log("No promo directory found, skipping promo image generation");
    return;
  }

  await ensureDir(promoDistDir);

  for (const promo of PROMO_SIZES) {
    const svgPath = path.join(promoDir, `${promo.name}.svg`);
    try {
      const svgBuffer = await fs.readFile(svgPath);
      const outputPath = path.join(promoDistDir, `${promo.name}.png`);
      await sharp(svgBuffer)
        .resize(promo.width, promo.height)
        .png()
        .toFile(outputPath);
      console.log(`Generated ${promo.name}.png`);
    } catch (err) {
      if (err.code !== "ENOENT") throw err;
    }
  }
}

async function copyEmojiData() {
  const src = path.join(SRC_DIR, "emoji-data.json");
  const dest = path.join(DIST_DIR, "emoji-data.json");
  try {
    await fs.copyFile(src, dest);
    console.log("Copied emoji-data.json");
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
}

async function bundleTypeScript() {
  const entryPoints = [];

  // Find TypeScript entry points
  const srcFiles = await fs.readdir(SRC_DIR);
  for (const file of srcFiles) {
    if (file.endsWith(".ts") && !file.endsWith(".d.ts")) {
      entryPoints.push(path.join(SRC_DIR, file));
    }
  }

  if (entryPoints.length === 0) {
    console.log("No TypeScript files found to bundle");
    return null;
  }

  const buildOptions = {
    entryPoints,
    bundle: true,
    outdir: DIST_DIR,
    format: "iife",
    target: ["chrome90", "firefox90"],
    sourcemap: true,
    logLevel: "info",
  };

  if (watchMode) {
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    console.log("Watching for changes...");
    return ctx;
  } else {
    await esbuild.build(buildOptions);
    return null;
  }
}

async function build() {
  console.log("Building extension...\n");

  await ensureDir(DIST_DIR);

  await Promise.all([
    copyStaticFiles(),
    generateIcons(),
    generatePromoImages(),
    copyEmojiData(),
  ]);

  const ctx = await bundleTypeScript();

  if (!watchMode) {
    console.log("\nBuild complete!");
  }

  return ctx;
}

build().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
