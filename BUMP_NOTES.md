# Bump Notes

## CURRENT VER= 0.4.2-alpha / PENDING VER= 0.4.3-alpha

## 2026-04-20 - Creator Wheels Nav Icon Repair

### Technical Notes

- Added the missing `wheels` entry to `js/app.js` `NAV_ICON_BY_SEGMENT` so the Creator sidebar now uses `/assets/icons/ui/wheelpie.svg` for the wheels route instead of falling back to the generic portal icon.
- Expanded `tests/wheels-authority.test.mjs` additively to pin the wheels icon mapping alongside the existing route/authority assertions. No files were removed or replaced in this corrective pass; the touched files are only slightly longer because of the one real nav mapping and the matching regression assertion.

## 2026-04-20 - Creator Wheel Artifact Manager

### Technical Notes

- Added a real `/wheels` creator route by wiring `index.html`, `functions/[[path]].js`, `js/routes.js`, and `js/render.js` into the existing Creator shell instead of leaving wheel work in the older placeholder area or inventing a disconnected mini-app.
- Added `views/wheels.html`, `js/wheels.js`, and the matching `css/creator-dashboard.css` wheel-editor styles so creators can list their wheel artifacts, create new ones, edit title/notes, manage entries and palette, persist default wheel-vs-scoreboard display mode, import compatible wheel payloads, export portable `.sswheel` JSON, and save only through the authoritative `GET/POST/PATCH /api/creator/wheels*` runtime/Auth contracts.
- Added `tests/wheels-authority.test.mjs` to pin the route wiring, runtime/Auth-only endpoint usage, manual-authority milestone copy, and the presence of the dedicated wheel-manager UI shell. No unrelated Creator routes were redesigned in this pass; the new styles were added under wheel-specific selectors to keep the rest of the dashboard stable.

### Human-Readable Notes

- Creator now has a real wheel editor instead of a reserved placeholder route.
- New wheels start in wheel view by default, but creators can persist scoreboard mode per artifact when they want Public to open there first.
- Import/export is now real, and unsupported imported fields are called out as metadata instead of being misrepresented as working settings.

- Restored the Creator-side compact profile hovercard renderer in `assets/js/ss-profile-hovercard.js` so existing `.ss-profile-hover` triggers now hydrate again and use the same canonical social-platform ordering and alias normalization already established on Public/Members. The hovercard social row now prefers the full-color SVG set, resolves `twitter` to `x`, `site`/`web` to `website`, `whatsappchannels`/`whatsapp_channels` to the existing `whatsapp.svg`, and explicitly excludes any `dlive` mapping.
- Replaced the previous no-op hovercard stub with the canonical compact social path because the stub meant Creator compact identity previews could not render any social hovers at all. That file is expected to be much longer now: the old placeholder was removed, and the real hovercard logic now owns normalization, ordering, fetching, and max-8 plus-overflow rendering in one place.
- Updated `assets/css/ss-profile-hovercard.css` additively with the small `+N` overflow pill styling so dense social rows stay balanced instead of wrapping into a bulky second line.
- Expanded `tests/notifications-authority.test.mjs` additively so the Creator repo must keep the canonical hovercard registry, the WhatsApp Channels correction, the compact max-8 limit, and the explicit absence of `dlive`.

- Refined the Creator Rumble posture copy in `js/platform-integration-detail.js` so a matched creator who is currently offline now renders as `Waiting for live stream` / `Awaiting live stream target` instead of looking like a hard attach failure. The page still uses the runtime-owned `bot_auto_deploy` and `managed_session` payloads; it now distinguishes offline waiting, live-target pending, attach-identity incomplete, and attach-ready/session-present states without inventing fake live or session data.
- Updated `tests/notifications-authority.test.mjs` additively so the Creator route must keep the calmer awaiting-live posture wording and the managed-session copy that explains a session will appear once a real live target exists. No files were removed or replaced in this pass.

- Finished the creator-side recovery for the blocked Rumble/Auth regression. `js/integrations-hub.js` now treats `/api/creator/integrations` as the required authority and degrades cleanly when profile or trigger side payloads are temporarily unavailable, so `/integrations` can still hydrate instead of dropping into a full-page load failure.
- `js/platform-integration-detail.js` now keeps `/integrations/rumble` alive when optional runtime-owned Rumble fragments are missing or temporarily broken. The base integration contract remains authoritative, while optional bot-decision, managed-session, and managed-dispatch issues are surfaced as warning status through `optional_fragment_errors` instead of crashing the page.
- Expanded `tests/notifications-authority.test.mjs` additively so both creator routes stay pinned to the new partial-payload hydration path. No files were removed or replaced in this completion pass.

