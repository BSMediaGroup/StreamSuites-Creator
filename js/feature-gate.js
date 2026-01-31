(() => {
  "use strict";

  const ALLOWED_REASONS = new Set([
    "This feature isn’t available on your current plan.",
    "This feature is currently unavailable."
  ]);
  const CHECK_INTERVAL_MS = 300;
  const MAX_CHECKS = 20;

  function getSessionFeatures() {
    return window.App?.session?.features || {};
  }

  function isFeatureEnabled(feature) {
    if (typeof feature !== "string" || !feature.trim()) return false;
    return getSessionFeatures()?.[feature] === true;
  }

  function getReason(node) {
    const raw = node.getAttribute("data-feature-gate-reason");
    if (!raw) return null;
    return ALLOWED_REASONS.has(raw) ? raw : null;
  }

  function markDisabled(node, reason) {
    node.classList.add("feature-gate", "is-disabled");
    node.setAttribute("aria-disabled", "true");

    const controls = node.querySelectorAll("button, input, select, textarea");
    controls.forEach((control) => {
      if (!control.hasAttribute("data-feature-gate-prev-disabled")) {
        control.setAttribute(
          "data-feature-gate-prev-disabled",
          control.disabled ? "true" : "false"
        );
      }
      control.disabled = true;
      control.setAttribute("aria-disabled", "true");
    });

    const links = node.querySelectorAll("a[href]");
    links.forEach((link) => {
      if (!link.hasAttribute("data-feature-gate-prev-tabindex")) {
        const prev = link.getAttribute("tabindex");
        link.setAttribute("data-feature-gate-prev-tabindex", prev !== null ? prev : "");
      }
      link.setAttribute("tabindex", "-1");
      link.setAttribute("aria-disabled", "true");
    });

    if (reason) {
      node.setAttribute("data-feature-gate-applied-reason", reason);
    }
  }

  function markEnabled(node) {
    node.classList.add("feature-gate");
    node.classList.remove("is-disabled");
    node.removeAttribute("aria-disabled");
    node.removeAttribute("data-feature-gate-applied-reason");

    const controls = node.querySelectorAll("[data-feature-gate-prev-disabled]");
    controls.forEach((control) => {
      const wasDisabled =
        control.getAttribute("data-feature-gate-prev-disabled") === "true";
      if (!wasDisabled) {
        control.disabled = false;
      }
      control.removeAttribute("aria-disabled");
      control.removeAttribute("data-feature-gate-prev-disabled");
    });

    const links = node.querySelectorAll("[data-feature-gate-prev-tabindex]");
    links.forEach((link) => {
      const prev = link.getAttribute("data-feature-gate-prev-tabindex");
      if (prev === "") {
        link.removeAttribute("tabindex");
      } else {
        link.setAttribute("tabindex", prev);
      }
      link.removeAttribute("aria-disabled");
      link.removeAttribute("data-feature-gate-prev-tabindex");
    });
  }

  function applyFeatureGates(root = document) {
    const nodes = root.querySelectorAll("[data-feature-gate]");
    nodes.forEach((node) => {
      const feature = node.getAttribute("data-feature-gate");
      if (!feature) return;
      const reason = getReason(node);
      if (isFeatureEnabled(feature)) {
        markEnabled(node);
      } else {
        markDisabled(node, reason);
      }
    });
  }

  function waitForSession() {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (window.App?.session || attempts >= MAX_CHECKS) {
        clearInterval(timer);
        applyFeatureGates();
      }
    }, CHECK_INTERVAL_MS);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", waitForSession);
  } else {
    waitForSession();
  }

  window.App = window.App || {};
  window.App.featureGate = {
    apply: applyFeatureGates,
    isEnabled: isFeatureEnabled
  };
})();
