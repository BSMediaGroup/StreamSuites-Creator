# Bump Notes

## CURRENT VER= 0.4.1-alpha / PENDING VER= 0.4.2-alpha

### Technical Notes

- This repo does not own an independent version number; creator-facing version labels are wired to the authoritative runtime export at `https://admin.streamsuites.app/runtime/exports/version.json` from `index.html`, `js/app.js`, and `js/utils/versioning.js`.
- Based on that runtime-export dependency, the best grounded current version remains `0.4.1-alpha`, even though `README.md` is already staged for `v0.4.2-alpha`.
- Recent repo-visible work focused on auth/session gate handling and login UX: `functions/auth/[[path]].js`, `js/auth.js`, and `login/index.html` were updated for runtime-owned `/auth/access-state` and debug-bypass behavior, while `css/overrides.css` and `css/components.css` were adjusted for auth notice and modal polish.
- Recent non-asset history also shows public category hydration fixes and creator bypass styling cleanup so the creator surface remains aligned with the shared auth gate behavior.

### Human-Readable Notes

- Creator login and access-gate messaging are being cleaned up so maintenance or development-mode restrictions can be shown without pretending the creator app owns auth policy.
- The recent UI work is mostly polish and correctness work around notices, modal styling, and category hydration rather than a new creator feature area.
- This repo is effectively in release-prep posture for `0.4.2-alpha`, but its displayed version still traces back to the runtime export stream that currently reads `0.4.1-alpha`.

### Files / Areas Touched

- `functions/auth/[[path]].js`
- `js/auth.js`
- `js/app.js`
- `js/utils/versioning.js`
- `js/utils/version-stamp.js`
- `login/index.html`
- `css/overrides.css`
- `css/components.css`
- `README.md`

### Follow-Ups / Risks

- Keep creator auth-gate copy and bypass UX in step with the runtime-owned access-state contract when the actual bump happens.
- README release-state copy already says `v0.4.2-alpha`, so the real bump pass should make sure the runtime-fed footer/version labels catch up cleanly.