- Repaired `js/platform-integration-detail.js` so the Creator Rumble route no longer turns optional runtime-owned Rumble subpayload failures into a full-page `Load failed` state. The page still treats the base `/api/creator/integrations/rumble` contract as authoritative, but the bot-decision, managed-session, and managed-dispatch cards now degrade independently when one optional fragment is absent or malformed.
- Expanded `tests/notifications-authority.test.mjs` additively so the Creator surface must keep the new graceful-degradation wrapper and the partial-payload fallback messaging. No files were removed; `js/platform-integration-detail.js` was hardened in place and is expected to stay roughly the same size because the route still renders the same current layout.

- Tightened the Creator integrations hub hydration in `js/integrations-hub.js` so the route still renders the authoritative `/api/creator/integrations` and `/api/creator/triggers` contract when `/api/public/profile/me` is temporarily unavailable. This does not invent local state; it keeps the integration and trigger authority path primary while treating the profile summary as non-blocking.
- Added a focused source-level regression check in `tests/notifications-authority.test.mjs` to keep the integrations hub on the new `Promise.allSettled(...)` hydration path instead of failing the entire route on the non-critical profile summary request.

## CURRENT VER= 0.4.2-alpha / PENDING VER= 0.4.8-alpha

## 2026-04-19 - Creator Account Social Links Editor Scale Pass

### Technical Notes

- Replaced the old flat hard-coded social input stack inside `views/account.html` with a grouped social-links editor shell that now renders a compact summary strip, configured-links jump chips, a slim local search/filter row, a first-class platform block, and a secondary extended-platform reveal area without changing the existing `POST /api/public/profile/me` save path or `social_links` payload contract.
- Added `js/social-platforms.js` as the shared canonical Creator-side social registry so account settings and compact hovercards now read the same platform order, labels, alias normalization, placeholders, and full-color SVG icon paths. `whatsappchannels` explicitly resolves to `/assets/icons/whatsapp.svg`, and no `dlive` entry exists in the editable/rendered registry.
- Updated `js/account-settings.js` to render the new social editor from the shared registry, hydrate alias-backed saved values into canonical inputs, preserve unknown non-canonical keys during save, keep the existing dirty/save/reset flow, and reuse the same payload shape while making the preview/social summary ordering consistent with the canonical registry.
- Updated `assets/js/ss-profile-hovercard.js` to consume the new shared registry instead of owning a second embedded platform list. That embedded mapping block was removed and replaced because keeping two registries in sync would keep drifting; this file is expected to be shorter now.
- Extended `css/creator-dashboard.css` additively with compact social-editor layout, chip, grouped-panel, and responsive rules so the account section no longer collapses into one long vertical wall at normal dashboard widths or narrow widths.
- Added `tests/account-social-editor.test.mjs` and expanded `tests/notifications-authority.test.mjs` so the repo now guards the shared registry, the new account editor shell, the WhatsApp Channels mapping, and the continued absence of `dlive`.
- Updated `README.md` tree entries for the new shared helper and the new focused test file.

### Human-Readable Notes

- Account settings now makes social links much easier to browse: major platforms stay visible first, configured links are easy to spot, and the rest of the registry stays available without taking over the page.
- Search and filter controls are light and local, so creators can jump to one platform quickly instead of scrolling through a long input wall.
- Existing saved profiles should continue to load and save normally, including older alias-based platform keys, while the editor now presents them through the cleaner canonical platform names and icons.

## 2026-04-14 - Creator Trigger Phase Repair Completion

### Technical Notes

- Repaired the creator trigger route so `js/triggers.js` now exposes the controller lifecycle that the Creator shell actually loads (`window.TriggersView.init/destroy`) instead of depending on a one-shot `DOMContentLoaded` boot path that could miss SPA route navigations.
- Preserved the creator trigger CRUD/manual-send work already present, but tightened the first-phase truthfulness by keeping trigger CRUD on `/triggers`, manual send on `/integrations/rumble`, and labeling managed dispatch history rows distinctly for creator-manual, admin-manual, and automatic trigger-generated replies.
- Added `tests/triggers-runtime-authority.test.mjs` and updated `README.md` additively so the repo tree and contract notes now match the repaired trigger/runtime-authority surface. No files were removed in this repair pass; `js/triggers.js` was replaced in place and is expected to stay roughly similar in scope while using the correct controller boot model.

