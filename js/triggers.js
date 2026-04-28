(() => {
  "use strict";

  function detectFallbackApiBase() {
    const host = (window.location.hostname || "").toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") return "http://127.0.0.1:18087";
    return "https://api.streamsuites.app";
  }

  function resolveApiBase() {
    const apiBaseUrl = window.StreamSuitesAuth?.apiBaseUrl;
    return typeof apiBaseUrl === "string" && apiBaseUrl.trim()
      ? apiBaseUrl.replace(/\/$/, "")
      : detectFallbackApiBase();
  }

  const API_BASE = resolveApiBase();
  const REGISTRY_SUMMARY_ENDPOINT = `${API_BASE}/api/livechat/registry-summary`;
  const TRIGGERS_ENDPOINT = `${API_BASE}/api/livechat/triggers`;
  const CAPABILITIES_ENDPOINT = `${API_BASE}/api/livechat/capabilities`;

  const state = {
    items: [],
    summary: null,
    capabilities: [],
    root: null,
    abortController: null,
    listEl: null,
    statusEl: null,
    updatedEl: null,
    countEl: null,
    foundationReadyEl: null,
    foundationPillEl: null,
    foundationSummaryEl: null,
    enabledCountEl: null,
    platformCountEl: null,
    deployableCountEl: null,
    readinessRelationshipEl: null,
  };

  function requestJson(url, options = {}) {
    const creatorHeaders =
      typeof window.StreamSuitesAuth?.creatorContext?.buildHeaders === "function"
        ? window.StreamSuitesAuth.creatorContext.buildHeaders()
        : {};
    return fetch(url, {
      credentials: "include",
      cache: "no-store",
      ...options,
      headers: {
        Accept: "application/json",
        ...creatorHeaders,
        ...(options.headers || {}),
      },
    }).then(async (response) => {
      let payload = null;
      try {
        payload = await response.json();
      } catch (_err) {
        payload = null;
      }
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.error || `Request failed (${response.status})`);
      }
      return payload || {};
    });
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatTimestamp(value) {
    if (!value) return "Not loaded yet";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function setStatusPill(element, text, tone) {
    if (!(element instanceof HTMLElement)) return;
    element.classList.remove("warning", "success", "subtle");
    element.classList.add(tone || "subtle");
    const dot = element.querySelector(".status-dot");
    element.textContent = text;
    if (dot) element.prepend(dot);
  }

  function cacheElements(root = document) {
    state.listEl = root.querySelector("[data-trigger-list]");
    state.statusEl = root.querySelector("[data-trigger-status]");
    state.updatedEl = root.querySelector("[data-trigger-updated]");
    state.countEl = root.querySelector("[data-trigger-count]");
    state.enabledCountEl = root.querySelector("[data-trigger-enabled-count]");
    state.platformCountEl = root.querySelector("[data-trigger-platform-count]");
    state.deployableCountEl = root.querySelector("[data-trigger-deployable-count]");
    state.foundationReadyEl = root.querySelector("[data-trigger-foundation-ready]");
    state.foundationPillEl = root.querySelector("[data-trigger-foundation-pill]");
    state.foundationSummaryEl = root.querySelector("[data-trigger-foundation-summary]");
    state.readinessRelationshipEl = root.querySelector("[data-trigger-readiness-relationship]");
  }

  function humanizePlatform(platform) {
    const normalized = String(platform || "").trim().toLowerCase();
    if (normalized === "youtube") return "YouTube";
    if (normalized === "streamsuites_unified") return "StreamSuites unified";
    return normalized ? normalized.replace(/\b\w/g, (char) => char.toUpperCase()) : "Unknown";
  }

  function renderSummary() {
    const counts = state.summary?.counts || {};
    const platformCount = (state.capabilities || []).length;
    const pilled = state.capabilities.find((item) => item?.platform === "pilled");
    if (state.enabledCountEl) state.enabledCountEl.textContent = String(counts.trigger_count || state.items.length);
    if (state.platformCountEl) state.platformCountEl.textContent = String(platformCount);
    if (state.deployableCountEl) state.deployableCountEl.textContent = String(counts.game_count || 0);
    if (state.foundationReadyEl) state.foundationReadyEl.textContent = "Read-only";
    setStatusPill(state.foundationPillEl, "Authoritative runtime registry", "success");
    if (state.foundationSummaryEl) {
      state.foundationSummaryEl.textContent = `${counts.trigger_count || state.items.length} trigger definitions, ${counts.game_count || 0} game definitions, and ${counts.asset_count || 0} asset catalog entries are served by StreamSuites runtime/Auth.`;
    }
    if (state.readinessRelationshipEl) {
      state.readinessRelationshipEl.innerHTML = [
        "This registry is read-only in Creator during the foundation phase.",
        "Custom creator trigger configuration and execution controls are later managed phases.",
        pilled?.enabled === false ? "Pilled is registry-ready but planned/disabled until transport exists." : "Platform capability metadata is loaded from runtime/Auth.",
      ].map((line) => `<li>${escapeHtml(line)}</li>`).join("");
    }
  }

  function renderCard(item) {
    const platforms = Array.isArray(item?.eligible_platforms) ? item.eligible_platforms : [];
    const aliases = Array.isArray(item?.aliases) && item.aliases.length
      ? `<p class="trigger-card-aliases">Aliases: ${item.aliases.map((alias) => escapeHtml(alias)).join(", ")}</p>`
      : "";
    const isGames = String(item?.module || "").toUpperCase() === "GAMES";
    const isPilledDisabled = platforms.map((platform) => String(platform).toLowerCase()).includes("pilled");
    return `
      <article class="trigger-card" data-trigger-card="${escapeHtml(item.id)}">
        <div class="trigger-card-header">
          <div>
            <h3 class="trigger-card-title">${escapeHtml(`${item.prefix || "!"}${item.trigger || item.id}`)}</h3>
            <p>${escapeHtml(item.default_response || item.notes || "Runtime registry definition.")}</p>
            ${aliases}
          </div>
          <div class="trigger-card-meta">
            <span class="status-pill ${item.status === "active" ? "success" : "warning"}">${escapeHtml(item.status || "planned")}</span>
            <span class="status-pill subtle">${escapeHtml(item.type || "registry")}</span>
          </div>
        </div>
        <div class="trigger-card-body">
          <div class="trigger-card-section">
            <span class="trigger-section-label">Registry source</span>
            <p>Authoritative runtime registry. Read-only foundation row.</p>
          </div>
          <div class="trigger-card-section">
            <span class="trigger-section-label">Module</span>
            <p>${escapeHtml(item.module || "Unknown")}${isGames ? " - Games foundation, not playable yet" : ""}</p>
          </div>
          <div class="trigger-card-section">
            <span class="trigger-section-label">Platforms</span>
            <div class="trigger-platform-grid">
              ${platforms.map((platform) => `<span class="status-pill ${platform === "pilled" ? "warning" : "subtle"}">${escapeHtml(humanizePlatform(platform))}${platform === "pilled" ? " planned/disabled" : ""}</span>`).join("")}
            </div>
          </div>
          <div class="trigger-card-section">
            <span class="trigger-section-label">Execution phase</span>
            <p>${escapeHtml(isPilledDisabled ? "Pilled remains planned/disabled. No transport or dispatch is implemented here." : item.notes || "No trigger dispatch is implemented by this registry definition.")}</p>
          </div>
        </div>
      </article>
    `;
  }

  function render(payloads) {
    state.summary = payloads.summary || null;
    state.items = Array.isArray(payloads.triggers?.items) ? payloads.triggers.items : [];
    state.capabilities = Array.isArray(payloads.capabilities?.items) ? payloads.capabilities.items : [];
    if (state.countEl) state.countEl.textContent = String(state.items.length);
    if (state.updatedEl) state.updatedEl.textContent = formatTimestamp(payloads.triggers?.served_at || state.summary?.served_at);
    if (state.statusEl) {
      state.statusEl.textContent = state.items.length ? "Authoritative runtime registry loaded" : "No triggers returned";
      state.statusEl.classList.remove("warning", "success", "subtle");
      state.statusEl.classList.add(state.items.length ? "success" : "subtle");
    }
    renderSummary();
    if (state.listEl) {
      state.listEl.innerHTML = state.items.length
        ? state.items.map(renderCard).join("")
        : `<article class="trigger-card trigger-empty-card"><h3 class="trigger-card-title">No trigger rows returned</h3><p>Runtime/Auth returned an empty registry.</p></article>`;
    }
  }

  function renderLoadFailure(message) {
    if (state.statusEl) {
      state.statusEl.textContent = "Runtime registry unavailable";
      state.statusEl.classList.remove("success", "subtle");
      state.statusEl.classList.add("warning");
    }
    setStatusPill(state.foundationPillEl, "Registry unavailable", "warning");
    if (state.foundationSummaryEl) state.foundationSummaryEl.textContent = message || "Runtime/Auth did not return the registry.";
    if (state.listEl) {
      state.listEl.innerHTML = `<article class="trigger-card trigger-empty-card"><h3 class="trigger-card-title">Unable to load triggers</h3><p>${escapeHtml(message || "Try again once runtime/Auth is available.")}</p></article>`;
    }
  }

  async function loadRegistry() {
    const signal = state.abortController?.signal;
    const [summary, triggers, capabilities] = await Promise.all([
      requestJson(REGISTRY_SUMMARY_ENDPOINT, { signal }),
      requestJson(TRIGGERS_ENDPOINT, { signal }),
      requestJson(CAPABILITIES_ENDPOINT, { signal }),
    ]);
    render({ summary, triggers, capabilities });
  }

  function bindEvents(root = document) {
    state.abortController = new AbortController();
    const signal = state.abortController.signal;
    root.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      if (target.closest("[data-trigger-reset]")) void loadRegistry().catch((err) => renderLoadFailure(String(err?.message || err)));
    }, { signal });
    root.querySelectorAll("[data-trigger-add], [data-trigger-form] button, [data-trigger-form] input, [data-trigger-form] textarea").forEach((control) => {
      control.setAttribute("disabled", "disabled");
      control.setAttribute("aria-disabled", "true");
    });
  }

  function init(root = document) {
    if (state.root === root && state.abortController) return;
    if (state.abortController) state.abortController.abort();
    state.root = root;
    cacheElements(root);
    bindEvents(root);
    void loadRegistry().catch((err) => renderLoadFailure(String(err?.message || "Unable to load runtime registry.")));
  }

  function destroy() {
    if (state.abortController) {
      state.abortController.abort();
      state.abortController = null;
    }
    state.root = null;
    state.items = [];
    state.summary = null;
    state.capabilities = [];
  }

  window.TriggersView = { init, destroy };
})();
