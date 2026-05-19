# Store Listing

## Description

Emoji Revealer adds tooltips to emojis on any webpage, showing their official
Unicode names when you hover over them. Never wonder what an emoji means again.

Features

- Automatically detects emojis on any webpage
- Shows official Unicode names in native browser tooltips
- Supports all current Unicode emojis (faces, flags, skin tones, ZWJ sequences)
- Customizable tooltip content (emoji, name, skin tone, code points)
- Enable/disable with one click
- Lightweight with minimal performance impact

Usage

1. Install the extension
2. Hover over any emoji to see its name
3. Click the extension icon to customize tooltip content

GitHub: https://github.com/gormanity/emoji-tooltip-extension

## Search Terms

1. emoji names
2. emoji tooltip
3. emoji meanings
4. emoji identifier
5. unicode emoji
6. what is this emoji
7. emoji hover

## Edge Certification Notes

Emoji Revealer shows emoji names in tooltips when users hover over emojis on
webpages.

Basic test:

1. Install the extension.
2. Open any webpage containing emoji text, such as a page with "Hello 😀".
3. Hover over the emoji.
4. Confirm the browser tooltip shows the emoji name.

The extension has a popup with settings for enabling/disabling tooltips and
choosing tooltip content, including emoji character, name, skin tone, and Unicode
code points.

This version includes an internal compatibility improvement for development
environments where the published extension and an unpacked development build are
installed in the same browser. Normal customer-facing behavior is unchanged. No
new permissions were added.

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
