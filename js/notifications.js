(() => {
  "use strict";

  const PREVIEW_LIMIT = 5;
  const DROPDOWN_REFRESH_DEBOUNCE_MS = 15000;
  const VIEW_REFRESH_DEBOUNCE_MS = 5000;
  const BACKGROUND_REFRESH_INTERVAL_MS = 90000;
  const BACKGROUND_REFRESH_MIN_INTERVAL_MS = 60000;

  const topbar = {
    root: null,
    toggle: null,
    badge: null,
    dropdown: null,
    list: null,
    markAll: null,
    viewAll: null
  };

  const center = {
    root: null,
    count: null,
    unread: null,
    filterStatus: null,
    filterSearch: null,
    markAll: null,
    list: null,
    empty: null,
    muteAll: null,
    muteTypes: null
  };

  const state = {
    topbarBound: false,
    centerBound: false,
    authRefreshBound: false,
    backgroundRefreshBound: false,
    centerFilters: {
      status: "all",
      query: ""
    },
    lastDropdownRefreshAt: 0
  };

  function getStore() {
    return window.StreamSuitesCreatorNotificationsStore || null;
  }

  function getStoreItems(store) {
    if (!store) return [];
    if (typeof store.getItems === "function") {
      return store.getItems();
    }
    return typeof store.getNotifications === "function" ? store.getNotifications() : [];
  }

  function isSessionAuthenticated() {
    return window.App?.session?.authenticated === true;
  }

  function requestRefresh(options = {}) {
    const store = getStore();
    if (!store || typeof store.refresh !== "function") return Promise.resolve([]);
    return store.refresh(options).catch(() => []);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeRoute(routeLike) {
    if (typeof routeLike !== "string") return "";
    return routeLike
      .trim()
      .replace(/^#+/, "")
      .replace(/^\/+/, "")
      .toLowerCase();
  }

  function formatTimeLabel(timestamp, timestampMs) {
    if (!timestamp || !timestampMs) return "Unknown time";
    const elapsed = Date.now() - timestampMs;
    if (elapsed >= 0 && elapsed < 60 * 1000) return "Just now";
    if (elapsed >= 0 && elapsed < 60 * 60 * 1000) {
      return `${Math.max(1, Math.floor(elapsed / (60 * 1000)))}m ago`;
    }
    if (elapsed >= 0 && elapsed < 24 * 60 * 60 * 1000) {
      return `${Math.max(1, Math.floor(elapsed / (60 * 60 * 1000)))}h ago`;
    }
    if (elapsed >= 0 && elapsed < 7 * 24 * 60 * 60 * 1000) {
      return `${Math.max(1, Math.floor(elapsed / (24 * 60 * 60 * 1000)))}d ago`;
    }
    try {
      return new Date(timestamp).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch (err) {
      return "Unknown time";
    }
  }

  function navigateToTarget(target) {
    const normalized = typeof target === "string" ? target.trim() : "";
    if (!normalized) {
      window.location.hash = "#notifications";
      return;
    }
    if (normalized.startsWith("#")) {
      window.location.hash = normalized;
      return;
    }
    if (normalized.startsWith("/")) {
      window.location.assign(normalized);
      return;
    }
    window.location.hash = `#${normalizeRoute(normalized)}`;
  }

  function formatBadgeCount(unreadCount) {
    if (unreadCount <= 0) return "";
    return unreadCount > 99 ? "99+" : String(unreadCount);
  }

  function cacheTopbarElements() {
    topbar.root = document.querySelector("[data-creator-notifications-widget]");
    topbar.toggle = document.getElementById("creator-notifications-toggle");
    topbar.badge = document.getElementById("creator-notifications-badge");
    topbar.dropdown = document.getElementById("creator-notifications-dropdown");
    topbar.list = document.getElementById("creator-notifications-list");
    topbar.markAll = document.getElementById("creator-notifications-mark-all");
    topbar.viewAll = document.getElementById("creator-notifications-view-all");
    return Boolean(
      topbar.root &&
        topbar.toggle &&
        topbar.badge &&
        topbar.dropdown &&
        topbar.list &&
        topbar.markAll &&
        topbar.viewAll
    );
  }

  function isDropdownOpen() {
    return Boolean(topbar.dropdown && !topbar.dropdown.classList.contains("hidden"));
  }

  function setDropdownOpen(open) {
    if (!topbar.dropdown || !topbar.toggle) return;
    topbar.dropdown.classList.toggle("hidden", !open);
    topbar.toggle.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function getPreviewItems() {
    const store = getStore();
    if (!store) return [];
    return store
      .getItems()
      .filter((item) => !store.isMuted(item))
      .slice(0, PREVIEW_LIMIT);
  }

  function renderTopbarBadge() {
    const store = getStore();
    if (!store || !topbar.badge || !topbar.toggle) return;
    const unread = store.getUnreadCount();
    const visible = unread > 0;
    topbar.badge.classList.toggle("hidden", !visible);
    topbar.badge.textContent = visible ? formatBadgeCount(unread) : "";
    topbar.toggle.setAttribute(
      "aria-label",
      visible ? `Open notifications (${unread} unread)` : "Open notifications"
    );
    topbar.markAll.disabled = unread <= 0;
  }

  function renderTopbarList() {
    const store = getStore();
    if (!store || !topbar.list) return;

    const previewItems = getPreviewItems();
    if (!previewItems.length) {
      const refreshing = typeof store.isRefreshing === "function" && store.isRefreshing();
      topbar.list.innerHTML = refreshing
        ? '<div class="creator-notifications-empty muted">Refreshing...</div>'
        : '<div class="creator-notifications-empty">No notifications.</div>';
      return;
    }

    topbar.list.innerHTML = previewItems
      .map((item) => {
        const read = store.isRead(item);
        const title = escapeHtml(item.title);
        const snippet = escapeHtml(item.snippet || "");
        const timestamp = escapeHtml(formatTimeLabel(item.timestamp, item.timestampMs));
        const statusClass = read ? "is-read" : "is-unread";

        return `
          <button
            type="button"
            class="creator-notification-item ${statusClass}"
            data-notification-id="${escapeHtml(item.id)}"
            data-notification-link="${escapeHtml(item.link || "")}"
          >
            <div class="creator-notification-topline">
              <span class="creator-notification-title">${title}</span>
              <span class="creator-notification-unread-dot ${read ? "hidden" : ""}" aria-hidden="true"></span>
            </div>
            <p class="creator-notification-snippet">${snippet}</p>
            <span class="creator-notification-time">${timestamp}</span>
          </button>
        `;
      })
      .join("");
  }

  function renderTopbar() {
    if (!cacheTopbarElements()) return;
    renderTopbarBadge();
    renderTopbarList();
  }

  function cacheCenterElements() {
    center.root = document.getElementById("creator-notifications-center-root");
    center.count = document.getElementById("creator-notifications-center-count");
    center.unread = document.getElementById("creator-notifications-center-unread");
    center.filterStatus = document.getElementById("creator-notifications-filter-status");
    center.filterSearch = document.getElementById("creator-notifications-filter-search");
    center.markAll = document.getElementById("creator-notifications-center-mark-all");
    center.list = document.getElementById("creator-notifications-center-list");
    center.empty = document.getElementById("creator-notifications-center-empty");
    center.muteAll = document.getElementById("creator-notifications-mute-all");
    center.muteTypes = document.getElementById("creator-notifications-mute-types");

    return Boolean(
      center.root &&
        center.count &&
        center.unread &&
        center.filterStatus &&
        center.filterSearch &&
        center.markAll &&
        center.list &&
        center.empty &&
        center.muteAll &&
        center.muteTypes
    );
  }

  function getFilteredCenterItems() {
    const store = getStore();
    if (!store) return [];
    const query = state.centerFilters.query.trim().toLowerCase();
    return getStoreItems(store).filter((item) => {
      const read = store.isRead(item);
      if (state.centerFilters.status === "unread" && read) return false;
      if (state.centerFilters.status === "read" && !read) return false;
      if (!query) return true;
      const haystack = `${item.title} ${item.snippet}`.toLowerCase();
      return haystack.includes(query);
    });
  }

  function renderMuteTypeChecklist() {
    const store = getStore();
    if (!store || !center.muteTypes) return;
    const types = store.getTypes();
    const muted = new Set(store.getMutedState().types);
    if (!types.length) {
      center.muteTypes.innerHTML = '<p class="muted">No notification types available.</p>';
      return;
    }
    center.muteTypes.innerHTML = types
      .map((type) => {
        const checked = muted.has(type) ? "checked" : "";
        const label = `${type.charAt(0).toUpperCase()}${type.slice(1)}`;
        return `
          <label class="creator-notifications-setting-toggle small">
            <input type="checkbox" data-mute-type="${escapeHtml(type)}" ${checked} />
            <span>${escapeHtml(label)}</span>
          </label>
        `;
      })
      .join("");
  }

  function renderCenterList() {
    const store = getStore();
    if (!store || !center.list || !center.empty) return;

    const items = getFilteredCenterItems();
    const allItems = getStoreItems(store);
    if (!items.length) {
      center.list.innerHTML = "";
      center.empty.classList.remove("hidden");
      const emptyTitle = center.empty.querySelector("h3");
      const emptyText = center.empty.querySelector("p.muted");
      const notes = typeof store.getNotes === "function" ? store.getNotes() : [];
      const notesText = notes.length ? notes.join(" ") : "";

      if (!allItems.length) {
        if (emptyTitle) emptyTitle.textContent = "No notifications";
        if (emptyText) {
          emptyText.textContent = "You're all caught up.";
        }
      } else {
        if (emptyTitle) emptyTitle.textContent = "Nothing to show right now";
        if (emptyText) {
          emptyText.textContent =
            "Try a different filter or search phrase, or unmute notification types in settings.";
        }
      }

      let notesElement = document.getElementById("creator-notifications-center-note");
      if (!notesElement) {
        notesElement = document.createElement("p");
        notesElement.id = "creator-notifications-center-note";
        notesElement.className = "muted hidden";
        center.empty.appendChild(notesElement);
      }
      if (!allItems.length && notesText) {
        notesElement.textContent = notesText;
        notesElement.classList.remove("hidden");
      } else {
        notesElement.textContent = "";
        notesElement.classList.add("hidden");
      }
      return;
    }

    center.empty.classList.add("hidden");
    center.list.innerHTML = items
      .map((item) => {
        const read = store.isRead(item);
        const muted = store.isMuted(item);
        const classes = ["creator-notifications-center-item"];
        classes.push(read ? "is-read" : "is-unread");
        if (muted) classes.push("is-muted");

        const typeLabel = `${item.type.charAt(0).toUpperCase()}${item.type.slice(1)}`;
        const timestamp = escapeHtml(formatTimeLabel(item.timestamp, item.timestampMs));
        const linkAction = item.link
          ? `<button type="button" class="ss-btn ss-btn-secondary ss-btn-small" data-action="open" data-link="${escapeHtml(
              item.link
            )}" data-notification-id="${escapeHtml(item.id)}">Open</button>`
          : "";

        return `
          <article class="${classes.join(" ")}" data-notification-id="${escapeHtml(item.id)}">
            <div class="creator-notifications-center-indicator" aria-hidden="true"></div>
            <div class="creator-notifications-center-content">
              <div class="creator-notifications-center-title-row">
                <h3>${escapeHtml(item.title)}</h3>
                <div class="creator-notifications-center-chips">
                  <span class="ss-chip creator-notifications-type-chip">${escapeHtml(typeLabel)}</span>
                  ${muted ? '<span class="ss-chip creator-notifications-muted-chip">Muted</span>' : ""}
                </div>
              </div>
              <p>${escapeHtml(item.snippet || "No summary available.")}</p>
              <span class="creator-notifications-center-meta">${timestamp}</span>
            </div>
            <div class="creator-notifications-center-actions">
              <button
                type="button"
                class="ss-btn ss-btn-secondary ss-btn-small"
                data-action="toggle-read"
                data-notification-id="${escapeHtml(item.id)}"
              >
                ${read ? "Mark unread" : "Mark read"}
              </button>
              ${linkAction}
            </div>
          </article>
        `;
      })
      .join("");
  }

  function renderCenter() {
    const store = getStore();
    if (!store || !cacheCenterElements()) return;

    const unread = store.getUnreadCount();
    center.count.textContent = `${getStoreItems(store).length} total`;
    center.unread.textContent = `${unread} unread`;
    center.markAll.disabled = unread <= 0;
    center.filterStatus.value = state.centerFilters.status;
    center.filterSearch.value = state.centerFilters.query;
    center.muteAll.checked = store.getMutedState().all;

    renderMuteTypeChecklist();
    renderCenterList();
  }

  function renderAll() {
    renderTopbar();
    renderCenter();
  }

  function handleTopbarClick(event) {
    const store = getStore();
    if (!store) return;

    const notificationButton = event.target.closest(".creator-notification-item");
    if (!(notificationButton instanceof HTMLElement)) return;

    const id = notificationButton.dataset.notificationId || "";
    const link = notificationButton.dataset.notificationLink || "";
    if (id) store.markRead(id);
    setDropdownOpen(false);
    navigateToTarget(link || "#notifications");
  }

  function bindTopbarEvents() {
    const store = getStore();
    if (!store || !cacheTopbarElements() || state.topbarBound) return;
    state.topbarBound = true;

    topbar.toggle.addEventListener("click", () => {
      const nextOpen = !isDropdownOpen();
      setDropdownOpen(nextOpen);
      if (nextOpen) {
        const now = Date.now();
        if (now - state.lastDropdownRefreshAt >= DROPDOWN_REFRESH_DEBOUNCE_MS) {
          state.lastDropdownRefreshAt = now;
          void requestRefresh({ minIntervalMs: DROPDOWN_REFRESH_DEBOUNCE_MS });
        }
        renderTopbarList();
      }
    });

    topbar.list.addEventListener("click", handleTopbarClick);

    topbar.markAll.addEventListener("click", () => {
      store.markAllRead();
    });

    topbar.viewAll.addEventListener("click", () => {
      setDropdownOpen(false);
    });

    document.addEventListener("click", (event) => {
      if (!isDropdownOpen()) return;
      if (topbar.root && topbar.root.contains(event.target)) return;
      setDropdownOpen(false);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      setDropdownOpen(false);
    });

    window.addEventListener("hashchange", () => {
      setDropdownOpen(false);
    });

    window.addEventListener(store.UPDATE_EVENT, renderAll);
  }

  function handleCenterListClick(event) {
    const store = getStore();
    if (!store) return;

    const actionButton = event.target.closest("[data-action]");
    if (actionButton instanceof HTMLElement) {
      const action = actionButton.dataset.action || "";
      const id = actionButton.dataset.notificationId || "";
      if (action === "toggle-read") {
        store.toggleRead(id);
        return;
      }
      if (action === "open") {
        if (id) store.markRead(id);
        navigateToTarget(actionButton.dataset.link || "");
      }
      return;
    }

    const row = event.target.closest(".creator-notifications-center-item");
    if (!(row instanceof HTMLElement)) return;
    const id = row.dataset.notificationId || "";
    if (id) store.toggleRead(id);
  }

  function bindCenterEvents() {
    const store = getStore();
    if (!store || !cacheCenterElements() || state.centerBound) return;
    state.centerBound = true;

    center.filterStatus.addEventListener("change", () => {
      state.centerFilters.status = center.filterStatus.value || "all";
      renderCenter();
    });

    center.filterSearch.addEventListener("input", () => {
      state.centerFilters.query = center.filterSearch.value || "";
      renderCenter();
    });

    center.markAll.addEventListener("click", () => {
      store.markAllRead();
    });

    center.muteAll.addEventListener("change", () => {
      store.setMuted("all", center.muteAll.checked);
    });

    center.muteTypes.addEventListener("change", (event) => {
      const checkbox = event.target.closest("[data-mute-type]");
      if (!(checkbox instanceof HTMLInputElement)) return;
      const type = checkbox.dataset.muteType || "";
      if (type) {
        store.setMuted(type, checkbox.checked);
      }
    });

    center.list.addEventListener("click", handleCenterListClick);
  }

  function destroyCenter() {
    state.centerBound = false;
    center.root = null;
    center.count = null;
    center.unread = null;
    center.filterStatus = null;
    center.filterSearch = null;
    center.markAll = null;
    center.list = null;
    center.empty = null;
    center.muteAll = null;
    center.muteTypes = null;
  }

  function initTopbar() {
    bindTopbarEvents();
    if (isSessionAuthenticated()) {
      void requestRefresh({ minIntervalMs: VIEW_REFRESH_DEBOUNCE_MS });
    }
    renderTopbar();
  }

  function bindAuthHydrationRefresh() {
    if (state.authRefreshBound) return;
    state.authRefreshBound = true;

    window.addEventListener("streamsuites:auth-init-complete", () => {
      if (!isSessionAuthenticated()) return;
      void requestRefresh({ force: true });
    });
  }

  function bindBackgroundRefresh() {
    if (state.backgroundRefreshBound) return;
    state.backgroundRefreshBound = true;

    window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (!isSessionAuthenticated()) return;
      void requestRefresh({ minIntervalMs: BACKGROUND_REFRESH_MIN_INTERVAL_MS });
    }, BACKGROUND_REFRESH_INTERVAL_MS);
  }

  function initCenter() {
    bindCenterEvents();
    if (isSessionAuthenticated()) {
      void requestRefresh({ minIntervalMs: VIEW_REFRESH_DEBOUNCE_MS });
    }
    renderCenter();
  }

  function initNotificationsView() {
    initTopbar();
    initCenter();
  }

  function autoInitWhenPresent() {
    if (!document.querySelector("[data-creator-notifications-widget]")) return;
    bindAuthHydrationRefresh();
    bindBackgroundRefresh();
    initTopbar();
  }

  window.NotificationsView = {
    init: initNotificationsView,
    destroy: destroyCenter
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoInitWhenPresent, { once: true });
  } else {
    autoInitWhenPresent();
  }
})();
