# StreamSuites-Creator
Creator dashboard for StreamSuites™.

## About
This repository hosts the **creator-facing dashboard** deployed via GitHub Pages to
https://creator.streamsuites.app. The dashboard is a **read-only surface** that consumes
runtime exports (for example, JSON snapshots under `data/` and runtime-provided feeds) and
intentionally avoids admin-only mutation endpoints.

Creator-facing links that point to other StreamSuites surfaces always use absolute URLs:
- Public site: https://streamsuites.app
- Admin dashboard: https://admin.streamsuites.app

Future tier scaffolding (Open / Gold / Pro) is intentional and remains inactive for now.

## Repo Structure:
```StreamSuites-Creator/
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
│   ├── creators.js
│   ├── jobs.js
│   ├── platforms.js
│   ├── settings.js
│   ├── state.js
│   └── render.js
├── css/
│   ├── layout.css
│   ├── components.css
│   └── overrides.css
├── data/
│   └── *.json
└── favicon.ico
```
