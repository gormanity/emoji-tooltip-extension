#!/usr/bin/env node

import * as esbuild from "esbuild";
import * as fs from "fs/promises";
import * as path from "path";
import sharp from "sharp";

const watchMode = process.argv.includes("--watch");
const devMode = process.argv.includes("--dev");
const edgeMode = process.argv.includes("--edge");
const firefoxMode = process.argv.includes("--firefox");
const assetsOnly = process.argv.includes("--assets");

const CHROMIUM_LOCAL_PROD_KEY =
  "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAon169A6gYoRLLlMDTc++/JrmOUyoiNTkCbqk7TBL6rkzBFxQ3V96hBf9xqGGx+oH3aq9uxtGiu+6vFCTx+mhzUw48fuqxWYbe8wK+tsv/1V63dirfpS5KpA0alZgpSu7yH2b4mZNDAom8cfnXyKV+y3yZ5xGdOSD4eOKbIV67An275ij8DTNkZtH8Z3/VAPDQJthLuIRL/OfhGG80oZmNgY/i/j6+VmXP6uaRcFNjHMXl5YjA3k7uesNrQpxUwvTPE03LXK9RQkjfokZjJEayQ5NjDyf5PB+RHBbP3r6y5eTDHU8BD1KvXAyFM6k3lrvj0+AsrRRz1CWvJJz8oIOYwIDAQAB";
const CHROMIUM_DEV_KEY =
  "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEApozcgbq3S9QZzI7CEn0l1qXG34ecA3MjK8sU7NYNW2L9EsInV9ZgkKeSomJ0nRXti+OVBRD9BVcwVeliuEgCJ4GQV51R9a1hbwdPC72B/+R6CVYa4Lm4SI2D4niGu2BVfDnXQIgi70plcuN5FirtVSkEkrAjIYb/boYSZrHNooSuz5nrScrAwdzJRkBjUJ+xBJ2tOVYmtFyg2W6vAbknBabNwL2mtuK/AAt1JeQ3e0ZlVO2xdjlOL5jq7o3Wb7E1PTiBVuBEgiRpEYEIirmxVsgRg7oSnfEe1bgoTK5Izkb7MTuvIh6V06nNU01tqnTM+GWQSnus7f4ENJzDi+EkDQIDAQAB";
const CHROMIUM_LOCAL_PROD_EXTENSION_ID = "migochplggocmjacpndhoedemhcoabhc";
const CHROMIUM_STORE_PROD_EXTENSION_ID = null;
const CHROMIUM_DEV_EXTENSION_ID = "klehagjocloghgoedkclniblgonaknpd";

const SRC_DIR = "src";
const DIST_DIR = devMode
  ? firefoxMode
    ? "dist-dev/firefox"
    : edgeMode
      ? "dist-dev/edge"
      : "dist-dev/chrome"
  : firefoxMode
    ? "dist/firefox"
    : edgeMode
      ? "dist/edge"
      : "dist/chrome";
const STORE_DIR = "store";
const STORE_ASSETS_DIST = "dist/store-assets";
const ICONS_DIR = path.join(SRC_DIR, "icons");
const ICON_SIZES = [16, 32, 48, 128, 300];
const PROMO_SIZES = [
  { name: "promo-small", width: 440, height: 280 },
  { name: "promo-large", width: 920, height: 680 },
  { name: "promo-marquee", width: 1400, height: 560 },
];

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
      if (file === "manifest.json") {
        const manifest = JSON.parse(await fs.readFile(src, "utf8"));

        if (devMode) {
          manifest.name += " (dev)";
        }

        if (firefoxMode) {
          manifest.background = {
            ...manifest.background,
            scripts: [manifest.background.service_worker],
          };
          delete manifest.background.service_worker;
          if (devMode && manifest.browser_specific_settings?.gecko?.id) {
            manifest.browser_specific_settings.gecko.id =
              "emoji-revealer-dev@gormanity";
          }
        } else {
          const prodIds = [
            CHROMIUM_LOCAL_PROD_EXTENSION_ID,
            CHROMIUM_STORE_PROD_EXTENSION_ID,
          ].filter(Boolean);
          manifest.key = devMode ? CHROMIUM_DEV_KEY : CHROMIUM_LOCAL_PROD_KEY;
          manifest.externally_connectable = {
            ids: devMode ? prodIds : [CHROMIUM_DEV_EXTENSION_ID],
          };
        }

        await fs.writeFile(dest, JSON.stringify(manifest, null, 2));
        console.log(`Copied and modified ${file}`);
      } else {
        await fs.copyFile(src, dest);
        console.log(`Copied ${file}`);
      }
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

    await sharp(svgBuffer)
      .resize(size, size)
      .grayscale()
      .modulate({ brightness: 0.72 })
      .png()
      .toFile(path.join(iconsDistDir, `icon-off${size}.png`));
    console.log(`Generated icon-off${size}.png`);
  }
}

async function generatePromoImages() {
  const promoDir = path.join(STORE_DIR, "promo");
  const promoDistDir = STORE_ASSETS_DIST;

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

async function findTypeScriptFiles(dir, base = "") {
  const entries = [];
  const files = await fs.readdir(dir, { withFileTypes: true });

  for (const file of files) {
    const relativePath = path.join(base, file.name);
    const fullPath = path.join(dir, file.name);

    if (file.isDirectory() && !file.name.startsWith(".")) {
      entries.push(...(await findTypeScriptFiles(fullPath, relativePath)));
    } else if (file.name.endsWith(".ts") && !file.name.endsWith(".d.ts")) {
      entries.push({ fullPath, relativePath });
    }
  }

  return entries;
}

async function bundleTypeScript() {
  // Find all TypeScript entry points recursively
  const tsFiles = await findTypeScriptFiles(SRC_DIR);

  if (tsFiles.length === 0) {
    console.log("No TypeScript files found to bundle");
    return null;
  }

  const entryPoints = tsFiles.map((f) => f.fullPath);

  const buildOptions = {
    entryPoints,
    bundle: true,
    outdir: DIST_DIR,
    outbase: SRC_DIR,
    format: "iife",
    target: ["chrome90", "firefox90"],
    sourcemap: true,
    logLevel: "info",
    define: {
      __DEV__: JSON.stringify(devMode),
      "process.env.NODE_ENV": JSON.stringify(
        devMode ? "development" : "production"
      ),
    },
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
  if (assetsOnly) {
    console.log("Building store assets...\n");
    await generatePromoImages();
    console.log("\nStore assets build complete!");
    return;
  }

  console.log("Building extension...\n");

  await ensureDir(DIST_DIR);

  await Promise.all([
    copyStaticFiles(),
    generateIcons(),
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
