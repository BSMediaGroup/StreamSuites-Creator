# StreamSuites-Creator (v0.4.1-alpha)

Creator dashboard for StreamSuites.

## About
This repository contains the **static creator web surface** deployed from the repository root to:

- https://creator.streamsuites.app

The surface is read-only and does **not** originate authoritative state. It hydrates at runtime from:

- Runtime export endpoints (including version/build metadata)
- StreamSuites Auth/API responses

## Versioning
Release target for this repository surface is **v0.4.1-alpha**.

Canonical displayed version/build values are runtime-provided (not hardcoded in this repo):

- `https://admin.streamsuites.app/runtime/exports/version.json`

The creator footer/version UI and version stamp utilities consume runtime export metadata at runtime.

## Creator Surface Model
- Static frontend only (HTML/CSS/JS served from repo root).
- Session/auth state comes from `https://api.streamsuites.app/auth/session`.
- Logout uses `https://api.streamsuites.app/auth/logout`.
- Authenticated creator role is required for dashboard surfaces.
- Non-creator authenticated sessions are soft-locked out of creator content.
- No admin mutation endpoints are owned or authored here.

## Auth + Access
Implemented login/auth flows include:

- OAuth: Google, GitHub, Discord, X, Twitch
- Email/password login
- Email signup + verification resend
- Session polling/rehydration and lockout UX

Tier scaffolding present in current creator UI:

- `CORE`
- `GOLD`
- `PRO`

## What's New / Highlights (v0.4.1-alpha)
Current creator surface includes the following implemented areas:

- Creator shell refresh with sidebar/topbar route model and read-only dashboard views.
- Footer/status UX upgrades:
  - Runtime-driven version/build stamp in footer
  - Creator ID display/copy control
  - Inline service-status widget (Statuspage-backed)
- Expanded auth UX:
  - OAuth + manual auth panels
  - Role-aware lockout and session-expiration handling
  - Onboarding-required routing behavior
- Notifications hydration path:
  - Runtime fetch from creator notifications API
  - Local read/mute state persistence
  - Seed fallback when live notifications are unavailable
- Statistics view (Phase 0 placeholder):
  - Sidebar-routed `Statistics` surface for creator metrics
  - Overview `Latest Stream Snapshot` card linked to the statistics route
  - Hydrates from `GET /api/creator/stats` with in-memory session caching
  - Uses API-provided chart contracts (`data.growth_series.daily_points` and
    `data.platform_share`) with client-side quality-symbol formatting

## Boundaries
This repository is separate from:

- Public site: https://streamsuites.app
- Admin dashboard/runtime: https://admin.streamsuites.app
- Core systems that persist authoritative state

## Repository Structure (Abridged, Accurate)
> `assets/` is intentionally redacted/truncated below. No build/temp output directories are present at repo root.

```text
StreamSuites-Creator/
|-- .gitignore
|-- 404.html
|-- CNAME
|-- COMMERCIAL-LICENSE-NOTICE.md
|-- EULA.md
|-- LICENSE
|-- README.md
|-- Thumbs.db
|-- favicon.ico
|-- index.html
|-- assets/
|   `-- [truncated: backgrounds/, fonts/, icons/, illustrations/, logos/, placeholders/, files...]
|-- auth/
|   |-- login.html
|   `-- success.html
|-- css/
|   |-- base.css
|   |-- components.css
|   |-- creator-dashboard.css
|   |-- layout.css
|   |-- overrides.css
|   |-- status-widget.css
|   |-- theme-dark.css
|   `-- updates.css
|-- data/
|   |-- creators.json
|   |-- jobs.json
|   |-- platforms.json
|   `-- runtime_snapshot.json
|-- js/
|   |-- app.js
|   |-- account-settings.js
|   |-- auth.js
|   |-- creator-stats.js
|   |-- creators.js
|   |-- feature-gate.js
|   |-- jobs.js
|   |-- notifications.js
|   |-- onboarding-page.js
|   |-- onboarding.js
|   |-- plans.js
|   |-- platforms.js
|   |-- render.js
|   |-- settings.js
|   |-- state.js
|   |-- status-widget.js
|   |-- triggers.js
|   `-- utils/
|       |-- notifications-store.js
|       |-- stats-formatting.js
|       |-- version-stamp.js
|       `-- versioning.js
`-- views/
    |-- account.html
    |-- creators.html
    |-- design.html
    |-- jobs.html
    |-- notifications.html
    |-- onboarding.html
    |-- overview.html
    |-- plans.html
    |-- statistics.html
    |-- scoreboards.html
    |-- settings.html
    |-- tallies.html
    |-- triggers.html
    |-- updates.html
    |-- modules/
    |   |-- clips.html
    |   |-- livechat.html
    |   |-- overlays.html
    |   `-- polls.html
    `-- platforms/
        |-- discord.html
        |-- kick.html
        |-- pilled.html
        |-- rumble.html
        |-- twitch.html
        `-- youtube.html
```
