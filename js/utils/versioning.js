(() => {
  "use strict";

  const VERSION_ENDPOINT = new URL(
    "/runtime/exports/version.json",
    window.location.origin
  ).href;
  const CACHE = {
    promise: null,
    data: null
  };

  const TEMPLATE_REPLACERS = {
    version: /\{\{\s*version\s*\}\}/gi,
    build: /\{\{\s*build\s*\}\}/gi
  };

  function normalizeValue(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === "number") return String(value);
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  function normalizePayload(payload) {
    if (!payload || typeof payload !== "object") return null;
    const project = normalizeValue(payload.project);
    const version = normalizeValue(payload.version);
    const build = normalizeValue(payload.build);
    const generatedAt = normalizeValue(payload.generated_at);
    const source = normalizeValue(payload.source);

    if (!project && !version && !build && !generatedAt && !source) {
      return null;
    }

    return {
      project,
      version,
      build,
      generated_at: generatedAt,
      source,
      raw: payload
    };
  }

  function formatVersion(value) {
    if (!value) return null;
    if (/^v/i.test(value)) return value;
    return `v${value}`;
  }

  async function fetchVersionData() {
    if (CACHE.promise) return CACHE.promise;

    CACHE.promise = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

      try {
        const response = await fetch(VERSION_ENDPOINT, {
          cache: "no-store",
          signal: controller.signal
        });
        if (!response.ok) {
          console.warn(
            "[Versioning] Version metadata request failed",
            response.status
          );
          return null;
        }
        const payload = await response.json();
        const normalized = normalizePayload(payload);
        if (!normalized) {
          console.warn("[Versioning] Version metadata payload was empty");
        }
        CACHE.data = normalized;
        return normalized;
      } catch (err) {
        console.warn("[Versioning] Failed to load version metadata", err);
        return null;
      } finally {
        clearTimeout(timeout);
      }
    })();

    return CACHE.promise;
  }

  function applyTemplate(template, values) {
    if (!template) return null;
    let output = template;
    output = output.replace(TEMPLATE_REPLACERS.version, values.version ?? "—");
    output = output.replace(TEMPLATE_REPLACERS.build, values.build ?? "—");
    return output;
  }

  function applyToElements(selector, values, fallbackKey) {
    if (!selector) return;
    const elements = document.querySelectorAll(selector);
    elements.forEach((el) => {
      const template = el.getAttribute("data-version-format");
      if (template) {
        el.textContent = applyTemplate(template, values);
      } else if (fallbackKey && values[fallbackKey]) {
        el.textContent = values[fallbackKey];
      }
    });
  }

  function applyUnavailable(selector) {
    if (!selector) return;
    const elements = document.querySelectorAll(selector);
    elements.forEach((el) => {
      el.textContent =
        el.getAttribute("data-version-unavailable") || "Version unavailable";
    });
  }

  async function applyVersionToElements(options = {}) {
    const data = await fetchVersionData();
    if (!data) {
      console.warn(
        "[Versioning] Version metadata unavailable; showing fallback"
      );
      applyUnavailable(options.version);
      applyUnavailable(options.build);
      document.documentElement.dataset.versionStatus = "unavailable";
      return null;
    }

    const formattedVersion = formatVersion(data.version);
    const values = {
      version: formattedVersion,
      build: data.build
    };

    if (formattedVersion) {
      document.documentElement.dataset.version = formattedVersion;
    }
    if (data.build) {
      document.documentElement.dataset.build = data.build;
    }
    document.documentElement.dataset.versionStatus = "available";

    applyToElements(options.version, values, "version");
    applyToElements(options.build, values, "build");

    return data;
  }

  window.Versioning = {
    VERSION_ENDPOINT,
    fetchVersionData,
    applyVersionToElements
  };
})();
