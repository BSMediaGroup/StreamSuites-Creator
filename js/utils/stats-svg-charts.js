(() => {
  "use strict";

  function defaultEscapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function defaultFormatNumber(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return "—";
    return Math.round(numeric).toLocaleString();
  }

  function defaultFormatSignedNumber(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return "—";
    const rounded = Math.round(numeric);
    if (rounded > 0) return `+${rounded.toLocaleString()}`;
    return rounded.toLocaleString();
  }

  function defaultNormalizeText(value, fallback = "") {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    return fallback;
  }

  function buildLineChartMarkup(series, options = {}) {
    if (!Array.isArray(series) || !series.length) {
      return '<p class="muted">No growth points available.</p>';
    }

    const compact = options.compact === true;
    const width = compact ? 292 : 640;
    const height = compact ? 126 : 292;
    const paddingX = compact ? 12 : 24;
    const paddingTop = compact ? 10 : 22;
    const chartHeight = compact ? 92 : 164;
    const barsTop = compact ? 0 : 208;
    const barsHeight = compact ? 0 : 52;
    const showMeta = options.showMeta !== false && !compact;
    const showMovingAverage = options.showMovingAverage !== false && !compact;
    const showAxis = options.showAxis !== false && !compact;
    const showDeltaBars = options.showDeltaBars !== false && !compact;
    const showCallout = options.showCallout !== false;
    const formatNumber = options.formatNumber || defaultFormatNumber;
    const formatSignedNumber = options.formatSignedNumber || defaultFormatSignedNumber;
    const escapeHtml = options.escapeHtml || defaultEscapeHtml;
    const normalizeText = options.normalizeText || defaultNormalizeText;
    const pointLabels = Array.isArray(options.dateLabels) ? options.dateLabels : [];
    const ariaLabel = normalizeText(options.ariaLabel, "Audience growth last 30 points");
    const gradientId = normalizeText(options.gradientId, "creator-stats-line-fill");

    const points = series.map((value) => Math.max(0, Number(value) || 0));
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    const deltas = points.map((value, index) => (index === 0 ? 0 : value - points[index - 1]));
    const deltaAbsMax = Math.max(1, ...deltas.map((value) => Math.abs(value)));
    const netChange = points[points.length - 1] - points[0];
    const avgDelta =
      deltas.length > 1
        ? deltas.slice(1).reduce((sum, value) => sum + value, 0) / (deltas.length - 1)
        : 0;

    const movingAverage = points.map((_, index) => {
      const start = Math.max(0, index - 6);
      const window = points.slice(start, index + 1);
      return Math.round(window.reduce((sum, value) => sum + value, 0) / window.length);
    });

    const x = (index) =>
      paddingX + (index / Math.max(1, points.length - 1)) * (width - paddingX * 2);
    const y = (value) => paddingTop + ((max - value) / range) * chartHeight;
    const yDelta = (delta) =>
      barsTop + barsHeight - (Math.abs(delta) / deltaAbsMax) * (barsHeight - 4);

    const linePath = points
      .map((value, index) => `${index === 0 ? "M" : "L"} ${x(index).toFixed(2)} ${y(value).toFixed(2)}`)
      .join(" ");
    const movingAveragePath = movingAverage
      .map(
        (value, index) =>
          `${index === 0 ? "M" : "L"} ${x(index).toFixed(2)} ${y(value).toFixed(2)}`
      )
      .join(" ");

    const areaBottomY = paddingTop + chartHeight;
    const areaPath = `${linePath} L ${x(points.length - 1).toFixed(2)} ${areaBottomY.toFixed(
      2
    )} L ${x(0).toFixed(2)} ${areaBottomY.toFixed(2)} Z`;

    const ticks = showAxis
      ? [0, 0.25, 0.5, 0.75, 1]
          .map((ratio) => {
            const yPos = areaBottomY - ratio * chartHeight;
            return `<line x1="${paddingX}" y1="${yPos.toFixed(2)}" x2="${(
              width - paddingX
            ).toFixed(2)}" y2="${yPos.toFixed(2)}"></line>`;
          })
          .join("")
      : "";

    const xTicks = showAxis
      ? [0, 5, 10, 15, 20, 25, points.length - 1]
          .filter((value, idx, arr) => arr.indexOf(value) === idx)
          .map((index) => {
            const xPos = x(index);
            const labelText = normalizeText(pointLabels[index], `Day ${index + 1}`);
            return `
              <line x1="${xPos.toFixed(2)}" y1="${areaBottomY.toFixed(2)}" x2="${xPos.toFixed(
                2
              )}" y2="${(areaBottomY + 6).toFixed(2)}" class="creator-stats-axis-tick"></line>
              <text x="${xPos.toFixed(2)}" y="${(areaBottomY + 18).toFixed(
                2
              )}" text-anchor="middle" class="creator-stats-axis-label">${escapeHtml(labelText)}</text>
            `;
          })
          .join("")
      : "";

    const pointMarkers = points
      .map((value, index) => {
        const isEmphasis =
          index === 0 ||
          index === points.length - 1 ||
          (!compact && index % 5 === 0) ||
          (compact && index % 7 === 0);
        if (!isEmphasis) return "";
        return `<circle cx="${x(index).toFixed(2)}" cy="${y(value).toFixed(
          2
        )}" r="${index === points.length - 1 ? (compact ? "3.2" : "3.8") : compact ? "2.2" : "2.7"}" class="creator-stats-line-point"></circle>`;
      })
      .join("");

    const deltaBars = showDeltaBars
      ? deltas
          .map((delta, index) => {
            const xPos = x(index) - Math.max(4, ((width - paddingX * 2) / Math.max(1, points.length)) * 0.64) / 2;
            const yPos = yDelta(delta);
            const h = Math.max(2, barsTop + barsHeight - yPos);
            const tone = delta >= 0 ? "positive" : "negative";
            return `<rect x="${xPos.toFixed(2)}" y="${yPos.toFixed(2)}" width="${Math.max(
              4,
              ((width - paddingX * 2) / Math.max(1, points.length)) * 0.64
            ).toFixed(2)}" height="${h.toFixed(2)}" rx="2" class="creator-stats-delta-bar ${tone}"></rect>`;
          })
          .join("")
      : "";

    const latestX = x(points.length - 1);
    const latestY = y(points[points.length - 1]);
    const avg7 = movingAverage[movingAverage.length - 1];

    return `
      <svg class="creator-stats-line-svg ${compact ? "is-mini" : ""}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(
      ariaLabel
    )}">
        <defs>
          <linearGradient id="${escapeHtml(gradientId)}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="rgba(123, 140, 255, 0.55)"></stop>
            <stop offset="100%" stop-color="rgba(123, 140, 255, 0.05)"></stop>
          </linearGradient>
        </defs>
        ${showAxis ? `<g class="creator-stats-grid-lines">${ticks}</g>` : ""}
        ${
          showDeltaBars
            ? `<line x1="${paddingX}" y1="${(barsTop - 6).toFixed(2)}" x2="${(width - paddingX).toFixed(
                2
              )}" y2="${(barsTop - 6).toFixed(2)}" class="creator-stats-separator-line"></line>`
            : ""
        }
        <path class="creator-stats-line-area" fill="url(#${escapeHtml(gradientId)})" d="${areaPath}"></path>
        ${
          showMovingAverage
            ? `<path class="creator-stats-line-path creator-stats-line-path-avg" d="${movingAveragePath}"></path>`
            : ""
        }
        <path class="creator-stats-line-path" d="${linePath}"></path>
        ${pointMarkers}
        ${showDeltaBars ? `<g class="creator-stats-delta-bars">${deltaBars}</g>` : ""}
        ${showAxis ? `<g class="creator-stats-x-axis">${xTicks}</g>` : ""}
        ${
          showCallout
            ? `<line x1="${latestX.toFixed(2)}" y1="${paddingTop}" x2="${latestX.toFixed(
                2
              )}" y2="${areaBottomY.toFixed(2)}" class="creator-stats-crosshair"></line>
        <circle cx="${latestX.toFixed(2)}" cy="${latestY.toFixed(2)}" r="${
                compact ? "4.2" : "5.2"
              }" class="creator-stats-line-point is-latest"></circle>
        <text x="${Math.max(paddingX + 22, latestX - 6).toFixed(2)}" y="${Math.max(
                compact ? 12 : 14,
                latestY - (compact ? 8 : 12)
              ).toFixed(2)}" text-anchor="end" class="creator-stats-line-callout">
          ${escapeHtml(formatNumber(points[points.length - 1]))}
        </text>`
            : ""
        }
      </svg>
      ${
        showMeta
          ? `<div class="creator-stats-line-meta">
        <span>30 points</span>
        <span>Min ${escapeHtml(formatNumber(min))}</span>
        <span>Max ${escapeHtml(formatNumber(max))}</span>
        <span>Net ${escapeHtml(formatSignedNumber(netChange))}</span>
        <span>Avg delta ${escapeHtml(formatSignedNumber(Math.round(avgDelta)))}</span>
        <span>7pt avg ${escapeHtml(formatNumber(avg7))}</span>
      </div>`
          : ""
      }
    `;
  }

  function buildDonutChartMarkup(platformShare, options = {}) {
    const qualityLegend = options.qualityLegend || null;
    const escapeHtml = options.escapeHtml || defaultEscapeHtml;
    const formatNumber = options.formatNumber || defaultFormatNumber;
    const createQualityBadge = options.createQualityBadge || (() => "");
    const showLegend = options.showLegend !== false;
    const compact = options.compact === true;
    const ariaLabel = defaultNormalizeText(options.ariaLabel, "Audience share by platform");

    const active = Array.isArray(platformShare?.byPlatform)
      ? platformShare.byPlatform.filter((channel) => Number(channel.followersTotal) > 0)
      : [];

    if (!active.length) {
      return '<p class="muted">No platform share values available.</p>';
    }

    const total =
      Number(platformShare?.totals?.followersTotal) ||
      active.reduce((sum, channel) => sum + Number(channel.followersTotal || 0), 0);
    if (total <= 0) {
      return '<p class="muted">No platform share values available.</p>';
    }

    const colors = options.colors || ["#7b8cff", "#55d1b6", "#f0b253", "#fb7f7f", "#8ccf36", "#86a6ff"];
    const viewSize = 144;
    const center = viewSize / 2;
    const radius = compact ? 52 : 56;
    const strokeWidth = compact ? 12 : 14;
    const circumference = 2 * Math.PI * radius;
    let consumed = 0;

    const segments = active
      .map((channel, index) => {
        const value = Number(channel.followersTotal ?? channel.totalCount ?? 0);
        const fraction = value / total;
        const arcLength = fraction * circumference;
        const markup = `
          <circle
            cx="${center}"
            cy="${center}"
            r="${radius}"
            fill="none"
            stroke="${colors[index % colors.length]}"
            stroke-width="${strokeWidth}"
            stroke-linecap="butt"
            stroke-dasharray="${arcLength.toFixed(3)} ${(circumference - arcLength).toFixed(3)}"
            stroke-dashoffset="${(-consumed).toFixed(3)}"
          ></circle>
        `;
        consumed += arcLength;
        return markup;
      })
      .join("");

    const legend = showLegend
      ? active
          .map((channel, index) => {
            const value = Number(channel.followersTotal || 0);
            const share = total > 0 ? Math.round((value / total) * 1000) / 10 : 0;
            return `
              <li>
                <span class="creator-stats-donut-swatch" style="--swatch-color: ${
                  colors[index % colors.length]
                };"></span>
                <span>${escapeHtml(channel.platformLabel)}</span>
                <span>${escapeHtml(formatNumber(value))} (${share}%) ${createQualityBadge(
              channel.quality,
              qualityLegend
            )}</span>
              </li>
            `;
          })
          .join("")
      : "";

    return `
      <div class="creator-stats-donut-wrap ${compact ? "is-mini" : ""}">
        <svg class="creator-stats-donut-svg ${compact ? "is-mini" : ""}" viewBox="0 0 ${viewSize} ${viewSize}" role="img" aria-label="${escapeHtml(
      ariaLabel
    )}">
          <circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="${strokeWidth}"></circle>
          <g transform="rotate(-90 ${center} ${center})">
            ${segments}
          </g>
          <text x="${center}" y="${center}" text-anchor="middle" dominant-baseline="middle" class="creator-stats-donut-center-label">
            <tspan x="${center}" dy="-0.55em" class="creator-stats-donut-center-label-top">TOTAL</tspan>
            <tspan x="${center}" dy="1.15em" class="creator-stats-donut-center-label-value">${escapeHtml(
              formatNumber(total)
            )}</tspan>
          </text>
        </svg>
      </div>
      ${showLegend ? `<ul class="creator-stats-donut-legend">${legend}</ul>` : ""}
    `;
  }

  window.StreamSuitesStatsSvgCharts = {
    buildLineChartMarkup,
    buildDonutChartMarkup
  };
})();