### Human-Readable Notes

- The Creator trigger page now hydrates reliably after real route navigation instead of only when the document first loads.
- Creator-facing Rumble dispatch history now makes it clear whether a message came from the creator, an operator, or the automatic trigger engine.

## 2026-04-14 - Creator Rumble Managed Session And Transport Visibility Pass

### Technical Notes

- Extended `views/platforms/rumble.html` with an additive `Managed bot runtime status` card instead of a new disconnected route so the existing creator Rumble integration surface now has first-class room for runtime-owned managed-session lifecycle, transport posture, auth blocking, target, and timestamp visibility.
- Expanded `js/platform-integration-detail.js` so the Creator page now consumes both `integration.bot_auto_deploy` and the new runtime-authored `integration.managed_session` payload, distinguishes connected vs enabled vs live vs managed-session-created vs transport-attached states with existing pill styling, and explicitly calls out chat-auth blockers such as `auth_material_insufficient` when only a stored `stream_key` exists.
- The older creator Rumble bot area was not deleted, but it was corrected: the previous card only surfaced auto-deploy decision state and implicitly hid managed transport truth. That omission was replaced by direct managed-session rendering. The file is longer because the page now projects the already-shipped runtime contract instead of collapsing it into one summary paragraph.
- Expanded `tests/notifications-authority.test.mjs` in the same lightweight source-assertion style already used by this repo so the creator Rumble page must keep the new managed-session DOM hooks plus the transport/auth-blocking rendering logic.

### Human-Readable Notes

- Creators can now see whether Rumble is merely connected, whether auto-deploy is enabled, whether they are live, whether a managed session exists, whether transport is attached/listening, and whether chat auth is blocked.
- When the runtime reports that only stream-key material exists, the page now says that plainly instead of implying the bot is ready.

### Files / Areas Touched

- `views/platforms/rumble.html`
- `js/platform-integration-detail.js`
- `tests/notifications-authority.test.mjs`
- `BUMP_NOTES.md`

## 2026-04-13 - Creator Rumble Bot Auto-Deploy Authority Surface

### Technical Notes

- Extended `views/platforms/rumble.html` with an additive Rumble bot auto-deploy card that exposes a creator toggle plus the runtime-owned decision output for enabled state, connection posture, live state, resolved target data, and blocking reason without redesigning the broader page.
- Extended `js/platform-integration-detail.js` so the Creator dashboard now reads the authoritative `integration.bot_auto_deploy_enabled` and `integration.bot_auto_deploy` fields from the runtime integration payload, renders the decision locally, and persists preference changes only through `POST /api/creator/integrations/rumble/bot-auto-deploy`.
- The Creator repo does not persist canonical bot or live state locally in this flow. The new client logic is a narrow adapter around the runtime/Auth response and gracefully reports missing or blocked runtime data instead of fabricating ready state.
- Added focused source-level regression coverage in `tests/notifications-authority.test.mjs` so the Rumble page must keep its decision card hooks and the Creator controller must continue using the runtime bot auto-deploy endpoint and payload keys.

### Human-Readable Notes

- Creators can now turn Rumble bot auto-deploy on or off from the existing Rumble integration page.
- The page now shows whether runtime considers the creator merely enabled, currently live, actually eligible, or blocked, along with the resolved watch target when one exists.
- Creator remains a control and visibility surface only. Runtime/Auth stays the single authority.

### Files / Areas Touched

- `views/platforms/rumble.html`
- `js/platform-integration-detail.js`
- `tests/notifications-authority.test.mjs`
- `BUMP_NOTES.md`

## 2026-04-12 - Creator Notification Runtime Authority Cleanup

### Technical Notes

- Tightened `js/utils/notifications-store.js` so the Creator notifications consumer no longer carries the older seed-oriented source branch, and so unread totals now follow the runtime/Auth contract instead of being recomputed from locally muted presentation state.
- No Creator layout redesign was introduced for this pass. The existing dropdown and `/notifications` page continue using the same DOM, styling, and runtime hydration flow, but they now stop legitimizing legacy placeholder seed semantics in client code.
- Added `tests/notifications-authority.test.mjs` and updated `README.md` so this repo now covers the specific regression that the Creator notifications store must stay on the runtime `/api/creator/notifications` authority path without reintroducing seed hydration logic.

### Human-Readable Notes

