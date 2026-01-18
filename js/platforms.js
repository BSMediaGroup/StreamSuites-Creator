/* ============================================================
   StreamSuites Dashboard — platforms.js
   ============================================================

   Responsibilities:
   - Bind platform service toggles to persisted config
   - Persist platform notes + telemetry flags to localStorage (via ConfigState)
   - Surface a shared accessor for platform state across views

   SAFE FOR:
   - GitHub Pages
   - Offline authoring
   ============================================================ */

(() => {
  "use strict";

  const PLATFORM_KEYS = ["youtube", "twitch", "kick", "pilled", "rumble"];
  const LOCKED_PLATFORMS = { rumble: true, pilled: true };
  const INTENT_STORAGE_KEY = "streamsuites.platformIntent";

  const el = {
    rows: {}
  };

  let platforms = null;
  let runtimeSnapshot = null;
  let intent = null;
  let wired = false;

  /* ------------------------------------------------------------
     DOM CACHE
     ------------------------------------------------------------ */

  function cacheElements() {
    PLATFORM_KEYS.forEach((key) => {
      el.rows[key] = {
        enabled: document.querySelector(
          `[data-platform-row="${key}"] input[data-field="enabled"]`
        ),
        telemetry: document.querySelector(
          `[data-platform-row="${key}"] input[data-field="telemetry_enabled"]`
        ),
        notes: document.querySelector(
          `[data-platform-row="${key}"] textarea[data-field="notes"]`
        )
      };

      const status = document.querySelector(
        `[data-platform-status="${key}"]`
      );

      if (status) {
        el.rows[key].status = status;
      }
    });
  }

  /* ------------------------------------------------------------
     INIT / DESTROY
     ------------------------------------------------------------ */

  async function initSettingsView() {
    cacheElements();
    wired = false;
    await hydratePlatforms();
    wireEvents();
    renderRows();
  }

  function destroy() {
    wired = false;
  }

  /* ------------------------------------------------------------
     HYDRATION + RENDER
     ------------------------------------------------------------ */

  function normalizeIntent(raw) {
    if (!raw || typeof raw !== "object") return { platforms: {} };

    const normalized = { platforms: {} };
    PLATFORM_KEYS.forEach((key) => {
      const enabled = raw.platforms?.[key]?.enabled;
      if (enabled === true || enabled === false) {
        normalized.platforms[key] = { enabled };
      }
    });

    return normalized;
  }

  function loadIntent() {
    try {
      const stored =
        window.App?.storage?.loadFromLocalStorage?.(INTENT_STORAGE_KEY, null) ||
        null;
      intent = normalizeIntent(stored);
    } catch (err) {
      console.warn("[Platforms] Unable to load platform intent", err);
      intent = { platforms: {} };
    }
  }

  function exportIntentFile() {
    if (!intent) return;
    const payload = {
      generated_at: new Date().toISOString(),
      platforms: {}
    };

    PLATFORM_KEYS.forEach((key) => {
      const enabled = intent.platforms?.[key]?.enabled;
      if (enabled === true || enabled === false) {
        payload.platforms[key] = { enabled };
      }
    });

    try {
      window.App?.storage?.saveToLocalStorage?.(INTENT_STORAGE_KEY, payload);
      window.App?.storage?.downloadJson?.("platform_toggles.delta.json", payload);
    } catch (err) {
      console.warn("[Platforms] Unable to persist intent payload", err);
    }
  }

  function updateIntent(key, enabled) {
    if (!intent) intent = { platforms: {} };
    intent.platforms[key] = { enabled };
    exportIntentFile();
  }

  async function hydratePlatforms(forceReload = false) {
    loadIntent();

    try {
      runtimeSnapshot =
        (await window.StreamSuitesState?.loadRuntimeSnapshot?.({ forceReload })) ||
        null;
    } catch (err) {
      console.warn("[Platforms] Unable to hydrate runtime snapshot", err);
      runtimeSnapshot = null;
    }

    try {
      const platformConfig =
        (await window.ConfigState?.loadPlatforms?.({ forceReload })) || null;

      const runtimePlatforms = runtimeSnapshot?.platforms || {};
      const configPlatforms = platformConfig?.platforms || {};

      const merged = {};
      PLATFORM_KEYS.forEach((key) => {
        const runtimeEntry = runtimePlatforms[key] || {};
        const configEntry = configPlatforms[key] || {};
        const enabled =
          typeof runtimeEntry.enabled === "boolean"
            ? runtimeEntry.enabled
            : !!configEntry.enabled;
        const telemetryEnabled =
          typeof runtimeEntry.telemetry_enabled === "boolean"
            ? runtimeEntry.telemetry_enabled
            : !!configEntry.telemetry_enabled;
        merged[key] = {
          enabled,
          telemetry_enabled: telemetryEnabled,
          notes: configEntry.notes || runtimeEntry.notes || ""
        };
      });

      platforms = { schema: "streamsuites.platforms.v1", platforms: merged };
    } catch (err) {
      console.warn("[Platforms] Unable to hydrate platform config", err);
      platforms = null;
    }
  }

  function renderRows() {
    if (!platforms || !platforms.platforms) return;

    PLATFORM_KEYS.forEach((key) => {
      const row = el.rows[key];
      if (!row) return;

      const locked = LOCKED_PLATFORMS[key] === true;

      const state = platforms.platforms[key] || {};
      const desired = intent?.platforms?.[key]?.enabled;
      const runtimeEnabled = getRuntimeEnabled(key);
      const effectiveEnabled =
        desired === true || desired === false
          ? desired
          : runtimeEnabled === true || runtimeEnabled === false
            ? runtimeEnabled
            : !!state.enabled;

      if (row.enabled) {
        row.enabled.checked = !!effectiveEnabled;
        row.enabled.disabled = !!row.enabled.dataset.locked || locked;
      }
      if (row.telemetry) {
        row.telemetry.checked = !!state.telemetry_enabled;
        row.telemetry.disabled = !!row.telemetry.dataset.locked || locked;
      }
      if (row.notes) {
        row.notes.value = state.notes || "";
        row.notes.disabled = false;
      }

      if (row.status) {
        row.status.textContent = describeRestartStatus(desired, runtimeEnabled);
      }
    });
  }

  function getRuntimeEnabled(key) {
    const entry = runtimeSnapshot?.platforms?.[key];
    if (!entry) return null;
    return typeof entry.enabled === "boolean" ? entry.enabled : null;
  }

  function describeRestartStatus(desired, runtimeEnabled) {
    if (desired === true || desired === false) {
      if (runtimeEnabled === true || runtimeEnabled === false) {
        return desired === runtimeEnabled
          ? "Aligned with runtime"
          : "Pending restart (intent written)";
      }
      return "Pending restart (awaiting runtime)";
    }

    if (runtimeEnabled === true || runtimeEnabled === false) {
      return runtimeEnabled ? "Enabled in runtime" : "Disabled in runtime";
    }

    return "Awaiting telemetry";
  }

  /* ------------------------------------------------------------
     EVENTS
     ------------------------------------------------------------ */

  function wireEvents() {
    if (wired) return;

    PLATFORM_KEYS.forEach((key) => {
      const row = el.rows[key];
      if (!row) return;

      row.enabled?.addEventListener("change", () => {
        updatePlatform(key, { enabled: row.enabled.checked });
      });

      row.telemetry?.addEventListener("change", () => {
        updatePlatform(key, { telemetry_enabled: row.telemetry.checked });
      });

      row.notes?.addEventListener("input", () => {
        updatePlatform(key, { notes: row.notes.value });
      });
    });

    wired = true;
  }

  function updatePlatform(key, patch) {
    if (!platforms || !platforms.platforms) return;
    const next = { ...platforms.platforms[key], ...patch };

    platforms = window.ConfigState?.savePlatforms({
      ...platforms.platforms,
      [key]: next
    });

    if (patch.enabled === true || patch.enabled === false) {
      updateIntent(key, patch.enabled);
    }

    renderRows();
  }

  /* ------------------------------------------------------------
     ACCESSORS
     ------------------------------------------------------------ */

  function getPlatforms() {
    return platforms;
  }

  async function refresh(forceReload = true) {
    await hydratePlatforms(forceReload);
    renderRows();
    return platforms;
  }

  window.PlatformsManager = {
    initSettingsView,
    destroy,
    getPlatforms,
    refresh
  };
})();
