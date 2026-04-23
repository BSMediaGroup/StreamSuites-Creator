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

  function humanizeLabel(value) {
    const normalized = String(value || "").trim();
    if (!normalized) return "Unavailable";
    return normalized.replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function humanizeBooleanState(value, truthyLabel, falsyLabel) {
    return value ? truthyLabel : falsyLabel;
  }

  function humanizeRumbleBotBlockingReason(reason) {
    switch (String(reason || "").trim().toLowerCase()) {
      case "creator_disabled":
        return "Auto-deploy is disabled for this creator.";
      case "rumble_not_connected":
        return "No backend-owned Rumble credential is currently connected.";
      case "creator_identity_missing":
        return "Runtime does not yet have enough Rumble identity for this creator.";
      case "live_status_unavailable":
        return "Runtime live status is not currently available.";
      case "creator_offline":
        return "This creator is matched, but runtime is waiting for a real live stream target.";
      case "watch_url_unresolved":
        return "The creator appears live, but the concrete live stream target is not resolved yet.";
      case "attach_identity_unresolved":
        return "The creator appears live, but runtime has not resolved enough stream or chat identity for bot attachment yet.";
      default:
        return "No blocking reason is currently reported.";
    }
  }

  function rumbleDecisionWaitingForLive(decision) {
    return Boolean(decision?.awaiting_live_stream || String(decision?.decision_state || "").trim().toLowerCase() === "awaiting_live_stream");
  }

  function rumbleDecisionLiveTargetPending(decision) {
    return Boolean(decision?.live_target_unresolved || String(decision?.decision_state || "").trim().toLowerCase() === "live_target_unresolved");
  }

  function rumbleDecisionAttachIncomplete(decision) {
    return Boolean(
      decision?.attach_identity_incomplete ||
      String(decision?.decision_state || "").trim().toLowerCase() === "attach_identity_incomplete"
    );
  }

  function humanizeRumbleManagedLifecycle(value) {
    switch (String(value || "").trim().toLowerCase()) {
      case "desired":
        return "Desired";
      case "starting":
        return "Starting";
      case "attaching":
        return "Attaching";
      case "attached":
        return "Attached";
      case "listening":
        return "Listening";
      case "running":
        return "Running";
      case "awaiting_transport":
        return "Awaiting transport";
      case "blocked":
        return "Blocked";
      case "auth_failed":
        return "Auth failed";
      case "target_unresolved":
        return "Target unresolved";
      case "transport_error":
        return "Transport error";
      case "disabled":
        return "Disabled";
      case "stopping":
        return "Stopping";
      case "stopped":
        return "Stopped";
      case "stale":
        return "Stale";
      default:
        return "Not created";
    }
  }

  function humanizeRumbleTransportStatus(value) {
    switch (String(value || "").trim().toLowerCase()) {
      case "awaiting_transport":
        return "Awaiting transport";
      case "starting":
        return "Starting";
      case "attaching":
        return "Attaching";
      case "attached":
        return "Attached";
      case "listening":
        return "Listening";
      case "running":
        return "Running";
      case "suppressed":
        return "Suppressed";
      case "disabled":
        return "Disabled";
      case "blocked":
        return "Blocked";
      case "auth_failed":
        return "Auth failed";
      case "target_unresolved":
        return "Target unresolved";
      case "transport_error":
        return "Transport error";
      case "stopped":
        return "Stopped";
      default:
        return "Not attached";
    }
  }

  function rumbleManagedSession(integration) {
    return integration?.managed_session && typeof integration.managed_session === "object"
      ? integration.managed_session
      : null;
  }

  function rumbleManagedTransportError(session) {
    return session?.last_transport_error && typeof session.last_transport_error === "object"
      ? session.last_transport_error
      : null;
  }

  function rumbleManagedAuthState(session) {
    const transportError = rumbleManagedTransportError(session);
    const code = String(transportError?.code || session?.blocking_reason || "").trim().toLowerCase();
    if (code === "auth_material_insufficient") {
      return {
        label: "Stream key only",
        tone: "warning",
        detail: "Only a stored `stream_key` exists. Rumble chat transport needs cookie-based chat auth, so the runtime is truthfully blocked."
      };
    }
    if (code === "auth_material_missing") {
      return {
        label: "Chat auth missing",
        tone: "warning",
        detail: "No chat-capable Rumble auth material is stored for this creator."
      };
    }
    if (code === "auth_material_invalid") {
      return {
        label: "Chat auth invalid",
        tone: "warning",
        detail: "Stored Rumble cookie auth exists but the runtime rejected it as invalid."
      };
    }
    if (code === "auth_material_unrecognized") {
      return {
        label: "Chat auth unrecognized",
        tone: "warning",
        detail: "Stored Rumble auth material exists, but it is not usable for chat transport."
      };
    }
    if (session?.transport_capabilities?.can_listen) {
      return {
        label: "Chat auth ready",
        tone: "success",
        detail: "Runtime reports chat-capable Rumble auth material for this creator."
      };
    }
    if (!session) {
      return {
        label: "Not evaluated",
        tone: "subtle",
        detail: "No managed Rumble session has been exported for this creator yet."
      };
    }
    return {
      label: "Auth pending",
      tone: "subtle",
      detail: "Managed transport auth posture has not reached a chat-capable state yet."
    };
  }

  function humanizeRumbleManagedBlockingReason(session) {
    const transportError = rumbleManagedTransportError(session);
    const code = String(transportError?.code || session?.blocking_reason || "").trim().toLowerCase();
    switch (code) {
      case "manual_override_active":
        return "A manual Rumble bot session is active, so the managed auto session is suppressed.";
      case "auth_material_insufficient":
        return "The runtime found only a stored `stream_key`. That is enough for ingest metadata but not enough for chat transport attachment.";
      case "auth_material_missing":
        return "The runtime cannot attach chat transport because no cookie-based Rumble chat auth is stored.";
      case "auth_material_invalid":
        return "The stored Rumble chat-auth payload is present but invalid, so the transport cannot attach.";
      case "auth_material_unrecognized":
        return "Stored Rumble auth keys are present but not usable for chat transport attachment.";
      case "target_unresolved":
        return "The creator appears live, but the runtime does not yet have a usable watch/chat target for transport attachment.";
      case "transport_error":
        return transportError?.message || "The managed Rumble transport encountered an attachment or listening error.";
      case "creator_disabled":
        return "Auto-deploy is disabled for this creator, so no managed session should attach.";
      default:
        return transportError?.message || session?.status_reason || "No managed-session blocking reason is currently reported.";
    }
  }

  function rumbleManagedSessionPill(integration, session) {
    const decision = rumbleBotDecision(integration);
    if (!session) {
      if (integration?.bot_auto_deploy_enabled && rumbleDecisionWaitingForLive(decision)) {
        return { label: "Waiting for live stream", tone: "subtle" };
      }
      if (integration?.bot_auto_deploy_enabled && rumbleDecisionLiveTargetPending(decision)) {
        return { label: "Live target pending", tone: "warning" };
      }
      if (integration?.bot_auto_deploy_enabled) {
        return { label: "Session not created yet", tone: "warning" };
      }
      return { label: "Auto-deploy off", tone: "subtle" };
    }
    const transportStatus = String(session.transport_status || "").trim().toLowerCase();
    const lifecycleState = String(session.lifecycle_state || "").trim().toLowerCase();
    if (transportStatus === "listening" || lifecycleState === "listening" || lifecycleState === "running") {
      return { label: "Listening", tone: "success" };
    }
    if (transportStatus === "attached" || lifecycleState === "attached") {
      return { label: "Attached", tone: "success" };
    }
    if (transportStatus === "attaching" || lifecycleState === "attaching") {
      return { label: "Attaching", tone: "warning" };
    }
    if (transportStatus === "transport_error" || lifecycleState === "transport_error") {
      return { label: "Transport error", tone: "warning" };
    }
    if (transportStatus === "target_unresolved" || lifecycleState === "target_unresolved") {
      return { label: "Target unresolved", tone: "warning" };
    }
    if (transportStatus === "auth_failed" || lifecycleState === "auth_failed") {
      return { label: "Auth failed", tone: "warning" };
    }
    if (transportStatus === "blocked" || lifecycleState === "blocked") {
      return { label: "Blocked", tone: "warning" };
    }
    if (transportStatus === "awaiting_transport" || lifecycleState === "awaiting_transport") {
      return { label: "Awaiting transport", tone: "warning" };
    }
    if (transportStatus === "disabled" || lifecycleState === "disabled") {
      return { label: "Disabled", tone: "subtle" };
    }
    return { label: humanizeRumbleManagedLifecycle(session.lifecycle_state), tone: "subtle" };
  }

  function rumbleBotDecision(integration) {
    return integration?.bot_auto_deploy && typeof integration.bot_auto_deploy === "object"
      ? integration.bot_auto_deploy
      : null;
  }

  function rumbleBotDecisionPill(decision) {
    if (!decision) {
      return { label: "Decision unavailable", tone: "warning" };
    }
    if (!decision.enabled) {
      return { label: "Disabled", tone: "subtle" };
    }
    if (rumbleDecisionWaitingForLive(decision)) {
      return { label: "Waiting for live stream", tone: "subtle" };
    }
    if (rumbleDecisionLiveTargetPending(decision)) {
      return { label: "Live target pending", tone: "warning" };
    }
    if (rumbleDecisionAttachIncomplete(decision)) {
      return { label: "Live attach blocked", tone: "warning" };
    }
    if (decision.eligible) {
      return { label: "Attach-ready", tone: "success" };
    }
    if (String(decision.live_status || "").trim().toLowerCase() === "live") {
      return { label: "Live but blocked", tone: "warning" };
    }
    return { label: "Enabled but blocked", tone: "warning" };
  }

  function renderRumbleBotDecision(integration) {
    const decision = rumbleBotDecision(integration);
    const session = rumbleManagedSession(integration);
    const pillEl = query("[data-rumble-bot-decision-pill=\"true\"]");
    const toggleEl = query("[data-rumble-bot-autodeploy-toggle=\"true\"]");
    const summaryEl = query("[data-rumble-bot-decision-summary=\"true\"]");
    const badgesEl = query("[data-rumble-bot-decision-badges=\"true\"]");
    const checksEl = query("[data-rumble-bot-decision-checks=\"true\"]");
    const noteEl = query("[data-rumble-bot-decision-note=\"true\"]");
    const targetEl = query("[data-rumble-bot-decision-target=\"true\"]");

    if (toggleEl instanceof HTMLInputElement) {
      toggleEl.checked = Boolean(integration?.bot_auto_deploy_enabled);
    }
    if (!(pillEl instanceof HTMLElement)) return;

    const decisionPill = rumbleBotDecisionPill(decision);
    setStatusPill(pillEl, decisionPill.label, decisionPill.tone);

    if (summaryEl instanceof HTMLElement) {
      if (!decision) {
        summaryEl.textContent = "Runtime has not exported a Rumble bot auto-deploy decision yet.";
      } else if (!decision.enabled) {
        summaryEl.textContent = "Auto-deploy is off. Runtime will not consider this creator eligible until you enable the setting.";
      } else if (rumbleDecisionWaitingForLive(decision)) {
        summaryEl.textContent = "Auto-deploy is enabled. Runtime is waiting for this creator to produce a real live stream target.";
      } else if (rumbleDecisionLiveTargetPending(decision)) {
        summaryEl.textContent = "Auto-deploy is enabled and the creator appears live, but runtime is still resolving the concrete live target.";
      } else if (rumbleDecisionAttachIncomplete(decision)) {
        summaryEl.textContent = "Auto-deploy is enabled and the creator appears live, but stream identity is still incomplete for transport attachment.";
      } else if (decision.eligible) {
        summaryEl.textContent =
          "Auto-deploy is enabled and runtime currently resolves enough live target identity for the managed Rumble session.";
      } else if (String(decision.live_status || "").trim().toLowerCase() === "live") {
        summaryEl.textContent =
          "Auto-deploy is enabled and the creator appears live, but runtime is still blocking deployment until the missing target identity resolves.";
      } else {
        summaryEl.textContent =
          "Auto-deploy is enabled, but runtime is not currently reporting an eligible Rumble deployment target.";
      }
    }

    if (badgesEl instanceof HTMLElement) {
      const badges = decision
        ? [
            {
              label: humanizeBooleanState(decision.enabled, "Setting enabled", "Setting disabled"),
              tone: decision.enabled ? "success" : "subtle"
            },
            {
              label: humanizeBooleanState(decision.connected, "Rumble connected", "Rumble not connected"),
              tone: decision.connected ? "success" : "warning"
            },
            {
              label:
                rumbleDecisionWaitingForLive(decision)
                  ? "Waiting for live stream"
                  : String(decision.live_status || "").trim().toLowerCase() === "live"
                  ? "Currently live"
                  : String(decision.live_status || "").trim().toLowerCase() === "offline"
                    ? "Currently offline"
                    : "Live state unknown",
              tone:
                rumbleDecisionWaitingForLive(decision)
                  ? "subtle"
                  : String(decision.live_status || "").trim().toLowerCase() === "live"
                    ? "success"
                    : "subtle"
            },
            {
              label: decision.attach_identity_ready
                ? "Attach identity ready"
                : rumbleDecisionWaitingForLive(decision)
                  ? "Awaiting live stream target"
                  : rumbleDecisionLiveTargetPending(decision)
                    ? "Live target not resolved yet"
                    : "Attach identity incomplete",
              tone:
                decision.attach_identity_ready
                  ? "success"
                  : rumbleDecisionWaitingForLive(decision)
                    ? "subtle"
                    : "warning"
            },
            {
              label: session
                ? `Managed session: ${humanizeRumbleManagedLifecycle(session.lifecycle_state)}`
                : rumbleDecisionWaitingForLive(decision)
                  ? "Managed session waits for live"
                  : rumbleDecisionLiveTargetPending(decision)
                    ? "Managed session waiting on target"
                    : "Managed session absent",
              tone:
                session
                  ? "success"
                  : rumbleDecisionWaitingForLive(decision)
                    ? "subtle"
                    : "warning"
            }
          ]
        : [{ label: "Decision unavailable", tone: "warning" }];
      renderPills(badgesEl, badges);
    }

    if (checksEl instanceof HTMLElement) {
      const lines = decision
        ? [
            `Rumble connection: ${humanizeBooleanState(decision.connected, "present", "missing")}`,
            `Creator identity: ${humanizeBooleanState(decision.creator_identifiable, "resolved", "missing")}`,
            `Creator match status: ${decision.creator_match_status || "unknown"}`,
            `Live status: ${decision.live_status || "unknown"}`,
            `Live target: ${decision.resolved_live_target_url || decision.resolved_watch_url || "Not resolved"}`,
            `Watch home: ${decision.resolved_watch_home_url || decision.resolved_channel_url || "Not resolved"}`,
            `Attach identity ready: ${humanizeBooleanState(decision.attach_identity_ready, "yes", "no")}`,
            `Last evaluated: ${formatTimestamp(decision.last_evaluated_at)}`,
            `Last live check: ${formatTimestamp(decision.last_live_status_checked_at)}`
          ]
        : ["No runtime decision payload is available yet."];
      renderList(checksEl, lines);
    }

    if (noteEl instanceof HTMLElement) {
      noteEl.textContent = decision
        ? humanizeRumbleBotBlockingReason(decision.blocking_reason)
        : "The Rumble bot auto-deploy decision is unavailable right now.";
    }

    if (targetEl instanceof HTMLElement) {
      if (!decision) {
        targetEl.innerHTML = "";
        return;
      }
      const bits = [];
      if (decision.resolved_live_target_url || decision.resolved_watch_url) {
        bits.push(
          `Resolved live target: <a href="${escapeHtml(decision.resolved_live_target_url || decision.resolved_watch_url)}" target="_blank" rel="noreferrer">Open live target</a>`
        );
      }
      if (decision.resolved_watch_home_url || decision.resolved_channel_url) {
        bits.push(
          `Watch home: <a href="${escapeHtml(decision.resolved_watch_home_url || decision.resolved_channel_url)}" target="_blank" rel="noreferrer">Open channel</a>`
        );
      }
      if (decision.resolved_channel_handle) {
        bits.push(`Channel handle: ${escapeHtml(decision.resolved_channel_handle)}`);
      }
      if (decision.resolved_video_id) {
        bits.push(`Video id: ${escapeHtml(decision.resolved_video_id)}`);
      }
      if (decision.resolved_chat_id) {
        bits.push(`Chat id: ${escapeHtml(decision.resolved_chat_id)}`);
      }
      targetEl.innerHTML = bits.join("<br />");
    }
  }

  function renderRumbleManagedSession(integration) {
    const session = rumbleManagedSession(integration);
    const decision = rumbleBotDecision(integration);
    const pillEl = query("[data-rumble-managed-session-pill=\"true\"]");
    const badgesEl = query("[data-rumble-managed-session-badges=\"true\"]");
    const summaryEl = query("[data-rumble-managed-session-summary=\"true\"]");
    const alertEl = query("[data-rumble-managed-session-alert=\"true\"]");
    const targetEl = query("[data-rumble-managed-session-target=\"true\"]");
    const timestampsEl = query("[data-rumble-managed-session-timestamps=\"true\"]");
    const authState = rumbleManagedAuthState(session);

    if (pillEl instanceof HTMLElement) {
      const pill = rumbleManagedSessionPill(integration, session);
      setStatusPill(pillEl, pill.label, pill.tone);
    }

    if (badgesEl instanceof HTMLElement) {
      renderPills(badgesEl, [
        {
          label: decision?.connected ? "Integration connected" : "Integration not connected",
          tone: decision?.connected ? "success" : "warning"
        },
        {
          label: integration?.bot_auto_deploy_enabled ? "Auto-deploy enabled" : "Auto-deploy disabled",
          tone: integration?.bot_auto_deploy_enabled ? "success" : "subtle"
        },
        {
          label:
            rumbleDecisionWaitingForLive(decision)
              ? "Waiting for live stream"
              : String(decision?.live_status || "").trim().toLowerCase() === "live"
              ? "Creator live now"
              : String(decision?.live_status || "").trim().toLowerCase() === "offline"
                ? "Creator offline"
                : "Live posture unknown",
          tone:
            rumbleDecisionWaitingForLive(decision)
              ? "subtle"
              : String(decision?.live_status || "").trim().toLowerCase() === "live"
                ? "success"
                : "subtle"
        },
        {
          label: session
            ? `Managed session: ${humanizeRumbleManagedLifecycle(session.lifecycle_state)}`
            : rumbleDecisionWaitingForLive(decision)
              ? "Managed session will appear when live"
              : rumbleDecisionLiveTargetPending(decision)
                ? "Managed session waiting on target"
                : "Managed session missing",
          tone:
            session
              ? "success"
              : rumbleDecisionWaitingForLive(decision)
                ? "subtle"
                : "warning"
        },
        {
          label: session ? `Transport: ${humanizeRumbleTransportStatus(session.transport_status)}` : "Transport not created",
          tone:
            session && ["attached", "listening", "running"].includes(String(session.transport_status || "").trim().toLowerCase())
              ? "success"
              : session
                ? "warning"
                : "subtle"
        },
        {
          label: authState.label,
          tone: authState.tone
        }
      ]);
    }

    if (summaryEl instanceof HTMLElement) {
      if (!session && !integration?.bot_auto_deploy_enabled) {
        summaryEl.textContent = "Managed Rumble session creation is not desired because auto-deploy is disabled.";
      } else if (!session && rumbleDecisionWaitingForLive(decision)) {
        summaryEl.textContent = "Managed session will appear when this creator goes live and a real live target is detected.";
      } else if (!session && rumbleDecisionLiveTargetPending(decision)) {
        summaryEl.textContent = "Creator appears live, but runtime is still resolving the live target before creating the managed session.";
      } else if (!session) {
        summaryEl.textContent = "Runtime has not exported a managed Rumble session for this creator yet.";
      } else {
        summaryEl.textContent = session.status_reason || "Runtime-managed Rumble session state is available.";
      }
    }

    const stats = {
      session: session ? humanizeRumbleManagedLifecycle(session.lifecycle_state) : "Not created",
      transport: session ? humanizeRumbleTransportStatus(session.transport_status) : "Not attached",
      live:
        String(decision?.live_status || "").trim().toLowerCase() === "live"
          ? "Live"
          : String(decision?.live_status || "").trim().toLowerCase() === "offline"
            ? "Offline"
            : "Unknown",
      auth: authState.label
    };
    Object.entries(stats).forEach(([key, value]) => {
      const element = query(`[data-rumble-managed-stat="${key}"]`);
      if (element instanceof HTMLElement) {
        element.textContent = value;
      }
    });

    if (alertEl instanceof HTMLElement) {
      if (!session && rumbleDecisionWaitingForLive(decision)) {
        alertEl.textContent = "Managed session is absent because the creator is currently offline and no live stream target exists yet.";
      } else if (!session && rumbleDecisionLiveTargetPending(decision)) {
        alertEl.textContent = "Managed session is absent because runtime has not resolved the concrete live target yet.";
      } else {
        alertEl.textContent = authState.tone === "warning" ? authState.detail : humanizeRumbleManagedBlockingReason(session);
      }
    }

    if (targetEl instanceof HTMLElement) {
      const target = session?.resolved_target && typeof session.resolved_target === "object"
        ? session.resolved_target
        : {};
      const lines = [];
      if (target.watch_url || decision?.resolved_watch_url) {
        lines.push(`Resolved watch target: ${target.watch_url || decision.resolved_watch_url}`);
      }
      if (target.channel_handle || decision?.resolved_channel_handle) {
        lines.push(`Channel handle: ${target.channel_handle || decision.resolved_channel_handle}`);
      }
      if (target.channel_url || decision?.resolved_channel_url) {
        lines.push(`Channel URL: ${target.channel_url || decision.resolved_channel_url}`);
      }
      if (target.video_id || decision?.resolved_video_id) {
        lines.push(`Video id: ${target.video_id || decision.resolved_video_id}`);
      }
      if (target.chat_id || decision?.resolved_chat_id) {
        lines.push(`Chat id: ${target.chat_id || decision.resolved_chat_id}`);
      }
      if (target.stream_identity || decision?.resolved_stream_identity) {
        lines.push(`Stream identity: ${target.stream_identity || decision.resolved_stream_identity}`);
      }
      renderList(targetEl, lines.length ? lines : ["No resolved managed-session target is currently exported."]);
    }

    if (timestampsEl instanceof HTMLElement) {
      renderList(timestampsEl, [
        `Last evaluated: ${formatTimestamp(session?.last_evaluated_at || decision?.last_evaluated_at)}`,
        `Last attach attempt: ${formatTimestamp(session?.last_attach_attempt_at)}`,
        `Last attach success: ${formatTimestamp(session?.last_attach_success_at)}`,
        `Last transport heartbeat: ${formatTimestamp(session?.last_transport_heartbeat_at)}`,
        `Last session heartbeat: ${formatTimestamp(session?.last_heartbeat_at)}`,
        `Last live check: ${formatTimestamp(decision?.last_live_status_checked_at)}`
      ]);
    }
  }

  function renderRumbleManualSend(integration) {
    const dispatch = integration?.managed_dispatch && typeof integration.managed_dispatch === "object"
      ? integration.managed_dispatch
      : null;
    const summary = dispatch?.summary && typeof dispatch.summary === "object" ? dispatch.summary : {};
    const items = Array.isArray(dispatch?.items) ? dispatch.items : [];
    const pillEl = query("[data-rumble-manual-send-pill=\"true\"]");
    const summaryEl = query("[data-rumble-manual-send-summary=\"true\"]");
    const statusEl = query("[data-rumble-manual-send-status=\"true\"]");
    const historyEl = query("[data-rumble-manual-send-history=\"true\"]");
    const session = rumbleManagedSession(integration);
    const transportReady = ["attached", "listening", "running"].includes(String(session?.transport_status || "").trim().toLowerCase());

    setStatusPill(
      pillEl,
      transportReady ? "Managed send path ready" : "Managed send path blocked",
      transportReady ? "success" : "warning",
    );
    if (summaryEl instanceof HTMLElement) {
      summaryEl.textContent = transportReady
        ? "Creator-controlled manual sends route through the same managed dispatch path used by automatic trigger replies."
        : "Manual send stays blocked until the managed Rumble session is attached and chat-capable.";
    }
    if (statusEl instanceof HTMLElement) {
      if (!session) {
        statusEl.textContent = "No managed Rumble session is currently exported for this creator.";
      } else if (!transportReady) {
        statusEl.textContent = session?.status_reason || session?.blocking_reason || "Managed Rumble send is currently blocked.";
      } else if (summary?.latest_status) {
        statusEl.textContent = `Latest dispatch: ${summary.latest_status} via ${summary.latest_request_source || "runtime"}.`;
      } else {
        statusEl.textContent = "No recent managed dispatch rows are exported for this creator yet.";
      }
    }
    renderList(
      historyEl,
      items.length
        ? items.slice(0, 5).map((item) => {
            const source = String(item?.request_source || "").trim().toLowerCase();
            const label = source === "trigger_runtime"
              ? "Automatic trigger reply"
              : source === "admin_dashboard"
                ? "Manual admin send"
                : "Manual creator send";
            const blocking = item?.error_code ? ` (${item.error_code})` : "";
            return `${label}: ${item?.status || "unknown"} · ${item?.message_preview || "No preview"} · ${item?.requested_at || "Pending"}${blocking}`;
          })
        : ["No recent managed dispatch rows are currently exported."],
    );
  }

  function renderRumbleOptionalSection(renderFn, fallbackMessage) {
    try {
      renderFn();
    } catch (_err) {
      setActionStatus(fallbackMessage, "warning");
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
    queryAll("[data-platform-connect-provider], [data-platform-refresh-detail], [data-platform-remove-workspace], [data-rumble-secret-open=\"true\"], [data-rumble-secret-remove-inline=\"true\"], [data-rumble-bot-autodeploy-toggle=\"true\"]").forEach((button) => {
      if (button instanceof HTMLButtonElement) {
        button.disabled = state.busy;
      }
      if (button instanceof HTMLInputElement) {
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
    const configuredTypes = Array.isArray(integration?.session_material_types)
      ? integration.session_material_types.filter(Boolean)
      : [];
    const validationErrors = Array.isArray(integration?.session_material_validation_errors)
      ? integration.session_material_validation_errors.filter(Boolean)
      : [];
    const badges = [];
    if (integration?.secret_present) {
      badges.push({ label: "Secret stored", tone: "success" });
    } else {
      badges.push({ label: "No stored secret", tone: "warning" });
    }
    if (integration?.session_cookie_material_present) {
      badges.push({ label: "Session material stored", tone: "success" });
    }
    if (integration?.verified_at) {
      badges.push({ label: "Verified", tone: "success" });
    } else if (integration?.last_error) {
      badges.push({ label: "Needs attention", tone: "warning" });
    } else {
      badges.push({ label: "Awaiting verification", tone: "subtle" });
    }
    if (validationErrors.length) {
      badges.push({ label: "Session material needs attention", tone: "warning" });
    }
    if (integration?.secret_mask) {
      badges.push({ label: integration.secret_mask, tone: "subtle" });
    }
    renderPills(badgeEl, badges);
    const summaryBits = [];
    if (integration?.secret_present) {
      summaryBits.push("A backend-owned Rumble secret is stored.");
    } else {
      summaryBits.push("No backend-owned Rumble secret is currently stored for this creator.");
    }
    if (configuredTypes.length) {
      summaryBits.push(`Session material: ${configuredTypes.map(humanizeLabel).join(", ")}.`);
    }
    if (integration?.session_material_updated_at) {
      summaryBits.push(`Updated ${formatTimestamp(integration.session_material_updated_at)}.`);
    }
    if (validationErrors.length) {
      summaryBits.push(`Validation: ${validationErrors.map(humanizeLabel).join(", ")}.`);
    } else if (integration?.session_cookie_material_present) {
      summaryBits.push("Only safe configured posture is shown here after save.");
    }
    summaryEl.textContent = summaryBits.join(" ");
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
    const cookieHeaderInput = query('[data-rumble-input="session_cookie_header"]');
    const cookiesJsonInput = query('[data-rumble-input="session_cookies_json"]');
    if (channelUrl instanceof HTMLInputElement) {
      channelUrl.value = integration?.public_url || "";
    }
    if (channelHandle instanceof HTMLInputElement) {
      channelHandle.value = integration?.channel_handle || "";
    }
    if (secretInput instanceof HTMLInputElement) {
      secretInput.value = "";
    }
    if (cookieHeaderInput instanceof HTMLTextAreaElement) {
      cookieHeaderInput.value = "";
    }
    if (cookiesJsonInput instanceof HTMLTextAreaElement) {
      cookiesJsonInput.value = "";
    }
  }

  function renderIntegration(integration) {
    state.integration = integration;
    const optionalErrors = Array.isArray(integration?.optional_fragment_errors)
      ? integration.optional_fragment_errors.filter((item) => item && typeof item === "object")
      : [];
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
    renderRumbleOptionalSection(
      () => renderRumbleBotDecision(integration),
      "Optional Rumble bot decision detail is temporarily unavailable, but the base integration contract still loaded."
    );
    renderRumbleOptionalSection(
      () => renderRumbleManagedSession(integration),
      "Optional managed-session posture detail is temporarily unavailable, but the base integration contract still loaded."
    );
    renderRumbleOptionalSection(
      () => renderRumbleManualSend(integration),
      "Optional managed-dispatch detail is temporarily unavailable, but the base integration contract still loaded."
    );
    if (optionalErrors.length) {
      setActionStatus(
        optionalErrors
          .map((item) => String(item.message || item.fragment || "Optional fragment unavailable").trim())
          .filter(Boolean)
          .join(" "),
        "warning"
      );
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
    const cookieHeaderInput = query('[data-rumble-input="session_cookie_header"]');
    const cookiesJsonInput = query('[data-rumble-input="session_cookies_json"]');
    const channelUrlInput = query('[data-rumble-input="channel_url"]');
    const channelHandleInput = query('[data-rumble-input="channel_handle"]');
    if (!(secretInput instanceof HTMLInputElement)) return;
    setBusy(true);
    setRumbleStatus("Saving secure backend linkage...", "neutral");
    try {
      const streamKeyValue = secretInput.value.trim();
      const cookieHeaderValue = cookieHeaderInput instanceof HTMLTextAreaElement ? cookieHeaderInput.value.trim() : "";
      const cookiesJsonValue = cookiesJsonInput instanceof HTMLTextAreaElement ? cookiesJsonInput.value.trim() : "";
      const expectedSessionTypes = [];
      const requestBody = {
        channel_url: channelUrlInput instanceof HTMLInputElement ? channelUrlInput.value : "",
        channel_handle: channelHandleInput instanceof HTMLInputElement ? channelHandleInput.value : ""
      };
      if (streamKeyValue) {
        requestBody.stream_key = streamKeyValue;
      }
      if (cookieHeaderValue) {
        requestBody.session_cookie_header = cookieHeaderValue;
        expectedSessionTypes.push("cookie_header");
      }
      if (cookiesJsonValue) {
        requestBody.session_cookies_json = cookiesJsonValue;
        expectedSessionTypes.push("structured_cookie_json");
      }
      const payload = await requestJson(`${API_BASE}/api/creator/integrations/rumble/secret`, {
        method: "POST",
        timeoutMs: SAVE_TIMEOUT_MS,
        body: JSON.stringify(requestBody)
      });
      const integration = payload?.integration || state.integration || {};
      const returnedTypes = Array.isArray(integration?.session_material_types)
        ? integration.session_material_types.map((item) => String(item || "").trim()).filter(Boolean)
        : [];
      const sessionReadbackMatches = expectedSessionTypes.every((type) => returnedTypes.includes(type));
      if (expectedSessionTypes.length && (!integration?.session_cookie_material_present || !sessionReadbackMatches)) {
        renderIntegration(integration);
        throw new Error("Secure linkage write completed, but safe readback did not confirm the submitted Rumble session material.");
      }
      if (!expectedSessionTypes.length && streamKeyValue && !integration?.secret_present) {
        renderIntegration(integration);
        throw new Error("Secure linkage write completed, but safe readback did not confirm stored Rumble material.");
      }
      secretInput.value = "";
      if (cookieHeaderInput instanceof HTMLTextAreaElement) {
        cookieHeaderInput.value = "";
      }
      if (cookiesJsonInput instanceof HTMLTextAreaElement) {
        cookiesJsonInput.value = "";
      }
      renderIntegration(integration);
      closeRumbleDialog();
      setRumbleStatus("Secure linkage saved and confirmed by masked readback.", "success");
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

  async function updateRumbleBotAutoDeploy(enabled) {
    const toggle = query("[data-rumble-bot-autodeploy-toggle=\"true\"]");
    const previousValue = Boolean(state.integration?.bot_auto_deploy_enabled);
    if (!(toggle instanceof HTMLInputElement)) return;
    setBusy(true);
    setRumbleStatus("Saving Rumble bot auto-deploy preference...", "neutral");
    try {
      const payload = await requestJson(`${API_BASE}/api/creator/integrations/rumble/bot-auto-deploy`, {
        method: "POST",
        timeoutMs: SAVE_TIMEOUT_MS,
        body: JSON.stringify({ enabled: Boolean(enabled) })
      });
      renderIntegration(payload?.integration || state.integration);
      setRumbleStatus("Rumble bot auto-deploy preference saved from the runtime authority path.", "success");
    } catch (err) {
      toggle.checked = previousValue;
      setRumbleStatus(err?.message || "Unable to save the Rumble bot auto-deploy preference.", "danger");
    } finally {
      setBusy(false);
    }
  }

  async function submitRumbleManualSend(form) {
    const session = rumbleManagedSession(state.integration);
    setBusy(true);
    setActionStatus("Submitting controlled managed Rumble send...", "neutral");
    try {
      const payload = await requestJson(`${API_BASE}/api/creator/runtime/rumble-dispatch`, {
        method: "POST",
        timeoutMs: SAVE_TIMEOUT_MS,
        body: JSON.stringify({
          session_id: session?.session_id || null,
          message_text: String(form.elements.namedItem("message_text")?.value || "").trim(),
          reason: "creator_manual_send"
        })
      });
      form.reset();
      await loadIntegration();
      setActionStatus(
        `Controlled Rumble send queued with status ${payload?.result?.status || "unknown"}.`,
        "success",
      );
    } catch (err) {
      setActionStatus(err?.message || "Unable to send the controlled Rumble test message.", "danger");
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
      return;
    }
    if (target instanceof HTMLFormElement && target.matches("[data-rumble-manual-send-form=\"true\"]")) {
      event.preventDefault();
      void submitRumbleManualSend(target);
    }
  }

  function handleRootChange(event) {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.matches("[data-rumble-bot-autodeploy-toggle=\"true\"]")) {
      void updateRumbleBotAutoDeploy(target.checked);
    }
  }

  function bindEvents() {
    on(state.root, "click", handleRootClick);
    on(state.root, "submit", handleRootSubmit);
    on(state.root, "change", handleRootChange);
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
