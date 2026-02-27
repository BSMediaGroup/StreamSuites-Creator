(() => {
  "use strict";

  const API_BASE_URL = "https://api.streamsuites.app";
  const STATS_PATH = "/api/creator/stats";
  const UPDATE_EVENT = "streamsuites:creator-stats-updated";
  const DEFAULT_TIMEOUT_MS = 8000;
  const formatter = window.StreamSuitesStatsFormatting;
  const svgCharts = window.StreamSuitesStatsSvgCharts;

  const DEFAULT_QUALITY_LEGEND = Object.freeze({
    exact: "Direct platform metric captured from primary source.",
    approximate: "Estimate where only coarse granularity is available.",
    partial: "Subset value where one or more sources are missing.",
    derived: "Computed from other metrics in this payload.",
    unavailable: "Value is currently not available in Phase 0."
  });
  const QUALITY_MARKER_ICON_PATHS = Object.freeze({
    exact: "/assets/icons/ui/tickyeslarge.svg",
    approximate: "/assets/icons/ui/approx.svg",
    partial: "/assets/icons/ui/add.svg",
    derived: "/assets/icons/ui/asterisk.svg",
    unavailable: "/assets/icons/ui/minus.svg"
  });

  const FETCH_STATUS = Object.freeze({
    idle: "idle",
    loading: "loading",
    success: "success",
    error: "error"
  });

  const storeState = {
    status: FETCH_STATUS.idle,
    cache: null,
    raw: null,
    hasAttempted: false,
    inFlight: null,
    lastFetchAt: 0,
    error: null
  };

  function normalizeText(value, fallback = "") {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    return fallback;
  }

  function normalizeInteger(value) {
    if (value === null || value === undefined || value === "") return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    return Math.round(parsed);
  }

  function normalizeRatio(value) {
    if (value === null || value === undefined || value === "") return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    if (parsed > 1 && parsed <= 100) {
      return Math.max(0, Math.min(1, parsed / 100));
    }
    return Math.max(0, Math.min(1, parsed));
  }

  function normalizeQuality(value) {
    if (formatter?.normalizeQuality) {
      return formatter.normalizeQuality(value);
    }
    const normalized = normalizeText(value, "").toLowerCase();
    if (!normalized) return "unavailable";
    if (normalized === "estimated") return "approximate";
    if (normalized === "direct") return "exact";
    if (
      normalized === "exact" ||
      normalized === "approximate" ||
      normalized === "partial" ||
      normalized === "derived" ||
      normalized === "unavailable"
    ) {
      return normalized;
    }
    return "unavailable";
  }

  function chooseQuality(values) {
    const ranked = ["exact", "derived", "approximate", "partial", "unavailable"];
    const normalized = Array.isArray(values) ? values.map((entry) => normalizeQuality(entry)) : [];
    for (const rank of ranked) {
      if (normalized.includes(rank)) return rank;
    }
    return "unavailable";
  }

  function normalizePlatformKey(value, fallback = "platform") {
    const candidate = normalizeText(value, "").toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
    return candidate || fallback;
  }

  function formatPlatformLabel(platformKey) {
    const normalized = normalizePlatformKey(platformKey);
    if (normalized === "youtube") return "YouTube";
    if (normalized === "twitch") return "Twitch";
    if (normalized === "rumble") return "Rumble";
    if (normalized === "kick") return "Kick";
    if (normalized === "discord") return "Discord";
    if (normalized === "pilled") return "Pilled";
    if (!normalized) return "Platform";
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }

  function safeParse(raw) {
    if (typeof raw !== "string" || !raw.trim()) return null;
    try {
      return JSON.parse(raw);
    } catch (_err) {
      return null;
    }
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function resolveStatsEndpoint() {
    const sessionEndpoint = window.StreamSuitesAuth?.endpoints?.session;
    if (typeof sessionEndpoint === "string" && sessionEndpoint.trim()) {
      try {
        const resolved = new URL(sessionEndpoint, window.location.origin);
        return `${resolved.origin}${STATS_PATH}`;
      } catch (_err) {
        // Fall through.
      }
    }
    return `${API_BASE_URL}${STATS_PATH}`;
  }

  function getFetchWithTimeout() {
    if (typeof window.fetchWithTimeout === "function") {
      return window.fetchWithTimeout;
    }

    return async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), timeoutMs);
      try {
        return await fetch(url, {
          ...options,
          signal: controller.signal
        });
      } finally {
        window.clearTimeout(timer);
      }
    };
  }

  function hashString(input) {
    let hash = 0;
    const source = String(input || "");
    for (let i = 0; i < source.length; i += 1) {
      hash = (hash << 5) - hash + source.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  function createSeededRng(seedInput) {
    let seed = Math.max(1, Math.abs(Number(seedInput) || 1)) % 2147483647;
    return () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
  }

  function normalizeQualityLegend(rawLegend) {
    if (formatter?.resolveLegend) {
      return formatter.resolveLegend(rawLegend);
    }
    return { ...DEFAULT_QUALITY_LEGEND };
  }

  function normalizeChannels(rawChannels) {
    const channels = Array.isArray(rawChannels) ? rawChannels : [];
    return channels
      .map((channel, index) => {
        if (!channel || typeof channel !== "object") return null;

        const platform = normalizePlatformKey(channel.platform, `platform${index + 1}`);
        const followerCount = normalizeInteger(
          channel.follower_count ?? channel.followers ?? channel.followerCount
        );
        const subscriberCount = normalizeInteger(
          channel.subscriber_count ?? channel.subscribers ?? channel.subscriberCount
        );

        let totalCount = null;
        if (followerCount !== null || subscriberCount !== null) {
          totalCount = (followerCount || 0) + (subscriberCount || 0);
        }

        return {
          platform,
          platformLabel: formatPlatformLabel(platform),
          displayName: normalizeText(channel.display_name, ""),
          handle: normalizeText(channel.handle, ""),
          url: normalizeText(channel.url, ""),
          followerCount,
          followerCountQuality: normalizeQuality(channel.follower_count_quality),
          subscriberCount,
          subscriberCountQuality: normalizeQuality(channel.subscriber_count_quality),
          totalCount,
          totalCountQuality: chooseQuality([
            channel.follower_count_quality,
            channel.subscriber_count_quality
          ])
        };
      })
      .filter(Boolean);
  }

  function normalizeDeltaBucket(rawBucket) {
    const bucket = rawBucket && typeof rawBucket === "object" ? rawBucket : {};
    const byPlatformRaw =
      bucket.by_platform && typeof bucket.by_platform === "object" ? bucket.by_platform : {};

    const byPlatform = {};
    Object.entries(byPlatformRaw).forEach(([platformKey, payload]) => {
      if (!payload || typeof payload !== "object") return;
      const platform = normalizePlatformKey(platformKey);
      if (!platform) return;
      byPlatform[platform] = {
        delta: normalizeInteger(payload.delta) || 0,
        quality: normalizeQuality(payload.quality)
      };
    });

    return {
      value: normalizeInteger(bucket.audience_delta) || 0,
      quality: normalizeQuality(bucket.audience_delta_quality),
      byPlatform
    };
  }

  function normalizeGrowth(rawGrowth, channels) {
    const growth = rawGrowth && typeof rawGrowth === "object" ? rawGrowth : {};
    const totals = growth.totals && typeof growth.totals === "object" ? growth.totals : {};
    const deltas = growth.deltas && typeof growth.deltas === "object" ? growth.deltas : {};

    const fallbackAudienceTotal = channels.reduce((sum, channel) => {
      return channel.totalCount !== null ? sum + channel.totalCount : sum;
    }, 0);

    const deltaDay = normalizeDeltaBucket(deltas.day || deltas["24h"] || deltas.daily || {});
    const deltaWeek = normalizeDeltaBucket(deltas.week || deltas["7d"] || deltas.weekly || {});
    const deltaMonth = normalizeDeltaBucket(deltas.month || deltas["30d"] || deltas.monthly || {});
    const deltaYear = normalizeDeltaBucket(deltas.year || deltas["1y"] || deltas.yearly || {});

    return {
      totals: {
        audienceTotal:
          normalizeInteger(totals.audience_total ?? totals.total_audience) ?? fallbackAudienceTotal,
        audienceTotalQuality: normalizeQuality(totals.audience_total_quality),
        platformsConnected:
          normalizeInteger(totals.platforms_connected ?? totals.connected_platforms) ??
          channels.length,
        platformsConnectedQuality: normalizeQuality(totals.platforms_connected_quality)
      },
      deltas: {
        day: deltaDay,
        week: deltaWeek,
        month: deltaMonth,
        year: deltaYear
      }
    };
  }

  function normalizeLatestStream(rawLatestStream) {
    const latest = rawLatestStream && typeof rawLatestStream === "object" ? rawLatestStream : {};
    const platforms = Array.isArray(latest.platforms) ? latest.platforms : [];

    const normalizedPlatforms = platforms
      .map((entry, index) => {
        if (!entry || typeof entry !== "object") return null;
        const platform = normalizePlatformKey(entry.platform, `platform${index + 1}`);
        return {
          platform,
          platformLabel: formatPlatformLabel(platform),
          url: normalizeText(entry.url, ""),
          viewCount: normalizeInteger(entry.view_count ?? entry.views),
          viewCountQuality: normalizeQuality(entry.view_count_quality),
          peakViewers: normalizeInteger(entry.peak_viewers),
          peakViewersQuality: normalizeQuality(entry.peak_viewers_quality),
          avgViewers: normalizeInteger(entry.avg_viewers),
          avgViewersQuality: normalizeQuality(entry.avg_viewers_quality)
        };
      })
      .filter(Boolean);

    const platformViewTotal = normalizedPlatforms.reduce((sum, platform) => {
      return platform.viewCount !== null ? sum + platform.viewCount : sum;
    }, 0);

    let durationSeconds = normalizeInteger(latest.duration_seconds ?? latest.duration);
    const startedAtUtc = normalizeText(latest.started_at_utc, "");
    const endedAtUtc = normalizeText(latest.ended_at_utc, "");

    if (durationSeconds === null && startedAtUtc && endedAtUtc) {
      const startMs = Date.parse(startedAtUtc);
      const endMs = Date.parse(endedAtUtc);
      if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs >= startMs) {
        durationSeconds = Math.round((endMs - startMs) / 1000);
      }
    }

    return {
      title: normalizeText(latest.title, "Latest stream unavailable"),
      startedAtUtc,
      endedAtUtc,
      durationSeconds,
      durationSecondsQuality: normalizeQuality(latest.duration_seconds_quality),
      viewCountTotal:
        normalizeInteger(latest.view_count_total ?? latest.total_views) ??
        (platformViewTotal > 0 ? platformViewTotal : null),
      viewCountTotalQuality: normalizeQuality(latest.view_count_total_quality),
      platforms: normalizedPlatforms
    };
  }

  function normalizeRecentStreams(rawRecentStreams) {
    const streams = Array.isArray(rawRecentStreams) ? rawRecentStreams : [];
    return streams
      .map((entry, index) => {
        if (!entry || typeof entry !== "object") return null;

        const urls =
          entry.platform_urls && typeof entry.platform_urls === "object" ? entry.platform_urls : {};
        const normalizedUrls = {};
        Object.entries(urls).forEach(([platformKey, platformUrl]) => {
          const platform = normalizePlatformKey(platformKey);
          const url = normalizeText(platformUrl, "");
          if (!platform || !url) return;
          normalizedUrls[platform] = url;
        });

        return {
          title: normalizeText(entry.title, `Recent stream #${index + 1}`),
          startedAtUtc: normalizeText(entry.started_at_utc, ""),
          endedAtUtc: normalizeText(entry.ended_at_utc, ""),
          durationSeconds: normalizeInteger(entry.duration_seconds),
          platformUrls: normalizedUrls
        };
      })
      .filter(Boolean);
  }
  function normalizeAutomationBlock(rawBlock) {
    const block = rawBlock && typeof rawBlock === "object" ? rawBlock : {};
    return {
      triggersInvoked: normalizeInteger(block.triggers_invoked),
      clipsCreated: normalizeInteger(block.clips_created),
      jobsRun: normalizeInteger(block.jobs_run),
      automationSuccessRate: normalizeRatio(block.automation_success_rate),
      errorsCount: normalizeInteger(block.errors_count),
      notes: normalizeText(block.notes, "")
    };
  }

  function normalizeAutomationRoi(rawAutomation) {
    const automation = rawAutomation && typeof rawAutomation === "object" ? rawAutomation : {};
    return {
      latestStream: normalizeAutomationBlock(
        automation.latest_stream || automation.latest || automation.current || automation
      ),
      rolling7d: normalizeAutomationBlock(automation.rolling_7d || automation.week || {}),
      rolling30d: normalizeAutomationBlock(automation.rolling_30d || automation.month || {})
    };
  }

  function normalizeSeriesFromArray(rawArray) {
    if (!Array.isArray(rawArray)) return [];

    const points = rawArray
      .map((entry) => {
        if (typeof entry === "number") {
          return Number.isFinite(entry) ? Math.max(0, Math.round(entry)) : null;
        }
        if (entry && typeof entry === "object") {
          const candidate =
            normalizeInteger(entry.value) ??
            normalizeInteger(entry.audience) ??
            normalizeInteger(entry.total) ??
            normalizeInteger(entry.count);
          return candidate !== null ? Math.max(0, candidate) : null;
        }
        return null;
      })
      .filter((entry) => entry !== null);

    if (!points.length) return [];
    if (points.length >= 30) return points.slice(-30);

    const padded = points.slice();
    while (padded.length < 30) {
      padded.unshift(padded[0]);
    }
    return padded;
  }

  function normalizeGrowthSeriesPoints(rawGrowthSeries) {
    const growthSeries = rawGrowthSeries && typeof rawGrowthSeries === "object" ? rawGrowthSeries : {};
    const dailyPoints = Array.isArray(growthSeries.daily_points) ? growthSeries.daily_points : [];
    return dailyPoints
      .map((point) => {
        if (!point || typeof point !== "object") return null;
        const totals = point.totals && typeof point.totals === "object" ? point.totals : {};
        return {
          dateUtc: normalizeText(point.date_utc, ""),
          followersTotal: normalizeInteger(totals.followers_total),
          viewsTotal: normalizeInteger(totals.views_total),
          qualityFollowersTotal: normalizeQuality(point.quality?.followers_total),
          qualityViewsTotal: normalizeQuality(point.quality?.views_total)
        };
      })
      .filter((entry) => entry && (entry.followersTotal !== null || entry.viewsTotal !== null));
  }

  function buildDeterministicSeries(payload) {
    const audienceTotal = Math.max(0, normalizeInteger(payload?.growth?.totals?.audienceTotal) || 0);
    const monthDelta = normalizeInteger(payload?.growth?.deltas?.month?.value) || 0;
    const points = new Array(30).fill(audienceTotal);
    const seed = hashString(
      `${payload?.accountId || ""}|${payload?.generatedAtUtc || ""}|${audienceTotal}|${monthDelta}`
    );
    const rng = createSeededRng(seed);

    const baseline = audienceTotal - monthDelta;
    const drift = monthDelta;
    const variance = Math.max(32, Math.round(Math.max(80, Math.abs(monthDelta)) * 0.1));

    for (let index = 0; index < points.length; index += 1) {
      const progress = index / (points.length - 1);
      const trend = baseline + drift * progress;
      const wave =
        Math.sin((index + (seed % 9)) * 0.58) * variance * 0.95 +
        Math.cos((index + (seed % 13)) * 0.35) * variance * 0.7;
      const noise = (rng() - 0.5) * variance * 0.9;
      const dip = index > 2 && index % 7 === 0 ? -variance * (0.45 + rng() * 0.45) : 0;
      const rebound = index > 3 && (index + 2) % 7 === 0 ? variance * (0.2 + rng() * 0.35) : 0;
      points[index] = Math.max(0, Math.round(trend + wave + noise + dip + rebound));
    }

    for (let index = 1; index < points.length - 1; index += 1) {
      points[index] = Math.max(
        0,
        Math.round(points[index - 1] * 0.22 + points[index] * 0.56 + points[index + 1] * 0.22)
      );
    }

    points[points.length - 1] = audienceTotal;
    return points;
  }

  function resolveGrowthSeries(rawGrowthSeries, rawGrowth, normalizedPayload) {
    const normalizedPoints = normalizeGrowthSeriesPoints(rawGrowthSeries);
    if (normalizedPoints.length) {
      return normalizedPoints
        .map((entry) => entry.followersTotal)
        .filter((entry) => entry !== null)
        .slice(-30);
    }

    const growth = rawGrowth && typeof rawGrowth === "object" ? rawGrowth : {};
    const directCandidates = [
      growth.series,
      growth.audience_series,
      growth.audienceSeries,
      growth.points,
      growth.last_30,
      growth.last30
    ];

    for (const candidate of directCandidates) {
      const normalized = normalizeSeriesFromArray(candidate);
      if (normalized.length) return normalized;
    }

    return buildDeterministicSeries(normalizedPayload);
  }

  function resolveGrowthSeriesDateLabels(rawGrowthSeries) {
    const normalizedPoints = normalizeGrowthSeriesPoints(rawGrowthSeries);
    if (!normalizedPoints.length) return [];
    return normalizedPoints
      .filter((entry) => entry.followersTotal !== null)
      .slice(-30)
      .map((entry) => formatCompactDateLabel(entry.dateUtc));
  }

  function normalizePlatformShare(rawPlatformShare, channels) {
    const platformShare =
      rawPlatformShare && typeof rawPlatformShare === "object" ? rawPlatformShare : {};
    const totals = platformShare.totals && typeof platformShare.totals === "object" ? platformShare.totals : {};
    const byPlatformRaw =
      platformShare.by_platform && typeof platformShare.by_platform === "object"
        ? platformShare.by_platform
        : {};
    const qualityRaw = platformShare.quality && typeof platformShare.quality === "object" ? platformShare.quality : {};
    const qualityByPlatformRaw =
      qualityRaw.by_platform && typeof qualityRaw.by_platform === "object" ? qualityRaw.by_platform : {};

    const allPlatforms = new Set();
    Object.keys(byPlatformRaw).forEach((platform) => {
      allPlatforms.add(normalizePlatformKey(platform));
    });
    (Array.isArray(channels) ? channels : []).forEach((channel) => {
      if (channel?.platform) allPlatforms.add(normalizePlatformKey(channel.platform));
    });

    const byPlatform = Array.from(allPlatforms)
      .filter(Boolean)
      .map((platformKey) => {
        const rawEntry = byPlatformRaw[platformKey];
        const entry = rawEntry && typeof rawEntry === "object" ? rawEntry : {};
        const fallbackChannel = (Array.isArray(channels) ? channels : []).find(
          (channel) => channel.platform === platformKey
        );
        const followersTotal =
          normalizeInteger(entry.followers_total) ?? normalizeInteger(fallbackChannel?.totalCount);
        const qualityEntry = qualityByPlatformRaw[platformKey];
        return {
          platform: platformKey,
          platformLabel: formatPlatformLabel(platformKey),
          followersTotal,
          quality:
            typeof qualityEntry === "object"
              ? normalizeQuality(qualityEntry.followers_total)
              : normalizeQuality(qualityEntry)
        };
      });

    const fallbackTotal = byPlatform.reduce((sum, platform) => {
      return platform.followersTotal !== null ? sum + platform.followersTotal : sum;
    }, 0);

    return {
      totals: {
        followersTotal:
          normalizeInteger(totals.followers_total) ??
          (fallbackTotal > 0 ? fallbackTotal : null),
        followersTotalQuality: normalizeQuality(qualityRaw.followers_total)
      },
      byPlatform
    };
  }

  function normalizeStatsPayload(rawPayload) {
    const payload = rawPayload && typeof rawPayload === "object" ? rawPayload : {};
    const data = payload.data && typeof payload.data === "object" ? payload.data : {};

    const channels = normalizeChannels(data.channels);
    const growth = normalizeGrowth(data.growth, channels);

    const channelsWithGrowth = channels.map((channel) => {
      const weekPlatform = growth.deltas.week.byPlatform[channel.platform] || null;
      return {
        ...channel,
        deltaWeek: weekPlatform ? weekPlatform.delta : null,
        deltaWeekQuality: weekPlatform ? weekPlatform.quality : "unavailable"
      };
    });

    const normalized = {
      schemaVersion: normalizeText(payload.schema_version, "creator_stats_v1"),
      generatedAtUtc: normalizeText(payload.generated_at_utc, ""),
      accountId: normalizeText(payload.account_id, ""),
      qualityLegend: normalizeQualityLegend(data.data_quality_legend),
      channels: channelsWithGrowth,
      growth,
      platformShare: normalizePlatformShare(data.platform_share, channelsWithGrowth),
      latestStream: normalizeLatestStream(data.latest_stream),
      recentStreams: normalizeRecentStreams(data.recent_streams),
      automationRoi: normalizeAutomationRoi(data.automation_roi)
    };

    normalized.growthSeries = resolveGrowthSeries(data.growth_series, data.growth, normalized);
    normalized.growthSeriesDateLabels = resolveGrowthSeriesDateLabels(data.growth_series);
    return normalized;
  }

  function normalizeRequestError(err) {
    if (!err || typeof err !== "object") {
      return { message: "Creator statistics request failed." };
    }

    if (err.name === "AbortError") {
      return { message: "Creator statistics request timed out." };
    }

    const status = Number.isFinite(err.status) ? Number(err.status) : null;
    const message = normalizeText(err.message, "Creator statistics request failed.");
    if (status !== null) {
      return { message, status };
    }
    return { message };
  }

  function emitStoreUpdate() {
    try {
      window.dispatchEvent(
        new CustomEvent(UPDATE_EVENT, {
          detail: getStoreStatus()
        })
      );
    } catch (_err) {
      // Ignore dispatch errors.
    }
  }

  function createStatusError(message, status = null) {
    const err = new Error(normalizeText(message, "Creator statistics request failed."));
    if (status !== null) {
      err.status = status;
    }
    return err;
  }

  async function hydrateStats(options = {}) {
    const force = options?.force === true;
    const timeoutMs = Number.isFinite(options?.timeoutMs)
      ? Math.max(1000, Number(options.timeoutMs))
      : DEFAULT_TIMEOUT_MS;

    if (storeState.inFlight) {
      return storeState.inFlight;
    }

    if (!force && storeState.cache) {
      return storeState.cache;
    }

    if (!force && storeState.hasAttempted && !storeState.cache && storeState.error) {
      const cachedError = storeState.error;
      throw createStatusError(cachedError.message, cachedError.status ?? null);
    }

    const fetchWithTimeout = getFetchWithTimeout();
    storeState.status = FETCH_STATUS.loading;
    if (force) {
      storeState.error = null;
    }
    emitStoreUpdate();

    storeState.inFlight = (async () => {
      try {
        const response = await fetchWithTimeout(
          resolveStatsEndpoint(),
          {
            method: "GET",
            credentials: "include",
            headers: {
              Accept: "application/json"
            }
          },
          timeoutMs
        );

        const rawText = await response.text();
        const payload = safeParse(rawText);

        if (!response.ok) {
          const apiMessage = normalizeText(payload?.error, "");
          throw createStatusError(
            apiMessage || `Creator statistics request failed with status ${response.status}.`,
            response.status
          );
        }

        if (!payload || typeof payload !== "object") {
          throw createStatusError("Creator statistics payload was invalid.");
        }

        if (payload.success === false) {
          throw createStatusError(
            normalizeText(payload.error, "Creator statistics API returned success:false.")
          );
        }

        const normalized = normalizeStatsPayload(payload);
        storeState.cache = normalized;
        storeState.raw = payload;
        storeState.error = null;
        storeState.status = FETCH_STATUS.success;
        storeState.hasAttempted = true;
        storeState.lastFetchAt = Date.now();
        return normalized;
      } catch (err) {
        const normalizedError = normalizeRequestError(err);
        storeState.error = normalizedError;
        storeState.hasAttempted = true;
        storeState.status = storeState.cache ? FETCH_STATUS.success : FETCH_STATUS.error;

        if (!storeState.cache) {
          throw createStatusError(normalizedError.message, normalizedError.status ?? null);
        }

        return storeState.cache;
      } finally {
        storeState.inFlight = null;
        emitStoreUpdate();
      }
    })();

    return storeState.inFlight;
  }

  function refreshStats(options = {}) {
    return hydrateStats({ ...options, force: true });
  }

  function getStoreStatus() {
    return {
      status: storeState.status,
      hasAttempted: storeState.hasAttempted,
      hasCache: Boolean(storeState.cache),
      lastFetchAt: storeState.lastFetchAt,
      generatedAtUtc: storeState.cache?.generatedAtUtc || "",
      error: storeState.error ? { ...storeState.error } : null
    };
  }

  function getCachedStats() {
    return storeState.cache;
  }

  function getStatsStore() {
    if (!window.StreamSuitesCreatorStatsStore) {
      window.StreamSuitesCreatorStatsStore = {
        UPDATE_EVENT,
        hydrate: hydrateStats,
        refresh: refreshStats,
        getStatus: getStoreStatus,
        getCachedStats
      };
    }
    return window.StreamSuitesCreatorStatsStore;
  }

  function formatNumber(value) {
    if (value === null || value === undefined || value === "") return "—";
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return "—";
    return parsed.toLocaleString();
  }

  function formatSignedNumber(value) {
    if (!Number.isFinite(value)) return "—";
    if (value > 0) return `+${formatNumber(value)}`;
    if (value < 0) return `-${formatNumber(Math.abs(value))}`;
    return "0";
  }

  function formatPercentFromRatio(value) {
    if (!Number.isFinite(value)) return "—";
    return `${Math.round(value * 100)}%`;
  }

  function formatDateTime(timestamp) {
    if (!timestamp) return "—";
    const parsed = new Date(timestamp);
    if (Number.isNaN(parsed.getTime())) return "—";
    return parsed.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function formatDuration(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "—";
    const totalSeconds = Math.round(seconds);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  }

  function formatCompactDateLabel(value) {
    const raw = normalizeText(value, "");
    if (!raw) return "";
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return raw;
    try {
      return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric"
      });
    } catch (_err) {
      return raw;
    }
  }

  function formatMetricWithQuality(value, quality, legend, metricFormatter = formatNumber) {
    if (formatter?.formatValue) {
      return formatter.formatValue(value, {
        quality,
        formatter: metricFormatter,
        legend,
        unavailableTitle: "Not available"
      });
    }
    return {
      displayText: value === null || value === undefined ? "—" : metricFormatter(value),
      titleText: "Not available",
      suffix: "",
      quality: normalizeQuality(quality)
    };
  }

  function getQualityMarker(quality, options = {}) {
    const normalized = normalizeQuality(quality);
    if (normalized === "approximate") return "\u2248";
    if (normalized === "partial") return "+";
    if (normalized === "derived") return "*";
    if (normalized === "unavailable" && options.includeUnavailable === true) return "—";
    return "";
  }

  function getQualityMarkerIconPath(quality, options = {}) {
    const normalized = normalizeQuality(quality);
    if (normalized === "exact") return QUALITY_MARKER_ICON_PATHS.exact;
    if (normalized === "approximate") return QUALITY_MARKER_ICON_PATHS.approximate;
    if (normalized === "partial") return QUALITY_MARKER_ICON_PATHS.partial;
    if (normalized === "derived") return QUALITY_MARKER_ICON_PATHS.derived;
    if (normalized === "unavailable" && options.includeUnavailable === true) {
      return QUALITY_MARKER_ICON_PATHS.unavailable;
    }
    return "";
  }

  function getQualityDescription(quality, legend) {
    const normalized = normalizeQuality(quality);
    return legend?.[normalized] || DEFAULT_QUALITY_LEGEND[normalized] || "Quality unavailable.";
  }

  function createQualityBadge(quality, legend, options = {}) {
    const marker = getQualityMarker(quality, options);
    const iconPath = getQualityMarkerIconPath(quality, options);
    if (!marker && !iconPath) return "";
    const description = escapeHtml(getQualityDescription(quality, legend));
    if (iconPath) {
      return `
        <span class="creator-stats-quality-marker" title="${description}" aria-label="${description}">
          <span
            class="creator-stats-quality-marker-icon"
            style="--quality-marker-icon: url('${escapeHtml(iconPath)}')"
            aria-hidden="true"
          ></span>
        </span>
      `;
    }
    return `<span class="creator-stats-quality-marker" title="${description}">${marker}</span>`;
  }

  function buildQualityLegendInlineItem(quality, label, legend) {
    const description = getQualityDescription(quality, legend);
    return `<span title="${escapeHtml(description)}">${createQualityBadge(quality, legend, {
      includeUnavailable: quality === "unavailable"
    })} ${escapeHtml(label)}</span>`;
  }

  function formatValueWithQuality(value, quality, legend, formatter = formatNumber) {
    const formatted = formatMetricWithQuality(value, quality, legend, formatter);
    const badge = createQualityBadge(quality, legend);
    const display = escapeHtml(formatted.displayText);
    return badge
      ? `<span title="${escapeHtml(formatted.titleText)}">${display}</span> ${badge}`
      : `<span title="${escapeHtml(formatted.titleText)}">${display}</span>`;
  }

  function indicatorClass(delta) {
    if (delta > 0) return "is-up";
    if (delta < 0) return "is-down";
    return "is-flat";
  }

  function indicatorGlyph(delta) {
    if (delta > 0) return "▲";
    if (delta < 0) return "▼";
    return "•";
  }

  function buildOverviewMiniSkeletonMarkup(message) {
    return `
      <div class="creator-overview-stats-mini-skeleton">
        <span class="creator-overview-stats-mini-line"></span>
        <span class="creator-overview-stats-mini-line short"></span>
      </div>
      <p class="muted">${escapeHtml(normalizeText(message, "Mini analytics pending"))}</p>
    `;
  }

  function buildOverviewMiniAnalyticsMarkup(stats) {
    if (!stats || !svgCharts) {
      return buildOverviewMiniSkeletonMarkup("Mini analytics unavailable");
    }

    const line = svgCharts.buildLineChartMarkup(stats.growthSeries, {
      compact: true,
      showAxis: false,
      showDeltaBars: false,
      showMeta: false,
      showMovingAverage: false,
      showCallout: true,
      ariaLabel: "Audience growth mini chart",
      formatNumber,
      formatSignedNumber,
      escapeHtml,
      normalizeText
    });

    const donut = svgCharts.buildDonutChartMarkup(stats.platformShare, {
      compact: true,
      showLegend: false,
      ariaLabel: "Platform share mini donut",
      qualityLegend: stats.qualityLegend,
      formatNumber,
      createQualityBadge,
      escapeHtml
    });

    return `
      <div class="creator-overview-stats-mini-grid">
        <section class="creator-overview-stats-mini-panel">
          <h4>Audience growth</h4>
          ${line}
        </section>
        <section class="creator-overview-stats-mini-panel">
          <h4>Platform share</h4>
          ${donut}
        </section>
      </div>
    `;
  }

  function renderOverviewSnapshotCard(status, stats) {
    const card = document.querySelector("[data-overview-stats-card]");
    if (!card) return;

    const statusPill = card.querySelector("[data-overview-stats-status]");
    const titleEl = card.querySelector("[data-overview-stats-title]");
    const totalEl = card.querySelector("[data-overview-stats-total]");
    const metaEl = card.querySelector("[data-overview-stats-meta]");
    const platformsEl = card.querySelector("[data-overview-stats-platforms]");
    const updatedEl = card.querySelector("[data-overview-stats-last-updated]");
    const loadBtn = card.querySelector("[data-overview-stats-load]");
    const miniEl = card.querySelector("[data-overview-stats-mini]");

    if (
      !statusPill ||
      !titleEl ||
      !totalEl ||
      !metaEl ||
      !platformsEl ||
      !updatedEl ||
      !loadBtn ||
      !miniEl
    ) {
      return;
    }

    const hasData = !!stats;
    const loading = status.status === FETCH_STATUS.loading && !hasData;
    const error = !hasData && status.status === FETCH_STATUS.error ? status.error : null;

    statusPill.classList.remove("success", "warning", "subtle");

    if (loading) {
      statusPill.classList.add("subtle");
      statusPill.textContent = "Loading stats";
      titleEl.textContent = "Hydrating latest stream snapshot...";
      totalEl.textContent = "—";
      metaEl.textContent = "Preparing platform breakdown";
      platformsEl.textContent = "Loading...";
      updatedEl.textContent = "Last updated: —";
      loadBtn.classList.add("hidden");
      miniEl.innerHTML = buildOverviewMiniSkeletonMarkup("Hydrating mini analytics...");
      return;
    }

    if (error) {
      statusPill.classList.add("warning");
      statusPill.textContent = "Stats unavailable";
      titleEl.textContent = "Latest stream snapshot unavailable";
      totalEl.textContent = "—";
      metaEl.textContent = normalizeText(error.message, "Unable to load stats right now.");
      platformsEl.textContent = "No platform breakdown yet";
      updatedEl.textContent = "Last updated: —";
      loadBtn.classList.remove("hidden");
      miniEl.innerHTML = buildOverviewMiniSkeletonMarkup("Mini analytics pending stats");
      return;
    }

    if (!hasData) {
      statusPill.classList.add("subtle");
      statusPill.textContent = "Ready";
      titleEl.textContent = "Load creator stats to view the latest stream snapshot";
      totalEl.textContent = "—";
      metaEl.textContent = "Audience and stream summary";
      platformsEl.textContent = "No platform breakdown yet";
      updatedEl.textContent = "Last updated: —";
      loadBtn.classList.remove("hidden");
      miniEl.innerHTML = buildOverviewMiniSkeletonMarkup("Load stats to render mini analytics");
      return;
    }

    const latest = stats.latestStream;
    const platformSummary = latest.platforms
      .filter((entry) => entry.viewCount !== null)
      .map((entry) => {
        const formatted = formatMetricWithQuality(
          entry.viewCount,
          entry.viewCountQuality,
          stats.qualityLegend,
          formatNumber
        );
        return `${entry.platformLabel}: ${formatted.displayText}`;
      })
      .join(" | ");

    const totalViewsFormatted = formatMetricWithQuality(
      latest.viewCountTotal,
      latest.viewCountTotalQuality,
      stats.qualityLegend,
      formatNumber
    );

    statusPill.classList.add("success");
    statusPill.textContent = "Stats synced";
    titleEl.textContent = latest.title || "Latest stream unavailable";
    totalEl.textContent = totalViewsFormatted.displayText;
    metaEl.textContent = `Duration ${formatDuration(latest.durationSeconds)} | Started ${formatDateTime(
      latest.startedAtUtc
    )}`;
    platformsEl.textContent = platformSummary || "No per-platform view counts exported";
    updatedEl.textContent = `Last updated: ${formatDateTime(stats.generatedAtUtc)}`;
    loadBtn.classList.add("hidden");
    miniEl.innerHTML = buildOverviewMiniAnalyticsMarkup(stats);
  }

  function bindOverviewHandlers() {
    const card = document.querySelector("[data-overview-stats-card]");
    if (!card) return () => {};

    const loadBtn = card.querySelector("[data-overview-stats-load]");
    const onLoadClick = () => {
      void getStatsStore().refresh().catch(() => {
        // UI state is updated via store event.
      });
    };

    if (loadBtn) {
      loadBtn.addEventListener("click", onLoadClick);
    }

    const onUpdate = () => {
      const store = getStatsStore();
      renderOverviewSnapshotCard(store.getStatus(), store.getCachedStats());
    };

    window.addEventListener(getStatsStore().UPDATE_EVENT, onUpdate);

    return () => {
      if (loadBtn) {
        loadBtn.removeEventListener("click", onLoadClick);
      }
      window.removeEventListener(getStatsStore().UPDATE_EVENT, onUpdate);
    };
  }

  let unbindOverview = () => {};

  function initOverviewView() {
    const store = getStatsStore();
    const status = store.getStatus();

    unbindOverview();
    unbindOverview = bindOverviewHandlers();
    renderOverviewSnapshotCard(status, store.getCachedStats());

    if (!status.hasCache && !status.hasAttempted) {
      void store.hydrate().catch(() => {
        // UI state is updated via store event.
      });
    }
  }

  function destroyOverviewView() {
    unbindOverview();
    unbindOverview = () => {};
  }

  function buildDeltaCardsMarkup(stats) {
    const deltas = [
      { key: "day", label: "24h growth" },
      { key: "week", label: "7d growth" },
      { key: "month", label: "30d growth" },
      { key: "year", label: "1y growth" }
    ];

    const cards = deltas
      .map((item) => {
        const delta = stats.growth.deltas[item.key] || { value: null, quality: "unavailable" };
        const value = Number.isFinite(Number(delta.value)) ? Number(delta.value) : null;
        return `
          <article class="card creator-stats-delta-card">
            <h3>${escapeHtml(item.label)}</h3>
            <p class="creator-stats-delta-value ${indicatorClass(value ?? 0)}">
              <span class="creator-stats-delta-indicator">${indicatorGlyph(value)}</span>
              ${escapeHtml(formatSignedNumber(value))}
              ${createQualityBadge(delta.quality, stats.qualityLegend)}
            </p>
          </article>
        `;
      })
      .join("");

    return `
      <article class="card highlight creator-stats-total-card">
        <h3>Total audience</h3>
        <p class="creator-stats-total-value">
          ${escapeHtml(formatNumber(stats.growth.totals.audienceTotal))}
          ${createQualityBadge(stats.growth.totals.audienceTotalQuality, stats.qualityLegend)}
        </p>
        <p class="muted">
          Followers + subscribers across ${escapeHtml(formatNumber(stats.growth.totals.platformsConnected))}
          connected platform(s)
        </p>
      </article>
      ${cards}
    `;
  }

  function buildPlatformChipsMarkup(stats) {
    if (!Array.isArray(stats.channels) || !stats.channels.length) {
      return '<p class="muted">No platform audience channels were exported.</p>';
    }

    return stats.channels
      .map((channel) => {
        const delta = Number.isFinite(Number(channel.deltaWeek)) ? Number(channel.deltaWeek) : null;
        return `
          <article class="creator-stats-platform-chip">
            <h4>${escapeHtml(channel.platformLabel)}</h4>
            <p>
              ${escapeHtml(formatNumber(channel.totalCount))}
              ${createQualityBadge(channel.totalCountQuality, stats.qualityLegend)}
            </p>
            <span class="creator-stats-chip-delta ${indicatorClass(delta ?? 0)}">
              ${indicatorGlyph(delta)} ${escapeHtml(formatSignedNumber(delta))}
              ${createQualityBadge(channel.deltaWeekQuality, stats.qualityLegend)}
            </span>
          </article>
        `;
      })
      .join("");
  }
  function buildLineChartMarkup(series, options = {}) {
    if (!svgCharts?.buildLineChartMarkup) {
      return '<p class="muted">Line chart renderer unavailable.</p>';
    }

    return svgCharts.buildLineChartMarkup(series, {
      ...options,
      formatNumber,
      formatSignedNumber,
      escapeHtml,
      normalizeText
    });
  }

  function buildDonutChartMarkup(platformShare, qualityLegend) {
    if (!svgCharts?.buildDonutChartMarkup) {
      return '<p class="muted">Platform share renderer unavailable.</p>';
    }

    return svgCharts.buildDonutChartMarkup(platformShare, {
      qualityLegend,
      formatNumber,
      createQualityBadge,
      escapeHtml
    });
  }

  function buildLatestStreamMarkup(stats) {
    const latest = stats.latestStream;
    const platformRows = latest.platforms.length
      ? latest.platforms
          .map((platform) => {
            const link = platform.url
              ? `<a href="${escapeHtml(platform.url)}" target="_blank" rel="noreferrer">Open stream</a>`
              : "—";
            return `
              <tr>
                <td>${escapeHtml(platform.platformLabel)}</td>
                <td>${formatValueWithQuality(
                  platform.viewCount,
                  platform.viewCountQuality,
                  stats.qualityLegend
                )}</td>
                <td>${link}</td>
              </tr>
            `;
          })
          .join("")
      : '<tr><td colspan="3" class="muted">No per-platform stream stats exported.</td></tr>';

    return `
      <div class="creator-stats-latest-header">
        <h3>${escapeHtml(latest.title || "Latest stream unavailable")}</h3>
        <div class="creator-stats-latest-meta">
          <span>Start: ${escapeHtml(formatDateTime(latest.startedAtUtc))}</span>
          <span>End: ${escapeHtml(formatDateTime(latest.endedAtUtc))}</span>
          <span>Duration: ${escapeHtml(formatDuration(latest.durationSeconds))} ${createQualityBadge(
      latest.durationSecondsQuality,
      stats.qualityLegend
    )}</span>
        </div>
      </div>
      <div class="creator-stats-major-stat">
        <span class="stat-label">Total views</span>
        <span class="stat-value">${formatValueWithQuality(
          latest.viewCountTotal,
          latest.viewCountTotalQuality,
          stats.qualityLegend
        )}</span>
      </div>
      <table class="ss-table ss-table-compact creator-stats-table">
        <thead>
          <tr>
            <th>Platform</th>
            <th>View count</th>
            <th>URL</th>
          </tr>
        </thead>
        <tbody>${platformRows}</tbody>
      </table>
      <p class="muted creator-stats-quality-note" title="${escapeHtml(stats.qualityLegend.approximate)}">
        Quality markers:
        ${buildQualityLegendInlineItem("approximate", "approximate", stats.qualityLegend)}
        ${buildQualityLegendInlineItem("partial", "partial", stats.qualityLegend)}
        ${buildQualityLegendInlineItem("derived", "derived", stats.qualityLegend)}
        ${buildQualityLegendInlineItem("unavailable", "unavailable", stats.qualityLegend)}
      </p>
    `;
  }

  function buildRecentStreamsMarkup(streams) {
    if (!Array.isArray(streams) || !streams.length) {
      return '<li class="muted">No recent stream history exported.</li>';
    }

    return streams.slice(0, 10)
      .map((stream, index) => {
        const started = stream.startedAtUtc ? formatDateTime(stream.startedAtUtc) : "—";
        return `
          <li>
            <button type="button" class="creator-stats-recent-item" data-recent-index="${index}">
              <span>${escapeHtml(stream.title)}</span>
              <span class="muted">${escapeHtml(started)}</span>
            </button>
          </li>
        `;
      })
      .join("");
  }

  function buildRecentDetailMarkup(stream) {
    if (!stream || typeof stream !== "object") {
      return '<p class="muted">Choose a stream to inspect placeholder details.</p>';
    }

    const links = Object.entries(stream.platformUrls || {})
      .map(([platform, url]) => {
        return `<li><a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(
          formatPlatformLabel(platform)
        )}</a></li>`;
      })
      .join("");

    return `
      <h4>${escapeHtml(stream.title)}</h4>
      <p class="muted">Started ${escapeHtml(formatDateTime(stream.startedAtUtc))}</p>
      <p class="muted">Duration ${escapeHtml(formatDuration(stream.durationSeconds))}</p>
      <ul class="creator-stats-recent-links">${links || "<li class=\"muted\">No platform URL available.</li>"}</ul>
      <a class="creator-button ghost creator-stats-history-link" href="#updates" data-route="updates">
        Open Stream History placeholder
      </a>
    `;
  }

  function buildAutomationMarkup(stats) {
    const roi = stats.automationRoi.latestStream;
    const successRate = Number.isFinite(roi.automationSuccessRate) ? roi.automationSuccessRate : 0;
    const clampedRate = Math.max(0, Math.min(1, successRate));

    return `
      <div class="stat-grid">
        <div>
          <span class="stat-label">Triggers invoked</span>
          <span class="stat-value">${escapeHtml(formatNumber(roi.triggersInvoked))}</span>
        </div>
        <div>
          <span class="stat-label">Clips created</span>
          <span class="stat-value">${escapeHtml(formatNumber(roi.clipsCreated))}</span>
        </div>
        <div>
          <span class="stat-label">Jobs run</span>
          <span class="stat-value">${escapeHtml(formatNumber(roi.jobsRun))}</span>
        </div>
        <div>
          <span class="stat-label">Errors</span>
          <span class="stat-value">${escapeHtml(formatNumber(roi.errorsCount))}</span>
        </div>
      </div>
      <div class="ss-progress-row creator-stats-roi-progress">
        <div class="ss-progress-label">
          <span>Automation success rate</span>
          <span class="ss-progress-meta">${escapeHtml(formatPercentFromRatio(clampedRate))}</span>
        </div>
        <div class="ss-progress">
          <div class="ss-progress-bar" style="width:${Math.round(clampedRate * 100)}%;"></div>
        </div>
      </div>
      <p class="muted">${escapeHtml(
        roi.notes || "Phase 0 placeholder values; not sourced from live telemetry yet."
      )}</p>
    `;
  }

  function buildLoadingCards(count, title = "Loading") {
    const cards = [];
    for (let index = 0; index < count; index += 1) {
      cards.push(`
        <article class="card creator-stats-loading-card">
          <h3>${escapeHtml(title)}</h3>
          <span class="creator-stats-skeleton-block"></span>
          <span class="creator-stats-skeleton-block short"></span>
        </article>
      `);
    }
    return cards.join("");
  }
  const statisticsUi = {
    statusPill: null,
    errorPill: null,
    lastUpdated: null,
    refreshButton: null,
    qualityLegend: null,
    kpiStrip: null,
    platformChips: null,
    lineChart: null,
    donutChart: null,
    latestBreakdown: null,
    recentList: null,
    recentDetail: null,
    automationCard: null,
    removeListeners: []
  };

  function resetStatisticsUiRefs() {
    statisticsUi.statusPill = null;
    statisticsUi.errorPill = null;
    statisticsUi.lastUpdated = null;
    statisticsUi.refreshButton = null;
    statisticsUi.qualityLegend = null;
    statisticsUi.kpiStrip = null;
    statisticsUi.platformChips = null;
    statisticsUi.lineChart = null;
    statisticsUi.donutChart = null;
    statisticsUi.latestBreakdown = null;
    statisticsUi.recentList = null;
    statisticsUi.recentDetail = null;
    statisticsUi.automationCard = null;
  }

  function cacheStatisticsElements() {
    statisticsUi.statusPill = document.getElementById("creator-stats-fetch-state");
    statisticsUi.errorPill = document.getElementById("creator-stats-error");
    statisticsUi.lastUpdated = document.getElementById("creator-stats-last-updated");
    statisticsUi.refreshButton = document.getElementById("creator-stats-refresh");
    statisticsUi.qualityLegend = document.getElementById("creator-stats-quality-legend");
    statisticsUi.kpiStrip = document.getElementById("creator-stats-kpi-strip");
    statisticsUi.platformChips = document.getElementById("creator-stats-platform-chips");
    statisticsUi.lineChart = document.getElementById("creator-stats-line-chart");
    statisticsUi.donutChart = document.getElementById("creator-stats-donut-chart");
    statisticsUi.latestBreakdown = document.getElementById("creator-stats-latest-breakdown");
    statisticsUi.recentList = document.getElementById("creator-stats-recent-list");
    statisticsUi.recentDetail = document.getElementById("creator-stats-recent-detail");
    statisticsUi.automationCard = document.getElementById("creator-stats-automation");

    return Boolean(
      statisticsUi.statusPill &&
        statisticsUi.errorPill &&
        statisticsUi.lastUpdated &&
        statisticsUi.refreshButton &&
        statisticsUi.qualityLegend &&
        statisticsUi.kpiStrip &&
        statisticsUi.platformChips &&
        statisticsUi.lineChart &&
        statisticsUi.donutChart &&
        statisticsUi.latestBreakdown &&
        statisticsUi.recentList &&
        statisticsUi.recentDetail &&
        statisticsUi.automationCard
    );
  }

  function setStatisticsStatusPill(tone, text) {
    if (!statisticsUi.statusPill) return;
    statisticsUi.statusPill.classList.remove("subtle", "success", "warning");
    statisticsUi.statusPill.classList.add(tone);
    statisticsUi.statusPill.textContent = text;
  }

  function showStatisticsError(message) {
    if (!statisticsUi.errorPill) return;
    if (!message) {
      statisticsUi.errorPill.classList.add("hidden");
      statisticsUi.errorPill.textContent = "";
      return;
    }
    statisticsUi.errorPill.textContent = message;
    statisticsUi.errorPill.classList.remove("hidden");
  }

  function renderStatisticsLoadingLayout() {
    if (statisticsUi.qualityLegend) {
      statisticsUi.qualityLegend.innerHTML = `
        Data quality:
        ${buildQualityLegendInlineItem("approximate", "approximate", DEFAULT_QUALITY_LEGEND)}
        ${buildQualityLegendInlineItem("partial", "partial", DEFAULT_QUALITY_LEGEND)}
        ${buildQualityLegendInlineItem("derived", "derived", DEFAULT_QUALITY_LEGEND)}
        ${buildQualityLegendInlineItem("unavailable", "unavailable", DEFAULT_QUALITY_LEGEND)}
      `;
    }
    statisticsUi.kpiStrip.innerHTML = buildLoadingCards(5, "Loading metrics");
    statisticsUi.platformChips.innerHTML = buildLoadingCards(3, "Loading platform stats");
    statisticsUi.lineChart.innerHTML = '<div class="creator-stats-chart-loading"></div>';
    statisticsUi.donutChart.innerHTML = '<div class="creator-stats-chart-loading"></div>';
    statisticsUi.latestBreakdown.innerHTML = buildLoadingCards(1, "Loading stream breakdown");
    statisticsUi.recentList.innerHTML = '<li class="muted">Loading recent streams...</li>';
    statisticsUi.recentDetail.innerHTML =
      '<p class="muted">Select a recent stream to inspect placeholder details.</p>';
    statisticsUi.automationCard.innerHTML = buildLoadingCards(1, "Loading automation ROI");
  }

  function renderStatisticsContent(stats) {
    if (statisticsUi.qualityLegend) {
      statisticsUi.qualityLegend.innerHTML = `
        ${buildQualityLegendInlineItem("approximate", "approximate", stats.qualityLegend)}
        ${buildQualityLegendInlineItem("partial", "partial", stats.qualityLegend)}
        ${buildQualityLegendInlineItem("derived", "derived", stats.qualityLegend)}
        ${buildQualityLegendInlineItem("unavailable", "unavailable", stats.qualityLegend)}
      `;
    }
    statisticsUi.kpiStrip.innerHTML = buildDeltaCardsMarkup(stats);
    statisticsUi.platformChips.innerHTML = buildPlatformChipsMarkup(stats);
    statisticsUi.lineChart.innerHTML = buildLineChartMarkup(stats.growthSeries, {
      dateLabels: stats.growthSeriesDateLabels
    });
    statisticsUi.donutChart.innerHTML = buildDonutChartMarkup(stats.platformShare, stats.qualityLegend);
    statisticsUi.latestBreakdown.innerHTML = buildLatestStreamMarkup(stats);
    statisticsUi.recentList.innerHTML = buildRecentStreamsMarkup(stats.recentStreams);
    statisticsUi.recentDetail.innerHTML =
      '<p class="muted">Select a stream title to open compact details.</p>';
    statisticsUi.recentDetail.classList.remove("hidden");
    statisticsUi.automationCard.innerHTML = buildAutomationMarkup(stats);
  }

  function renderStatisticsByStatus() {
    const store = getStatsStore();
    const status = store.getStatus();
    const stats = store.getCachedStats();

    if (!statisticsUi.lastUpdated) return;

    statisticsUi.lastUpdated.textContent = `Last updated: ${formatDateTime(status.generatedAtUtc)}`;

    if (status.status === FETCH_STATUS.loading && !stats) {
      setStatisticsStatusPill("subtle", "Loading stats");
      showStatisticsError("");
      renderStatisticsLoadingLayout();
      return;
    }

    if (!stats && status.status === FETCH_STATUS.error) {
      setStatisticsStatusPill("warning", "Stats unavailable");
      showStatisticsError(status.error?.message || "Creator statistics unavailable.");
      renderStatisticsLoadingLayout();
      return;
    }

    if (!stats) {
      setStatisticsStatusPill("subtle", "Ready");
      showStatisticsError("");
      renderStatisticsLoadingLayout();
      return;
    }

    if (status.error) {
      setStatisticsStatusPill("warning", "Showing cached stats");
      showStatisticsError(status.error.message || "Refresh failed; showing cached data.");
    } else {
      setStatisticsStatusPill("success", "Stats synced");
      showStatisticsError("");
    }

    renderStatisticsContent(stats);
  }

  function handleRecentStreamClick(event) {
    const trigger = event.target.closest("[data-recent-index]");
    if (!(trigger instanceof HTMLElement)) return;

    const index = Number(trigger.dataset.recentIndex);
    if (!Number.isFinite(index)) return;

    const stats = getStatsStore().getCachedStats();
    const stream = stats?.recentStreams?.[index] || null;
    if (!statisticsUi.recentDetail) return;
    statisticsUi.recentDetail.innerHTML = buildRecentDetailMarkup(stream);
    statisticsUi.recentDetail.classList.remove("hidden");
  }

  function bindStatisticsEvents() {
    const onRefreshClick = () => {
      void getStatsStore().refresh().catch(() => {
        // UI state is updated via store event.
      });
    };

    const onStoreUpdate = () => {
      renderStatisticsByStatus();
    };

    statisticsUi.refreshButton.addEventListener("click", onRefreshClick);
    statisticsUi.recentList.addEventListener("click", handleRecentStreamClick);
    window.addEventListener(getStatsStore().UPDATE_EVENT, onStoreUpdate);

    statisticsUi.removeListeners.push(() => {
      statisticsUi.refreshButton.removeEventListener("click", onRefreshClick);
      statisticsUi.recentList.removeEventListener("click", handleRecentStreamClick);
      window.removeEventListener(getStatsStore().UPDATE_EVENT, onStoreUpdate);
    });
  }

  function cleanupStatisticsEvents() {
    while (statisticsUi.removeListeners.length) {
      const remove = statisticsUi.removeListeners.pop();
      try {
        remove();
      } catch (_err) {
        // Ignore teardown errors.
      }
    }
  }

  function initStatisticsView() {
    cleanupStatisticsEvents();
    if (!cacheStatisticsElements()) {
      resetStatisticsUiRefs();
      return;
    }

    bindStatisticsEvents();
    renderStatisticsByStatus();

    const status = getStatsStore().getStatus();
    if (!status.hasCache && !status.hasAttempted) {
      void getStatsStore().hydrate().catch(() => {
        // UI state is updated via store event.
      });
    }
  }

  function destroyStatisticsView() {
    cleanupStatisticsEvents();
    resetStatisticsUiRefs();
  }

  getStatsStore();

  window.OverviewView = {
    init: initOverviewView,
    destroy: destroyOverviewView
  };

  window.StatisticsView = {
    init: initStatisticsView,
    destroy: destroyStatisticsView
  };
})();


