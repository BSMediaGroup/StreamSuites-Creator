# StreamSuites-Creator
Creator dashboard for StreamSuites™.

## About
This repository hosts the **creator-only, authenticated dashboard** and the **static
Creator web surface** deployed via **GitHub Pages from the repository root** to
https://creator.streamsuites.app. The dashboard is a **read-only surface** that consumes
runtime exports (for example, JSON snapshots under `data/` and runtime-provided feeds) and
intentionally avoids admin-only mutation endpoints. It is not an authoritative source of
truth; all state is hydrated at runtime and the repo serves static assets only.

Creator authentication is handled via the central StreamSuites Auth API
(`https://api.streamsuites.app`) using **cookie-based sessions**. The client-side auth
surface consumes `https://api.streamsuites.app/auth/session` for session state, and logout
is performed against `https://api.streamsuites.app/auth/logout`. All creator dashboard
surfaces require authentication and are restricted to the `creator` role, with lockout UX
shown for any other authenticated role. Login supports OAuth providers plus email
magic-link sign-in. Tier scaffolding is present for `OPEN`, `GOLD`, and `PRO`, with `OPEN`
as the default.

Data hydration is performed at runtime via two sources:
- **Runtime exports** (such as `/runtime/exports/version.json` and JSON snapshots under
  `data/`).
- **Auth API session state** from `https://api.streamsuites.app/auth/session`.

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

This repository is **separate from**:
- The **public marketing site** at https://streamsuites.app.
- The **admin dashboard** at https://admin.streamsuites.app.
- The **core runtime** that generates exports and persists authoritative data.

Future tier scaffolding (Open / Gold / Pro) is intentional and remains inactive for now.

## README change disclosure
The **About** section was updated to explicitly describe the static web surface, GitHub
Pages deployment from the repository root, runtime data hydration sources, and the lack of
authoritative state. No sections were removed; wording was replaced to incorporate the new
requirements.

