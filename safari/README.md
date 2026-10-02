# Safari distribution

The release workflow supports two macOS distribution paths. Both archive the app
and extension with matching versions, include the complete extension build, and
verify signatures and resources. The deployment target is macOS 12 or newer.

- Tag releases use **Developer ID**, notarize with Apple, staple the ticket, and
  attach the resulting ZIP to GitHub Releases. Missing credentials or failed
  notarization fail the Safari job; there is no unsigned fallback.
- A manual **Release** workflow run with `safari_distribution=app-store-connect`
  exports a signed `.pkg` as a workflow artifact. Download it for manual upload
  with Transporter and submission in App Store Connect. This job does not upload
  to Apple or submit an app for review.

The existing v0.3.5 Safari download predates this workflow and is not a signed,
notarized distribution. These changes take effect for subsequent builds.

## GitHub environment setup

Create `safari-developer-id` and `safari-app-store` environments in this repository.
Restrict deployment branches to `main` and tags to `v*`. Only trusted release
code should receive signing credentials. Use GitHub environment secrets, never
commit credentials or paste them in issues or logs.

Both environments need the variable `APPLE_TEAM_ID` and these secrets:

| Secret | Contents |
| --- | --- |
| `APPLE_CERTIFICATE_P12_BASE64` | Base64-encoded, password-protected PKCS#12 containing the appropriate certificate(s) and private key(s) |
| `APPLE_CERTIFICATE_PASSWORD` | Password for that PKCS#12 |

For `safari-developer-id`, export a **Developer ID Application** identity.
Add these secrets for a dedicated App Store Connect **team API key** with
Developer access:

| Secret | Contents |
| --- | --- |
| `APPLE_NOTARY_KEY_BASE64` | Base64-encoded downloaded `.p8` private key |
| `APPLE_NOTARY_KEY_ID` | Key ID from App Store Connect |
| `APPLE_NOTARY_ISSUER_ID` | Team issuer UUID from App Store Connect |

For `safari-app-store`, the PKCS#12 must include an **Apple Distribution** identity
and a **Mac Installer Distribution** identity (shown in Keychain as
`3rd Party Mac Developer Installer`). Register the following explicit identifiers
in the Apple developer account and create Mac App Store distribution profiles:

| Secret | Profile's bundle identifier |
| --- | --- |
| `APPLE_APP_PROFILE_BASE64` | `com.gormanity.emoji-revealer` |
| `APPLE_EXTENSION_PROFILE_BASE64` | `com.gormanity.emoji-revealer.Extension` |

Encode the downloaded `.provisionprofile` files as base64. Profiles must match
the team and distribution certificate. Create an App Store Connect app record
using the app identifier before uploading. The App Store path does not use the
notarization API key; Apple performs its own checks on store submissions.

GitHub imports certificates into a temporary keychain on a hosted macOS runner.
An `always()` cleanup step deletes the keychain, imported profiles, and temporary
credential files. Certificates and profiles need replacement when they expire.
Apple API keys can be revoked in App Store Connect.

## Local signed build

With Xcode and a Developer ID Application identity installed:

```sh
npm ci
APPLE_TEAM_ID=YOUR_TEAM_ID SAFARI_BUILD_NUMBER=1 npm run build:safari
```

The script prints the archive path under `/tmp`. Set `SAFARI_OUTPUT_DIR` to use a
specific output directory outside the repository. The resulting archive is
signed but is **not notarized** by this local command.

`MARKETING_VERSION` comes from `package.json`; the packaged manifest must match.
Both native targets receive the same build number. GitHub uses the Release
workflow's increasing `github.run_number`. For a replacement App Store upload,
start a new workflow run instead of rerunning an already uploaded build number.

For local App Store builds, also set `SAFARI_SIGNING_IDENTITY='Apple Distribution'`
and `SAFARI_APP_PROFILE` / `SAFARI_EXTENSION_PROFILE` to installed profile UUIDs.
The workflow contains the export options for producing the installer package.

## Release validation

Run `npm run check` and `npm run build:dev`. The Safari build additionally checks
every runtime file against `dist/chrome`, manifest file references, native and
manifest versions, the signing team, and nested signatures. Developer ID builds
require hardened runtime and a secure timestamp. Publication additionally requires
an accepted notarization result, successful stapling, and Gatekeeper assessment.

Before the first signed release, manually test the final notarized app with
Safari's **Allow unsigned extensions** off, including persistence after restarting
Safari. App Store export also needs a successful run with real distribution
profiles and certificates before it is considered validated.

References: [Apple Safari distribution](https://developer.apple.com/documentation/safariservices/distributing-your-safari-web-extension)
and [GitHub Xcode signing](https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/sign-xcode-applications).
