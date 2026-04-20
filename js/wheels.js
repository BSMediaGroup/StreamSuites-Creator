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
  const DEFAULT_PUBLIC_BASE = "https://streamsuites.app";
  const DEFAULT_COLORS = ["#ff6b6b", "#ffd166", "#06d6a0", "#118ab2", "#9b5de5", "#f15bb5"];
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

  function createEntry(index) {
    return {
      entry_id: `entry-${index + 1}`,
      label: `Entry ${index + 1}`,
      weight: 1,
      color: DEFAULT_COLORS[index % DEFAULT_COLORS.length],
      notes: ""
    };
  }

  function createBlankDraft() {
    return normalizeWheelForEditor({
      title: "Untitled wheel",
      description: "",
      notes: "",
      default_display_mode: "wheel",
      allow_duplicates: true,
      auto_remove_winner: false,
      entries: [createEntry(0), createEntry(1)],
      palette: {
        segment_colors: DEFAULT_COLORS.slice(0, 6),
        background_color: "#0f172a",
        text_color: "#f8fafc",
        accent_color: "#38bdf8"
      },
      presentation: {
        animation_enabled: true,
        sound_enabled: true,
        confetti_enabled: false,
        show_entry_labels: true,
        spin_duration_ms: 8500,
        scoreboard_max_rows: 24
      },
      import_provenance: {
        source_format: "manual",
        source_name: "",
        unsupported_fields: [],
        notes: ""
      },
      raw_import_metadata: {}
    });
  }

  function normalizeWheelForEditor(wheel) {
    const source = wheel && typeof wheel === "object" ? clone(wheel) : {};
    const palette = source.palette && typeof source.palette === "object" ? source.palette : {};
    const presentation = source.presentation && typeof source.presentation === "object" ? source.presentation : {};
    const importProvenance =
      source.import_provenance && typeof source.import_provenance === "object" ? source.import_provenance : {};
    const entries = Array.isArray(source.entries) && source.entries.length
      ? source.entries
      : [createEntry(0), createEntry(1)];

    return {
      artifact_code: String(source.artifact_code || "").trim(),
      title: String(source.title || "Untitled wheel").trim() || "Untitled wheel",
      description: String(source.description || "").trim(),
      notes: String(source.notes || "").trim(),
      default_display_mode: source.default_display_mode === "scoreboard" ? "scoreboard" : "wheel",
      allow_duplicates: source.allow_duplicates !== false,
      auto_remove_winner: source.auto_remove_winner === true,
      entries: entries.map((entry, index) => ({
        entry_id: String(entry?.entry_id || `entry-${index + 1}`).trim() || `entry-${index + 1}`,
        label: String(entry?.label || `Entry ${index + 1}`).trim() || `Entry ${index + 1}`,
        weight: Number.isFinite(Number(entry?.weight)) && Number(entry.weight) > 0 ? Number(entry.weight) : 1,
        color: String(entry?.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]).trim() || DEFAULT_COLORS[index % DEFAULT_COLORS.length],
        notes: String(entry?.notes || "").trim()
      })),
      palette: {
        segment_colors: Array.isArray(palette.segment_colors) && palette.segment_colors.length
          ? palette.segment_colors.slice(0, 12)
          : DEFAULT_COLORS.slice(0, 6),
        background_color: String(palette.background_color || "#0f172a").trim() || "#0f172a",
        text_color: String(palette.text_color || "#f8fafc").trim() || "#f8fafc",
        accent_color: String(palette.accent_color || "#38bdf8").trim() || "#38bdf8"
      },
      presentation: {
        animation_enabled: presentation.animation_enabled !== false,
        sound_enabled: presentation.sound_enabled !== false,
        confetti_enabled: presentation.confetti_enabled === true,
        show_entry_labels: presentation.show_entry_labels !== false,
        spin_duration_ms: Number.isFinite(Number(presentation.spin_duration_ms))
          ? Math.max(2000, Math.min(60000, Number(presentation.spin_duration_ms)))
          : 8500,
        scoreboard_max_rows: Number.isFinite(Number(presentation.scoreboard_max_rows))
          ? Math.max(3, Math.min(100, Number(presentation.scoreboard_max_rows)))
          : 24
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
      allow_duplicates: state.draft.allow_duplicates,
      auto_remove_winner: state.draft.auto_remove_winner,
      entries: state.draft.entries,
      palette: state.draft.palette,
      presentation: state.draft.presentation,
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

  function renderWheelList() {
    if (state.loading) {
      return `<div class="wheel-card-list-empty">Loading wheel artifacts…</div>`;
    }
    if (!state.items.length) {
      return `<div class="wheel-card-list-empty">No saved wheels yet. Create one or import a portable \`.sswheel\` file.</div>`;
    }
    return state.items
      .map((item) => {
        const selected = item.artifact_code === state.selectedCode;
        const destination = resolvePublicWheelDestination(item);
        return `
          <article class="wheel-list-card-shell${selected ? " is-selected" : ""}">
            <button class="wheel-list-card" type="button" data-action="select-wheel" data-artifact-code="${escapeHtml(item.artifact_code)}">
              <span class="wheel-list-card__title">${escapeHtml(item.title || "Untitled wheel")}</span>
              <span class="wheel-list-card__meta">${escapeHtml(item.default_display_mode || "wheel")} default · ${escapeHtml(String((item.entries || []).length))} entries</span>
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
      })
      .join("");
  }

  function renderEntries() {
    return state.draft.entries
      .map((entry, index) => `
        <div class="wheel-entry-row">
          <div class="wheel-entry-row__inputs">
            <input class="account-field-input" type="text" value="${escapeHtml(entry.label)}" data-entry-index="${index}" data-entry-field="label" placeholder="Entry label" />
            <input class="account-field-input wheel-entry-row__weight" type="number" min="1" step="0.1" value="${escapeHtml(String(entry.weight))}" data-entry-index="${index}" data-entry-field="weight" />
            <input class="wheel-color-input" type="color" value="${escapeHtml(entry.color)}" data-entry-index="${index}" data-entry-field="color" />
          </div>
          <div class="wheel-entry-row__actions">
            <button class="creator-button subtle" type="button" data-action="move-entry-up" data-entry-index="${index}" ${index === 0 ? "disabled" : ""}>Up</button>
            <button class="creator-button subtle" type="button" data-action="move-entry-down" data-entry-index="${index}" ${index === state.draft.entries.length - 1 ? "disabled" : ""}>Down</button>
            <button class="creator-button subtle danger" type="button" data-action="remove-entry" data-entry-index="${index}" ${state.draft.entries.length <= 1 ? "disabled" : ""}>Remove</button>
          </div>
        </div>
      `)
      .join("");
  }

  function renderPaletteInputs() {
    return (state.draft.palette.segment_colors || [])
      .map((color, index) => `
        <label class="wheel-palette-chip">
          <span>Color ${index + 1}</span>
          <input type="color" value="${escapeHtml(color)}" data-palette-index="${index}" />
          <button class="creator-button subtle danger" type="button" data-action="remove-palette-color" data-palette-index="${index}" ${(state.draft.palette.segment_colors || []).length <= 2 ? "disabled" : ""}>−</button>
        </label>
      `)
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
              <p class="muted">Livechat auto-entry, automation rules, winner history, and economy behavior are intentionally not active on this route yet.</p>
            </div>
          </section>
        </aside>

        <div class="wheel-manager-main">
          <section class="ss-panel wheel-editor-panel">
            <header class="ss-panel-header">
              <div>
                <h3>${escapeHtml(state.draft.title || "Untitled wheel")}</h3>
                <p class="muted">${selected ? `Editing ${escapeHtml(selected.slug || selected.artifact_code || "")}` : "New unsaved wheel artifact"}</p>
              </div>
              <div class="wheel-toolbar">
                <span class="wheel-dirty-pill" data-wheel-dirty="true"></span>
                <button class="creator-button secondary" type="button" data-action="export-wheel" ${state.selectedCode ? "" : "disabled"}>${state.exporting ? "Exporting…" : "Export"}</button>
                <button class="creator-button primary" type="button" data-action="save-wheel">${state.saving ? "Saving…" : "Save"}</button>
              </div>
            </header>
            <div class="ss-panel-body">
              <div class="wheel-status" data-wheel-status="true"></div>
              <div class="wheel-editor-grid">
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
                  <h4>Behavior</h4>
                  <label class="account-field-label">Default public layout</label>
                  <select class="account-field-input" data-field="default_display_mode">
                    <option value="wheel" ${state.draft.default_display_mode === "wheel" ? "selected" : ""}>Wheel</option>
                    <option value="scoreboard" ${state.draft.default_display_mode === "scoreboard" ? "selected" : ""}>Scoreboard</option>
                  </select>
                  <label class="wheel-toggle-row">
                    <input type="checkbox" data-field="allow_duplicates" ${state.draft.allow_duplicates ? "checked" : ""} />
                    <span>Allow duplicate winners</span>
                  </label>
                  <label class="wheel-toggle-row">
                    <input type="checkbox" data-field="auto_remove_winner" ${state.draft.auto_remove_winner ? "checked" : ""} />
                    <span>Auto-remove winner after a spin</span>
                  </label>
                  <label class="wheel-toggle-row">
                    <input type="checkbox" data-field="presentation.animation_enabled" ${state.draft.presentation.animation_enabled ? "checked" : ""} />
                    <span>Animate spins</span>
                  </label>
                  <label class="wheel-toggle-row">
                    <input type="checkbox" data-field="presentation.sound_enabled" ${state.draft.presentation.sound_enabled ? "checked" : ""} />
                    <span>Enable sound cues</span>
                  </label>
                  <label class="wheel-toggle-row">
                    <input type="checkbox" data-field="presentation.confetti_enabled" ${state.draft.presentation.confetti_enabled ? "checked" : ""} />
                    <span>Enable celebration accent</span>
                  </label>
                  <label class="wheel-toggle-row">
                    <input type="checkbox" data-field="presentation.show_entry_labels" ${state.draft.presentation.show_entry_labels ? "checked" : ""} />
                    <span>Show entry labels inside the wheel</span>
                  </label>
                </section>

                <section class="wheel-form-section">
                  <h4>Presentation tuning</h4>
                  <label class="account-field-label">Spin duration (ms)</label>
                  <input class="account-field-input" type="number" min="2000" max="60000" step="100" value="${escapeHtml(String(state.draft.presentation.spin_duration_ms))}" data-field="presentation.spin_duration_ms" />
                  <label class="account-field-label">Scoreboard row limit</label>
                  <input class="account-field-input" type="number" min="3" max="100" step="1" value="${escapeHtml(String(state.draft.presentation.scoreboard_max_rows))}" data-field="presentation.scoreboard_max_rows" />
                  <div class="wheel-color-grid">
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
                  </div>
                </section>
              </div>
            </div>
          </section>

          <section class="ss-panel wheel-editor-panel">
            <header class="ss-panel-header">
              <div>
                <h3>Entries</h3>
                <p class="muted">Manual labels, weights, and colors are persisted per artifact. Winner history is not stored or implied here.</p>
              </div>
              <div class="wheel-panel-actions">
                <button class="creator-button secondary" type="button" data-action="add-entry">Add entry</button>
              </div>
            </header>
            <div class="ss-panel-body wheel-entry-stack">
              ${renderEntries()}
            </div>
          </section>

          <section class="ss-panel wheel-editor-panel">
            <header class="ss-panel-header">
              <div>
                <h3>Palette</h3>
                <p class="muted">A restrained practical segment palette for both wheel and scoreboard views.</p>
              </div>
              <div class="wheel-panel-actions">
                <button class="creator-button secondary" type="button" data-action="add-palette-color" ${(state.draft.palette.segment_colors || []).length >= 12 ? "disabled" : ""}>Add color</button>
              </div>
            </header>
            <div class="ss-panel-body wheel-palette-grid">
              ${renderPaletteInputs()}
            </div>
          </section>

          ${renderUnsupportedImportBlock()}
        </div>
      </div>
    `;
    updateToolbarState();
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

  function moveEntry(index, direction) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= state.draft.entries.length) return;
    const [entry] = state.draft.entries.splice(index, 1);
    state.draft.entries.splice(nextIndex, 0, entry);
    render();
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
        if (!state.draft.entries.length) state.draft.entries.push(createEntry(0));
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
        if (!Number.isFinite(index) || !state.draft.entries[index]) return;
        state.draft.entries[index][field] =
          field === "weight"
            ? Math.max(1, Number(input.value) || 1)
            : String(input.value || "");
        updateToolbarState();
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
        const value =
          input instanceof HTMLInputElement && input.type === "checkbox"
            ? input.checked
            : input instanceof HTMLInputElement && input.type === "number"
              ? Number(input.value)
              : input.value;
        setNestedField(field, value);
        updateToolbarState();
      }
    });

    state.root.addEventListener("input", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.matches("[data-wheel-import-text='true']")) {
        state.importText = target.value || "";
        updateToolbarState();
      }
    });
  }

  async function init() {
    state.root = document.querySelector("[data-wheel-manager='true']");
    if (!(state.root instanceof HTMLElement)) return;
    bindEvents();
    setDraft(createBlankDraft());
    render();
    await loadWheels();
  }

  function destroy() {
    state.root = null;
    state.items = [];
    state.selectedCode = "";
    state.draft = null;
    state.baseline = "";
    state.status = "";
    state.error = "";
    state.importText = "";
    state.importFile = null;
  }

  window.WheelsView = { init, destroy };
})();
