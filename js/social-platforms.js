(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.StreamSuitesSocialPlatforms = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const REGISTRY = Object.freeze([
    {
      key: "rumble",
      label: "Rumble",
      icon: "/assets/icons/rumble.svg",
      group: "first-class",
      category: "streaming",
      placeholder: "https://rumble.com/c/yourchannel",
      aliases: ["rumble"],
    },
    {
      key: "youtube",
      label: "YouTube",
      icon: "/assets/icons/youtube.svg",
      group: "first-class",
      category: "streaming",
      placeholder: "https://youtube.com/@yourhandle",
      aliases: ["youtube", "yt"],
    },
    {
      key: "twitch",
      label: "Twitch",
      icon: "/assets/icons/twitch.svg",
      group: "first-class",
      category: "streaming",
      placeholder: "https://twitch.tv/yourhandle",
      aliases: ["twitch"],
    },
    {
      key: "kick",
      label: "Kick",
      icon: "/assets/icons/kick.svg",
      group: "first-class",
      category: "streaming",
      placeholder: "https://kick.com/yourhandle",
      aliases: ["kick"],
    },
    {
      key: "pilled",
      label: "Pilled",
      icon: "/assets/icons/pilled.svg",
      group: "first-class",
      category: "streaming",
      placeholder: "https://pilled.net/profile/yourhandle",
      aliases: ["pilled"],
    },
    {
      key: "discord",
      label: "Discord",
      icon: "/assets/icons/discord.svg",
      group: "first-class",
      category: "community",
      placeholder: "https://discord.gg/yourserver",
      aliases: ["discord"],
    },
    {
      key: "x",
      label: "X",
      icon: "/assets/icons/x.svg",
      group: "first-class",
      category: "social",
      placeholder: "https://x.com/yourhandle",
      aliases: ["x", "twitter"],
    },
    {
      key: "instagram",
      label: "Instagram",
      icon: "/assets/icons/instagram.svg",
      group: "first-class",
      category: "social",
      placeholder: "https://instagram.com/yourhandle",
      aliases: ["instagram", "insta"],
    },
    {
      key: "tiktok",
      label: "TikTok",
      icon: "/assets/icons/tiktok.svg",
      group: "first-class",
      category: "social",
      placeholder: "https://tiktok.com/@yourhandle",
      aliases: ["tiktok", "tik_tok"],
    },
    {
      key: "facebook",
      label: "Facebook",
      icon: "/assets/icons/facebook.svg",
      group: "first-class",
      category: "social",
      placeholder: "https://facebook.com/yourpage",
      aliases: ["facebook", "fb"],
    },
    {
      key: "threads",
      label: "Threads",
      icon: "/assets/icons/threads.svg",
      group: "first-class",
      category: "social",
      placeholder: "https://threads.net/@yourhandle",
      aliases: ["threads"],
    },
    {
      key: "reddit",
      label: "Reddit",
      icon: "/assets/icons/reddit.svg",
      group: "first-class",
      category: "community",
      placeholder: "https://reddit.com/u/yourhandle",
      aliases: ["reddit"],
    },
    {
      key: "telegram",
      label: "Telegram",
      icon: "/assets/icons/telegram.svg",
      group: "first-class",
      category: "community",
      placeholder: "https://t.me/yourhandle",
      aliases: ["telegram"],
    },
    {
      key: "whatsappchannels",
      label: "WhatsApp Channels",
      icon: "/assets/icons/whatsapp.svg",
      group: "first-class",
      category: "community",
      placeholder: "https://whatsapp.com/channel/yourchannel",
      aliases: ["whatsappchannels", "whatsappchannel", "whatsapp_channels", "whatsapp_channel", "whatsapp"],
    },
    {
      key: "patreon",
      label: "Patreon",
      icon: "/assets/icons/patreon.svg",
      group: "first-class",
      category: "support",
      placeholder: "https://patreon.com/yourhandle",
      aliases: ["patreon"],
    },
    {
      key: "substack",
      label: "Substack",
      icon: "/assets/icons/substack.svg",
      group: "first-class",
      category: "support",
      placeholder: "https://yourhandle.substack.com",
      aliases: ["substack"],
    },
    {
      key: "soundcloud",
      label: "SoundCloud",
      icon: "/assets/icons/soundcloud.svg",
      group: "first-class",
      category: "audio",
      placeholder: "https://soundcloud.com/yourhandle",
      aliases: ["soundcloud", "sound_cloud"],
    },
    {
      key: "applepodcasts",
      label: "Apple Podcasts",
      icon: "/assets/icons/applepodcasts.svg",
      group: "first-class",
      category: "audio",
      placeholder: "https://podcasts.apple.com/...",
      aliases: ["applepodcasts", "apple_podcasts", "applepodcast", "apple_podcast"],
    },
    {
      key: "website",
      label: "Website",
      icon: "/assets/icons/website.svg",
      group: "first-class",
      category: "owned",
      placeholder: "https://example.com",
      aliases: ["website", "site", "web", "url", "homepage"],
    },
    {
      key: "bluesky",
      label: "Bluesky",
      icon: "/assets/icons/bluesky.svg",
      group: "extended",
      category: "social",
      placeholder: "https://bsky.app/profile/yourhandle",
      aliases: ["bluesky", "bsky"],
    },
    {
      key: "locals",
      label: "Locals",
      icon: "/assets/icons/locals.svg",
      group: "extended",
      category: "community",
      placeholder: "https://yourcommunity.locals.com",
      aliases: ["locals"],
    },
    {
      key: "spotify",
      label: "Spotify",
      icon: "/assets/icons/spotify.svg",
      group: "extended",
      category: "audio",
      placeholder: "https://open.spotify.com/artist/...",
      aliases: ["spotify"],
    },
    {
      key: "vimeo",
      label: "Vimeo",
      icon: "/assets/icons/vimeo.svg",
      group: "extended",
      category: "video",
      placeholder: "https://vimeo.com/yourhandle",
      aliases: ["vimeo"],
    },
    {
      key: "dailymotion",
      label: "Dailymotion",
      icon: "/assets/icons/dailymotion.svg",
      group: "extended",
      category: "video",
      placeholder: "https://dailymotion.com/yourhandle",
      aliases: ["dailymotion"],
    },
    {
      key: "odysee",
      label: "Odysee",
      icon: "/assets/icons/odysee.svg",
      group: "extended",
      category: "video",
      placeholder: "https://odysee.com/@yourhandle",
      aliases: ["odysee"],
    },
    {
      key: "trovo",
      label: "Trovo",
      icon: "/assets/icons/trovo.svg",
      group: "extended",
      category: "streaming",
      placeholder: "https://trovo.live/yourhandle",
      aliases: ["trovo"],
    },
    {
      key: "snapchat",
      label: "Snapchat",
      icon: "/assets/icons/snapchat.svg",
      group: "extended",
      category: "social",
      placeholder: "https://snapchat.com/add/yourhandle",
      aliases: ["snapchat"],
    },
    {
      key: "pinterest",
      label: "Pinterest",
      icon: "/assets/icons/pinterest.svg",
      group: "extended",
      category: "social",
      placeholder: "https://pinterest.com/yourhandle",
      aliases: ["pinterest"],
    },
    {
      key: "kofi",
      label: "Ko-fi",
      icon: "/assets/icons/kofi.svg",
      group: "extended",
      category: "support",
      placeholder: "https://ko-fi.com/yourhandle",
      aliases: ["kofi", "ko-fi", "ko_fi"],
    },
    {
      key: "github",
      label: "GitHub",
      icon: "/assets/icons/github.svg",
      group: "extended",
      category: "owned",
      placeholder: "https://github.com/yourhandle",
      aliases: ["github"],
    },
    {
      key: "minds",
      label: "Minds",
      icon: "/assets/icons/minds.svg",
      group: "extended",
      category: "community",
      placeholder: "https://minds.com/yourhandle",
      aliases: ["minds"],
    },
    {
      key: "custom",
      label: "Custom",
      icon: "/assets/icons/link.svg",
      group: "extended",
      category: "owned",
      placeholder: "https://example.com/custom",
      aliases: ["custom", "link"],
    },
  ]);

  const METADATA = Object.freeze(
    REGISTRY.reduce((acc, entry, index) => {
      acc[entry.key] = Object.freeze({ ...entry, order: index });
      return acc;
    }, {})
  );

  const ALIAS_MAP = Object.freeze(
    REGISTRY.reduce((acc, entry) => {
      entry.aliases.forEach((alias) => {
        acc[String(alias || "").replace(/[\s_-]+/g, "").toLowerCase()] = entry.key;
      });
      return acc;
    }, {})
  );

  const ORDER = Object.freeze(REGISTRY.map((entry) => entry.key));
  const FIRST_CLASS_KEYS = Object.freeze(REGISTRY.filter((entry) => entry.group === "first-class").map((entry) => entry.key));
  const EXTENDED_KEYS = Object.freeze(REGISTRY.filter((entry) => entry.group === "extended").map((entry) => entry.key));

  function safeText(value) {
    return String(value || "").trim();
  }

  function normalizeKey(value) {
    const normalized = safeText(value).toLowerCase().replace(/[\s_-]+/g, "");
    if (!normalized) return "";
    return ALIAS_MAP[normalized] || normalized;
  }

  function getMeta(key) {
    return METADATA[normalizeKey(key)] || null;
  }

  function getLabel(key) {
    const meta = getMeta(key);
    if (meta?.label) return meta.label;
    const raw = safeText(key).replace(/[_-]+/g, " ");
    return raw ? raw.replace(/\b\w/g, (char) => char.toUpperCase()) : "Custom";
  }

  function getIcon(key) {
    return getMeta(key)?.icon || "/assets/icons/link.svg";
  }

  function normalizeLinks(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.entries(value).reduce((acc, [rawKey, rawValue]) => {
      const key = normalizeKey(rawKey);
      const text = safeText(rawValue);
      if (!key || !text) return acc;
      if (!acc[key]) acc[key] = text;
      return acc;
    }, {});
  }

  function getOrderedEntries(value) {
    const normalized = normalizeLinks(value);
    const seen = new Set();
    const entries = [];

    ORDER.forEach((key) => {
      const url = safeText(normalized[key]);
      if (!url) return;
      entries.push({
        key,
        label: getLabel(key),
        icon: getIcon(key),
        url,
        meta: getMeta(key),
      });
      seen.add(key);
    });

    Object.entries(normalized).forEach(([key, url]) => {
      if (seen.has(key)) return;
      entries.push({
        key,
        label: getLabel(key),
        icon: getIcon(key),
        url,
        meta: getMeta(key),
      });
    });

    return entries;
  }

  function matchesQuery(meta, query) {
    const normalizedQuery = safeText(query).toLowerCase().replace(/[\s_-]+/g, "");
    if (!normalizedQuery) return true;
    const haystack = [meta?.key, meta?.label]
      .concat(Array.isArray(meta?.aliases) ? meta.aliases : [])
      .map((value) => safeText(value).toLowerCase().replace(/[\s_-]+/g, ""))
      .filter(Boolean);
    return haystack.some((value) => value.includes(normalizedQuery));
  }

  return Object.freeze({
    REGISTRY,
    ORDER,
    FIRST_CLASS_KEYS,
    EXTENDED_KEYS,
    METADATA,
    ALIAS_MAP,
    normalizeKey,
    normalizeLinks,
    getMeta,
    getLabel,
    getIcon,
    getOrderedEntries,
    matchesQuery,
  });
});
