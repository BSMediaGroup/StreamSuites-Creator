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
  const WHEELS_ENDPOINT = `${API_BASE}/api/creator/wheels`;
  const WHEELS_IMPORT_ENDPOINT = `${API_BASE}/api/creator/wheels/import`;
  const WHEELS_EVENTS_ENDPOINT = `${API_BASE}/api/creator/wheels/events`;
  const WHEEL_ACCOUNT_LOOKUP_ENDPOINT = `${API_BASE}/api/creator/wheels/account-lookup`;
  const DEFAULT_PUBLIC_BASE = "https://streamsuites.app";
  const DEFAULT_COLORS = ["#ff6b6b", "#ffd166", "#06d6a0", "#118ab2", "#9b5de5", "#f15bb5"];
  const WHEEL_SOUND_BASE = "/assets/sounds/wheels";
  const SLICE_LABEL_MODES = [
    { value: "full_name", label: "Full name" },
    { value: "initials", label: "Initials" },
    { value: "avatar", label: "Avatar" }
  ];
  const DISPLAY_MODE_OPTIONS = [
    { value: "wheel", label: "Wheel" },
    { value: "scoreboard", label: "List view" }
  ];
  const SOUND_CATEGORY_LABELS = Object.freeze({
    music: "Music",
    startspin: "Start spin",
    respin: "Respin",
    click: "Click",
    winner: "Winner"
  });
  const SOUND_LIBRARY = Object.freeze({
    music: ["music0.mp3", "music1.mp3", "music2.mp3", "music3.mp3", "music4.mp3", "music5.mp3", "music6.mp3"],
    startspin: ["startspin0.mp3", "startspin1.mp3", "startspin2.mp3"],
    respin: ["respin0.mp3", "respin1.mp3"],
    click: ["click0.mp3", "click1.mp3", "click2.mp3", "click3.mp3", "click4.mp3", "click5.mp3", "click6.mp3"],
    winner: ["winner0.mp3", "winner1.mp3", "winner2.mp3", "winner3.mp3", "winner4.mp3", "winner5.mp3", "winner6.mp3"]
  });
  const DEFAULT_ASSIGNMENT_BADGE = "/assets/icons/ui/wheeluser.svg";
  const LOOKUP_DEBOUNCE_MS = 240;

  let wheelEvents = null;
  let wheelRefreshPromise = null;
  let wheelRefreshQueued = false;

  const state = {
    root: null,
    loading: false,
    saving: false,
    importing: false,
    exporting: false,
    items: [],
    selectedCode: "",
    draft: null,
    baseline: "",
    status: "",
    error: "",
    importText: "",
    importFile: null,
    lookupState: Object.create(null),
    lookupDebounce: new Map(),
    lookupAborters: new Map(),
    previewAudio: null,
    previewCategory: ""
  };

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createSoundCategory(category) {
    const assetIds = SOUND_LIBRARY[category] || [];
    return {
      enabled: true,
      asset_id: assetIds[0] || ""
    };
  }

  function buildWheelSoundUrl(category, assetId) {
    if (!category || !assetId) return "";
    return `${WHEEL_SOUND_BASE}/${category}/${assetId}`;
  }

  function stopPreviewAudio() {
    if (!state.previewAudio) return;
    try {
      state.previewAudio.pause();
      state.previewAudio.currentTime = 0;
    } catch (_error) {
      // Ignore preview stop failures.
    }
    state.previewAudio = null;
    state.previewCategory = "";
  }

  async function playPreviewAudio(category) {
    const sound = state.draft?.presentation?.sound?.[category];
    const assetId = String(sound?.asset_id || "").trim();
    if (!category || !assetId) return;
    if (state.previewCategory === category && state.previewAudio) {
      stopPreviewAudio();
      render();
      return;
    }
    stopPreviewAudio();
    const audio = new Audio(buildWheelSoundUrl(category, assetId));
    audio.volume = category === "music" ? 0.36 : 0.78;
    state.previewAudio = audio;
    state.previewCategory = category;
    audio.addEventListener(
      "ended",
      () => {
        if (state.previewAudio === audio) {
          state.previewAudio = null;
          state.previewCategory = "";
          render();
        }
      },
      { once: true }
    );
    try {
      await audio.play();
    } catch (_error) {
      stopPreviewAudio();
    }
    render();
  }

  function createEntry(index) {
    const label = `Entry ${index + 1}`;
    return {
      entry_id: `entry-${index + 1}`,
      label,
      display_name: label,
      avatar_url: "",
      weight: 1,
      share: 1,
      color: DEFAULT_COLORS[index % DEFAULT_COLORS.length],
      notes: "",
      assignment: null,
      role_badges: [],
      stats_stub: {}
    };
  }

  function normalizeBadges(value) {
    if (!Array.isArray(value)) return [];
    return value
      .map((badge) => {
        if (!badge || typeof badge !== "object") return null;
        const label = String(badge.label || badge.name || badge.code || "").trim();
        const tone = String(badge.tone || badge.color || "").trim();
        if (!label) return null;
        return {
          label,
          tone
        };
      })
      .filter(Boolean)
      .slice(0, 6);
  }

  function normalizeStatsStub(value) {
    if (!value || typeof value !== "object") return {};
    const xpLabel = String(value.xp_label || value.level_label || "").trim();
    const rankLabel = String(value.rank_label || "").trim();
    const xpTotal = Number(value.xp_total);
    const rankValue = Number(value.rank_value);
    const result = {};
    if (xpLabel) result.xp_label = xpLabel;
    if (rankLabel) result.rank_label = rankLabel;
    if (Number.isFinite(xpTotal)) result.xp_total = xpTotal;
    if (Number.isFinite(rankValue)) result.rank_value = rankValue;
    return result;
  }

  function normalizeAssignment(value, fallbackEntry = {}) {
    if (!value || typeof value !== "object") return null;
    const accountId = String(value.account_id || "").trim();
    const userCode = String(value.user_code || "").trim();
    const displayName =
      String(
        value.display_name ||
          value.username ||
          value.public_name ||
          fallbackEntry.display_name ||
          fallbackEntry.label ||
          ""
      ).trim();
    const avatarUrl = String(value.avatar_url || value.profile_image_url || value.avatar || "").trim();
    const role = String(value.role || "").trim();
    const tier = String(value.tier || "").trim();
    const publicSlug = String(value.public_slug || value.slug || "").trim();
    const publicProfile =
      value.public_profile && typeof value.public_profile === "object"
        ? {
            public_slug: String(value.public_profile.public_slug || publicSlug || "").trim(),
            bio: String(value.public_profile.bio || "").trim(),
            cover_image_url: String(value.public_profile.cover_image_url || "").trim(),
            background_color: String(value.public_profile.background_color || "").trim(),
            is_listed: value.public_profile.is_listed !== false
          }
        : null;
    const badges = normalizeBadges(value.badges || value.role_badges);
    if (!accountId && !userCode && !displayName && !avatarUrl && !publicSlug && !role && !badges.length) {
      return null;
    }
    return {
      account_id: accountId,
      user_code: userCode,
      display_name: displayName,
      avatar_url: avatarUrl,
      role,
      tier,
      public_slug: publicSlug,
      badges,
      public_profile: publicProfile
    };
  }

  function normalizeSoundConfig(value) {
    const source = value && typeof value === "object" ? value : {};
    const normalized = {};
    Object.keys(SOUND_LIBRARY).forEach((category) => {
      const item = source[category] && typeof source[category] === "object" ? source[category] : {};
      const supportedAssets = SOUND_LIBRARY[category];
      const requestedAsset = String(item.asset_id || item.asset || "").trim();
      normalized[category] = {
        enabled: item.enabled !== false,
        asset_id: supportedAssets.includes(requestedAsset) ? requestedAsset : supportedAssets[0]
      };
    });
    return normalized;
  }

  function createBlankDraft() {
    return normalizeWheelForEditor({
      title: "Untitled wheel",
      description: "",
      notes: "",
      default_display_mode: "wheel",
      winner_limit: 1,
      allow_duplicates: true,
      auto_remove_winner: false,
      entries: [createEntry(0), createEntry(1)],
      palette: {
        segment_colors: DEFAULT_COLORS.slice(0, 6),
        background_color: "#08111f",
        text_color: "#f8fbff",
        accent_color: "#6fdbff",
        trim_color: "#7d9dff",
        glow_color: "#3de6ff"
      },
      presentation: {
        animation_enabled: true,
        sound_enabled: true,
        celebration_enabled: true,
        confetti_enabled: true,
        show_entry_labels: true,
        show_display_names_on_slices: true,
        slice_label_mode: "full_name",
        slow_drift_enabled: true,
        spin_duration_ms: 8500,
        scoreboard_max_rows: 24,
        sound: {
          music: createSoundCategory("music"),
          startspin: createSoundCategory("startspin"),
          respin: createSoundCategory("respin"),
          click: createSoundCategory("click"),
          winner: createSoundCategory("winner")
        }
      },
      import_provenance: {
        source_format: "manual",
        source_name: "",
        unsupported_fields: [],
        notes: "",
        exact_source_available: true
      },
      raw_import_metadata: {}
    });
  }

  function normalizeEntry(entry, index) {
    const source = entry && typeof entry === "object" ? entry : {};
    const label = String(source.label || source.display_name || `Entry ${index + 1}`).trim() || `Entry ${index + 1}`;
    const assignment = normalizeAssignment(source.assignment, source);
    return {
      entry_id: String(source.entry_id || `entry-${index + 1}`).trim() || `entry-${index + 1}`,
      label,
      display_name: String(source.display_name || label).trim() || label,
      avatar_url: String(source.avatar_url || assignment?.avatar_url || "").trim(),
      weight: Number.isFinite(Number(source.weight)) && Number(source.weight) > 0 ? Number(source.weight) : 1,
      share: Number.isFinite(Number(source.share)) && Number(source.share) > 0 ? Number(source.share) : 1,
      color: String(source.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]).trim() || DEFAULT_COLORS[index % DEFAULT_COLORS.length],
      notes: String(source.notes || "").trim(),
      assignment,
      role_badges: normalizeBadges(source.role_badges || assignment?.badges),
      stats_stub: normalizeStatsStub(source.stats_stub)
    };
  }

  function normalizeWheelForEditor(wheel) {
    const source = wheel && typeof wheel === "object" ? clone(wheel) : {};
    const palette = source.palette && typeof source.palette === "object" ? source.palette : {};
    const presentation = source.presentation && typeof source.presentation === "object" ? source.presentation : {};
    const importProvenance =
      source.import_provenance && typeof source.import_provenance === "object" ? source.import_provenance : {};
    const entriesSource = Array.isArray(source.entries) && source.entries.length
      ? source.entries
      : Array.isArray(source.entrants) && source.entrants.length
        ? source.entrants
        : [createEntry(0), createEntry(1)];
    return {
      artifact_code: String(source.artifact_code || "").trim(),
      title: String(source.title || "Untitled wheel").trim() || "Untitled wheel",
      description: String(source.description || "").trim(),
      notes: String(source.notes || "").trim(),
      default_display_mode: source.default_display_mode === "scoreboard" ? "scoreboard" : "wheel",
      winner_limit: Number.isFinite(Number(source.winner_limit))
        ? Math.max(1, Math.min(100, Number(source.winner_limit)))
        : Number.isFinite(Number(source.max_winners))
          ? Math.max(1, Math.min(100, Number(source.max_winners)))
          : 1,
      allow_duplicates: source.allow_duplicates !== false,
      auto_remove_winner: source.auto_remove_winner === true,
      entries: entriesSource.map((entry, index) => normalizeEntry(entry, index)),
      palette: {
        segment_colors: Array.isArray(palette.segment_colors) && palette.segment_colors.length
          ? palette.segment_colors.slice(0, 16).map((color, index) => String(color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]).trim() || DEFAULT_COLORS[index % DEFAULT_COLORS.length])
          : DEFAULT_COLORS.slice(0, 6),
        background_color: String(palette.background_color || "#08111f").trim() || "#08111f",
        text_color: String(palette.text_color || "#f8fbff").trim() || "#f8fbff",
        accent_color: String(palette.accent_color || "#6fdbff").trim() || "#6fdbff",
        trim_color: String(palette.trim_color || palette.accent_color || "#7d9dff").trim() || "#7d9dff",
        glow_color: String(palette.glow_color || palette.accent_color || "#3de6ff").trim() || "#3de6ff"
      },
      presentation: {
        animation_enabled: presentation.animation_enabled !== false,
        sound_enabled: presentation.sound_enabled !== false,
        celebration_enabled: presentation.celebration_enabled !== false,
        confetti_enabled:
          presentation.confetti_enabled === true || presentation.celebration_enabled === true,
        show_entry_labels: presentation.show_entry_labels !== false,
        show_display_names_on_slices: presentation.show_display_names_on_slices !== false,
        slice_label_mode: ["full_name", "initials", "avatar"].includes(String(presentation.slice_label_mode || "").trim())
          ? String(presentation.slice_label_mode).trim()
          : "full_name",
        slow_drift_enabled: presentation.slow_drift_enabled !== false,
        spin_duration_ms: Number.isFinite(Number(presentation.spin_duration_ms))
          ? Math.max(2000, Math.min(60000, Number(presentation.spin_duration_ms)))
          : 8500,
        scoreboard_max_rows: Number.isFinite(Number(presentation.scoreboard_max_rows))
          ? Math.max(3, Math.min(100, Number(presentation.scoreboard_max_rows)))
          : 24,
        sound: normalizeSoundConfig(presentation.sound || presentation.sound_config)
      },
      import_provenance: {
        source_format: String(importProvenance.source_format || "manual").trim() || "manual",
        source_name: String(importProvenance.source_name || "").trim(),
        unsupported_fields: Array.isArray(importProvenance.unsupported_fields)
          ? importProvenance.unsupported_fields.map((item) => String(item || "").trim()).filter(Boolean)
          : [],
        notes: String(importProvenance.notes || "").trim(),
        exact_source_available: importProvenance.exact_source_available !== false
      },
      raw_import_metadata:
        source.raw_import_metadata && typeof source.raw_import_metadata === "object"
          ? source.raw_import_metadata
          : {}
    };
  }

  function draftSnapshot(draft) {
    return JSON.stringify({
      artifact_code: draft.artifact_code || "",
      title: draft.title,
      description: draft.description,
      notes: draft.notes,
      default_display_mode: draft.default_display_mode,
      winner_limit: draft.winner_limit,
      allow_duplicates: draft.allow_duplicates,
      auto_remove_winner: draft.auto_remove_winner,
      entries: draft.entries,
      palette: draft.palette,
      presentation: draft.presentation,
      import_provenance: draft.import_provenance,
      raw_import_metadata: draft.raw_import_metadata
    });
  }

  function setDraft(nextDraft) {
    state.draft = normalizeWheelForEditor(nextDraft);
    state.selectedCode = state.draft.artifact_code || "";
    state.baseline = draftSnapshot(state.draft);
    state.lookupState = Object.create(null);
  }

  function isDirty() {
    return Boolean(state.draft) && draftSnapshot(state.draft) !== state.baseline;
  }

  async function requestJson(url, options = {}) {
    const response = await fetch(url, {
      credentials: "include",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {})
      },
      ...options
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.success === false) {
      throw new Error(String(payload?.error || `Request failed (${response.status})`).trim());
    }
    return payload;
  }

  function currentSelection() {
    return state.items.find((item) => item.artifact_code === state.selectedCode) || null;
  }

  function getEntryLookupKey(entry) {
    return String(entry?.entry_id || "").trim();
  }

  function ensureLookupState(entry) {
    const key = getEntryLookupKey(entry);
    if (!key) return null;
    if (!state.lookupState[key]) {
      state.lookupState[key] = {
        query: "",
        results: [],
        loading: false,
        error: "",
        open: false
      };
    }
    return state.lookupState[key];
  }

  function getLookupStateByKey(key) {
    if (!key) return null;
    if (!state.lookupState[key]) {
      state.lookupState[key] = {
        query: "",
        results: [],
        loading: false,
        error: "",
        open: false
      };
    }
    return state.lookupState[key];
  }

  function clearLookupTimers() {
    state.lookupDebounce.forEach((timerId) => window.clearTimeout(timerId));
    state.lookupDebounce.clear();
    state.lookupAborters.forEach((controller) => {
      try {
        controller.abort();
      } catch (error) {
        console.warn("[Creator] Wheel assignment lookup abort failed", error);
      }
    });
    state.lookupAborters.clear();
  }

  function closeWheelEvents() {
    if (!wheelEvents) return;
    wheelEvents.close();
    wheelEvents = null;
  }

  async function refreshFromLiveAuthority() {
    if (wheelRefreshPromise) {
      wheelRefreshQueued = true;
      return wheelRefreshPromise;
    }
    wheelRefreshPromise = (async () => {
      do {
        wheelRefreshQueued = false;
        await loadWheels({ selectCode: state.selectedCode });
      } while (wheelRefreshQueued);
    })();
    try {
      return await wheelRefreshPromise;
    } finally {
      wheelRefreshPromise = null;
    }
  }

  function ensureWheelEvents() {
    if (wheelEvents || typeof EventSource !== "function") return;
    wheelEvents = new EventSource(WHEELS_EVENTS_ENDPOINT, { withCredentials: true });
    wheelEvents.addEventListener("wheel.changed", () => {
      refreshFromLiveAuthority().catch(() => {});
    });
    wheelEvents.addEventListener("error", () => {
      if (wheelEvents?.readyState === EventSource.CLOSED) {
        closeWheelEvents();
      }
    });
  }

  function resolvePublicWheelDestination(item) {
    const publicPath =
      String(item?.public_path || "").trim() ||
      (String(item?.slug || "").trim() ? `/wheels/${encodeURIComponent(String(item.slug).trim())}` : "");
    const publicUrl =
      String(item?.public_url || "").trim() ||
      (publicPath ? `${DEFAULT_PUBLIC_BASE}${publicPath}` : "");
    return { publicPath, publicUrl };
  }

  async function loadWheels({ selectCode = "" } = {}) {
    state.loading = true;
    state.error = "";
    render();
    try {
      const payload = await requestJson(WHEELS_ENDPOINT);
      state.items = Array.isArray(payload.items) ? payload.items : [];
      const preferredCode = selectCode || state.selectedCode;
      const preferredItem = state.items.find((item) => item.artifact_code === preferredCode);
      if (preferredItem) {
        setDraft(preferredItem);
      } else if (state.items[0]) {
        setDraft(state.items[0]);
      } else if (!state.draft || !state.draft.artifact_code) {
        setDraft(createBlankDraft());
      }
    } catch (error) {
      state.error = error instanceof Error ? error.message : "Unable to load wheel workspace.";
      if (!state.draft) setDraft(createBlankDraft());
    } finally {
      state.loading = false;
      render();
    }
  }

  function buildSavePayload() {
    return {
      title: state.draft.title,
      description: state.draft.description,
      notes: state.draft.notes,
      default_display_mode: state.draft.default_display_mode,
      winner_limit: state.draft.winner_limit,
      allow_duplicates: state.draft.allow_duplicates,
      auto_remove_winner: state.draft.auto_remove_winner,
      entries: state.draft.entries,
      palette: state.draft.palette,
      presentation: {
        ...state.draft.presentation,
        confetti_enabled: state.draft.presentation.celebration_enabled === true
      },
      import_provenance: state.draft.import_provenance,
      raw_import_metadata: state.draft.raw_import_metadata
    };
  }

  async function saveDraft() {
    if (!state.draft || state.saving) return;
    state.saving = true;
    state.error = "";
    state.status = "Saving wheel artifact…";
    render();
    try {
      const isCreate = !state.selectedCode;
      const url = isCreate ? WHEELS_ENDPOINT : `${WHEELS_ENDPOINT}/${encodeURIComponent(state.selectedCode)}`;
      const payload = await requestJson(url, {
        method: isCreate ? "POST" : "PATCH",
        body: JSON.stringify(buildSavePayload())
      });
      const savedWheel = payload.wheel || payload.item || null;
      state.status = isCreate ? "Wheel created." : "Wheel saved.";
      await loadWheels({ selectCode: savedWheel?.artifact_code || state.selectedCode });
    } catch (error) {
      state.error = error instanceof Error ? error.message : "Unable to save wheel artifact.";
      state.status = "";
      render();
    } finally {
      state.saving = false;
      updateToolbarState();
    }
  }

  async function exportDraft() {
    if (!state.selectedCode || state.exporting) return;
    state.exporting = true;
    state.error = "";
    state.status = "Preparing export…";
    updateToolbarState();
    try {
      const payload = await requestJson(`${WHEELS_ENDPOINT}/${encodeURIComponent(state.selectedCode)}/export`);
      const fileName = payload?.export?.filename || `${state.draft.title || "wheel"}.sswheel`;
      const raw = JSON.stringify(payload?.export?.payload || {}, null, 2);
      const blob = new Blob([raw], { type: "application/json" });
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(href);
      state.status = `Exported ${fileName}.`;
    } catch (error) {
      state.error = error instanceof Error ? error.message : "Unable to export wheel artifact.";
      state.status = "";
    } finally {
      state.exporting = false;
      updateToolbarState();
    }
  }

  async function importPayload(payloadText, sourceName) {
    if (state.importing) return;
    state.importing = true;
    state.error = "";
    state.status = `Importing ${sourceName}…`;
    render();
    try {
      const payload = await requestJson(WHEELS_IMPORT_ENDPOINT, {
        method: "POST",
        body: JSON.stringify({
          payload_text: payloadText,
          source_name: sourceName,
          exact_source_available: true
        })
      });
      state.importText = "";
      state.importFile = null;
      state.status = `Imported ${sourceName}.`;
      await loadWheels({ selectCode: payload?.wheel?.artifact_code || "" });
    } catch (error) {
      state.error = error instanceof Error ? error.message : "Unable to import wheel payload.";
      state.status = "";
      render();
    } finally {
      state.importing = false;
      updateToolbarState();
    }
  }

  function ensureNavigationAwayOkay() {
    if (!isDirty()) return true;
    return window.confirm("Discard unsaved wheel changes?");
  }

  function selectWheel(artifactCode) {
    const item = state.items.find((entry) => entry.artifact_code === artifactCode);
    if (!item) return;
    if (!ensureNavigationAwayOkay()) return;
    setDraft(item);
    state.status = "";
    state.error = "";
    render();
  }

  function startNewWheel() {
    if (!ensureNavigationAwayOkay()) return;
    setDraft(createBlankDraft());
    state.selectedCode = "";
    state.status = "Drafting a new wheel artifact.";
    state.error = "";
    render();
  }

  function setNestedField(path, value) {
    const segments = String(path || "").split(".");
    let cursor = state.draft;
    segments.slice(0, -1).forEach((segment) => {
      if (!cursor[segment] || typeof cursor[segment] !== "object") cursor[segment] = {};
      cursor = cursor[segment];
    });
    cursor[segments[segments.length - 1]] = value;
  }

  function updateToolbarState() {
    const dirty = isDirty();
    const dirtyBadge = state.root?.querySelector("[data-wheel-dirty]");
    if (dirtyBadge) {
      dirtyBadge.textContent = dirty ? "Unsaved changes" : state.selectedCode ? "Saved" : "New draft";
      dirtyBadge.dataset.state = dirty ? "dirty" : state.selectedCode ? "saved" : "draft";
    }
    const saveButton = state.root?.querySelector("[data-action='save-wheel']");
    if (saveButton) {
      saveButton.disabled = state.loading || state.saving || !state.draft;
    }
    const exportButton = state.root?.querySelector("[data-action='export-wheel']");
    if (exportButton) {
      exportButton.disabled = !state.selectedCode || state.exporting || state.loading;
    }
    const statusNode = state.root?.querySelector("[data-wheel-status]");
    if (statusNode) {
      statusNode.textContent = state.error || state.status || "";
      statusNode.dataset.state = state.error ? "error" : state.status ? "info" : "idle";
    }
  }

  function buildWheelSummaryMarkup(item) {
    const selected = item.artifact_code === state.selectedCode;
    const destination = resolvePublicWheelDestination(item);
    const entryCount = Array.isArray(item.entries) ? item.entries.length : 0;
    const winnerLimit = Number.isFinite(Number(item.winner_limit)) ? Number(item.winner_limit) : 1;
    const modeLabel = item.default_display_mode === "scoreboard" ? "List view" : "Wheel";
    return `
      <article class="wheel-list-card-shell${selected ? " is-selected" : ""}">
        <button class="wheel-list-card" type="button" data-action="select-wheel" data-artifact-code="${escapeHtml(item.artifact_code)}">
          <span class="wheel-list-card__title">${escapeHtml(item.title || "Untitled wheel")}</span>
          <span class="wheel-list-card__meta">${escapeHtml(modeLabel)} default · ${entryCount} entrants · ${winnerLimit} winner${winnerLimit === 1 ? "" : "s"}</span>
          <span class="wheel-list-card__subtle">${escapeHtml(item.slug || item.artifact_code || "")}</span>
        </button>
        <div class="wheel-list-card__footer">
          <span class="wheel-list-card__path">${escapeHtml(destination.publicPath || "Public route pending")}</span>
          ${
            destination.publicUrl
              ? `<a class="wheel-list-card__link" href="${escapeHtml(destination.publicUrl)}" target="_blank" rel="noopener noreferrer">View public wheel</a>`
              : `<span class="wheel-list-card__link is-disabled">Public route pending</span>`
          }
        </div>
      </article>
    `;
  }

  function renderWheelList() {
    if (state.loading) {
      return `<div class="wheel-card-list-empty">Loading wheel artifacts…</div>`;
    }
    if (!state.items.length) {
      return `<div class="wheel-card-list-empty">No saved wheels yet. Create one or import a portable \`.sswheel\` file.</div>`;
    }
    return state.items.map((item) => buildWheelSummaryMarkup(item)).join("");
  }

  function renderPaletteInputs() {
    return (state.draft.palette.segment_colors || [])
      .map((color, index) => `
        <label class="wheel-palette-chip">
          <span>Slice ${index + 1}</span>
          <input type="color" value="${escapeHtml(color)}" data-palette-index="${index}" />
          <button class="creator-button subtle danger" type="button" data-action="remove-palette-color" data-palette-index="${index}" ${(state.draft.palette.segment_colors || []).length <= 2 ? "disabled" : ""}>Remove</button>
        </label>
      `)
      .join("");
  }

  function buildAssignmentSummary(entry) {
    const assignment = entry.assignment;
    if (!assignment) {
      return `<span class="wheel-entry-assignment-empty">No StreamSuites account linked.</span>`;
    }
    const badges = Array.isArray(assignment.badges) && assignment.badges.length
      ? `<div class="wheel-entry-badge-row">${assignment.badges.map((badge) => `<span class="wheel-entry-badge">${escapeHtml(badge.label)}</span>`).join("")}</div>`
      : "";
    const publicSlug = assignment.public_slug || assignment.public_profile?.public_slug || "";
    const roleBits = [assignment.role, assignment.tier, publicSlug ? `@${publicSlug}` : ""].filter(Boolean);
    return `
      <div class="wheel-entry-assignment-summary">
        <div class="wheel-entry-assignment-avatar">
          <img src="${escapeHtml(assignment.avatar_url || DEFAULT_ASSIGNMENT_BADGE)}" alt="" loading="lazy" />
        </div>
        <div class="wheel-entry-assignment-meta">
          <strong>${escapeHtml(assignment.display_name || entry.display_name || entry.label)}</strong>
          <span>${escapeHtml(roleBits.join(" · ") || assignment.user_code || "Linked account")}</span>
          ${badges}
        </div>
      </div>
    `;
  }

  function renderLookupResults(entry) {
    const key = getEntryLookupKey(entry);
    const lookup = getLookupStateByKey(key);
    if (!lookup?.open) return "";
    if (lookup.loading) {
      return `<div class="wheel-assignment-results"><div class="wheel-assignment-result-empty">Searching accounts…</div></div>`;
    }
    if (lookup.error) {
      return `<div class="wheel-assignment-results"><div class="wheel-assignment-result-empty">${escapeHtml(lookup.error)}</div></div>`;
    }
    if (!lookup.results.length) {
      return `<div class="wheel-assignment-results"><div class="wheel-assignment-result-empty">No accounts matched that search.</div></div>`;
    }
    return `
      <div class="wheel-assignment-results">
        ${lookup.results
          .map((result, resultIndex) => {
            const badges = Array.isArray(result.badges) && result.badges.length
              ? `<div class="wheel-entry-badge-row">${result.badges.map((badge) => `<span class="wheel-entry-badge">${escapeHtml(badge.label || badge.name || "")}</span>`).join("")}</div>`
              : "";
            const metaParts = [result.role, result.tier, result.public_slug ? `@${result.public_slug}` : "", result.identity_code].filter(Boolean);
            return `
              <button
                class="wheel-assignment-result"
                type="button"
                data-action="assign-entry-account"
                data-entry-id="${escapeHtml(key)}"
                data-result-index="${resultIndex}"
              >
                <span class="wheel-assignment-result-avatar">
                  <img src="${escapeHtml(result.avatar_url || DEFAULT_ASSIGNMENT_BADGE)}" alt="" loading="lazy" />
                </span>
                <span class="wheel-assignment-result-copy">
                  <strong>${escapeHtml(result.display_name || result.user_code || "Account")}</strong>
                  <span>${escapeHtml(metaParts.join(" · ") || result.user_code || "StreamSuites account")}</span>
                  ${badges}
                </span>
              </button>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function renderEntryCard(entry, index) {
    const assignmentState = ensureLookupState(entry);
    const badges = Array.isArray(entry.role_badges) && entry.role_badges.length
      ? `<div class="wheel-entry-badge-row">${entry.role_badges.map((badge) => `<span class="wheel-entry-badge">${escapeHtml(badge.label)}</span>`).join("")}</div>`
      : "";
    return `
      <article class="wheel-entry-card" data-entry-card="${escapeHtml(entry.entry_id)}">
        <header class="wheel-entry-card__header">
          <div class="wheel-entry-card__title">
            <span class="wheel-entry-card__eyebrow">Entrant ${index + 1}</span>
            <h4>${escapeHtml(entry.display_name || entry.label)}</h4>
          </div>
          <div class="wheel-entry-card__actions">
            <button class="creator-button subtle" type="button" data-action="move-entry-up" data-entry-index="${index}" ${index === 0 ? "disabled" : ""}>Up</button>
            <button class="creator-button subtle" type="button" data-action="move-entry-down" data-entry-index="${index}" ${index === state.draft.entries.length - 1 ? "disabled" : ""}>Down</button>
            <button class="creator-button subtle danger" type="button" data-action="remove-entry" data-entry-index="${index}" ${state.draft.entries.length <= 1 ? "disabled" : ""}>Remove</button>
          </div>
        </header>

        <div class="wheel-entry-grid">
          <label class="wheel-field">
            <span>Internal label</span>
            <input class="account-field-input" type="text" value="${escapeHtml(entry.label)}" data-entry-index="${index}" data-entry-field="label" placeholder="Internal label" />
          </label>
          <label class="wheel-field">
            <span>Display name</span>
            <input class="account-field-input" type="text" value="${escapeHtml(entry.display_name)}" data-entry-index="${index}" data-entry-field="display_name" placeholder="Public display name" />
          </label>
          <label class="wheel-field wheel-field--compact">
            <span>Weight</span>
            <input class="account-field-input" type="number" min="0.1" step="0.1" value="${escapeHtml(String(entry.weight))}" data-entry-index="${index}" data-entry-field="weight" />
          </label>
          <label class="wheel-field wheel-field--compact">
            <span>Share</span>
            <input class="account-field-input" type="number" min="0.1" step="0.1" value="${escapeHtml(String(entry.share))}" data-entry-index="${index}" data-entry-field="share" />
          </label>
          <label class="wheel-field wheel-field--compact">
            <span>Slice color</span>
            <input class="wheel-color-input" type="color" value="${escapeHtml(entry.color)}" data-entry-index="${index}" data-entry-field="color" />
          </label>
          <label class="wheel-field">
            <span>Avatar URL</span>
            <input class="account-field-input" type="url" value="${escapeHtml(entry.avatar_url)}" data-entry-index="${index}" data-entry-field="avatar_url" placeholder="Leave blank for default avatar" />
          </label>
        </div>

        <label class="wheel-field">
          <span>Notes</span>
          <textarea class="account-field-input wheel-textarea" rows="3" data-entry-index="${index}" data-entry-field="notes" placeholder="Slim public notes or context">${escapeHtml(entry.notes)}</textarea>
        </label>

        <section class="wheel-entry-assignment">
          <div class="wheel-entry-assignment-topline">
            <div>
              <span class="wheel-entry-card__eyebrow">Assigned StreamSuites account</span>
              <p>Search by display name, user code, or public identity. Search results come from the authority runtime only.</p>
            </div>
            <button class="creator-button subtle" type="button" data-action="clear-entry-assignment" data-entry-id="${escapeHtml(entry.entry_id)}" ${entry.assignment ? "" : "disabled"}>Clear</button>
          </div>
          ${buildAssignmentSummary(entry)}
          <div class="wheel-assignment-search">
            <input
              class="account-field-input"
              type="search"
              value="${escapeHtml(assignmentState?.query || "")}"
              data-entry-id="${escapeHtml(entry.entry_id)}"
              data-action-input="entry-assignment-query"
              placeholder="Search existing StreamSuites accounts"
              autocomplete="off"
              spellcheck="false"
            />
            ${renderLookupResults(entry)}
          </div>
        </section>

        ${badges}
      </article>
    `;
  }

  function renderEntries() {
    return state.draft.entries.map((entry, index) => renderEntryCard(entry, index)).join("");
  }

  function renderSoundSettings() {
    return Object.keys(SOUND_LIBRARY)
      .map((category) => {
        const sound = state.draft.presentation.sound[category] || createSoundCategory(category);
        return `
          <div class="wheel-sound-row">
            <label class="wheel-toggle-row">
              <input type="checkbox" data-field="presentation.sound.${category}.enabled" ${sound.enabled ? "checked" : ""} />
              <span>${escapeHtml(SOUND_CATEGORY_LABELS[category] || category)}</span>
            </label>
            <div class="wheel-sound-row__controls">
              <select class="account-field-input" data-field="presentation.sound.${category}.asset_id">
                ${(SOUND_LIBRARY[category] || [])
                  .map((assetId) => `<option value="${escapeHtml(assetId)}" ${sound.asset_id === assetId ? "selected" : ""}>${escapeHtml(assetId)}</option>`)
                  .join("")}
              </select>
              <button class="creator-button secondary wheel-sound-preview-button" type="button" data-action="preview-sound" data-sound-category="${escapeHtml(category)}">${state.previewCategory === category ? "Stop" : "Preview"}</button>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function renderUnsupportedImportBlock() {
    const unsupported = state.draft.import_provenance?.unsupported_fields || [];
    if (!unsupported.length && !state.draft.import_provenance?.notes) {
      return "";
    }
    const unsupportedItems = unsupported.length
      ? `<div class="wheel-unsupported-list">${unsupported.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>`
      : "";
    return `
      <section class="ss-panel wheel-editor-panel">
        <header class="ss-panel-header">
          <div>
            <h3>Import notes</h3>
            <p class="muted">Unsupported fields are preserved as import metadata only. They are not presented as working runtime behavior.</p>
          </div>
        </header>
        <div class="ss-panel-body">
          ${state.draft.import_provenance?.notes ? `<p class="muted">${escapeHtml(state.draft.import_provenance.notes)}</p>` : ""}
          ${unsupportedItems}
        </div>
      </section>
    `;
  }

  function render() {
    if (!state.root) return;
    if (!state.draft) {
      state.root.innerHTML = `<div class="wheel-manager-loading">Loading wheel workspace…</div>`;
      return;
    }
    const selected = currentSelection();
    const fileName = state.importFile?.name || "No file selected";
    const activeModeLabel = state.draft.default_display_mode === "scoreboard" ? "List view" : "Wheel";
    state.root.innerHTML = `
      <div class="wheel-manager-shell">
        <aside class="wheel-manager-sidebar">
          <section class="ss-panel wheel-editor-panel">
            <header class="ss-panel-header">
              <div>
                <h3>Your wheels</h3>
                <p class="muted">Runtime/Auth remains the only authority. This editor only saves through the published wheel artifact contract.</p>
              </div>
              <div class="wheel-panel-actions">
                <button class="creator-button secondary" type="button" data-action="refresh-wheels">Refresh</button>
                <button class="creator-button primary" type="button" data-action="new-wheel">New wheel</button>
              </div>
            </header>
            <div class="ss-panel-body wheel-card-list">
              ${renderWheelList()}
            </div>
          </section>

          <section class="ss-panel wheel-editor-panel">
            <header class="ss-panel-header">
              <div>
                <h3>Import</h3>
                <p class="muted">Accepts portable \`.sswheel\` JSON or compatible source payloads. Unsupported fields stay documented in import metadata instead of being faked as live behavior.</p>
              </div>
            </header>
            <div class="ss-panel-body wheel-import-stack">
              <label class="wheel-file-picker">
                <span>Choose file</span>
                <input type="file" accept=".sswheel,.json,.txt" data-wheel-import-file="true" />
              </label>
              <div class="wheel-import-file-name">${escapeHtml(fileName)}</div>
              <button class="creator-button secondary" type="button" data-action="import-file" ${state.importFile ? "" : "disabled"}>${state.importing ? "Importing…" : "Import file"}</button>
              <label class="account-field-label" for="wheel-import-textarea">Paste payload</label>
              <textarea id="wheel-import-textarea" class="account-field-input wheel-import-textarea" rows="7" data-wheel-import-text="true" placeholder="{ &quot;portable_format&quot;: &quot;sswheel&quot;, ... }">${escapeHtml(state.importText)}</textarea>
              <button class="creator-button secondary" type="button" data-action="import-text" ${state.importText.trim() ? "" : "disabled"}>${state.importing ? "Importing…" : "Import pasted payload"}</button>
            </div>
          </section>

          <section class="ss-panel wheel-editor-panel">
            <header class="ss-panel-header">
              <div>
                <h3>Not active yet</h3>
                <p class="muted">Manual editing is the authority path for this milestone.</p>
              </div>
            </header>
            <div class="ss-panel-body">
              <p class="muted">Backend winner history, automation, and XP/rank logic are intentionally not active on this route yet.</p>
            </div>
          </section>
        </aside>

        <div class="wheel-manager-main">
          <section class="ss-panel wheel-editor-panel">
            <header class="ss-panel-header">
              <div>
                <h3>${escapeHtml(state.draft.title || "Untitled wheel")}</h3>
                <p class="muted">${selected ? `Editing ${escapeHtml(selected.slug || selected.artifact_code || "")}` : "New unsaved wheel artifact"} · ${escapeHtml(activeModeLabel)} default</p>
              </div>
              <div class="wheel-toolbar">
                <span class="wheel-dirty-pill" data-wheel-dirty="true"></span>
                <button class="creator-button secondary" type="button" data-action="export-wheel" ${state.selectedCode ? "" : "disabled"}>${state.exporting ? "Exporting…" : "Export"}</button>
                <button class="creator-button primary" type="button" data-action="save-wheel">${state.saving ? "Saving…" : "Save"}</button>
              </div>
            </header>
            <div class="ss-panel-body">
              <div class="wheel-status" data-wheel-status="true"></div>

              <div class="wheel-kpi-grid">
                <article class="wheel-kpi-card">
                  <span>Entrants</span>
                  <strong>${state.draft.entries.length}</strong>
                </article>
                <article class="wheel-kpi-card">
                  <span>Winner limit</span>
                  <strong>${state.draft.winner_limit}</strong>
                </article>
                <article class="wheel-kpi-card">
                  <span>Slice labels</span>
                  <strong>${escapeHtml((SLICE_LABEL_MODES.find((item) => item.value === state.draft.presentation.slice_label_mode) || SLICE_LABEL_MODES[0]).label)}</strong>
                </article>
                <article class="wheel-kpi-card">
                  <span>Sound cues</span>
                  <strong>${state.draft.presentation.sound_enabled ? "Enabled" : "Muted"}</strong>
                </article>
              </div>

              <div class="wheel-editor-grid wheel-editor-grid--dense">
                <section class="wheel-form-section">
                  <h4>Basics</h4>
                  <label class="account-field-label">Title</label>
                  <input class="account-field-input" type="text" value="${escapeHtml(state.draft.title)}" data-field="title" />
                  <label class="account-field-label">Description</label>
                  <textarea class="account-field-input wheel-textarea" rows="3" data-field="description">${escapeHtml(state.draft.description)}</textarea>
                  <label class="account-field-label">Notes</label>
                  <textarea class="account-field-input wheel-textarea" rows="4" data-field="notes">${escapeHtml(state.draft.notes)}</textarea>
                </section>

                <section class="wheel-form-section">
                  <h4>Rules</h4>
                  <label class="account-field-label">Default public layout</label>
                  <select class="account-field-input" data-field="default_display_mode">
                    ${DISPLAY_MODE_OPTIONS.map((option) => `<option value="${escapeHtml(option.value)}" ${state.draft.default_display_mode === option.value ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
                  </select>
                  <label class="account-field-label">Winner limit</label>
                  <input class="account-field-input" type="number" min="1" max="100" step="1" value="${escapeHtml(String(state.draft.winner_limit))}" data-field="winner_limit" />
                  <label class="wheel-toggle-row">
                    <input type="checkbox" data-field="allow_duplicates" ${state.draft.allow_duplicates ? "checked" : ""} />
                    <span>Allow duplicate winners</span>
                  </label>
                  <label class="wheel-toggle-row">
                    <input type="checkbox" data-field="auto_remove_winner" ${state.draft.auto_remove_winner ? "checked" : ""} />
                    <span>Auto-remove winner after a draw</span>
                  </label>
                </section>

                <section class="wheel-form-section">
                  <h4>Presentation</h4>
                  <label class="account-field-label">Slice label mode</label>
                  <select class="account-field-input" data-field="presentation.slice_label_mode">
                    ${SLICE_LABEL_MODES.map((option) => `<option value="${escapeHtml(option.value)}" ${state.draft.presentation.slice_label_mode === option.value ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
                  </select>
                  <label class="wheel-toggle-row">
                    <input type="checkbox" data-field="presentation.show_display_names_on_slices" ${state.draft.presentation.show_display_names_on_slices ? "checked" : ""} />
                    <span>Show display names on slices</span>
                  </label>
                  <label class="wheel-toggle-row">
                    <input type="checkbox" data-field="presentation.slow_drift_enabled" ${state.draft.presentation.slow_drift_enabled ? "checked" : ""} />
                    <span>Enable slow idle drift</span>
                  </label>
                  <label class="wheel-toggle-row">
                    <input type="checkbox" data-field="presentation.animation_enabled" ${state.draft.presentation.animation_enabled ? "checked" : ""} />
                    <span>Animate wheel motion</span>
                  </label>
                  <label class="wheel-toggle-row">
                    <input type="checkbox" data-field="presentation.celebration_enabled" ${state.draft.presentation.celebration_enabled ? "checked" : ""} />
                    <span>Enable celebration visuals</span>
                  </label>
                </section>

                <section class="wheel-form-section">
                  <h4>Tuning</h4>
                  <label class="account-field-label">Spin duration (ms)</label>
                  <input class="account-field-input" type="number" min="2000" max="60000" step="100" value="${escapeHtml(String(state.draft.presentation.spin_duration_ms))}" data-field="presentation.spin_duration_ms" />
                  <label class="account-field-label">List view row limit</label>
                  <input class="account-field-input" type="number" min="3" max="100" step="1" value="${escapeHtml(String(state.draft.presentation.scoreboard_max_rows))}" data-field="presentation.scoreboard_max_rows" />
                  <label class="wheel-toggle-row">
                    <input type="checkbox" data-field="presentation.sound_enabled" ${state.draft.presentation.sound_enabled ? "checked" : ""} />
                    <span>Enable sound cues</span>
                  </label>
                  <label class="wheel-toggle-row">
                    <input type="checkbox" data-field="presentation.show_entry_labels" ${state.draft.presentation.show_entry_labels ? "checked" : ""} />
                    <span>Render label treatment inside slices</span>
                  </label>
                </section>
              </div>
            </div>
          </section>

          <section class="ss-panel wheel-editor-panel">
            <header class="ss-panel-header">
              <div>
                <h3>Palette + trim lighting</h3>
                <p class="muted">These colors drive the public wheel stage, trim lighting, and hover accents.</p>
              </div>
              <div class="wheel-panel-actions">
                <button class="creator-button secondary" type="button" data-action="add-palette-color" ${(state.draft.palette.segment_colors || []).length >= 16 ? "disabled" : ""}>Add color</button>
              </div>
            </header>
            <div class="ss-panel-body wheel-palette-stack">
              <div class="wheel-color-grid wheel-color-grid--wide">
                <label>
                  <span>Background</span>
                  <input type="color" value="${escapeHtml(state.draft.palette.background_color)}" data-field="palette.background_color" />
                </label>
                <label>
                  <span>Text</span>
                  <input type="color" value="${escapeHtml(state.draft.palette.text_color)}" data-field="palette.text_color" />
                </label>
                <label>
                  <span>Accent</span>
                  <input type="color" value="${escapeHtml(state.draft.palette.accent_color)}" data-field="palette.accent_color" />
                </label>
                <label>
                  <span>Trim</span>
                  <input type="color" value="${escapeHtml(state.draft.palette.trim_color)}" data-field="palette.trim_color" />
                </label>
                <label>
                  <span>Glow</span>
                  <input type="color" value="${escapeHtml(state.draft.palette.glow_color)}" data-field="palette.glow_color" />
                </label>
              </div>
              <div class="wheel-palette-grid">
                ${renderPaletteInputs()}
              </div>
            </div>
          </section>

          <section class="ss-panel wheel-editor-panel">
            <header class="ss-panel-header">
              <div>
                <h3>Sound cues</h3>
                <p class="muted">Uses the real wheel sound library. Defaults are the \`*0\` assets in each category.</p>
              </div>
            </header>
            <div class="ss-panel-body wheel-sound-grid">
              ${renderSoundSettings()}
            </div>
          </section>

          <section class="ss-panel wheel-editor-panel">
            <header class="ss-panel-header">
              <div>
                <h3>Entrants</h3>
                <p class="muted">Manual labels, avatar defaults, weights, colors, and account linkage persist with the artifact. Backend winner history is still not implied here.</p>
              </div>
              <div class="wheel-panel-actions">
                <button class="creator-button secondary" type="button" data-action="add-entry">Add entrant</button>
              </div>
            </header>
            <div class="ss-panel-body wheel-entry-stack">
              ${renderEntries()}
            </div>
          </section>

          ${renderUnsupportedImportBlock()}
        </div>
      </div>
    `;
    updateToolbarState();
  }

  function moveEntry(index, direction) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= state.draft.entries.length) return;
    const [entry] = state.draft.entries.splice(index, 1);
    state.draft.entries.splice(nextIndex, 0, entry);
    render();
  }

  function findEntryById(entryId) {
    return state.draft?.entries?.find((entry) => entry.entry_id === entryId) || null;
  }

  function syncLookupContainer(entryId) {
    const entry = findEntryById(entryId);
    if (!entry) return;
    const container = state.root?.querySelector(`[data-entry-card="${CSS.escape(entryId)}"] .wheel-assignment-search`);
    if (!container) return;
    const resultsMarkup = renderLookupResults(entry);
    const existingResults = container.querySelector(".wheel-assignment-results");
    if (existingResults) existingResults.remove();
    if (resultsMarkup) {
      container.insertAdjacentHTML("beforeend", resultsMarkup);
    }
  }

  async function runAccountLookup(entryId, query) {
    const entry = findEntryById(entryId);
    if (!entry) return;
    const lookup = getLookupStateByKey(entryId);
    if (!lookup) return;
    const trimmed = String(query || "").trim();
    lookup.query = trimmed;
    if (trimmed.length < 2) {
      lookup.results = [];
      lookup.loading = false;
      lookup.error = "";
      lookup.open = false;
      syncLookupContainer(entryId);
      return;
    }
    const activeAborter = state.lookupAborters.get(entryId);
    if (activeAborter) {
      activeAborter.abort();
    }
    const controller = new AbortController();
    state.lookupAborters.set(entryId, controller);
    lookup.loading = true;
    lookup.error = "";
    lookup.open = true;
    syncLookupContainer(entryId);
    try {
      const payload = await requestJson(
        `${WHEEL_ACCOUNT_LOOKUP_ENDPOINT}?q=${encodeURIComponent(trimmed)}`,
        { signal: controller.signal }
      );
      lookup.results = Array.isArray(payload.items) ? payload.items : [];
      lookup.loading = false;
      lookup.open = true;
      lookup.error = "";
    } catch (error) {
      if (controller.signal.aborted) return;
      lookup.results = [];
      lookup.loading = false;
      lookup.open = true;
      lookup.error = error instanceof Error ? error.message : "Unable to search accounts.";
    } finally {
      if (state.lookupAborters.get(entryId) === controller) {
        state.lookupAborters.delete(entryId);
      }
      syncLookupContainer(entryId);
    }
  }

  function queueAccountLookup(entryId, query) {
    const existingTimer = state.lookupDebounce.get(entryId);
    if (existingTimer) window.clearTimeout(existingTimer);
    const lookup = getLookupStateByKey(entryId);
    if (lookup) {
      lookup.query = query;
      lookup.open = String(query || "").trim().length >= 2;
      syncLookupContainer(entryId);
    }
    const timerId = window.setTimeout(() => {
      state.lookupDebounce.delete(entryId);
      void runAccountLookup(entryId, query);
    }, LOOKUP_DEBOUNCE_MS);
    state.lookupDebounce.set(entryId, timerId);
  }

  function applyAssignmentResult(entryId, resultIndex) {
    const entry = findEntryById(entryId);
    const lookup = getLookupStateByKey(entryId);
    if (!entry || !lookup) return;
    const picked = lookup.results?.[resultIndex];
    if (!picked) return;
    entry.assignment = normalizeAssignment(picked, entry);
    entry.display_name = String(entry.display_name || picked.display_name || picked.user_code || entry.label).trim() || entry.label;
    if (!entry.avatar_url && picked.avatar_url) {
      entry.avatar_url = String(picked.avatar_url).trim();
    }
    if (Array.isArray(picked.badges) && picked.badges.length) {
      entry.role_badges = normalizeBadges(picked.badges);
    }
    lookup.query = entry.assignment?.display_name || entry.display_name || "";
    lookup.results = [];
    lookup.loading = false;
    lookup.error = "";
    lookup.open = false;
    render();
  }

  function clearAssignment(entryId) {
    const entry = findEntryById(entryId);
    if (!entry) return;
    entry.assignment = null;
    entry.role_badges = [];
    const lookup = getLookupStateByKey(entryId);
    if (lookup) {
      lookup.query = "";
      lookup.results = [];
      lookup.loading = false;
      lookup.error = "";
      lookup.open = false;
    }
    render();
  }

  function updateEntryField(index, field, rawValue) {
    const entry = state.draft?.entries?.[index];
    if (!entry) return;
    switch (field) {
      case "weight":
      case "share":
        entry[field] = Math.max(0.1, Number(rawValue) || 1);
        break;
      case "color":
        entry.color = String(rawValue || DEFAULT_COLORS[index % DEFAULT_COLORS.length]);
        break;
      default:
        entry[field] = String(rawValue || "");
        break;
    }
    if (field === "label" && !entry.display_name.trim()) {
      entry.display_name = entry.label;
    }
    updateToolbarState();
  }

  function coerceFieldValue(input, field) {
    if (input instanceof HTMLInputElement && input.type === "checkbox") {
      return input.checked;
    }
    if (
      input instanceof HTMLInputElement &&
      input.type === "number" &&
      ["winner_limit", "presentation.spin_duration_ms", "presentation.scoreboard_max_rows"].includes(field)
    ) {
      const numeric = Number(input.value);
      if (field === "winner_limit") return Math.max(1, Math.min(100, Number.isFinite(numeric) ? numeric : 1));
      if (field === "presentation.spin_duration_ms") return Math.max(2000, Math.min(60000, Number.isFinite(numeric) ? numeric : 8500));
      if (field === "presentation.scoreboard_max_rows") return Math.max(3, Math.min(100, Number.isFinite(numeric) ? numeric : 24));
    }
    return input.value;
  }

  function bindEvents() {
    if (!state.root || state.root.dataset.bound === "true") return;
    state.root.dataset.bound = "true";

    state.root.addEventListener("click", async (event) => {
      const trigger = event.target.closest("[data-action]");
      if (!(trigger instanceof HTMLElement)) return;
      const action = trigger.dataset.action || "";
      if (action === "refresh-wheels") {
        void loadWheels();
        return;
      }
      if (action === "new-wheel") {
        startNewWheel();
        return;
      }
      if (action === "select-wheel") {
        selectWheel(String(trigger.dataset.artifactCode || ""));
        return;
      }
      if (action === "save-wheel") {
        void saveDraft();
        return;
      }
      if (action === "export-wheel") {
        void exportDraft();
        return;
      }
      if (action === "add-entry") {
        state.draft.entries.push(createEntry(state.draft.entries.length));
        render();
        return;
      }
      if (action === "remove-entry") {
        const index = Number(trigger.dataset.entryIndex);
        if (!Number.isFinite(index)) return;
        state.draft.entries.splice(index, 1);
        if (!state.draft.entries.length) {
          state.draft.entries.push(createEntry(0));
        }
        render();
        return;
      }
      if (action === "move-entry-up") {
        moveEntry(Number(trigger.dataset.entryIndex), -1);
        return;
      }
      if (action === "move-entry-down") {
        moveEntry(Number(trigger.dataset.entryIndex), 1);
        return;
      }
      if (action === "add-palette-color") {
        state.draft.palette.segment_colors.push(DEFAULT_COLORS[state.draft.palette.segment_colors.length % DEFAULT_COLORS.length]);
        render();
        return;
      }
      if (action === "remove-palette-color") {
        const index = Number(trigger.dataset.paletteIndex);
        if (!Number.isFinite(index)) return;
        state.draft.palette.segment_colors.splice(index, 1);
        render();
        return;
      }
      if (action === "import-file") {
        if (!state.importFile) return;
        const payloadText = await state.importFile.text();
        void importPayload(payloadText, state.importFile.name);
        return;
      }
      if (action === "import-text") {
        if (!state.importText.trim()) return;
        void importPayload(state.importText, "pasted-wheel.json");
        return;
      }
      if (action === "assign-entry-account") {
        applyAssignmentResult(String(trigger.dataset.entryId || ""), Number(trigger.dataset.resultIndex));
        return;
      }
      if (action === "clear-entry-assignment") {
        clearAssignment(String(trigger.dataset.entryId || ""));
        return;
      }
      if (action === "preview-sound") {
        void playPreviewAudio(String(trigger.dataset.soundCategory || ""));
      }
    });

    state.root.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.matches("[data-wheel-import-file='true']")) {
        state.importFile = target.files?.[0] || null;
        render();
        return;
      }
      if (target.matches("[data-entry-index][data-entry-field]")) {
        const input = target;
        const index = Number(input.dataset.entryIndex);
        const field = String(input.dataset.entryField || "");
        if (!Number.isFinite(index)) return;
        updateEntryField(index, field, input.value);
        return;
      }
      if (target.matches("[data-palette-index]")) {
        const input = target;
        const index = Number(input.dataset.paletteIndex);
        if (!Number.isFinite(index)) return;
        state.draft.palette.segment_colors[index] = String(input.value || DEFAULT_COLORS[index % DEFAULT_COLORS.length]);
        updateToolbarState();
        return;
      }
      if (target.matches("[data-field]")) {
        const input = target;
        const field = String(input.dataset.field || "");
        const value = coerceFieldValue(input, field);
        setNestedField(field, value);
        if (field === "presentation.celebration_enabled") {
          state.draft.presentation.confetti_enabled = value === true;
        }
        updateToolbarState();
      }
    });

    state.root.addEventListener("input", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.matches("[data-wheel-import-text='true']")) {
        state.importText = target.value || "";
        updateToolbarState();
        return;
      }
      if (target.matches("[data-entry-id][data-action-input='entry-assignment-query']")) {
        const input = target;
        const entryId = String(input.dataset.entryId || "");
        queueAccountLookup(entryId, input.value || "");
      }
    });

    state.root.addEventListener("focusout", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.matches("[data-entry-id][data-action-input='entry-assignment-query']")) return;
      const entryId = String(target.dataset.entryId || "");
      window.setTimeout(() => {
        const lookup = getLookupStateByKey(entryId);
        if (!lookup) return;
        const active = document.activeElement;
        if (active?.closest?.(`[data-entry-card="${CSS.escape(entryId)}"] .wheel-assignment-results`)) {
          return;
        }
        lookup.open = false;
        syncLookupContainer(entryId);
      }, 140);
    });
  }

  async function init() {
    state.root = document.querySelector("[data-wheel-manager='true']");
    if (!(state.root instanceof HTMLElement)) return;
    ensureWheelEvents();
    window.addEventListener("beforeunload", closeWheelEvents);
    bindEvents();
    setDraft(createBlankDraft());
    render();
    await loadWheels();
  }

  function destroy() {
    clearLookupTimers();
    closeWheelEvents();
    stopPreviewAudio();
    state.root = null;
    state.items = [];
    state.selectedCode = "";
    state.draft = null;
    state.baseline = "";
    state.status = "";
    state.error = "";
    state.importText = "";
    state.importFile = null;
    state.lookupState = Object.create(null);
    state.previewCategory = "";
  }

  window.WheelsView = { init, destroy };
})();
