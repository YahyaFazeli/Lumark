#!/usr/bin/env node
/**
 * Cross-Platform Icon Generation Script for Lumark (Wails v3).
 *
 * Replaces system-dependent C-library rasterization (librsvg/cairo) with @resvg/resvg-js.
 * Works seamlessly across Linux, Windows, and macOS runners.
 *
 * Source assets: build/icons-src/
 * Outputs:
 * - App Icon: Colored logo without background -> build/appicon.png (1024x1024), windows/icon.ico, darwin/icons.icns
 * - Document Icon: White logo with dark background -> build/document.png (1024x1024), windows/document.ico, darwin/document.icns
 * - System Tray Icon: White logo without background -> build/trayicon.png (32x32)
 * - Favicon: Colored logo with dark background -> frontend/public/favicon.svg
 * - Fallback Wails Icon: build/icons-src/icon-color-bg.svg -> frontend/public/wails.png (256x256)
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const BUILD_DIR = path.join(ROOT_DIR, 'build');
const ICONS_SRC_DIR = path.join(BUILD_DIR, 'icons-src');
const FRONTEND_DIR = path.join(ROOT_DIR, 'frontend');

// Dynamically resolve @resvg/resvg-js from frontend/node_modules, root node_modules, or NODE_PATH
function loadResvg() {
  try {
    return require('@resvg/resvg-js').Resvg;
  } catch (err1) {
    try {
      return require(path.resolve(FRONTEND_DIR, 'node_modules', '@resvg/resvg-js')).Resvg;
    } catch (err2) {
      try {
        return require(path.resolve(ROOT_DIR, 'node_modules', '@resvg/resvg-js')).Resvg;
      } catch (err3) {
        console.error('\n[ERROR] Failed to load @resvg/resvg-js.');
        console.error('Please ensure frontend dependencies are installed by running:');
        console.error('  npm --prefix frontend install (or npm ci in frontend/)\n');
        process.exit(1);
      }
    }
  }
}

const Resvg = loadResvg();

/**
 * Render an SVG centered with padding into a target canvas size.
 */
function renderCenteredSvg({ svgContent, outPath, canvasW, canvasH, targetW, targetH, viewBox }) {
  const x = (canvasW - targetW) / 2;
  const y = (canvasH - targetH) / 2;
  const inner = svgContent.replace(/<svg[^>]*>|<\/svg>/g, '');
  const wrapped = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasW}" height="${canvasH}" viewBox="0 0 ${canvasW} ${canvasH}">
  <svg x="${x}" y="${y}" width="${targetW}" height="${targetH}" viewBox="${viewBox}">
    ${inner}
  </svg>