- Creator keeps the same notifications UI, but it now trusts the runtime unread counts and no longer carries seed-style fallback logic in the browser.
- This repo did not remove page structure or styling; the change was a data-authority hardening pass only.

## 2026-04-09 - Runtime Turnstile Kill-Switch Coverage

### Technical Notes

- Added focused source coverage in `tests/auth-surface-links.test.mjs` so the Creator login Turnstile block remains keyed to the authoritative runtime `/auth/turnstile/config` response and preserves the hidden-panel collapse path when the runtime `enabled` flag is false.

### Human-Readable Notes

- Creator login still follows the runtime-owned Turnstile state instead of drifting into a local override.

## 2026-04-07 - Creator Notifications Surface Cleanup

### Technical Notes

- Replaced the remaining notification-page action buttons in `js/notifications.js` with the shared dashboard `creator-button` primitives, so notification row actions now inherit the same hover, focus, active, and disabled treatment used across the rest of Creator instead of the older `ss-btn` path.
- Replaced the bell dropdown `Mark all read` control in `index.html` with the same shared Creator button family and removed the old bespoke `.creator-notifications-action` rules from `css/creator-dashboard.css`, eliminating the leftover notification-only button styling instead of preserving it behind extra overrides.
- Retuned the bell dropdown typography in `css/creator-dashboard.css` so the header label, subtitle, unread count pill, notification row text, meta text, empty state, and footer link all explicitly use the Creator dashboard font stack and spacing hierarchy rather than relying on the older mixed notification-specific declarations.

### Human-Readable Notes

- Notifications page action buttons now match the rest of the current Creator dashboard.
- The bell dropdown no longer uses the older notification-specific typography treatment and now reads like the rest of Creator.
- This was a targeted cleanup pass only; no unrelated Creator routes were redesigned.

## 2026-04-07 - Creator Notifications Hydration + UI Overhaul

### Technical Notes

- Reworked `js/utils/notifications-store.js` so Creator notifications now hydrate from the authoritative `GET /api/creator/notifications` contract and use the new runtime-owned `PATCH /api/creator/notifications` mutation for mark-read, mark-unread, and mark-all-read flows instead of persisting browser-only read IDs.
- Rebuilt `js/notifications.js` around that shared authority contract so the bell dropdown, unread badge, and `/notifications` page stay synchronized after reads, mark-all actions, background refreshes, and deep-link opens.
- Replaced the older notification-specific page markup and styling in `views/notifications.html`, `index.html`, and `css/creator-dashboard.css` with a scoped Creator-surface redesign: stronger page hierarchy, refreshed dropdown framing, richer notification cards, clearer unread/read affordances, truthful loading and empty states, and a more current sidebar/preferences treatment.
- Removed/replaced scaffolded notification behavior in the Creator repo by deleting the browser-only read-state layer and the stale visual treatment tied to that local model. The store file changed shape rather than simply growing, and the old legacy notification-only styling block was replaced in place with the redesigned surface styles.

### Human-Readable Notes

- Creator notifications now show the real StreamSuites inbox in both the bell dropdown and the full Notifications page.
- Reading a notification in one place updates the other place and the unread badge automatically.
- The Creator notifications surface now looks like the rest of the newer Creator dashboard instead of the older placeholder treatment.

## Emergency Login Turnstile Placement Hotfix - 2026-04-06

### Technical Notes

- Reordered `login/index.html` so the Creator login surface keeps its existing inline Turnstile controller path but now places the alternate-surface selector and Turnstile block at the bottom of the auth card instead of up in the header stack.
- No Creator auth endpoint or validation contract changed in this pass; the fix was limited to placement parity with the other StreamSuites login surfaces.

### Human-Readable Notes

- Creator keeps the same working Turnstile behavior.
- The widget now sits lower in the login card and matches the emergency parity pass across Public, Admin, and Developer.

## Creator Dropdown Visibility Contract Reconfirmed - 2026-04-05

### Technical Notes

- Re-verified the Creator dropdown’s compact overview card as the reference pattern for the shared parity pass and added a focused regression in `tests/auth-surface-links.test.mjs` covering the existing detail-card markup plus the admin/developer-only debug visibility gate in `js/auth.js`.
- No Creator dropdown redesign or runtime contract change was required in this pass because the current debug action already gates on the backend-owned `creatorDebug.adminCapable` / `creatorDebug.developerCapable` fields.

### Human-Readable Notes

- Creator remains the reference dropdown.
- The Debug Mode action stays hidden from ordinary creator accounts and only appears for admin or developer-authorized sessions.

