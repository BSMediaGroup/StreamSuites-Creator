# Bump Notes

## RELEASED / PACKAGED: 0.4.2-alpha

Packaged / released and no longer the active pending bucket. Preserve new notes for the open `0.4.8-alpha` section below.

## Creator Account Shell Tab Row Hard Fix - 2026-03-27

### Technical Notes

- The earlier `/account` tab-row pass failed because the row and its header toggle were authored in `views/account.html` outside the fetched `#view-container`, and the Creator SPA only injects that container's inner markup. The live shell never mounted either control on the real `/account` route.
- The previous account-tab behavior also targeted `window` scrolling even though the Creator workspace scrolls inside `#app-main`, which meant active-section syncing and jump behavior were wired against the wrong scroll container.
- `js/account-settings.js` now mounts the account-only tabs button beside the sidebar control in the shared top bar, injects the shell tab row directly under the live top bar before the loader, derives tab buttons from the real account section cards, and removes both shell controls on non-account routes.
- Account section jumps and active highlighting now follow the actual Creator scroll container, keep the active tab in view on narrow widths, and preserve the existing expandable section-card behavior with the tab row expanded by default.

### Human-Readable Notes

- The `/account` page now actually shows the shell tab row immediately under the top bar instead of silently missing it.
- The tabs button in the top bar now works on `/account`, and the active tab follows the section you are viewing while the account page scrolls.
- Other Creator routes do not inherit the account tab row or the tabs-toggle button.

### Files / Areas Touched

- `js/account-settings.js`
- `views/account.html`
- `css/creator-dashboard.css`
- `BUMP_NOTES.md`

## Creator Account Shell + Preferences Corrective Pass - 2026-03-27

### Technical Notes

- The compact creator top-bar widget now renders a compact-only badge subset from the authoritative badge array, which keeps admin or developer over tier when applicable, keeps tier fallback for normal creator accounts, and suppresses founder from the widget without changing richer profile/dropdown surfaces.
- Preferences moderator management now uses debounced live partial-match lookup against the authoritative creator-moderator endpoint, with avatar-backed result cards, safer stale-request handling, and the existing assignment/remove flow preserved.
- The `/account` route now owns an account-only sticky tab row under the top bar, a tabs-toggle control using `assets/icons/ui/tabs.svg`, collapsible major section cards expanded by default, slimmer integration and billing layouts, and a narrower mobile drawer width.

### Human-Readable Notes

- The Creator header account pill is shorter, cleaner, and no longer wastes space on founder in the compact top-bar widget.
- Moderator assignment is easier to use because results appear while typing and now show who each account actually is before you assign them.
- Account settings is easier to scan because sections can be collapsed individually and the old jump-link strip is replaced with a shell-level sticky tab row that follows the page.

### Files / Areas Touched

- `views/account.html`
- `views/settings.html`
- `js/auth.js`
- `js/account-settings.js`
- `js/creator-moderators.js`
- `css/creator-dashboard.css`
- `BUMP_NOTES.md`

## Creator Badge Widget + Mobile Shell Repair - 2026-03-27

- The compact creator top-bar account widget no longer depends on the stale standalone `tier-pill` placeholder that was pinning the username to a fake Core visual state; it now renders a dedicated compact badge strip from the resolved authoritative badge array and effective tier.
- The glossy tier pill treatment was restored only where it belongs: inside the creator account dropdown summary and in the account billing/plan hero, both driven by the same normalized effective tier instead of the old badge-strip fallback path.
- Mobile shell behavior now follows the intended overlay-drawer pattern: mobile no longer inherits the desktop collapsed-rail state, the main content no longer lands in an implicit second grid column, and the header stays materially denser while the drawer opens with readable labels.

### Files / Areas Touched

- `index.html`
- `views/account.html`
- `views/onboarding.html`
- `views/plans.html`
- `views/settings.html`
- `views/triggers.html`
- `views/platforms/discord.html`
- `views/platforms/kick.html`
- `views/platforms/pilled.html`
- `views/platforms/rumble.html`
- `views/platforms/twitch.html`
- `views/platforms/youtube.html`
- `js/auth.js`
- `js/app.js`
- `css/creator-dashboard.css`
- `BUMP_NOTES.md`

## Creator Preferences Moderator Rehome - 2026-03-27

- The creator sidebar settings label now reads `Preferences`, and the former `/settings` placeholder page has been repurposed into a real community-preferences surface centered on creator-scoped moderator management.
- Creator moderator lookup, assignment, list, and removal now live on `/settings` through a shared frontend module that still calls the existing authoritative `StreamSuites` moderator relationship endpoints instead of inventing a creator-local model.
- The busy moderator block was removed from account settings and replaced with a small pointer to Preferences so `/account` stays focused on profile, billing, appearance, and linked-auth concerns.

### Files / Areas Touched

