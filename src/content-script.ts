// Emoji Revealer - Content Script
// Detects emojis on web pages and adds tooltips with their names

import emojiDataFile from "./emoji-data.json";
import { createRuntimeCoordinator } from "./runtime-coordinator";

const RUNTIME_STATE_MESSAGE = "emoji-revealer:runtime-state";

// Tooltip options interface (must match popup/popup.ts)
interface TooltipOptions {
  enabled: boolean;
  showEmoji: boolean;
  showName: boolean;
  showCodePoints: boolean;
  showSkinTone: boolean;
  showInEditableAreas: boolean;
}

const DEFAULT_OPTIONS: TooltipOptions = {
  enabled: true,
  showEmoji: false,
  showName: true,
  showCodePoints: false,
  showSkinTone: true,
  showInEditableAreas: false,
};

// Current options (loaded from storage)
let currentOptions: TooltipOptions = { ...DEFAULT_OPTIONS };

type Cleanup = () => void;
let runtimeActive = false;
let runtimeStartId = 0;
let runtimeCleanups: Cleanup[] = [];

// Emoji regex that matches Unicode emojis including:
// - Emoji_Presentation: emojis that render as emoji by default
// - Extended_Pictographic: broader pictographic characters
// - Emoji + FE0F: text symbols rendered as emoji with variation selector
// - Emoji_Modifier: skin tone modifiers (U+1F3FB-U+1F3FF)
// - ZWJ sequences: multiple emojis joined with U+200D
// - Regional indicators: flag sequences (two-letter country codes)
// - Keycap sequences: #️⃣, 0️⃣-9️⃣, *️⃣
// - Tag sequences: subdivision flags (England, Scotland, Wales)
const EMOJI_REGEX =
  /(?:(?:\p{Regional_Indicator}){2}|[#*0-9]\uFE0F?\u20E3|(?:\p{Extended_Pictographic}|\p{Emoji_Presentation})(?:\uFE0F)?(?:\p{Emoji_Modifier})?(?:[\u{E0020}-\u{E007F}]+)?(?:\u200D(?:\p{Extended_Pictographic}|\p{Emoji_Presentation})(?:\uFE0F)?(?:\p{Emoji_Modifier})?(?:[\u{E0020}-\u{E007F}]+)?)*)/gu;

// Data attribute to mark processed spans
const PROCESSED_ATTR = "data-emoji-revealer";
const RUNTIME_OWNER = __DEV__ ? "dev" : "prod";

// Elements to skip when processing
const SKIP_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "TEXTAREA",
  "INPUT",
  "NOSCRIPT",
  "IFRAME",
  "OBJECT",
  "EMBED",
  "SVG",
  "CANVAS",
  "CODE",
  "PRE",
  "VIDEO",
  "AUDIO",
  "SELECT",
  "OPTION",
]);

// Cast emoji data to a typed record
const emojiNames = (emojiDataFile as { version: string; emojis: Record<string, string> }).emojis;

// Build normalized lookup (strip FE0F) for emojis that may appear without variation selectors
const normalizedEmojiNames: Record<string, string> = {};
for (const [emoji, name] of Object.entries(emojiNames)) {
  const normalized = emoji.replace(/\uFE0F/g, "");
  if (!normalizedEmojiNames[normalized]) {
    normalizedEmojiNames[normalized] = name;
  }
}

// Data attribute to store the emoji character for reformatting
const EMOJI_CHAR_ATTR = "data-emoji-char";

/**
 * Get code points string for an emoji
 */
function getCodePoints(emoji: string): string {
  return [...emoji]
    .map((char) => "U+" + char.codePointAt(0)!.toString(16).toUpperCase())
    .join(" ");
}

/**
 * Strip skin tone suffix from emoji name
 * e.g., "raised back of hand: medium-dark skin tone" -> "raised back of hand"
 */
function stripSkinTone(name: string): string {
  return name.replace(/: (light|medium-light|medium|medium-dark|dark) skin tone$/, "");
}

