export const RUNTIME_STATE_MESSAGE = "emoji-revealer:runtime-state";
export const DUPLICATE_STATUS_REQUEST_MESSAGE =
  "emoji-revealer:get-duplicate-status";
export const DUPLICATE_STATUS_CHANGED_MESSAGE =
  "emoji-revealer:duplicate-status-changed";
export const DEV_BUILD_PRESENCE_MESSAGE = "emoji-revealer:dev-build-presence";
export const DEV_BUILD_PRESENCE_REQUEST_MESSAGE =
  "emoji-revealer:get-dev-build-presence";
export const DEV_BUILD_PING_INTERVAL_MS = 1000;
export const DEV_BUILD_STALE_MS = 3500;

export const CHROMIUM_LOCAL_PROD_EXTENSION_ID =
  "migochplggocmjacpndhoedemhcoabhc";
export const CHROMIUM_STORE_PROD_EXTENSION_ID = null;
export const CHROMIUM_PROD_EXTENSION_IDS = [
  CHROMIUM_LOCAL_PROD_EXTENSION_ID,
] as const;
export const CHROMIUM_DEV_EXTENSION_ID = "klehagjocloghgoedkclniblgonaknpd";

export interface RuntimeStateMessage {
  type: typeof RUNTIME_STATE_MESSAGE;
  disabledByDuplicate: boolean;
}

export interface DuplicateStatusRequestMessage {
  type: typeof DUPLICATE_STATUS_REQUEST_MESSAGE;
}

export interface DevBuildPresenceMessage {
  type: typeof DEV_BUILD_PRESENCE_MESSAGE;
}

export interface DevBuildPresenceRequestMessage {
  type: typeof DEV_BUILD_PRESENCE_REQUEST_MESSAGE;
}

export interface DuplicateStatusResponse {
  ok: true;
  data: {
    duplicateDetected: boolean;
  };
}

export function isRuntimeStateMessage(
  message: unknown
): message is RuntimeStateMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as Partial<RuntimeStateMessage>).type === RUNTIME_STATE_MESSAGE &&
    typeof (message as Partial<RuntimeStateMessage>).disabledByDuplicate ===
      "boolean"
  );
}

export function isDuplicateStatusRequestMessage(
  message: unknown
): message is DuplicateStatusRequestMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as Partial<DuplicateStatusRequestMessage>).type ===
      DUPLICATE_STATUS_REQUEST_MESSAGE
  );
}

export function isDevBuildPresenceMessage(
  message: unknown
): message is DevBuildPresenceMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as Partial<DevBuildPresenceMessage>).type ===
      DEV_BUILD_PRESENCE_MESSAGE
  );
}

export function isDevBuildPresenceRequestMessage(
  message: unknown
): message is DevBuildPresenceRequestMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as Partial<DevBuildPresenceRequestMessage>).type ===
      DEV_BUILD_PRESENCE_REQUEST_MESSAGE
  );
}
