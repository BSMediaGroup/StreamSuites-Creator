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
    listEl: null,
    statusEl: null,
    updatedEl: null,
    countEl: null,
    resetBtn: null,
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

  function cacheElements(root = document) {
    state.listEl = root.querySelector("[data-trigger-list]");
    state.statusEl = root.querySelector("[data-trigger-status]");
    state.updatedEl = root.querySelector("[data-trigger-updated]");
    state.countEl = root.querySelector("[data-trigger-count]");
    state.resetBtn = root.querySelector("[data-trigger-reset]");
  }

  function platformBadge(platform, detail) {
    const tone = detail?.trigger_execution_eligible ? "success" : detail?.chat_capable ? "warning" : "subtle";
    const status = detail?.integration_status || "unlinked";
    return `<span class="status-pill ${tone}">${escapeHtml(platform)} · ${escapeHtml(status)}</span>`;
  }

  function renderCard(item) {
    const platforms = item?.scope?.platforms || [];
    const applicability = item?.platform_applicability || {};
    const aliases = Array.isArray(item?.aliases) && item.aliases.length
      ? `<p class="trigger-card-aliases">Aliases: ${item.aliases.map((alias) => escapeHtml(alias)).join(", ")}</p>`
      : "";
    const badges = platforms.map((platform) => platformBadge(platform, applicability[platform])).join("");
    return `
      <article class="trigger-card" data-trigger-card="${escapeHtml(item.trigger_id)}">
        <div class="trigger-card-header">
          <div>
            <h3 class="trigger-card-title">${escapeHtml(item.command_text)}</h3>
            <p>${escapeHtml(item.response_preview || item.response_template || "No response preview available.")}</p>
            ${aliases}
          </div>
          <div class="trigger-card-meta">
            <span class="status-pill subtle">${escapeHtml(item.trigger_type || "chat_command")}</span>
            <label class="trigger-toggle">
              <input type="checkbox" data-trigger-toggle="${escapeHtml(item.trigger_id)}" ${item.enabled ? "checked" : ""} />
              <span class="trigger-switch"></span>
              <span class="trigger-label">${item.enabled ? "Enabled" : "Disabled"}</span>
            </label>
          </div>
        </div>
        <div class="trigger-platform-grid">${badges || '<span class="status-pill subtle">No scope</span>'}</div>
      </article>
    `;
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
    if (state.listEl) {
      state.listEl.innerHTML = state.items.map(renderCard).join("");
    }
  }

  async function loadTriggers() {
    try {
      const payload = await requestJson(TRIGGERS_ENDPOINT, { method: "GET" });
      render(payload);
    } catch (err) {
      if (state.statusEl) {
        state.statusEl.textContent = err?.message || "Unable to load trigger registry";
        state.statusEl.classList.remove("success", "subtle");
        state.statusEl.classList.add("warning");
      }
      if (state.listEl) {
        state.listEl.innerHTML = `<article class="trigger-card"><p>${escapeHtml(err?.message || "Unable to load trigger registry.")}</p></article>`;
      }
    }
  }

  async function updateTrigger(triggerId, enabled) {
    const payload = await requestJson(`${TRIGGERS_ENDPOINT}/${encodeURIComponent(triggerId)}`, {
      method: "PATCH",
      body: JSON.stringify({ enabled }),
    });
    const updated = payload?.trigger || null;
    if (!updated) return;
    state.items = state.items.map((item) => (item.trigger_id === triggerId ? updated : item));
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
        if (!triggerId) return;
        void updateTrigger(triggerId, target.checked).catch((err) => {
          target.checked = !target.checked;
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
