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
  const state = {
    platform: null,
    integration: null,
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
        const error = new Error(payload?.error || `Request failed (${response.status})`);
        error.status = response.status;
        throw error;
      }
      return payload || {};
    });
  }

  function statusTone(status) {
    switch (String(status || "").trim().toLowerCase()) {
      case "linked":
        return "success";
      case "pending":
      case "error":
        return "warning";
      default:
        return "subtle";
    }
  }

  function setStatusPill(element, text, tone) {
    if (!(element instanceof HTMLElement)) return;
    element.classList.remove("success", "subtle", "warning");
    element.classList.add(tone || "subtle");
    const dot = element.querySelector(".status-dot");
    element.textContent = text;
    if (dot) {
      element.prepend(dot);
    }
  }

  function humanizeStatus(status) {
    switch (String(status || "").trim().toLowerCase()) {
      case "linked":
        return "Linked";
      case "pending":
        return "Pending";
      case "error":
        return "Needs attention";
      case "not_configured":
        return "Not configured";
      case "unavailable":
        return "Unavailable";
      default:
        return "Unlinked";
    }
  }

  function humanizeAuthMode(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (!normalized) return "Unavailable";
    return normalized.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function formatTimestamp(value) {
    if (!value) return "Pending";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
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

  function oauthStartUrl(provider) {
    const returnTo = window.location.href;
    if (provider === "twitch") {
      return `${API_BASE}/oauth/twitch/start?surface=creator&mode=link&return_to=${encodeURIComponent(returnTo)}`;
    }
    return `${API_BASE}/auth/${provider}?surface=creator&mode=link&return_to=${encodeURIComponent(returnTo)}`;
  }

  function capabilityLines(integration) {
    const capabilities = integration?.capabilities || {};
    const lines = [];
    lines.push(`Chat read: ${capabilities.chat_read ? "ready" : "not available"}`);
    lines.push(`Chat send: ${capabilities.chat_send ? "ready" : "not available"}`);
    lines.push(`Live status lookup: ${capabilities.live_status_lookup ? "ready" : "not available"}`);
    lines.push(`Metadata lookup: ${capabilities.metadata_lookup ? "ready" : "not available"}`);
    lines.push(`Trigger execution: ${capabilities.trigger_execution_eligible ? "eligible" : "not eligible"}`);
    return lines;
  }

  function renderList(element, items) {
    if (!(element instanceof HTMLElement)) return;
    element.innerHTML = (items || [])
      .map((item) => `<li>${escapeHtml(item)}</li>`)
      .join("");
  }

  function renderActions(integration) {
    const container = document.querySelector("[data-platform-actions=\"true\"]");
    if (!(container instanceof HTMLElement)) return;
    const platform = state.platform;
    if (platform === "rumble") {
      container.innerHTML = `
        <button class="creator-button primary" type="button" data-rumble-secret-open="true">
          ${integration?.secret_present ? "Replace stored secret" : "Add secure Rumble secret"}
        </button>
        ${integration?.secret_present ? '<button class="creator-button ghost" type="button" data-rumble-secret-remove-inline="true">Remove stored secret</button>' : ""}
      `;
      container.querySelector("[data-rumble-secret-open=\"true\"]")?.addEventListener("click", openRumbleDialog);
      container
        .querySelector("[data-rumble-secret-remove-inline=\"true\"]")
        ?.addEventListener("click", () => void removeRumbleSecret());
      return;
    }
    if (platform === "twitch") {
      container.innerHTML = integration?.provider_linked
        ? '<a class="creator-button ghost" href="/account">Manage Twitch auth in Account Settings</a>'
        : '<button class="creator-button ghost" type="button" data-platform-oauth="twitch">Link Twitch OAuth</button>';
      container.querySelector("[data-platform-oauth=\"twitch\"]")?.addEventListener("click", () => {
        window.location.assign(oauthStartUrl("twitch"));
      });
      return;
    }
    container.innerHTML = '<button class="creator-button ghost" type="button" disabled aria-disabled="true">No creator action available yet</button>';
  }

  function renderIntegration(integration) {
    state.integration = integration;
    const pill = document.querySelector("[data-platform-status-pill=\"true\"]");
    setStatusPill(pill, humanizeStatus(integration?.status), statusTone(integration?.status));
    const summary = document.querySelector("[data-platform-summary=\"true\"]");
    if (summary instanceof HTMLElement) {
      summary.textContent = integration?.ui_message || "No authoritative summary is available.";
    }
    renderList(document.querySelector("[data-platform-capabilities=\"true\"]"), capabilityLines(integration));
    const stats = {
      connection: humanizeStatus(integration?.status),
      channel: integration?.channel_handle || integration?.public_url || "Not linked",
      auth: humanizeAuthMode(integration?.auth_mode),
      checked: formatTimestamp(integration?.last_checked_at),
      triggers: `${integration?.deployment?.enabled_trigger_count || 0} enabled`,
      deploy: integration?.deployment?.can_deploy ? "Ready" : "Blocked",
    };
    Object.entries(stats).forEach(([key, value]) => {
      const el = document.querySelector(`[data-platform-stat="${key}"]`);
      if (el instanceof HTMLElement) {
        el.textContent = value;
      }
    });
    const note = document.querySelector("[data-platform-note=\"true\"]");
    if (note instanceof HTMLElement) {
      const fragments = [];
      if (integration?.secret_present) fragments.push("Backend secret stored");
      if (integration?.provider_linked) fragments.push("Provider identity linked");
      if (integration?.public_url) fragments.push(integration.public_url);
      note.textContent = fragments.join(" · ") || integration?.ui_message || "No safe note available.";
    }
    const triggerNote = document.querySelector("[data-platform-trigger-note=\"true\"]");
    if (triggerNote instanceof HTMLElement) {
      triggerNote.textContent = integration?.deployment?.can_deploy
        ? "This platform currently passes the foundation deployability checks."
        : "Deployability stays blocked until the authoritative readiness checks pass.";
    }
    renderList(
      document.querySelector("[data-platform-deploy-reasons=\"true\"]"),
      integration?.deployment?.reasons?.length ? integration.deployment.reasons : ["No blocking reasons reported."],
    );
    renderActions(integration);
  }

  async function loadIntegration() {
    if (!state.platform) return;
    try {
      const payload = await requestJson(`${API_BASE}/api/creator/integrations/${state.platform}`, { method: "GET" });
      renderIntegration(payload?.integration || null);
    } catch (err) {
      setStatusPill(document.querySelector("[data-platform-status-pill=\"true\"]"), "Load failed", "warning");
      const summary = document.querySelector("[data-platform-summary=\"true\"]");
      if (summary instanceof HTMLElement) {
        summary.textContent = err?.message || "Unable to load authoritative platform detail.";
      }
      renderList(document.querySelector("[data-platform-deploy-reasons=\"true\"]"), [
        err?.message || "Unable to load authoritative platform detail.",
      ]);
    }
  }

  function rumbleDialog() {
    return document.querySelector("[data-rumble-secret-dialog=\"true\"]");
  }

  function openRumbleDialog() {
    const dialog = rumbleDialog();
    if (dialog instanceof HTMLDialogElement) {
      dialog.showModal();
    }
  }

  function closeRumbleDialog() {
    const dialog = rumbleDialog();
    if (dialog instanceof HTMLDialogElement && dialog.open) {
      dialog.close();
    }
  }

  function setRumbleStatus(message, tone) {
    const el = document.querySelector("[data-rumble-secret-status=\"true\"]");
    if (!(el instanceof HTMLElement)) return;
    el.textContent = message || "";
    if (tone) {
      el.dataset.tone = tone;
    } else {
      delete el.dataset.tone;
    }
  }

  async function submitRumbleSecret(event) {
    event.preventDefault();
    const secretInput = document.querySelector("[data-rumble-input=\"stream_key\"]");
    const channelUrlInput = document.querySelector("[data-rumble-input=\"channel_url\"]");
    const channelHandleInput = document.querySelector("[data-rumble-input=\"channel_handle\"]");
    if (!(secretInput instanceof HTMLInputElement)) return;
    setRumbleStatus("Saving secure backend linkage...", "neutral");
    try {
      await requestJson(`${API_BASE}/api/creator/integrations/rumble/secret`, {
        method: "POST",
        body: JSON.stringify({
          stream_key: secretInput.value,
          channel_url: channelUrlInput instanceof HTMLInputElement ? channelUrlInput.value : "",
          channel_handle: channelHandleInput instanceof HTMLInputElement ? channelHandleInput.value : "",
        }),
      });
      secretInput.value = "";
      if (channelUrlInput instanceof HTMLInputElement) channelUrlInput.value = "";
      if (channelHandleInput instanceof HTMLInputElement) channelHandleInput.value = "";
      setRumbleStatus("Secure linkage saved. The secret will stay masked from this surface.", "success");
      closeRumbleDialog();
      await loadIntegration();
    } catch (err) {
      setRumbleStatus(err?.message || "Unable to save secure linkage.", "danger");
    }
  }

  async function removeRumbleSecret() {
    setRumbleStatus("Removing stored secret...", "neutral");
    try {
      await requestJson(`${API_BASE}/api/creator/integrations/rumble/secret`, { method: "DELETE" });
      setRumbleStatus("Stored secret removed.", "success");
      closeRumbleDialog();
      await loadIntegration();
    } catch (err) {
      setRumbleStatus(err?.message || "Unable to remove stored secret.", "danger");
    }
  }

  function wireRumbleDialog() {
    const form = document.querySelector("[data-rumble-secret-form=\"true\"]");
    if (form instanceof HTMLFormElement) {
      form.addEventListener("submit", submitRumbleSecret);
    }
    document.querySelector("[data-rumble-dialog-close=\"true\"]")?.addEventListener("click", closeRumbleDialog);
    document.querySelector("[data-rumble-secret-remove=\"true\"]")?.addEventListener("click", () => void removeRumbleSecret());
  }

  function init() {
    const root = document.querySelector("[data-platform-root]");
    if (!(root instanceof HTMLElement)) return;
    state.platform = root.getAttribute("data-platform-root") || null;
    wireRumbleDialog();
    void loadIntegration();
  }

  document.addEventListener("DOMContentLoaded", init, { once: true });
})();