## RELEASED / PACKAGED: 0.4.2-alpha

Packaged / released and no longer the active pending bucket. Preserve new notes for the open `0.4.8-alpha` section below.

## Shared State Fallback Hardening + Local Mirror Restore - 2026-04-03

### Technical Notes

- Root-caused the creator-side shared hydration regression to the state loader itself rather than the routed views: `js/state.js` still treated the first local `404` or timeout as terminal, so the Creator shell never reached its GitHub/raw fallback when `./shared/state/*` was absent, and it continued using the older `1500ms` timeout budget that the admin surface had already outgrown.
- Updated `js/state.js` to use the same bounded `6000ms` timeout posture plus one retry window for retryable failures, and changed `loadStateJson(...)` so a missing or timed-out first root no longer aborts the whole fallback chain before the remaining configured roots are attempted.
- Added a local `shared/state/` mirror under the Creator repo and refreshed it from the authoritative `StreamSuites` contract set so creator-side runtime snapshot, live-status, quota, and Discord runtime reads once again have a truthful local export-first source before remote fallback is needed.
- No older files were removed in this repo. The old fail-fast branch in `js/state.js` was replaced in place because it was the direct regression, and `README.md` needed a tree update because `shared/state/` now exists in the repo root.

### Human-Readable Notes

- Creator shared-state hydration no longer dies on the first missing local JSON file.
- The Creator repo now has a real local shared-state mirror again for the runtime snapshot and live-status family of contracts.
- When the local mirror is genuinely unavailable, the loader now keeps trying its configured fallbacks instead of silently freezing stale state.

### Files / Areas Touched

- `js/state.js`
- `shared/state/runtime_snapshot.json`
- `shared/state/live_status.json`
- `shared/state/quotas.json`
- `shared/state/discord/runtime.json`
- `README.md`
- `BUMP_NOTES.md`

## Creator Shell Startup Route Preservation + Guard Normalization - 2026-04-03

### Technical Notes

- Root-caused the remaining Creator shell-side deep-link drift to two client behaviors in the startup/router path rather than the edge rewrite layer: `js/render.js` still treated any unresolved first-load or `popstate` URL as an automatic `overview` redirect, and `js/auth.js` compared authoritative `creator_workspace_access.allowed_routes` entries verbatim instead of normalizing slash-prefixed or alias paths through the same route helper used by the shell.
- Updated `js/auth.js` so allowed route tokens now normalize through `window.StreamSuitesCreatorRoutes` before access checks run. That keeps `/integrations/discord`, `/platforms/youtube`, and the rest of the clean-route inventory aligned with the same canonical route ids the shell actually loads.
- Updated `js/render.js` so invalid or unresolved direct-entry routes no longer rewrite the browser location back to `/overview`, and so disallowed navigation no longer silently swaps the requested URL out for `overview` before the route guard can render its distinct restricted-state UI.
- Hardened `scripts/validate-pages-routing.ps1` twice: it now uses a compatibility date that stays valid around day-boundary clock skew, and it also runs a route-helper regression pass that proves representative direct-entry paths still resolve to the intended internal Creator views while a true bad path stays unresolved.
- No files were removed or replaced in this repo. The touched files are slightly longer because the old implicit route fallback behavior was replaced with explicit preserve-or-render handling.

### Human-Readable Notes

- Creator deep links now honor the URL that was opened instead of quietly snapping back to Overview when the shell cannot resolve the route immediately.
- Canonical creator routes and legacy compatibility paths now pass through the same access guard logic, so route permissions and route loading stop disagreeing about which page should open.
- Real bad creator routes now stay visibly bad inside the shell instead of pretending they were Overview.

### Files / Areas Touched

- `js/auth.js`
- `js/render.js`
- `scripts/validate-pages-routing.ps1`
- `BUMP_NOTES.md`

## Creator Cloudflare Route Inventory Repair - 2026-04-02

### Technical Notes

