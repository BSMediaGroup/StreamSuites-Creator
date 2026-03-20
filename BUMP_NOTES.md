# Bump Notes

## RELEASED / PACKAGED: 0.4.2-alpha

Packaged / released and no longer the active pending bucket. Preserve new notes for the open `0.4.8-alpha` section below.

## Release Prep Completion - v0.4.2-alpha

- This repo still does not own an independent semantic version file; its displayed version remains runtime-fed from `https://admin.streamsuites.app/runtime/exports/version.json`.
- For this release-prep pass, the repo's release state is now aligned to `v0.4.2-alpha` and the release-note source material now lives in `changelog/v0.4.2-alpha.md`.
- The compare range recorded for release packaging is `v0.4.0-alpha...v0.4.2-alpha`.
- Earlier sections below remain the cumulative pre-release working record for the auth-gate and creator-surface work that shaped this bump.

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

## Session Milestone - 2026-03-20 - Creator Auth Gate UX Alignment

### Completed / Implemented

- Creator auth entry points in `functions/auth/[[path]].js`, `login/index.html`, and `js/auth.js` are now wired to the runtime-owned `GET /auth/access-state` contract and `POST /auth/debug/unlock` flow so creator login/signup UX stays aligned with the authoritative gate.
- The creator login surface now includes an inline access-gate block with runtime-driven maintenance/development messaging, a discreet key-icon bypass reveal, short-lived unlock persistence in `sessionStorage`, and unlock feedback that does not move auth policy into the frontend.
- Shared auth UI consistency work is visible in the current tree: `css/overrides.css` styles the access-gate/key affordance, `css/components.css` carries the shared `close.svg` mask treatment, and the login shell uses the same access-gate structure the runtime contract expects.
- Creator-side session/role lockout handling remains distinct from the public auth gate: `js/auth.js` still renders `creator-lockout` variants for unauthenticated, invalid-session, and role-mismatch states so creator surfaces can stay truthful when the user is signed in but not entitled to creator access.

### Useful Release-Note Framing

- This repo now reflects the intended creator-side UX for the shared auth gate: creator fresh-auth can be paused by runtime mode, bypass can be granted temporarily for debug access, and creator pages still preserve their own post-auth lockout handling for session-invalid or role-mismatch states.

### Pending / Follow-Up

- Keep creator-side copy, icon treatment, and unlock affordances in sync with the shared public/runtime gate UX as the real `0.4.2-alpha` bump is prepared.

## CURRENT VER= 0.4.2-alpha / PENDING VER= 0.4.8-alpha

Open bucket for future work only. Do not add new `0.4.8-alpha` prep notes into the released `0.4.2-alpha` section above.

### Technical Notes

- Pending entries for `0.4.8-alpha` go here.

### Human-Readable Notes

- Pending entries for `0.4.8-alpha` go here.

### Files / Areas Touched

- Pending entries for `0.4.8-alpha` go here.

### Risks / Follow-Ups

- Pending entries for `0.4.8-alpha` go here.
