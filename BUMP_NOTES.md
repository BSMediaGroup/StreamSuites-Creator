# Bump Notes

## RELEASED / PACKAGED: 0.4.2-alpha

Packaged / released and no longer the active pending bucket. Preserve new notes for the open `0.4.8-alpha` section below.

## Creator Checkbox Admin-Style Alignment - 2026-03-28

### Technical Notes

- The Creator repo already carried the same shared `ss-checkbox` primitive used by Admin, but the redesigned badge-governance matrix in `js/account-settings.js` was still rendering native checkbox inputs instead of that shared wrapper structure.
- Badge-governance cells now render through the shared `ss-checkbox-wrapper` + `ss-checkbox` markup path, so the Creator badge matrix inherits the same Admin checkbox visuals, checked animation, focus treatment, and disabled treatment already defined in `css/components.css`.
- `css/components.css` now also carries the small `.ss-checkbox-wrapper.muted .ss-checkbox-text` parity rule present in Admin so muted Creator checkbox rows can match the Admin shared component contract instead of diverging.

### Human-Readable Notes

- Badge Governance checkboxes in Creator now use the same checkbox style as Admin.
- Creator’s shared checkbox primitive is now back on the same path as the Admin checkbox component instead of mixing native checkbox boxes into the dashboard.

### Files / Areas Touched

- `js/account-settings.js`
- `css/creator-dashboard.css`
- `css/components.css`
- `BUMP_NOTES.md`

## Creator Badge Governance Full-Width Matrix Redesign - 2026-03-28

### Technical Notes

- `views/account.html` no longer nests the Badge Governance article body inside the shared `account-billing-layout` two-column grid. The old section had only one child panel in that grid, so the governance surface was auto-placed into the first column and started artificially narrow before the inner matrix layout even rendered.
- `js/account-settings.js` now renders the creator-facing governance surface as a full-width self-service composition: an overview/status strip, compact effective-badge and legend panels, and a single full-width matrix stage. Existing checkbox save behavior, supported-surface filtering, effective visibility rendering, and locked admin/global policy handling remain on the same data path.
- `css/creator-dashboard.css` now gives the governance section its own full-width matrix treatment with wider sticky row labels, deliberate matrix scrolling, denser cell controls, clearer editable/locked pills, and responsive stacking that keeps the user-context framing intact instead of mimicking the admin editor outright.

### Human-Readable Notes

- Creator Badge Governance now reads like a real settings panel instead of a squeezed nested card.
- The matrix gets the available width, locked policy cells stay obvious, and the section is framed around what the creator can control versus what policy still owns.

### Files / Areas Touched

- `views/account.html`
- `js/account-settings.js`
- `css/creator-dashboard.css`
- `BUMP_NOTES.md`

## Creator Account Section Toggle Icon Color Follow-Up - 2026-03-28

### Technical Notes

- The Account Settings expand/collapse button glyph in `css/creator-dashboard.css` was still using a raw `background-image` swap for `visiblefilled.svg` and `hidden.svg`, which kept the SVG art locked to its source fill instead of inheriting the surrounding button text color.
- The toggle icon now uses the same `currentColor` mask treatment as the corrected section-prefix icons, with the expanded/collapsed state switching only the mask image.

### Human-Readable Notes

- The Account Settings collapse/expand eye icons now render in the same visible color as the button text instead of showing up black.

### Files / Areas Touched

- `css/creator-dashboard.css`
- `BUMP_NOTES.md`

## Creator Account Settings Hydration + Section Icon Correction - 2026-03-28

### Technical Notes

- The broken badge-governance pass had introduced `formatBadgeLabel(...)` call sites into the Creator account badge row/icon renderers without carrying over the helper definition, which caused `renderBadgeGovernanceSection()` to throw during `AccountSettingsView.init()` and blocked the `/account` route from finishing hydration.
- `js/account-settings.js` now keeps the badge label/title/icon resolution on one shared helper path rooted in the module-scoped `formatBadgeLabel(...)` formatter, so the badge governance renderer and effective-badge strip no longer depend on scattered direct label formatting calls.
- `views/account.html` no longer renders the Account Settings section-prefix icons as raw `<img>` elements. Those headers now emit masked inline spans, and `css/creator-dashboard.css` applies `currentColor` masking so the prefix glyphs inherit the visible section-title color instead of preserving the SVG's original black fill.

