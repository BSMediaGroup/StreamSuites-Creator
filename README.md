# StreamSuites-Creator
Creator dashboard for StreamSuites™.

## About
This repository hosts the **creator-only, authenticated dashboard** deployed via GitHub
Pages from the repository root to https://creator.streamsuites.app. The dashboard is a
**read-only surface** that consumes runtime exports (for example, JSON snapshots under
`data/` and runtime-provided feeds) and intentionally avoids admin-only mutation endpoints.

Creator authentication is handled via the central StreamSuites Auth API
(`https://api.streamsuites.app`) using **cookie-based sessions**. The client-side auth
surface consumes `https://api.streamsuites.app/auth/session` for session state, and logout
is performed against `https://api.streamsuites.app/auth/logout`. All creator dashboard
surfaces require authentication and are restricted to the `creator` role, with lockout UX
shown for any other authenticated role. Login supports OAuth providers plus email
magic-link sign-in. Tier scaffolding is present for `OPEN`, `GOLD`, and `PRO`, with `OPEN`
as the default.

The creator dashboard now includes a **soft-gated, resumable onboarding flow** that runs
after authentication. Onboarding progress is persisted server-side, resumes at the last
incomplete step, and scaffolds tier awareness for `OPEN`, `GOLD`, and `PRO` alongside
placeholder integrations.

Root-absolute asset loading is required (`/css/...`, `/js/...`, `/assets/...`), and all CSS,
JS, and static assets referenced by the Creator dashboard must live in this repository for
local completeness. Platform views are scoped per destination (Rumble, YouTube, Twitch,
Kick, and Pilled) and are accessible from the overview surface and sidebar navigation.
Version/build metadata is consumed from the runtime export at
`/runtime/exports/version.json`; this repository does not define version/build values and
only displays the runtime-provided metadata. The creator dashboard is read-only and does
not mutate admin data.

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
│   ├── onboarding.html
│   ├── overview.html
│   ├── plans.html
│   ├── tallies.html
│   ├── scoreboards.html
│   ├── settings.html
│   ├── updates.html
│   └── platforms/
│       ├── kick.html
│       ├── pilled.html
│       ├── rumble.html
│       ├── twitch.html
│       └── youtube.html
├── js/
│   ├── auth.js
│   ├── app.js
│   ├── onboarding.js
│   ├── onboarding-page.js
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
│   ├── creator-dashboard.css
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
