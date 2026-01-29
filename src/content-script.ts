// Emoji Revealer - Content Script
// Detects emojis on web pages and adds tooltips with their names

import emojiData from "./emoji-data.json";

// Emoji regex that matches most common emojis including:
// - Basic emoticons (U+1F600-U+1F64F)
// - Misc symbols and pictographs (U+1F300-U+1F5FF)
// - Transport and map symbols (U+1F680-U+1F6FF)
// - Supplemental symbols (U+1F900-U+1F9FF)
// - Symbols and arrows (U+2600-U+26FF, U+2700-U+27BF)
// - Regional indicator symbols for flags (U+1F1E0-U+1F1FF)
// - Variation selectors and ZWJ sequences
const EMOJI_REGEX =
  /(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F)(?:\u200D(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F))*/gu;

// Data attribute to mark processed spans
const PROCESSED_ATTR = "data-emoji-revealer";

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
  "IMG", // Skip images (some sites use img for emoji)
  "VIDEO",
  "AUDIO",
  "SELECT",
  "OPTION",
]);

// Cast emoji data to a typed record
const emojiNames = emojiData as Record<string, string>;

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

/**
 * Get the emoji name from our database
 */
function getEmojiName(emoji: string): string | null {
  // Try exact match first
  if (emojiNames[emoji]) {
    return emojiNames[emoji];
  }

  // Try without variation selector (FE0F)
  const withoutVS = emoji.replace(/\uFE0F/g, "");
  if (emojiNames[withoutVS]) {
    return emojiNames[withoutVS];
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
    const name = getEmojiName(match[0]);
    if (name) {
      matches.push({ emoji: match[0], index: match.index });
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
    span.setAttribute(PROCESSED_ATTR, "true");
    span.setAttribute("title", getEmojiName(emoji)!);
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
 * Walk the DOM tree and process all text nodes
 */
function processNode(node: Node): void {
  if (node.nodeType === Node.ELEMENT_NODE) {
    const element = node as Element;
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
  processNode(document.body);
}

/**
 * Set up MutationObserver to handle dynamically added content
 * Uses debouncing to batch process mutations and avoid performance issues
 */
function setupObserver(): void {
  const DEBOUNCE_MS = 100;
  let pendingNodes: Set<Node> = new Set();
  let timeoutId: number | null = null;

  function processPendingNodes(): void {
    const nodes = pendingNodes;
    pendingNodes = new Set();
    timeoutId = null;

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

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

// Initialize when DOM is ready
function init(): void {
  if (document.body) {
    processDocument();
    setupObserver();
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      processDocument();
      setupObserver();
    });
  }
}

init();