### Human-Readable Notes

- Creator Account Settings no longer dies when the badge-governance section loads.
- The section header icons now match the nearby title color instead of showing up as black SVGs.

### Files / Areas Touched

- `js/account-settings.js`
- `views/account.html`
- `css/creator-dashboard.css`
- `BUMP_NOTES.md`

## Badge Governance Matrix Polish - 2026-03-28

### Technical Notes

- `js/account-settings.js` now filters redundant badge-governance surfaces (`creator_surface`, `admin_surface`, `public_surface`, and `directory`) out of the live badge surface catalog before rendering the account-settings matrix, while keeping the existing badge preference save contract for the remaining surfaces intact.
- Creator badge visibility states no longer rely on the original SVG file color. The governance renderer now outputs mask-based visible/hidden glyph spans, and `css/creator-dashboard.css` applies `currentColor` masking so `visiblefilled.svg` inherits the creator success green while `hidden.svg` follows the surrounding neutral UI tone.
- The Creator badge-governance section now includes a compact effective-badge icon strip, icon-bearing badge row labels, and a denser matrix/card layout that keeps locked admin-governed cells readable without changing the existing checkbox edit path.

### Human-Readable Notes

- Badge governance in Creator settings now matches the Admin cleanup: fewer redundant columns, readable green/neutral state icons, visible badge art, and a tighter matrix that wastes less space.
- Locked cells still stay obvious, but the section is easier to scan and edit at a glance.

### Files / Areas Touched

- `js/account-settings.js`
- `css/creator-dashboard.css`
- `BUMP_NOTES.md`

## Creator Account Section Merge + Platform Topper Polish - 2026-03-28

### Technical Notes

- `views/account.html` now merges the former standalone `Custom links` editor into `Public content & share links`, folds the old `Advanced FindMeHere styling` controls into `FindMeHere branding & theme`, adds the requested section-title SVG prefixes, adds repo-local platform-icon prefixes for the login and integration rows, and renames the X sign-in label to `Twitter(X)`.
- `css/creator-dashboard.css` now gives account section cards their own zero-stretch collapse baseline, swaps the section toggle art over to `visiblefilled.svg` and `hidden.svg`, adds the shared account title/icon row styles, introduces nested subsection and advanced-warning treatments, and defines the new slim platform-page title/topper layout with the logo moved inline before the page title.
- `js/account-settings.js` now drops the removed account shell tab labels for the former standalone `Links` and `Advanced` cards so the sticky tab row follows the live merged card structure.
- The individual platform views for `discord`, `rumble`, `youtube`, `twitch`, `kick`, and `pilled` now move the platform logo into the page title row and retitle the old `Platform hero` summary card as `Readiness summary`, reducing duplicate stacked header chrome without removing readiness pills or downstream management content.

### Human-Readable Notes

- Account settings is cleaner to scan: related link/theme controls now live together, the requested header and platform icons are visible, and the advanced FindMeHere CSS area is clearly marked for advanced users only with a docs link.
- Platform pages now use a slimmer topper with the platform logo inline before the page title instead of spending a full hero block on the logo alone.
- Account section collapse behavior now targets the section card container cleanly on small screens instead of leaving the old stretched shell behind the collapsed body.

### Files / Areas Touched

- `views/account.html`
- `views/platforms/discord.html`
- `views/platforms/rumble.html`
- `views/platforms/youtube.html`
- `views/platforms/twitch.html`
- `views/platforms/kick.html`
- `views/platforms/pilled.html`
- `css/creator-dashboard.css`
- `js/account-settings.js`
- `BUMP_NOTES.md`

## Creator Self-Serve Identity Save + Debug Proxy Repair - 2026-03-28

### Technical Notes

- The account settings save flow in `js/account-settings.js` now sends `display_name` through the same authoritative runtime `POST /api/public/profile/me` save used for the rest of the profile payload, removes the staged-only identity warning, and reloads the creator auth session after save so shell-level name state reflects the persisted account identity immediately.
- The Creator auth proxy allowlist in `functions/auth/[[path]].js` now forwards `/auth/creator/debug-mode`, fixing the previous same-origin proxy `404 Not Found` when the dropdown tried to toggle debug mode through the Pages worker.
- Creator debug visibility in `js/auth.js` is now gated by the backend-reported `creatorDebug.adminCapable` or `creatorDebug.developerCapable` flags in addition to the runtime eligibility bit, keeping the dropdown control tied to the authoritative operator capability contract.