</svg>`;

  const resvg = new Resvg(wrapped, {
    fitTo: { mode: 'width', value: canvasW },
  });
  const pngData = resvg.render().asPng();
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, pngData);
  console.log(`  [OK] Rendered ${path.relative(ROOT_DIR, outPath)} (${canvasW}x${canvasH})`);
}

/**
 * Render a square SVG directly to a square PNG.
 */
function renderSquareSvg({ svgContent, outPath, size }) {
  const resvg = new Resvg(svgContent, {
    fitTo: { mode: 'width', value: size },
  });
  const pngData = resvg.render().asPng();
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, pngData);
  console.log(`  [OK] Rendered ${path.relative(ROOT_DIR, outPath)} (${size}x${size})`);
}

/**
 * Check if a command is executable on PATH.
 */
function isCommandAvailable(cmd) {
  try {
    const isWin = process.platform === 'win32';
    execFileSync(cmd, ['--help'], {
      stdio: 'pipe',
      shell: isWin,
    });
    return true;
  } catch (err) {
    // If the process ran and exited (even with non-zero or error), command exists
    return err.code !== 'ENOENT';
  }
}

/**
 * Run wails3 generate icons to create Windows .ico and macOS .icns files.
 */
function generateWailsIcons() {
  const isWin = process.platform === 'win32';
  const wailsBin = isWin ? 'wails3.exe' : 'wails3';

  if (!isCommandAvailable(wailsBin)) {
    console.warn('\n[WARN] \'wails3\' command not found on PATH. Skipping .ico and .icns generation.');
    console.warn('Install Wails CLI via: go install github.com/wailsapp/wails/v3/cmd/wails3@v3.0.0-beta.34\n');
    return;
  }

  console.log('Generating Windows .ico and macOS .icns for App Icon...');
  execFileSync(wailsBin, [
    'generate', 'icons',
    '-input', 'appicon.png',
    '-macfilename', 'darwin/icons.icns',
    '-windowsfilename', 'windows/icon.ico',
    '-iconcomposerinput', 'appicon.icon',
    '-macassetdir', 'darwin',
  ], {
    cwd: BUILD_DIR,
    stdio: 'inherit',
    shell: isWin,
  });

  console.log('Generating Windows document.ico and macOS document.icns for Document Icon...');
  execFileSync(wailsBin, [
    'generate', 'icons',
    '-input', 'document.png',
    '-macfilename', 'darwin/document.icns',
    '-windowsfilename', 'windows/document.ico',
  ], {
    cwd: BUILD_DIR,
    stdio: 'inherit',
    shell: isWin,
  });
}

function main() {
  console.log('Generating Lumark icons from build/icons-src/ (cross-platform @resvg/resvg-js)...');

  const skipWails = process.argv.includes('--skip-wails');

  // 1. App Icon: Colored SVG without background -> build/appicon.png (1024x1024 with padding)
  const iconColorSvgPath = path.join(ICONS_SRC_DIR, 'icon-color.svg');
  const iconColorSvg = fs.readFileSync(iconColorSvgPath, 'utf8');
  const appiconPng = path.join(BUILD_DIR, 'appicon.png');
  // viewBox: 158 144 395 421 -> aspect ratio 395 / 421
  const appTargetH = 840;
  const appTargetW = 840 * (395 / 421);
  renderCenteredSvg({
    svgContent: iconColorSvg,
    outPath: appiconPng,
    canvasW: 1024,
    canvasH: 1024,
    targetW: appTargetW,
    targetH: appTargetH,
    viewBox: '158 144 395 421',
  });

  // 2. Document Icon: Colored SVG with dark background tile -> build/document.png (1024x1024 square tile)
  const iconColorBgSvgPath = path.join(ICONS_SRC_DIR, 'icon-color-bg.svg');
  const iconColorBgSvg = fs.readFileSync(iconColorBgSvgPath, 'utf8');
  const documentPng = path.join(BUILD_DIR, 'document.png');
  renderSquareSvg({
    svgContent: iconColorBgSvg,
    outPath: documentPng,
    size: 1024,
  });

  // 3. System Tray Icon: White SVG without background -> build/trayicon.png (32x32)
  const iconWhiteSvgPath = path.join(ICONS_SRC_DIR, 'icon-white.svg');
  const iconWhiteSvg = fs.readFileSync(iconWhiteSvgPath, 'utf8');
  const trayiconPng = path.join(BUILD_DIR, 'trayicon.png');
  const trayTargetH = 26;
  const trayTargetW = 26 * (395 / 421);
  renderCenteredSvg({
    svgContent: iconWhiteSvg,
    outPath: trayiconPng,
    canvasW: 32,
    canvasH: 32,
    targetW: trayTargetW,
    targetH: trayTargetH,
    viewBox: '158 144 395 421',
  });

  // 4. Favicon: Colored SVG with dark background -> frontend/public/favicon.svg
  const faviconSvg = path.join(FRONTEND_DIR, 'public', 'favicon.svg');
  fs.copyFileSync(iconColorBgSvgPath, faviconSvg);
  console.log(`  [OK] Copied ${path.relative(ROOT_DIR, faviconSvg)}`);

  // Fallback wails.png
  const wailsPng = path.join(FRONTEND_DIR, 'public', 'wails.png');
  renderSquareSvg({
    svgContent: iconColorBgSvg,
    outPath: wailsPng,
    size: 256,
  });

  // 5. Wails Icon Generation (.ico & .icns)
  if (!skipWails) {
    generateWailsIcons();
  }

  console.log('Icon generation completed successfully.');
}

if (require.main === module) {
  main();
}
