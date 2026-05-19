# <img src="src/icons/icon.svg" width="32" height="32" alt="icon"> Emoji Revealer

A browser extension that displays emoji names on hover, making it easy to
understand what any emoji means.

## Features

- Automatically detects emojis on any webpage
- Shows emoji names in native browser tooltips on hover
- Supports all current Unicode emojis (including skin tones, flags, and ZWJ
  sequences)
- Customizable tooltip content:
  - Emoji character
  - Official Unicode name
  - Skin tone indicator
  - Unicode code points
- Enable/disable toggle
- Minimal performance impact
- Works on Chrome and Firefox

## Installation

### Browser Stores (Recommended)

<a href="https://chromewebstore.google.com/detail/emoji-revealer/kchknelooelhhnhejbncmncfnmioncmi"><img src="store/badges/chrome-web-store-badge.png" alt="Available in the Chrome Web Store" height="58"></a>
<br>
<a href="https://addons.mozilla.org/en-US/firefox/addon/emoji-revealer/"><img src="store/badges/firefox-addon-badge.svg" alt="Get the add-on for Firefox" height="58"></a>
<br>
<a href="https://microsoftedge.microsoft.com/addons/detail/emoji-revealer/elmbkcgkmmddhfgoiheglflbodcfaada"><img src="store/badges/edge-addon-badge.png" alt="Get it from Microsoft Edge Add-ons" height="58"></a>

### Manual Installation from GitHub Releases

<details>
<summary>Chrome</summary>

1. Download the latest release from
   [GitHub Releases](https://github.com/gormanity/emoji-tooltip-extension/releases)
2. Unzip the downloaded file
3. Open `chrome://extensions/`
4. Enable "Developer mode" in the top right
5. Click "Load unpacked" and select the unzipped folder

</details>

<details>
<summary>Firefox</summary>

1. Download the latest release from
   [GitHub Releases](https://github.com/gormanity/emoji-tooltip-extension/releases)
2. Unzip the downloaded file
3. Open `about:debugging#/runtime/this-firefox`
4. Click "Load Temporary Add-on"
5. Select any file in the unzipped folder

</details>

<details>
<summary>Edge</summary>

1. Download the latest release from
   [GitHub Releases](https://github.com/gormanity/emoji-tooltip-extension/releases)
2. Unzip the downloaded file
3. Open `edge://extensions/`
4. Enable "Developer mode" in the left sidebar
5. Click "Load unpacked" and select the unzipped folder

</details>

<details>
<summary>Safari (macOS)</summary>

Safari requires the extension to be bundled as a native app. Download the
Safari release (`emoji-revealer-safari-*.zip`) from
[GitHub Releases](https://github.com/gormanity/emoji-tooltip-extension/releases),
then follow Apple's instructions for
[enabling unsigned extensions](https://developer.apple.com/documentation/safariservices/safari-web-extensions/running-your-safari-web-extension#Enable-unsigned-extensions):

1. Unzip the downloaded file and move `Emoji Revealer.app` to your Applications folder
2. Open `Emoji Revealer.app` once to register the extension with Safari
3. In Safari, go to **Settings → Advanced** and enable **"Show features for web developers"**
4. Go to **Settings → Developer** and enable **"Allow unsigned extensions"**
5. Go to **Settings → Extensions**, find Emoji Revealer, and enable it

</details>

## Usage

Once installed, hover over any emoji on a webpage to see its name in a tooltip.

Click the extension icon to customize what appears in the tooltip:

- **Show emoji** - Include the emoji character itself
- **Show name** - Include the official Unicode name (enabled by default)
- **Show skin tone** - Include skin tone in the name (enabled by default)
- **Show Unicode** - Include Unicode code points

Use the toggle switch to enable or disable the extension.

## Development

### Prerequisites

- Node.js 20+
- npm

### Setup

```bash
npm install
```

### Build

```bash
npm run build
```

The built extension will be in the `dist/` directory.

### Check

```bash
npm run check
```

Runs TypeScript validation, tests, the production build, and Mozilla
Add-ons linting against `dist/firefox`.

### Watch mode

```bash
npm run watch
```

### Regenerate emoji data

```bash
npm run generate-emoji-data
```

## License

MIT