- Root-caused the remaining Creator deep-link failures to the repo-root `_redirects` manifest itself: Cloudflare/Wrangler was discarding the wildcard shell rewrites (`/integrations/*`, `/modules/*`, `/platforms/*`) as invalid infinite-loop candidates, which meant valid nested Creator shell URLs still fell through to `404` whenever the Pages Function rescue path was absent or bypassed.
- Replaced those invalid wildcard shell rules with the real current Creator route inventory already reflected in `js/routes.js`: exact `/home`, `/integrations/{provider}`, `/modules/{module}`, and legacy compatibility `/platforms/{provider}` paths now rewrite directly to `/index.html` without depending on loop-prone splats.
- Tightened `functions/[[path]].js` to the same explicit known-route inventory instead of broad prefix matching, so real misses under `/integrations/`, `/modules/`, or `/platforms/` now remain true platform-level `404`s while valid shell routes still recover into the SPA entrypoint.
- Added `scripts/validate-pages-routing.ps1` as a repo-local Pages regression check. It starts `wrangler pages dev`, verifies representative Creator deep links resolve to the shell, verifies a true bad path still returns `404`, and verifies a JS asset is not rewritten to HTML.

### Human-Readable Notes

- Creator deep links like `/integrations/discord`, `/platforms/youtube`, and `/modules/clips` now use Cloudflare-valid routing rules instead of depending on ignored wildcard rewrites.
- Fake nested Creator routes no longer quietly fall into the app shell; they stay real 404s.

### Files / Areas Touched

- `_redirects`
- `functions/[[path]].js`
- `scripts/validate-pages-routing.ps1`
- `README.md`
- `BUMP_NOTES.md`

## Creator Live Tier Pill Refresh Fix - 2026-03-29

### Technical Notes

- Traced the stale creator pill path to `js/auth.js`, where session normalization collapsed the runtime payload down to the effective capability tier and the silent-session equivalence check ignored stored/display-tier metadata. That meant a live `PRO <-> DEVELOPER` change could arrive from the backend while the creator shell still treated the session as unchanged and kept rendering the old pill.
- Updated `js/auth.js` so the creator session keeps the backend-owned stored/display-tier metadata, re-renders when those fields change, and feeds all shared creator tier-pill surfaces from the authoritative display tier rather than the capability-only effective tier.
- Updated `js/account-settings.js`, `js/onboarding-page.js`, and `js/onboarding.js` so the account billing card and onboarding tier reads use the same display-tier fallback chain. No styles, icons, or matrix-governance rules were redesigned; the change is strictly on the live tier-display data path.
- No files were created or removed in this repo. The affected files are slightly longer because the old implicit tier fallback was replaced with explicit display-tier handling.

### Human-Readable Notes

- Creator tier pills now follow live account tier changes instead of waiting for a restart when the backend keeps Developer on the existing implicit Pro capability path.
- The visible pill and the account billing plan label stay aligned with the same backend-owned display tier.

### Files / Areas Touched

- `js/auth.js`
- `js/account-settings.js`
- `js/onboarding-page.js`
- `js/onboarding.js`
- `BUMP_NOTES.md`

## Creator Developer Tier Polish + Account Surface Consistency - 2026-03-29

### Technical Notes

- Extended the shared creator tier-pill styling in `css/creator-dashboard.css` so the existing tier family now renders `DEVELOPER` with the same glass and sheen behavior already used for Core, Gold, and Pro, while continuing to use the backend-owned tier mapping and `/assets/icons/dev-green.svg` from `js/auth.js`.
- Updated `views/account.html` and `css/creator-dashboard.css` so the account settings integration snapshot now reads `Integrations snapshot`, each platform quick link uses one structurally consistent two-row layout, the four media-reference URL inputs reuse the existing creator mono font treatment only on those targeted fields, and the StreamSuites / FindMeHere visibility cards now carry the requested prefixed logos without changing the toggle controls.
- Tightened the shared platform-page heading layout in `css/creator-dashboard.css` so every individual platform page stacks the `Platform` kicker cleanly above the hero title instead of leaving it floating in the gutter. No platform routes, cards, or content sections were redesigned or removed.

### Human-Readable Notes

- Developer-tier creator accounts now look intentional anywhere the existing tier pills already appeared.
- Account Settings reads more consistently: the integrations summary rows stack cleanly, the media reference fields now look like technical URLs and filenames, and the two public visibility cards now show the right product logos at a glance.
- The individual platform pages now open with a cleaner title block that matches the stronger page-title pattern already used elsewhere.

### Files / Areas Touched

- `css/creator-dashboard.css`
- `views/account.html`
- `BUMP_NOTES.md`

## Creator Cloudflare Pages Shell Route Manifest Parity - 2026-03-28

### Technical Notes

