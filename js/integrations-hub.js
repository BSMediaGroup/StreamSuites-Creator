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
  const INTEGRATIONS_ENDPOINT = `${API_BASE}/api/creator/integrations`;
  const PROFILE_ENDPOINT = `${API_BASE}/api/public/profile/me`;
  const TRIGGERS_ENDPOINT = `${API_BASE}/api/creator/triggers`;
  const PLATFORM_ORDER = ["rumble", "youtube", "twitch", "kick", "pilled"];
  const PLATFORM_META = {
    rumble: {
      title: "Rumble",
      description: "Secure secret-backed linkage with masked saved-state handling.",
      primaryHref: "/integrations/rumble",
      primaryLabel: "Manage secret",
      secondaryHref: "/triggers",
      secondaryLabel: "Review triggers",
    },
    youtube: {
      title: "YouTube",
      description: "Google-linked readiness and downstream setup planning without fake live claims.",
      primaryHref: "/integrations/youtube",
      primaryLabel: "Open setup",
      secondaryHref: "/account",
      secondaryLabel: "Manage auth",
    },
    twitch: {
      title: "Twitch",
      description: "OAuth-linked identity posture separated cleanly from runtime chat capability.",
      primaryHref: "/integrations/twitch",
      primaryLabel: "Open setup",
      secondaryHref: "/account",
      secondaryLabel: "Manage auth",
    },
    kick: {
      title: "Kick",
      description: "Planned workspace with saved readiness details and truthful rollout messaging.",
      primaryHref: "/integrations/kick",
      primaryLabel: "Open planning view",
      secondaryHref: "/triggers",
      secondaryLabel: "Review triggers",
    },
    pilled: {
      title: "Pilled",
      description: "Planned ingest-facing workspace with readiness notes and no fake connection state.",
      primaryHref: "/integrations/pilled",
      primaryLabel: "Open planning view",
      secondaryHref: "/triggers",
      secondaryLabel: "Review triggers",
    },
  };

  const state = {
    initialized: false,
    integrations: [],
    profile: null,
    triggers: [],
  };

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  async function requestJson(url, options = {}) {
    const response = await fetch(url, {
      credentials: "include",
      ...options,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
    let payload = null;
    try {
      payload = await response.json();
    } catch (_err) {
      payload = null;
    }
    if (!response.ok) {
      const error = new Error(payload?.error || payload?.message || `Request failed (${response.status})`);
      error.status = response.status;
      throw error;
    }
    return payload || {};
  }

  function setStatusPill(element, text, tone) {
    if (!(element instanceof HTMLElement)) return;
    element.classList.remove("success", "subtle", "warning");
    element.classList.add(tone || "subtle");
    const dot = element.querySelector(".status-dot");
    element.textContent = text || "";
    if (dot) element.prepend(dot);
  }

  function humanizeStatus(status) {
    switch (String(status || "").trim().toLowerCase()) {
      case "linked":
        return "Linked";
      case "pending":
        return "Pending";
      case "not_configured":
        return "Not configured";
      case "unavailable":
        return "Unavailable";
      default:
        return "Unlinked";
    }
  }

  function readinessTone(item) {
    if (item?.deployment?.can_deploy) return "success";
    if (item?.provider_linked || item?.secret_present || item?.status === "linked" || item?.status === "pending") return "warning";
    return "subtle";
  }

  function readinessLabel(item) {
    if (item?.deployment?.can_deploy) return "Deployable";
    if (item?.status === "linked") return "Linked but limited";
    if (item?.status === "pending") return "Setup in progress";
    if (item?.config_state === "planned") return "Planned";
    return humanizeStatus(item?.status);
  }

  function listHtml(items, emptyMessage) {
    const rows = (items || []).filter(Boolean);
    if (!rows.length) {
      return `<li>${escapeHtml(emptyMessage)}</li>`;
    }
    return rows.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  }

  function renderPlatformGrid() {
    const container = document.querySelector("[data-hub-platform-grid=\"true\"]");
    if (!(container instanceof HTMLElement)) return;
    const integrationsByKey = new Map((state.integrations || []).map((item) => [item.platform_key, item]));
    container.innerHTML = PLATFORM_ORDER.map((platformKey) => {
      const item = integrationsByKey.get(platformKey) || { platform_key: platformKey, deployment: {} };
      const meta = PLATFORM_META[platformKey] || { title: platformKey, description: "", primaryHref: `/integrations/${platformKey}`, primaryLabel: "Open" };
      const deployment = item.deployment || {};
      const reasonLines = Array.isArray(deployment.reasons) && deployment.reasons.length
        ? deployment.reasons.slice(0, 3)
        : [item.ui_message || meta.description || "No additional readiness detail exported."];
      const workspaceNote = item.metadata && typeof item.metadata === "object" ? item.metadata.workspace_note : "";
      const authEvidence = item.secret_present
        ? "Secure credential stored"
        : item.linked_auth_providers?.length
        ? `Auth linked: ${item.linked_auth_providers.join(", ")}`
        : item.provider_linked
        ? "Provider linked"
        : "No connection evidence yet";
      return `
        <article class="creator-platform-readiness-card tone-${escapeHtml(readinessTone(item))}">
          <div class="creator-platform-readiness-head">
            <div>
              <span class="section-kicker">${escapeHtml(meta.title)}</span>
              <h4>${escapeHtml(readinessLabel(item))}</h4>
            </div>
            <span class="status-pill ${escapeHtml(readinessTone(item))}">${escapeHtml(humanizeStatus(item.status))}</span>
          </div>
          <p class="creator-platform-readiness-copy">${escapeHtml(item.ui_message || meta.description)}</p>
          <div class="creator-platform-readiness-metrics">
            <div>
              <span class="stat-label">Auth evidence</span>
              <span class="stat-value">${escapeHtml(authEvidence)}</span>
            </div>
            <div>
              <span class="stat-label">Triggers</span>
              <span class="stat-value">${escapeHtml(`${deployment.enabled_trigger_count || 0} enabled`)}</span>
            </div>
            <div>
              <span class="stat-label">Deploy</span>
              <span class="stat-value">${escapeHtml(deployment.can_deploy ? "Ready" : "Blocked")}</span>
            </div>
          </div>
          <ul class="creator-platform-readiness-list">
            ${listHtml(reasonLines, "No readiness reasons exported yet.")}
          </ul>
          <p class="account-note">${escapeHtml(workspaceNote || "No saved workspace note yet.")}</p>
          <div class="platform-actions">
            <a class="creator-button primary" href="${escapeHtml(meta.primaryHref)}">${escapeHtml(meta.primaryLabel)}</a>
            <a class="creator-button ghost" href="${escapeHtml(meta.secondaryHref)}">${escapeHtml(meta.secondaryLabel)}</a>
          </div>
        </article>
      `;
    }).join("");
  }

  function renderSummary() {
    const integrations = Array.isArray(state.integrations) ? state.integrations : [];
    const triggers = Array.isArray(state.triggers) ? state.triggers : [];
    const linked = integrations.filter((item) => item?.status === "linked");
    const deployable = integrations.filter((item) => item?.deployment?.can_deploy);
    const partial = integrations.filter((item) => (item?.provider_linked || item?.secret_present || item?.status === "pending") && item?.status !== "linked");
    const creatorCapable = state.profile?.creator_capable === true;
    const enabledTriggers = triggers.filter((item) => item?.enabled);
    const triggerCapableRelationships = enabledTriggers.filter((trigger) =>
      Object.values(trigger?.platform_applicability || {}).some((detail) => detail?.trigger_execution_eligible)
    );

    const heroSummary = document.querySelector("[data-hub-hero-summary=\"true\"]");
    if (heroSummary instanceof HTMLElement) {
      heroSummary.textContent = creatorCapable
        ? `Runtime/Auth marks this account creator-capable. ${linked.length} platform link${linked.length === 1 ? "" : "s"} and ${deployable.length} deployable path${deployable.length === 1 ? "" : "s"} are currently exported.`
        : "Runtime/Auth currently blocks full creator readiness on this account, so platform rollout remains limited until posture changes.";
    }

    const postureKpi = document.querySelector("[data-hub-kpi=\"posture\"]");
    if (postureKpi instanceof HTMLElement) postureKpi.textContent = creatorCapable ? "Creator-capable" : "Blocked";
    const linkedKpi = document.querySelector("[data-hub-kpi=\"linked\"]");
    if (linkedKpi instanceof HTMLElement) linkedKpi.textContent = String(linked.length);
    const deployableKpi = document.querySelector("[data-hub-kpi=\"deployable\"]");
    if (deployableKpi instanceof HTMLElement) deployableKpi.textContent = String(deployable.length);
    const triggerKpi = document.querySelector("[data-hub-kpi=\"triggers\"]");
    if (triggerKpi instanceof HTMLElement) triggerKpi.textContent = `${enabledTriggers.length}/${triggers.length}`;

    setStatusPill(
      document.querySelector("[data-hub-page-status=\"true\"]"),
      deployable.length ? "Deployable path available" : partial.length || linked.length ? "Needs readiness work" : "Awaiting first connection",
      deployable.length ? "success" : partial.length || linked.length ? "warning" : "subtle"
    );
    setStatusPill(
      document.querySelector("[data-hub-readiness-pill=\"true\"]"),
      deployable.length ? "Ready path found" : creatorCapable ? "Needs setup" : "Posture blocked",
      deployable.length ? "success" : creatorCapable ? "warning" : "warning"
    );
    const readinessSummary = document.querySelector("[data-hub-readiness-summary=\"true\"]");
    if (readinessSummary instanceof HTMLElement) {
      readinessSummary.textContent = deployable.length
        ? "At least one platform currently clears the exported deployability checks."
        : linked.length
        ? "Some platforms are linked, but exported readiness still blocks deployment."
        : "No platform is fully linked yet. Start from a platform page or the Rumble secure setup flow.";
    }
    const readinessList = document.querySelector("[data-hub-readiness-list=\"true\"]");
    if (readinessList instanceof HTMLElement) {
      readinessList.innerHTML = listHtml([
        creatorCapable ? "Creator posture is eligible for integrations." : "Creator posture is not currently eligible for integrations.",
        linked.length ? `${linked.length} supported platform link${linked.length === 1 ? "" : "s"} is already saved.` : "No supported platform link is saved yet.",
        triggerCapableRelationships.length
          ? `${triggerCapableRelationships.length} enabled trigger relationship${triggerCapableRelationships.length === 1 ? "" : "s"} is already trigger-capable.`
          : "No enabled trigger is currently paired with a trigger-capable platform.",
        deployable.length ? "A bot deployment path is truthfully available." : "No platform is currently deployable from the exported model.",
      ], "No readiness details are available.");
    }

    const nextItems = [];
    if (!linked.length) {
      nextItems.push(`<a href="/integrations/rumble">Open Rumble secure setup</a><span>Store the first supported credential path and establish a truthful platform link.</span>`);
    }
    if (linked.length && !deployable.length) {
      nextItems.push(`<a href="/triggers">Review trigger foundations</a><span>Clear the trigger and capability blockers that still prevent deployment.</span>`);
    }
    if (deployable.length) {
      nextItems.push(`<a href="/integrations/discord">Open Discord bot</a><span>Continue from platform readiness into deploy-adjacent bot setup.</span>`);
    }
    nextItems.push(`<a href="/account">Open account settings</a><span>Manage public profile posture, uploads, and linked auth providers.</span>`);
    setStatusPill(
      document.querySelector("[data-hub-next-pill=\"true\"]"),
      nextItems.length ? "Actionable" : "Monitoring",
      nextItems.length ? "success" : "subtle"
    );
    const nextSummary = document.querySelector("[data-hub-next-summary=\"true\"]");
    if (nextSummary instanceof HTMLElement) {
      nextSummary.textContent = deployable.length
        ? "The next step is bot-side rollout work."
        : linked.length
        ? "Clear the exported blockers on linked platforms."
        : "Start with the first truthful platform connection.";
    }
    const nextActions = document.querySelector("[data-hub-next-actions=\"true\"]");
    if (nextActions instanceof HTMLElement) {
      nextActions.innerHTML = nextItems.map((item) => `<li>${item}</li>`).join("");
    }

    setStatusPill(
      document.querySelector("[data-hub-trigger-pill=\"true\"]"),
      enabledTriggers.length ? "Foundation loaded" : "Foundation missing",
      enabledTriggers.length ? "success" : "warning"
    );
    const triggerSummary = document.querySelector("[data-hub-trigger-summary=\"true\"]");
    if (triggerSummary instanceof HTMLElement) {
      triggerSummary.textContent = enabledTriggers.length
        ? `${enabledTriggers.length} enabled foundational trigger${enabledTriggers.length === 1 ? "" : "s"} is exported for this account.`
        : "No enabled foundational trigger is currently exported for this account.";
    }
    const triggerList = document.querySelector("[data-hub-trigger-list=\"true\"]");
    if (triggerList instanceof HTMLElement) {
      triggerList.innerHTML = listHtml([
        triggers.length ? `${triggers.length} trigger registry row${triggers.length === 1 ? "" : "s"} is loaded.` : "No trigger rows are exported.",
        enabledTriggers.length ? `${enabledTriggers.length} trigger${enabledTriggers.length === 1 ? "" : "s"} is enabled.` : "No trigger is currently enabled.",
        triggerCapableRelationships.length
          ? `${triggerCapableRelationships.length} enabled trigger relationship${triggerCapableRelationships.length === 1 ? "" : "s"} is already trigger-capable.`
          : "Enabled triggers exist, but no linked platform is trigger-capable yet.",
      ], "No trigger foundation details are available.");
    }
  }

  function renderError(message) {
    setStatusPill(document.querySelector("[data-hub-page-status=\"true\"]"), "Load failed", "warning");
    const heroSummary = document.querySelector("[data-hub-hero-summary=\"true\"]");
    if (heroSummary instanceof HTMLElement) {
      heroSummary.textContent = message || "Unable to load authoritative creator integrations.";
    }
    const platformGrid = document.querySelector("[data-hub-platform-grid=\"true\"]");
    if (platformGrid instanceof HTMLElement) {
      platformGrid.innerHTML = `
        <article class="creator-platform-readiness-card tone-warning">
          <div class="creator-platform-readiness-head">
            <div>
              <span class="section-kicker">Load error</span>
              <h4>Unable to load integrations hub</h4>
            </div>
            <span class="status-pill warning">Retry</span>
          </div>
          <p class="creator-platform-readiness-copy">${escapeHtml(message || "Unable to load authoritative creator integrations.")}</p>
          <div class="platform-actions">
            <a class="creator-button primary" href="/account">Open account settings</a>
            <a class="creator-button ghost" href="/overview">Return to overview</a>
          </div>
        </article>
      `;
    }
  }

  async function loadHub() {
    const [profileResult, integrationsResult, triggersResult] = await Promise.all([
      requestJson(PROFILE_ENDPOINT, { method: "GET" }),
      requestJson(INTEGRATIONS_ENDPOINT, { method: "GET" }),
      requestJson(TRIGGERS_ENDPOINT, { method: "GET" }),
    ]);
    state.profile = profileResult?.profile || profileResult || null;
    state.integrations = Array.isArray(integrationsResult?.items) ? integrationsResult.items : [];
    state.triggers = Array.isArray(triggersResult?.items) ? triggersResult.items : [];
    renderSummary();
    renderPlatformGrid();
  }

  async function init() {
    const root = document.querySelector("[data-integrations-hub-root=\"true\"]");
    if (!(root instanceof HTMLElement)) return;
    state.initialized = true;
    try {
      await loadHub();
    } catch (err) {
      renderError(err?.message || "Unable to load authoritative creator integrations.");
    }
  }

  function destroy() {
    state.initialized = false;
    state.integrations = [];
    state.profile = null;
    state.triggers = [];
  }

  window.IntegrationsHubView = {
    init,
    destroy,
  };
})();
