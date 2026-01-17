/* ============================================================
   StreamSuites Dashboard — settings.js
   ============================================================

   PURPOSE:
   - Centralized dashboard-level configuration
   - Defines NON-runtime behavior and authoring preferences
   - Configuration only — no live enforcement

   IMPORTANT DISTINCTION:
   - Settings here affect the DASHBOARD experience
   - NOT livestream bots
   - NOT runtime execution

   SAFE FOR:
   - GitHub Pages
   - iframe embedding (Wix)
   - Offline authoring

   ============================================================ */

(() => {
  "use strict";

  /* ------------------------------------------------------------
     STORAGE
     ------------------------------------------------------------ */

  const STORAGE_KEY = "settings";

  const el = {};

  let settings = null;
  let runtimeSnapshot = null;
  let systemConfig = null;
  let runtimeDiscordConfig = null;
  let wired = false;
  let runtimeListener = null;
  let visibilityListener = null;
  let guildListener = null;
  let activeGuildId = null;
  let guildStatus = "missing";
  let eligibleGuilds = new Map();
  const DISCORD_CHANNEL_ID_REGEX = /^\d{17,20}$/;

  /* ------------------------------------------------------------
     INIT
     ------------------------------------------------------------ */

  function init() {
    cacheElements();
    wireEvents();
    loadSettings();

    setTimeout(() => {
      (async () => {
        await hydratePlatforms();
        await hydrateRuntimeState();
        await hydrateSystemSettings();
        await hydrateDiscordRuntimeConfig();
        await renderDashboardState();
        bindRuntimeListeners();
        bindGuildListeners();
      })();
    }, 0);
  }

  /* ------------------------------------------------------------
     LOAD / SAVE
     ------------------------------------------------------------ */

  function loadSettings() {
    const stored = App.storage.loadFromLocalStorage(STORAGE_KEY, null);

    if (stored && typeof stored === "object") {
      settings = stored;
      return;
    }

    settings = settings || createDefaultSettings();
  }

  function persist() {
    App.storage.saveToLocalStorage(STORAGE_KEY, settings);
  }

  /* ------------------------------------------------------------
     DEFAULT SHAPE
     ------------------------------------------------------------ */

  function createDefaultSettings() {
    return {
      system: {
        mode: "local",
        autosave_interval_seconds: null,
        verbose_logging: false
      },
      platform_defaults: {
        chat_cooldown_seconds: null,
        default_response_mode: "equals_icase",
        enable_global_chat_responses: false
      },
      security: {
        confirm_destructive_actions: true,
        read_only_mode: false
      },
      advanced: {
        runtime_export_format: "creators.json",
        schema_version: "v1-draft"
      }
    };
  }

  /* ------------------------------------------------------------
     READ-ONLY ACCESSORS (FOR FUTURE UI)
     ------------------------------------------------------------ */

  function getSettings() {
    return structuredClone(settings);
  }

  function getSystemSettings() {
    return structuredClone(settings.system);
  }

  function getPlatformDefaults() {
    return structuredClone(settings.platform_defaults);
  }

  function getSecuritySettings() {
    return structuredClone(settings.security);
  }

  function getAdvancedSettings() {
    return structuredClone(settings.advanced);
  }

  /* ------------------------------------------------------------
     EXPORT / IMPORT
     ------------------------------------------------------------ */

  function exportSettings() {
    App.storage.exportJsonToDownload(
      "streamsuites-settings.json",
      settings
    );
  }

  function importSettingsFromFile(file, onError) {
    App.storage.importJsonFromFile(file)
      .then((data) => {
        if (!validateSettings(data)) {
          onError?.("Invalid settings file structure");
          return;
        }
        settings = data;
        persist();
      })
      .catch((err) => {
        console.error("[Settings] Import failed", err);
        onError?.("Failed to import settings file");
      });
  }

  /* ------------------------------------------------------------
     VALIDATION (INTENTIONALLY LOOSE)
     ------------------------------------------------------------ */

  function validateSettings(data) {
    if (!data || typeof data !== "object") return false;
    if (!("system" in data)) return false;
    if (!("platform_defaults" in data)) return false;
    if (!("security" in data)) return false;
    if (!("advanced" in data)) return false;
    return true;
  }

  /* ------------------------------------------------------------
     PUBLIC API
     ------------------------------------------------------------ */

  window.SettingsView = {
    init,
    getSettings,
    getSystemSettings,
    getPlatformDefaults,
    getSecuritySettings,
    getAdvancedSettings,
    exportSettings,
    importSettingsFromFile
  };

  /* ------------------------------------------------------------
     PLATFORM + CONFIG EXPORT WIRING
     ------------------------------------------------------------ */

  function cacheElements() {
    el.exportAll = document.getElementById("btn-export-config");
    el.importAll = document.getElementById("btn-import-config");
    el.importInput = document.getElementById("config-import-file");
    el.dashboardState = document.getElementById("dashboard-config-state");
    el.dashboardExport = document.getElementById("dashboard-export-state");
    el.platformPollingToggle = document.getElementById("platform-polling-toggle");
    el.platformPollingRuntime = document.getElementById(
      "platform-polling-runtime-state"
    );
    el.platformPollingDraft = document.getElementById("platform-polling-draft-state");
    el.platformPollingNotice = document.getElementById("platform-polling-restart");
    el.discordBotEmpty = document.getElementById("discord-bot-empty");
    el.discordBotEmptyTitle = document.getElementById("discord-bot-empty-title");
    el.discordBotEmptySubtitle = document.getElementById("discord-bot-empty-subtitle");
    el.discordBotGuilds = document.getElementById("discord-bot-guilds");
    el.discordBotTemplate = document.getElementById("discord-bot-guild-template");

    el.restartRequiredFlag = document.getElementById("restart-required-flag");
    el.restartPendingSystem = document.getElementById("restart-pending-system");
    el.restartPendingCreators = document.getElementById("restart-pending-creators");
    el.restartPendingTriggers = document.getElementById("restart-pending-triggers");
    el.restartPendingPlatforms = document.getElementById("restart-pending-platforms");
    el.restartSummary = document.getElementById("restart-change-summary");
  }

  function wireEvents() {
    if (wired) return;

    el.exportAll?.addEventListener("click", async () => {
      await window.ConfigState?.exportAllConfigs?.();
      await renderDashboardState(true);
    });

    el.importAll?.addEventListener("click", () => {
      if (!el.importInput) return;
      el.importInput.value = "";
      el.importInput.click();
    });

    el.importInput?.addEventListener("change", async () => {
      const file = el.importInput.files?.[0];
      if (!file) return;
      try {
        await window.ConfigState?.importConfigBundle?.(file);
        await PlatformsManager?.refresh?.(true);
        await hydrateRuntimeState(true);
        await hydrateSystemSettings(true);
        await renderDashboardState(true);
      } catch (err) {
        console.error("[Settings] Import failed", err);
        alert("Import failed: invalid configuration payload");
      }
    });

    el.platformPollingToggle?.addEventListener("change", () => {
      updatePlatformPolling(el.platformPollingToggle.checked);
    });

    wired = true;
  }

  function bindRuntimeListeners() {
    if (!runtimeListener) {
      runtimeListener = (event) => {
        const rawSnapshot = event?.detail?.snapshot || null;
        const normalized =
          window.StreamSuitesState?.normalizeRuntimeSnapshot?.(rawSnapshot) || rawSnapshot;
        if (!normalized) return;
        runtimeSnapshot = normalized;
        renderPlatformPolling();
        renderRestartQueue();
        window.PlatformsManager?.refresh?.(true);
      };
      window.addEventListener("streamsuites:runtimeSnapshot", runtimeListener);
    }

    if (!visibilityListener) {
      visibilityListener = () => {
        if (document.visibilityState !== "visible") return;
        App.state?.runtimeSnapshot?.fetchOnce?.();
      };
      document.addEventListener("visibilitychange", visibilityListener);
    }
  }

  function bindGuildListeners() {
    if (!guildListener) {
      guildListener = (event) => {
        const detail = event?.detail || {};
        activeGuildId = detail.activeGuildId || null;
        guildStatus = detail.status || "missing";
        eligibleGuilds =
          detail.eligibleGuilds instanceof Map ? detail.eligibleGuilds : new Map();
        renderDiscordBotSettings();
      };
      window.addEventListener("streamsuites:discord-guild", guildListener);
    }

    const guildContext = window.StreamSuitesDiscordGuild;
    if (guildContext) {
      activeGuildId = guildContext.getActiveGuildId?.() || null;
      guildStatus = guildContext.getStatus?.() || "missing";
      eligibleGuilds = guildContext.getEligibleGuilds?.() || new Map();
    }

    renderDiscordBotSettings();
  }

  async function hydratePlatforms() {
    if (window.PlatformsManager?.initSettingsView) {
      await window.PlatformsManager.initSettingsView();
    }
  }

  async function hydrateRuntimeState(forceReload = false) {
    if (window.__STREAMSUITES_RUNTIME_OFFLINE__) {
      runtimeSnapshot = null;
      renderPlatformPolling();
      renderRestartQueue();
      return;
    }

    try {
      runtimeSnapshot =
        (await window.ConfigState?.loadRuntimeSnapshot?.({ forceReload })) || null;
    } catch (err) {
      console.warn("[Settings] Unable to load runtime snapshot", err);
      runtimeSnapshot = null;
    }

    renderPlatformPolling();
    renderRestartQueue();
  }

  async function hydrateSystemSettings(forceReload = false) {
    try {
      systemConfig =
        (await window.ConfigState?.loadSystem?.({ forceReload })) || null;
    } catch (err) {
      console.warn("[Settings] Unable to load system config", err);
      systemConfig = null;
    }

    renderPlatformPolling();
    renderRestartQueue();
    renderDiscordBotSettings();
  }

  function normalizeRuntimeDiscordConfig(raw) {
    if (!raw || typeof raw !== "object") {
      return { guilds: {} };
    }

    const discordRoot =
      raw.discord && typeof raw.discord === "object" ? raw.discord : raw;

    const sourceGuilds =
      (discordRoot.guilds && typeof discordRoot.guilds === "object"
        ? discordRoot.guilds
        : null) ||
      (discordRoot.config && typeof discordRoot.config === "object"
        ? discordRoot.config.guilds
        : null) ||
      (discordRoot.settings && typeof discordRoot.settings === "object"
        ? discordRoot.settings.guilds
        : null) ||
      (discordRoot.runtime && typeof discordRoot.runtime === "object"
        ? discordRoot.runtime.guilds
        : null) ||
      {};

    const guilds = {};

    if (Array.isArray(sourceGuilds)) {
      sourceGuilds.forEach((entry) => {
        const guildId = coerceText(entry?.guild_id || entry?.id);
        if (!guildId) return;
        guilds[guildId] = { ...entry, guild_id: guildId };
      });
      return { guilds };
    }

    Object.entries(sourceGuilds).forEach(([guildId, entry]) => {
      const normalizedId = coerceText(guildId || entry?.guild_id);
      if (!normalizedId) return;
      guilds[normalizedId] = {
        ...(entry && typeof entry === "object" ? entry : {}),
        guild_id: normalizedId
      };
    });

    return { guilds };
  }

  async function hydrateDiscordRuntimeConfig() {
    if (window.__STREAMSUITES_RUNTIME_OFFLINE__) {
      runtimeDiscordConfig = { guilds: {} };
      return;
    }

    const loader = window.StreamSuitesState?.loadStateJson;
    if (typeof loader !== "function") {
      runtimeDiscordConfig = { guilds: {} };
      return;
    }

    try {
      const runtime = await loader("discord/runtime.json");
      runtimeDiscordConfig = normalizeRuntimeDiscordConfig(runtime);
    } catch (err) {
      console.warn("[Settings] Unable to load Discord runtime config", err);
      runtimeDiscordConfig = { guilds: {} };
    }
  }

  async function renderDashboardState(forceReload = false) {
    const state =
      (await window.ConfigState?.loadDashboardState?.({
        forceReload
      })) || null;

    const loaded = state?.last_loaded_at
      ? formatTimestamp(state.last_loaded_at)
      : "No drafts loaded";
    const exported = state?.last_export_at
      ? formatTimestamp(state.last_export_at)
      : "Not exported yet";

    if (el.dashboardState) el.dashboardState.textContent = loaded;
    if (el.dashboardExport) el.dashboardExport.textContent = exported;
  }

  function renderRestartQueue() {
    const intent = runtimeSnapshot?.restartIntent || null;
    const pending = intent?.pending || {};
    const required = intent?.required === true;

    const summaryList = intent?.summary || [];

    if (el.restartRequiredFlag) {
      el.restartRequiredFlag.textContent = required
        ? "Restart required"
        : intent
          ? "No restart required"
          : "Awaiting runtime snapshot";
      el.restartRequiredFlag.classList.toggle("ss-badge-warning", !!required);
      el.restartRequiredFlag.classList.toggle("ss-badge-success", intent && !required);
    }

    updatePendingChip(el.restartPendingSystem, pending.system);
    updatePendingChip(el.restartPendingCreators, pending.creators);
    updatePendingChip(el.restartPendingTriggers, pending.triggers);
    updatePendingChip(el.restartPendingPlatforms, pending.platforms);

    if (el.restartSummary) {
      el.restartSummary.innerHTML = "";
      const summary = document.createElement("div");
      summary.classList.add("muted");
      summary.textContent = intent
        ? "Changes will take effect when StreamSuites is restarted."
        : "Runtime snapshot not available. Pending state unknown.";
      el.restartSummary.appendChild(summary);

      if (summaryList.length > 0) {
        const list = document.createElement("ul");
        summaryList.forEach((entry) => {
          const li = document.createElement("li");
          li.textContent = entry;
          list.appendChild(li);
        });
        el.restartSummary.appendChild(list);
      }
    }
  }

  function updatePendingChip(container, isPending) {
    if (!container) return;

    container.innerHTML = "";
    const chip = document.createElement("span");
    chip.classList.add("ss-pending-chip");

    if (isPending === true) {
      chip.classList.add("pending");
      chip.textContent = "Pending";
    } else if (isPending === false) {
      chip.classList.add("clear");
      chip.textContent = "Not pending";
    } else {
      chip.textContent = "Unknown";
    }

    container.appendChild(chip);
  }

  function getRuntimePollingValue() {
    const value = runtimeSnapshot?.system?.platformPollingEnabled;
    return value === true || value === false ? value : null;
  }

  function getDraftPollingState() {
    const stored = systemConfig?.platform_polling_enabled;
    const hasStoredDraft = stored === true || stored === false;

    const runtimeFallback = getRuntimePollingValue();
    const valueCandidate = hasStoredDraft ? stored : runtimeFallback;
    const value = valueCandidate === true || valueCandidate === false ? valueCandidate : null;

    return { value, hasStoredDraft };
  }

  function renderPlatformPolling() {
    const runtimeValue = getRuntimePollingValue();
    const draftState = getDraftPollingState();
    const draftValue = draftState.value;

    if (el.platformPollingToggle) {
      if (draftValue === true || draftValue === false) {
        el.platformPollingToggle.checked = draftValue;
        el.platformPollingToggle.indeterminate = false;
      } else {
        el.platformPollingToggle.checked = false;
        el.platformPollingToggle.indeterminate = true;
      }
    }

    if (el.platformPollingRuntime) {
      el.platformPollingRuntime.textContent =
        runtimeValue === true
          ? "ENABLED (runtime snapshot)"
          : runtimeValue === false
            ? "DISABLED (runtime snapshot)"
            : "Unknown (runtime not reporting)";
    }

    if (el.platformPollingDraft) {
      el.platformPollingDraft.textContent =
        draftState.hasStoredDraft
          ? draftValue === true
            ? "Enabled for next start"
            : draftValue === false
              ? "Disabled for next start"
              : "Not staged (uses runtime defaults)"
          : draftValue === true
            ? "Runtime default: enabled"
            : draftValue === false
              ? "Runtime default: disabled"
              : "Not staged (uses runtime defaults)";
    }

    if (el.platformPollingNotice) {
      const needsRestart =
        draftState.hasStoredDraft && (runtimeValue === null || runtimeValue !== draftValue);
      el.platformPollingNotice.style.display = needsRestart ? "block" : "none";
    }
  }

  function coerceText(value) {
    if (value === null || value === undefined) return "";
    if (typeof value === "string") return value.trim();
    return String(value).trim();
  }

  function getDiscordConfigStore() {
    if (!systemConfig || typeof systemConfig !== "object") {
      return { guilds: {} };
    }

    const source =
      systemConfig.discord && typeof systemConfig.discord === "object"
        ? systemConfig.discord
        : {};

    const guilds =
      source.guilds && typeof source.guilds === "object" ? source.guilds : {};

    return {
      ...source,
      guilds: { ...guilds }
    };
  }

  function getActiveGuild() {
    if (!activeGuildId) return null;
    return eligibleGuilds.get(activeGuildId) || null;
  }

  function canEditActiveGuild() {
    return guildStatus === "ready" && !!activeGuildId;
  }

  function normalizeDiscordGuild(entry = {}, guildId = "") {
    const base = entry && typeof entry === "object" ? entry : {};
    const logging =
      base.logging && typeof base.logging === "object" ? base.logging : {};
    const notifications =
      base.notifications && typeof base.notifications === "object"
        ? base.notifications
        : {};
    const notificationGeneral =
      notifications.general && typeof notifications.general === "object"
        ? notifications.general
        : {};
    const notificationClips =
      notifications.clips && typeof notifications.clips === "object"
        ? notifications.clips
        : {};

    const guildName =
      typeof base.guild_name === "string"
        ? base.guild_name.trim()
        : typeof base.name === "string"
          ? base.name.trim()
          : typeof base.label === "string"
            ? base.label.trim()
            : "";

    const resolvedGuildId = coerceText(guildId || base.guild_id);

    const resolveChannelId = (...values) => {
      for (const value of values) {
        const trimmed = coerceText(value);
        if (trimmed) return trimmed;
      }
      return "";
    };

    const resolveClipChannel = (platform) =>
      resolveChannelId(
        notificationClips[platform]?.channel_id,
        notifications[`${platform}_clips_channel_id`],
        notifications[`${platform}ClipsChannelId`]
      );

    return {
      ...base,
      guild_id: resolvedGuildId,
      guild_name: guildName,
      logging: {
        ...logging,
        enabled: logging.enabled === true,
        channel_id: resolveChannelId(logging.channel_id, logging.channel)
      },
      notifications: {
        ...notifications,
        general: {
          ...notificationGeneral,
          channel_id: resolveChannelId(
            notificationGeneral.channel_id,
            notifications.general_channel_id,
            notifications.generalChannelId
          )
        },
        clips: {
          ...notificationClips,
          rumble: {
            ...(notificationClips.rumble && typeof notificationClips.rumble === "object"
              ? notificationClips.rumble
              : {}),
            channel_id: resolveClipChannel("rumble")
          },
          youtube: {
            ...(notificationClips.youtube && typeof notificationClips.youtube === "object"
              ? notificationClips.youtube
              : {}),
            channel_id: resolveClipChannel("youtube")
          },
          kick: {
            ...(notificationClips.kick && typeof notificationClips.kick === "object"
              ? notificationClips.kick
              : {}),
            channel_id: resolveClipChannel("kick")
          },
          pilled: {
            ...(notificationClips.pilled && typeof notificationClips.pilled === "object"
              ? notificationClips.pilled
              : {}),
            channel_id: resolveClipChannel("pilled")
          },
          twitch: {
            ...(notificationClips.twitch && typeof notificationClips.twitch === "object"
              ? notificationClips.twitch
              : {}),
            channel_id: resolveClipChannel("twitch")
          }
        }
      }
    };
  }

  function getGuildLabel(guild, index, oauthGuild) {
    const oauthName =
      oauthGuild && typeof oauthGuild.name === "string"
        ? oauthGuild.name.trim()
        : "";

    if (guild.guild_name || oauthName) {
      const resolvedName = guild.guild_name || oauthName;
      return guild.guild_id
        ? `${resolvedName} (${guild.guild_id})`
        : resolvedName;
    }

    if (guild.guild_id) {
      return `Guild ${guild.guild_id}`;
    }

    return `Guild ${index + 1}`;
  }

  function updateChannelStatus(statusEl, value) {
    if (!statusEl) return;
    const trimmed = coerceText(value);
    statusEl.classList.remove("pill-success", "pill-warning", "pill-default");

    if (!trimmed) {
      statusEl.classList.add("pill-default");
      statusEl.textContent = "Not set";
      return;
    }

    if (DISCORD_CHANNEL_ID_REGEX.test(trimmed)) {
      statusEl.classList.add("pill-success");
      statusEl.textContent = "Valid ID";
      return;
    }

    statusEl.classList.add("pill-warning");
    statusEl.textContent = "Invalid ID";
  }

  function persistDiscordGuildConfig(guildId, updatedGuild) {
    if (!guildId) return;
    const discord = getDiscordConfigStore();
    const nextGuilds = {
      ...discord.guilds,
      [guildId]: {
        ...updatedGuild,
        guild_id: guildId
      }
    };

    systemConfig =
      window.ConfigState?.saveSystem?.({
        discord: {
          ...discord,
          guilds: nextGuilds
        }
      }) || {
        discord: {
          ...discord,
          guilds: nextGuilds
        }
      };
    renderDashboardState();
  }

  function updateDiscordBotGuild(updater) {
    if (!canEditActiveGuild()) return;
    const guildId = activeGuildId;
    const discord = getDiscordConfigStore();
    const current = normalizeDiscordGuild(discord.guilds[guildId] || {}, guildId);
    const next = updater ? updater({ ...current }) || current : current;
    persistDiscordGuildConfig(guildId, next);
  }

  function renderDiscordBotSettings() {
    if (!el.discordBotGuilds || !el.discordBotTemplate) return;

    el.discordBotGuilds.innerHTML = "";

    const showEmptyState =
      !systemConfig || !canEditActiveGuild() || !activeGuildId;

    if (el.discordBotEmpty) {
      el.discordBotEmpty.classList.toggle("hidden", !showEmptyState);
    }

    if (el.discordBotEmptyTitle && el.discordBotEmptySubtitle) {
      if (guildStatus === "no-access") {
        el.discordBotEmptyTitle.textContent = "No authorized guilds available.";
        el.discordBotEmptySubtitle.textContent =
          "You do not have permission to manage any guilds where the StreamSuites bot is installed.";
      } else if (!activeGuildId) {
        el.discordBotEmptyTitle.textContent = "No active guild selected.";
        el.discordBotEmptySubtitle.textContent =
          "Select an eligible guild to view or edit per-guild settings.";
      } else if (guildStatus === "unauthorized") {
        el.discordBotEmptyTitle.textContent = "Guild access not authorized.";
        el.discordBotEmptySubtitle.textContent =
          "Choose a different guild to unlock Discord settings.";
      } else {
        el.discordBotEmptyTitle.textContent = "Discord settings locked.";
        el.discordBotEmptySubtitle.textContent =
          "Login and select a guild to unlock per-guild configuration.";
      }
    }

    if (showEmptyState) return;

    const discord = getDiscordConfigStore();
    const activeGuild = getActiveGuild();
    const runtimeGuild =
      runtimeDiscordConfig?.guilds && activeGuildId
        ? runtimeDiscordConfig.guilds[activeGuildId] || {}
        : {};
    const storedGuild = discord.guilds[activeGuildId] || {};
    const baseGuild =
      Object.keys(storedGuild).length > 0 ? storedGuild : runtimeGuild;
    const guild = normalizeDiscordGuild(baseGuild, activeGuildId);

    const fragment = el.discordBotTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".discord-guild-card");
    const label = fragment.querySelector("[data-guild-label]");

    if (card) {
      card.dataset.guildIndex = "active";
      card.dataset.access = "eligible";
      card.setAttribute("aria-disabled", "false");
    }

    if (label) {
      label.textContent = getGuildLabel(guild, 0, activeGuild);
    }

    const guildIdInput = fragment.querySelector('[data-field="guild-id"]');
    const guildIdStatus = fragment.querySelector('[data-status="guild-id"]');
    if (guildIdInput) {
      guildIdInput.value = guild.guild_id;
      guildIdInput.disabled = true;
    }
    updateChannelStatus(guildIdStatus, guild.guild_id);

    const loggingEnabled = fragment.querySelector(
      '[data-field="logging-enabled"]'
    );
    if (loggingEnabled) {
      loggingEnabled.checked = guild.logging.enabled === true;
      loggingEnabled.addEventListener("change", () => {
        updateDiscordBotGuild((entry) => ({
          ...entry,
          logging: {
            ...(entry.logging || {}),
            enabled: loggingEnabled.checked === true
          }
        }));
      });
    }

    const loggingChannel = fragment.querySelector(
      '[data-field="logging-channel"]'
    );
    const loggingStatus = fragment.querySelector(
      '[data-status="logging-channel"]'
    );
    if (loggingChannel) {
      loggingChannel.value = guild.logging.channel_id;
      loggingChannel.addEventListener("input", () => {
        updateDiscordBotGuild((entry) => ({
          ...entry,
          logging: {
            ...(entry.logging || {}),
            channel_id: coerceText(loggingChannel.value)
          }
        }));
        updateChannelStatus(loggingStatus, loggingChannel.value);
      });
    }
    updateChannelStatus(loggingStatus, guild.logging.channel_id);

    const channelBindings = [
      ["general-channel", { type: "general" }],
      ["rumble-channel", { type: "clips", platform: "rumble" }],
      ["youtube-channel", { type: "clips", platform: "youtube" }],
      ["kick-channel", { type: "clips", platform: "kick" }],
      ["pilled-channel", { type: "clips", platform: "pilled" }],
      ["twitch-channel", { type: "clips", platform: "twitch" }]
    ];

    const getNotificationChannelValue = (guildEntry, binding) => {
      if (binding.type === "general") {
        return guildEntry.notifications?.general?.channel_id || "";
      }
      if (binding.type === "clips" && binding.platform) {
        return (
          guildEntry.notifications?.clips?.[binding.platform]?.channel_id || ""
        );
      }
      return "";
    };

    const updateNotificationChannelValue = (entry, binding, value) => {
      if (binding.type === "general") {
        return {
          ...entry,
          notifications: {
            ...(entry.notifications || {}),
            general: {
              ...(entry.notifications?.general || {}),
              channel_id: value
            }
          }
        };
      }

      if (binding.type === "clips" && binding.platform) {
        return {
          ...entry,
          notifications: {
            ...(entry.notifications || {}),
            clips: {
              ...(entry.notifications?.clips || {}),
              [binding.platform]: {
                ...(entry.notifications?.clips?.[binding.platform] || {}),
                channel_id: value
              }
            }
          }
        };
      }

      return entry;
    };

    channelBindings.forEach(([field, binding]) => {
      const input = fragment.querySelector(`[data-field="${field}"]`);
      const status = fragment.querySelector(`[data-status="${field}"]`);
      const value = getNotificationChannelValue(guild, binding);

      if (input) {
        input.value = value;
        input.addEventListener("input", () => {
          const nextValue = coerceText(input.value);
          updateDiscordBotGuild((entry) =>
            updateNotificationChannelValue(entry, binding, nextValue)
          );
          updateChannelStatus(status, nextValue);
        });
      }
      updateChannelStatus(status, value);
    });

    el.discordBotGuilds.appendChild(fragment);
  }

  function updatePlatformPolling(enabled) {
    systemConfig =
      window.ConfigState?.saveSystem?.({ platform_polling_enabled: !!enabled }) || {
        platform_polling_enabled: !!enabled
      };

    renderPlatformPolling();
    renderDashboardState();
  }

  function formatTimestamp(value) {
    return (
      window.StreamSuitesState?.formatTimestamp?.(value) ||
      value ||
      "—"
    );
  }

  function destroy() {
    wired = false;
    runtimeSnapshot = null;
    systemConfig = null;
    if (runtimeListener) {
      window.removeEventListener("streamsuites:runtimeSnapshot", runtimeListener);
      runtimeListener = null;
    }
    if (visibilityListener) {
      document.removeEventListener("visibilitychange", visibilityListener);
      visibilityListener = null;
    }
    if (guildListener) {
      window.removeEventListener("streamsuites:discord-guild", guildListener);
      guildListener = null;
    }
    window.PlatformsManager?.destroy?.();
  }

  window.SettingsView.init = init;
  window.SettingsView.destroy = destroy;

})();