/**
 * Format tooltip text based on current options
 */
function formatTooltip(emoji: string, name: string): string {
  const parts: string[] = [];

  if (currentOptions.showEmoji) {
    parts.push(emoji);
  }

  if (currentOptions.showName) {
    // Strip skin tone from name if option is disabled
    const displayName = currentOptions.showSkinTone ? name : stripSkinTone(name);
    parts.push(displayName);
  }

  if (currentOptions.showCodePoints) {
    parts.push(`(${getCodePoints(emoji)})`);
  }

  return parts.join(" ") || name; // Fallback to name if nothing selected
}

/**
 * Load options from storage
 */
function loadOptions(): Promise<TooltipOptions> {
  return new Promise((resolve) => {
    if (typeof chrome !== "undefined" && chrome.storage?.sync) {
      chrome.storage.sync.get(DEFAULT_OPTIONS, (result) => {
        resolve(result as TooltipOptions);
      });
    } else {
      resolve(DEFAULT_OPTIONS);
    }
  });
}

/**
 * Update all existing emoji tooltips with new formatting
 */
function updateAllTooltips(): void {
  const spans = document.querySelectorAll(
    `[${PROCESSED_ATTR}="${RUNTIME_OWNER}"][${EMOJI_CHAR_ATTR}]`
  );
  for (const span of spans) {
    const emoji = span.getAttribute(EMOJI_CHAR_ATTR);
    if (emoji) {
      const name = getEmojiName(emoji);
      if (name) {
        span.setAttribute("title", formatTooltip(emoji, name));
      }
    }
  }
}

/**
 * Remove all emoji tooltips (unwrap spans back to text, or remove title from img),
 * and hide the floating tooltip if visible.
 */
function removeAllTooltips(): void {
  hideFloatingTooltip();
  const elements = document.querySelectorAll(
    `[${PROCESSED_ATTR}="${RUNTIME_OWNER}"]`
  );
  for (const el of elements) {
    if (el.tagName === "IMG") {
      el.removeAttribute("title");
      el.removeAttribute(PROCESSED_ATTR);
      el.removeAttribute(EMOJI_CHAR_ATTR);
    } else {
      const text = el.textContent;
      if (text && el.parentNode) {
        const textNode = document.createTextNode(text);
        el.parentNode.replaceChild(textNode, el);
      }
    }
  }
}

/**
 * Process an <img> element that may represent an emoji (e.g., Gmail).
 * Checks for emoji in data-emoji or alt attributes and adds a title tooltip.
 */
function processEmojiImg(img: HTMLImageElement): void {
  if (img.hasAttribute(PROCESSED_ATTR)) return;
  if (hasEditableAncestor(img)) return;

  const emoji = img.getAttribute("data-emoji") ?? img.getAttribute("alt");
  if (!emoji) return;

  const name = getEmojiName(emoji);
  if (!name) return;

  img.setAttribute(PROCESSED_ATTR, RUNTIME_OWNER);
  img.setAttribute(EMOJI_CHAR_ATTR, emoji);
  img.setAttribute("title", formatTooltip(emoji, name));
}

/**
 * Check if an element should be skipped during processing
 */
function shouldSkipElement(element: Element): boolean {
  if (SKIP_TAGS.has(element.tagName)) {
    return true;
  }

  // Skip contenteditable elements
  if (element.hasAttribute("contenteditable")) {
    const value = element.getAttribute("contenteditable");
    if (value !== "false") {
      return true;
    }
  }

  // Skip elements we've already processed
  if (element.hasAttribute(PROCESSED_ATTR)) {
    return true;
  }

  // Skip elements hidden from accessibility tree
  if (element.getAttribute("aria-hidden") === "true") {
    return true;
  }

  // Skip custom text input roles
  const role = element.getAttribute("role");
  if (role === "textbox" || role === "searchbox") {
    return true;
  }

  return false;
}

/**
 * Check if any ancestor is editable or should be skipped
 */
