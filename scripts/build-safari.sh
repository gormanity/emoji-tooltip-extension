#!/bin/bash
set -euo pipefail

# Local signed archive; CI adds notarization or App Store export afterward.
: "${APPLE_TEAM_ID:?Set APPLE_TEAM_ID}"
: "${SAFARI_BUILD_NUMBER:?Set SAFARI_BUILD_NUMBER to a new positive integer}"
[[ "$SAFARI_BUILD_NUMBER" =~ ^[1-9][0-9]*$ ]] || { echo "Invalid Safari build number" >&2; exit 1; }
SAFARI_OUTPUT_DIR="${SAFARI_OUTPUT_DIR:-$(mktemp -d /tmp/emoji-safari-build.XXXXXX)}"
export SAFARI_OUTPUT_DIR
mkdir -p "$SAFARI_OUTPUT_DIR"
version=$(node -p 'require("./package.json").version')
if [[ "${GITHUB_REF_TYPE:-}" == tag && "${GITHUB_REF_NAME:-}" != "v$version" ]]; then
  echo "Release tag does not match package.json version" >&2
  exit 1
fi

npm run build:chrome:store
npm run build:assets
cp -R dist/chrome/. dist/

xcodebuild archive \
  -project "safari/Emoji Revealer/Emoji Revealer.xcodeproj" \
  -scheme "Emoji Revealer (macOS)" -configuration Release \
  -destination "generic/platform=macOS" \
  -derivedDataPath "$SAFARI_OUTPUT_DIR/DerivedData" \
  -archivePath "$SAFARI_OUTPUT_DIR/Emoji Revealer.xcarchive" \
  CODE_SIGN_STYLE=Manual DEVELOPMENT_TEAM="$APPLE_TEAM_ID" \
  CODE_SIGN_IDENTITY="${SAFARI_SIGNING_IDENTITY:-Developer ID Application}" \
  SAFARI_APP_PROFILE="${SAFARI_APP_PROFILE:-}" \
  SAFARI_EXTENSION_PROFILE="${SAFARI_EXTENSION_PROFILE:-}" \
  MARKETING_VERSION="$version" CURRENT_PROJECT_VERSION="$SAFARI_BUILD_NUMBER" \
  OTHER_CODE_SIGN_FLAGS="--timestamp" \
  | tee "$SAFARI_OUTPUT_DIR/build.log"

app="$SAFARI_OUTPUT_DIR/Emoji Revealer.xcarchive/Products/Applications/Emoji Revealer.app"
node scripts/verify-safari.mjs "$app" "$SAFARI_BUILD_NUMBER"
codesign --verify --deep --strict --verbose=2 "$app"
for bundle in "$app" "$app/Contents/PlugIns/Emoji Revealer Extension.appex"; do
  signature=$(codesign -dv --verbose=4 "$bundle" 2>&1)
  [[ "$signature" == *"TeamIdentifier=$APPLE_TEAM_ID"* ]] || { echo "Incorrect signing team" >&2; exit 1; }
  [[ "$signature" == *"Authority="* ]] || { echo "Missing distribution signature" >&2; exit 1; }
  if [[ "${SAFARI_SIGNING_IDENTITY:-Developer ID Application}" == "Developer ID Application" ]]; then
    [[ "$signature" == *"Authority=Developer ID Application:"* && "$signature" == *"(runtime)"* && "$signature" == *"Timestamp="* ]] || {
      echo "Developer ID distribution requires the correct identity, hardened runtime, and a secure timestamp" >&2
      exit 1
    }
  fi
done
echo "Signed Safari archive: $SAFARI_OUTPUT_DIR/Emoji Revealer.xcarchive"