### Human-Readable Notes

- Creator account settings now save your display name for real instead of leaving it as a staged-only field.
- The debug toggle no longer dies on a missing route, and the dropdown button is now limited to admin/developer-capable sessions.

### Files / Areas Touched

- `js/account-settings.js`
- `js/auth.js`
- `functions/auth/[[path]].js`
- `BUMP_NOTES.md`

## Creator Checkbox + Toggle Control Standardization - 2026-03-28

### Technical Notes

- The shared glowing checkbox primitive in `css/components.css` now owns the intended smaller baseline directly, reducing the old shared checkbox geometry from `24px` to a `12px` visual box while preserving the same glow treatment, checked-state animation, disabled handling, and dark-theme readability.
- Shared focus-visible handling was added to both the glowing checkbox primitive and the existing `switch-button` Admin12121 switch primitive so Creator controls now inherit the same keyboard-treatment contract instead of mixing native focus outlines with route-local switch styling.
- Creator checkbox drift was removed from account image-visibility flags, notification mute settings, onboarding terms acceptance, and any other remaining native checkbox-only rows by moving them onto the shared `.ss-checkbox-wrapper` markup already used by the creator-management screens.
- Creator toggle drift was removed from the account profile visibility switches, trigger enablement switches, and platform workspace `checks_enabled` control by replacing the repo-local switch patterns with the same shared `switch-button` structure already used for the intended Admin12121 toggle style.

### Human-Readable Notes

- Creator checkboxes now use the same smaller glowing checkbox style across the screens that previously fell back to plain browser checkboxes.
- Account visibility switches, trigger enablement switches, and platform workspace switches now match the intended shared toggle appearance instead of each route drawing its own version.
- Keyboard focus is more obvious on both checkbox and switch controls without changing the existing form behavior or saved data flow.

### Files / Areas Touched

- `css/components.css`
- `css/creator-dashboard.css`
- `views/account.html`
- `views/notifications.html`
- `js/notifications.js`
- `js/platform-integration-detail.js`
- `js/triggers.js`
- `js/onboarding.js`
- `BUMP_NOTES.md`

## Creator Account Entitlements List Alignment Fix - 2026-03-27

### Technical Notes

- The `Current entitlements` list in the account billing card was relying on native list markers inside a broader `.card ul` reset that zeroes base list padding, then reintroducing only a small local indent on `.account-billing-feature-list`; that left marker placement and wrapped-line alignment to the browser's default list box behavior.
- `css/creator-dashboard.css` now localizes the fix to `.account-billing-feature-list` by removing native bullets for that list only and rendering each entitlement row as a two-column marker/text grid, which keeps the marker, first line, and wrapped lines aligned consistently without changing the surrounding card layout.

### Human-Readable Notes

- The `Current entitlements` bullets in Creator account settings now line up cleanly, and longer lines wrap under their own text instead of drifting against the marker.
- This was a small billing-card polish pass only; the card content, hierarchy, and other account layouts were left intact.

### Files / Areas Touched

- `css/creator-dashboard.css`
- `BUMP_NOTES.md`

## Creator Account Shell Tab Row Hard Fix - 2026-03-27

### Technical Notes

- The earlier `/account` tab-row pass failed because the row and its header toggle were authored in `views/account.html` outside the fetched `#view-container`, and the Creator SPA only injects that container's inner markup. The live shell never mounted either control on the real `/account` route.
- The previous account-tab behavior also targeted `window` scrolling even though the Creator workspace scrolls inside `#app-main`, which meant active-section syncing and jump behavior were wired against the wrong scroll container.
- `js/account-settings.js` now mounts the account-only tabs button beside the sidebar control in the shared top bar, injects the shell tab row directly under the live top bar before the loader, derives tab buttons from the real account section cards, and removes both shell controls on non-account routes.
- Account section jumps and active highlighting now follow the actual Creator scroll container, keep the active tab in view on narrow widths, preserve the existing expandable section-card behavior with the tab row expanded by default, and add discreet end-cap arrow controls that appear only when horizontal tab overflow exists in that direction.
- The creator account dropdown now uses a viewport-capped mobile width instead of inheriting the desktop `min-width` behavior that could push the panel off the right edge on phones, and long account-detail values now wrap inside the panel instead of re-expanding it.
- Creator auth summary avatars now carry an explicit fallback state so the default `profile.svg` placeholder can be recolored for dark-surface contrast without tinting real uploaded avatars, and the mobile top-bar account widget now collapses to avatar-only while the desktop widget keeps the existing name-and-badge layout.

