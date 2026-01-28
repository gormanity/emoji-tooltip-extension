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
