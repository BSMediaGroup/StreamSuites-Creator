# Bump Notes

## RELEASED / PACKAGED: 0.4.2-alpha

Packaged / released and no longer the active pending bucket. Preserve new notes for the open `0.4.8-alpha` section below.

## Cross-Repo README Architecture Alignment - 2026-03-21

- The creator README now carries a cleaner repo-scoped Mermaid flowchart, aligned authority language, cross-links back to the runtime README, and a normalized repo tree with current branch characters.
- Creator docs now describe the creator surface as a contract consumer for session, profile, integrations, triggers, and readiness instead of letting those boundaries blur with runtime ownership.
- This was a documentation-only pass. No creator routing, auth, trigger, integration, or profile behavior changed in this note.

### Files / Areas Touched

- `README.md`
- `BUMP_NOTES.md`

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

- Creator navigation icon resolution in `js/app.js` now includes an explicit `integrations` segment mapping, so the Integrations Hub no longer falls back to the generic icon path while existing route icon mappings remain intact.
- Shared creator layout rules in `css/creator-dashboard.css` now cap the platform detail pages and integrations hub to controlled one- and two-column desktop layouts, only allowing a third column at genuinely ultra-wide widths with wide-card spanning so the earlier cramped four-column presentation is removed rather than merely hidden.
- Shared card list typography in `css/creator-dashboard.css` now restores readable bullet indentation, marker placement, and wrapped-line spacing for unclassed lists rendered inside creator cards, which fixes the platform/readiness bullet rendering issue without disturbing the intentionally chip-like classed list components.
- The integrations hub renderer in `js/integrations-hub.js` and the related Creator view partials now add platform icon treatment to the per-platform readiness cards and shift the hub overview cards toward a roomier hierarchy with stronger spacing and fewer columns per row.

- Creator route loading for per-platform integrations was repaired by moving the platform detail logic back into a controller-style `js/platform-integration-detail.js` flow that can initialize correctly on SPA route swaps instead of depending on stripped inline `<script>` tags and `DOMContentLoaded`.
- A dedicated full-page creator integrations hub now exists at `/integrations`, with runtime/Auth-backed readiness KPIs, next-action guidance, trigger-foundation summary, and per-platform readiness cards.
- Platform pages for `rumble`, `youtube`, `twitch`, `kick`, and `pilled` now expose real management surfaces: Rumble keeps the secure secret modal path, while the other platforms use additive runtime-backed workspace save/remove flows for channel metadata, setup posture, and readiness notes.
- Creator account/profile media controls now prefer upload-from-device for avatar and cover updates, while preserving the manual URL inputs as explicit secondary paths against the same runtime/Auth profile contract.
- Creator account/settings now consumes the authoritative runtime/Auth integrations summary instead of hard-coded platform status text.
- Dedicated creator platform routes for `youtube`, `rumble`, `twitch`, `kick`, and `pilled` now read the runtime/Auth integration contract, and `js/platform-integration-detail.js` handles the new per-platform consumer flow.
- The triggers surface now consumes the central runtime/Auth trigger registry v1 and only exposes enabled-state management that the backend currently supports.
- Rumble creator linkage is now wired to the backend-owned secret save/remove endpoints and keeps the frontend limited to masked presence state.
- The creator account page now expands the integrations area into a readiness-oriented hub with account posture, deployability checks, truthful next actions, and direct paths into triggers, platform detail pages, and the existing Discord bot area.
- Platform detail pages now share a more consistent readiness information architecture, including connection state, capability summary, safe metadata, requirements/limitations, management actions, and readiness/next-step treatment driven by the existing backend payload.
- The triggers page now explains the foundation registry model more clearly, surfaces deployment relationships more explicitly, and adds loading/empty/update states without inventing unsupported trigger authoring capability.
- Pending entries for `0.4.8-alpha` go here.

### Human-Readable Notes

- Creator integrations now read much more cleanly at normal desktop widths: the hub and each platform page breathe properly, skinny multi-column card walls are gone, and bullet lists inside cards render like normal readable lists again.
- The Integrations Hub now carries the correct sidebar icon and per-platform cards show their platform iconography directly instead of relying on generic card treatment.

- Creator integrations now behave like a real workflow instead of a cramped settings sidecar: there is a proper hub page, platform pages no longer hang in loading shells, and each platform has an actionable management surface that stays honest about current backend maturity.
- Profile image and cover image editing now feel like normal upload-first creator flows, with device upload staged previews leading the UX and manual image URLs retained as backup/manual inputs.
- This milestone establishes the first creator-facing integrations and trigger foundation pass, not the full final creator redesign.
- Account settings now shows truthful platform connection summaries, dedicated platform pages explain current capability clearly, and the triggers page reflects real backend state instead of local fiction.
- Rumble is the only platform with a real creator-managed linkage flow in this phase, and it stays secret-safe after submission.
- This follow-up pass makes creator integrations feel like one connected workflow: account posture, linked platforms, trigger foundations, bot readiness, and the next required action now read as one system.
- Twitch copy now stays explicit about OAuth linkage versus deeper chat/runtime readiness, while YouTube, Kick, and Pilled remain polished but truthful planned-state surfaces.
- Pending entries for `0.4.8-alpha` go here.

### Files / Areas Touched

- `views/integrations.html`
- `views/platforms/rumble.html`
- `views/platforms/youtube.html`
- `views/platforms/twitch.html`
- `views/platforms/kick.html`
- `views/platforms/pilled.html`
- `js/app.js`
- `js/integrations-hub.js`
- `css/creator-dashboard.css`
- `views/account.html`
- `views/integrations.html`
- `views/platforms/rumble.html`
- `views/platforms/youtube.html`
- `views/platforms/twitch.html`
- `views/platforms/kick.html`
- `views/platforms/pilled.html`
- `views/triggers.html`
- `js/account-settings.js`
- `js/integrations-hub.js`
- `js/platform-integration-detail.js`
- `js/triggers.js`
- `css/creator-dashboard.css`
- `README.md`
- Pending entries for `0.4.8-alpha` go here.

### Risks / Follow-Ups

- Upload-first profile media currently uses additive validated data-URL handling on the runtime/Auth side; later phases may still want a dedicated media pipeline or storage abstraction.
- YouTube, Twitch, Kick, and Pilled now have truthful management/readiness workspaces, but only Rumble has a true backend-managed credential path in this phase.
- The creator repo remains a consumer only, so richer create/edit/delete trigger flows still depend on later backend contract expansion.
- The new platform detail pages rely on the runtime/Auth endpoints being deployed alongside the creator surface; stale backend deployments will leave the UI in fallback loading/error copy.
- Later phases still need fuller provider-specific onboarding and verification UX beyond this foundation pass.
- Rumble secret-state presentation is now clearer and safer-looking, but any true credential verification, audit trail, or rotation workflow still depends on later backend expansion.
- The new readiness hub and platform summaries are only as truthful as the currently deployed runtime/Auth serializer payloads; stale backend deployments will still degrade the UX into fallback messaging.
- Pending entries for `0.4.8-alpha` go here.
