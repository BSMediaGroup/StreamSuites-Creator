(() => {
  "use strict";

  function detectFallbackApiBase() {
    const host = (window.location.hostname || "").toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") {
      return "http://127.0.0.1:18087";
    }
    return "https://api.streamsuites.app";
  }

  function resolveApiBase() {
    const apiBaseUrl = window.StreamSuitesAuth?.apiBaseUrl;
    if (typeof apiBaseUrl === "string" && apiBaseUrl.trim()) {
      return apiBaseUrl.replace(/\/$/, "");
    }
    return detectFallbackApiBase();
  }

  const API_BASE = resolveApiBase();
  const TRIGGERS_ENDPOINT = `${API_BASE}/api/creator/triggers`;
  const state = {
    items: [],
    busyTriggerId: null,
    listEl: null,
    statusEl: null,
    updatedEl: null,
    countEl: null,
    resetBtn: null,
    enabledCountEl: null,
    platformCountEl: null,
    deployableCountEl: null,
    foundationReadyEl: null,
    foundationPillEl: null,
    foundationSummaryEl: null,
    readinessRelationshipEl: null,
  };

  function requestJson(url, options = {}) {
    return fetch(url, {
      credentials: "include",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    }).then(async (response) => {
      let payload = null;
      try {
        payload = await response.json();
      } catch (err) {
        payload = null;
      }
      if (!response.ok) {
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
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function setStatusPill(element, text, tone) {
    if (!(element instanceof HTMLElement)) return;
    element.classList.remove("warning", "success", "subtle");
    element.classList.add(tone || "subtle");
    const dot = element.querySelector(".status-dot");
    element.textContent = text;
    if (dot) {
      element.prepend(dot);
    }
  }

  function cacheElements(root = document) {
    state.listEl = root.querySelector("[data-trigger-list]");
    state.statusEl = root.querySelector("[data-trigger-status]");
    state.updatedEl = root.querySelector("[data-trigger-updated]");
    state.countEl = root.querySelector("[data-trigger-count]");
    state.resetBtn = root.querySelector("[data-trigger-reset]");
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
    if (!normalized) return "Unknown";
    if (normalized === "youtube") return "YouTube";
    return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function platformBadge(platform, detail) {
    const tone = detail?.trigger_execution_eligible ? "success" : detail?.chat_capable ? "warning" : "subtle";
    const label = detail?.trigger_execution_eligible
      ? "ready"
      : detail?.chat_capable
        ? "linked but limited"
        : "planned or unavailable";
    return `
      <div class="trigger-platform-detail">
        <div class="trigger-platform-detail-top">
          <strong>${escapeHtml(humanizePlatform(platform))}</strong>
          <span class="status-pill ${tone}">${escapeHtml(detail?.integration_status || "unlinked")}</span>
        </div>
        <p>${escapeHtml(label)}</p>
      </div>
    `;
  }

  function responseIntent(item) {
    if (item?.response_preview) return item.response_preview;
    if (item?.response_template) return item.response_template;
    return "No response preview is available yet.";
  }

  function readinessContribution(item) {
    const details = Object.values(item?.platform_applicability || {});
    if (!details.length) {
      return "No platform scope is currently exported for this trigger.";
    }
    if (details.some((detail) => detail?.trigger_execution_eligible)) {
      return "This trigger contributes to deployment readiness on at least one trigger-capable platform.";
    }
    if (details.some((detail) => detail?.chat_capable)) {
      return "This trigger is scoped to a linked chat-capable platform, but backend trigger execution is still limited there.";
    }
    return "This trigger stays foundation-only until a scoped platform becomes trigger-capable.";
  }

  function renderCard(item) {
    const platforms = item?.scope?.platforms || [];
    const applicability = item?.platform_applicability || {};
    const aliases = Array.isArray(item?.aliases) && item.aliases.length
      ? `<p class="trigger-card-aliases">Aliases: ${item.aliases.map((alias) => escapeHtml(alias)).join(", ")}</p>`
      : "";
    const disabled = state.busyTriggerId === item?.trigger_id;
    const platformDetails = platforms.map((platform) => platformBadge(platform, applicability[platform])).join("");
    return `
      <article class="trigger-card${disabled ? " is-changed" : ""}" data-trigger-card="${escapeHtml(item.trigger_id)}">
        <div class="trigger-card-header">
          <div>
            <h3 class="trigger-card-title">${escapeHtml(item.command_text)}</h3>
            <p>${escapeHtml(responseIntent(item))}</p>
            ${aliases}
          </div>
          <div class="trigger-card-meta">
            <span class="status-pill subtle">${escapeHtml(item.trigger_type || "chat_command")}</span>
            <label class="trigger-toggle${disabled ? " is-disabled" : ""}">
              <input type="checkbox" data-trigger-toggle="${escapeHtml(item.trigger_id)}" ${item.enabled ? "checked" : ""} ${disabled ? "disabled" : ""} />
              <span class="trigger-switch"></span>
              <span class="trigger-label">${disabled ? "Saving" : item.enabled ? "Enabled" : "Disabled"}</span>
            </label>
          </div>
        </div>
        <div class="trigger-card-body">
          <div class="trigger-card-section">
            <span class="trigger-section-label">Platform applicability</span>
            <div class="trigger-platform-grid">${platformDetails || '<span class="status-pill subtle">No scope</span>'}</div>
          </div>
          <div class="trigger-card-section">
            <span class="trigger-section-label">Deployment contribution</span>
            <p>${escapeHtml(readinessContribution(item))}</p>
          </div>
        </div>
      </article>
    `;
  }

  function uniquePlatformCount(items) {
    const platforms = new Set();
    items.forEach((item) => {
      ((item?.scope?.platforms) || []).forEach((platform) => platforms.add(platform));
    });
    return platforms.size;
  }

  function deployableRelationshipCount(items) {
    let count = 0;
    items.forEach((item) => {
      Object.values(item?.platform_applicability || {}).forEach((detail) => {
        if (detail?.trigger_execution_eligible) {
          count += 1;
        }
      });
    });
    return count;
  }

  function renderRelationshipSummary(items) {
    if (!(state.readinessRelationshipEl instanceof HTMLElement)) return;
    const lines = [];
    const enabledItems = items.filter((item) => item?.enabled);
    if (!enabledItems.length) {
      lines.push("Enable at least one foundational trigger before a linked platform can pass trigger-related readiness.");
    } else {
      lines.push(`${enabledItems.length} enabled foundational trigger${enabledItems.length === 1 ? "" : "s"} currently back the deployment model.`);
    }
    const deployable = deployableRelationshipCount(enabledItems);
    if (deployable) {
      lines.push(`${deployable} enabled trigger-to-platform relationship${deployable === 1 ? "" : "s"} is already trigger-capable.`);
    } else {
      lines.push("No enabled trigger is currently paired with a trigger-capable platform yet.");
    }
    const scopedPlatforms = uniquePlatformCount(items);
    lines.push(
      scopedPlatforms
        ? `${scopedPlatforms} platform scope${scopedPlatforms === 1 ? "" : "s"} is exported by the authoritative registry.`
        : "No platform scope is exported by the authoritative registry yet.",
    );
    state.readinessRelationshipEl.innerHTML = lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("");
  }

  function renderSummary(items) {
    const enabledCount = items.filter((item) => item?.enabled).length;
    const platformCount = uniquePlatformCount(items);
    const deployableCount = deployableRelationshipCount(items.filter((item) => item?.enabled));
    const foundationReady = enabledCount > 0;

    if (state.enabledCountEl) {
      state.enabledCountEl.textContent = String(enabledCount);
    }
    if (state.platformCountEl) {
      state.platformCountEl.textContent = String(platformCount);
    }
    if (state.deployableCountEl) {
      state.deployableCountEl.textContent = String(deployableCount);
    }
    if (state.foundationReadyEl) {
      state.foundationReadyEl.textContent = foundationReady ? "Available" : "Needs enablement";
    }
    setStatusPill(
      state.foundationPillEl,
      foundationReady ? "Foundational triggers enabled" : "Enable a foundation trigger",
      foundationReady ? "success" : items.length ? "warning" : "subtle",
    );
    if (state.foundationSummaryEl) {
      state.foundationSummaryEl.textContent = foundationReady
        ? deployableCount
          ? "At least one enabled foundational trigger is already paired with a trigger-capable platform."
          : "Foundational triggers are enabled, but linked platform capability still limits deployment."
        : items.length
          ? "The registry exists, but no foundational trigger is currently enabled."
          : "No trigger registry entries were returned by the backend.";
    }
    renderRelationshipSummary(items);
  }

  function render(payload) {
    state.items = Array.isArray(payload?.items) ? payload.items : [];
    if (state.countEl) {
      state.countEl.textContent = String(state.items.length);
    }
    if (state.updatedEl) {
      state.updatedEl.textContent = formatTimestamp(payload?.generated_at);
    }
    if (state.statusEl) {
      state.statusEl.textContent = state.items.length
        ? "Authoritative registry loaded"
        : "No triggers available";
      state.statusEl.classList.remove("warning", "success", "subtle");
      state.statusEl.classList.add(state.items.length ? "success" : "subtle");
    }
    renderSummary(state.items);
    if (state.listEl) {
      state.listEl.innerHTML = state.items.length
        ? state.items.map(renderCard).join("")
        : `
          <article class="trigger-card trigger-empty-card">
            <h3 class="trigger-card-title">Foundational trigger registry is empty</h3>
            <p>The UI is ready for authoritative trigger entries, but runtime/Auth did not return any registry items yet.</p>
          </article>
        `;
    }
  }

  function renderLoadFailure(message) {
    if (state.statusEl) {
      state.statusEl.textContent = message || "Unable to load trigger registry";
      state.statusEl.classList.remove("success", "subtle");
      state.statusEl.classList.add("warning");
    }
    setStatusPill(state.foundationPillEl, "Registry unavailable", "warning");
    if (state.foundationSummaryEl) {
      state.foundationSummaryEl.textContent = message || "Unable to load trigger registry.";
    }
    if (state.readinessRelationshipEl) {
      state.readinessRelationshipEl.innerHTML = `<li>${escapeHtml(message || "Unable to load trigger registry.")}</li>`;
    }
    if (state.listEl) {
      state.listEl.innerHTML = `
        <article class="trigger-card trigger-empty-card">
          <h3 class="trigger-card-title">Trigger registry unavailable</h3>
          <p>${escapeHtml(message || "Unable to load trigger registry.")}</p>
        </article>
      `;
    }
  }

  async function loadTriggers() {
    try {
      const payload = await requestJson(TRIGGERS_ENDPOINT, { method: "GET" });
      render(payload);
    } catch (err) {
      renderLoadFailure(err?.message || "Unable to load trigger registry");
    }
  }

  async function updateTrigger(triggerId, enabled) {
    state.busyTriggerId = triggerId;
    render({
      items: state.items,
      generated_at: new Date().toISOString(),
    });
    const payload = await requestJson(`${TRIGGERS_ENDPOINT}/${encodeURIComponent(triggerId)}`, {
      method: "PATCH",
      body: JSON.stringify({ enabled }),
    });
    const updated = payload?.trigger || null;
    if (updated) {
      state.items = state.items.map((item) => (item.trigger_id === triggerId ? updated : item));
    }
    state.busyTriggerId = null;
    render({
      items: state.items,
      generated_at: payload?.generated_at || new Date().toISOString(),
    });
  }

  function bindEvents() {
    if (state.listEl) {
      state.listEl.addEventListener("change", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) return;
        const triggerId = target.getAttribute("data-trigger-toggle");
        if (!triggerId || state.busyTriggerId) return;
        const nextEnabled = target.checked;
        void updateTrigger(triggerId, nextEnabled).catch((err) => {
          state.busyTriggerId = null;
          render({
            items: state.items,
            generated_at: new Date().toISOString(),
          });
          if (state.statusEl) {
            state.statusEl.textContent = err?.message || "Unable to update trigger";
            state.statusEl.classList.remove("success", "subtle");
            state.statusEl.classList.add("warning");
          }
        });
      });
    }
    if (state.resetBtn) {
      state.resetBtn.addEventListener("click", () => {
        void loadTriggers();
      });
    }
  }

  function init(root = document) {
    cacheElements(root);
    if (!state.listEl) return;
    bindEvents();
    void loadTriggers();
  }

  document.addEventListener("DOMContentLoaded", () => init(document), { once: true });
})();