function hasEditableAncestor(node: Node): boolean {
  let current = node.parentElement;
  while (current && current !== document.body) {
    if (current.hasAttribute("contenteditable")) {
      const value = current.getAttribute("contenteditable");
      if (value !== "false") {
        return true;
      }
    }
    const role = current.getAttribute("role");
    if (role === "textbox" || role === "searchbox") {
      return true;
    }
    current = current.parentElement;
  }
  return false;
}

// Regex for characters with default emoji presentation (render as emoji without FE0F)
const EMOJI_PRESENTATION_RE = /^\p{Emoji_Presentation}$/u;

/**
 * Check if a matched string is a single text-default character — an
 * Extended_Pictographic code point used as plain text (no FE0F variation
 * selector). Characters like ♪ (U+266A), ☆ (U+2606), etc. are matched by
 * the emoji regex but are not actual emojis unless followed by FE0F.
 */
function isTextDefaultChar(emoji: string): boolean {
  // Only applies to single code points without FE0F
  const codePoints = [...emoji];
  if (codePoints.length !== 1) return false;
  // If it has default emoji presentation, it's a real emoji
  if (EMOJI_PRESENTATION_RE.test(emoji)) return false;
  return true;
}

/**
 * Get the emoji name from our database
 */
function getEmojiName(emoji: string): string | null {
  // Try exact match first
  if (emojiNames[emoji]) {
    return emojiNames[emoji];
  }

  // Try normalized lookup (handles FE0F anywhere in the sequence)
  const normalized = emoji.replace(/\uFE0F/g, "");
  if (normalizedEmojiNames[normalized]) {
    return normalizedEmojiNames[normalized];
  }

  return null;
}

/**
 * Process a text node and wrap emojis in spans with tooltips
 */
function processTextNode(textNode: Text): void {
  const text = textNode.textContent;
  if (!text) return;

  // Skip if inside an editable area
  if (hasEditableAncestor(textNode)) {
    return;
  }

  // Reset regex state
  EMOJI_REGEX.lastIndex = 0;

  const matches: Array<{ emoji: string; index: number }> = [];
  let match: RegExpExecArray | null;

  while ((match = EMOJI_REGEX.exec(text)) !== null) {
    const emoji = match[0];
    const name = getEmojiName(emoji);
    if (name) {
      matches.push({ emoji, index: match.index });
    } else if (!isTextDefaultChar(emoji)) {
      // Only warn for sequences that look like real emojis but aren't in our data.
      // Text-default Extended_Pictographic chars (♪, ☆, etc.) without FE0F are
      // expected false positives from the regex — skip them silently.
      if (process.env.NODE_ENV === "development") {
        console.warn(
          `Emoji Revealer: Unrecognized emoji sequence: ${emoji} (${getCodePoints(emoji)})`
        );
      }
    }
  }

  if (matches.length === 0) return;

  // Build replacement content
  const fragment = document.createDocumentFragment();
  let lastIndex = 0;

  for (const { emoji, index } of matches) {
    // Add text before the emoji
    if (index > lastIndex) {
      fragment.appendChild(
        document.createTextNode(text.slice(lastIndex, index))
      );
    }

    // Create span for emoji
    const span = document.createElement("span");
    span.setAttribute(PROCESSED_ATTR, RUNTIME_OWNER);
    span.setAttribute(EMOJI_CHAR_ATTR, emoji);
    const name = getEmojiName(emoji)!;
    span.setAttribute("title", formatTooltip(emoji, name));
    span.textContent = emoji;
    fragment.appendChild(span);

    lastIndex = index + emoji.length;
  }

  // Add remaining text after last emoji
  if (lastIndex < text.length) {
    fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
  }

  // Replace the text node with our fragment
  textNode.parentNode?.replaceChild(fragment, textNode);
}

/**
 * Walk the DOM tree and process all text nodes and emoji img elements
 */
