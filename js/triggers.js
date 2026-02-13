(() => {
  "use strict";

  const platforms = [
    { key: "rumble", label: "Rumble", status: "Live" },
    { key: "youtube", label: "YouTube", status: "Live" },
    { key: "twitch", label: "Twitch", status: "Live" },
    { key: "kick", label: "Kick", status: "Staged" },
    { key: "pilled", label: "Pilled", status: "Coming soon", disabled: true }
  ];

  const triggers = [
    {
      id: "welcome-pulse",
      name: "Welcome Pulse",
      description: "Greet first-time chatters with a quick on-screen pulse.",
      defaultEnabled: true,
      platformDefaults: { kick: false, pilled: false }
    },
    {
      id: "clip-drop-ready",
      name: "Clip Drop Ready",
      description: "Alert when a clip package is ready to publish.",
      defaultEnabled: true,
      platformDefaults: { kick: false, pilled: false }
    },
    {
      id: "shoutout-spotlight",
      name: "Shoutout Spotlight",
      description: "Highlight creator-approved shoutouts in chat.",
      defaultEnabled: false,
      platformDefaults: { twitch: true }
    },
    {
      id: "poll-boost",
      name: "Poll Boost",
      description: "Remind chat to vote during active polls.",
      defaultEnabled: true,
      platformDefaults: { rumble: false, pilled: false }
    },
    {
      id: "hype-train",
      name: "Hype Train",
      description: "Trigger a celebratory overlay when chat spikes.",
      defaultEnabled: false,
      platformDefaults: { youtube: true, twitch: true }
    },
    {
      id: "mod-signal",
      name: "Moderator Signal",
      description: "Surface a discreet cue for your mod team.",
      defaultEnabled: true,
      platformDefaults: { kick: false, pilled: false }
    }
  ];

  const state = {
    initialized: false,
    base: {},
    current: {},
    updatedAt: null,
    listEl: null,
    statusEl: null,
    updatedEl: null,
    countEl: null,
    resetBtn: null,
    onListChange: null,
    onResetClick: null
  };

  function formatTimestamp(value) {
    if (!value) return "Not updated yet";
    try {
      return value.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch (err) {
      return value.toString();
    }
  }

  function cacheElements(root = document) {
    state.listEl = root.querySelector("[data-trigger-list]");
    state.statusEl = root.querySelector("[data-trigger-status]");
    state.updatedEl = root.querySelector("[data-trigger-updated]");
    state.countEl = root.querySelector("[data-trigger-count]");
    state.resetBtn = root.querySelector("[data-trigger-reset]");
  }

  function buildInitialState() {
    state.base = {};
    state.current = {};
    state.updatedAt = null;

    triggers.forEach((trigger) => {
      const platformState = {};
      platforms.forEach((platform) => {
        let value = trigger.defaultEnabled === true;
        if (trigger.platformDefaults && platform.key in trigger.platformDefaults) {
          value = trigger.platformDefaults[platform.key] === true;
        }
        platformState[platform.key] = value;
      });
      state.base[trigger.id] = platformState;
      state.current[trigger.id] = { ...platformState };
    });
  }

  function countTriggerChanges(triggerId) {
    const base = state.base[triggerId] || {};
    const current = state.current[triggerId] || {};
    return Object.keys(base).reduce((count, platformKey) => {
      return count + (base[platformKey] !== current[platformKey] ? 1 : 0);
    }, 0);
  }

  function countTotalChanges() {
    return triggers.reduce((total, trigger) => total + countTriggerChanges(trigger.id), 0);
  }

  function updateStatus() {
    const totalChanges = countTotalChanges();
    if (state.statusEl) {
      state.statusEl.textContent =
        totalChanges === 0
          ? "No preview changes"
          : `${totalChanges} change${totalChanges === 1 ? "" : "s"} staged`;
      state.statusEl.classList.toggle("warning", totalChanges > 0);
      state.statusEl.classList.toggle("subtle", totalChanges === 0);
    }

    if (state.updatedEl) {
      state.updatedEl.textContent = formatTimestamp(state.updatedAt);
    }

    if (!state.listEl) return;
    triggers.forEach((trigger) => {
      const changeCount = countTriggerChanges(trigger.id);
      const card = state.listEl.querySelector(`[data-trigger-card="${trigger.id}"]`);
      const changeEl = state.listEl.querySelector(`[data-trigger-change="${trigger.id}"]`);
      if (card) {
        card.classList.toggle("is-changed", changeCount > 0);
      }
      if (changeEl) {
        changeEl.textContent =
          changeCount === 0 ? "No changes" : `${changeCount} change${changeCount === 1 ? "" : "s"}`;
      }
    });
  }

  function handleToggle(input) {
    const triggerId = input.getAttribute("data-trigger-id");
    const platformKey = input.getAttribute("data-platform");
    if (!triggerId || !platformKey) return;

    if (!state.current[triggerId]) {
      state.current[triggerId] = {};
    }
    state.current[triggerId][platformKey] = input.checked === true;
    state.updatedAt = new Date();
    updateStatus();
  }

  function renderTriggerCard(trigger) {
    const defaultLabel = trigger.defaultEnabled ? "Default on" : "Default off";

    const platformToggles = platforms
      .map((platform) => {
        const isChecked = state.current[trigger.id]?.[platform.key] === true;
        const isDisabled = platform.disabled === true;
        const statusBadge = platform.status
          ? `<span class="trigger-platform-badge">${platform.status}</span>`
          : "";

        return `
          <label class="trigger-toggle${isDisabled ? " is-disabled" : ""}">
            <input
              type="checkbox"
              data-trigger-id="${trigger.id}"
              data-platform="${platform.key}"
              ${isChecked ? "checked" : ""}
              ${isDisabled ? "disabled" : ""}
            />
            <span class="trigger-switch"></span>
            <span class="trigger-label">${platform.label}</span>
            ${statusBadge}
          </label>
        `;
      })
      .join("");

    return `
      <article class="trigger-card" data-trigger-card="${trigger.id}">
        <div class="trigger-card-header">
          <div>
            <h3 class="trigger-card-title">${trigger.name}</h3>
            <p>${trigger.description}</p>
          </div>
          <div class="trigger-card-meta">
            <span class="status-pill subtle">${defaultLabel}</span>
            <span class="status-pill subtle" data-trigger-change="${trigger.id}">No changes</span>
          </div>
        </div>
        <div class="trigger-platform-grid">
          ${platformToggles}
        </div>
      </article>
    `;
  }

  function render() {
    if (!state.listEl) return;
    if (state.countEl) {
      state.countEl.textContent = String(triggers.length);
    }
    state.listEl.innerHTML = triggers.map(renderTriggerCard).join("");
    updateStatus();
  }

  function bindEvents() {
    if (!state.listEl) return;

    state.onListChange = (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (!target.matches("input[data-trigger-id][data-platform]")) return;
      if (target.disabled) return;
      handleToggle(target);
    };
    state.listEl.addEventListener("change", state.onListChange);

    if (state.resetBtn) {
      state.onResetClick = () => {
        triggers.forEach((trigger) => {
          state.current[trigger.id] = { ...state.base[trigger.id] };
        });
        state.updatedAt = new Date();
        render();
      };
      state.resetBtn.addEventListener("click", state.onResetClick);
    }
  }

  function destroy() {
    if (state.listEl && state.onListChange) {
      state.listEl.removeEventListener("change", state.onListChange);
    }
    if (state.resetBtn && state.onResetClick) {
      state.resetBtn.removeEventListener("click", state.onResetClick);
    }

    state.initialized = false;
    state.onListChange = null;
    state.onResetClick = null;
    state.listEl = null;
    state.statusEl = null;
    state.updatedEl = null;
    state.countEl = null;
    state.resetBtn = null;
    state.base = {};
    state.current = {};
    state.updatedAt = null;
  }

  function init(root = document) {
    destroy();
    cacheElements(root);
    if (!state.listEl) return;

    buildInitialState();
    render();
    bindEvents();
    state.initialized = true;
  }

  window.TriggersView = {
    init,
    destroy
  };

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        init(document);
      },
      { once: true }
    );
  } else {
    init(document);
  }
})();
