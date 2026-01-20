(() => {
  "use strict";

  const elTotal = document.getElementById("jobs-total");
  const elEnabledTotal = document.getElementById("jobs-enabled-total");
  const elDisabledTotal = document.getElementById("jobs-disabled-total");
  const elRestartTotal = document.getElementById("jobs-restart-total");
  const elByStatus = document.getElementById("jobs-by-status");
  const elByType = document.getElementById("jobs-by-type");
  const elByCreator = document.getElementById("jobs-by-creator");
  const elEnableTable = document.getElementById("jobs-enable-table");
  const elEnableEmpty = document.getElementById("jobs-enable-empty");
  const elError = document.getElementById("jobs-error");

  function hasRequiredElements() {
    return Boolean(
      elTotal &&
        elEnabledTotal &&
        elDisabledTotal &&
        elRestartTotal &&
        elByStatus &&
        elByType &&
        elByCreator &&
        elEnableTable &&
        elEnableEmpty &&
        elError
    );
  }

  function clear(el) {
    el.innerHTML = "";
  }

  function showError(msg) {
    if (!elError) return;
    elError.textContent = msg;
    elError.classList.remove("hidden");
  }

  function hideError() {
    if (!elError) return;
    elError.classList.add("hidden");
    elError.textContent = "";
  }

  function isRuntimeAvailable() {
    return window.__RUNTIME_AVAILABLE__ === true;
  }

  function renderRuntimeDisconnected() {
    renderUnavailable();
    showError("Runtime not connected. Start the runtime service and refresh.");
  }

  async function loadJobs() {
    if (window.__STREAMSUITES_RUNTIME_OFFLINE__) {
      if (hasRequiredElements()) {
        renderRuntimeDisconnected();
      }
      return;
    }

    if (!hasRequiredElements()) return;

    if (!isRuntimeAvailable()) {
      renderRuntimeDisconnected();
      return;
    }

    hideError();

    try {
      const loadState = window.StreamSuitesState?.loadStateJson;
      const data = loadState
        ? await loadState("jobs.json")
        : null;

      if (!data) {
        throw new Error("No job state available");
      }

      const jobs = Array.isArray(data.jobs) ? data.jobs : [];

      renderMetrics(jobs);
    } catch (err) {
      console.error("[Dashboard][Jobs]", err);
      renderUnavailable();
      showError("Unable to load job state. Retry in a moment or contact an admin.");
    }
  }

  function renderMetrics(jobs) {
    elTotal.textContent = jobs.length;

    const enableCounts = {
      enabled: 0,
      disabled: 0,
      restartRequired: 0
    };

    const enableRows = jobs.map((job) => {
      const enablement = normalizeEnablement(job);

      if (enablement.enabled === true) enableCounts.enabled++;
      if (enablement.enabled === false) enableCounts.disabled++;
      if (enablement.restartRequired) enableCounts.restartRequired++;

      return { job, enablement };
    });

    elEnabledTotal.textContent = enableCounts.enabled;
    elDisabledTotal.textContent = enableCounts.disabled;
    elRestartTotal.textContent = enableCounts.restartRequired;

    renderEnablementTable(enableRows);

    const byStatus = {};
    const byType = {};
    const byCreator = {};

    for (const job of jobs) {
      const status = job.status || "unknown";
      const type = job.type || "unknown";
      const creator = job.creator_id || "unknown";

      byStatus[status] = (byStatus[status] || 0) + 1;
      byType[type] = (byType[type] || 0) + 1;

      if (!byCreator[creator]) {
        byCreator[creator] = 0;
      }
      byCreator[creator]++;
    }

    renderTable(elByStatus, byStatus);
    renderTable(elByType, byType);
    renderCreatorTable(elByCreator);
  }

  function renderUnavailable() {
    const unavailable = "Unavailable";
    elTotal.textContent = unavailable;
    elEnabledTotal.textContent = unavailable;
    elDisabledTotal.textContent = unavailable;
    elRestartTotal.textContent = unavailable;

    clear(elByStatus);
    clear(elByType);
    clear(elByCreator);
    clear(elEnableTable);
    elEnableEmpty.classList.remove("hidden");
  }

  function normalizeEnablement(job) {
    const enablementBlock =
      job && typeof job.enablement === "object" ? job.enablement : null;

    const enabled = pickBoolean(
      job?.enabled,
      job?.enable,
      enablementBlock?.enabled,
      enablementBlock?.enable
    );

    const restartRequired = pickBoolean(
      job?.restart_required,
      job?.restartRequired,
      enablementBlock?.restart_required,
      enablementBlock?.requires_restart
    );

    const reason = pickReason([
      job?.disable_reason,
      job?.disabled_reason,
      job?.reason,
      enablementBlock?.reason,
      enablementBlock?.note,
      enablementBlock?.message
    ]);

    return {
      enabled,
      restartRequired: restartRequired === true,
      reason
    };
  }

  function pickBoolean(...values) {
    for (const value of values) {
      if (value === true) return true;
      if (value === false) return false;
    }
    return null;
  }

  function pickReason(values) {
    for (const value of values) {
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
    return null;
  }

  function renderEnablementTable(rows) {
    clear(elEnableTable);

    if (!rows.length) {
      elEnableEmpty.classList.remove("hidden");
      return;
    }

    elEnableEmpty.classList.add("hidden");

    rows.forEach(({ job, enablement }) => {
      const tr = document.createElement("tr");
      if (enablement.enabled === false) {
        tr.classList.add("ss-job-disabled");
      }

      tr.appendChild(createCell(job?.id));
      tr.appendChild(createCell(job?.type));
      tr.appendChild(createCell(renderEnablementLabel(enablement)));
      tr.appendChild(createRestartCell(enablement));
      tr.appendChild(createCell(enablement.reason));

      elEnableTable.appendChild(tr);
    });
  }

  function renderEnablementLabel(enablement) {
    if (enablement.enabled === true) return "Enabled";
    if (enablement.enabled === false) return "Disabled";
    return "Unknown";
  }

  function createCell(value) {
    const td = document.createElement("td");
    td.textContent = value || "—";
    return td;
  }

  function createRestartCell(enablement) {
    const td = document.createElement("td");

    if (enablement.restartRequired) {
      const badge = document.createElement("span");
      badge.className = "ss-badge ss-badge-warning";
      badge.textContent = "Restart required";
      td.appendChild(badge);
      return td;
    }

    const note = document.createElement("span");
    note.className = "muted";
    note.title = "Job enable/disable changes take effect after a restart.";
    note.textContent = "Restart-applied";
    td.appendChild(note);
    return td;
  }

  function renderTable(tbody, map) {
    clear(tbody);

    Object.entries(map).forEach(([key, count]) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${key}</td><td>${count}</td>`;
      tbody.appendChild(tr);
    });
  }

  function renderCreatorTable(map) {
    clear(elByCreator);

    Object.entries(map).forEach(([creator, total]) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${creator}</td><td>${total}</td>`;
      elByCreator.appendChild(tr);
    });
  }

  function init() {
    setTimeout(() => {
      void loadJobs();
    }, 0);
  }

  window.JobsView = {
    init
  };
})();
