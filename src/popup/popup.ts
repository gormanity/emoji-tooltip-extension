// Popup script for Emoji Revealer options

interface TooltipOptions {
  showEmoji: boolean;
  showName: boolean;
  showCodePoints: boolean;
}

const DEFAULT_OPTIONS: TooltipOptions = {
  showEmoji: false,
  showName: true,
  showCodePoints: false,
};

const EXAMPLE_EMOJI = "\u{1F600}"; // 😀
const EXAMPLE_NAME = "grinning face";

/**
 * Get code points string for an emoji
 */
function getCodePoints(emoji: string): string {
  return [...emoji]
    .map((char) => "U+" + char.codePointAt(0)!.toString(16).toUpperCase())
    .join(" ");
}

/**
 * Format tooltip text based on options
 */
function formatTooltip(
  emoji: string,
  name: string,
  options: TooltipOptions
): string {
  const parts: string[] = [];

  if (options.showEmoji) {
    parts.push(emoji);
  }

  if (options.showName) {
    parts.push(name);
  }

  if (options.showCodePoints) {
    parts.push(`(${getCodePoints(emoji)})`);
  }

  return parts.join(" ") || name; // Fallback to name if nothing selected
}

/**
 * Update the preview display
 */
function updatePreview(options: TooltipOptions): void {
  const previewEl = document.getElementById("tooltipPreview");
  if (previewEl) {
    previewEl.textContent = formatTooltip(EXAMPLE_EMOJI, EXAMPLE_NAME, options);
  }
}

/**
 * Load options from storage
 */
async function loadOptions(): Promise<TooltipOptions> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULT_OPTIONS, (result) => {
      resolve(result as TooltipOptions);
    });
  });
}

/**
 * Save options to storage
 */
async function saveOptions(options: TooltipOptions): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.sync.set(options, () => {
      resolve();
    });
  });
}

/**
 * Show a brief status message
 */
function showStatus(message: string): void {
  const statusEl = document.getElementById("status");
  if (statusEl) {
    statusEl.textContent = message;
    setTimeout(() => {
      statusEl.textContent = "";
    }, 1500);
  }
}

/**
 * Get current options from form
 */
function getFormOptions(): TooltipOptions {
  return {
    showEmoji: (document.getElementById("showEmoji") as HTMLInputElement)
      .checked,
    showName: (document.getElementById("showName") as HTMLInputElement).checked,
    showCodePoints: (
      document.getElementById("showCodePoints") as HTMLInputElement
    ).checked,
  };
}

/**
 * Set form values from options
 */
function setFormOptions(options: TooltipOptions): void {
  (document.getElementById("showEmoji") as HTMLInputElement).checked =
    options.showEmoji;
  (document.getElementById("showName") as HTMLInputElement).checked =
    options.showName;
  (document.getElementById("showCodePoints") as HTMLInputElement).checked =
    options.showCodePoints;
}

/**
 * Handle option change
 */
async function handleOptionChange(): Promise<void> {
  const options = getFormOptions();

  // Ensure at least name is shown if nothing selected
  if (!options.showEmoji && !options.showName && !options.showCodePoints) {
    options.showName = true;
    setFormOptions(options);
  }

  updatePreview(options);
  await saveOptions(options);
  showStatus("Saved");
}

/**
 * Initialize popup
 */
async function init(): Promise<void> {
  // Load saved options
  const options = await loadOptions();
  setFormOptions(options);
  updatePreview(options);

  // Add event listeners
  document
    .getElementById("showEmoji")
    ?.addEventListener("change", handleOptionChange);
  document
    .getElementById("showName")
    ?.addEventListener("change", handleOptionChange);
  document
    .getElementById("showCodePoints")
    ?.addEventListener("change", handleOptionChange);
}

document.addEventListener("DOMContentLoaded", init);