### Human-Readable Notes

- The `/account` page now actually shows the shell tab row immediately under the top bar instead of silently missing it.
- The tabs button in the top bar now works on `/account`, and the active tab follows the section you are viewing while the account page scrolls.
- When the account tabs overflow horizontally, small left/right arrow buttons now appear at the row edges so the hidden tabs remain discoverable and navigable.
- The mobile account menu now opens fully on-screen instead of spawning half off the viewport edge.
- The fallback user avatar is now readable against the dark Creator shell, and on mobile the top-bar user widget only shows the avatar to save space.
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

### Creator Debug Mode UX Alignment - 2026-03-28

### Technical Notes

- `js/auth.js` now consumes the runtime-owned `creator_debug` session contract, normalizes the active creator context, and toggles debug mode through `POST /auth/creator/debug-mode` instead of treating local storage as the source of truth.
- Creator request helpers that operate on creator-scoped account, integrations, stats, trigger, Discord, and notification surfaces now attach the authoritative creator-context headers exported by the shared auth module so the runtime can resolve the intended effective creator account consistently.
- The account dropdown debug control now renders only for sessions marked debug-eligible by runtime/Auth, switches cleanly between enter/exit labels, and a subtle shell pill now appears only while the sample creator context is active.
- `js/state.js` now treats runtime-reported debug state as authoritative for mutation-blocking behavior so admin and developer sessions in active debug mode are handled correctly even when they are also creator-capable.
- Pending entries for `0.4.8-alpha` go here.

### Human-Readable Notes

- Admin and developer users now land in the normal Creator experience by default and only switch into the sample creator view when they explicitly choose Debug Mode from the account menu.
- When debug mode is active, the shell shows a small test-creator indicator and the dashboard hydrates against the runtime-defined sample creator instead of quietly mixing operator and creator identities.
- The debug toggle no longer appears for ordinary creator, viewer, or moderator sessions that lack admin/developer capability.
- Pending entries for `0.4.8-alpha` go here.

### Files / Areas Touched

- `css/creator-dashboard.css`
- `js/account-settings.js`
- `js/app.js`
- `js/auth.js`
- `js/creator-stats.js`
- `js/discord-bot-integration.js`
- `js/integrations-hub.js`
- `js/platform-integration-detail.js`
- `js/state.js`
- `js/triggers.js`
- `js/utils/notifications-store.js`
- Pending entries for `0.4.8-alpha` go here.

### Risks / Follow-Ups

- This repo now depends more directly on the runtime `creator_debug` and active-context contract, so stale backend deployments will leave the toggle hidden or inactive even if the frontend bundle is current.
- Debug-mode write behavior is only as safe as the covered creator-scoped endpoints; any new creator write surface added later needs to keep using the shared creator-context headers and runtime workspace resolution.
- Pending entries for `0.4.8-alpha` go here.

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

## Task 3P - Developer Tier + Badge Surface Matrix - 2026-03-28

### Technical Notes

- Creator auth/session normalization now accepts the stored `developer` tier and stops suppressing backend-owned badge combinations locally.
- Account Settings now includes a creator-facing badge governance matrix that reads authoritative effective visibility, disables locked admin/global cells, and saves creator preferences back through `/api/public/profile/me`.
- The account profile normalizer now retains badge arrays and badge-state data so previews and governance controls stay aligned to runtime truth.

### Human-Readable Notes

- Creator users can now control their own badge visibility by surface from Account Settings, while admin/global hidden cells remain visibly locked.
- Developer accounts now display as Developer internally without creating a fake self-serve upgrade path for that tier.

### Files / Areas Touched

- `js/auth.js`
- `js/account-settings.js`
- `views/account.html`

### Risks / Follow-Ups

- The creator badge matrix currently writes through the existing profile endpoint additively; if that self-serve contract is split later, this section should move with it rather than reintroducing local badge state.
