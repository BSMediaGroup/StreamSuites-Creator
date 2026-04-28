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
  const CUSTOM_TRIGGERS_ENDPOINT = `${API_BASE}/api/livechat/custom-triggers`;
  const CUSTOM_TRIGGER_PREVIEW_ENDPOINT = `${API_BASE}/api/livechat/custom-triggers/preview`;

  const state = {
    items: [],
    summary: null,
    capabilities: [],
    customItems: [],
    customCap: null,
    previewResult: null,
    editingId: "",
    root: null,
    abortController: null,
  };

  const el = {};

  function requestJson(url, options = {}) {
    const creatorHeaders =
      typeof window.StreamSuitesAuth?.creatorContext?.buildHeaders === "function"
        ? window.StreamSuitesAuth.creatorContext.buildHeaders()
        : {};
    const body = options.body && typeof options.body !== "string" ? JSON.stringify(options.body) : options.body;
    return fetch(url, {
      credentials: "include",
      cache: "no-store",
      ...options,
      body,
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
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
    el.list = root.querySelector("[data-trigger-list]");
    el.status = root.querySelector("[data-trigger-status]");
    el.updated = root.querySelector("[data-trigger-updated]");
    el.count = root.querySelector("[data-trigger-count]");
    el.enabledCount = root.querySelector("[data-trigger-enabled-count]");
    el.platformCount = root.querySelector("[data-trigger-platform-count]");
    el.deployableCount = root.querySelector("[data-trigger-deployable-count]");
    el.foundationReady = root.querySelector("[data-trigger-foundation-ready]");
    el.foundationPill = root.querySelector("[data-trigger-foundation-pill]");
    el.foundationSummary = root.querySelector("[data-trigger-foundation-summary]");
    el.readinessRelationship = root.querySelector("[data-trigger-readiness-relationship]");
    el.customList = root.querySelector("[data-custom-trigger-list]");
    el.customStatus = root.querySelector("[data-custom-trigger-status]");
    el.customCap = root.querySelector("[data-custom-trigger-cap]");
    el.customEmpty = root.querySelector("[data-custom-trigger-empty]");
    el.customForm = root.querySelector("[data-custom-trigger-form]");
    el.customSubmit = root.querySelector("[data-custom-trigger-submit]");
    el.customCancel = root.querySelector("[data-custom-trigger-cancel]");
    el.previewForm = root.querySelector("[data-custom-trigger-preview-form]");
    el.previewSelect = root.querySelector("[data-preview-trigger-select]");
    el.previewResult = root.querySelector("[data-custom-trigger-preview-result]");
    el.previewSubmit = root.querySelector("[data-custom-trigger-preview-submit]");
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
    if (el.enabledCount) el.enabledCount.textContent = String(counts.trigger_count || state.items.length);
    if (el.platformCount) el.platformCount.textContent = String(platformCount);
    if (el.deployableCount) el.deployableCount.textContent = String(counts.game_count || 0);
    if (el.foundationReady) el.foundationReady.textContent = "Read-only";
    setStatusPill(el.foundationPill, "Global registry: read-only runtime seed", "success");
    if (el.foundationSummary) {
      el.foundationSummary.textContent = `${counts.trigger_count || state.items.length} trigger definitions, ${counts.game_count || 0} game definitions, and ${counts.asset_count || 0} asset catalog entries are served by StreamSuites runtime/Auth.`;
    }
    if (el.readinessRelationship) {
      el.readinessRelationship.innerHTML = [
        "Global registry rows remain immutable on this page.",
        "Custom triggers are creator-owned runtime config records managed separately below.",
        pilled?.enabled === false ? "Pilled is planned/disabled; active custom Pilled enablement is blocked by runtime/Auth." : "Platform capability metadata is loaded from runtime/Auth.",
      ].map((line) => `<li>${escapeHtml(line)}</li>`).join("");
    }
  }

  function renderRegistryCard(item) {
    const platforms = Array.isArray(item?.eligible_platforms) ? item.eligible_platforms : [];
    const aliases = Array.isArray(item?.aliases) && item.aliases.length
      ? `<p class="trigger-card-aliases">Aliases: ${item.aliases.map((alias) => escapeHtml(alias)).join(", ")}</p>`
      : "";
    const isGames = String(item?.module || "").toUpperCase() === "GAMES";
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
            <p>Global registry: read-only runtime seed.</p>
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
            <p>No trigger dispatch or transport sending is implemented by this registry view.</p>
          </div>
        </div>
      </article>
    `;
  }

  function renderRegistry(payloads) {
    state.summary = payloads.summary || null;
    state.items = Array.isArray(payloads.triggers?.items) ? payloads.triggers.items : [];
    state.capabilities = Array.isArray(payloads.capabilities?.items) ? payloads.capabilities.items : [];
    if (el.count) el.count.textContent = String(state.items.length);
    if (el.updated) el.updated.textContent = formatTimestamp(payloads.triggers?.served_at || state.summary?.served_at);
    if (el.status) {
      el.status.textContent = state.items.length ? "Runtime registry loaded" : "No triggers returned";
      el.status.classList.remove("warning", "success", "subtle");
      el.status.classList.add(state.items.length ? "success" : "subtle");
    }
    renderSummary();
    if (el.list) {
      el.list.innerHTML = state.items.length
        ? state.items.map(renderRegistryCard).join("")
        : `<article class="trigger-card trigger-empty-card"><h3 class="trigger-card-title">No trigger rows returned</h3><p>Runtime/Auth returned an empty registry.</p></article>`;
    }
  }

  function parsePlatforms(formData) {
    return Array.from(formData.getAll("eligible_platforms")).map((value) => String(value));
  }

  function formPayload() {
    const form = el.customForm;
    const data = new FormData(form);
    return {
      enabled: data.get("enabled") === "on",
      prefix: data.get("prefix"),
      trigger: data.get("trigger"),
      aliases: String(data.get("aliases") || "").split(",").map((item) => item.trim()).filter(Boolean),
      response_template: data.get("response_template"),
      eligible_platforms: parsePlatforms(data),
      access: data.get("access"),
      cooldown_seconds: Number(data.get("cooldown_seconds") || 5),
      response_mode: data.get("response_mode"),
      notes: data.get("notes"),
    };
  }

  function previewPayload() {
    const form = el.previewForm;
    const data = new FormData(form);
    return {
      custom_trigger_id: data.get("custom_trigger_id") || undefined,
      platform: data.get("platform") || "rumble",
      message: data.get("message") || "",
      actor: {
        display_name: data.get("display_name") || "Preview Viewer",
        handle: data.get("handle") || "previewviewer",
        is_moderator: data.get("is_moderator") === "on",
        is_subscriber: data.get("is_subscriber") === "on",
        is_follower: data.get("is_follower") === "on",
      },
      stream_context: {
        stream_title: data.get("stream_title") || "",
        creator_display_name: data.get("creator_display_name") || "",
      },
    };
  }

  function resetForm() {
    if (!(el.customForm instanceof HTMLFormElement)) return;
    state.editingId = "";
    el.customForm.reset();
    el.customForm.elements.prefix.value = "!";
    el.customForm.elements.cooldown_seconds.value = "5";
    el.customForm.elements.response_mode.value = "inline_single";
    el.customForm.elements.access.value = "everyone";
    el.customForm.querySelectorAll('input[name="eligible_platforms"]').forEach((input) => {
      input.checked = ["rumble", "youtube", "twitch", "kick"].includes(input.value);
    });
    if (el.customSubmit) el.customSubmit.textContent = "Create custom trigger";
  }

  function editCustomTrigger(id) {
    const item = state.customItems.find((candidate) => String(candidate.id) === String(id));
    if (!item || !(el.customForm instanceof HTMLFormElement)) return;
    state.editingId = String(item.id);
    el.customForm.elements.enabled.checked = Boolean(item.enabled);
    el.customForm.elements.prefix.value = item.prefix || "!";
    el.customForm.elements.trigger.value = item.trigger || "";
    el.customForm.elements.aliases.value = (item.aliases || []).join(", ");
    el.customForm.elements.response_template.value = item.response_template || "";
    el.customForm.elements.cooldown_seconds.value = String(item.cooldown_seconds || 5);
    el.customForm.elements.response_mode.value = item.response_mode || "inline_single";
    el.customForm.elements.access.value = item.access || "everyone";
    el.customForm.elements.notes.value = item.notes || "";
    el.customForm.querySelectorAll('input[name="eligible_platforms"]').forEach((input) => {
      input.checked = (item.eligible_platforms || []).includes(input.value);
    });
    if (el.customSubmit) el.customSubmit.textContent = "Save custom trigger";
    el.customForm.scrollIntoView({ block: "nearest" });
  }

  function renderCustomTriggers() {
    const cap = state.customCap || {};
    if (el.customCap) {
      const remaining = Number(cap.remaining || 0);
      el.customCap.textContent = `${cap.current_count || 0}/${cap.limit || 0} used - ${remaining} remaining (${cap.tier || "tier"} cap)`;
    }
    if (el.customStatus) {
      el.customStatus.textContent = "Custom triggers: creator-owned runtime config";
      el.customStatus.classList.remove("warning", "subtle");
      el.customStatus.classList.add("success");
    }
    if (el.customSubmit) {
      const capReached = !state.editingId && Number(cap.remaining || 0) <= 0;
      el.customSubmit.disabled = capReached;
      el.customSubmit.textContent = capReached ? "Tier cap reached" : state.editingId ? "Save custom trigger" : "Create custom trigger";
    }
    if (el.customEmpty) {
      el.customEmpty.hidden = state.customItems.length > 0;
    }
    if (!el.customList) return;
    renderPreviewTriggerOptions();
    el.customList.innerHTML = state.customItems.length
      ? state.customItems.map((item) => `
        <article class="trigger-card" data-custom-trigger-card="${escapeHtml(item.id)}">
          <div class="trigger-card-header">
            <div>
              <h3 class="trigger-card-title">${escapeHtml(item.command_text || `${item.prefix || "!"}${item.trigger || ""}`)}</h3>
              <p>${escapeHtml(item.response_template || "Configured for future dispatch.")}</p>
              <p class="trigger-card-aliases">Aliases: ${escapeHtml((item.aliases || []).join(", ") || "none")}</p>
            </div>
            <div class="trigger-card-meta">
              <span class="status-pill ${item.enabled ? "success" : "warning"}">${escapeHtml(item.enabled ? "Enabled config" : "Disabled config")}</span>
              <span class="status-pill subtle">Management layer ready</span>
            </div>
          </div>
          <div class="trigger-card-body">
            <div class="trigger-card-section">
              <span class="trigger-section-label">Platforms</span>
              <div class="trigger-platform-grid">
                ${(item.eligible_platforms || []).map((platform) => `<span class="status-pill ${platform === "pilled" ? "warning" : "subtle"}">${escapeHtml(humanizePlatform(platform))}${platform === "pilled" ? " planned/disabled" : ""}</span>`).join("")}
              </div>
            </div>
            <div class="trigger-card-section">
              <span class="trigger-section-label">Response / cooldown</span>
              <p>${escapeHtml(item.response_mode || "inline_single")} - ${escapeHtml(item.cooldown_seconds || 5)}s user cooldown</p>
            </div>
            <div class="trigger-card-section">
              <span class="trigger-section-label">Authority</span>
              <p>Creator-owned runtime config. Configured for future dispatch; execution/transport is a later phase.</p>
            </div>
          </div>
          <div class="platform-actions">
            <button class="creator-button secondary" type="button" data-custom-trigger-edit="${escapeHtml(item.id)}">Edit</button>
            <button class="creator-button secondary" type="button" data-custom-trigger-toggle="${escapeHtml(item.id)}" data-next-enabled="${item.enabled ? "false" : "true"}">${item.enabled ? "Disable" : "Enable"}</button>
            <button class="creator-button secondary" type="button" data-custom-trigger-delete="${escapeHtml(item.id)}">Delete</button>
          </div>
        </article>
      `).join("")
      : "";
  }

  function renderPreviewTriggerOptions() {
    if (!(el.previewSelect instanceof HTMLSelectElement)) return;
    const current = el.previewSelect.value;
    el.previewSelect.innerHTML = `<option value="">Match simulated message</option>${state.customItems.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.command_text || item.id)}${item.enabled ? "" : " (disabled)"}</option>`).join("")}`;
    if (current && state.customItems.some((item) => String(item.id) === current)) {
      el.previewSelect.value = current;
    }
  }

  function renderPreviewResult(payload) {
    if (!(el.previewResult instanceof HTMLElement)) return;
    if (!payload) {
      el.previewResult.innerHTML = `<div class="trigger-card trigger-empty-card"><h3 class="trigger-card-title">Preview only</h3><p>No live chat post will be sent. Runtime/Auth will return the match and rendered response here.</p></div>`;
      return;
    }
    const pages = Array.isArray(payload.pages) ? payload.pages : [];
    const warnings = Array.isArray(payload.validation_warnings) ? payload.validation_warnings : [];
    const status = payload.would_post ? "Would post" : payload.matched ? "Blocked" : "No matching trigger";
    el.previewResult.innerHTML = `
      <article class="trigger-card">
        <div class="trigger-card-header">
          <div>
            <h3 class="trigger-card-title">Dry run - ${escapeHtml(status)}</h3>
            <p>${escapeHtml(payload.rendered_text || payload.blocked_reason || "No rendered response.")}</p>
          </div>
          <div class="trigger-card-meta">
            <span class="status-pill ${payload.would_post ? "success" : "warning"}">${escapeHtml(payload.would_post ? "Would post" : "No send")}</span>
            <span class="status-pill subtle">posted: ${escapeHtml(String(payload.posted))}</span>
          </div>
        </div>
        <div class="trigger-card-body">
          <div class="trigger-card-section">
            <span class="trigger-section-label">Match</span>
            <p>${escapeHtml(payload.trigger_id || "none")} - ${escapeHtml(payload.match_reason || "no_match")}${payload.matched_alias ? ` - alias ${escapeHtml(payload.matched_alias)}` : ""}</p>
          </div>
          <div class="trigger-card-section">
            <span class="trigger-section-label">Platform</span>
            <p>${escapeHtml(humanizePlatform(payload.platform))} - max ${escapeHtml(payload.platform_max_chars || "-")} chars</p>
          </div>
          <div class="trigger-card-section">
            <span class="trigger-section-label">Warnings</span>
            <p>${escapeHtml(warnings.join(", ") || payload.blocked_reason || "none")}</p>
          </div>
        </div>
        <div class="trigger-card-section">
          <span class="trigger-section-label">Split pages</span>
          ${pages.length ? pages.map((page) => `<p><strong>${escapeHtml(page.page_index)}/${escapeHtml(page.total_pages)}</strong> ${escapeHtml(page.text)}</p>`).join("") : "<p>No pages returned.</p>"}
        </div>
      </article>
    `;
  }

  function renderCustomFailure(message) {
    if (el.customStatus) {
      el.customStatus.textContent = message || "Custom trigger config unavailable";
      el.customStatus.classList.remove("success", "subtle");
      el.customStatus.classList.add("warning");
    }
  }

  async function loadRegistry() {
    const signal = state.abortController?.signal;
    const [summary, triggers, capabilities] = await Promise.all([
      requestJson(REGISTRY_SUMMARY_ENDPOINT, { signal }),
      requestJson(TRIGGERS_ENDPOINT, { signal }),
      requestJson(CAPABILITIES_ENDPOINT, { signal }),
    ]);
    renderRegistry({ summary, triggers, capabilities });
  }

  async function loadCustomTriggers() {
    const payload = await requestJson(CUSTOM_TRIGGERS_ENDPOINT, { signal: state.abortController?.signal });
    state.customItems = Array.isArray(payload.items) ? payload.items : [];
    state.customCap = payload.cap || null;
    renderCustomTriggers();
  }

  async function runPreview() {
    if (!(el.previewForm instanceof HTMLFormElement)) return;
    if (el.previewSubmit) el.previewSubmit.disabled = true;
    try {
      state.previewResult = await requestJson(CUSTOM_TRIGGER_PREVIEW_ENDPOINT, {
        method: "POST",
        body: previewPayload(),
      });
      renderPreviewResult(state.previewResult);
    } catch (err) {
      renderPreviewResult({ posted: false, would_post: false, matched: false, blocked_reason: err?.message || "Preview failed", validation_warnings: ["preview_request_failed"] });
    } finally {
      if (el.previewSubmit) el.previewSubmit.disabled = false;
    }
  }

  async function saveCustomTrigger() {
    if (!(el.customForm instanceof HTMLFormElement)) return;
    const payload = formPayload();
    const id = state.editingId;
    const url = id ? `${CUSTOM_TRIGGERS_ENDPOINT}/${encodeURIComponent(id)}` : CUSTOM_TRIGGERS_ENDPOINT;
    const method = id ? "PATCH" : "POST";
    if (el.customSubmit) el.customSubmit.disabled = true;
    try {
      await requestJson(url, { method, body: payload });
      resetForm();
      await loadCustomTriggers();
    } catch (err) {
      renderCustomFailure(err?.message || "Unable to save custom trigger.");
    } finally {
      renderCustomTriggers();
    }
  }

  async function toggleCustomTrigger(id, enabled) {
    const item = state.customItems.find((candidate) => String(candidate.id) === String(id));
    if (!item) return;
    try {
      await requestJson(`${CUSTOM_TRIGGERS_ENDPOINT}/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: {
          ...item,
          enabled,
          eligible_platforms: item.eligible_platforms || [],
          response_template: item.response_template || "",
        },
      });
      await loadCustomTriggers();
    } catch (err) {
      renderCustomFailure(err?.message || "Unable to update custom trigger.");
    }
  }

  async function deleteCustomTrigger(id) {
    try {
      await requestJson(`${CUSTOM_TRIGGERS_ENDPOINT}/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (state.editingId === id) resetForm();
      await loadCustomTriggers();
    } catch (err) {
      renderCustomFailure(err?.message || "Unable to delete custom trigger.");
    }
  }

  function renderLoadFailure(message) {
    if (el.status) {
      el.status.textContent = "Runtime registry unavailable";
      el.status.classList.remove("success", "subtle");
      el.status.classList.add("warning");
    }
    setStatusPill(el.foundationPill, "Registry unavailable", "warning");
    if (el.foundationSummary) el.foundationSummary.textContent = message || "Runtime/Auth did not return the registry.";
    if (el.list) {
      el.list.innerHTML = `<article class="trigger-card trigger-empty-card"><h3 class="trigger-card-title">Unable to load triggers</h3><p>${escapeHtml(message || "Try again once runtime/Auth is available.")}</p></article>`;
    }
  }

  function bindEvents(root = document) {
    state.abortController = new AbortController();
    const signal = state.abortController.signal;
    root.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      if (target.closest("[data-trigger-reset]")) {
        void Promise.all([loadRegistry(), loadCustomTriggers()]).catch((err) => renderLoadFailure(String(err?.message || err)));
      }
      const editButton = target.closest("[data-custom-trigger-edit]");
      if (editButton) editCustomTrigger(editButton.getAttribute("data-custom-trigger-edit"));
      const toggleButton = target.closest("[data-custom-trigger-toggle]");
      if (toggleButton) void toggleCustomTrigger(toggleButton.getAttribute("data-custom-trigger-toggle"), toggleButton.getAttribute("data-next-enabled") === "true");
      const deleteButton = target.closest("[data-custom-trigger-delete]");
      if (deleteButton) void deleteCustomTrigger(deleteButton.getAttribute("data-custom-trigger-delete"));
      if (target.closest("[data-custom-trigger-cancel]")) resetForm();
    }, { signal });
    if (el.customForm) {
      el.customForm.addEventListener("submit", (event) => {
        event.preventDefault();
        void saveCustomTrigger();
      }, { signal });
    }
    if (el.previewForm) {
      el.previewForm.addEventListener("submit", (event) => {
        event.preventDefault();
        void runPreview();
      }, { signal });
    }
  }

  function init(root = document) {
    if (state.root === root && state.abortController) return;
    if (state.abortController) state.abortController.abort();
    state.root = root;
    cacheElements(root);
    resetForm();
    renderPreviewResult(null);
    bindEvents(root);
    void loadRegistry().catch((err) => renderLoadFailure(String(err?.message || "Unable to load runtime registry.")));
    void loadCustomTriggers().catch((err) => renderCustomFailure(String(err?.message || "Unable to load custom triggers.")));
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
    state.customItems = [];
    state.customCap = null;
    state.previewResult = null;
    state.editingId = "";
  }

  window.TriggersView = { init, destroy };
})();