- `index.html`
- `views/settings.html`
- `views/account.html`
- `views/plans.html`
- `views/triggers.html`
- `views/platforms/discord.html`
- `views/platforms/kick.html`
- `views/platforms/pilled.html`
- `views/platforms/rumble.html`
- `views/platforms/twitch.html`
- `views/platforms/youtube.html`
- `js/creator-moderators.js`
- `js/account-settings.js`
- `js/render.js`
- `css/creator-dashboard.css`
- `README.md`
- `BUMP_NOTES.md`

## Admin Creator-Capable Auth Alignment - 2026-03-27

- Creator auth/session normalization now consumes the runtime-owned `creator_capable`, effective-tier, and badge payloads so admin accounts can enter the creator dashboard as admin-primary users without needing the older debug-only role-mismatch bypass.
- Badge rendering in the creator shell and account previews now strips redundant creator-tier icons whenever the admin badge is present, matching the backend-owned Admin-over-Pro display rule instead of letting stale fallback shapes waste space.
- This remains a consumer-alignment pass: the creator surface did not invent an admin-is-pro model locally, it now follows the clearer runtime contract for creator capability, effective tier, and final badge display.

### Files / Areas Touched

- `js/auth.js`
- `js/account-settings.js`
- `js/state.js`
- `BUMP_NOTES.md`

## Creator Billing Intervention Summary Alignment - 2026-03-26

- Creator-side auth normalization now consumes the expanded authoritative `payment_summary` contract for admin-granted tiers, gifted duration metadata, discount presence, and balance-relief totals instead of stopping at the earlier subscription/supporter-only billing fields.
- The account billing section now tells the creator when their effective tier is admin-granted, distinguishes lifetime versus time-boxed gifted access, and surfaces safe discount or credit/write-off summaries without exposing internal admin-only reason codes or audit notes.
- This remains a consumer-only alignment pass: the creator surface renders backend-owned billing truth more clearly, but it does not invent self-service billing controls or a second override model.

### Files / Areas Touched

- `js/auth.js`
- `js/account-settings.js`
- `BUMP_NOTES.md`

## Authoritative Badge Rendering Alignment - 2026-03-26

- Creator auth/session normalization now consumes the runtime-owned badge arrays instead of deriving local badge business rules from role and tier alone, which lets the creator shell render additive founder, moderator, and developer badges without owning the entitlement logic.
- The top-bar account summary, account settings panel, profile-hover payload attributes, and creator-side public/profile previews now resolve local badge icons from the authoritative badge keys returned by the backend.
- FindMeHere preview rendering in the creator account page now uses the backend-provided FindMeHere badge subset instead of reusing the broader creator badge set.

### Files / Areas Touched

- `js/auth.js`
- `js/account-settings.js`
- `BUMP_NOTES.md`

## Account Billing Summary Upgrade - 2026-03-26

- The creator account page billing block is no longer a placeholder preview card; it now renders an authoritative plan and payment summary area with current tier, plan status, supporter state, lifetime paid, last payment amount/date, donation total, renewal placeholder state, and backend-exposed tier entitlements.
- Creator auth/session and profile hydration now normalize the shared runtime `payment_summary` contract so the account page can consume the same server-owned billing/supporter payload as the admin surface without inventing a second client-side billing model.
- The upgraded billing area stays deliberately conservative about actions: it reorganizes the existing plans entrypoint and truthful summary data, but it does not invent billing-management controls or renewal details that the backend does not yet expose.

### Files / Areas Touched

- `views/account.html`
- `js/account-settings.js`
- `js/auth.js`
- `css/creator-dashboard.css`
- `BUMP_NOTES.md`

## Creator Customization Polish + Custom Links - 2026-03-26

- The creator account customization page now has a compact in-page section jump bar, tighter stacked-section spacing, and responsive paired field rows inside each section so long full-width editing flows stay easier to scan without reverting to the old side-by-side page layout.
- A new full-width custom-links editor now lets creators add, remove, reorder, label, and URL-manage FindMeHere links with per-link custom icon uploads or manual icon references, live icon thumbnails, and portal-icon fallback behavior that matches the live FindMeHere surface and creator preview.
- The creator dashboard top-bar user widget now shows display name plus a restrained role badge instead of the email, keeps the existing dropdown behavior intact, restores full-color avatar rendering, and the creator login buttons now reuse the newer dashboard button language instead of the older auth-page styling.

### Files / Areas Touched

- `views/account.html`
- `js/account-settings.js`
- `js/auth.js`
- `css/creator-dashboard.css`
- `login/index.html`
- `css/overrides.css`
- `BUMP_NOTES.md`

## FindMeHere Editor Hard Repair - 2026-03-26