function processNode(node: Node): void {
  if (node.nodeType === Node.ELEMENT_NODE) {
    const element = node as Element;

    // Handle <img> elements specially — they may represent emojis (e.g., Gmail)
    if (element.tagName === "IMG") {
      processEmojiImg(element as HTMLImageElement);
      return;
    }

    if (shouldSkipElement(element)) {
      return;
    }
  }

  if (node.nodeType === Node.TEXT_NODE) {
    processTextNode(node as Text);
    return;
  }

  // Process children (make a copy of childNodes since we may modify the DOM)
  const children = Array.from(node.childNodes);
  for (const child of children) {
    processNode(child);
  }
}

/**
 * Process the entire document
 */
function processDocument(): void {
  if (!currentOptions.enabled) return;
  processNode(document.documentElement);
}

// CSS selector for editable areas
const EDITABLE_SELECTOR =
  "[contenteditable]:not([contenteditable='false']), [role='textbox'], [role='searchbox']";

// Floating tooltip element for use in editable areas (never modifies the DOM of the page)
let floatingTooltip: HTMLDivElement | null = null;

function getFloatingTooltip(): HTMLDivElement {
  if (!floatingTooltip) {
    floatingTooltip = document.createElement("div");
    floatingTooltip.setAttribute("data-emoji-revealer-floating", "true");
    Object.assign(floatingTooltip.style, {
      position: "fixed",
      zIndex: "2147483647",
      background: "#333",
      color: "#fff",
      padding: "4px 8px",
      borderRadius: "4px",
      fontSize: "12px",
      lineHeight: "1.4",
      pointerEvents: "none",
      display: "none",
      maxWidth: "300px",
      wordBreak: "break-word",
    });
    document.body.appendChild(floatingTooltip);
  }
  return floatingTooltip;
}

function showFloatingTooltip(text: string, x: number, y: number): void {
  const tooltip = getFloatingTooltip();
  tooltip.textContent = text;
  tooltip.style.display = "block";
  tooltip.style.left = x + 14 + "px";
  tooltip.style.top = y + 18 + "px";

  // Keep within viewport
  const rect = tooltip.getBoundingClientRect();
  if (rect.right > window.innerWidth) {
    tooltip.style.left = x - rect.width - 6 + "px";
  }
  if (rect.bottom > window.innerHeight) {
    tooltip.style.top = y - rect.height - 6 + "px";
  }
}

function hideFloatingTooltip(): void {
  if (floatingTooltip) {
    floatingTooltip.style.display = "none";
  }
}

function removeFloatingTooltip(): void {
  if (floatingTooltip) {
    floatingTooltip.remove();
    floatingTooltip = null;
  }
}

/**
 * Find an emoji in text that covers the given UTF-16 offset
 */
function findEmojiAtOffset(text: string, offset: number): string | null {
  EMOJI_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = EMOJI_REGEX.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (offset >= start && offset <= end) {
      const name = getEmojiName(match[0]);
      if (name) return match[0];
    }
  }
  return null;
}

/**
 * Set up document-level mousemove listener for editable area tooltips.
 * Uses caretRangeFromPoint to identify the character under the cursor without
 * modifying the DOM.
 */
let pendingEditableMouseMove: number | null = null;

