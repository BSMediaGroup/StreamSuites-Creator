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
  const CREATOR_MODERATORS_ENDPOINT = `${API_BASE}/api/creator/moderators`;
  const CREATOR_MODERATOR_LOOKUP_ENDPOINT = `${API_BASE}/api/creator/moderators/lookup`;

  const state = {
    moderators: [],
    moderatorSearchResults: [],
    activeSurface: null,
    boundSearchButton: null,
    boundSearchInput: null,
    boundSearchHandler: null,
    boundInputHandler: null,
  };

  function hasModeratorSurface() {
    return !!document.querySelector("[data-moderator-surface=\"true\"]");
  }

  function getElements() {
    return {
      surface: document.querySelector("[data-moderator-surface=\"true\"]"),
      statusPill: document.querySelector("[data-moderator-status-pill=\"true\"]"),
      scopeSummary: document.querySelector("[data-moderator-scope-summary=\"true\"]"),
      countValue: document.querySelector("[data-moderator-count=\"true\"]"),
      searchInput: document.querySelector("[data-moderator-search-input=\"true\"]"),
      searchButton: document.querySelector("[data-moderator-search-button=\"true\"]"),
      searchResults: document.querySelector("[data-moderator-search-results=\"true\"]"),
      searchEmpty: document.querySelector("[data-moderator-search-empty=\"true\"]"),
      list: document.querySelector("[data-moderator-list=\"true\"]"),
      listEmpty: document.querySelector("[data-moderator-list-empty=\"true\"]"),
    };
  }

  function escapeHtml(value) {
    if (value === undefined || value === null) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function showToast(message, tone = "info", options = {}) {
    if (!message) return;
    const mappedTone =
      tone === "danger"
        ? "danger"
        : tone === "warning"
          ? "warning"
          : tone === "success"
            ? "success"
            : "info";
    window.StreamSuitesAuth?.showToast?.(message, {
      tone: mappedTone,
      title: options.title || (mappedTone === "danger" ? "Error" : mappedTone),
      autoHideMs: options.autoHideMs,
      key: options.key,
    });
  }

  async function requestJson(url, options = {}) {
    const response = await fetch(url, {
      credentials: "include",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
    let payload = null;
    try {
      payload = await response.json();
    } catch (err) {
      payload = null;
    }
    if (!response.ok) {
      const message = payload?.error || payload?.message || `Request failed (${response.status})`;
      if (response.status === 401 || response.status === 403) {
        window.StreamSuitesAuth?.reportProtectedDataFailure?.({
          status: response.status,
          message,
          source: "creator-moderators",
        });
      }
      const error = new Error(message);
      error.payload = payload;
      error.status = response.status;
      throw error;
    }
    return payload || {};
  }

  function setModeratorStatus(message, tone = "subtle") {
    const els = getElements();
    if (!(els.statusPill instanceof HTMLElement)) return;
    els.statusPill.className = `status-pill ${tone}`;
    els.statusPill.innerHTML = `<span class="status-dot"></span>${escapeHtml(message || "")}`;
  }

  function updateModeratorCount() {
    const els = getElements();
    if (!(els.countValue instanceof HTMLElement)) return;
    els.countValue.textContent = String(Array.isArray(state.moderators) ? state.moderators.length : 0);
  }

  function getCapabilitySummary(capabilities) {
    const enabled = capabilities && typeof capabilities === "object"
      ? Object.entries(capabilities)
          .filter(([, value]) => value === true)
          .map(([key]) => key.replace(/_/g, " "))
      : [];
    return enabled.length
      ? enabled
      : ["overlay artifacts", "overlay chat", "clip metadata", "polls"];
  }

  function renderModeratorAssignments() {
    const els = getElements();
    if (!(els.list instanceof HTMLElement) || !(els.listEmpty instanceof HTMLElement)) return;
    const assignments = Array.isArray(state.moderators) ? state.moderators : [];
    els.list.replaceChildren();
    els.listEmpty.classList.toggle("hidden", assignments.length > 0);
    assignments.forEach((assignment) => {
      const moderator = assignment?.moderator_account && typeof assignment.moderator_account === "object"
        ? assignment.moderator_account
        : {};
      const capabilities = getCapabilitySummary(assignment?.capabilities);
      const card = document.createElement("article");
      card.className = "card moderator-assignment-card";
      card.innerHTML = `
        <div class="card-top moderator-assignment-top">
          <div>
            <div class="moderator-card-heading">
              <h4>${escapeHtml(moderator.display_name || moderator.user_code || "Moderator")}</h4>
              <span class="status-pill success"><span class="status-dot"></span>Active</span>
            </div>
            <p class="account-note">${escapeHtml(moderator.user_code || "")}${moderator.email ? ` · ${escapeHtml(moderator.email)}` : ""}</p>
          </div>
          <button class="creator-button secondary" type="button" data-moderator-remove="${escapeHtml(
            assignment.moderator_account_id || ""
          )}">Remove</button>
        </div>
        <p class="account-note">Current scope: ${escapeHtml(capabilities.join(", "))}.</p>
      `;
      els.list.appendChild(card);
    });
    els.list.querySelectorAll("[data-moderator-remove]").forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) return;
      button.addEventListener("click", async () => {
        const moderatorId = button.dataset.moderatorRemove || "";
        if (!moderatorId) return;
        const confirmed = window.confirm("Remove this moderator assignment for your creator workspace?");
        if (!confirmed) return;
        button.disabled = true;
        try {
          await requestJson(
            `${CREATOR_MODERATORS_ENDPOINT}/${encodeURIComponent(moderatorId)}`,
            { method: "DELETE" }
          );
          await loadModeratorAssignments();
          showToast("Moderator removed.", "success", { title: "Moderators" });
        } catch (err) {
          showToast(err?.message || "Unable to remove moderator.", "danger", { title: "Moderators" });
        } finally {
          button.disabled = false;
        }
      });
    });
  }

  function renderModeratorSearchResults() {
    const els = getElements();
    if (!(els.searchResults instanceof HTMLElement) || !(els.searchEmpty instanceof HTMLElement)) return;
    const matches = Array.isArray(state.moderatorSearchResults) ? state.moderatorSearchResults : [];
    els.searchResults.replaceChildren();
    els.searchEmpty.classList.toggle("hidden", matches.length > 0);
    matches.forEach((item) => {
      const card = document.createElement("article");
      card.className = "card moderator-search-card";
      card.innerHTML = `
        <div class="card-top moderator-assignment-top">
          <div>
            <h4>${escapeHtml(item.display_name || item.user_code || "Account")}</h4>
            <p class="account-note">${escapeHtml(item.user_code || "")}${item.email ? ` · ${escapeHtml(item.email)}` : ""}</p>
          </div>
          <button class="creator-button primary" type="button" data-moderator-assign="${escapeHtml(
            item.account_id || ""
          )}">Assign</button>
        </div>
        <p class="account-note">Role: ${escapeHtml(String(item.role || "public").toUpperCase())}</p>
      `;
      els.searchResults.appendChild(card);
    });
    els.searchResults.querySelectorAll("[data-moderator-assign]").forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) return;
      button.addEventListener("click", async () => {
        button.disabled = true;
        try {
          await requestJson(CREATOR_MODERATORS_ENDPOINT, {
            method: "POST",
            body: JSON.stringify({
              moderator_account_id: button.dataset.moderatorAssign || "",
            }),
          });
          state.moderatorSearchResults = [];
          renderModeratorSearchResults();
          const searchEls = getElements();
          if (searchEls.searchInput instanceof HTMLInputElement) {
            searchEls.searchInput.value = "";
          }
          await loadModeratorAssignments();
          showToast("Moderator assigned.", "success", { title: "Moderators" });
        } catch (err) {
          showToast(err?.message || "Unable to assign moderator.", "danger", { title: "Moderators" });
        } finally {
          button.disabled = false;
        }
      });
    });
  }

  async function loadModeratorAssignments() {
    const els = getElements();
    if (!(els.scopeSummary instanceof HTMLElement)) return null;
    setModeratorStatus("Loading", "subtle");
    const payload = await requestJson(CREATOR_MODERATORS_ENDPOINT, { method: "GET" });
    state.moderators = Array.isArray(payload.items) ? payload.items : [];
    const scope = getCapabilitySummary(payload.scope_summary?.capabilities);
    els.scopeSummary.textContent = `Current moderator scope: ${scope.join(", ")}.`;
    setModeratorStatus(
      state.moderators.length ? `${state.moderators.length} assigned` : "No moderators assigned",
      state.moderators.length ? "success" : "subtle"
    );
    updateModeratorCount();
    renderModeratorAssignments();
    renderModeratorSearchResults();
    return payload;
  }

  async function handleModeratorSearch() {
    const els = getElements();
    const query = els.searchInput instanceof HTMLInputElement ? els.searchInput.value.trim() : "";
    if (query.length < 2) {
      showToast("Enter at least 2 characters to search accounts.", "warning", { title: "Moderators" });
      return;
    }
    setModeratorStatus("Searching", "subtle");
    try {
      const payload = await requestJson(
        `${CREATOR_MODERATOR_LOOKUP_ENDPOINT}?q=${encodeURIComponent(query)}`,
        { method: "GET" }
      );
      state.moderatorSearchResults = Array.isArray(payload.items) ? payload.items : [];
      renderModeratorSearchResults();
      setModeratorStatus("Search ready", "subtle");
    } catch (err) {
      showToast(err?.message || "Unable to search accounts.", "danger", { title: "Moderators" });
      setModeratorStatus("Search unavailable", "warning");
    }
  }

  function wireModeratorControls() {
    const els = getElements();
    if (!(els.searchButton instanceof HTMLButtonElement)) return;
    if (state.boundSearchButton === els.searchButton) return;
    if (state.boundSearchButton instanceof HTMLButtonElement && typeof state.boundSearchHandler === "function") {
      state.boundSearchButton.removeEventListener("click", state.boundSearchHandler);
    }
    if (state.boundSearchInput instanceof HTMLInputElement && typeof state.boundInputHandler === "function") {
      state.boundSearchInput.removeEventListener("keydown", state.boundInputHandler);
    }
    state.boundSearchHandler = () => {
      void handleModeratorSearch();
    };
    state.boundInputHandler = (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      void handleModeratorSearch();
    };
    els.searchButton.addEventListener("click", state.boundSearchHandler);
    if (els.searchInput instanceof HTMLInputElement) {
      els.searchInput.addEventListener("keydown", state.boundInputHandler);
      state.boundSearchInput = els.searchInput;
    } else {
      state.boundSearchInput = null;
    }
    state.boundSearchButton = els.searchButton;
  }

  async function initModeratorSurface() {
    const els = getElements();
    if (!(els.surface instanceof HTMLElement)) return;
    if (state.activeSurface === els.surface) return;
    state.activeSurface = els.surface;
    wireModeratorControls();
    try {
      await loadModeratorAssignments();
    } catch (err) {
      setModeratorStatus("Moderators unavailable", "warning");
      showToast(
        err?.message || "Unable to load creator moderator assignments.",
        "danger",
        {
          key: "creator-moderators-load",
          title: "Moderators",
          autoHideMs: 6800,
        }
      );
    }
  }

  function destroyModeratorSurface() {
    state.moderators = [];
    state.moderatorSearchResults = [];
    state.activeSurface = null;
  }

  window.CreatorModeratorSurface = {
    hasSurface: hasModeratorSurface,
    init: initModeratorSurface,
    destroy: destroyModeratorSurface,
  };

  window.CreatorPreferencesView = {
    init: initModeratorSurface,
    destroy: destroyModeratorSurface,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      void initModeratorSurface();
    }, { once: true });
  } else if (hasModeratorSurface()) {
    void initModeratorSurface();
  }
})();
