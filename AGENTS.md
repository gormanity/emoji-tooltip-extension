# AGENTS.md

## Repository Context

This is a cross-browser (Chrome, Firefox) extension that provides tooltips with
the names of emojis.

## Hard Constraints (DO NOT VIOLATE)

- Do NOT add analytics, telemetry, or remote calls
- Do NOT refactor files unrelated to the task

## Development Platform

- macOS
- Google Chrome
- Zen Browser

## Coding Style

- Prefer clarity over abstraction
- Keep injected scripts small and deterministic
- Retry loops must be time-bounded
- Avoid deep DOM traversal (>2 levels)

## TypeScript & Build Constraints

- All extension source lives in `src/` (manifest, HTML, CSS, TypeScript)
- The build produces a complete, loadable extension in `dist/`
- Use esbuild for bundling; avoid adding additional build tools unless asked
- Do not commit `dist/` output

## Editing Rules

- Modify only the files explicitly requested
- Preserve existing behavior unless told otherwise
- Do not rename commands, files, or constants without approval

## Editing Discipline

- Do not restructure build config, tsconfig, or manifest unless requested
- When implementing a feature, change the minimum number of files possible
- Prefer adding new code over refactoring working code

## Debugging Expectations

- Surface failures via return values or stored status
- Avoid silent failures
- Log useful messages in the service worker when debug is enabled

## Testing Philosophy

- Prefer TDD for pure logic (tab selection, command routing, utilities)
- Do NOT attempt full TDD for Chrome APIs or injected DOM behavior
- Integration behavior is primarily validated manually via hotkeys
- Tests should be lightweight and optional, not infrastructure-heavy
- Avoid adding test frameworks or E2E harnesses unless explicitly requested

## Version Control Expectations

- Changes should be structured so they can be committed incrementally
- Avoid mixing refactors with new behavior in the same change set
- Prefer small, focused commits that represent a single working step
- Commit messages should be concise and imperative (e.g. "feat: add play/pause
  command")
- Do not suggest squashing commits unless explicitly asked
- Assume `jj` is used for version control, backed by git
- Favor commit granularity suitable for `jj split` if needed
- Before starting work on a new task, verify that you are in a clean state using
  `jj st`, and commit or stash any unrelated changes first

## Release Cutting Expectations

- Use `jj` for release commits, bookmarks, and tags.
- Bump release metadata in `package.json`, `package-lock.json`, and
  `src/manifest.json`.
- Validate with `npm run check` and `npm run build:dev` before pushing a
  release.
- Move the `main` bookmark to the release commit, create the release tag with
  `jj tag set -r main vX.Y.Z`, and push with
  `jj git push --bookmark main --tag vX.Y.Z --remote origin`.
- Verify the GitHub release workflow completes and that release assets are
  uploaded.

## Release Notes Guidance

Write release notes in the project's existing concise, user-facing style:

```markdown
Short user-facing summary.

- **User-facing change** — describe the visible behavior or practical impact.
- **Another user-facing change** — include only if users benefit from knowing it.

Optional context sentence for affected browsers, sites, stores, or workflows.

**Full Changelog**: https://github.com/gormanity/emoji-tooltip-extension/compare/vPREVIOUS...vX.Y.Z
```

- Include only user-facing changes in release notes. Do not list internal
  implementation details, build changes, tests, or refactors unless they have a
  visible user impact.
- If a release has no direct user-facing change, use one short general statement
  explaining the purpose of the release instead of listing internal work.
- Prefer hand-written notes over raw generated PR lists for user-facing
  releases.
- Do not use standing `## What's New` or `## What's Changed` sections.
- Keep bullets impact-oriented, not implementation-oriented.
- Mention permission changes explicitly; if there are none and that matters for
  trust, say "No new permissions."
- Include exactly one `Full Changelog` compare link.
- Do not include GitHub-generated `What's Changed`, `New Contributors`, or
  repeated `Full Changelog` sections.
