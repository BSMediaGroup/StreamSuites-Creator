(() => {
  "use strict";

  const DEFAULT_QUALITY_LEGEND = Object.freeze({
    exact: "Direct platform metric captured from primary source.",
    approximate: "Estimate where only coarse granularity is available.",
    partial: "Subset value where one or more sources are missing.",
    derived: "Computed from other metrics in this payload.",
    unavailable: "Value is currently not available in Phase 0."
  });

  const QUALITY_SUFFIXES = Object.freeze({
    exact: "",
    approximate: "≈",
    partial: "+",
    derived: "*",
    unavailable: ""
  });

  function normalizeText(value, fallback = "") {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    return fallback;
  }

  function normalizeQuality(value) {
    const normalized = normalizeText(value, "").toLowerCase();
    if (!normalized) return "unavailable";
    if (normalized === "estimated") return "approximate";
    if (normalized === "direct") return "exact";
    if (Object.prototype.hasOwnProperty.call(QUALITY_SUFFIXES, normalized)) {
      return normalized;
    }
    return "unavailable";
  }

  function resolveLegend(legend) {
    const merged = { ...DEFAULT_QUALITY_LEGEND };
    if (!legend || typeof legend !== "object") {
      return merged;
    }
    Object.keys(merged).forEach((key) => {
      const candidate = normalizeText(legend[key], "");
      if (candidate) {
        merged[key] = candidate;
      }
    });
    return merged;
  }

  function formatValue(value, options = {}) {
    const quality = normalizeQuality(options.quality);
    const formatter = typeof options.formatter === "function" ? options.formatter : null;
    const legend = resolveLegend(options.legend);
    const tooltipUnavailableText = normalizeText(options.unavailableTitle, "Not available");
    const suffix = QUALITY_SUFFIXES[quality] || "";
    const isMissing = value === null || value === undefined || value === "";

    const baseText = isMissing
      ? "—"
      : formatter
        ? normalizeText(formatter(value), "—")
        : normalizeText(value, "—");
    const displayText = isMissing || !suffix ? baseText : `${baseText}${suffix}`;
    const titleText = quality === "unavailable" ? tooltipUnavailableText : legend[quality];

    return {
      displayText,
      titleText,
      suffix,
      quality
    };
  }

  window.StreamSuitesStatsFormatting = {
    DEFAULT_QUALITY_LEGEND,
    QUALITY_SUFFIXES,
    normalizeQuality,
    resolveLegend,
    formatValue
  };
})();
