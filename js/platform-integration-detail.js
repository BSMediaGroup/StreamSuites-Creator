(() => {
  "use strict";

  if (window.PlatformIntegrationDetailView) {
    return;
  }

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
  const DETAIL_TIMEOUT_MS = 6500;
  const SAVE_TIMEOUT_MS = 8000;
  const PLATFORM_META = Object.freeze({
    rumble: {
      title: "Rumble",
      authProvider: "",
      oauthCapable: false,
      planned: false,
      actionableTitle: "Secure credential management",
      actionSummary:
        "Use the secure credential flow to add, replace, or remove the backend-owned Rumble secret path.",
      enables: [
        "Stores a backend-owned credential path without echoing the raw secret back to the creator page.",
        "Keeps channel metadata, readiness, and trigger footing visible on the same page.",
        "Supports safe replacement or removal when the creator rotates platform credentials."
      ],
      limitations: [
        "Saved secret presence is not the same as full runtime live verification.",
        "Deployability still depends on creator posture and enabled foundational triggers."
      ],
      setupChecklist: [
        "Confirm the correct Rumble stream or API credential before saving.",
        "Keep the public channel URL and handle current so runtime-safe metadata stays useful.",
        "Review trigger readiness after saving because secret storage alone is not full deployment."
      ]
    },
    youtube: {
      title: "YouTube",
      authProvider: "google",
      oauthCapable: true,
      planned: false,
      actionableTitle: "Connection workspace",
      actionSummary:
        "Link the identity provider, record the public channel details, and track downstream console setup without faking runtime-ready deployment.",
      enables: [
        "Shows when the linked Google identity can support future YouTube linkage.",
        "Lets creators record channel details and setup posture so the page is a usable workflow now.",
        "Keeps readiness messaging grounded in current runtime/Auth capability."
      ],
      limitations: [
        "Creator-managed YouTube deployment is not complete until downstream provider-console setup is finished.",
        "The runtime still treats YouTube as planned or limited until real backend linkage matures."
      ],
      setupChecklist: [
        "Link the Google account intended for YouTube ownership.",
        "Record the public channel URL or handle used for operations.",
        "Complete any required provider-console setup outside StreamSuites before expecting deployable readiness."
      ]
    },
    twitch: {
      title: "Twitch",
      authProvider: "twitch",
      oauthCapable: true,
      planned: false,
      actionableTitle: "OAuth linkage and workspace",
      actionSummary:
        "Link Twitch OAuth for identity, then use the workspace form to keep channel details and external setup posture current.",
      enables: [
        "Differentiates linked identity from deeper chat or runtime control readiness.",
        "Provides a real place to manage public channel metadata and setup posture.",
        "Keeps trigger readiness visible without pretending chat deployment already exists."
      ],
      limitations: [
        "Twitch OAuth identity linkage is not the same as runtime bot-chat capability.",
        "Full chat deployment still depends on later backend/runtime expansion."
      ],
      setupChecklist: [
        "Link the Twitch identity intended for creator operations.",
        "Confirm the public channel handle and URL used by the creator surface.",
        "Track any external bot or provider-console work separately until backend readiness expands."
      ]
    },
    kick: {
      title: "Kick",
      authProvider: "",
      oauthCapable: false,
      planned: true,
      actionableTitle: "Readiness workspace",
      actionSummary:
        "Kick remains staged, but this page still lets creators keep expected channel details and external setup notes in one truthful workspace.",
      enables: [
        "Replaces the dead placeholder state with a real readiness workspace.",
        "Keeps expected channel metadata and setup posture visible for future onboarding.",
        "Maintains honest planned-state messaging instead of implying live provider support."
      ],
      limitations: [
        "Kick creator self-service linkage is still planned rather than deployed.",
        "Saved workspace details do not mean runtime trigger execution is available yet."
      ],
      setupChecklist: [
        "Record the public channel reference expected to be used later.",
        "Track whether external provider setup has started, stalled, or completed.",
        "Revisit the page once backend Kick support is promoted beyond staged readiness."
      ]
    },
    pilled: {
      title: "Pilled",
      authProvider: "",
      oauthCapable: false,
      planned: true,
      actionableTitle: "Readiness workspace",
      actionSummary:
        "Pilled is still planned, but creators can still keep the target channel footprint and setup notes ready for later onboarding.",
      enables: [
        "Makes the page useful even while provider capability is still planned.",
        "Keeps expected handle, URL, and setup posture saved in authoritative runtime state.",
        "Uses the same readiness language as the rest of the integration workflow."
      ],
      limitations: [
        "Pilled creator self-service linkage is not yet available in the current backend contract.",
        "Saved notes and metadata do not indicate runtime deployability."
      ],
      setupChecklist: [
        "Record the public channel reference expected for future rollout.",
        "Track external setup progress so admin and creator surfaces see the same readiness note.",
        "Treat this page as a readiness workspace until provider support becomes active."
      ]
    }
  });

  const state = {
    root: null,
    platform: "",
    integration: null,
    cleanup: [],
    loadToken: 0,
    busy: false
  };

  function query(selector) {
    return state.root?.querySelector(selector) || null;
  }

  function queryAll(selector) {
    return state.root ? Array.from(state.root.querySelectorAll(selector)) : [];
  }

  function on(target, eventName, handler, options) {
    if (!target?.addEventListener) return;
    target.addEventListener(eventName, handler, options);
    state.cleanup.push(() => target.removeEventListener(eventName, handler, options));
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function requestJson(url, options = {}) {
    const creatorHeaders =
      typeof window.StreamSuitesAuth?.creatorContext?.buildHeaders === "function"
        ? window.StreamSuitesAuth.creatorContext.buildHeaders()
        : {};
    return fetch(url, {
      credentials: "include",
      cache: "no-store",
      timeoutMs: options.timeoutMs || DETAIL_TIMEOUT_MS,
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...creatorHeaders,
        ...(options.headers || {})
      }
    }).then(async (response) => {
      let payload = null;
      try {
        payload = await response.json();
      } catch (_err) {
        payload = null;
      }
      if (!response.ok || payload?.success === false) {
        const error = new Error(payload?.error || payload?.message || `Request failed (${response.status})`);
        error.status = response.status;
        throw error;
      }
      return payload || {};
    });
  }

  function platformMeta() {
    return PLATFORM_META[state.platform] || PLATFORM_META.youtube;
  }

  function humanizeStatus(status) {
    switch (String(status || "").trim().toLowerCase()) {
      case "linked":
        return "Linked";
      case "pending":
        return "In progress";
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

  function humanizeSetupState(value) {
    switch (String(value || "").trim().toLowerCase()) {
      case "in_progress":
        return "External setup in progress";
      case "blocked":
        return "External setup blocked";
      case "completed":
        return "External setup completed";
      default:
        return "External setup not started";
    }
  }

  function formatTimestamp(value) {
    if (!value) return "Pending";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
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

  function deploymentReadinessLabel(integration) {
    const deployment = integration?.deployment || {};
    const status = String(integration?.status || "").trim().toLowerCase();
    if (deployment.can_deploy) return "Ready for deployment";
    if (status === "linked" || integration?.provider_linked || integration?.secret_present) {
      return "Linked but limited";
    }
    if (state.platform === "rumble" && !integration?.secret_present) {
      return "Needs secure credential";
    }
    if (platformMeta().planned || integration?.config_state === "planned") {
      return "Planned or staged";
    }
    return "Needs setup";
  }

  function deploymentReadinessTone(integration) {
    const label = deploymentReadinessLabel(integration);
    if (label === "Ready for deployment") return "success";
    if (label === "Linked but limited" || label === "Needs secure credential" || label === "Needs setup") {
      return "warning";
    }
    return "subtle";
  }

  function setStatusPill(element, text, tone) {
    if (!(element instanceof HTMLElement)) return;
    const dot = element.querySelector(".status-dot");
    element.classList.remove("success", "warning", "subtle");
    element.classList.add(tone || "subtle");
    element.textContent = text;
    if (dot) {
      element.prepend(dot);
    }
  }

  function renderList(element, items) {
    if (!(element instanceof HTMLElement)) return;
    const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];
    element.innerHTML = safeItems.length
      ? safeItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")
      : "<li>No additional detail is currently exported.</li>";
  }

  function renderPills(element, items) {
    if (!(element instanceof HTMLElement)) return;
    const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];
    element.innerHTML = safeItems
      .map((item) => `<span class="status-pill ${escapeHtml(item.tone || "subtle")}">${escapeHtml(item.label)}</span>`)
      .join("");
  }

  function oauthStartUrl(provider) {
    const normalized = String(provider || "").trim().toLowerCase();
    if (!normalized) return "";
    const returnTo = `${window.location.origin}/integrations/${state.platform}`;
    if (normalized === "twitch") {
      return `${API_BASE}/oauth/twitch/start?surface=creator&mode=link&return_to=${encodeURIComponent(returnTo)}`;
    }
    if (normalized === "x") {
      return `${API_BASE}/auth/x/start?surface=creator&mode=link&return_to=${encodeURIComponent(returnTo)}`;
    }
    return `${API_BASE}/auth/${normalized}?surface=creator&mode=link&return_to=${encodeURIComponent(returnTo)}`;
  }

  function setActionStatus(message, tone) {
    const element = query("[data-platform-action-status=\"true\"]");
    if (!(element instanceof HTMLElement)) return;
    element.textContent = message || "";
    if (tone) {
      element.dataset.tone = tone;
    } else {
      delete element.dataset.tone;
    }
  }

  function setRumbleStatus(message, tone) {
    const element = query("[data-rumble-secret-status=\"true\"]");
    if (!(element instanceof HTMLElement)) {
      setActionStatus(message, tone);
      return;
    }
    element.textContent = message || "";
    if (tone) {
      element.dataset.tone = tone;
    } else {
      delete element.dataset.tone;
    }
    setActionStatus(message, tone);
  }

  function setBusy(nextBusy) {
    state.busy = Boolean(nextBusy);
    const forms = queryAll("form");
    forms.forEach((form) => {
      if (!(form instanceof HTMLFormElement)) return;
      Array.from(form.elements).forEach((element) => {
        if (
          element instanceof HTMLButtonElement ||
          element instanceof HTMLInputElement ||
          element instanceof HTMLSelectElement ||
          element instanceof HTMLTextAreaElement
        ) {
          element.disabled = state.busy;
        }
      });
    });
    queryAll("[data-platform-connect-provider], [data-platform-refresh-detail], [data-platform-remove-workspace], [data-rumble-secret-open=\"true\"], [data-rumble-secret-remove-inline=\"true\"]").forEach((button) => {
      if (button instanceof HTMLButtonElement) {
        button.disabled = state.busy;
      }
    });
  }

  function integrationMetadata(integration) {
    return integration?.metadata && typeof integration.metadata === "object" ? integration.metadata : {};
  }

  function hasWorkspaceData(integration) {
    const metadata = integrationMetadata(integration);
    const displayLabel = String(integration?.display_label || "").trim();
    return Boolean(
      String(integration?.channel_handle || "").trim() ||
        String(integration?.public_url || "").trim() ||
        String(metadata.workspace_note || "").trim() ||
        String(metadata.external_setup_state || "").trim() ||
        (displayLabel && displayLabel.toLowerCase() !== platformMeta().title.toLowerCase())
    );
  }

  function workspaceDefaults(integration) {
    const metadata = integrationMetadata(integration);
    return {
      display_label: String(integration?.display_label || platformMeta().title).trim(),
      channel_handle: String(integration?.channel_handle || "").trim(),
      public_url: String(integration?.public_url || "").trim(),
      checks_enabled: integration?.checks_enabled !== false,
      workspace_note: String(metadata.workspace_note || "").trim(),
      external_setup_state: String(metadata.external_setup_state || "not_started").trim().toLowerCase()
    };
  }

  function capabilityLines(integration) {
    const capabilities = integration?.capabilities || {};
    const metadata = integrationMetadata(integration);
    return [
      `Chat read: ${capabilities.chat_read ? "ready" : "not available"}`,
      `Chat send: ${capabilities.chat_send ? "ready" : "not available"}`,
      `Live status lookup: ${capabilities.live_status_lookup ? "ready" : "not available"}`,
      `Metadata lookup: ${capabilities.metadata_lookup ? "ready" : "not available"}`,
      `Trigger execution: ${capabilities.trigger_execution_eligible ? "eligible" : "not eligible"}`,
      `Checks enabled: ${integration?.checks_enabled ? "yes" : "no"}`,
      `External setup: ${humanizeSetupState(metadata.external_setup_state)}`
    ];
  }

  function metadataLines(integration) {
    const metadata = integrationMetadata(integration);
    const linkedAuthProviders = Array.isArray(integration?.linked_auth_providers)
      ? integration.linked_auth_providers
      : [];
    const providerCandidates = Array.isArray(integration?.provider_candidates)
      ? integration.provider_candidates
      : [];
    const lines = [
      `Display label: ${integration?.display_label || platformMeta().title}`,
      `Public channel handle: ${integration?.channel_handle || "Not saved"}`,
      `Public URL: ${integration?.public_url || "Not saved"}`,
      `Connection method: ${integration?.connection_method || "Not exported"}`,
      `Auth mode: ${humanizeAuthMode(integration?.auth_mode)}`,
      `Linked auth providers: ${linkedAuthProviders.length ? linkedAuthProviders.join(", ") : "None"}`,
      `Candidate auth providers: ${providerCandidates.length ? providerCandidates.join(", ") : "None"}`,
      `External setup posture: ${humanizeSetupState(metadata.external_setup_state)}`,
      `Last checked: ${formatTimestamp(integration?.last_checked_at)}`
    ];
    if (metadata.workspace_note) {
      lines.push(`Workspace note: ${metadata.workspace_note}`);
    }
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
    const deployment = integration?.deployment || {};
    if (!deployment.creator_capable) {
      lines.push("Creator account posture is not currently exported as creator-capable.");
    }
    if (!deployment.integration_linked) {
      lines.push("Platform linkage is still missing or only workspace-grade.");
    }
    if (!deployment.trigger_execution_eligible) {
      lines.push("Platform is not yet exported as trigger-capable.");
    }
    if (!deployment.has_enabled_scoped_triggers) {
      lines.push("No enabled foundational trigger currently applies to this platform.");
    }
    return lines.length ? lines : ["No additional missing readiness items are currently reported."];
  }

  function requirementLines(integration) {
    const deploymentReasons = Array.isArray(integration?.deployment?.reasons) ? integration.deployment.reasons : [];
    const lines = [...platformMeta().limitations];
    deploymentReasons.forEach((reason) => {
      if (!lines.includes(reason)) {
        lines.push(reason);
      }
    });
    if (integration?.last_error) {
      lines.push(`Last backend note: ${integration.last_error}`);
    }
    return lines;
  }

  function connectionSummary(integration) {
    const deployment = integration?.deployment || {};
    if (deployment.can_deploy) {
      return "This platform currently passes the exported foundation deployability checks.";
    }
    if (integration?.status === "linked") {
      return "Connection evidence exists, but additional runtime readiness requirements still block deployable use.";
    }
    if (integration?.provider_linked || integration?.secret_present || hasWorkspaceData(integration)) {
      return "Partial setup exists, but this platform is not yet deployable for creator automation.";
    }
    if (platformMeta().planned) {
      return "This platform remains staged, but you can still capture the readiness footprint here.";
    }
    return "No authoritative connection evidence is currently saved for this platform.";
  }

  function capabilityPills(integration) {
    const deployment = integration?.deployment || {};
    const linkedAuthProviders = Array.isArray(integration?.linked_auth_providers)
      ? integration.linked_auth_providers
      : [];
    return [
      { label: deploymentReadinessLabel(integration), tone: deploymentReadinessTone(integration) },
      { label: humanizeAuthMode(integration?.auth_mode), tone: "subtle" },
      {
        label: linkedAuthProviders.length ? `Auth linked: ${linkedAuthProviders.join(", ")}` : "No auth provider linked",
        tone: linkedAuthProviders.length ? "success" : "warning"
      },
      {
        label: deployment?.enabled_trigger_count
          ? `${deployment.enabled_trigger_count} trigger${deployment.enabled_trigger_count === 1 ? "" : "s"} enabled`
          : "No enabled scoped triggers",
        tone: deployment?.enabled_trigger_count ? "success" : "warning"
      }
    ];
  }

  function renderWorkspaceForm(integration) {
    const defaults = workspaceDefaults(integration);
    const setupState = defaults.external_setup_state || "not_started";
    return `
      <form class="platform-workspace-form" data-platform-workspace-form>
        <div class="platform-workspace-grid">
          <label class="account-field">
            <span class="account-field-label">Display label</span>
            <input class="account-field-input" type="text" name="display_label" maxlength="120" value="${escapeHtml(defaults.display_label)}" placeholder="${escapeHtml(platformMeta().title)}" />
          </label>
          <label class="account-field">
            <span class="account-field-label">Channel handle</span>
            <input class="account-field-input" type="text" name="channel_handle" maxlength="160" value="${escapeHtml(defaults.channel_handle)}" placeholder="@yourchannel" />
          </label>
          <label class="account-field platform-workspace-field-wide">
            <span class="account-field-label">Public channel URL</span>
            <input class="account-field-input" type="url" name="public_url" value="${escapeHtml(defaults.public_url)}" placeholder="https://example.com/@yourchannel" />
          </label>
          <label class="account-field">
            <span class="account-field-label">External setup posture</span>
            <select class="account-field-input" name="external_setup_state">
              <option value="not_started"${setupState === "not_started" ? " selected" : ""}>Not started</option>
              <option value="in_progress"${setupState === "in_progress" ? " selected" : ""}>In progress</option>
              <option value="blocked"${setupState === "blocked" ? " selected" : ""}>Blocked</option>
              <option value="completed"${setupState === "completed" ? " selected" : ""}>Completed outside StreamSuites</option>
            </select>
          </label>
          <label class="platform-workspace-toggle">
            <span class="platform-workspace-toggle-copy">Keep runtime checks enabled for this platform</span>
            <span class="switch-button">
              <span class="switch-scale">
                <span class="switch-outer">
                  <input type="checkbox" aria-label="Keep runtime checks enabled for this platform" name="checks_enabled"${defaults.checks_enabled ? " checked" : ""} />
                  <span class="ss-switch-inner">
                    <span class="ss-switch-toggle"></span>
                    <span class="ss-switch-indicator"></span>
                  </span>
                </span>
              </span>
            </span>
          </label>
          <label class="account-field platform-workspace-field-wide">
            <span class="account-field-label">Workspace note</span>
            <textarea class="account-field-input" name="workspace_note" rows="4" maxlength="400" placeholder="Add setup notes, blockers, or provider-console reminders.">${escapeHtml(defaults.workspace_note)}</textarea>
          </label>
        </div>
        <div class="platform-workspace-footer">
          <p class="account-note">
            Saved workspace data is authoritative runtime/Auth metadata for this account only. It does not claim provider deployment success.
          </p>
          <div class="platform-actions">
            <button class="creator-button primary" type="submit">Save workspace</button>
            ${
              hasWorkspaceData(integration)
                ? '<button class="creator-button danger" type="button" data-platform-remove-workspace="true">Clear saved workspace</button>'
                : ""
            }
          </div>
        </div>
      </form>
    `;
  }

  function renderNonRumbleActions(integration) {
    const container = query("[data-platform-actions=\"true\"]");
    const summary = query("[data-platform-action-summary=\"true\"]");
    if (!(container instanceof HTMLElement)) return;
    if (summary instanceof HTMLElement) {
      summary.textContent = platformMeta().actionSummary;
    }

    const authProvider = platformMeta().authProvider;
    const providerLinked = Boolean(integration?.provider_linked);
    const providerCandidates = Array.isArray(integration?.provider_candidates) ? integration.provider_candidates : [];
    const connectPanel = authProvider
      ? `
        <div class="platform-management-block">
          <div class="platform-management-block-head">
            <strong>${escapeHtml(platformMeta().oauthCapable ? "Identity link" : "Provider setup")}</strong>
            <span class="status-pill ${providerLinked ? "success" : "warning"}">
              ${escapeHtml(providerLinked ? "Provider linked" : "Provider not linked")}
            </span>
          </div>
          <p class="account-note">
            ${
              providerLinked
                ? `The ${authProvider} identity link is present. Downstream provider-console or runtime setup may still be required before deployment becomes truthful.`
                : `Start the ${authProvider} link flow here. This only records identity linkage; downstream provider-console setup may still be required outside this task.`
            }
          </p>
          <div class="platform-actions">
            <button class="creator-button ${providerLinked ? "secondary" : "primary"}" type="button" data-platform-connect-provider="${escapeHtml(authProvider)}">
              ${escapeHtml(providerLinked ? `Reconnect ${authProvider}` : `Connect ${authProvider}`)}
            </button>
            <a class="creator-button secondary" href="/account">Manage auth methods</a>
            <a class="creator-button secondary" href="/triggers">Review trigger footing</a>
          </div>
          <div class="platform-inline-note">
            Candidate auth providers: ${escapeHtml(providerCandidates.length ? providerCandidates.join(", ") : "none")}
          </div>
        </div>
      `
      : `
        <div class="platform-management-block">
          <div class="platform-management-block-head">
            <strong>${escapeHtml(platformMeta().planned ? "Planned provider rollout" : "Manual readiness flow")}</strong>
            <span class="status-pill subtle">${escapeHtml(platformMeta().planned ? "Planned" : "Manual")}</span>
          </div>
          <p class="account-note">
            ${
              platformMeta().planned
                ? "This platform is still staged. Use the workspace form below to keep expected channel and setup details current."
                : "Use the workspace form below to record public channel details and setup posture truthfully."
            }
          </p>
          <div class="platform-actions">
            <a class="creator-button secondary" href="/integrations">Back to integrations hub</a>
            <a class="creator-button secondary" href="/triggers">Review trigger footing</a>
          </div>
        </div>
      `;

    const checklistMarkup = `
      <div class="platform-management-block">
        <div class="platform-management-block-head">
          <strong>${escapeHtml(platformMeta().actionableTitle)}</strong>
          <span class="status-pill ${escapeHtml(hasWorkspaceData(integration) ? "success" : "subtle")}">
            ${escapeHtml(hasWorkspaceData(integration) ? "Workspace saved" : "Workspace empty")}
          </span>
        </div>
        <ul class="platform-management-checklist">
          ${platformMeta().setupChecklist.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      </div>
    `;

    container.innerHTML = `${connectPanel}${checklistMarkup}${renderWorkspaceForm(integration)}`;
  }

  function renderRumbleSecretState(integration) {
    const badgeEl = query("[data-rumble-secret-badges=\"true\"]");
    const summaryEl = query("[data-rumble-secret-summary=\"true\"]");
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
    summaryEl.textContent = integration?.secret_present
      ? "A backend-owned Rumble secret is stored. The creator surface only receives masked presence state after submission."
      : "No backend-owned Rumble secret is currently stored for this creator.";
  }

  function renderRumbleActions(integration) {
    const container = query("[data-platform-actions=\"true\"]");
    const summary = query("[data-platform-action-summary=\"true\"]");
    if (!(container instanceof HTMLElement)) return;
    if (summary instanceof HTMLElement) {
      summary.textContent = platformMeta().actionSummary;
    }
    container.innerHTML = `
      <div class="platform-management-block">
        <div class="platform-management-block-head">
          <strong>Secure secret entry</strong>
          <span class="status-pill ${integration?.secret_present ? "success" : "warning"}">
            ${escapeHtml(integration?.secret_present ? "Stored securely" : "Credential missing")}
          </span>
        </div>
        <p class="account-note">
          Save or replace the backend-owned Rumble credential here. Raw secret values are never echoed back to the page after submission.
        </p>
        <div class="platform-actions">
          <button class="creator-button primary" type="button" data-rumble-secret-open="true">
            ${escapeHtml(integration?.secret_present ? "Replace secure credential" : "Add secure credential")}
          </button>
          <a class="creator-button secondary" href="/triggers">Review trigger footing</a>
          ${
            integration?.secret_present
              ? '<button class="creator-button danger" type="button" data-rumble-secret-remove-inline="true">Remove stored secret</button>'
              : ""
          }
        </div>
        <div class="platform-inline-note">
          Privacy note: only masked saved-state information returns to the creator surface after save.
        </div>
      </div>
      <div class="platform-management-block">
        <div class="platform-management-block-head">
          <strong>Readiness checklist</strong>
          <span class="status-pill subtle">Rumble foundation</span>
        </div>
        <ul class="platform-management-checklist">
          ${platformMeta().setupChecklist.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      </div>
    `;
    renderRumbleSecretState(integration);
  }

  function renderActions(integration) {
    if (state.platform === "rumble") {
      renderRumbleActions(integration);
      return;
    }
    renderNonRumbleActions(integration);
  }

  function populateRumbleDialog(integration) {
    const channelUrl = query('[data-rumble-input="channel_url"]');
    const channelHandle = query('[data-rumble-input="channel_handle"]');
    const secretInput = query('[data-rumble-input="stream_key"]');
    if (channelUrl instanceof HTMLInputElement) {
      channelUrl.value = integration?.public_url || "";
    }
    if (channelHandle instanceof HTMLInputElement) {
      channelHandle.value = integration?.channel_handle || "";
    }
    if (secretInput instanceof HTMLInputElement) {
      secretInput.value = "";
    }
  }

  function renderIntegration(integration) {
    state.integration = integration;
    setStatusPill(query("[data-platform-status-pill=\"true\"]"), humanizeStatus(integration?.status), statusTone(integration?.status));
    setStatusPill(query("[data-platform-readiness-pill=\"true\"]"), deploymentReadinessLabel(integration), deploymentReadinessTone(integration));
    setStatusPill(
      query("[data-platform-auth-pill=\"true\"]"),
      integration?.provider_linked || integration?.secret_present ? "Connection evidence present" : "No connection evidence",
      integration?.provider_linked || integration?.secret_present ? "success" : "subtle"
    );
    setStatusPill(
      query("[data-platform-trigger-pill=\"true\"]"),
      integration?.deployment?.has_enabled_scoped_triggers ? "Trigger footing ready" : "Trigger footing missing",
      integration?.deployment?.has_enabled_scoped_triggers ? "success" : "warning"
    );

    const summary = query("[data-platform-summary=\"true\"]");
    if (summary instanceof HTMLElement) {
      summary.textContent = integration?.ui_message || "No authoritative summary is available.";
    }
    const note = query("[data-platform-note=\"true\"]");
    if (note instanceof HTMLElement) {
      const metadata = integrationMetadata(integration);
      const noteBits = [];
      if (integration?.secret_present) noteBits.push("Secure credential stored");
      if (integration?.provider_linked) noteBits.push("Identity provider linked");
      if (metadata.external_setup_state) noteBits.push(humanizeSetupState(metadata.external_setup_state));
      if (integration?.public_url) noteBits.push(integration.public_url);
      note.textContent = noteBits.join(" · ") || integration?.ui_message || "No safe note available.";
    }
    const connectionSummaryEl = query("[data-platform-connection-summary=\"true\"]");
    if (connectionSummaryEl instanceof HTMLElement) {
      connectionSummaryEl.textContent = connectionSummary(integration);
    }
    const triggerNote = query("[data-platform-trigger-note=\"true\"]");
    if (triggerNote instanceof HTMLElement) {
      triggerNote.textContent = integration?.deployment?.can_deploy
        ? "This platform currently passes the foundation deployability checks."
        : "Deployability stays blocked until authoritative creator posture, linkage, and trigger checks pass together.";
    }

    renderPills(query("[data-platform-capability-pills=\"true\"]"), capabilityPills(integration));
    renderList(query("[data-platform-enables=\"true\"]"), platformMeta().enables);
    renderList(query("[data-platform-capabilities=\"true\"]"), capabilityLines(integration));
    renderList(query("[data-platform-metadata=\"true\"]"), metadataLines(integration));
    renderList(query("[data-platform-requirements=\"true\"]"), requirementLines(integration));
    renderList(query("[data-platform-missing=\"true\"]"), missingLines(integration));
    renderList(
      query("[data-platform-deploy-reasons=\"true\"]"),
      Array.isArray(integration?.deployment?.reasons) && integration.deployment.reasons.length
        ? integration.deployment.reasons
        : ["No blocking reasons reported."]
    );

    const stats = {
      connection: humanizeStatus(integration?.status),
      channel: integration?.channel_handle || integration?.public_url || "Not saved",
      auth: humanizeAuthMode(integration?.auth_mode),
      checked: formatTimestamp(integration?.last_checked_at),
      triggers: `${integration?.deployment?.enabled_trigger_count || 0} enabled`,
      deploy: integration?.deployment?.can_deploy ? "Ready" : "Blocked"
    };
    Object.entries(stats).forEach(([key, value]) => {
      const element = query(`[data-platform-stat="${key}"]`);
      if (element instanceof HTMLElement) {
        element.textContent = value;
      }
    });

    renderActions(integration);
    populateRumbleDialog(integration);
    if (state.platform !== "rumble") {
      setActionStatus(
        hasWorkspaceData(integration) ? "Workspace data is currently saved." : "No saved workspace data yet.",
        hasWorkspaceData(integration) ? "success" : "subtle"
      );
      return;
    }
    setRumbleStatus(
      integration?.secret_present
        ? "Secure credential state is stored as masked metadata only."
        : "No secure credential has been submitted yet.",
      integration?.secret_present ? "success" : "warning"
    );
  }

  function renderLoadFailure(message) {
    const safeMessage = message || "Unable to load authoritative platform detail.";
    setStatusPill(query("[data-platform-status-pill=\"true\"]"), "Load failed", "warning");
    setStatusPill(query("[data-platform-readiness-pill=\"true\"]"), "Load failed", "warning");
    setStatusPill(query("[data-platform-auth-pill=\"true\"]"), "Auth unavailable", "warning");
    setStatusPill(query("[data-platform-trigger-pill=\"true\"]"), "Trigger state unavailable", "warning");
    const summary = query("[data-platform-summary=\"true\"]");
    if (summary instanceof HTMLElement) {
      summary.textContent = safeMessage;
    }
    const actions = query("[data-platform-actions=\"true\"]");
    if (actions instanceof HTMLElement) {
      actions.innerHTML = `
        <div class="platform-management-block">
          <div class="platform-management-block-head">
            <strong>Load error</strong>
            <span class="status-pill warning">Retry required</span>
          </div>
          <p class="account-note">${escapeHtml(safeMessage)}</p>
          <div class="platform-actions">
            <button class="creator-button primary" type="button" data-platform-refresh-detail="true">Retry load</button>
            <a class="creator-button secondary" href="/integrations">Back to integrations hub</a>
          </div>
        </div>
      `;
    }
    renderList(query("[data-platform-capabilities=\"true\"]"), [safeMessage]);
    renderList(query("[data-platform-metadata=\"true\"]"), [safeMessage]);
    renderList(query("[data-platform-requirements=\"true\"]"), [safeMessage]);
    renderList(query("[data-platform-missing=\"true\"]"), [safeMessage]);
    renderList(query("[data-platform-deploy-reasons=\"true\"]"), [safeMessage]);
    setActionStatus(safeMessage, "danger");
  }

  async function loadIntegration() {
    if (!state.platform) return;
    const token = ++state.loadToken;
    setBusy(true);
    try {
      const payload = await requestJson(`${API_BASE}/api/creator/integrations/${state.platform}`, {
        method: "GET",
        timeoutMs: DETAIL_TIMEOUT_MS
      });
      if (token !== state.loadToken) return;
      renderIntegration(payload?.integration || null);
    } catch (err) {
      if (token !== state.loadToken) return;
      renderLoadFailure(err?.message || "Unable to load authoritative platform detail.");
    } finally {
      if (token === state.loadToken) {
        setBusy(false);
      }
    }
  }

  function rumbleDialog() {
    return query("[data-rumble-secret-dialog=\"true\"]");
  }

  function openRumbleDialog() {
    const dialog = rumbleDialog();
    if (dialog instanceof HTMLDialogElement && !dialog.open) {
      dialog.showModal();
    }
  }

  function closeRumbleDialog() {
    const dialog = rumbleDialog();
    if (dialog instanceof HTMLDialogElement && dialog.open) {
      dialog.close();
    }
  }

  async function submitWorkspaceForm(form) {
    if (!(form instanceof HTMLFormElement) || !state.platform || state.platform === "rumble") return;
    const formData = new FormData(form);
    const payload = {
      display_label: String(formData.get("display_label") || "").trim(),
      channel_handle: String(formData.get("channel_handle") || "").trim(),
      public_url: String(formData.get("public_url") || "").trim(),
      workspace_note: String(formData.get("workspace_note") || "").trim(),
      external_setup_state: String(formData.get("external_setup_state") || "").trim(),
      checks_enabled: formData.get("checks_enabled") === "on"
    };
    setBusy(true);
    setActionStatus("Saving platform workspace...", "neutral");
    try {
      const payloadResponse = await requestJson(`${API_BASE}/api/creator/integrations/${state.platform}`, {
        method: "POST",
        timeoutMs: SAVE_TIMEOUT_MS,
        body: JSON.stringify(payload)
      });
      renderIntegration(payloadResponse?.integration || state.integration);
      setActionStatus("Workspace saved. Deployment posture remains truthful to backend readiness.", "success");
    } catch (err) {
      setActionStatus(err?.message || "Unable to save platform workspace.", "danger");
    } finally {
      setBusy(false);
    }
  }

  async function removeWorkspace() {
    if (!state.platform || state.platform === "rumble") return;
    setBusy(true);
    setActionStatus("Clearing saved workspace...", "neutral");
    try {
      const payloadResponse = await requestJson(`${API_BASE}/api/creator/integrations/${state.platform}`, {
        method: "DELETE",
        timeoutMs: SAVE_TIMEOUT_MS
      });
      renderIntegration(payloadResponse?.integration || state.integration);
      setActionStatus("Saved workspace cleared.", "success");
    } catch (err) {
      setActionStatus(err?.message || "Unable to clear saved workspace.", "danger");
    } finally {
      setBusy(false);
    }
  }

  async function submitRumbleSecret(form) {
    if (!(form instanceof HTMLFormElement)) return;
    const secretInput = query('[data-rumble-input="stream_key"]');
    const channelUrlInput = query('[data-rumble-input="channel_url"]');
    const channelHandleInput = query('[data-rumble-input="channel_handle"]');
    if (!(secretInput instanceof HTMLInputElement)) return;
    setBusy(true);
    setRumbleStatus("Saving secure backend linkage...", "neutral");
    try {
      const payload = await requestJson(`${API_BASE}/api/creator/integrations/rumble/secret`, {
        method: "POST",
        timeoutMs: SAVE_TIMEOUT_MS,
        body: JSON.stringify({
          stream_key: secretInput.value,
          channel_url: channelUrlInput instanceof HTMLInputElement ? channelUrlInput.value : "",
          channel_handle: channelHandleInput instanceof HTMLInputElement ? channelHandleInput.value : ""
        })
      });
      secretInput.value = "";
      renderIntegration(payload?.integration || state.integration);
      closeRumbleDialog();
      setRumbleStatus("Secure linkage saved. The secret remains masked from this surface.", "success");
    } catch (err) {
      setRumbleStatus(err?.message || "Unable to save secure linkage.", "danger");
    } finally {
      setBusy(false);
    }
  }

  async function removeRumbleSecret() {
    setBusy(true);
    setRumbleStatus("Removing stored secret...", "neutral");
    try {
      const payload = await requestJson(`${API_BASE}/api/creator/integrations/rumble/secret`, {
        method: "DELETE",
        timeoutMs: SAVE_TIMEOUT_MS
      });
      renderIntegration(payload?.integration || state.integration);
      closeRumbleDialog();
      setRumbleStatus("Stored secret removed.", "success");
    } catch (err) {
      setRumbleStatus(err?.message || "Unable to remove stored secret.", "danger");
    } finally {
      setBusy(false);
    }
  }

  function handleRootClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const connectButton = target.closest("[data-platform-connect-provider]");
    if (connectButton instanceof HTMLButtonElement) {
      const provider = connectButton.getAttribute("data-platform-connect-provider") || "";
      const url = oauthStartUrl(provider);
      if (url) {
        window.location.assign(url);
      }
      return;
    }

    const refreshButton = target.closest("[data-platform-refresh-detail]");
    if (refreshButton instanceof HTMLButtonElement) {
      void loadIntegration();
      return;
    }

    const removeWorkspaceButton = target.closest("[data-platform-remove-workspace]");
    if (removeWorkspaceButton instanceof HTMLButtonElement) {
      if (window.confirm(`Clear saved ${platformMeta().title} workspace details?`)) {
        void removeWorkspace();
      }
      return;
    }

    const openRumbleButton = target.closest("[data-rumble-secret-open=\"true\"]");
    if (openRumbleButton instanceof HTMLButtonElement) {
      openRumbleDialog();
      return;
    }

    const closeRumbleButton = target.closest("[data-rumble-dialog-close=\"true\"]");
    if (closeRumbleButton instanceof HTMLButtonElement) {
      closeRumbleDialog();
      return;
    }

    const removeRumbleButton = target.closest("[data-rumble-secret-remove-inline=\"true\"], [data-rumble-secret-remove=\"true\"]");
    if (removeRumbleButton instanceof HTMLButtonElement) {
      if (window.confirm("Remove the stored Rumble secret? This cannot be recovered from the creator surface.")) {
        void removeRumbleSecret();
      }
    }
  }

  function handleRootSubmit(event) {
    const target = event.target;
    if (target instanceof HTMLFormElement && target.matches("[data-platform-workspace-form]")) {
      event.preventDefault();
      void submitWorkspaceForm(target);
      return;
    }
    if (target instanceof HTMLFormElement && target.matches("[data-rumble-secret-form=\"true\"]")) {
      event.preventDefault();
      void submitRumbleSecret(target);
    }
  }

  function bindEvents() {
    on(state.root, "click", handleRootClick);
    on(state.root, "submit", handleRootSubmit);
    const dialog = rumbleDialog();
    if (dialog instanceof HTMLDialogElement) {
      on(dialog, "cancel", (event) => {
        event.preventDefault();
        closeRumbleDialog();
      });
    }
  }

  function destroy() {
    closeRumbleDialog();
    while (state.cleanup.length) {
      const dispose = state.cleanup.pop();
      try {
        dispose?.();
      } catch (_err) {
        // no-op
      }
    }
    state.root = null;
    state.platform = "";
    state.integration = null;
    state.loadToken += 1;
    state.busy = false;
  }

  function init(rootOverride) {
    const nextRoot =
      rootOverride instanceof HTMLElement
        ? rootOverride
        : document.querySelector("[data-platform-root]");
    if (!(nextRoot instanceof HTMLElement)) return;
    if (state.root === nextRoot) return;
    destroy();
    state.root = nextRoot;
    state.platform = String(nextRoot.getAttribute("data-platform-root") || "").trim().toLowerCase();
    if (!state.platform) return;
    bindEvents();
    void loadIntegration();
  }

  window.PlatformIntegrationDetailView = {
    init,
    destroy
  };

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        window.PlatformIntegrationDetailView?.init?.();
      },
      { once: true }
    );
  } else {
    window.PlatformIntegrationDetailView?.init?.();
  }
})();