function setupEditableTooltips(): Cleanup {
  const handleMouseMove = (e: MouseEvent): void => {
    if (!currentOptions.enabled || !currentOptions.showInEditableAreas) {
      hideFloatingTooltip();
      return;
    }

    // Throttle to one check per animation frame
    if (pendingEditableMouseMove !== null) return;
    const clientX = e.clientX;
    const clientY = e.clientY;

    pendingEditableMouseMove = requestAnimationFrame(() => {
      pendingEditableMouseMove = null;

      const target = document.elementFromPoint(clientX, clientY);
      if (!target || !target.closest(EDITABLE_SELECTOR)) {
        hideFloatingTooltip();
        return;
      }

      // Get caret position under cursor
      let node: Node | null = null;
      let offset = 0;

      if (document.caretRangeFromPoint) {
        const range = document.caretRangeFromPoint(clientX, clientY);
        if (range) {
          node = range.startContainer;
          offset = range.startOffset;
        }
      } else if ((document as any).caretPositionFromPoint) {
        const pos = (document as any).caretPositionFromPoint(clientX, clientY);
        if (pos) {
          node = pos.offsetNode;
          offset = pos.offset;
        }
      }

      if (!node || node.nodeType !== Node.TEXT_NODE) {
        hideFloatingTooltip();
        return;
      }

      const text = node.textContent || "";
      const emoji = findEmojiAtOffset(text, offset);
      if (!emoji) {
        hideFloatingTooltip();
        return;
      }

      const name = getEmojiName(emoji);
      if (!name) {
        if (process.env.NODE_ENV === "development") {
          console.warn(
            `Emoji Revealer: Unrecognized emoji in editable area: ${emoji} (${getCodePoints(emoji)})`
          );
        }
        hideFloatingTooltip();
        return;
      }

      if (process.env.NODE_ENV === "development") {
        console.log(
          `Emoji Revealer: Showing floating tooltip for ${emoji} (${name})`
        );
      }
      showFloatingTooltip(formatTooltip(emoji, name), clientX, clientY);
    });
  };

  document.addEventListener("mousemove", handleMouseMove);
  document.addEventListener("scroll", hideFloatingTooltip, true);

  return () => {
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("scroll", hideFloatingTooltip, true);
    if (pendingEditableMouseMove !== null) {
      cancelAnimationFrame(pendingEditableMouseMove);
      pendingEditableMouseMove = null;
    }
    hideFloatingTooltip();
  };
}

/**
 * Set up MutationObserver to handle dynamically added content
 * Uses debouncing to batch process mutations and avoid performance issues
 */
function setupObserver(): Cleanup {
  const DEBOUNCE_MS = 100;
  let pendingNodes: Set<Node> = new Set();
  let timeoutId: number | null = null;

  function processPendingNodes(): void {
    const nodes = pendingNodes;
    pendingNodes = new Set();
    timeoutId = null;

    // Skip processing if disabled
    if (!currentOptions.enabled) return;

    for (const node of nodes) {
      // Check if node is still in the document
      if (!document.contains(node)) continue;

      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as Element;
        if (!shouldSkipElement(element)) {
          processNode(element);
        }
      } else if (node.nodeType === Node.TEXT_NODE) {
        const parent = node.parentElement;
        if (parent && !parent.hasAttribute(PROCESSED_ATTR)) {
          processTextNode(node as Text);
        }
      }
    }
  }

  function scheduleProcessing(): void {
    if (timeoutId !== null) return;
    timeoutId = window.setTimeout(processPendingNodes, DEBOUNCE_MS);
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      // Handle added nodes
      for (const node of mutation.addedNodes) {
        pendingNodes.add(node);
      }

      // Handle character data changes (text content changes)
      if (
        mutation.type === "characterData" &&
        mutation.target.nodeType === Node.TEXT_NODE
      ) {
        pendingNodes.add(mutation.target);
      }
    }

    if (pendingNodes.size > 0) {
      scheduleProcessing();
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  return () => {
    observer.disconnect();
    pendingNodes.clear();
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
      timeoutId = null;
    }
  };
}

/**
 * Set up listener for storage changes to update tooltips in real-time
 */
