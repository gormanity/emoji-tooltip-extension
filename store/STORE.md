# Store Listing

## Description

Emoji Revealer adds tooltips to emojis on any webpage, showing their official
Unicode names when you hover over them. Never wonder what an emoji means again.

Features

- Automatically detects emojis on any webpage
- Shows official Unicode names in native browser tooltips
- Supports all 3,700+ Unicode 15.1 emojis (faces, flags, skin tones, ZWJ
  sequences)
- Customizable tooltip content (emoji, name, skin tone, code points)
- Enable/disable with one click
- Lightweight with minimal performance impact

Usage

1. Install the extension
2. Hover over any emoji to see its name
3. Click the extension icon to customize tooltip content

GitHub: https://github.com/gormanity/emoji-tooltip-extension

# Privacy Disclosures

## Single Purpose Description

Display emoji names in tooltips when hovering over emojis on webpages.

## Permission Justifications

- **storage**: Used to save user preferences for tooltip display options (which
  information to show: emoji, name, skin tone, Unicode code points) and the
  enabled/disabled state. This allows the extension to remember the user's
  settings across browser sessions.

- **host_permission (all_urls)**: The content script runs on all pages to detect
  and annotate emojis with tooltips. This broad permission is necessary because
  emojis can appear on any website. The extension only reads text content to
  find emojis and adds title attributes for tooltips. It does not collect,
  store, or transmit any page content or user data.
