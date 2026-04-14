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
    editorTriggerId: null,
    busyTriggerId: null,
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
    editorPanel: null,
    editorTitleEl: null,
    editorPillEl: null,
    editorNoteEl: null,
    editorForm: null,
    editorCancelBtn: null,
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
        "Content-Type": "application/json",
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
    state.editorPanel = root.querySelector("[data-trigger-editor-panel]");
    state.editorTitleEl = root.querySelector("[data-trigger-editor-title]");
    state.editorPillEl = root.querySelector("[data-trigger-editor-pill]");
    state.editorNoteEl = root.querySelector("[data-trigger-editor-note]");
    state.editorForm = root.querySelector("[data-trigger-form]");
    state.editorCancelBtn = root.querySelector("[data-trigger-editor-cancel]");
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
        if (detail?.trigger_execution_eligible) count += 1;
      });
    });
    return count;
  }

  function renderRelationshipSummary(items) {
    if (!(state.readinessRelationshipEl instanceof HTMLElement)) return;
    const enabledItems = items.filter((item) => item?.enabled);
    const rumbleOperational = enabledItems.filter((item) => {
      const rumble = item?.platform_applicability?.rumble || {};
      return rumble.trigger_execution_eligible;
    });
    const lines = [
      enabledItems.length
        ? `${enabledItems.length} enabled trigger${enabledItems.length === 1 ? "" : "s"} currently back the creator registry.`
        : "Enable at least one trigger before runtime can respond on Rumble.",
      rumbleOperational.length
        ? `${rumbleOperational.length} enabled trigger${rumbleOperational.length === 1 ? "" : "s"} is operationally eligible for Rumble in this phase.`
        : "Rumble remains blocked until a managed session is attached with chat-capable auth.",
      "Manual sends are separate from automatic trigger execution and remain on the Rumble integration page.",
    ];
    state.readinessRelationshipEl.innerHTML = lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("");
  }

  function renderSummary(items) {
    const enabledCount = items.filter((item) => item?.enabled).length;
    const platformCount = uniquePlatformCount(items);
    const deployableCount = deployableRelationshipCount(items.filter((item) => item?.enabled));
    const foundationReady = enabledCount > 0;

    if (state.enabledCountEl) state.enabledCountEl.textContent = String(enabledCount);
    if (state.platformCountEl) state.platformCountEl.textContent = String(platformCount);
    if (state.deployableCountEl) state.deployableCountEl.textContent = String(deployableCount);
    if (state.foundationReadyEl) state.foundationReadyEl.textContent = foundationReady ? "Available" : "Needs enablement";
    setStatusPill(
      state.foundationPillEl,
      foundationReady ? "Registry active" : "Enable a trigger",
      foundationReady ? "success" : items.length ? "warning" : "subtle",
    );
    if (state.foundationSummaryEl) {
      state.foundationSummaryEl.textContent = foundationReady
        ? deployableCount
          ? "At least one enabled trigger is already paired with a Rumble-capable relationship."
          : "Triggers are configured, but Rumble session capability still limits automatic replies."
        : items.length
          ? "The registry exists, but no trigger is currently enabled."
          : "No trigger registry entries were returned by runtime/Auth.";
    }
    renderRelationshipSummary(items);
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
      ? "operational"
      : platform === "rumble"
        ? "linked but blocked"
        : "not in scope";
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

  function triggerPhaseLabel(item) {
    if (String(item?.trigger_type || "").trim().toLowerCase() !== "chat_command") {
      return "Unsupported in this phase";
    }
    if (String(item?.response_mode || "").trim().toLowerCase() !== "static_text") {
      return "Unsupported in this phase";
    }
    const rumble = item?.platform_applicability?.rumble || {};
    return rumble.trigger_execution_eligible ? "Live for Rumble" : "Configured, waiting on Rumble posture";
  }

  function responseIntent(item) {
    return item?.response_preview || item?.response_template || "No response text configured.";
  }

  function canDelete(item) {
    return !item?.metadata?.builtin;
  }

  function renderCard(item) {
    const disabled = state.busyTriggerId === item?.trigger_id;
    const platforms = item?.scope?.platforms || [];
    const applicability = item?.platform_applicability || {};
    const aliases = Array.isArray(item?.aliases) && item.aliases.length
      ? `<p class="trigger-card-aliases">Aliases: ${item.aliases.map((alias) => escapeHtml(alias)).join(", ")}</p>`
      : "";
    const cooldownText = Number.isFinite(Number(item?.cooldown_seconds)) ? `${Number(item.cooldown_seconds)}s cooldown` : "Runtime cooldown guard";
    return `
      <article class="trigger-card${disabled ? " is-changed" : ""}" data-trigger-card="${escapeHtml(item.trigger_id)}">
        <div class="trigger-card-header">
          <div>
            <h3 class="trigger-card-title">${escapeHtml(item.command_text)}</h3>
            <p>${escapeHtml(responseIntent(item))}</p>
            ${aliases}
          </div>
          <div class="trigger-card-meta">
            <span class="status-pill subtle">${escapeHtml(cooldownText)}</span>
            <label class="trigger-toggle${disabled ? " is-disabled" : ""}">
              <span class="switch-button">
                <span class="switch-scale">
                  <span class="switch-outer">
                    <input type="checkbox" aria-label="${escapeHtml(item.command_text)} toggle" data-trigger-toggle="${escapeHtml(item.trigger_id)}" ${item.enabled ? "checked" : ""} ${disabled ? "disabled" : ""} />
                    <span class="ss-switch-inner">
                      <span class="ss-switch-toggle"></span>
                      <span class="ss-switch-indicator"></span>
                    </span>
                  </span>
                </span>
              </span>
              <span class="trigger-label">${disabled ? "Saving" : item.enabled ? "Enabled" : "Disabled"}</span>
            </label>
          </div>
        </div>
        <div class="trigger-card-body">
          <div class="trigger-card-section">
            <span class="trigger-section-label">Phase status</span>
            <p>${escapeHtml(triggerPhaseLabel(item))}</p>
          </div>
          <div class="trigger-card-section">
            <span class="trigger-section-label">Platform applicability</span>
            <div class="trigger-platform-grid">${platforms.map((platform) => platformBadge(platform, applicability[platform])).join("")}</div>
          </div>
          <div class="trigger-card-section">
            <span class="trigger-section-label">Actions</span>
            <div class="platform-actions">
              <button class="creator-button secondary" type="button" data-trigger-edit="${escapeHtml(item.trigger_id)}">Edit</button>
              ${canDelete(item)
                ? `<button class="creator-button danger" type="button" data-trigger-delete="${escapeHtml(item.trigger_id)}">Delete</button>`
                : `<span class="status-pill subtle">Built-in foundation trigger</span>`}
            </div>
          </div>
        </div>
      </article>
    `;
  }

  function render(payload) {
    state.items = Array.isArray(payload?.items) ? payload.items : [];
    if (state.countEl) state.countEl.textContent = String(state.items.length);
    if (state.updatedEl) state.updatedEl.textContent = formatTimestamp(payload?.generated_at);
    if (state.statusEl) {
      state.statusEl.textContent = state.items.length ? "Authoritative registry loaded" : "No triggers available";
      state.statusEl.classList.remove("warning", "success", "subtle");
      state.statusEl.classList.add(state.items.length ? "success" : "subtle");
    }
    renderSummary(state.items);
    if (state.listEl) {
      state.listEl.innerHTML = state.items.length
        ? state.items.map(renderCard).join("")
        : `
          <article class="trigger-card trigger-empty-card">
            <h3 class="trigger-card-title">No trigger rows yet</h3>
            <p>Add a Rumble text trigger to make the first phase operational.</p>
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
      state.foundationSummaryEl.textContent = message || "Runtime/Auth did not return the trigger registry.";
    }
    if (state.listEl) {
      state.listEl.innerHTML = `
        <article class="trigger-card trigger-empty-card">
          <h3 class="trigger-card-title">Unable to load triggers</h3>
          <p>${escapeHtml(message || "Try again once runtime/Auth is available.")}</p>
        </article>
      `;
    }
  }

  async function loadTriggers() {
    try {
      render(await requestJson(TRIGGERS_ENDPOINT, { method: "GET" }));
    } catch (err) {
      renderLoadFailure(String(err?.message || "Unable to load trigger registry."));
    }
  }

  function showEditor(trigger = null) {
    if (!(state.editorPanel instanceof HTMLElement) || !(state.editorForm instanceof HTMLFormElement)) return;
    state.editorTriggerId = trigger?.trigger_id || null;
    state.editorPanel.hidden = false;
    const isEditing = Boolean(trigger);
    const rumbleOnlyScope = { mode: "platform_list", platforms: ["rumble"] };
    state.editorForm.elements.namedItem("trigger_id").value = trigger?.trigger_id || "";
    state.editorForm.elements.namedItem("command_text").value = trigger?.command_text || "";
    state.editorForm.elements.namedItem("response_template").value = trigger?.response_template || "";
    state.editorForm.elements.namedItem("enabled").checked = trigger?.enabled !== false;
    state.editorForm.elements.namedItem("cooldown_seconds").value = String(Number(trigger?.cooldown_seconds ?? 5));
    state.editorForm.dataset.scope = JSON.stringify(trigger?.scope || rumbleOnlyScope);
    if (state.editorTitleEl) state.editorTitleEl.textContent = isEditing ? `Edit ${trigger.command_text}` : "Add Rumble text trigger";
    if (state.editorNoteEl) {
      state.editorNoteEl.textContent = isEditing
        ? "Edit the authoritative command and response text. Runtime will evaluate this for managed Rumble sessions only in phase one."
        : "New creator-authored rows created here are scoped to Rumble text replies in phase one.";
    }
    setStatusPill(state.editorPillEl, isEditing ? "Editing existing trigger" : "Adding new trigger", "subtle");
  }

  function hideEditor() {
    if (!(state.editorPanel instanceof HTMLElement) || !(state.editorForm instanceof HTMLFormElement)) return;
    state.editorTriggerId = null;
    state.editorPanel.hidden = true;
    state.editorForm.reset();
    state.editorForm.elements.namedItem("enabled").checked = true;
    state.editorForm.elements.namedItem("cooldown_seconds").value = "5";
    state.editorForm.elements.namedItem("trigger_id").value = "";
    delete state.editorForm.dataset.scope;
  }

  async function saveTrigger(form) {
    const triggerId = String(form.elements.namedItem("trigger_id").value || "").trim();
    const scope = JSON.parse(form.dataset.scope || "{\"mode\":\"platform_list\",\"platforms\":[\"rumble\"]}");
    const payload = {
      command_text: String(form.elements.namedItem("command_text").value || "").trim(),
      response_template: String(form.elements.namedItem("response_template").value || "").trim(),
      enabled: Boolean(form.elements.namedItem("enabled").checked),
      cooldown_seconds: Number(form.elements.namedItem("cooldown_seconds").value || 5),
      scope,
    };
    try {
      state.busyTriggerId = triggerId || "__create__";
      if (triggerId) {
        await requestJson(`${TRIGGERS_ENDPOINT}/${encodeURIComponent(triggerId)}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await requestJson(TRIGGERS_ENDPOINT, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
    } finally {
      state.busyTriggerId = null;
    }
    hideEditor();
    await loadTriggers();
  }

  async function updateTriggerEnabled(triggerId, enabled) {
    state.busyTriggerId = triggerId;
    try {
      await requestJson(`${TRIGGERS_ENDPOINT}/${encodeURIComponent(triggerId)}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled }),
      });
      await loadTriggers();
    } finally {
      state.busyTriggerId = null;
    }
  }

  async function deleteTrigger(triggerId) {
    state.busyTriggerId = triggerId;
    try {
      await requestJson(`${TRIGGERS_ENDPOINT}/${encodeURIComponent(triggerId)}`, {
        method: "DELETE",
      });
      await loadTriggers();
    } finally {
      state.busyTriggerId = null;
    }
  }

  function bindEvents(root = document) {
    state.abortController = new AbortController();
    const signal = state.abortController.signal;

    root.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || !target.matches("[data-trigger-toggle]")) return;
      void updateTriggerEnabled(target.getAttribute("data-trigger-toggle") || "", target.checked).catch((err) => {
        renderLoadFailure(String(err?.message || "Unable to update trigger."));
      });
    }, { signal });

    root.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      const addButton = target.closest("[data-trigger-add]");
      if (addButton instanceof HTMLElement) {
        showEditor(null);
        return;
      }
      const editButton = target.closest("[data-trigger-edit]");
      if (editButton instanceof HTMLElement) {
        const triggerId = editButton.getAttribute("data-trigger-edit") || "";
        const trigger = state.items.find((item) => item?.trigger_id === triggerId) || null;
        showEditor(trigger);
        return;
      }
      const deleteButton = target.closest("[data-trigger-delete]");
      if (deleteButton instanceof HTMLElement) {
        const triggerId = deleteButton.getAttribute("data-trigger-delete") || "";
        if (!triggerId) return;
        if (!window.confirm("Delete this trigger? Built-in foundation rows cannot be removed.")) return;
        void deleteTrigger(triggerId).catch((err) => {
          renderLoadFailure(String(err?.message || "Unable to delete trigger."));
        });
        return;
      }
      if (target.closest("[data-trigger-reset]")) {
        void loadTriggers();
        return;
      }
      if (target.closest("[data-trigger-editor-cancel]")) {
        hideEditor();
      }
    }, { signal });

    state.editorForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      void saveTrigger(event.currentTarget).catch((err) => {
        setStatusPill(state.editorPillEl, "Save failed", "warning");
        if (state.editorNoteEl instanceof HTMLElement) {
          state.editorNoteEl.textContent = String(err?.message || "Unable to save trigger.");
        }
        state.busyTriggerId = null;
      });
    }, { signal });

    state.editorCancelBtn?.addEventListener("click", hideEditor, { signal });
  }

  function init(root = document) {
    if (state.root === root && state.abortController) {
      return;
    }
    if (state.abortController) {
      state.abortController.abort();
    }
    state.root = root;
    cacheElements(root);
    bindEvents(root);
    hideEditor();
    void loadTriggers();
  }

  function destroy() {
    if (state.abortController) {
      state.abortController.abort();
      state.abortController = null;
    }
    state.root = null;
    state.items = [];
    state.editorTriggerId = null;
    state.busyTriggerId = null;
  }

  window.TriggersView = {
    init,
    destroy,
  };
})();