function setupStorageListener(): Cleanup {
  if (typeof chrome !== "undefined" && chrome.storage?.onChanged) {
    const handleStorageChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string
    ): void => {
      if (areaName !== "sync") return;

      // Handle enabled toggle
      if (changes.enabled !== undefined) {
        currentOptions.enabled = changes.enabled.newValue;
        if (currentOptions.enabled) {
          // Re-process document when enabled
          processDocument();
        } else {
          // Remove tooltips when disabled
          removeAllTooltips();
        }
        return;
      }

      let optionsChanged = false;
      if (changes.showEmoji !== undefined) {
        currentOptions.showEmoji = changes.showEmoji.newValue;
        optionsChanged = true;
      }
      if (changes.showName !== undefined) {
        currentOptions.showName = changes.showName.newValue;
        optionsChanged = true;
      }
      if (changes.showCodePoints !== undefined) {
        currentOptions.showCodePoints = changes.showCodePoints.newValue;
        optionsChanged = true;
      }
      if (changes.showSkinTone !== undefined) {
        currentOptions.showSkinTone = changes.showSkinTone.newValue;
        optionsChanged = true;
      }
      if (changes.showInEditableAreas !== undefined) {
        currentOptions.showInEditableAreas = changes.showInEditableAreas.newValue;
        if (!currentOptions.showInEditableAreas) {
          hideFloatingTooltip();
        }
      }

      if (optionsChanged && currentOptions.enabled) {
        updateAllTooltips();
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }

  return () => {};
}

function addRuntimeCleanup(cleanup: Cleanup): void {
  if (runtimeActive) {
    runtimeCleanups.push(cleanup);
  } else {
    cleanup();
  }
}

function startActiveRuntime(): void {
  if (document.body) {
    if (process.env.NODE_ENV === "development") {
      console.log("Emoji Revealer: Processing document");
    }
    processDocument();
    addRuntimeCleanup(setupObserver());
    addRuntimeCleanup(setupEditableTooltips());
  } else {
    const handleDOMContentLoaded = (): void => {
      if (!runtimeActive) return;
      if (process.env.NODE_ENV === "development") {
        console.log("Emoji Revealer: DOMContentLoaded, processing document");
      }
      processDocument();
      addRuntimeCleanup(setupObserver());
      addRuntimeCleanup(setupEditableTooltips());
    };

    document.addEventListener("DOMContentLoaded", handleDOMContentLoaded);
    addRuntimeCleanup(() => {
      document.removeEventListener("DOMContentLoaded", handleDOMContentLoaded);
    });
  }
}

async function startContentRuntime(): Promise<void> {
  if (runtimeActive) return;
  runtimeActive = true;
  const startId = ++runtimeStartId;

  if (process.env.NODE_ENV === "development") {
    console.log("Emoji Revealer: Initializing content script (dev mode)");
  }

  // Load options first
  currentOptions = await loadOptions();
  if (!runtimeActive || startId !== runtimeStartId) {
    return;
  }

  addRuntimeCleanup(setupStorageListener());
  startActiveRuntime();
}

function stopContentRuntime(): void {
  if (!runtimeActive) return;
  runtimeActive = false;
  runtimeStartId++;

  for (const cleanup of runtimeCleanups.splice(0).reverse()) {
    cleanup();
  }

  removeAllTooltips();
  removeFloatingTooltip();
}

function sendRuntimeState(disabledByDuplicate: boolean): void {
  if (__DEV__ || typeof chrome === "undefined") {
    return;
  }

  try {
    const runtime = chrome.runtime;
    if (!runtime?.sendMessage) {
      return;
    }

    runtime.sendMessage(
      {
        type: RUNTIME_STATE_MESSAGE,
        disabledByDuplicate,
      },
      () => {
        try {
          // Reading lastError prevents Chrome from logging when the service worker
          // is unavailable during extension reloads or browser shutdown.
          void chrome.runtime.lastError;
        } catch {
          // The callback can also run after this content script's extension
          // context has been invalidated.
        }
      }
    );
  } catch {
    // Content scripts can outlive their extension context during reloads,
    // updates, or disable/enable cycles. Runtime state reporting is best-effort.
  }
}

createRuntimeCoordinator({
  isDev: __DEV__,
  start: () => {
    sendRuntimeState(false);
    void startContentRuntime();
  },
  stop: stopContentRuntime,
  onSuspend: () => {
    sendRuntimeState(true);
  },
  onResume: () => {
    sendRuntimeState(false);
  },
});
