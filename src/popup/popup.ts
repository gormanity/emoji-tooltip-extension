// Popup script for Emoji Revealer options

interface TooltipOptions {
  enabled: boolean;
  showEmoji: boolean;
  showName: boolean;
  showCodePoints: boolean;
  showSkinTone: boolean;
}

const DEFAULT_OPTIONS: TooltipOptions = {
  enabled: true,
  showEmoji: false,
  showName: true,
  showCodePoints: false,
  showSkinTone: true,
};

// Example with skin tone for preview
const EXAMPLE_EMOJI = "\u{1F44B}\u{1F3FD}"; // 👋🏽
const EXAMPLE_NAME = "waving hand: medium skin tone";


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
 */
function stripSkinTone(name: string): string {
  return name.replace(/: (light|medium-light|medium|medium-dark|dark) skin tone$/, "");
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
    // Strip skin tone from name if option is disabled
    const displayName = options.showSkinTone ? name : stripSkinTone(name);
    parts.push(displayName);
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
    enabled: (document.getElementById("enabled") as HTMLInputElement).checked,
    showEmoji: (document.getElementById("showEmoji") as HTMLInputElement)
      .checked,
    showName: (document.getElementById("showName") as HTMLInputElement).checked,
    showCodePoints: (
      document.getElementById("showCodePoints") as HTMLInputElement
    ).checked,
    showSkinTone: (document.getElementById("showSkinTone") as HTMLInputElement)
      .checked,
  };
}

/**
 * Set form values from options
 */
function setFormOptions(options: TooltipOptions): void {
  (document.getElementById("enabled") as HTMLInputElement).checked =
    options.enabled;
  (document.getElementById("showEmoji") as HTMLInputElement).checked =
    options.showEmoji;
  (document.getElementById("showName") as HTMLInputElement).checked =
    options.showName;
  (document.getElementById("showCodePoints") as HTMLInputElement).checked =
    options.showCodePoints;
  (document.getElementById("showSkinTone") as HTMLInputElement).checked =
    options.showSkinTone;
}

/**
 * Update UI to reflect enabled/disabled state
 */
function updateEnabledState(enabled: boolean): void {
  const container = document.querySelector(".container");
  if (container) {
    container.classList.toggle("disabled", !enabled);
  }
}

/**
 * Handle option change
 */
async function handleOptionChange(): Promise<void> {
  const options = getFormOptions();

  // Ensure at least name is shown if nothing useful selected
  if (!options.showEmoji && !options.showName && !options.showCodePoints && !options.showSkinTone) {
    options.showName = true;
    setFormOptions(options);
  }

  updatePreview(options);
  await saveOptions(options);
  showStatus("Saved");
}

/**
 * Handle enabled toggle change
 */
async function handleEnabledChange(): Promise<void> {
  const options = getFormOptions();
  updateEnabledState(options.enabled);
  await saveOptions(options);
  showStatus(options.enabled ? "Enabled" : "Disabled");
}

/**
 * Initialize popup
 */
async function init(): Promise<void> {
  // Load saved options
  const options = await loadOptions();
  setFormOptions(options);
  updatePreview(options);
  updateEnabledState(options.enabled);

  // Add event listeners
  document
    .getElementById("enabled")
    ?.addEventListener("change", handleEnabledChange);
  document
    .getElementById("showEmoji")
    ?.addEventListener("change", handleOptionChange);
  document
    .getElementById("showName")
    ?.addEventListener("change", handleOptionChange);
  document
    .getElementById("showCodePoints")
    ?.addEventListener("change", handleOptionChange);
  document
    .getElementById("showSkinTone")
    ?.addEventListener("change", handleOptionChange);
}

document.addEventListener("DOMContentLoaded", init);