- Audited the current Creator client router against the repo-root Cloudflare Pages `_redirects` manifest and found manifest drift: the shell supports the exact `/integrations` hub route, but `_redirects` only covered `/integrations/*`.
- Added the missing exact `/integrations -> /index.html 200` rewrite so the Creator integrations hub does not rely on the Pages Function fallback path when the deployment is behaving as static-only.
- No custom 404 behavior was removed or redesigned in this pass. The branded `404.html` still handles genuine misses, while valid Creator shell routes are now more explicitly declared at the static rewrite layer.

### Human-Readable Notes

- The Creator integrations hub is now treated as a first-class dashboard route during direct entry and refresh instead of depending on the fallback safety net.
- Real bad Creator URLs still stay on the branded 404 page.

### Files / Areas Touched

- `_redirects`
- `BUMP_NOTES.md`

## Creator Cloudflare Pages Deep-Link Fallback Hardening - 2026-03-28

### Technical Notes

- The Creator shell previously depended on `_redirects` plus a `404.html` route-rescue script that tried to bounce valid dashboard URLs back into the SPA after Cloudflare Pages had already failed the request. That shim was loop-prone and made the 404 document do shell-routing work it should never have owned.
- Added a repo-root `functions/[[path]].js` Pages Function that only intercepts `GET` and `HEAD` requests which truly 404, limits fallback coverage to known Creator shell routes (`/overview`, `/account`, `/statistics`, `/notifications`, `/integrations/*`, `/modules/*`, `/platforms/*`, and related shell views), and then serves `/index.html` with a `200` response. Asset requests, real files, login pages, and invalid routes still fall through normally.
- `404.html` was intentionally shortened by removing the old client-side route-restore script and its dependency on `js/routes.js`. The file remains as the branded real-404 surface, but it no longer tries to repair valid shell navigation after a server miss.

### Human-Readable Notes

- Refreshing or opening valid Creator dashboard URLs in a new tab no longer depends on the 404 page trying to save the route after the host already failed it.
- Real Creator routes now get the dashboard shell directly, while real bad URLs still stay bad URLs.

### Files / Areas Touched

- `functions/[[path]].js`
- `404.html`
- `README.md`
- `BUMP_NOTES.md`

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

### Creator Notifications Page Visual Rebuild - 2026-04-07

### Technical Notes

- Rebuilt the routed `/notifications` partial in `views/notifications.html` around the current Creator dashboard composition instead of the older notification-only slab: the page now uses the standard Creator section header, a tighter hero treatment, a modern feed card, and a deliberate right-side rail for posture plus signal controls while preserving all existing notification DOM IDs and behavior hooks.
- Replaced the older notifications-page-specific CSS block in `css/creator-dashboard.css` with a new page-scoped layout system that aligns to the stronger Creator surfaces: tighter typography, disciplined metric pills, a cleaner filter/search row, denser notification cards, a more polished empty state, and responsive handling that keeps the page coherent down to common mobile widths.
- Removed the old notifications route topbar title override in `js/render.js`, so the shell now inherits the actual page heading and stays consistent with the rest of the Creator routes instead of forcing the older `NOTIFICATIONS CENTER` special case.
- Tightened the page empty-state copy in `js/notifications.js` to match the rebuilt surface while leaving notification hydration, mark-read/unread, mark-all, filtering, search, mute controls, and dropdown synchronization on the existing working path.
- Removed/replaced:
- Replaced the older `creator-notifications-hero`, `creator-notifications-layout`, `creator-notifications-panel`, `creator-notifications-sidebar`, and related summary-card/stat-card page shell with the current Creator `creator-section` plus `card` composition. This is expected to be cleaner because the routed page no longer carries a one-off notifications-only information architecture.
- Replaced the page-level notifications CSS selectors tied to that legacy shell in place inside `css/creator-dashboard.css` instead of stacking more overrides on top. The CSS file did not become shorter overall, but the notifications block is now organized around the current shared page language rather than the previous bespoke slab structure.
- `js/render.js` is slightly shorter because the obsolete notifications title special case was removed.

### Human-Readable Notes

- Notifications now looks like a current Creator dashboard page instead of an older leftover surface.
- The typography is smaller and more controlled, the layout feels less blocky, and the inbox, filters, posture, and signal controls are grouped more intentionally.
- Existing notification actions still work on the same hydrated runtime-backed flow.

### Files / Areas Touched

- `views/notifications.html`
- `css/creator-dashboard.css`
- `js/notifications.js`
- `js/render.js`
- `BUMP_NOTES.md`

### Risks / Follow-Ups

