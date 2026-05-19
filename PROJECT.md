# Emoji Revealer

A browser extension for Chrome and Firefox that displays emoji names on hover,
making it easy to understand what any emoji means.

## Project Overview

**Problem**: Emojis are increasingly used in communication, but their meanings
aren't always obvious. Users often encounter unfamiliar emojis and have to
search elsewhere to understand them.

**Solution**: A lightweight browser extension that automatically adds tooltips
to emojis on any webpage, showing the official emoji name when you hover over
them.

**Target Browsers**: Chrome and Firefox (using WebExtensions API for
cross-browser compatibility)

## Core Features

### MVP (Minimum Viable Product)

- ✅ Detect emojis on web pages automatically
- ✅ Display emoji name on hover using native browser tooltips
- ✅ Support standard Unicode emojis (faces, objects, symbols, flags)
- ✅ Minimal performance impact on page load
- ✅ Works on all websites by default

### Possible Future Enhancements (Post-MVP)

- ✅ Support for emoji sequences (skin tone modifiers, ZWJ sequences)
- ✅ Customizable tooltip content (emoji, name, skin tone, Unicode code points)
- ✅ Toggle on/off via popup

## Technical Architecture

### Extension Structure

```
emoji-revealer/
├── manifest.json          # Extension configuration
├── content-script.js      # Main logic for emoji detection
├── emoji-data.json        # Emoji Unicode → Name mapping
├── background.js          # Background service worker (optional)
├── popup/
│   ├── popup.html        # Extension popup UI (future)
│   └── popup.js          # Popup logic (future)
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

### Key Technical Components

#### 1. Emoji Detection

- Use regex with Unicode ranges to identify emoji characters
- Key Unicode blocks:
  - U+1F600–U+1F64F (Emoticons)
  - U+1F300–U+1F5FF (Misc Symbols and Pictographs)
  - U+1F680–U+1F6FF (Transport and Map)
  - U+1F900–U+1F9FF (Supplemental Symbols)
  - U+2600–U+26FF (Miscellaneous Symbols)
  - U+2700–U+27BF (Dingbats)
  - And others...

#### 2. Emoji Name Database

- Options for emoji data:
  - **Unicode CLDR** (Common Locale Data Repository) - Official names
  - **emojibase** npm package - Comprehensive emoji data
  - **emoji-datasource** - Slack/Discord emoji data
  - Custom curated JSON file
- Store as lightweight JSON: `{ "😀": "grinning face", "👍": "thumbs up" }`

#### 3. DOM Manipulation Strategy

- Walk through text nodes in the document
- Wrap detected emojis in `<span>` tags
- Add `title` attribute with emoji name
- Use MutationObserver to handle dynamically loaded content
- Optimize to avoid re-processing nodes

#### 4. Performance Considerations

- Debounce/throttle DOM processing
- Use TreeWalker for efficient text node traversal
- Process incrementally (e.g., visible viewport first)
- Cache processed nodes to avoid duplication
- Minimize emoji data file size (compress, only include essentials)

## Implementation Plan

### Phase 1: Setup & Basic Detection

- [ ] Create project structure
- [ ] Set up manifest.json for Chrome and Firefox
- [ ] Implement basic emoji regex detection
- [ ] Create minimal emoji-data.json (top 100 emojis)
- [ ] Test on simple HTML pages

### Phase 2: DOM Integration

- [ ] Implement text node traversal
- [ ] Wrap emojis in spans with title attributes
- [ ] Handle edge cases (existing spans, formatting)
- [ ] Add MutationObserver for dynamic content
- [ ] Test on real websites (Twitter, Reddit, Slack)

### Phase 3: Data & Optimization

- [ ] Expand emoji database to full Unicode set
- [ ] Optimize data file size (compression, essential names only)
- [ ] Implement performance optimizations
- [ ] Add error handling and edge case management
- [ ] Test performance on heavy pages

### Phase 4: Polish & Release

- [ ] Create extension icons
- [ ] Write user-facing README
- [ ] Add basic settings (enable/disable)
- [ ] Test cross-browser compatibility
- [ ] Package for Chrome Web Store
- [ ] Package for Firefox Add-ons
- [ ] Submit for review

## Technical Challenges & Solutions

### Challenge 1: Emoji Sequences

**Problem**: Some emojis are composed of multiple Unicode characters (e.g., 👨‍👩‍👧‍👦 =
family emoji) **Solution**: Use grapheme segmentation library or comprehensive
regex that handles ZWJ (Zero Width Joiner) sequences

### Challenge 2: Performance on Large Pages

**Problem**: Processing thousands of text nodes could slow down page load
**Solution**:

- Process visible viewport first (Intersection Observer)
- Debounce processing on scroll/resize
- Use requestIdleCallback for non-urgent processing

### Challenge 3: Breaking Existing Functionality

**Problem**: Wrapping emojis could break contenteditable, inputs, or custom
emoji handlers **Solution**:

- Skip input fields, textareas, contenteditable elements
- Use data attributes to mark processed nodes
- Make spans non-intrusive (display: inline, no styling)

## Build System (`scripts/build.mjs`)

Single Node.js script that:

1. Bundles TypeScript to JS using esbuild
2. Copies static files (manifest, HTML, CSS) to `dist/`
3. Generates PNG icons from SVG sources using sharp
4. Generates Chrome Web Store promo images from SVG sources

Watch mode (`--watch`) rebuilds on file changes.

To run the local validation suite:
- `npm run check`: Runs TypeScript validation, tests, Chrome, Edge, and Firefox builds, and Mozilla Add-ons linting against `dist/firefox`

## Development Build

A local-only development build can be triggered with the `--dev` flag. This build:

1.  **Output Directory**: Outputs to `dist-dev/chrome/` (production platform builds output to `dist/chrome/`, `dist/edge/`, and `dist/firefox/`). Store assets are output to `dist/store-assets/`.
2.  **Distinguishes the extension**: Appends ` (dev)` to the `name` in `manifest.json`.
3.  **Enables debug logging**: Sets `process.env.NODE_ENV` to `development`, allowing conditional debug logs in the source code.
4.  **Source Maps**: Ensures source maps are included for easier debugging (already enabled in standard build, but critical for dev).

To run a development build:
- `npm run build:dev`: One-time dev build
- `npm run watch:dev`: Continuous dev build with file watching

To rebuild only store assets:
- `npm run build:assets`: Rebuilds promo images in `dist/store-assets/`

To build everything:
- `npm run build:all`: Runs Chrome, Edge, Firefox, dev, and assets builds in sequence

## Dev/Prod Coexistence Details

Emoji Revealer uses hybrid dev/prod arbitration:

- The target-page runtime is still protected by the page-local
  `window.postMessage` heartbeat. Dev starts immediately, announces immediately,
  and then announces every `1000ms`. Prod waits `500ms` before active startup,
  suspends if a fresh dev heartbeat is present or appears later, and resumes
  after the dev heartbeat is stale for `3500ms`.
- The background service worker adds a cross-extension presence layer for
  Chrome-family local testing. Dev pings known prod IDs with
  `chrome.runtime.sendMessage`; prod accepts presence only from the known dev ID
  and probes dev before reporting popup/status state. This lets the prod popup,
  badge, and icon show duplicate-disabled even when no target-site tab is open.
- The only cross-extension surface is `externally_connectable`, restricted to
  explicit counterpart IDs. No `management` permission is used.

Chrome IDs:

| Build      | ID                                 | Folder / source                    |
| ---------- | ---------------------------------- | ---------------------------------- |
| Local prod | `migochplggocmjacpndhoedemhcoabhc` | `dist/chrome` from `npm run build` |
| Store prod | Unknown                            | Not configured in this repo        |
| Local dev  | `klehagjocloghgoedkclniblgonaknpd` | `dist-dev/chrome` from `npm run build:dev` |

For local coexistence testing, load both unpacked folders in Chrome:

- Prod: `dist/chrome`
- Dev: `dist-dev/chrome`

Prod suspension calls the content runtime teardown path. That removes
extension-owned storage listeners, DOM observers, pending editable-tooltip
animation frames, wrapped tooltip spans, image tooltip attributes, and floating
tooltip UI. The page-local message listener and heartbeat timers are owned by
the runtime coordinator and are removed when the coordinator itself stops.

Known risks:

- There is an intentional stale-timeout window of up to `3500ms` before prod
  re-enables after dev disappears.
- Loading the same folder twice can bypass the intended local prod/dev ID split.
- The Chrome Web Store production ID is unknown until configured; the dev build
  currently targets only the fixed local prod ID.

## Release Workflow (`.github/workflows/release.yml`)

Triggered by pushing a `v*` tag:

1. Runs `npm ci` and builds Chrome, Edge, and Firefox packages
2. Runs Mozilla Add-ons linting against `dist/firefox`
3. Zips each platform package, excluding sourcemaps
4. Creates a GitHub release with Chrome, Edge, Firefox, and Safari assets attached

## Resources

- [Chrome Extension Documentation](https://developer.chrome.com/docs/extensions/)
- [Firefox Extension Documentation](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions)
- [Unicode Emoji List](https://unicode.org/emoji/charts/full-emoji-list.html)
- [CLDR Emoji Annotations](https://github.com/unicode-org/cldr)
- [WebExtensions API](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API)

## License & Distribution

- **License**: MIT (open source)
- **Distribution Platforms**:
  - Chrome Web Store
  - Firefox Add-ons
  - GitHub Releases (for manual installation)
