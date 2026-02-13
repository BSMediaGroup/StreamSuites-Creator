(() => {
  "use strict";

  if (!window.opener || window.name !== "ss_requests_auth") {
    return;
  }

  try {
    window.opener.postMessage("SS_REQUESTS_AUTH_COMPLETE", "https://streamsuites.app");
  } catch (_err) {
    // no-op: popup close is best-effort only
  }

  window.setTimeout(() => {
    try {
      window.close();
    } catch (_err) {
      // no-op: browser may block script-initiated close
    }
  }, 150);
})();

(() => {
  "use strict";

  /* SAFETY: ensure fetchWithTimeout always exists (SAFE MODE compatible) */
  if (typeof window.fetchWithTimeout !== "function") {
    window.fetchWithTimeout = async function (url, opts = {}, timeoutMs = 8000) {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);

      try {
        return await fetch(url, { ...opts, signal: controller.signal });
      } finally {
        clearTimeout(id);
      }
    };
  }

  const DEFAULT_STATE_ROOTS = [
    "./shared/state/",
    // Runtime repo fallback (read-only, GitHub raw)
    "https://raw.githubusercontent.com/BSMediaGroup/StreamSuites/main/shared/state/"
  ];

  const TRIGGER_MATCH_MODES = new Set(["equals_icase", "contains_icase"]);

  const STORAGE_KEY = "streamsuites.stateRootOverride";
  const CREATOR_DEBUG_MODE_KEY = "ss_creator_debug_mode";
  const LOCAL_SESSION_KEY = "streamsuites.creator.session";
  const ADMIN_ROLE_ALIASES = new Set([
    "admin",
    "administrator",
    "super_admin",
    "superadmin",
    "owner"
  ]);

  const RUNTIME_AVAILABILITY_FLAG = "__RUNTIME_AVAILABLE__";
  const RUNTIME_OFFLINE_FLAG = "__STREAMSUITES_RUNTIME_OFFLINE__";
  const STATE_FETCH_TIMEOUT_MS = 1500;

  /* Tracks which missing state files have already been logged this boot */
  const _missingStateLogged = new Set();
  const stateCache = {};

  const cache = {
    runtimeSnapshot: null,
    quotas: null,
    adminActivity: null
  };

  const DEFAULT_CREATOR_CONTEXT = Object.freeze({
    creatorId: null,
    permissions: Object.freeze({
      mode: "admin",
      readOnly: false
    }),
    platformScopes: Object.freeze([])
  });

  let creatorContext = null;

  const snapshotHealthModule = {
    promise: null
  };

  async function getSnapshotHealthModule() {
    if (snapshotHealthModule.promise) return snapshotHealthModule.promise;

    snapshotHealthModule.promise = import("./utils/snapshot-health.js").catch((err) => {
      console.warn("[Dashboard][State] Snapshot health module failed to load", err);
      return null;
    });

    return snapshotHealthModule.promise;
  }

  async function reportSnapshotHealth(rawSnapshot) {
    const module = await getSnapshotHealthModule();
    if (!module || typeof module.evaluateSnapshotHealth !== "function") return;

    try {
      const health = module.evaluateSnapshotHealth(rawSnapshot);
      const render =
        module.renderSnapshotHealthBanner || module.renderSnapshotWarning || (() => {});
      render(health);
    } catch (err) {
      console.warn("[Dashboard][State] Snapshot health evaluation failed", err);
    }
  }

  function deepClone(obj) {
    if (obj === null || obj === undefined) return obj;
    return JSON.parse(JSON.stringify(obj));
  }

  creatorContext = deepClone(DEFAULT_CREATOR_CONTEXT);

  if (typeof window[RUNTIME_AVAILABILITY_FLAG] === "undefined") {
    window[RUNTIME_AVAILABILITY_FLAG] = false;
  }
  if (typeof window[RUNTIME_OFFLINE_FLAG] === "undefined") {
    window[RUNTIME_OFFLINE_FLAG] = window[RUNTIME_AVAILABILITY_FLAG] === false;
  }

  let runtimeUnavailableLogged = false;
  let runtimeDetectedLogged = false;

  function markRuntimeAvailable() {
    if (window[RUNTIME_AVAILABILITY_FLAG] === true) return;
    window[RUNTIME_AVAILABILITY_FLAG] = true;
    window[RUNTIME_OFFLINE_FLAG] = false;
    if (!runtimeDetectedLogged) {
      runtimeDetectedLogged = true;
      console.info("[Dashboard] Runtime detected via state JSON.");
    }
  }

  function markRuntimeUnavailable() {
    if (window[RUNTIME_AVAILABILITY_FLAG] === false) return;
    window[RUNTIME_AVAILABILITY_FLAG] = false;
    window[RUNTIME_OFFLINE_FLAG] = true;
    if (!runtimeUnavailableLogged) {
      runtimeUnavailableLogged = true;
      console.info("[Dashboard] Runtime not available (static mode).");
    }
  }

  function normalizeRole(role) {
    if (typeof role !== "string") return "";
    return role.trim().toLowerCase();
  }

  function isAdminRole(role) {
    const normalized = normalizeRole(role);
    return normalized ? ADMIN_ROLE_ALIASES.has(normalized) : false;
  }

  function readDebugModeFlag() {
    try {
      return localStorage.getItem(CREATOR_DEBUG_MODE_KEY) === "1";
    } catch (_err) {
      return false;
    }
  }

  function readPersistedSessionRole() {
    try {
      const raw = localStorage.getItem(LOCAL_SESSION_KEY);
      if (!raw) return "";
      const parsed = JSON.parse(raw);
      return typeof parsed?.role === "string" ? parsed.role : "";
    } catch (_err) {
      return "";
    }
  }

  function isCreatorDebugModeActive() {
    const appMode = window.App?.creatorDebugMode;
    if (appMode && appMode.enabled === true && appMode.eligible === true) {
      return true;
    }
    const role = window.App?.session?.role || readPersistedSessionRole();
    return readDebugModeFlag() && isAdminRole(role);
  }

  function resolveDebugStatePath(relativePath) {
    const normalized =
      typeof relativePath === "string"
        ? relativePath.trim().replace(/^\.?\//, "")
        : "";
    if (!normalized) return null;

    if (normalized === "runtime_snapshot.json") return "./data/runtime_snapshot.json";
    if (normalized === "jobs.json") return "./data/jobs.json";
    if (normalized === "quotas.json") return "./data/quotas.json";
    if (normalized === "admin_activity.json") return "./data/admin_activity.json";

    return null;
  }

  function getCreatorContext() {
    if (!creatorContext) {
      creatorContext = deepClone(DEFAULT_CREATOR_CONTEXT);
    }
    return deepClone(creatorContext);
  }

  function deriveCreatorContext(options = {}) {
    const params = new URLSearchParams(window.location.search);
    const requestedCreator = options.creatorId ?? params.get("creatorId");
    const normalizedCreator =
      typeof requestedCreator === "string" && requestedCreator.trim()
        ? requestedCreator.trim()
        : null;

    const scopeValue = options.platformScopes ?? params.get("platformScopes");
    let platformScopes = [];

    if (Array.isArray(scopeValue)) {
      platformScopes = scopeValue
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter(Boolean);
    } else if (typeof scopeValue === "string" && scopeValue.trim()) {
      platformScopes = scopeValue
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
    }

    const mode = normalizedCreator ? "creator" : "admin";

    return {
      creatorId: normalizedCreator,
      permissions: {
        mode,
        readOnly: options.readOnly === true || mode === "creator"
      },
      platformScopes
    };
  }

  function loadCreatorContext(options = {}) {
    creatorContext = deriveCreatorContext(options);

    if (window.App) {
      window.App.creatorContext = deepClone(creatorContext);
    }

    return getCreatorContext();
  }

  function normalizeRoot(root) {
    if (typeof root !== "string" || !root.trim()) return null;
    return root.trim().replace(/\/+$/, "/");
  }

  function getConfiguredStateRoots() {
    const roots = [];

    try {
      const params = new URLSearchParams(window.location.search);
      const overrideParam = normalizeRoot(params.get("stateRoot"));
      if (overrideParam) {
        localStorage.setItem(STORAGE_KEY, overrideParam);
        roots.push(overrideParam);
      }

      const storedOverride = normalizeRoot(localStorage.getItem(STORAGE_KEY));
      if (storedOverride && !roots.includes(storedOverride)) {
        roots.push(storedOverride);
      }
    } catch (err) {
      console.warn("[Dashboard][State] Failed to read state root override", err);
    }

    for (const root of DEFAULT_STATE_ROOTS) {
      const normalized = normalizeRoot(root);
      if (normalized && !roots.includes(normalized)) {
        roots.push(normalized);
      }
    }

    return roots;
  }

  function buildStateUrl(root, relativePath) {
    try {
      return new URL(`${root}${relativePath}`, document.baseURI);
    } catch (err) {
      console.warn("[Dashboard][State] Failed to build URL", err);
      return null;
    }
  }

  async function fetchWithTimeout(url, options = {}, timeoutMs = STATE_FETCH_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal,
        timeoutMs: 0
      });
    } finally {
      clearTimeout(timer);
    }
  }

  async function loadStateJson(relativePath) {
    if (isCreatorDebugModeActive()) {
      const debugPath = resolveDebugStatePath(relativePath);
      if (!debugPath) {
        return null;
      }
      return fetchFallbackJson(debugPath);
    }

    if (
      window[RUNTIME_OFFLINE_FLAG] === true &&
      Object.prototype.hasOwnProperty.call(stateCache, relativePath)
    ) {
      return stateCache[relativePath];
    }

    console.log("[BOOT:STATE:ENTER] loadStateJson", relativePath, performance.now());
    const roots = getConfiguredStateRoots();
    const attempts = roots.slice(0, 2);

    for (const root of attempts) {
      const url = buildStateUrl(root, relativePath);
      if (!url) continue;

      try {
        const res = await fetchWithTimeout(url, { cache: "no-store" });
        if (res.status === 404) {
          if (!_missingStateLogged.has(relativePath)) {
            console.info(
              `[State][Offline] ${relativePath} not present (runtime offline or export not yet generated)`
            );
            _missingStateLogged.add(relativePath);
          }
          stateCache[relativePath] = null;
          return null;
        }
        if (!res.ok) continue;
        const data = await res.json();
        console.log(
          "[BOOT:STATE:EXIT] loadStateJson OK",
          relativePath,
          performance.now()
        );
        return data;
      } catch (err) {
        const isAbort = err?.name === "AbortError";
        console.warn(
          "[BOOT:STATE:EXIT] loadStateJson FAIL",
          relativePath,
          isAbort ? "timeout" : err,
          performance.now()
        );
        if (isAbort) {
          return null;
        }
      }
    }

    console.log(
      "[BOOT:STATE:EXIT] loadStateJson MISS",
      relativePath,
      performance.now()
    );
    return undefined;
  }

  async function fetchFallbackJson(relativePath) {
    try {
      const res = await fetchWithTimeout(relativePath, { cache: "no-store" });
      if (res.status === 404) return null;
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.warn(
        `[Dashboard][State] Fallback fetch failed for ${relativePath}`,
        err
      );
      return null;
    }
  }

  function pickString(...values) {
    for (const value of values) {
      if (typeof value === "string" && value.trim() !== "") {
        return value;
      }
    }
    return null;
  }

  function pickBoolean(...values) {
    for (const value of values) {
      if (value === true || value === false) {
        return value;
      }
    }
    return null;
  }

  function pickInteger(...values) {
    for (const value of values) {
      if (Number.isInteger(value)) {
        return value;
      }
    }
    return null;
  }

  function formatTimestamp(timestamp) {
    if (!timestamp) return null;
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return null;
    try {
      return date.toLocaleString(undefined, { hour12: false });
    } catch (err) {
      console.warn("[Dashboard][State] Failed to format timestamp", err);
      return timestamp;
    }
  }

  function normalizeCounters(raw) {
    if (!raw || typeof raw !== "object") return null;

    const counters = {};
    const picks = {
      messagesProcessed: ["messages_processed", "messages", "messages_seen"],
      triggersFired: ["triggers_fired", "triggers", "actions"],
      errors: ["errors", "errors_seen"]
    };

    Object.entries(picks).forEach(([key, candidates]) => {
      for (const candidate of candidates) {
        const value = raw[candidate];
        if (Number.isFinite(value)) {
          counters[key] = value;
          break;
        }
      }
    });

    return Object.keys(counters).length > 0 ? counters : null;
  }

  function normalizePlatformSnapshot(raw) {
    if (!raw || typeof raw !== "object") return null;

    const status = pickString(
      raw.status,
      raw.connection_status,
      raw.state
    ) || "unknown";

    const heartbeat = pickString(
      raw.heartbeat_at,
      raw.last_heartbeat,
      raw.last_seen
    );

    const lastUpdate = pickString(
      heartbeat,
      raw.updated_at,
      raw.last_update,
      raw.last_event,
      raw.last_message
    );

    const error =
      raw.error ?? raw.error_state ?? raw.last_error ?? raw.lastError;
    const pausedReason = pickString(raw.paused_reason, raw.pause_reason);

    return {
      platform: pickString(raw.platform, raw.id, raw.name),
      enabled: pickBoolean(raw.enabled),
      telemetryEnabled: pickBoolean(raw.telemetry_enabled),
      status,
      heartbeat,
      lastUpdate,
      pausedReason,
      error: typeof error === "string" ? error : null,
      counters: normalizeCounters(raw.counters || raw.metrics || raw.counts || {})
    };
  }

  function normalizeTriggerAction(raw) {
    if (!raw || typeof raw !== "object") return null;
    const id = pickString(raw.id);
    if (!id) return null;

    return {
      id,
      label: pickString(raw.label, id),
      description: pickString(raw.description)
    };
  }

  function normalizeTriggerEntry(raw, creatorId, index = 0) {
    if (!raw || typeof raw !== "object") return null;

    const match = pickString(raw.match);
    const action = pickString(raw.action);
    if (!match || !action) return null;

    const matchMode = TRIGGER_MATCH_MODES.has(raw.match_mode)
      ? raw.match_mode
      : "equals_icase";

    const entry = {
      id: pickString(raw.id, `${creatorId || "trigger"}-${index + 1}`),
      creator_id: creatorId || pickString(raw.creator_id),
      enabled: raw.enabled !== false,
      match,
      match_mode: matchMode,
      action
    };

    const notes = pickString(raw.notes);
    if (notes) {
      entry.notes = notes;
    }

    return entry;
  }

  function normalizeRuntimeTriggers(raw) {
    if (!raw || typeof raw !== "object") return null;

    const actions = Array.isArray(raw.actions)
      ? raw.actions.map(normalizeTriggerAction).filter(Boolean)
      : [];

    const creatorList = Array.isArray(raw.creators)
      ? raw.creators
      : raw.creators && typeof raw.creators === "object"
        ? Object.values(raw.creators)
        : [];

    const creators = creatorList
      .map((creator) => {
        const creatorId = pickString(creator.creator_id, creator.id, creator.name);
        if (!creatorId) return null;

        const displayName = pickString(creator.display_name, creator.name, creatorId);
        const triggerList = Array.isArray(creator.triggers) ? creator.triggers : [];
        const normalizedTriggers = triggerList
          .map((t, idx) => normalizeTriggerEntry(t, creatorId, idx))
          .filter(Boolean);

        return {
          creator_id: creatorId,
          display_name: displayName,
          triggers: normalizedTriggers
        };
      })
      .filter(Boolean);

    if (!actions.length && !creators.length) return null;

    return {
      schema: pickString(raw.schema, raw.schema_version),
      generatedAt: pickString(raw.generated_at, raw.generatedAt),
      actions,
      creators
    };
  }

  function normalizeRuntimeSnapshot(raw) {
    if (!raw || typeof raw !== "object") return null;

    const generatedAt = pickString(
      raw.generated_at,
      raw.updated_at,
      raw.timestamp
    );

    const platforms = Array.isArray(raw.platforms)
      ? raw.platforms
      : raw.platforms && typeof raw.platforms === "object"
        ? Object.keys(raw.platforms).map((key) => ({
          platform: key,
          ...(raw.platforms[key] || {})
        }))
        : [];

    const normalized = {};
    platforms.forEach((entry) => {
      const platform = normalizePlatformSnapshot(entry);
      if (platform && platform.platform) {
        normalized[platform.platform] = platform;
      }
    });

    const platformPollingEnabled = pickBoolean(
      raw.system?.platform_polling_enabled,
      raw.platform_polling_enabled
    );

    const system = {
      platformPollingEnabled:
        platformPollingEnabled === true || platformPollingEnabled === false
          ? platformPollingEnabled
          : null
    };

    const triggers = normalizeRuntimeTriggers(raw.admin?.triggers || raw.triggers);

    const restartIntent = normalizeRestartIntent(raw.restart_intent);

    return {
      generatedAt,
      platforms: normalized,
      system,
      triggers,
      restartIntent,
      replay: normalizeReplaySnapshot(raw.replay, generatedAt)
    };
  }

  function normalizeReplaySnapshot(raw, generatedAt = null) {
    if (!raw || typeof raw !== "object") return null;

    const available = pickBoolean(raw.available, raw.enabled, raw.active);
    const overlaySafe = pickBoolean(raw.overlay_safe, raw.overlaySafe);
    const mode = pickString(raw.mode, raw.state);
    const eventCount = pickInteger(
      raw.event_count,
      raw.events_processed,
      raw.events?.count,
      raw.events
    );
    const lastEventAt = pickString(
      raw.last_event_at,
      raw.last_event,
      raw.lastEventAt,
      raw.last_event_time,
      raw.last_seen,
      generatedAt
    );

    const platformsRaw = Array.isArray(raw.platforms)
      ? raw.platforms
      : raw.platforms && typeof raw.platforms === "object"
        ? Object.keys(raw.platforms).map((key) => ({ platform: key, ...(raw.platforms[key] || {}) }))
        : [];

    const platforms = platformsRaw
      .map((entry) => normalizeReplayPlatform(entry))
      .filter(Boolean);

    const replayState = {
      available,
      overlaySafe,
      mode,
      eventCount,
      lastEventAt,
      platforms
    };

    return Object.values(replayState).some((value) => value !== null && value !== undefined)
      ? replayState
      : null;
  }

  function normalizeReplayPlatform(raw) {
    if (!raw || typeof raw !== "object") return null;

    const platform = pickString(raw.platform, raw.id, raw.name);
    if (!platform) return null;

    return {
      platform,
      available: pickBoolean(raw.available, raw.enabled, raw.active),
      overlaySupported: pickBoolean(raw.overlay_supported, raw.overlaySafe, raw.overlay_safe),
      eventCount: pickInteger(raw.event_count, raw.events),
      lastEventAt: pickString(raw.last_event_at, raw.last_event, raw.last_seen)
    };
  }

  function normalizeRestartIntent(raw) {
    if (!raw || typeof raw !== "object") return null;

    const pendingRaw = raw.pending && typeof raw.pending === "object" ? raw.pending : {};

    const pending = {
      system: pendingRaw.system === true,
      creators: pendingRaw.creators === true,
      triggers: pendingRaw.triggers === true,
      platforms: pendingRaw.platforms === true
    };

    const hasPending = Object.values(pending).some(Boolean);
    const required = pickBoolean(raw.required);

    const summaryNotes = Array.isArray(raw.notes)
      ? raw.notes.filter((n) => typeof n === "string" && n.trim())
      : [];

    const synthesizedNotes = summaryNotes.length
      ? summaryNotes
      : Object.entries(pending)
          .filter(([, value]) => value)
          .map(([key]) => {
            if (key === "platforms") return "Platform enablement staged";
            if (key === "triggers") return "Triggers updated";
            if (key === "creators") return "Creators config modified";
            if (key === "system") return "System settings changed";
            return `${key} changes pending`;
          });

    return {
      required: required === null ? hasPending : required === true,
      pending,
      summary: synthesizedNotes
    };
  }

  async function loadRuntimeSnapshot(options = {}) {
    if (cache.runtimeSnapshot && !options.forceReload) {
      return deepClone(cache.runtimeSnapshot);
    }

    if (isCreatorDebugModeActive()) {
      const debugRaw = await fetchFallbackJson("./data/runtime_snapshot.json");
      const debugSnapshot = normalizeRuntimeSnapshot(debugRaw);
      cache.runtimeSnapshot = debugSnapshot ? { ...debugSnapshot, source: "debug" } : null;
      return cache.runtimeSnapshot ? deepClone(cache.runtimeSnapshot) : null;
    }

    const runtimeState = window.App?.state?.runtimeSnapshot;

    if (runtimeState?.getSnapshot) {
      const polled = normalizeRuntimeSnapshot(runtimeState.getSnapshot());
      const hasPlatforms = polled && Object.keys(polled.platforms).length > 0;
      const hasTriggers = polled?.triggers;
      if (polled && (hasPlatforms || hasTriggers)) {
        cache.runtimeSnapshot = { ...polled, source: "connected" };
        return deepClone(cache.runtimeSnapshot);
      }
    }

    if (options.forceReload && runtimeState?.fetchOnce) {
      try {
        await runtimeState.fetchOnce();
      } catch (err) {
        console.warn("[Dashboard][State] runtime snapshot refresh failed", err);
      }
      const refreshed = normalizeRuntimeSnapshot(runtimeState?.getSnapshot?.());
      const hasPlatforms = refreshed && Object.keys(refreshed.platforms).length > 0;
      const hasTriggers = refreshed?.triggers;
      if (refreshed && (hasPlatforms || hasTriggers)) {
        cache.runtimeSnapshot = { ...refreshed, source: "connected" };
        return deepClone(cache.runtimeSnapshot);
      }
    }

    const sharedRaw = await loadStateJson("runtime_snapshot.json");
    await reportSnapshotHealth(sharedRaw);

    const shared = normalizeRuntimeSnapshot(sharedRaw);

    cache.runtimeSnapshot = shared ? { ...shared, source: "static" } : null;
    return shared ? deepClone(cache.runtimeSnapshot) : null;
  }

  async function loadQuotasSnapshot(options = {}) {
    const normalize = (raw) => {
      if (!raw) return null;
      if (Array.isArray(raw)) return raw;
      if (Array.isArray(raw.platforms)) return raw.platforms;
      if (Array.isArray(raw.quotas)) return raw.quotas;
      return null;
    };

    if (cache.quotas && !options.forceReload) {
      return deepClone(cache.quotas);
    }

    if (isCreatorDebugModeActive()) {
      const debugQuotas = normalize(await fetchFallbackJson("./data/quotas.json"));
      cache.quotas = debugQuotas || null;
      return cache.quotas ? deepClone(cache.quotas) : null;
    }

    const quotasState = window.App?.state?.quotas;
    if (quotasState?.getSnapshot) {
      const snapshot = normalize(quotasState.getSnapshot());
      if (snapshot) {
        cache.quotas = snapshot;
        return deepClone(snapshot);
      }
    }

    if (options.forceReload && quotasState?.fetchOnce) {
      try {
        await quotasState.fetchOnce();
      } catch (err) {
        console.warn("[Dashboard][State] quota refresh failed", err);
      }

      const snapshot = normalize(quotasState?.getSnapshot?.());
      if (snapshot) {
        cache.quotas = snapshot;
        return deepClone(snapshot);
      }
    }

    const shared = normalize(await loadStateJson("quotas.json"));
    if (shared) {
      markRuntimeAvailable();
      cache.quotas = shared;
      return deepClone(shared);
    }

    markRuntimeUnavailable();
    const fallback = normalize(await fetchFallbackJson("./data/quotas.json"));
    cache.quotas = fallback || null;
    return fallback ? deepClone(fallback) : null;
  }

  function normalizeDiscordRuntime(raw) {
    if (!raw || typeof raw !== "object") return null;

    const heartbeat =
      raw.heartbeat && typeof raw.heartbeat === "object"
        ? raw.heartbeat
        : {};

    const status =
      raw.status && typeof raw.status === "object"
        ? raw.status
        : {};

    const presence =
      raw.presence && typeof raw.presence === "object"
        ? raw.presence
        : {};

    return {
      running: pickBoolean(raw.running),
      connected: pickBoolean(raw.connected, heartbeat.connected),
      guildCount: pickInteger(raw.guild_count),
      taskCount: pickInteger(raw.task_count, raw.tasks),
      lastHeartbeat: pickString(raw.last_heartbeat_ts, heartbeat.last_tick_at),
      startedAt: pickString(heartbeat.started_at, raw.started_at),
      statusText: pickString(status.text, presence.status_text),
      statusEmoji: pickString(status.emoji, presence.status_emoji),
      heartbeat
    };
  }

  function describeDiscordConnection(runtime) {
    if (!runtime) return "Not running";

    if (runtime.running === false) return "Not running";
    if (runtime.connected === true) return "Online";
    if (runtime.connected === false) return "Offline";
    if (runtime.running === true) return "Unknown";

    return "Unknown";
  }

  async function loadDiscordRuntimeSnapshot() {
    const data = await loadStateJson("discord/runtime.json");
    return normalizeDiscordRuntime(data);
  }

  function normalizeAdminActivity(raw) {
    if (!raw || typeof raw !== "object") return null;

    const events = Array.isArray(raw.events)
      ? raw.events
      : Array.isArray(raw.activity)
        ? raw.activity
        : [];

    const normalized = events
      .map((event, index) => {
        if (!event || typeof event !== "object") return null;
        const timestamp = pickString(
          event.timestamp,
          event.ts,
          event.time,
          event.occurred_at
        );

        return {
          id: pickString(event.id, event.event_id, event.key) || `event-${index}`,
          timestamp,
          source: pickString(event.source, event.origin, event.channel),
          user: pickString(event.user, event.actor, event.username),
          action: pickString(
            event.action,
            event.description,
            event.summary,
            event.message
          )
        };
      })
      .filter(Boolean);

    const toSortValue = (value) => {
      if (!value) return 0;
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return 0;
      return date.getTime();
    };

    normalized.sort((a, b) => toSortValue(b.timestamp) - toSortValue(a.timestamp));

    return {
      schema: pickString(raw.schema),
      updatedAt: pickString(raw.updated_at, raw.updatedAt),
      events: normalized
    };
  }

  async function loadAdminActivity(options = {}) {
    if (!options.forceReload && cache.adminActivity) {
      return deepClone(cache.adminActivity);
    }

    const shared = normalizeAdminActivity(
      await loadStateJson("admin_activity.json")
    );
    if (shared) {
      cache.adminActivity = shared;
      return deepClone(shared);
    }

    const fallback = normalizeAdminActivity(
      await fetchFallbackJson("./data/admin_activity.json")
    );
    cache.adminActivity = fallback || null;
    return fallback ? deepClone(fallback) : null;
  }

  window.StreamSuitesState = {
    formatTimestamp,
    loadStateJson,
    loadRuntimeSnapshot,
    normalizeRuntimeSnapshot,
    loadCreatorContext,
    getCreatorContext,
    loadQuotasSnapshot,
    loadDiscordRuntimeSnapshot,
    normalizeDiscordRuntime,
    describeDiscordConnection,
    loadAdminActivity,
    normalizeAdminActivity
  };
})();

