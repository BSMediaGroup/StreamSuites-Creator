# StreamSuites-Creator
Creator dashboard for StreamSuites™.

## About
This repository hosts the **creator-only dashboard** deployed via GitHub Pages from the
repository root to https://creator.streamsuites.app. The dashboard is a **read-only
surface** that consumes runtime exports (for example, JSON snapshots under `data/` and
runtime-provided feeds) and intentionally avoids admin-only mutation endpoints.

Creator authentication is handled via the central StreamSuites Auth API
(`https://api.streamsuites.app`) using **cookie-based sessions**. All creator dashboard
surfaces require authentication and allow `creator` and `admin` roles. Login supports
OAuth providers (Google, GitHub, Discord) plus email magic-link sign-in. Tier scaffolding
is present for `OPEN`, `GOLD`, and `PRO`, with `OPEN` as the default.

Root-absolute asset loading is required (`/css/...`, `/js/...`, `/assets/...`), and all CSS,
JS, and static assets referenced by the Creator dashboard must live in this repository for
local completeness. Version/build metadata is sourced from the Admin dashboard at
https://admin.streamsuites.app/version.json and displayed here for visibility only. The
creator dashboard is read-only and does not mutate admin data.

Creator-facing links that point to other StreamSuites surfaces always use absolute URLs:
- Public site: https://streamsuites.app
- Admin dashboard: https://admin.streamsuites.app

Future tier scaffolding (Open / Gold / Pro) is intentional and remains inactive for now.

## Repo Structure:
```StreamSuites-Creator/
├── auth/
│   ├── login.html
│   └── success.html
├── index.html
├── views/
│   ├── creators.html
│   ├── design.html
│   ├── jobs.html
│   ├── overview.html
│   ├── tallies.html
│   ├── scoreboards.html
│   ├── settings.html
│   ├── support.html
│   ├── updates.html
│   └── platforms/
│       └── *.html
├── js/
│   ├── auth.js
│   ├── app.js
│   ├── creators.js
│   ├── jobs.js
│   ├── platforms.js
│   ├── settings.js
│   ├── state.js
│   ├── render.js
│   └── utils/
│       ├── version-stamp.js
│       └── versioning.js
├── css/
│   ├── base.css
│   ├── layout.css
│   ├── components.css
│   ├── overrides.css
│   ├── theme-dark.css
│   └── updates.css
├── assets/
│   ├── backgrounds/
│   ├── fonts/
│   ├── icons/
│   ├── illustrations/
│   ├── logos/
│   └── placeholders/
├── data/
│   └── *.json
└── favicon.ico
```
