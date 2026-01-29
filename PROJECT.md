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
- Toggle on/off via browser action icon
- Whitelist/blacklist specific websites
- Localization for emoji names in multiple languages

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

## Release Workflow (`.github/workflows/release.yml`)

Triggered by pushing a `v*` tag:

1. Runs `npm ci && npm run build`
2. Zips `dist/` (excluding store assets and sourcemaps)
3. Creates GitHub release with the zip attached

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