## Repo Structure:
```StreamSuites-Creator/
├── .gitignore
├── CNAME
├── COMMERCIAL-LICENSE-NOTICE.md
├── EULA.md
├── LICENSE
├── README.md
├── Thumbs.db
├── assets
│   ├── backgrounds
│   │   ├── .gitkeep
│   │   ├── SS-YTBANNER-01.png
│   │   ├── STSS-RUMBLEBANNER-01.png
│   │   ├── Thumbs.db
│   │   ├── seodash.jpg
│   │   ├── seodashxS1.png
│   │   └── seoshare.jpg
│   ├── fonts
│   │   ├── .gitkeep
│   │   ├── Recharge-Bold.otf
│   │   └── SuiGeneris-Regular.otf
│   ├── icons
│   │   ├── .gitkeep
│   │   ├── Thumbs.db
│   │   ├── browser-extension.svg
│   │   ├── dcbadge.svg
│   │   ├── discord-0.svg
│   │   ├── discord-muted.svg
│   │   ├── discord-silver.svg
│   │   ├── discord-white.svg
│   │   ├── discord.svg
│   │   ├── favicon.ico
│   │   ├── github-0.svg
│   │   ├── github-muted.svg
│   │   ├── github-silver.svg
│   │   ├── github-white.svg
│   │   ├── github.svg
│   │   ├── google-0.svg
│   │   ├── google-muted.svg
│   │   ├── google-silver.svg
│   │   ├── google-white.svg
│   │   ├── google.svg
│   │   ├── kick-0.svg
│   │   ├── kick-muted.svg
│   │   ├── kick-silver.svg
│   │   ├── kick-white.svg
│   │   ├── kick.svg
│   │   ├── mod.svg
│   │   ├── obs-0.svg
│   │   ├── obs-silver.svg
│   │   ├── obs-white.svg
│   │   ├── obs.svg
│   │   ├── pilled-0.svg
│   │   ├── pilled-muted.svg
│   │   ├── pilled-silver.svg
│   │   ├── pilled-white.svg
│   │   ├── pilled.svg
│   │   ├── prossuser.svg
│   │   ├── prouser.svg
│   │   ├── rumble-0.svg
│   │   ├── rumble-muted.svg
│   │   ├── rumble-silver.svg
│   │   ├── rumble-white.svg
│   │   ├── rumble.svg
│   │   ├── studioconmain.ico
│   │   ├── twitch-0.svg
│   │   ├── twitch-muted.svg
│   │   ├── twitch-silver.svg
│   │   ├── twitch-white.svg
│   │   ├── twitch.svg
│   │   ├── twitter-0.svg
│   │   ├── twitter-muted.svg
│   │   ├── twitter-silver.svg
│   │   ├── twitter-square-0.svg
│   │   ├── twitter-square-muted.svg
│   │   ├── twitter-square-silver.svg
│   │   ├── twitter-square-white.svg
│   │   ├── twitter-square.svg
│   │   ├── twitter-white.svg
│   │   ├── twitter.svg
│   │   ├── ui
│   │   │   ├── admin.svg
│   │   │   ├── api.svg
│   │   │   ├── automation.svg
│   │   │   ├── bot.svg
│   │   │   ├── brick.svg
│   │   │   ├── browser.svg
│   │   │   ├── cards.svg
│   │   │   ├── clickpoint.svg
│   │   │   ├── codeblock.svg
│   │   │   ├── cog.svg
│   │   │   ├── dashboard.svg
│   │   │   ├── dashgear.svg
│   │   │   ├── devices.svg
│   │   │   ├── emoji.svg
│   │   │   ├── extension.svg
│   │   │   ├── globe.svg
│   │   │   ├── identity.svg
│   │   │   ├── inputs.svg
│   │   │   ├── joystick.svg
│   │   │   ├── memory.svg
│   │   │   ├── options.svg
│   │   │   ├── package.svg
│   │   │   ├── pc.svg
│   │   │   ├── plus.svg
│   │   │   ├── portal.svg
│   │   │   ├── profile.svg
│   │   │   ├── send.svg
│   │   │   ├── settingsquare.svg
│   │   │   ├── sidebar.svg
│   │   │   ├── storage.svg
│   │   │   ├── switch.svg
│   │   │   ├── terminal.svg
│   │   │   ├── tune.svg
│   │   │   ├── ui.svg
│   │   │   ├── uiscreen.svg
│   │   │   ├── webhook.svg
│   │   │   ├── widget.svg
│   │   │   └── windows.svg
│   │   ├── win1.ico
│   │   ├── x.svg
│   │   ├── youtube-0.svg
│   │   ├── youtube-muted.svg
│   │   ├── youtube-silver.svg
│   │   ├── youtube-white.svg
│   │   └── youtube.svg
│   ├── illustrations
│   │   └── .gitkeep
│   ├── logos
│   │   ├── LOG2-3D-SML.png
│   │   ├── LOG2-3D.png
│   │   ├── LOG2TRIM-SML.png
│   │   ├── LOG2TRIM.ico
│   │   ├── LOG2TRIM.png
│   │   ├── admingold.ico
│   │   ├── admingold.png
│   │   ├── admingold.webp
│   │   ├── adminredshield.png
│   │   ├── adminredshield.webp
│   │   ├── adminshieldcon.ico
│   │   ├── adminshieldcon.png
│   │   ├── adminshieldcon.webp
│   │   ├── adminshieldcongold.png
│   │   ├── adminshieldcongold.webp
│   │   ├── adminx.ico
│   │   ├── adminx.png
│   │   ├── adminx.webp
│   │   ├── bsmgx.png
│   │   ├── bsmgx.svg
│   │   ├── bsmgy.png
│   │   ├── bsmgy.svg
│   │   ├── dclive.svg
│   │   ├── dcliveblack.png
│   │   ├── dcliveblack.svg
│   │   ├── dcx.svg
│   │   ├── docscon.ico
│   │   ├── docscon.png
│   │   ├── docscon3d.ico
│   │   ├── docscon3d.png
│   │   ├── docscon3d.webp
│   │   ├── favicon.ico
│   │   ├── loghealth-green.ico
│   │   ├── loghealth-green.png
│   │   ├── loghealth-red.ico
│   │   ├── loghealth-red.png
│   │   ├── loghealth-yellow.ico
│   │   ├── loghealth-yellow.png
│   │   ├── logo.ico
│   │   ├── logo.png
│   │   ├── logocircle.png
│   │   ├── logocircle.svg
│   │   ├── logoshield-gold.ico
│   │   ├── logoshield-gold.png
│   │   ├── logoshield-white.ico
│   │   ├── logoshield-white.png
│   │   ├── logoshield-white3dx.ico
│   │   ├── logoshield-white3dx.png
│   │   ├── logoshield-white3dx.webp
│   │   ├── logoshield-whitex.webp
│   │   ├── logoshield.png
│   │   ├── logoshield.svg
│   │   ├── newcon.ico
│   │   ├── pubcon.ico
│   │   ├── pubcon.png
│   │   ├── pubcon.webp
│   │   ├── seodash.jpg
│   │   ├── ssblueshield.png
│   │   ├── ssblueshield.webp
│   │   ├── sscmatte.ico
│   │   ├── sscmatte.png
│   │   ├── sscmatte.webp
│   │   ├── sscmatteblue.png
│   │   ├── sscmatteblue.webp
│   │   ├── sscmattegold.png
│   │   ├── sscmattegold.webp
│   │   ├── sscmattepfp.png
│   │   ├── sscmattepfpdark.png
│   │   ├── sscmattepurple.png
│   │   ├── sscmattered.png
│   │   ├── sscmattered.webp
│   │   ├── sscmattesilver.ico
│   │   ├── sscmattesilver.png
│   │   ├── sscmattesilver.webp
│   │   ├── sscmattex.ico
│   │   ├── sscmattex.png
│   │   ├── ssconchrome.ico
│   │   ├── ssconchrome.png
│   │   ├── ssconchrome.webp
│   │   ├── ssconchromeblue.ico
│   │   ├── ssconchromeblue.png
│   │   ├── ssconchromeblue.webp
│   │   ├── ssicon.ico
│   │   ├── ssicon.png
│   │   ├── ssicon.webp
│   │   ├── ssnewcon.ico
│   │   ├── ssnewcon.png
│   │   ├── ssnewcon.webp
│   │   ├── ssnewfavicon.ico
│   │   ├── ssnewfavicon.png
│   │   ├── sspfpbluechrome.png
│   │   ├── sspfpchrome.png
│   │   ├── sswm.png
│   │   ├── ssxshieldblack.ico
│   │   ├── ssxshieldblack.png
│   │   ├── ssxshieldblack.webp
│   │   ├── ssxshieldblue.ico
│   │   ├── ssxshieldblue.png
│   │   ├── ssxshieldblue.webp
│   │   ├── ssxshieldred.ico
│   │   ├── ssxshieldred.png
│   │   ├── ssxshieldred.webp
│   │   ├── ssxshieldsilver.ico
│   │   ├── ssxshieldsilver.png
│   │   ├── ssxshieldsilver.webp
│   │   ├── streamsuites.svg
│   │   ├── studioconmain.ico
│   │   ├── xbsmgmainx1.png
│   │   ├── xbsmgmainx1.svg
│   │   ├── xbsmgshield.png
│   │   ├── xbsmgshield.svg
│   │   ├── xbsmgy.png
│   │   └── xbsmgy.svg
│   └── placeholders
│       ├── .gitkeep
│       ├── daniel.png
│       ├── hotdog.jpg
│       └── streamsuites.jpg
├── auth
│   ├── login.html
│   └── success.html
├── css
│   ├── base.css
│   ├── components.css
│   ├── creator-dashboard.css
│   ├── layout.css
│   ├── overrides.css
│   ├── theme-dark.css
│   └── updates.css
├── data
│   ├── creators.json
│   ├── jobs.json
│   ├── platforms.json
│   └── runtime_snapshot.json
├── favicon.ico
├── index.html
├── js
│   ├── app.js
│   ├── auth.js
│   ├── creators.js
│   ├── jobs.js
│   ├── onboarding-page.js
│   ├── onboarding.js
│   ├── platforms.js
│   ├── render.js
│   ├── settings.js
│   ├── state.js
│   └── utils
│       ├── version-stamp.js
│       └── versioning.js
└── views
    ├── creators.html
    ├── design.html
    ├── jobs.html
    ├── onboarding.html
    ├── overview.html
    ├── plans.html
    ├── platforms
    │   ├── kick.html
    │   ├── pilled.html
    │   ├── rumble.html
    │   ├── twitch.html
    │   └── youtube.html
    ├── scoreboards.html
    ├── settings.html
    ├── tallies.html
    ├── triggers.html
    └── updates.html
```
