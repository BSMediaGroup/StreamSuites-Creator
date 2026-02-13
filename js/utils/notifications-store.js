(() => {
  "use strict";

  const READ_STORAGE_KEY = "ss_creator_notifications_read";
  const MUTED_STORAGE_KEY = "ss_creator_notifications_muted";
  const UPDATE_EVENT = "ss:creator-notifications-updated";

  const seedNotifications = Object.freeze([
    {
      id: "creator-job-queue-lag",
      type: "job",
      title: "Clip queue is building",
      snippet: "Three jobs are waiting for worker capacity in the render queue.",
      timestamp: "2026-02-12T22:18:00Z",
      link: "#jobs"
    },
    {
      id: "creator-trigger-deploy",
      type: "trigger",
      title: "Trigger set published",
      snippet: "Night-show trigger bundle was staged and applied to your active profile.",
      timestamp: "2026-02-12T20:06:00Z",
      link: "#triggers"
    },
    {
      id: "creator-platform-youtube",
      type: "platform",
      title: "YouTube token refresh due soon",
      snippet: "Reconnect within 48 hours to avoid automation pauses during stream start.",
      timestamp: "2026-02-11T19:24:00Z",
      link: "#platforms/youtube"
    },
    {
      id: "creator-system-export",
      type: "system",
      title: "State export completed",
      snippet: "Latest runtime export finished successfully with no schema drift detected.",
      timestamp: "2026-02-11T14:11:00Z",
      link: "#updates"
    },
    {
      id: "creator-billing-renewal",
      type: "billing",
      title: "Billing cycle reminder",
      snippet: "Your plan renews in five days. Review active seats before renewal.",
      timestamp: "2026-02-10T18:42:00Z",
      link: "#plans"
    },
    {
      id: "creator-platform-rumble",
      type: "platform",
      title: "Rumble destination healthy",
      snippet: "Connection heartbeat stabilized after transport retry on the last session.",
      timestamp: "2026-02-10T09:15:00Z",
      link: "#platforms/rumble"
    },
    {
      id: "creator-trigger-fallback",
      type: "trigger",
      title: "Fallback response armed",
      snippet: "Default response path is now active for unmatched command aliases.",
      timestamp: "2026-02-09T22:57:00Z",
      link: "#triggers"
    }
  ]);

  const state = {
    notifications: [],
    readIds: new Set(),
    muted: {
      all: false,
      types: new Set()
    }
  };

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

  function normalizeTimestamp(value) {
    if (typeof value !== "string") return { iso: "", ms: 0 };
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return { iso: "", ms: 0 };
    return {
      iso: parsed.toISOString(),
      ms: parsed.getTime()
    };
  }

  function normalizeNotification(item, index) {
    if (!item || typeof item !== "object") return null;
    const id =
      typeof item.id === "string" && item.id.trim()
        ? item.id.trim()
        : `creator-notification-${index + 1}`;
    const when = normalizeTimestamp(item.timestamp);
    const title =
      typeof item.title === "string" && item.title.trim() ? item.title.trim() : "Untitled notification";
    const snippet = typeof item.snippet === "string" ? item.snippet.trim() : "";
    const type = normalizeType(item.type);
    const link = typeof item.link === "string" ? item.link.trim() : "";

    return {
      id,
      type,
      title,
      snippet,
      timestamp: when.iso,
      timestampMs: when.ms,
      link
    };
  }

  function sortNotifications(list) {
    return list.slice().sort((left, right) => right.timestampMs - left.timestampMs);
  }

  function persistReadIds() {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(Array.from(state.readIds)));
    } catch (err) {
      // Ignore persistence failures.
    }
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

  function loadReadIds() {
    if (typeof localStorage === "undefined") return;
    const parsed = safeParse(localStorage.getItem(READ_STORAGE_KEY));
    if (!Array.isArray(parsed)) return;
    state.readIds = new Set(
      parsed
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter(Boolean)
    );
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

  function emitUpdate() {
    try {
      window.dispatchEvent(
        new CustomEvent(UPDATE_EVENT, {
          detail: {
            total: state.notifications.length,
            unread: getUnreadCount()
          }
        })
      );
    } catch (err) {
      // Ignore event dispatch failures.
    }
  }

  function getNotifications() {
    return sortNotifications(state.notifications).map((item) => ({ ...item }));
  }

  function getNotificationById(id) {
    if (typeof id !== "string" || !id.trim()) return null;
    return state.notifications.find((item) => item.id === id.trim()) || null;
  }

  function isRead(itemOrId) {
    const id =
      typeof itemOrId === "string"
        ? itemOrId.trim()
        : typeof itemOrId?.id === "string"
          ? itemOrId.id.trim()
          : "";
    return Boolean(id && state.readIds.has(id));
  }

  function isMuted(item) {
    if (!item || typeof item !== "object") return state.muted.all;
    const itemType = normalizeType(item.type);
    return state.muted.all || state.muted.types.has(itemType);
  }

  function getUnreadCount() {
    return state.notifications.reduce((count, item) => {
      if (isRead(item)) return count;
      if (isMuted(item)) return count;
      return count + 1;
    }, 0);
  }

  function markRead(id) {
    if (typeof id !== "string" || !id.trim()) return;
    state.readIds.add(id.trim());
    persistReadIds();
    emitUpdate();
  }

  function markUnread(id) {
    if (typeof id !== "string" || !id.trim()) return;
    state.readIds.delete(id.trim());
    persistReadIds();
    emitUpdate();
  }

  function toggleRead(id) {
    if (isRead(id)) {
      markUnread(id);
      return;
    }
    markRead(id);
  }

  function markAllRead() {
    state.notifications.forEach((item) => state.readIds.add(item.id));
    persistReadIds();
    emitUpdate();
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

  function setNotifications(items) {
    const nextItems = Array.isArray(items) ? items : [];
    state.notifications = sortNotifications(
      nextItems
        .map((item, index) => normalizeNotification(item, index))
        .filter(Boolean)
    );
    emitUpdate();
  }

  function init() {
    state.notifications = sortNotifications(
      seedNotifications
        .map((item, index) => normalizeNotification(item, index))
        .filter(Boolean)
    );
    loadReadIds();
    loadMuted();
  }

  init();

  window.StreamSuitesCreatorNotificationsStore = {
    READ_STORAGE_KEY,
    MUTED_STORAGE_KEY,
    UPDATE_EVENT,
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
    setNotifications
  };
})();