/* =====================================================================
   CONFIG STATE LAYER (LOCAL + JSON DATA FALLBACKS)
   - Provides normalized access to creators, platforms, and dashboard state
   - Uses localStorage as a staging layer
   - Falls back to data/*.json when no draft is present
   - Exposed as window.ConfigState
   ===================================================================== */

(() => {
  "use strict";

  const PLATFORM_KEYS = ["youtube", "twitch", "kick", "pilled", "rumble"];
  const CREATOR_DEBUG_MODE_KEY = "ss_creator_debug_mode";
  const LOCAL_SESSION_KEY = "streamsuites.creator.session";
  const ADMIN_ROLE_ALIASES = new Set([
    "admin",
    "administrator",
    "super_admin",
    "superadmin",
    "owner"
  ]);
  const DEBUG_MODE_BLOCKED_WRITE_MESSAGE = "Disabled in Debug Mode";

  const DATA_PATHS = {
    creators: "data/creators.json",
    platforms: "data/platforms.json",
    dashboard: "data/dashboard_state.json",
    system: "data/system.json",
    runtimeSnapshot: "data/runtime_snapshot.json"
  };

  const DEFAULT_CREATORS = [
    {
      creator_id: "daniel",
      display_name: "Daniel",
      notes: "Seed creator imported from runtime state.",
      disabled: false,
      platforms_enabled: {
        youtube: false,
        twitch: false,
        kick: true,
        pilled: false,
        rumble: true,
        discord: true
      },
      platforms: {
        youtube: { enabled: false },
        twitch: { enabled: false },
        kick: { enabled: true, channel: "daniel_live" },
        pilled: { enabled: false },
        rumble: {
          enabled: true,
          watch_url: "https://rumble.com/vXXXX-demo-live.html"
        },
        discord: { enabled: true }
      }
    }
  ];

  const DEFAULT_PLATFORMS = {
    schema: "streamsuites.platforms.v1",
    platforms: {
      youtube: {
        enabled: true,
        telemetry_enabled: true,
        notes: "Primary VOD + live ingestion."
      },
      twitch: {
        enabled: false,
        telemetry_enabled: true,
        notes: "Enable when Twitch credentials are provisioned."
      },
      kick: {
        enabled: true,
        telemetry_enabled: true,
        replay_supported: false,
        overlay_supported: false,
        notes: "Scaffolded ingestion with read-only exports."
      },
      pilled: {
        enabled: false,
        telemetry_enabled: false,
        replay_supported: false,
        overlay_supported: false,
        notes: "Planned ingest-only integration; dashboard stays read-only."
      },
      rumble: {
        enabled: true,
        telemetry_enabled: true,
        notes: "SSE-preferred chat ingest with DOM/API fallbacks; live testing complete."
      },
      discord: {
        enabled: true,
        telemetry_enabled: true,
        notes: "Control-plane routing for admin commands."
      }
    }
  };

  const DEFAULT_DASHBOARD_STATE = {
    schema: "streamsuites.dashboard_state.v1",
    last_loaded_at: null,
    last_export_at: null,
    discord_authorization_state: null,
    draft_sources: {
      creators: DATA_PATHS.creators,
      platforms: DATA_PATHS.platforms,
      system: DATA_PATHS.system
    }
  };

  const DEFAULT_SYSTEM = {
    schema: "streamsuites.system.v1",
    platform_polling_enabled: null,
    discord: {
      guilds: {}
    }
  };

  const cache = {
    creators: null,
    platforms: null,
    dashboard: null,
    system: null,
    runtimeSnapshot: null
  };

  function normalizeRole(role) {
    if (typeof role !== "string") return "";
    return role.trim().toLowerCase();
  }

  function isAdminRole(role) {
    const normalized = normalizeRole(role);
    return normalized ? ADMIN_ROLE_ALIASES.has(normalized) : false;
  }

  function readDebugModeFlag() {
    try {
      return localStorage.getItem(CREATOR_DEBUG_MODE_KEY) === "1";
    } catch (_err) {
      return false;
    }
  }

  function readPersistedSessionRole() {
    try {
      const raw = localStorage.getItem(LOCAL_SESSION_KEY);
      if (!raw) return "";
      const parsed = JSON.parse(raw);
      return typeof parsed?.role === "string" ? parsed.role : "";
    } catch (_err) {
      return "";
    }
  }

  function isDebugModeActive() {
    const appMode = window.App?.creatorDebugMode;
    if (appMode && appMode.enabled === true && appMode.eligible === true) {
      return true;
    }
    const role = window.App?.session?.role || readPersistedSessionRole();
    return readDebugModeFlag() && isAdminRole(role);
  }

  function showDebugModeNotice(message = DEBUG_MODE_BLOCKED_WRITE_MESSAGE) {
    const authToast = window.StreamSuitesAuth?.showToast;
    if (typeof authToast === "function") {
      authToast(message, { tone: "warning" });
      return;
    }
    console.info(`[Dashboard][Config] ${message}`);
  }

  function shouldBlockMutationsInDebugMode() {
    if (!isDebugModeActive()) return false;
    showDebugModeNotice();
    return true;
  }

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function safeNowIso() {
    try {
      return new Date().toISOString();
    } catch {
      return null;
    }
  }

  function pickBoolean(...values) {
    for (const value of values) {
      if (value === true || value === false) {
        return value;
      }
    }
    return null;
  }

  async function fetchJson(path) {
    try {
      const res = await fetchWithTimeout(
        new URL(path, document.baseURI),
        { cache: "no-store" }
      );
      if (res.status === 404) return null;
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.warn("[Dashboard][Config] Failed to fetch", path, err);
      return null;
    }
  }

  function normalizePlatformEntry(entry) {
    const enabled = entry?.enabled === true;
    const telemetry =
      entry?.telemetry_enabled === true || entry?.telemetry_enabled === false
        ? entry.telemetry_enabled
        : enabled;

    return {
      enabled,
      telemetry_enabled: telemetry,
      replay_supported:
        entry?.replay_supported === true || entry?.replay_supported === false
          ? entry.replay_supported
          : false,
      overlay_supported:
        entry?.overlay_supported === true || entry?.overlay_supported === false
          ? entry.overlay_supported
          : false,
      notes: typeof entry?.notes === "string" ? entry.notes : ""
    };
  }

  function normalizePlatforms(raw) {
    const sourcePlatforms =
      (raw && typeof raw === "object" && raw.platforms) || raw || {};
    const normalized = {};

    PLATFORM_KEYS.forEach((key) => {
      normalized[key] = normalizePlatformEntry(sourcePlatforms[key]);
    });

    return normalized;
  }

  function normalizeSystem(raw) {
    const normalized =
      raw && typeof raw === "object"
        ? { ...raw }
        : { ...DEFAULT_SYSTEM };

    const platformPollingEnabled = pickBoolean(
      normalized.platform_polling_enabled,
      normalized.system?.platform_polling_enabled
    );

    normalized.schema =
      typeof normalized.schema === "string"
        ? normalized.schema
        : DEFAULT_SYSTEM.schema;

    normalized.platform_polling_enabled =
      platformPollingEnabled === true || platformPollingEnabled === false
        ? platformPollingEnabled
        : null;

    const discord =
      normalized.discord && typeof normalized.discord === "object"
        ? normalized.discord
        : {};

    const guilds =
      discord.guilds && typeof discord.guilds === "object" ? { ...discord.guilds } : {};

    if (Array.isArray(normalized.discord_bot?.guilds)) {
      normalized.discord_bot.guilds.forEach((entry) => {
        const guildId =
          entry && typeof entry.guild_id === "string" ? entry.guild_id.trim() : "";
        if (!guildId) return;
        guilds[guildId] = { ...entry, guild_id: guildId };
      });
    }

    normalized.discord = {
      ...discord,
      guilds
    };

    if ("discord_bot" in normalized) {
      delete normalized.discord_bot;
    }

    return normalized;
  }

  function validateCreatorShape(entry) {
    if (!entry || typeof entry !== "object") return false;
    if (typeof entry.creator_id !== "string") return false;
    if ("display_name" in entry && typeof entry.display_name !== "string") {
      return false;
    }
    if ("platforms_enabled" in entry) {
      const pe = entry.platforms_enabled;
      if (!pe || typeof pe !== "object") return false;
    }
    return true;
  }

  function normalizeCreator(raw) {
    if (!validateCreatorShape(raw)) return null;

    const creator = {
      creator_id: raw.creator_id.trim(),
      display_name: (raw.display_name || raw.creator_id || "").trim(),
      notes: typeof raw.notes === "string" ? raw.notes : "",
      disabled: raw.disabled === true,
      platforms_enabled: {},
      platforms: {}
    };

    PLATFORM_KEYS.forEach((platform) => {
      const fromEnabled =
        raw.platforms_enabled && raw.platforms_enabled[platform] === true;

      const platformConfig =
        raw.platforms && typeof raw.platforms === "object"
          ? raw.platforms[platform]
          : null;

      const enabled =
        fromEnabled ||
        platformConfig === true ||
        (platformConfig && platformConfig.enabled === true);

      creator.platforms_enabled[platform] = !!enabled;

      const normalizedPlatform =
        platformConfig && typeof platformConfig === "object"
          ? { ...platformConfig }
          : {};

      normalizedPlatform.enabled = !!enabled;
      creator.platforms[platform] = normalizedPlatform;
    });

    return creator;
  }

  function normalizeCreators(list) {
    if (!Array.isArray(list)) return [];
    const normalized = list
      .map(normalizeCreator)
      .filter((entry) => entry && entry.creator_id);

    normalized.sort((a, b) =>
      a.creator_id.localeCompare(b.creator_id, undefined, {
        sensitivity: "base"
      })
    );

    return normalized;
  }

  function deriveCreatorsPayload(raw) {
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === "object" && Array.isArray(raw.creators)) {
      return raw.creators;
    }
    return null;
  }

  async function loadCreators(options = {}) {
    if (cache.creators && !options.forceReload) {
      return deepClone(cache.creators);
    }

    if (isDebugModeActive()) {
      const debugData = await fetchJson(DATA_PATHS.creators);
      const debugPayload = deriveCreatorsPayload(debugData) ?? debugData;
      const debugCreators = normalizeCreators(debugPayload || []);
      cache.creators = debugCreators.length
        ? debugCreators
        : normalizeCreators(DEFAULT_CREATORS);
      return deepClone(cache.creators);
    }

    const localDraft = App.storage.loadFromLocalStorage("creators", null);
    const draftPayload = deriveCreatorsPayload(localDraft) ?? localDraft;
    const draftCreators = normalizeCreators(draftPayload || []);
    if (draftCreators.length || Array.isArray(draftPayload)) {
      cache.creators = draftCreators;
      return deepClone(cache.creators);
    }

    const fileData = await fetchJson(DATA_PATHS.creators);
    const filePayload = deriveCreatorsPayload(fileData) ?? fileData;
    const fileCreators = normalizeCreators(filePayload || []);
    if (fileCreators.length) {
      cache.creators = fileCreators;
      return deepClone(cache.creators);
    }

    cache.creators = normalizeCreators(DEFAULT_CREATORS);
    return deepClone(cache.creators);
  }

  function saveCreators(list) {
    if (shouldBlockMutationsInDebugMode()) {
      const fallback = Array.isArray(cache.creators) ? cache.creators : normalizeCreators(DEFAULT_CREATORS);
      return deepClone(fallback);
    }

    const normalized = normalizeCreators(list || []);
    cache.creators = normalized;
    App.storage.saveToLocalStorage("creators", normalized);
    updateDashboardState({
      last_loaded_at: safeNowIso()
    });
    return deepClone(cache.creators);
  }

  function exportCreatorsFile(dataOverride = null) {
    const payload = dataOverride ? normalizeCreators(dataOverride) : cache.creators;
    const creators = Array.isArray(payload) ? payload : [];

    App.storage.downloadJson("creators.json", {
      schema: "streamsuites.creators.v1",
      creators
    });
  }

  async function loadPlatforms(options = {}) {
    if (cache.platforms && !options.forceReload) {
      return deepClone(cache.platforms);
    }

    if (isDebugModeActive()) {
      const debugData = await fetchJson(DATA_PATHS.platforms);
      if (debugData && typeof debugData === "object") {
        cache.platforms = {
          schema: debugData.schema || "streamsuites.platforms.v1",
          platforms: normalizePlatforms(debugData)
        };
      } else {
        cache.platforms = {
          schema: "streamsuites.platforms.v1",
          platforms: normalizePlatforms(DEFAULT_PLATFORMS)
        };
      }
      return deepClone(cache.platforms);
    }

    const localDraft = App.storage.loadFromLocalStorage("platforms", null);
    if (localDraft && typeof localDraft === "object") {
      cache.platforms = {
        schema: localDraft.schema || "streamsuites.platforms.v1",
        platforms: normalizePlatforms(localDraft)
      };
      return deepClone(cache.platforms);
    }

    const fileData = await fetchJson(DATA_PATHS.platforms);
    if (fileData && typeof fileData === "object") {
      cache.platforms = {
        schema: fileData.schema || "streamsuites.platforms.v1",
        platforms: normalizePlatforms(fileData)
      };
      return deepClone(cache.platforms);
    }

    cache.platforms = {
      schema: "streamsuites.platforms.v1",
      platforms: normalizePlatforms(DEFAULT_PLATFORMS)
    };
    return deepClone(cache.platforms);
  }

  function savePlatforms(platforms) {
    if (shouldBlockMutationsInDebugMode()) {
      const fallback =
        cache.platforms ||
        {
          schema: "streamsuites.platforms.v1",
          platforms: normalizePlatforms(DEFAULT_PLATFORMS)
        };
      return deepClone(fallback);
    }

    const normalized = {
      schema: "streamsuites.platforms.v1",
      platforms: normalizePlatforms(platforms || {})
    };
    cache.platforms = normalized;
    App.storage.saveToLocalStorage("platforms", normalized);
    updateDashboardState({
      last_loaded_at: safeNowIso()
    });
    return deepClone(cache.platforms);
  }

  function exportPlatformsFile(dataOverride = null) {
    const payload =
      dataOverride && typeof dataOverride === "object"
        ? dataOverride
        : cache.platforms;
    const normalized = {
      schema: "streamsuites.platforms.v1",
      platforms: normalizePlatforms(payload || {})
    };
    App.storage.downloadJson("platforms.json", normalized);
  }

  async function loadSystem(options = {}) {
    if (cache.system && !options.forceReload) {
      return deepClone(cache.system);
    }

    if (isDebugModeActive()) {
      const debugData = await fetchJson(DATA_PATHS.system);
      cache.system = normalizeSystem(debugData && typeof debugData === "object" ? debugData : DEFAULT_SYSTEM);
      return deepClone(cache.system);
    }

    const localDraft = App.storage.loadFromLocalStorage("system", null);
    if (localDraft && typeof localDraft === "object") {
      cache.system = normalizeSystem(localDraft);
      return deepClone(cache.system);
    }

    const fileData = await fetchJson(DATA_PATHS.system);
    if (fileData && typeof fileData === "object") {
      cache.system = normalizeSystem(fileData);
      return deepClone(cache.system);
    }

    cache.system = normalizeSystem(DEFAULT_SYSTEM);
    return deepClone(cache.system);
  }

  function saveSystem(systemConfig = {}) {
    if (shouldBlockMutationsInDebugMode()) {
      const fallback = cache.system || normalizeSystem(DEFAULT_SYSTEM);
      return deepClone(fallback);
    }

    const normalized = normalizeSystem({
      ...(cache.system || DEFAULT_SYSTEM),
      ...(systemConfig || {})
    });

    cache.system = normalized;
    App.storage.saveToLocalStorage("system", normalized);
    updateDashboardState({
      last_loaded_at: safeNowIso()
    });
    return deepClone(cache.system);
  }

  function exportSystemFile(dataOverride = null) {
    const payload =
      dataOverride && typeof dataOverride === "object"
        ? dataOverride
        : cache.system;

    const normalized = normalizeSystem(payload || DEFAULT_SYSTEM);
    App.storage.downloadJson("system.json", normalized);
  }

  async function loadDashboardState(options = {}) {
    if (cache.dashboard && !options.forceReload) {
      return deepClone(cache.dashboard);
    }

    if (isDebugModeActive()) {
      const debugData = await fetchJson(DATA_PATHS.dashboard);
      cache.dashboard =
        debugData && typeof debugData === "object"
          ? { ...DEFAULT_DASHBOARD_STATE, ...debugData }
          : deepClone(DEFAULT_DASHBOARD_STATE);
      return deepClone(cache.dashboard);
    }

    const local = App.storage.loadFromLocalStorage("dashboard_state", null);
    if (local && typeof local === "object") {
      cache.dashboard = { ...DEFAULT_DASHBOARD_STATE, ...local };
      return deepClone(cache.dashboard);
    }

    const fileData = await fetchJson(DATA_PATHS.dashboard);
    if (fileData && typeof fileData === "object") {
      cache.dashboard = { ...DEFAULT_DASHBOARD_STATE, ...fileData };
      return deepClone(cache.dashboard);
    }

    cache.dashboard = deepClone(DEFAULT_DASHBOARD_STATE);
    return deepClone(cache.dashboard);
  }

  function updateDashboardState(partial) {
    if (shouldBlockMutationsInDebugMode()) {
      return deepClone(cache.dashboard || DEFAULT_DASHBOARD_STATE);
    }

    const next = { ...(cache.dashboard || DEFAULT_DASHBOARD_STATE), ...partial };
    cache.dashboard = next;
    App.storage.saveToLocalStorage("dashboard_state", next);
    return deepClone(cache.dashboard);
  }

  async function loadRuntimeSnapshot(options = {}) {
    if (window.StreamSuitesState?.loadRuntimeSnapshot) {
      return window.StreamSuitesState.loadRuntimeSnapshot(options);
    }

    return null;
  }

  async function exportAllConfigs() {
    const [creators, platforms, system] = await Promise.all([
      loadCreators(),
      loadPlatforms(),
      loadSystem()
    ]);

    exportCreatorsFile(creators);
    exportPlatformsFile(platforms);
    exportSystemFile(system);
    updateDashboardState({
      last_export_at: safeNowIso()
    });
  }

  function applyCreatorsImport(payload) {
    if (shouldBlockMutationsInDebugMode()) {
      const fallback = Array.isArray(cache.creators) ? cache.creators : normalizeCreators(DEFAULT_CREATORS);
      return deepClone(fallback);
    }

    const sourceCreators =
      deriveCreatorsPayload(payload) ?? (payload && payload.creators);
    const normalized = normalizeCreators(sourceCreators || []);
    cache.creators = normalized;
    App.storage.saveToLocalStorage("creators", normalized);
    return deepClone(cache.creators);
  }

  function applyPlatformsImport(payload) {
    if (shouldBlockMutationsInDebugMode()) {
      const fallback =
        cache.platforms ||
        {
          schema: "streamsuites.platforms.v1",
          platforms: normalizePlatforms(DEFAULT_PLATFORMS)
        };
      return deepClone(fallback);
    }

    const normalized = {
      schema: "streamsuites.platforms.v1",
      platforms: normalizePlatforms(payload || {})
    };
    cache.platforms = normalized;
    App.storage.saveToLocalStorage("platforms", normalized);
    return deepClone(cache.platforms);
  }

  async function importConfigBundle(file) {
    if (shouldBlockMutationsInDebugMode()) {
      throw new Error(DEBUG_MODE_BLOCKED_WRITE_MESSAGE);
    }

    const parsed = await App.storage.importJsonFromFile(file);
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Invalid config bundle");
    }

    const creatorsPart =
      Array.isArray(parsed) || parsed.creators ? parsed : parsed.payload;
    if (creatorsPart && (Array.isArray(creatorsPart) || creatorsPart.creators)) {
      applyCreatorsImport(creatorsPart);
    }

    if (parsed.platforms) {
      applyPlatformsImport(parsed.platforms);
    }

    if (parsed.system) {
      saveSystem(parsed.system);
    }

    updateDashboardState({
      last_loaded_at: safeNowIso()
    });
  }

  window.ConfigState = {
    loadCreators,
    saveCreators,
    exportCreatorsFile,
    applyCreatorsImport,
    loadPlatforms,
    savePlatforms,
    exportPlatformsFile,
    applyPlatformsImport,
    loadSystem,
    saveSystem,
    exportSystemFile,
    loadDashboardState,
    updateDashboardState,
    loadRuntimeSnapshot,
    exportAllConfigs,
    importConfigBundle
  };
})();
