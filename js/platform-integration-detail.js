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

  const PLATFORM_COPY = {
    rumble: {
      enables: [
        "Stores a backend-owned Rumble secret path for future runtime use.",
        "Keeps channel metadata and trigger readiness visible from one page.",
        "Lets creators manage secure linkage without exposing saved secret values.",
      ],
      limitations: [
        "Stored secret presence does not mean the runtime has completed full live verification yet.",
        "Trigger-capable deployment only becomes truthful when account posture, platform capability, and enabled foundational triggers all pass.",
      ],
      actionSummary: "Use the secure secret flow to add, replace, or remove the backend-owned Rumble credential path.",
    },
    twitch: {
      enables: [
        "Shows whether Twitch account identity linkage exists through the current OAuth path.",
        "Keeps trigger readiness visible without implying full runtime chat control.",
      ],
      limitations: [
        "OAuth account linkage is not the same as full bot-chat/runtime readiness.",
        "This phase does not claim creator-controlled Twitch bot deployment beyond the current backend truth.",
      ],
      actionSummary: "Link or review Twitch OAuth here, then use the readiness panel to see what deeper runtime capability is still missing.",
    },
    youtube: {
      enables: [
        "Exposes the current planned YouTube posture in a stable, product-quality format.",
        "Keeps future readiness messaging anchored to runtime/Auth instead of placeholder fiction.",
      ],
      limitations: [
        "Creator-managed YouTube linkage is not configured in the current backend contract.",
        "Trigger-capable deployment cannot be implied until real backend linkage exists.",
      ],
      actionSummary: "No creator-side management action exists yet because YouTube linkage is still runtime/Auth-planned.",
    },
    kick: {
      enables: [
        "Keeps Kick visible as a staged integration so creators can understand future readiness posture.",
        "Shows current limitations without collapsing into an empty placeholder panel.",
      ],
      limitations: [
        "Kick onboarding remains staged and is not exposed as a working creator linkage flow yet.",
        "Trigger-capable deployment remains blocked until backend platform plumbing exists.",
      ],
      actionSummary: "Kick remains a planned platform in this phase, so management actions stay intentionally unavailable.",
    },
    pilled: {
      enables: [
        "Keeps Pilled visible inside the same integrations workflow without inventing nonexistent provider support.",
        "Shows current planned-state posture in the same readiness language as active platforms.",
      ],
      limitations: [
        "Pilled onboarding is still planned and not configured for creator self-service.",
        "Trigger-capable deployment remains blocked until backend capability exists.",
      ],
      actionSummary: "Pilled remains planned, so this page acts as a truthful readiness placeholder rather than a live management console.",
    },
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
    return [
      `Chat read: ${capabilities.chat_read ? "ready" : "not available"}`,
      `Chat send: ${capabilities.chat_send ? "ready" : "not available"}`,
      `Live status lookup: ${capabilities.live_status_lookup ? "ready" : "not available"}`,
      `Metadata lookup: ${capabilities.metadata_lookup ? "ready" : "not available"}`,
      `Trigger execution: ${capabilities.trigger_execution_eligible ? "eligible" : "not eligible"}`,
    ];
  }

  function renderList(element, items) {
    if (!(element instanceof HTMLElement)) return;
    element.innerHTML = (items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  }

  function renderPills(element, items) {
    if (!(element instanceof HTMLElement)) return;
    element.innerHTML = (items || [])
      .map((item) => `<span class="status-pill ${escapeHtml(item.tone || "subtle")}">${escapeHtml(item.label)}</span>`)
      .join("");
  }

  function platformCopy() {
    return PLATFORM_COPY[state.platform] || { enables: [], limitations: [], actionSummary: "" };
  }

  function readinessLabel(integration) {
    const deployment = integration?.deployment || {};
    const status = String(integration?.status || "").trim().toLowerCase();
    if (deployment?.can_deploy) return "Ready for trigger-capable bot deployment";
    if (status === "linked" && (deployment?.trigger_execution_eligible || deployment?.chat_capable)) return "Linked but limited";
    if (state.platform === "twitch" && integration?.provider_linked) return "Linked but limited";
    if (state.platform === "rumble" && !integration?.secret_present) return "Requires secure credential entry";
    if (["not_configured", "unavailable", "unlinked"].includes(status) || integration?.config_state === "planned") return "Planned / not configured";
    return "Needs attention";
  }

  function readinessTone(integration) {
    const label = readinessLabel(integration);
    if (label === "Ready for trigger-capable bot deployment") return "success";
    if (label === "Linked but limited" || label === "Requires secure credential entry" || label === "Needs attention") return "warning";
    return "subtle";
  }

  function capabilityPills(integration) {
    const deployment = integration?.deployment || {};
    return [
      { label: readinessLabel(integration), tone: readinessTone(integration) },
      { label: humanizeAuthMode(integration?.auth_mode), tone: "subtle" },
      { label: deployment?.enabled_trigger_count ? `${deployment.enabled_trigger_count} trigger${deployment.enabled_trigger_count === 1 ? "" : "s"} enabled` : "No enabled scoped triggers", tone: deployment?.enabled_trigger_count ? "success" : "warning" },
    ];
  }

  function connectionSummary(integration) {
    const deployment = integration?.deployment || {};
    if (deployment?.can_deploy) {
      return "This platform currently passes the exported foundation deployability checks.";
    }
    if (integration?.status === "linked") {
      return "The provider is linked, but additional backend readiness requirements still block deployment.";
    }
    if (integration?.provider_linked || integration?.secret_present) {
      return "Partial linkage exists, but this platform is not yet operational for deployable triggers.";
    }
    return "This platform is not yet linked for deployable creator automation.";
  }

  function metadataLines(integration) {
    const lines = [
      `Public channel: ${integration?.channel_handle || "Not exported"}`,
      `Public URL: ${integration?.public_url || "Not exported"}`,
      `Connection method: ${integration?.connection_method || "Not exported"}`,
      `Auth mode: ${humanizeAuthMode(integration?.auth_mode)}`,
      `Last checked: ${formatTimestamp(integration?.last_checked_at)}`,
    ];
    if (integration?.verified_at) {
      lines.push(`Verified at: ${formatTimestamp(integration.verified_at)}`);
    }
    if (integration?.secret_mask) {
      lines.push(`Stored secret mask: ${integration.secret_mask}`);
    }
    return lines;
  }

  function missingLines(integration) {
    const lines = [];
    if (!integration?.deployment?.creator_capable) {
      lines.push("Creator account posture is not currently marked creator-capable.");
    }
    if (!integration?.deployment?.integration_linked) {
      lines.push("Platform linkage is still missing.");
    }
    if (!integration?.deployment?.trigger_execution_eligible) {
      lines.push("Platform is not yet exported as trigger-capable.");
    }
    if (!integration?.deployment?.has_enabled_scoped_triggers) {
      lines.push("No enabled foundational trigger currently applies to this platform.");
    }
    return lines.length ? lines : ["No additional missing readiness items are currently reported."];
  }

  function requirementLines(integration) {
    const lines = [...(platformCopy().limitations || [])];
    const deploymentReasons = integration?.deployment?.reasons || [];
    deploymentReasons.forEach((reason) => {
      if (!lines.includes(reason)) {
        lines.push(reason);
      }
    });
    if (integration?.last_error) {
      lines.push(`Last backend note: ${integration.last_error}`);
    }
    return lines.length ? lines : ["No extra limitations are currently reported."];
  }

  function renderActions(integration) {
    const container = document.querySelector("[data-platform-actions=\"true\"]");
    const summary = document.querySelector("[data-platform-action-summary=\"true\"]");
    if (!(container instanceof HTMLElement)) return;
    if (summary instanceof HTMLElement && !summary.textContent.trim()) {
      summary.textContent = platformCopy().actionSummary || "Creator-safe platform actions appear here when the current backend contract supports them.";
    }
    const platform = state.platform;
    if (platform === "rumble") {
      container.innerHTML = `
        <button class="creator-button primary" type="button" data-rumble-secret-open="true">
          ${integration?.secret_present ? "Replace stored secret" : "Add secure Rumble secret"}
        </button>
        <a class="creator-button ghost" href="/triggers">Review scoped triggers</a>
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
        ? `
          <a class="creator-button primary" href="/account">Manage Twitch auth</a>
          <a class="creator-button ghost" href="/triggers">Review triggers</a>
        `
        : `
          <button class="creator-button primary" type="button" data-platform-oauth="twitch">Link Twitch OAuth</button>
          <a class="creator-button ghost" href="/account">Open account settings</a>
        `;
      container.querySelector("[data-platform-oauth=\"twitch\"]")?.addEventListener("click", () => {
        window.location.assign(oauthStartUrl("twitch"));
      });
      return;
    }
    container.innerHTML = `
      <button class="creator-button ghost" type="button" disabled aria-disabled="true">No creator action available yet</button>
      <a class="creator-button ghost" href="/account">Open integration hub</a>
    `;
  }

  function setActionStatus(message, tone) {
    const el = document.querySelector("[data-platform-action-status=\"true\"]");
    if (!(el instanceof HTMLElement)) return;
    el.textContent = message || "";
    if (tone) {
      el.dataset.tone = tone;
    } else {
      delete el.dataset.tone;
    }
  }

  function renderRumbleSecretState(integration) {
    const badgeEl = document.querySelector("[data-rumble-secret-badges=\"true\"]");
    const summaryEl = document.querySelector("[data-rumble-secret-summary=\"true\"]");
    if (!(badgeEl instanceof HTMLElement) || !(summaryEl instanceof HTMLElement)) return;
    const badges = [];
    if (integration?.secret_present) {
      badges.push({ label: "Secret stored", tone: "success" });
    } else {
      badges.push({ label: "No stored secret", tone: "warning" });
    }
    if (integration?.verified_at) {
      badges.push({ label: "Verified", tone: "success" });
    } else if (integration?.last_error) {
      badges.push({ label: "Needs attention", tone: "warning" });
    } else {
      badges.push({ label: "Awaiting verification", tone: "subtle" });
    }
    if (integration?.secret_mask) {
      badges.push({ label: integration.secret_mask, tone: "subtle" });
    }
    renderPills(badgeEl, badges);
    if (integration?.secret_present) {
      summaryEl.textContent = integration?.verified_at
        ? "A backend-owned secret is stored and the latest exported verification timestamp is available."
        : "A backend-owned secret is stored. The creator surface only receives masked presence state, so deeper verification remains backend-owned.";
    } else {
      summaryEl.textContent = "No backend-owned secret is currently stored for this creator.";
    }
  }

  function renderIntegration(integration) {
    state.integration = integration;
    setStatusPill(document.querySelector("[data-platform-status-pill=\"true\"]"), humanizeStatus(integration?.status), statusTone(integration?.status));
    setStatusPill(document.querySelector("[data-platform-readiness-pill=\"true\"]"), readinessLabel(integration), readinessTone(integration));
    setStatusPill(
      document.querySelector("[data-platform-auth-pill=\"true\"]"),
      integration?.provider_linked || integration?.secret_present ? "Connection evidence present" : "No connection evidence",
      integration?.provider_linked || integration?.secret_present ? "success" : "subtle",
    );
    setStatusPill(
      document.querySelector("[data-platform-trigger-pill=\"true\"]"),
      integration?.deployment?.has_enabled_scoped_triggers ? "Foundational triggers enabled" : "No enabled scoped triggers",
      integration?.deployment?.has_enabled_scoped_triggers ? "success" : "warning",
    );

    const summary = document.querySelector("[data-platform-summary=\"true\"]");
    if (summary instanceof HTMLElement) {
      summary.textContent = integration?.ui_message || "No authoritative summary is available.";
    }
    const connectionSummaryEl = document.querySelector("[data-platform-connection-summary=\"true\"]");
    if (connectionSummaryEl instanceof HTMLElement) {
      connectionSummaryEl.textContent = connectionSummary(integration);
    }
    renderPills(document.querySelector("[data-platform-capability-pills=\"true\"]"), capabilityPills(integration));
    renderList(document.querySelector("[data-platform-enables=\"true\"]"), platformCopy().enables || []);
    renderList(document.querySelector("[data-platform-capabilities=\"true\"]"), capabilityLines(integration));
    renderList(document.querySelector("[data-platform-metadata=\"true\"]"), metadataLines(integration));
    renderList(document.querySelector("[data-platform-requirements=\"true\"]"), requirementLines(integration));
    renderList(document.querySelector("[data-platform-missing=\"true\"]"), missingLines(integration));

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
    if (state.platform === "rumble") {
      renderRumbleSecretState(integration);
    }
  }

  function renderLoadFailure(message) {
    setStatusPill(document.querySelector("[data-platform-status-pill=\"true\"]"), "Load failed", "warning");
    setStatusPill(document.querySelector("[data-platform-readiness-pill=\"true\"]"), "Load failed", "warning");
    const summary = document.querySelector("[data-platform-summary=\"true\"]");
    if (summary instanceof HTMLElement) {
      summary.textContent = message || "Unable to load authoritative platform detail.";
    }
    renderList(document.querySelector("[data-platform-deploy-reasons=\"true\"]"), [
      message || "Unable to load authoritative platform detail.",
    ]);
    setActionStatus(message || "Unable to load authoritative platform detail.", "danger");
  }

  async function loadIntegration() {
    if (!state.platform) return;
    try {
      const payload = await requestJson(`${API_BASE}/api/creator/integrations/${state.platform}`, { method: "GET" });
      renderIntegration(payload?.integration || null);
    } catch (err) {
      renderLoadFailure(err?.message || "Unable to load authoritative platform detail.");
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
    setActionStatus(message, tone);
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
      setRumbleStatus("Secure linkage saved. The secret remains masked from this surface.", "success");
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