- The creator account customization surface is now a full-width stacked editor instead of the old multi-column composition, with separate stacked sections for core profile content, public content/share links, media assets, FindMeHere branding/theme, advanced styling, and a dedicated full-width preview hub.
- Avatar, cover, background, and custom FindMeHere logo now each have their own slot-specific upload control, staged preview, clear action, secondary manual URL field, and save mapping, and the creator save flow now resolves staged media into one authoritative profile POST so the staged cover upload can no longer compete with the stale manual cover field.
- The old invented preview cards were replaced with new creator-side renderers that mirror the live StreamSuites profile card, the `ss-profile-hovercard` tooltip structure, and the FindMeHere `fmh-topbar` plus `fmh-profile-route` layout, including FindMeHere default-versus-custom header branding behavior and representative header/action buttons.

### Files / Areas Touched

- `views/account.html`
- `js/account-settings.js`
- `css/creator-dashboard.css`
- `BUMP_NOTES.md`

## FindMeHere Editor Media/Layout Repair - 2026-03-24

- The creator account editor now keeps the existing avatar flow intact while restoring a distinct cover image slot and clearly separating all four image roles: avatar image, cover image, background image, and custom FindMeHere logo image.
- The account page layout now groups identity/visibility, public content/share links, media/appearance, advanced FindMeHere CSS, and a dedicated full-width preview section so the form no longer sits beside a cramped inline preview column.
- Accent and button colors now support synchronized hex text entry plus native visual color pickers, and the preview area now switches between StreamSuites, tooltip, and FindMeHere modes with representative FindMeHere header and button states.

### Files / Areas Touched

- `views/account.html`
- `js/account-settings.js`
- `css/creator-dashboard.css`
- `BUMP_NOTES.md`

## FindMeHere Appearance Editor - 2026-03-24

- The creator account page now exposes a real FindMeHere appearance editor on top of the authoritative runtime public-profile contract, covering header branding, accent/button colors, button tone, font/layout presets, image visibility toggles, and advanced scoped custom CSS without inventing a parallel client-only settings store.
- The existing account-page save/load flow now round-trips the grouped `findmehere_theme` payload through `/api/public/profile/me`, keeps upload-first avatar and cover handling intact, and adds lightweight reuse controls so the FindMeHere header logo can point at the current saved avatar or cover path.
- The inline preview now reflects the current FindMeHere appearance draft in a lightweight way, including brand/logo fallback, preset-driven layout/font hints, color accents, and image-visibility toggles, while preserving the existing account/profile settings surface instead of branching into a second page.

### Files / Areas Touched

- `views/account.html`
- `js/account-settings.js`
- `css/creator-dashboard.css`
- `BUMP_NOTES.md`

## Authoritative Profile Media Upload Flow - 2026-03-23

- Creator profile media controls now stage real browser `File` objects and hand them to runtime-owned multipart upload endpoints during save instead of turning uploads into persisted base64 data URLs inside profile/account records.
- Upload-from-device remains the primary avatar/cover path, manual URL fields remain available as the secondary/manual path, and the account page now reflects saved uploaded asset references from the runtime-owned metadata model rather than pretending the creator surface stores media itself.
- Removal/replace flows now behave as metadata-backed profile edits: clearing avatar or cover stages an authoritative reference removal for the next save, while uploaded media resolves back from the runtime using the stable CDN-style `/u/{user_code}/.../vN.webp` contract.

### Files / Areas Touched

- `js/account-settings.js`
- `BUMP_NOTES.md`

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

### Creator Dashboard Shared Button System Refresh - 2026-03-22

- `css/creator-dashboard.css` now owns a cleaner shared Creator dashboard button family for `creator-button`, `creator-account-item`, `creator-account-button`, and `lockout-button`, replacing the earlier duplicated high-gloss gradient blocks with a tighter primary/secondary/danger token set.
- Neutral dashboard actions across the creator shell, overview/statistics/integrations/triggers surfaces, account settings, platform pages, and JS-rendered platform cards were remapped onto explicit secondary styling, while destructive dashboard actions such as reset, disconnect, clear/remove workspace, secret removal, and account-menu logout were promoted to explicit danger styling.
- This pass stayed Creator-dashboard scoped: auth/login modal styling in `login/index.html`, `css/overrides.css`, and shared auth selectors was intentionally left untouched, and compatibility aliases remain in the dashboard CSS so older `ghost` or `subtle` references do not become hard regressions during partial/template transitions.

### Files / Areas Touched

- `css/creator-dashboard.css`
- `index.html`
- `views/account.html`
- `views/integrations.html`
- `views/onboarding.html`
- `views/overview.html`
- `views/plans.html`
- `views/settings.html`
- `views/statistics.html`
- `views/triggers.html`
- `views/platforms/discord.html`
- `views/platforms/kick.html`
- `views/platforms/pilled.html`
- `views/platforms/rumble.html`
- `views/platforms/twitch.html`
- `views/platforms/youtube.html`
- `js/auth.js`
- `js/creator-stats.js`
- `js/discord-bot-integration.js`
- `js/integrations-hub.js`
- `js/platform-integration-detail.js`

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
