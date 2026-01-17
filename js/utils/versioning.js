(() => {
  "use strict";

  const VERSION_ENDPOINT = "https://admin.streamsuites.app/version.json";
  const CACHE = {
    promise: null,
    data: null
  };

  const TEMPLATE_REPLACERS = {
    version: /\{\{\s*version\s*\}\}/gi,
    build: /\{\{\s*build\s*\}\}/gi
  };

  function normalizeValue(value) {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  function normalizePayload(payload) {
    if (!payload || typeof payload !== "object") return null;
    const version =
      normalizeValue(payload.version) ||
      normalizeValue(payload.release) ||
      normalizeValue(payload.tag) ||
      normalizeValue(payload.app_version);
    const build =
      normalizeValue(payload.build) ||
      normalizeValue(payload.build_id) ||
      normalizeValue(payload.commit) ||
      normalizeValue(payload.sha);
    const label = normalizeValue(payload.label) || normalizeValue(payload.name);
    const timestamp =
      normalizeValue(payload.timestamp) ||
      normalizeValue(payload.built_at) ||
      normalizeValue(payload.date);

    return {
      version,
      build,
      label,
      timestamp,
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
          return null;
        }
        const payload = await response.json();
        const normalized = normalizePayload(payload);
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

  function applyToElements(selector, values) {
    if (!selector) return;
    const elements = document.querySelectorAll(selector);
    elements.forEach((el) => {
      const template = el.getAttribute("data-version-format");
      if (template) {
        el.textContent = applyTemplate(template, values);
      } else if (values.version) {
        el.textContent = values.version;
      }
    });
  }

  async function applyVersionToElements(options = {}) {
    const data = await fetchVersionData();
    if (!data) return null;

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

    applyToElements(options.version, values);
    applyToElements(options.build, values);

    return data;
  }

  window.Versioning = {
    VERSION_ENDPOINT,
    fetchVersionData,
    applyVersionToElements
  };
})();
