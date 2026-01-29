# <img src="src/icons/icon.svg" width="32" height="32" alt="icon"> Emoji Revealer

A browser extension that displays emoji names on hover, making it easy to
understand what any emoji means.

## Features

- Automatically detects emojis on any webpage
- Shows emoji names in native browser tooltips on hover
- Supports all Unicode 15.1 emojis (3773 emojis including skin tones, flags, and
  ZWJ sequences)
- Customizable tooltip content:
  - Emoji character
  - Official Unicode name
  - Skin tone indicator
  - Unicode code points
- Enable/disable toggle
- Minimal performance impact
- Works on Chrome and Firefox

## Installation

### Chrome

1. Download the latest release from
   [GitHub Releases](https://github.com/gormanity/emoji-tooltip-extension/releases)
2. Unzip the downloaded file
3. Open `chrome://extensions/`
4. Enable "Developer mode" in the top right
5. Click "Load unpacked" and select the unzipped folder

### Firefox

1. Download the latest release from
   [GitHub Releases](https://github.com/gormanity/emoji-tooltip-extension/releases)
2. Unzip the downloaded file
3. Open `about:debugging#/runtime/this-firefox`
4. Click "Load Temporary Add-on"
5. Select any file in the unzipped folder

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

- Node.js 18+
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
