(() => {
  "use strict";

  const API_BASE_URL = "https://api.streamsuites.app";
  const NOTIFICATIONS_PATH = "/api/creator/notifications";
  const DEFAULT_REFRESH_LIMIT = 25;
  const DEFAULT_REFRESH_TIMEOUT_MS = 8000;

  const MUTED_STORAGE_KEY = "ss_creator_notifications_muted";
  const UPDATE_EVENT = "streamsuites:notifications-updated";
  const LEGACY_UPDATE_EVENT = "ss:creator-notifications-updated";

  const state = {
    notifications: [],
    muted: {
      all: false,
      types: new Set()
    },
    source: "idle",
    notes: [],
    nextCursor: "",
    isRefreshing: false,
    isMutating: false,
    lastRefreshAt: 0,
    lastError: null,
    lastReason: ""
  };
  let refreshPromise = null;

  function safeParse(raw) {
    if (typeof raw !== "string" || !raw.trim()) return null;
    try {
      return JSON.parse(raw);
    } catch (err) {
      return null;
    }
  }

  function normalizeType(value) {
    return typeof value === "string" && value.trim() ? value.trim().toLowerCase() : "system";
  }

  function normalizeText(value, fallback = "") {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
    return fallback;
  }

  function normalizeMeta(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    return { ...value };
  }

  function normalizeTimestamp(value) {
    if (!(typeof value === "string" || typeof value === "number")) return { iso: "", ms: 0 };
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return { iso: "", ms: 0 };
    return {
      iso: parsed.toISOString(),
      ms: parsed.getTime()
    };
  }

  function normalizeNotification(item, index, origin = "seed") {
    if (!item || typeof item !== "object") return null;
    const id =
      typeof item.id === "string" && item.id.trim()
        ? item.id.trim()
        : `${origin}-notification-${index + 1}`;
    const when = normalizeTimestamp(
      item.timestamp || item.time || item.created_at || item.createdAt || item.updated_at || item.updatedAt
    );
    const readAt = normalizeTimestamp(item.read_at || item.readAt || "");

    return {
      id,
      type: normalizeType(item.type),
      title: normalizeText(item.title, "Untitled notification"),
      snippet: normalizeText(item.snippet || item.message || item.summary || item.body, ""),
      timestamp: when.iso,
      timestampMs: when.ms,
      readAt: readAt.iso,
      isRead: item.is_read === true || item.isRead === true || Boolean(readAt.iso),
      link: normalizeText(item.link || item.href || item.url || "", ""),
      severity: normalizeText(item.severity || item.level || "", ""),
      meta: normalizeMeta(item.meta)
    };
  }

  function sortNotifications(list) {
    return list.slice().sort((left, right) => {
      if (right.timestampMs !== left.timestampMs) return right.timestampMs - left.timestampMs;
      return String(right.id).localeCompare(String(left.id));
    });
  }

  function persistMuted() {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(
        MUTED_STORAGE_KEY,
        JSON.stringify({
          all: state.muted.all,
          types: Array.from(state.muted.types)
        })
      );
    } catch (err) {
      // Ignore persistence failures.
    }
  }

  function loadMuted() {
    if (typeof localStorage === "undefined") return;
    const parsed = safeParse(localStorage.getItem(MUTED_STORAGE_KEY));
    if (!parsed || typeof parsed !== "object") return;
    state.muted.all = parsed.all === true;
    if (Array.isArray(parsed.types)) {
      state.muted.types = new Set(
        parsed.types
          .map((entry) => (typeof entry === "string" ? entry.trim().toLowerCase() : ""))
          .filter(Boolean)
      );
    }
  }

  function getUnreadCount() {
    return state.notifications.reduce((count, item) => {
      if (item.isRead) return count;
      if (isMuted(item)) return count;
      return count + 1;
    }, 0);
  }

  function emitUpdate() {
    const detail = {
      total: state.notifications.length,
      unread: getUnreadCount(),
      source: state.source,
      refreshing: state.isRefreshing,
      mutating: state.isMutating,
      lastRefreshAt: state.lastRefreshAt,
      lastError: state.lastError
    };

    try {
      window.dispatchEvent(new CustomEvent(UPDATE_EVENT, { detail }));
    } catch (err) {
      // Ignore event dispatch failures.
    }

    try {
      window.dispatchEvent(new CustomEvent(LEGACY_UPDATE_EVENT, { detail }));
    } catch (err) {
      // Ignore legacy event dispatch failures.
    }
  }

  function getItems() {
    return sortNotifications(state.notifications).map((item) => ({ ...item }));
  }

  function getNotifications() {
    return getItems();
  }

  function getNotificationById(id) {
    if (typeof id !== "string" || !id.trim()) return null;
    return state.notifications.find((item) => item.id === id.trim()) || null;
  }

  function isRead(itemOrId) {
    const item =
      typeof itemOrId === "string" ? getNotificationById(itemOrId) : itemOrId && typeof itemOrId === "object" ? itemOrId : null;
    return Boolean(item && item.isRead === true);
  }

  function isMuted(item) {
    if (!item || typeof item !== "object") return state.muted.all;
    const itemType = normalizeType(item.type);
    return state.muted.all || state.muted.types.has(itemType);
  }

  function getSource() {
    return state.source;
  }

  function getNotes() {
    return state.notes.slice();
  }

  function getStatus() {
    return {
      source: state.source,
      lastRefreshAt: state.lastRefreshAt,
      isRefreshing: state.isRefreshing,
      isMutating: state.isMutating,
      lastError: state.lastError ? { ...state.lastError } : null,
      notes: state.notes.slice(),
      nextCursor: state.nextCursor
    };
  }

  function isRefreshing() {
    return state.isRefreshing;
  }

  function updateLocalReadState(ids, read, readAt = "") {
    const normalizedIds = new Set(
      (Array.isArray(ids) ? ids : [])
        .map((id) => (typeof id === "string" ? id.trim() : ""))
        .filter(Boolean)
    );
    if (!normalizedIds.size) return;
    state.notifications = state.notifications.map((item) => {
      if (!normalizedIds.has(item.id)) return item;
      return {
        ...item,
        isRead: Boolean(read),
        readAt: read ? readAt || item.readAt || new Date().toISOString() : ""
      };
    });
  }

  function setMuted(target, muted = true) {
    if (target === "all") {
      state.muted.all = Boolean(muted);
      persistMuted();
      emitUpdate();
      return;
    }
    if (typeof target !== "string" || !target.trim()) return;
    const normalizedType = normalizeType(target);
    if (muted) {
      state.muted.types.add(normalizedType);
    } else {
      state.muted.types.delete(normalizedType);
    }
    persistMuted();
    emitUpdate();
  }

  function getMutedState() {
    return {
      all: state.muted.all,
      types: Array.from(state.muted.types)
    };
  }

  function getTypes() {
    return Array.from(new Set(state.notifications.map((item) => item.type))).sort();
  }

  function setNotifications(items, options = {}) {
    const nextItems = Array.isArray(items) ? items : [];
    const requestedSource =
      typeof options.source === "string" && options.source.trim() ? options.source.trim().toLowerCase() : "";
    const source = requestedSource === "live" || requestedSource === "seed" ? requestedSource : state.source;
    state.notifications = sortNotifications(
      nextItems
        .map((item, index) => normalizeNotification(item, index, source))
        .filter(Boolean)
    );
    state.source = source;
    emitUpdate();
  }

  function getFetchWithTimeout() {
    if (typeof window.fetchWithTimeout === "function") {
      return window.fetchWithTimeout;
    }

    return async function fetchWithTimeout(url, opts = {}, timeoutMs = DEFAULT_REFRESH_TIMEOUT_MS) {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);

      try {
        return await fetch(url, { ...opts, signal: controller.signal });
      } finally {
        clearTimeout(id);
      }
    };
  }

  function buildCreatorContextHeaders() {
    if (typeof window.StreamSuitesAuth?.creatorContext?.buildHeaders !== "function") {
      return {};
    }
    return window.StreamSuitesAuth.creatorContext.buildHeaders();
  }

  function normalizeNotes(notes) {
    if (!Array.isArray(notes)) return [];
    return notes
      .map((entry) => normalizeText(entry, ""))
      .filter(Boolean);
  }

  function resolveNotificationsEndpoint() {
    const apiBaseUrl = window.StreamSuitesAuth?.apiBaseUrl;
    if (typeof apiBaseUrl === "string" && apiBaseUrl.trim()) {
      return `${apiBaseUrl.replace(/\/$/, "")}${NOTIFICATIONS_PATH}`;
    }
    return `${API_BASE_URL}${NOTIFICATIONS_PATH}`;
  }

  function normalizeRefreshError(err) {
    if (!err || typeof err !== "object") {
      return { message: "Notifications request failed." };
    }
    const message = normalizeText(err.message || err.error || "", "Notifications request failed.");
    const status = Number.isFinite(err.status) ? Number(err.status) : null;
    return status ? { message, status } : { message };
  }

  function applyEmptyState(notes = []) {
    state.notifications = [];
    state.source = "empty";
    state.nextCursor = "";
    state.notes = Array.isArray(notes) ? notes.slice() : [];
  }

  async function requestMutation(payload) {
    const fetchWithTimeout = getFetchWithTimeout();

    try {
      state.isMutating = true;
      emitUpdate();

      const response = await fetchWithTimeout(
        resolveNotificationsEndpoint(),
        {
          method: "PATCH",
          credentials: "include",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            ...buildCreatorContextHeaders()
          },
          body: JSON.stringify(payload || {})
        },
        DEFAULT_REFRESH_TIMEOUT_MS
      );
      const raw = await response.text();
      const data = safeParse(raw);

      if (!response.ok) {
        const error = new Error(`Notifications update failed with status ${response.status}.`);
        error.status = response.status;
        throw error;
      }
      if (!data || data.success !== true) {
        throw new Error("Notifications update failed.");
      }

      const items = Array.isArray(data.items) ? data.items : [];
      if (payload?.mark_all === true || payload?.markAll === true) {
        const normalizedItems = items
          .map((item, index) => normalizeNotification(item, index, "live"))
          .filter(Boolean);
        if (normalizedItems.length) {
          const byId = new Map(normalizedItems.map((item) => [item.id, item]));
          state.notifications = sortNotifications(
            state.notifications.map((item) => (byId.has(item.id) ? byId.get(item.id) : item))
          );
        }
      } else if (items.length) {
        const normalizedItems = items
          .map((item, index) => normalizeNotification(item, index, "live"))
          .filter(Boolean);
        const byId = new Map(normalizedItems.map((item) => [item.id, item]));
        state.notifications = sortNotifications(
          state.notifications.map((item) => (byId.has(item.id) ? byId.get(item.id) : item))
        );
      } else {
        updateLocalReadState(data.updated_ids, payload?.read === true, payload?.read === true ? new Date().toISOString() : "");
      }

      state.lastError = null;
      emitUpdate();
      return data;
    } catch (err) {
      state.lastError = normalizeRefreshError(err);
      if (state.lastError?.status === 401 || state.lastError?.status === 403) {
        window.StreamSuitesAuth?.reportProtectedDataFailure?.({
          status: state.lastError.status,
          message: "Creator notifications are no longer authorized.",
          source: "notifications"
        });
      }
      throw err;
    } finally {
      state.isMutating = false;
      emitUpdate();
    }
  }

  async function markRead(id) {
    if (typeof id !== "string" || !id.trim()) return;
    await requestMutation({
      notification_ids: [id.trim()],
      read: true
    });
  }

  async function markUnread(id) {
    if (typeof id !== "string" || !id.trim()) return;
    await requestMutation({
      notification_ids: [id.trim()],
      read: false
    });
  }

  async function toggleRead(id) {
    if (isRead(id)) {
      await markUnread(id);
      return;
    }
    await markRead(id);
  }

  async function markAllRead() {
    await requestMutation({
      mark_all: true,
      read: true
    });
  }

  async function refresh(options = {}) {
    const force = options?.force === true;
    const reason = normalizeText(options?.reason, "manual");
    const minIntervalMs = Number.isFinite(options?.minIntervalMs)
      ? Math.max(0, Number(options.minIntervalMs))
      : 0;
    const limit = Number.isFinite(options?.limit)
      ? Math.max(1, Math.floor(Number(options.limit)))
      : DEFAULT_REFRESH_LIMIT;

    if (!force && minIntervalMs > 0 && Date.now() - state.lastRefreshAt < minIntervalMs) {
      return getItems();
    }

    if (refreshPromise) {
      return refreshPromise;
    }

    state.isRefreshing = true;
    state.lastReason = reason;
    emitUpdate();

    const fetchWithTimeout = getFetchWithTimeout();
    const url = new URL(resolveNotificationsEndpoint());
    url.searchParams.set("limit", String(limit));

    refreshPromise = (async () => {
      try {
        const response = await fetchWithTimeout(
          url.toString(),
          {
            method: "GET",
            credentials: "include",
            headers: {
              Accept: "application/json",
              ...buildCreatorContextHeaders()
            }
          },
          DEFAULT_REFRESH_TIMEOUT_MS
        );

        const raw = await response.text();
        const payload = safeParse(raw);

        if (!response.ok) {
          const statusError = new Error(`Notifications request failed with status ${response.status}.`);
          statusError.status = response.status;
          throw statusError;
        }

        if (!payload || typeof payload !== "object") {
          throw new Error("Notifications response payload was invalid.");
        }

        if (payload.success !== true) {
          throw new Error("Notifications API returned success:false.");
        }

        const items = Array.isArray(payload.items) ? payload.items : [];
        state.notifications = sortNotifications(
          items
            .map((item, index) => normalizeNotification(item, index, "live"))
            .filter(Boolean)
        );
        state.source = "live";
        state.nextCursor = normalizeText(payload.next_cursor, "");
        state.notes = normalizeNotes(payload.notes);
        state.lastError = null;
        state.lastRefreshAt = Date.now();
        window.StreamSuitesAuth?.markProtectedDataReady?.("notifications");
        return getItems();
      } catch (err) {
        state.lastError = normalizeRefreshError(err);
        state.lastRefreshAt = Date.now();
        if (state.lastError?.status === 401 || state.lastError?.status === 403) {
          applyEmptyState(["Sign in again to load creator notifications."]);
          window.StreamSuitesAuth?.reportProtectedDataFailure?.({
            status: state.lastError.status,
            message: "Creator notifications are no longer authorized.",
            source: "notifications"
          });
          return getItems();
        }
        applyEmptyState(["Creator notifications are temporarily unavailable."]);
        return getItems();
      } finally {
        state.isRefreshing = false;
        refreshPromise = null;
        emitUpdate();
      }
    })();

    return refreshPromise;
  }

  async function hydrate(options = {}) {
    return refresh(options);
  }

  function init() {
    loadMuted();
    applyEmptyState();
    state.lastError = null;
  }

  init();

  window.StreamSuitesCreatorNotificationsStore = {
    MUTED_STORAGE_KEY,
    UPDATE_EVENT,
    refresh,
    hydrate,
    getItems,
    getNotifications,
    getNotificationById,
    getUnreadCount,
    isRead,
    markRead,
    markUnread,
    toggleRead,
    markAllRead,
    setMuted,
    getMutedState,
    isMuted,
    getTypes,
    setNotifications,
    getSource,
    getNotes,
    getStatus,
    isRefreshing
  };
})();