- The visual pass keeps using the existing notification card/button data contract, so any future backend payload expansion may still justify a deeper item-row redesign rather than just page-shell changes.
- The Creator notifications surface remains sensitive to the deployed runtime/Auth notification contract; stale backend or proxy deployments can still degrade the page into truthful empty/error states.

### Creator Direct-Entry Route Preservation Repair - 2026-04-03

### Technical Notes

- Root-caused the remaining Creator deep-link collapse to a project-level bootstrap chain split across the Pages entry layer and the shell router. The repo `_redirects` rules were still rewriting valid dashboard paths to `/index.html`, and under the current Pages/Wrangler behavior those rewrites surfaced as `308 -> /` redirects. That stripped `/account`, `/integrations/discord`, `/platforms/youtube`, and the rest of the requested path before `js/render.js` ever ran, so the shell could only resolve the root bootstrap markup back to `overview`.
- Replaced that old redirect-first bootstrap path by removing the Creator SPA rewrite inventory from `_redirects` and letting `functions/[[path]].js` own valid dashboard deep-link recovery. The function now fetches `/index.html` directly from the Pages asset binding when a known Creator route misses statically, which serves the shell body with `200` while preserving the requested browser URL.
- Updated `js/render.js` so startup and `popstate` resolution no longer canonicalize valid alias paths such as `/platforms/youtube` on first load or history navigation. The router still resolves those URLs through the same authoritative route helper, but the current pathname now remains intact unless the URL is using legacy `#...` or `?view=...` routing.
- Replaced the old response-code-only `scripts/validate-pages-routing.ps1` flow with a browser-backed validation pass. It now proves direct entry to `/account`, `/overview`, `/integrations/discord`, and `/platforms/youtube` lands on the expected mounted view and expected pathname under an authenticated Creator session stub, and it also proves `/definitely-invalid-route` stays a real `404` instead of silently becoming Overview.
- Removed/replaced:
- Replaced the Creator SPA `_redirects` route inventory that pointed valid dashboard paths at `/index.html`. It is safe to remove because the route-scoped Pages Function now owns the same known-route inventory without mutating the request URL, and the file is expected to be shorter because that duplicated redirect list no longer exists there.
- Replaced the old `context.next('/index.html')` shell fallback with an asset-binding fetch path in `functions/[[path]].js`. It is safe because the function still only serves known Creator routes and still falls through for real misses or non-GET/HEAD requests.

### Human-Readable Notes

- Opening or refreshing a real Creator route now keeps that route in the address bar and loads the correct page instead of bouncing back to Overview.
- Legacy compatibility paths such as `/platforms/youtube` still resolve to the correct Creator page, but the shell no longer rewrites them on first load just because a canonical `/integrations/...` path exists.
- Fake Creator routes still fail as fake routes; they no longer masquerade as Overview.

### Files / Areas Touched

- `_redirects`
- `functions/[[path]].js`
- `js/render.js`
- `scripts/validate-pages-routing.ps1`
- `BUMP_NOTES.md`

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

## Task 3X - Turnstile Auth Rollout Verification - 2026-04-04

### Technical Notes

- Verified the creator login surface consumes `/auth/turnstile/config`, renders the inline widget explicitly inside the existing login form, and forwards tokens to the authoritative runtime/Auth endpoints for email-password and OAuth auth starts.

## Task 3Z - Auth Surface Login Repair Follow-up - 2026-04-05

### Technical
- Kept the working Creator Turnstile/login flow intact while replacing the old alternate-surface selector text on `login/index.html` with the collapsed `Login to other surfaces` treatment.
- Added the supporting `ss-public.svg`, `ss-creator.svg`, `ss-admin.svg`, and `ss-developer.svg` assets under `assets/icons/ui/`, updated `css/overrides.css` for the compact collapsed link treatment, and added a lightweight source-audit test at `tests/auth-surface-links.test.mjs`.

### Human
- Creator login keeps the existing auth behavior, but the alternate destination links now read like a quiet secondary option instead of an awkward inline label list.
- Recorded the auth-hardening milestone explicitly in the repo bump notes after the interrupted rollout had shipped code without a matching root-note update.

### Human-Readable Notes

- Creator sign-in now keeps the existing login UX while adding the inline security check before password or OAuth login starts.

### Files / Areas Touched

- `BUMP_NOTES.md`

### Risks / Follow-Ups

- Creator auth still depends on the runtime's same-origin auth proxy and access-gate responses; any stale Pages deploy paired with a newer runtime contract can still produce UI drift until both sides are deployed together.
