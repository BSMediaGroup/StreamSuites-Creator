(() => {
  const API_URL = "https://v0hwlmly3pd2.statuspage.io/api/v2/summary.json";
  const STATUS_URL = "https://streamsuites.statuspage.io/";
  const ROOT_ID = "ss-status-indicator";
  const DETAILS_ID = "ss-status-details";
  const INDICATOR_LABELS = {
    none: "OPERATIONAL",
    minor: "DEGRADED",
    major: "OUTAGE",
    critical: "CRITICAL",
  };
  const INDICATOR_STATES = {
    none: "operational",
    minor: "degraded",
    major: "outage",
    critical: "critical",
  };

  if (document.getElementById(ROOT_ID)) return;

  const root = document.createElement("div");
  root.id = ROOT_ID;
  root.className = "ss-status-indicator";
  root.dataset.state = "unknown";
  root.dataset.expanded = "false";

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "ss-status-toggle";
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-controls", DETAILS_ID);
  toggle.setAttribute("aria-label", "Service status details");

  const dot = document.createElement("span");
  dot.className = "ss-status-dot";
  dot.setAttribute("aria-hidden", "true");

  const label = document.createElement("span");
  label.className = "ss-status-label";
  label.textContent = "UNKNOWN";

  toggle.append(dot, label);

  const details = document.createElement("div");
  details.id = DETAILS_ID;
  details.className = "ss-status-details";
  details.hidden = true;

  root.append(toggle, details);

  const ensureCreatorInlineHost = () => {
    const creatorFooter = document.querySelector("#app-footer.creator-footer, footer.creator-footer");
    if (!creatorFooter) return null;

    const existingSlot = creatorFooter.querySelector("[data-status-slot]");
    if (existingSlot) return existingSlot;

    const slot = document.createElement("span");
    slot.className = "creator-footer-status-slot";
    slot.setAttribute("data-status-slot", "");
    slot.setAttribute("data-status-slot-mode", "inline");
    const rightCluster =
      creatorFooter.querySelector(".creator-footer-right, .footer-right") || creatorFooter;
    rightCluster.appendChild(slot);
    return slot;
  };

  const host = document.querySelector("[data-status-slot]") || ensureCreatorInlineHost();
  const hasInlineMode =
    !!host &&
    (host.getAttribute("data-status-slot-mode") === "inline" ||
      !!host.closest("#app-footer") ||
      !!host.closest(".creator-footer") ||
      !!host.closest(".footer-shell") ||
      !!host.closest(".public-footer"));

  if (host) {
    host.appendChild(root);
    root.dataset.layout = hasInlineMode ? "inline" : "embedded";
  } else {
    document.body.appendChild(root);
    root.dataset.layout = "floating";
  }
  const hasFooterSlot = Boolean(host);
  let footerOffsetRaf = 0;
  let observedFooter = null;
  let footerObserver = null;

  let userToggled = false;

  const setExpanded = (expanded) => {
    const isExpanded = Boolean(expanded);
    root.dataset.expanded = String(isExpanded);
    toggle.setAttribute("aria-expanded", String(isExpanded));
    details.hidden = !isExpanded;
  };

  toggle.addEventListener("click", () => {
    userToggled = true;
    setExpanded(root.dataset.expanded !== "true");
  });

  const toTitle = (value) => {
    if (!value) return "";
    return String(value)
      .replace(/_/g, " ")
      .split(" ")
      .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
      .join(" ");
  };

  const truncateText = (value, limit) => {
    if (!value) return "";
    const text = String(value).trim();
    if (text.length <= limit) return text;
    const slice = text.slice(0, limit);
    const lastSpace = slice.lastIndexOf(" ");
    if (lastSpace > 40) {
      return `${slice.slice(0, lastSpace)}...`;
    }
    return `${slice}...`;
  };

  const buildSection = (titleText, items) => {
    const section = document.createElement("div");
    section.className = "ss-status-section";
    const title = document.createElement("div");
    title.className = "ss-status-section-title";
    title.textContent = titleText;
    const list = document.createElement("ul");
    list.className = "ss-status-list";
    items.forEach((item) => list.appendChild(item));
    section.append(title, list);
    return section;
  };

  const createListItem = ({ title, meta, body }) => {
    const item = document.createElement("li");
    item.className = "ss-status-item";

    const titleEl = document.createElement("div");
    titleEl.className = "ss-status-item-title";
    titleEl.textContent = title;
    item.appendChild(titleEl);

    if (meta) {
      const metaEl = document.createElement("div");
      metaEl.className = "ss-status-item-meta";
      metaEl.textContent = meta;
      item.appendChild(metaEl);
    }

    if (body) {
      const bodyEl = document.createElement("div");
      bodyEl.className = "ss-status-item-body";
      bodyEl.textContent = body;
      item.appendChild(bodyEl);
    }

    return item;
  };

  const createLink = () => {
    const link = document.createElement("a");
    link.className = "ss-status-link";
    link.href = STATUS_URL;
    link.rel = "noreferrer";
    link.target = "_blank";
    link.textContent = "View full status →";
    return link;
  };

  const computeFallbackIndicator = (components) => {
    if (components.some((component) => component.status === "major_outage")) {
      return "major";
    }
    if (
      components.some(
        (component) =>
          component.status === "partial_outage" ||
          component.status === "degraded_performance"
      )
    ) {
      return "minor";
    }
    return "none";
  };

  const resolveIndicator = (summary, components) => {
    const key = String(summary?.status?.indicator || "").toLowerCase();
    if (Object.prototype.hasOwnProperty.call(INDICATOR_LABELS, key)) {
      return key;
    }
    return computeFallbackIndicator(components);
  };

  const setUnavailable = () => {
    root.dataset.state = "unknown";
    label.textContent = "UNKNOWN";
    details.innerHTML = "";
    const summary = document.createElement("div");
    summary.className = "ss-status-summary";
    summary.textContent = "Status unavailable.";
    details.append(summary, createLink());
  };

  const updateWidget = (summary) => {
    const components = Array.isArray(summary?.components) ? summary.components : [];
    const incidents = Array.isArray(summary?.incidents) ? summary.incidents : [];
    const maintenances = Array.isArray(summary?.scheduled_maintenances)
      ? summary.scheduled_maintenances
      : [];

    const impactedComponents = components.filter(
      (component) => component.status !== "operational"
    );

    const indicator = resolveIndicator(summary, components);
    root.dataset.state = INDICATOR_STATES[indicator] || "unknown";
    label.textContent = INDICATOR_LABELS[indicator] || "UNKNOWN";

    details.innerHTML = "";
    const description = summary?.status?.description || "Status unavailable.";
    const summaryEl = document.createElement("div");
    summaryEl.className = "ss-status-summary";
    summaryEl.textContent = description;
    details.appendChild(summaryEl);

    if (impactedComponents.length) {
      const items = impactedComponents.map((component) =>
        createListItem({
          title: component.name || "Unnamed Component",
          meta: toTitle(component.status) || "Status Unknown",
        })
      );
      details.appendChild(buildSection("Components", items));
    }

    const unresolvedIncidents = incidents.filter(
      (incident) => incident.status !== "resolved"
    );
    if (unresolvedIncidents.length) {
      const items = unresolvedIncidents.map((incident) => {
        const update = Array.isArray(incident.incident_updates)
          ? incident.incident_updates[0]
          : null;
        return createListItem({
          title: incident.name || "Untitled Incident",
          meta: toTitle(incident.status) || "Unknown",
          body: truncateText(update?.body || "", 180) || null,
        });
      });
      details.appendChild(buildSection("Incidents", items));
    }

    const activeMaintenances = maintenances.filter(
      (maintenance) => maintenance.status !== "completed"
    );
    if (activeMaintenances.length) {
      const items = activeMaintenances.map((maintenance) =>
        createListItem({
          title: maintenance.name || "Scheduled Maintenance",
          meta: toTitle(maintenance.status) || "Scheduled",
        })
      );
      details.appendChild(buildSection("Maintenance", items));
    }

    details.appendChild(createLink());

    const shouldExpand = incidents.length > 0 || impactedComponents.length > 0;
    if (!userToggled) {
      setExpanded(shouldExpand);
    }
  };

  const fetchStatus = async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(API_URL, {
        signal: controller.signal,
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) throw new Error("status fetch failed");
      const data = await response.json();
      updateWidget(data);
    } catch (error) {
      setUnavailable();
    } finally {
      clearTimeout(timeout);
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fetchStatus);
  } else {
    fetchStatus();
  }

  const updateScrollbarOffset = () => {
    const docEl = document.documentElement;
    if (!docEl) return;
    const rawWidth = (window.innerWidth || 0) - (docEl.clientWidth || 0);
    const scrollbarWidth = Math.max(0, Math.round(rawWidth));
    docEl.style.setProperty("--ss-status-scrollbar-offset", `${scrollbarWidth}px`);
  };

  const parsePixels = (value, fallback = 0) => {
    const next = Number.parseFloat(value);
    return Number.isFinite(next) ? next : fallback;
  };

  const readBaseBottom = () => {
    const inlineBottom = root.style.bottom;
    root.style.bottom = "";
    const baseBottom = parsePixels(window.getComputedStyle(root).bottom, 10);
    root.style.bottom = inlineBottom;
    return baseBottom;
  };

  const findFooter = () => {
    const selectors = [
      ".footer-shell",
      "footer.public-footer",
      "footer.ss-footer",
      "footer",
      "[role='contentinfo']",
    ];
    for (const selector of selectors) {
      const match = document.querySelector(selector);
      if (match) return match;
    }
    return null;
  };

  const getFooter = () => observedFooter || findFooter();

  const applyFooterOffset = () => {
    footerOffsetRaf = 0;
    if (hasFooterSlot) {
      root.style.bottom = "";
      return;
    }

    const footer = getFooter();
    if (!footer) {
      root.style.bottom = "";
      return;
    }

    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const footerRect = footer.getBoundingClientRect();
    const overlap = Math.max(0, viewportHeight - footerRect.top);
    const baseBottom = readBaseBottom();
    const clearance = 8;
    root.style.bottom = overlap > 0 ? `${Math.ceil(baseBottom + overlap + clearance)}px` : "";
  };

  const requestFooterOffsetUpdate = () => {
    if (footerOffsetRaf) return;
    footerOffsetRaf = window.requestAnimationFrame(applyFooterOffset);
  };

  const bindFooter = () => {
    if (hasFooterSlot) return;
    const nextFooter = findFooter();
    if (!nextFooter || nextFooter === observedFooter) return;
    observedFooter = nextFooter;
    if (footerObserver) {
      footerObserver.disconnect();
    }
    if ("ResizeObserver" in window) {
      footerObserver = new ResizeObserver(requestFooterOffsetUpdate);
      footerObserver.observe(observedFooter);
    }
    requestFooterOffsetUpdate();
  };

  if (!hasFooterSlot) {
    bindFooter();
    if ("MutationObserver" in window) {
      const mutationObserver = new MutationObserver(() => {
        bindFooter();
      });
      mutationObserver.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    }
  }

  const handleViewportChange = () => {
    updateScrollbarOffset();
    requestFooterOffsetUpdate();
  };

  window.addEventListener("scroll", requestFooterOffsetUpdate, { passive: true });
  window.addEventListener("resize", handleViewportChange);
  updateScrollbarOffset();
  requestFooterOffsetUpdate();
})();
