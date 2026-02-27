(() => {
  "use strict";

  const API_BASE_URL = "https://api.streamsuites.app";
  const ENDPOINTS = Object.freeze({
    installUrl: "/api/creator/discord/bot/install-url",
    verify: "/api/creator/discord/bot/verify",
    installs: "/api/creator/discord/bot/installs",
    disable: "/api/creator/discord/bot/disable"
  });
  const DEFAULT_TIMEOUT_MS = 10000;
  const INSTALL_URL_TIMEOUT_MS = 15000;
  const INSTALLS_TIMEOUT_MS = 15000;

  const state = {
    installs: [],
    loadingInstalls: false,
    loadingInstallUrlGuildId: null,
    verifyingGuildIds: new Set(),
    disablingGuildIds: new Set(),
    installGuildIds: new Set(),
    disabledGuildIds: new Set(),
    verifyResult: null,
    installMeta: {
      scopes: ["bot", "applications.commands"],
      permissions: null
    },
    installUrl: "",
    requestEpoch: 0,
    mounted: false,
    installsError: ""
  };

  const el = {
    panel: null,
    statePill: null,
    globalError: null,
    openInstall: null,
    installMeta: null,
    guildId: null,
    verify: null,
    verifyResult: null,
    refresh: null,
    listStatus: null,
    installs: null,
    listError: null
  };

  const listeners = {
    openInstall: null,
    verify: null,
    refresh: null,
    installs: null
  };

  function normalizeText(value) {
    if (typeof value === "string") return value.trim();
    if (typeof value === "number") return String(value);
    return "";
  }

  function extractPayloadContainer(payload) {
    if (!payload || typeof payload !== "object") return {};
    if (payload.data && typeof payload.data === "object") return payload.data;
    return payload;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function safeParse(raw) {
    if (typeof raw !== "string" || !raw.trim()) return null;
    try {
      return JSON.parse(raw);
    } catch (_err) {
      return null;
    }
  }

  function getFetchWithTimeout() {
    if (typeof window.fetchWithTimeout === "function") {
      return window.fetchWithTimeout;
    }

    return async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), timeoutMs);
      try {
        return await fetch(url, {
          ...options,
          signal: controller.signal
        });
      } finally {
        window.clearTimeout(timer);
      }
    };
  }

  function resolveEndpoint(path) {
    const sessionEndpoint = window.StreamSuitesAuth?.endpoints?.session;
    if (typeof sessionEndpoint === "string" && sessionEndpoint.trim()) {
      try {
        const resolved = new URL(sessionEndpoint, window.location.origin);
        return `${resolved.origin}${path}`;
      } catch (_err) {
        // Fall through to static base.
      }
    }
    return `${API_BASE_URL}${path}`;
  }

  function formatTimestamp(value) {
    const formatted = window.StreamSuitesState?.formatTimestamp?.(value);
    if (typeof formatted === "string" && formatted.trim()) return formatted;
    const raw = normalizeText(value);
    if (!raw) return "Never";
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return raw;
    return parsed.toLocaleString(undefined, { hour12: false });
  }

  function showAuthToast(message, tone = "warning") {
    const showToast = window.StreamSuitesAuth?.showToast;
    if (typeof showToast === "function") {
      showToast(message, { tone });
    }
  }

  function handleUnauthorized(message = "Your session is no longer authorized. Please log in again.") {
    setGlobalError(message, {
      toast: true,
      tone: "warning"
    });
  }

  function isMountedRequest(epoch) {
    return state.mounted === true && epoch === state.requestEpoch;
  }

  async function requestJson(path, options = {}) {
    const fetchWithTimeout = getFetchWithTimeout();
    const url = new URL(resolveEndpoint(path));
    const query = options.query && typeof options.query === "object" ? options.query : null;
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value === null || value === undefined) return;
        const normalized = normalizeText(value);
        if (!normalized) return;
        url.searchParams.set(key, normalized);
      });
    }

    const method = normalizeText(options.method).toUpperCase() || "GET";
    const init = {
      method,
      credentials: "include",
      headers: {
        Accept: "application/json"
      }
    };

    if (options.body !== undefined) {
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(options.body);
    }

    try {
      const response = await fetchWithTimeout(
        url.toString(),
        init,
        Number.isFinite(options.timeoutMs) ? Number(options.timeoutMs) : DEFAULT_TIMEOUT_MS
      );
      const raw = await response.text();
      const payload = safeParse(raw);
      const payloadContainer = extractPayloadContainer(payload);
      const payloadError = normalizeText(
        payload?.error || payload?.message || payloadContainer?.error || payloadContainer?.message
      );
      const isUnauthorized = response.status === 401 || response.status === 403;

      if (!response.ok || (payload && payload.success === false)) {
        return {
          ok: false,
          status: response.status,
          payload,
          unauthorized: isUnauthorized,
          error: payloadError || `Request failed with status ${response.status}.`
        };
      }

      return {
        ok: true,
        status: response.status,
        payload
      };
    } catch (err) {
      const isAbort = err?.name === "AbortError";
      return {
        ok: false,
        status: 0,
        payload: null,
        unauthorized: false,
        error: isAbort ? "Request timed out. Try again." : "Network error. Check your connection and retry."
      };
    }
  }

  function setGlobalError(message, options = {}) {
    if (!el.globalError) return;
    const text = normalizeText(message);
    if (!text) {
      el.globalError.classList.add("hidden");
      el.globalError.textContent = "";
      return;
    }
    el.globalError.classList.remove("hidden");
    el.globalError.textContent = text;
    if (options.toast === true) {
      showAuthToast(text, options.tone || "warning");
    }
  }

  function setListError(message) {
    if (!el.listError) return;
    const text = normalizeText(message);
    if (!text) {
      el.listError.classList.add("hidden");
      el.listError.textContent = "";
      return;
    }
    el.listError.classList.remove("hidden");
    el.listError.textContent = text;
  }

  function getGuildIdInputValue() {
    return normalizeText(el.guildId?.value);
  }

  function setVerifyResult(payload, guildIdOverride = "") {
    if (!el.verifyResult) return;
    const container = extractPayloadContainer(payload);
    const resultGuildId = normalizeText(container?.guild_id || payload?.guild_id || guildIdOverride);
    const guildName = normalizeText(container?.guild_name || payload?.guild_name);
    const installed = container?.is_installed === true;
    const verifiedAt = formatTimestamp(container?.last_verified_at);
    const errorText = normalizeText(
      container?.error || container?.last_verify_error || payload?.error || payload?.message
    );
    const targetLabel = guildName || resultGuildId || "Guild";

    const errorMarkup = errorText
      ? `
        <details class="discord-bot-error-details">
          <summary>Last verify error</summary>
          <pre>${escapeHtml(errorText)}</pre>
        </details>
      `
      : "";

    el.verifyResult.innerHTML = `
      <div class="stat-grid discord-bot-verify-grid">
        <div>
          <span class="stat-label">Guild</span>
          <span class="stat-value">${escapeHtml(targetLabel)}</span>
        </div>
        <div>
          <span class="stat-label">Installed</span>
          <span class="stat-value">${installed ? "Yes" : "No"}</span>
        </div>
        <div>
          <span class="stat-label">Last verified</span>
          <span class="stat-value">${escapeHtml(verifiedAt)}</span>
        </div>
      </div>
      ${errorMarkup}
    `;
    el.verifyResult.classList.remove("hidden");
  }

  function parseEpoch(value) {
    const raw = normalizeText(value);
    if (!raw) return NaN;
    return Date.parse(raw);
  }

  function inferDisabled(install) {
    if (!install || install.is_installed === true) return false;
    const guildId = normalizeText(install.guild_id);
    if (guildId && state.disabledGuildIds.has(guildId)) return true;

    const updatedAt = parseEpoch(install.updated_at);
    const verifiedAt = parseEpoch(install.last_verified_at);
    if (Number.isFinite(updatedAt) && Number.isFinite(verifiedAt)) {
      return updatedAt > verifiedAt;
    }
    return false;
  }

  function resolveInstallStatus(install) {
    if (install?.is_installed === true) {
      return { label: "Installed", className: "pill-success" };
    }
    if (inferDisabled(install)) {
      return { label: "Disabled", className: "pill-warning" };
    }
    return { label: "Not Installed", className: "pill-default" };
  }

  function updateHeaderStatus() {
    if (!el.statePill) return;
    const installedCount = state.installs.filter((entry) => entry?.is_installed === true).length;
    const hasInstalls = state.installs.length > 0;

    el.statePill.classList.remove("subtle", "success", "warning");
    if (!hasInstalls) {
      el.statePill.classList.add("subtle");
      el.statePill.textContent = "Not linked";
      return;
    }
    if (installedCount > 0) {
      el.statePill.classList.add("success");
      el.statePill.textContent = `${installedCount} linked`;
      return;
    }
    el.statePill.classList.add("warning");
    el.statePill.textContent = "Configured";
  }

  function updateInstallMeta(meta = null) {
    if (!el.installMeta) return;
    const scopes = Array.isArray(meta?.scopes)
      ? meta.scopes.map((entry) => normalizeText(entry)).filter(Boolean)
      : state.installMeta.scopes;
    const permissions = Number.isInteger(meta?.permissions)
      ? meta.permissions
      : Number.isInteger(state.installMeta.permissions)
        ? state.installMeta.permissions
        : null;

    if (scopes.length) {
      state.installMeta.scopes = scopes;
    }
    state.installMeta.permissions = permissions;

    const scopeText = state.installMeta.scopes.length
      ? state.installMeta.scopes.join(", ")
      : "bot, applications.commands";
    const permissionsText =
      Number.isInteger(state.installMeta.permissions) ? ` Permissions: ${state.installMeta.permissions}.` : "";
    el.installMeta.textContent = `Required scopes: ${scopeText}.${permissionsText}`;
  }

  function renderInstalls() {
    if (!el.installs || !el.listStatus) return;
    updateHeaderStatus();
    setListError(state.installsError);

    if (state.loadingInstalls) {
      el.listStatus.textContent = "Loading linked servers…";
      el.installs.innerHTML = "";
      return;
    }

    if (!state.installs.length) {
      el.listStatus.textContent = "No linked servers yet. Install the bot, then verify with a Guild ID.";
      el.installs.innerHTML = "";
      return;
    }

    el.listStatus.textContent = `${state.installs.length} server${state.installs.length === 1 ? "" : "s"} found.`;

    const rows = state.installs
      .map((install) => {
        const guildId = normalizeText(install?.guild_id);
        const guildName = normalizeText(install?.guild_name) || guildId || "Unknown guild";
        const status = resolveInstallStatus(install);
        const lastVerified = formatTimestamp(install?.last_verified_at);
        const lastVerifyError = normalizeText(install?.last_verify_error);
        const verifying = state.verifyingGuildIds.has(guildId);
        const disabling = state.disablingGuildIds.has(guildId);
        const installLoading = state.installGuildIds.has(guildId);
        const actionBusy = verifying || disabling || installLoading;

        const errorBadge = lastVerifyError
          ? '<span class="pill pill-warning discord-bot-error-pill">Verify error</span>'
          : "";
        const errorDetails = lastVerifyError
          ? `
            <details class="discord-bot-error-details">
              <summary>View verify error</summary>
              <pre>${escapeHtml(lastVerifyError)}</pre>
            </details>
          `
          : "";

        return `
          <article class="card discord-bot-install-card">
            <div class="card-top">
              <h5>${escapeHtml(guildName)}</h5>
              <span class="pill ${status.className}">${status.label}</span>
            </div>
            <p class="muted discord-bot-guild-id">Guild ID: ${escapeHtml(guildId || "—")}</p>
            <div class="discord-bot-install-meta">
              <span>Last verified: ${escapeHtml(lastVerified)}</span>
              ${errorBadge}
            </div>
            ${errorDetails}
            <div class="platform-actions">
              <button
                class="creator-button ghost"
                type="button"
                data-action="verify"
                data-guild-id="${escapeHtml(guildId)}"
                ${actionBusy || !guildId ? "disabled" : ""}
              >
                ${verifying ? "Verifying..." : "Verify"}
              </button>
              <button
                class="creator-button ghost"
                type="button"
                data-action="install"
                data-guild-id="${escapeHtml(guildId)}"
                ${actionBusy || !guildId ? "disabled" : ""}
              >
                ${installLoading ? "Opening..." : "Open Install Page"}
              </button>
              <button
                class="creator-button ghost"
                type="button"
                data-action="disable"
                data-guild-id="${escapeHtml(guildId)}"
                ${actionBusy || !guildId ? "disabled" : ""}
              >
                ${disabling ? "Disabling..." : "Disable"}
              </button>
            </div>
          </article>
        `;
      })
      .join("");

    el.installs.innerHTML = rows;
  }

  async function refreshInstalls(options = {}) {
    const epoch = state.requestEpoch;
    state.loadingInstalls = true;
    renderInstalls();

    const result = await requestJson(ENDPOINTS.installs, {
      method: "GET",
      timeoutMs: INSTALLS_TIMEOUT_MS
    });

    if (!isMountedRequest(epoch)) return;

    if (!result.ok) {
      state.installsError = result.error;
      state.installs = [];
      if (result.unauthorized) {
        handleUnauthorized();
      } else {
        if (!options.silentErrors) {
          setGlobalError(result.error);
        }
      }
      state.loadingInstalls = false;
      renderInstalls();
      return;
    }

    const container = extractPayloadContainer(result.payload);
    const installs = Array.isArray(container?.installs)
      ? container.installs
      : Array.isArray(container?.items)
        ? container.items
        : [];
    state.installsError = "";
    state.installs = installs;
    installs.forEach((entry) => {
      const guildId = normalizeText(entry?.guild_id);
      if (!guildId) return;
      if (entry?.is_installed === true) {
        state.disabledGuildIds.delete(guildId);
      }
    });
    state.loadingInstalls = false;
    if (!options.preserveError) {
      setGlobalError("");
    }
    renderInstalls();
  }

  async function loadInstallUrl(options = {}) {
    const query = options.query && typeof options.query === "object" ? options.query : null;
    const result = await requestJson(ENDPOINTS.installUrl, {
      method: "GET",
      query,
      timeoutMs: INSTALL_URL_TIMEOUT_MS
    });

    if (!result.ok) {
      if (result.unauthorized) {
        handleUnauthorized();
      } else if (options.silentErrors !== true) {
        setGlobalError(result.error, {
          toast: true,
          tone: "warning"
        });
      }
      return null;
    }

    const container = extractPayloadContainer(result.payload);
    updateInstallMeta(container || null);
    const url = normalizeText(container?.url || container?.install_url);
    if (!url) {
      if (options.silentErrors !== true) {
        setGlobalError("Install URL could not be loaded right now.", {
          toast: true,
          tone: "warning"
        });
      }
      return null;
    }

    if (!query) {
      state.installUrl = url;
    }
    return url;
  }

  async function openInstallPage(guildId = "") {
    const epoch = state.requestEpoch;
    const normalizedGuildId = normalizeText(guildId);
    if (normalizedGuildId) {
      state.installGuildIds.add(normalizedGuildId);
    } else {
      state.loadingInstallUrlGuildId = "";
    }
    renderInstalls();
    if (el.openInstall) {
      el.openInstall.disabled = true;
      el.openInstall.textContent = "Opening...";
    }

    let url = "";
    if (normalizedGuildId) {
      url = normalizeText(
        await loadInstallUrl({
          query: {
            guild_id: normalizedGuildId,
            disable_guild_select: "1"
          }
        })
      );
    } else if (state.installUrl) {
      url = normalizeText(state.installUrl);
    } else {
      url = normalizeText(await loadInstallUrl());
    }

    if (!isMountedRequest(epoch)) return;

    if (normalizedGuildId) {
      state.installGuildIds.delete(normalizedGuildId);
    } else {
      state.loadingInstallUrlGuildId = null;
    }

    if (!url) {
      setGlobalError("Install URL could not be loaded right now.", {
        toast: true,
        tone: "warning"
      });
      if (el.openInstall) {
        el.openInstall.disabled = false;
        el.openInstall.textContent = "Open Install Page";
      }
      renderInstalls();
      return;
    }

    setGlobalError("");
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (!opened) {
      setGlobalError("Popup blocked. Allow popups for this site, then retry.");
      showAuthToast("Popup blocked. Allow popups for this site, then retry.", "warning");
    }

    if (el.openInstall) {
      el.openInstall.disabled = false;
      el.openInstall.textContent = "Open Install Page";
    }
    renderInstalls();
  }

  async function verifyGuild(guildId, options = {}) {
    const epoch = state.requestEpoch;
    const normalizedGuildId = normalizeText(guildId);
    if (!normalizedGuildId) {
      setGlobalError("Guild ID is required to verify install.");
      return;
    }

    state.verifyingGuildIds.add(normalizedGuildId);
    if (el.verify) {
      el.verify.disabled = true;
      el.verify.textContent = "Verifying...";
    }
    renderInstalls();

    const result = await requestJson(ENDPOINTS.verify, {
      method: "POST",
      body: {
        guild_id: normalizedGuildId
      }
    });

    state.verifyingGuildIds.delete(normalizedGuildId);
    if (!isMountedRequest(epoch)) return;

    if (el.verify) {
      el.verify.disabled = false;
      el.verify.textContent = "Verify Install";
    }

    if (!result.ok) {
      setVerifyResult(result.payload || { error: result.error }, normalizedGuildId);
      if (result.unauthorized) {
        handleUnauthorized();
      } else {
        setGlobalError(result.error);
      }
      renderInstalls();
      await refreshInstalls({ preserveError: true, silentErrors: true });
      return;
    }

    const payload = extractPayloadContainer(result.payload || {});
    setVerifyResult(payload, normalizedGuildId);
    if (payload.is_installed === true) {
      state.disabledGuildIds.delete(normalizedGuildId);
    } else if (options.fromDisable !== true) {
      state.disabledGuildIds.delete(normalizedGuildId);
    }
    setGlobalError("");
    await refreshInstalls({ preserveError: true, silentErrors: true });
  }

  async function disableGuild(guildId) {
    const epoch = state.requestEpoch;
    const normalizedGuildId = normalizeText(guildId);
    if (!normalizedGuildId) return;
    state.disablingGuildIds.add(normalizedGuildId);
    renderInstalls();

    const result = await requestJson(ENDPOINTS.disable, {
      method: "POST",
      body: {
        guild_id: normalizedGuildId
      }
    });

    state.disablingGuildIds.delete(normalizedGuildId);
    if (!isMountedRequest(epoch)) return;

    if (!result.ok) {
      if (result.unauthorized) {
        handleUnauthorized();
      } else {
        setGlobalError(result.error);
      }
      renderInstalls();
      await refreshInstalls({ preserveError: true, silentErrors: true });
      return;
    }

    state.disabledGuildIds.add(normalizedGuildId);
    setGlobalError("");
    await refreshInstalls({ preserveError: true, silentErrors: true });
  }

  function handleInstallClick() {
    const guildId = getGuildIdInputValue();
    void openInstallPage(guildId);
  }

  function handleVerifyClick() {
    const guildId = getGuildIdInputValue();
    void verifyGuild(guildId);
  }

  function handleRowActions(event) {
    const actionButton = event.target.closest("[data-action][data-guild-id]");
    if (!(actionButton instanceof HTMLElement)) return;
    const action = normalizeText(actionButton.dataset.action);
    const guildId = normalizeText(actionButton.dataset.guildId);
    if (!guildId) return;

    if (action === "verify") {
      if (el.guildId) {
        el.guildId.value = guildId;
      }
      void verifyGuild(guildId);
      return;
    }
    if (action === "install") {
      void openInstallPage(guildId);
      return;
    }
    if (action === "disable") {
      void disableGuild(guildId);
    }
  }

  function cacheElements() {
    el.panel = document.querySelector("[data-discord-bot-panel]");
    if (!el.panel) return false;

    el.statePill = document.getElementById("discord-bot-link-state");
    el.globalError = document.getElementById("discord-bot-error");
    el.openInstall = document.getElementById("discord-bot-open-install");
    el.installMeta = document.getElementById("discord-bot-install-meta");
    el.guildId = document.getElementById("discord-bot-guild-id");
    el.verify = document.getElementById("discord-bot-verify");
    el.verifyResult = document.getElementById("discord-bot-verify-result");
    el.refresh = document.getElementById("discord-bot-refresh");
    el.listStatus = document.getElementById("discord-bot-list-status");
    el.installs = document.getElementById("discord-bot-installs");
    el.listError = document.getElementById("discord-bot-list-error");

    return Boolean(
      el.statePill &&
        el.globalError &&
        el.openInstall &&
        el.installMeta &&
        el.guildId &&
        el.verify &&
        el.verifyResult &&
        el.refresh &&
        el.listStatus &&
        el.installs &&
        el.listError
    );
  }

  function bindEvents() {
    unbindEvents();
    listeners.openInstall = handleInstallClick;
    listeners.verify = handleVerifyClick;
    listeners.refresh = () => {
      void refreshInstalls();
    };
    listeners.installs = handleRowActions;

    el.openInstall?.addEventListener("click", listeners.openInstall);
    el.verify?.addEventListener("click", listeners.verify);
    el.refresh?.addEventListener("click", listeners.refresh);
    el.installs?.addEventListener("click", listeners.installs);
  }

  function unbindEvents() {
    if (listeners.openInstall) {
      el.openInstall?.removeEventListener("click", listeners.openInstall);
    }
    if (listeners.verify) {
      el.verify?.removeEventListener("click", listeners.verify);
    }
    if (listeners.refresh) {
      el.refresh?.removeEventListener("click", listeners.refresh);
    }
    if (listeners.installs) {
      el.installs?.removeEventListener("click", listeners.installs);
    }

    listeners.openInstall = null;
    listeners.verify = null;
    listeners.refresh = null;
    listeners.installs = null;
  }

  function clearElements() {
    el.panel = null;
    el.statePill = null;
    el.globalError = null;
    el.openInstall = null;
    el.installMeta = null;
    el.guildId = null;
    el.verify = null;
    el.verifyResult = null;
    el.refresh = null;
    el.listStatus = null;
    el.installs = null;
    el.listError = null;
  }

  function resetTransientState() {
    state.loadingInstalls = false;
    state.loadingInstallUrlGuildId = null;
    state.verifyingGuildIds.clear();
    state.disablingGuildIds.clear();
    state.installGuildIds.clear();
    state.verifyResult = null;
    state.installsError = "";
  }

  function init() {
    try {
      if (state.mounted) {
        unbindEvents();
        clearElements();
        state.mounted = false;
      }

      state.requestEpoch += 1;
      state.mounted = true;
      resetTransientState();

      if (!cacheElements()) {
        state.mounted = false;
        return;
      }
      updateInstallMeta(state.installMeta);
      bindEvents();
      renderInstalls();
      void loadInstallUrl({ silentErrors: true });
      void refreshInstalls();
    } catch (err) {
      setGlobalError("Discord page failed to initialize. Refresh and try again.");
      console.error("[DiscordPlatformView] init failed", err);
    }
  }

  function destroy() {
    state.requestEpoch += 1;
    state.mounted = false;
    state.loadingInstalls = false;
    state.loadingInstallUrlGuildId = null;
    state.installsError = "";
    state.verifyingGuildIds.clear();
    state.disablingGuildIds.clear();
    state.installGuildIds.clear();

    unbindEvents();
    clearElements();
  }

  window.DiscordPlatformView = {
    init,
    destroy
  };

  const pathname = String(window.location.pathname || "").toLowerCase();
  const standaloneDiscordView = pathname.endsWith("/views/platforms/discord.html");
  if (standaloneDiscordView) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        window.DiscordPlatformView.init();
      }, { once: true });
    } else {
      window.DiscordPlatformView.init();
    }
  }
})();
