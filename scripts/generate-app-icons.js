#!/usr/bin/env node

/**
 * Generates app icon, splash icon, and Android adaptive icon assets
 * using the custom leaf image inside the circular enclosure (brand green).
 * Run: npm run generate-icons
 */

const fs = require("fs");
const path = require("path");

const root = process.cwd();
const assetsDir = path.join(root, "assets", "images");
const leafSource = path.join(assetsDir, "leaf-source.png");
const svgCircleOnly = path.join(assetsDir, "logo-circle-only.svg");
const svgGreenBg = path.join(assetsDir, "logo-hero.svg"); // reuse for green gradient bg

const SIZE = 1024;
const CIRCLE_R = 380;
const LEAF_MAX_SIZE = 560; // leaf fits inside circle with padding (slightly larger for better presence)

async function main() {
  let sharp;
  try {
    sharp = require("sharp");
  } catch {
    console.error("Missing dependency. Run: npm install --save-dev sharp");
    process.exit(1);
  }

  if (!fs.existsSync(leafSource)) {
    console.error("Leaf image not found:", leafSource);
    process.exit(1);
  }

  try {
    // Load leaf and get dimensions for aspect-ratio resize
    const leafMeta = await sharp(leafSource).metadata();
    const leafW = leafMeta.width || 1;
    const leafH = leafMeta.height || 1;
    const scale = Math.min(LEAF_MAX_SIZE / leafW, LEAF_MAX_SIZE / leafH, 1);
    const w = Math.round(leafW * scale);
    const h = Math.round(leafH * scale);
    const left = Math.round((SIZE - w) / 2);
    const top = Math.round((SIZE - h) / 2);

    const leafResized = await sharp(leafSource)
      .resize(w, h)
      .sharpen({ sigma: 0.6, m1: 1, m2: 0.5 })
      .png()
      .toBuffer();

    // 1. Green gradient background (full icon/splash) – slightly richer gradient
    const bgSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}">
      <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#2E7D32"/><stop offset="50%" stop-color="#27802C"/><stop offset="100%" stop-color="#1B5E20"/>
      </linearGradient></defs>
      <rect width="${SIZE}" height="${SIZE}" fill="url(#g)"/>
    </svg>`;
    const transparentBg = await sharp({
      create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .png()
      .toBuffer();
    const circleSvg = fs.readFileSync(svgCircleOnly);

    const circleBuffer = await sharp(Buffer.from(circleSvg))
      .resize(SIZE, SIZE)
      .png()
      .toBuffer();

    // Full icon: green bg + circle + leaf
    const fullIcon = await sharp(Buffer.from(bgSvg))
      .resize(SIZE, SIZE)
      .png()
      .toBuffer();
    await sharp(fullIcon)
      .composite([
        { input: circleBuffer, top: 0, left: 0 },
        { input: leafResized, top, left },
      ])
      .toFile(path.join(assetsDir, "icon.png"));
    console.log("Generated icon.png (1024x1024)");

    await sharp(transparentBg)
      .composite([
        { input: circleBuffer, top: 0, left: 0 },
        { input: leafResized, top, left },
      ])
      .toFile(path.join(assetsDir, "splash-icon.png"));
    console.log("Generated splash-icon.png (1024x1024) with transparent/white-friendly background");

    // 2. Android adaptive foreground: transparent bg + circle + leaf
    await sharp(transparentBg)
      .composite([
        { input: circleBuffer, top: 0, left: 0 },
        { input: leafResized, top, left },
      ])
      .toFile(path.join(assetsDir, "android-icon-foreground.png"));
    console.log("Generated android-icon-foreground.png");

    // 3. Android monochrome: white circle + white leaf (alpha from leaf, fill white)
    const leafAlpha = await sharp(leafSource)
      .resize(w, h)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const { data, info } = leafAlpha;
    const whiteLeaf = Buffer.alloc(data.length);
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      whiteLeaf[i] = 255;
      whiteLeaf[i + 1] = 255;
      whiteLeaf[i + 2] = 255;
      whiteLeaf[i + 3] = a;
    }
    const whiteLeafPng = await sharp(whiteLeaf, {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
      .png()
      .toBuffer();
    const monoCircleSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}">
      <circle cx="512" cy="512" r="380" fill="white" stroke="white" stroke-width="24"/>
    </svg>`;
    const monoCircle = await sharp(Buffer.from(monoCircleSvg))
      .resize(SIZE, SIZE)
      .png()
      .toBuffer();
    await sharp(transparentBg)
      .composite([
        { input: monoCircle, top: 0, left: 0 },
        { input: whiteLeafPng, top, left },
      ])
      .toFile(path.join(assetsDir, "android-icon-monochrome.png"));
    console.log("Generated android-icon-monochrome.png");

    // 4. Android adaptive background – solid white
    await sharp({
      create: { width: SIZE, height: SIZE, channels: 3, background: "#FFFFFF" },
    })
      .png()
      .toFile(path.join(assetsDir, "android-icon-background.png"));
    console.log("Generated android-icon-background.png (#FFFFFF)");

    // 5. Favicon
    const iconBuf = fs.readFileSync(path.join(assetsDir, "icon.png"));
    await sharp(iconBuf)
      .resize(48, 48)
      .toFile(path.join(assetsDir, "favicon.png"));
    console.log("Generated favicon.png (48x48)");

    console.log("\nDone. Icons and splash use your leaf image in the circular enclosure.");
  } catch (err) {
    console.error("Error generating icons:", err.message);
    process.exit(1);
  }
}

main();
